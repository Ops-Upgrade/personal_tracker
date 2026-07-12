"use client";

import { useCallback, useMemo, useState } from "react";
import { useAuthBootstrap } from "@/lib/useAuthBootstrap";
import {
  createEducation,
  deleteEducation,
  fetchEducations,
  updateEducation,
  createCertificate,
  deleteCertificate,
  fetchCertificates,
  updateCertificate,
  uploadCertificateFile,
  downloadCertificateFile,
  deleteCertificateFile,
} from "@/api/education";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { ROUTES } from "@/routes/paths";
import type { Certificate, CertificatePlaintext, Education, EducationPlaintext, EducationViewMode } from "@/types/education";
import type { Priority } from "@/types/taskmanager";
import { PRIORITIES } from "@/types/taskmanager";
import type { ViewToggleOption } from "@/components/common/ViewToggle";
import ViewToggle from "@/components/common/ViewToggle";
import MonthTile from "@/components/common/MonthTile";
import BoxContainer, { SCROLLABLE_CLASSES } from "@/components/common/BoxContainer";
import PageShell from "@/components/common/PageShell";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import PriorityBadge from "@/components/taskmanager/PriorityBadge";
import { getPriorityColor } from "@/lib/priorityColors";
import {
  byPriority,
  certCountForEducation,
  completedByMonths,
  sortByCompletedDesc,
  formatShortDate,
  trunc,
} from "@/components/education/helpers";
import EducationModal from "@/components/education/EducationModal";
import { MONTH_NAMES } from "@/lib/constants";

const VIEW_OPTIONS: readonly ViewToggleOption<EducationViewMode>[] = [
  { value: "months", label: "Months" },
  { value: "priority", label: "Priority" },
];

export default function CompletedEducationsPage() {
  const [educations, setEducations] = useState<Education[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);

  const loadData = useCallback(async (uid: string) => {
    const [eduRows, certRows] = await Promise.all([
      fetchEducations(uid),
      fetchCertificates(uid),
    ]);
    setEducations(eduRows);
    setCertificates(certRows);
  }, []);

  const { userId, nowYear, nowMonth, isLoading, error, refreshData } =
    useAuthBootstrap({ loadData, fetchServerDate: false });

  const [view, setView] = useLocalStorage<EducationViewMode>("educationCompletedView", "months");
  const [eduModalTarget, setEduModalTarget] = useState<Education | null>(null);

  const completedEducations = useMemo(
    () => educations.filter((e) => e.is_completed),
    [educations]
  );

  const priorityGroups = byPriority(completedEducations);
  const monthGroups = completedByMonths(completedEducations, nowYear);

  const handleEditEducation = (edu: Education) => {
    setEduModalTarget(edu);
  };

  const closeEduModal = () => setEduModalTarget(null);

  // ---- Education CRUD handlers (mirrors EducationView) ----

  async function handleEducationSave(
    draft: {
      name: string;
      provider: string;
      priority: Priority;
      due_date: string | null;
      description: string;
      is_completed: boolean;
    },
    existingEducation: Education | null,
    pendingCert?: { file: File; label: string },
    pendingLinkCertId?: string,
    pendingUnlinkCertIds?: string[],
    pendingDeleteCertIds?: string[],
  ) {
    if (!userId) throw new Error("No active session.");

    const freshEdus = await fetchEducations(userId);
    const freshCerts = await fetchCertificates(userId);
    const freshEdu = existingEducation ? freshEdus.find(e => e.id === existingEducation.id) : null;

    let currentCertIds = [...(freshEdu?.certificate_ids ?? [])];

    const nowIso = new Date().toISOString();
    const completedAt = draft.is_completed
      ? freshEdu?.completed_at ?? nowIso
      : null;

    if (pendingUnlinkCertIds && pendingUnlinkCertIds.length > 0 && existingEducation) {
      for (const certId of pendingUnlinkCertIds) {
        const cert = freshCerts.find(c => c.id === certId);
        if (cert) {
          await updateCertificate(userId, certId, {
            ...cert,
            education_id: "",
            updated_at: nowIso,
          } as CertificatePlaintext);
        }
        currentCertIds = currentCertIds.filter(id => id !== certId);
      }
    }

    if (pendingDeleteCertIds && pendingDeleteCertIds.length > 0) {
      for (const certId of pendingDeleteCertIds) {
        const cert = freshCerts.find(c => c.id === certId);
        if (cert) {
          currentCertIds = currentCertIds.filter(id => id !== certId);
          if (cert.file_name) {
            try { await deleteCertificateFile(userId, cert.file_name); } catch { /* best-effort */ }
          }
          await deleteCertificate(certId);
        }
      }
    }

    const payload = {
      ...draft,
      completed_at: completedAt,
      certificate_ids: currentCertIds,
      updated_at: nowIso,
    };

    let savedEdu: Education;
    if (existingEducation) {
      savedEdu = await updateEducation(userId, existingEducation.id, payload);
    } else {
      savedEdu = await createEducation(userId, payload);
    }

    let needsUpdate = false;
    const newCertIds = [...currentCertIds];

    if (pendingCert) {
      const { fileName, iv, mimeType } = await uploadCertificateFile(userId, pendingCert.file);
      const cert = await createCertificate(userId, {
        label: pendingCert.label,
        file_name: fileName,
        file_iv: iv,
        file_mime: mimeType,
        education_id: savedEdu.id,
        updated_at: nowIso,
      });
      newCertIds.push(cert.id);
      needsUpdate = true;
    }

    if (pendingLinkCertId) {
      const pcert = freshCerts.find(c => c.id === pendingLinkCertId);
      if (pcert) {
        await updateCertificate(userId, pendingLinkCertId, {
          ...pcert,
          education_id: savedEdu.id,
          updated_at: nowIso,
        } as CertificatePlaintext);
        if (!newCertIds.includes(pendingLinkCertId)) {
          newCertIds.push(pendingLinkCertId);
        }
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      await updateEducation(userId, savedEdu.id, {
        ...payload,
        certificate_ids: newCertIds,
        updated_at: new Date().toISOString(),
      });
    }

    await refreshData(userId);
  }

  async function handleEducationDelete(educationId: string, cascadeMode: 'unlink' | 'cascade') {
    if (!userId) throw new Error("No active session.");

    if (cascadeMode === 'unlink') {
      const linkedCerts = certificates.filter((c) => c.education_id === educationId);
      const nowIso = new Date().toISOString();
      for (const cert of linkedCerts) {
        await updateCertificate(userId, cert.id, {
          ...cert,
          education_id: "",
          updated_at: nowIso,
        } as CertificatePlaintext);
      }
    } else {
      const linkedCerts = certificates.filter((c) => c.education_id === educationId);
      for (const cert of linkedCerts) {
        if (cert.file_name) {
          try { await deleteCertificateFile(userId, cert.file_name); } catch { /* best-effort */ }
        }
        await deleteCertificate(cert.id);
      }
    }

    await deleteEducation(educationId);
    await refreshData(userId);
  }

  async function handleLinkCertificate(educationId: string, certificateId: string) {
    if (!userId) throw new Error("No active session.");
    const cert = certificates.find((c) => c.id === certificateId);
    if (!cert) return;
    const nowIso = new Date().toISOString();
    await updateCertificate(userId, certificateId, {
      ...cert,
      education_id: educationId,
      updated_at: nowIso,
    } as CertificatePlaintext);
    const edu = educations.find(e => e.id === educationId);
    if (edu && !edu.certificate_ids.includes(certificateId)) {
      await updateEducation(userId, educationId, {
        ...edu,
        certificate_ids: [...edu.certificate_ids, certificateId],
        updated_at: nowIso
      } as EducationPlaintext);
    }
    await refreshData(userId);
  }

  async function handleUnlinkCertificate(educationId: string, certificateId: string) {
    if (!userId) throw new Error("No active session.");
    const cert = certificates.find((c) => c.id === certificateId);
    if (!cert) return;
    const nowIso = new Date().toISOString();
    await updateCertificate(userId, certificateId, {
      ...cert,
      education_id: "",
      updated_at: nowIso,
    } as CertificatePlaintext);
    const edu = educations.find(e => e.id === educationId);
    if (edu) {
      const newCertIds = edu.certificate_ids.filter(id => id !== certificateId);
      const isStillCompleted = newCertIds.length > 0 ? edu.is_completed : false;
      await updateEducation(userId, educationId, {
        ...edu,
        certificate_ids: newCertIds,
        is_completed: isStillCompleted,
        completed_at: isStillCompleted ? edu.completed_at : null,
        updated_at: nowIso
      } as EducationPlaintext);
    }
    await refreshData(userId);
  }

  async function handleUploadCertificateForEducation(
    educationId: string,
    file: File,
    label: string
  ) {
    if (!userId) throw new Error("No active session.");
    const nowIso = new Date().toISOString();
    const { fileName, iv, mimeType } = await uploadCertificateFile(userId, file);
    const cert = await createCertificate(userId, {
      label,
      file_name: fileName,
      file_iv: iv,
      file_mime: mimeType,
      education_id: educationId,
      updated_at: nowIso,
    });
    const edu = educations.find(e => e.id === educationId);
    if (edu) {
      await updateEducation(userId, edu.id, {
        ...edu,
        certificate_ids: [...edu.certificate_ids, cert.id],
        updated_at: nowIso,
      } as EducationPlaintext);
    }
    await refreshData(userId);
    return cert;
  }

  async function handleDownloadCertificate(certificate: Certificate) {
    if (!userId) throw new Error("No active session.");
    const blob = await downloadCertificateFile(
      userId,
      certificate.file_name,
      certificate.file_iv,
      certificate.file_mime
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = certificate.label || "certificate";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleDeleteCertificateFromEducation(certificate: Certificate, cascadeMode: 'unlink' | 'cascade') {
    if (!userId) throw new Error("No active session.");

    if (cascadeMode === 'cascade' && certificate.education_id) {
       await deleteEducation(certificate.education_id);
    } else if (cascadeMode === 'unlink' && certificate.education_id) {
      const edu = educations.find((e) => e.id === certificate.education_id);
      if (edu) {
        const nowIso = new Date().toISOString();
        const newCertIds = edu.certificate_ids.filter((id) => id !== certificate.id);
        const isStillCompleted = newCertIds.length > 0 ? edu.is_completed : false;
        await updateEducation(userId, edu.id, {
          ...edu,
          certificate_ids: newCertIds,
          is_completed: isStillCompleted,
          completed_at: isStillCompleted ? edu.completed_at : null,
          updated_at: nowIso,
        } as EducationPlaintext);
      }
    }

    if (certificate.file_name) {
      try { await deleteCertificateFile(userId, certificate.file_name); } catch {}
    }

    await deleteCertificate(certificate.id);
    await refreshData(userId);
  }

  return (
    <>
      <PageShell
        backHref={ROUTES.EDUCATION}
        backLabel="← Back to Education"
        title="Completed Educations"
        description="All your completed courses and certifications."
        error={error}
        onRetry={() => userId && refreshData(userId)}
      >
      {isLoading && <LoadingSpinner />}

      {!isLoading && (
        <BoxContainer>
          <header className="mb-3">
            <ViewToggle
              value={view}
              onChange={setView}
              options={VIEW_OPTIONS}
              ariaLabel="Completed educations view toggle"
            />
          </header>

          <div className={`${SCROLLABLE_CLASSES} space-y-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800`}>
            {completedEducations.length === 0 && (
              <div className="text-sm text-zinc-500 dark:text-zinc-400">None</div>
            )}

            {view === "priority" &&
              PRIORITIES.map((priority) => {
                const group = [...(priorityGroups[priority as Priority] ?? [])].sort(sortByCompletedDesc);
                if (group.length === 0) return null;
                const colors = getPriorityColor(priority as Priority);
                return (
                  <section
                    key={priority}
                    className={`rounded-lg border ${colors.border} ${colors.bg} p-2`}
                  >
                    <h3 className="mb-2">
                      <PriorityBadge priority={priority as Priority} />
                    </h3>
                    <div className="space-y-2">
                      {group.map((edu) => {
                        const certCount = certCountForEducation(edu.id, certificates);
                        return (
                        <div
                          key={edu.id}
                          className={`grid w-full grid-cols-12 items-center gap-2 rounded-md border border-zinc-200 px-2 py-1.5 text-left text-sm dark:border-zinc-700 border-l-[3px] ${colors.border}`}
                        >
                          <button
                            type="button"
                            onClick={() => handleEditEducation(edu)}
                            className="col-span-7 cursor-pointer text-left font-semibold text-zinc-800 hover:text-zinc-900 dark:text-zinc-100 dark:hover:text-white"
                          >
                            {trunc(edu.name, 42)}
                          </button>
                          <span className="col-span-2 text-center">
                            {certCount > 0 ? (
                              <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                {certCount} cert{certCount !== 1 ? "s" : ""}
                              </span>
                            ) : (
                              <span className="text-xs text-zinc-400">—</span>
                            )}
                          </span>
                          <span className="col-span-3 text-right pr-2 text-zinc-600 dark:text-zinc-300">
                            {formatShortDate(edu.completed_at)}
                          </span>
                        </div>
                      )})}
                    </div>
                  </section>
                );
              })}

            {view === "months" &&
              monthGroups.map((group, index) => {
                const isCurrentMonth = MONTH_NAMES[nowMonth] === group.label;
                return (
                  <MonthTile
                    key={group.label}
                    title={group.label}
                    defaultExpanded={index === 0}
                    accent
                    className="text-sm"
                    highlight={isCurrentMonth}
                  >
                    <div className="space-y-2">
                      {group.items.map((edu) => {
                        const colors = getPriorityColor((edu as Education).priority);
                        const certCount = certCountForEducation(edu.id, certificates);
                        return (
                          <div
                            key={edu.id}
                            className={`grid w-full grid-cols-12 items-center gap-2 rounded-md border border-zinc-200 px-2 py-1.5 text-left text-sm dark:border-zinc-700 border-l-[3px] ${colors.border}`}
                          >
                            <button
                              type="button"
                              onClick={() => handleEditEducation(edu)}
                              className="col-span-5 cursor-pointer text-left font-semibold text-zinc-800 hover:text-zinc-900 dark:text-zinc-100 dark:hover:text-white"
                            >
                              {trunc(edu.name, 32)}
                            </button>
                            <span className="col-span-2">
                              {(edu as Education).priority ? (
                                <PriorityBadge priority={(edu as Education).priority} />
                              ) : (
                                "-"
                              )}
                            </span>
                            <span className="col-span-2 text-center">
                              {certCount > 0 ? (
                                <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                  {certCount} cert{certCount !== 1 ? "s" : ""}
                                </span>
                              ) : (
                                <span className="text-xs text-zinc-400">—</span>
                              )}
                            </span>
                            <span className="col-span-3 text-right pr-2 text-zinc-600 dark:text-zinc-300">
                              {formatShortDate(edu.completed_at)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </MonthTile>
                );
              })}
          </div>
        </BoxContainer>
      )}
    </PageShell>

      {eduModalTarget && (
        <EducationModal
          education={eduModalTarget}
          certificates={certificates}
          userId={userId || ""}
          onClose={closeEduModal}
          onSave={handleEducationSave}
          onDelete={handleEducationDelete}
          onUploadCertificate={handleUploadCertificateForEducation}
          onDownloadCertificate={handleDownloadCertificate}
          onDeleteCertificate={handleDeleteCertificateFromEducation}
          onLinkCertificate={handleLinkCertificate}
          onUnlinkCertificate={handleUnlinkCertificate}
        />
      )}
    </>
  );
}
