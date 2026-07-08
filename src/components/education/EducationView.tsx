"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ROUTES } from "@/routes/paths";
import { getSession } from "@/api/auth";
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
import Button from "@/components/common/Button";
import type { Certificate, CertificatePlaintext, Education, EducationPlaintext, EducationViewMode } from "@/types/education";
import type { Priority } from "@/types/taskmanager";
import ActiveEducationsBox from "./ActiveEducationsBox";
import CompletedEducationsBox from "./CompletedEducationsBox";
import CompletedEducationsModal from "./CompletedEducationsModal";
import EducationModal from "./EducationModal";

function FolderIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
    </svg>
  );
}

/**
 * Education feature shell.
 * Mirrors TaskManagerView: bootstrap, state, CRUD handlers, 3-box layout.
 */
export default function EducationView() {
  const [userId, setUserId] = useState<string | null>(null);
  const [educations, setEducations] = useState<Education[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [expandedModal, setExpandedModal] = useState<"completed" | null>(null);
  const [eduModalTarget, setEduModalTarget] = useState<Education | "create" | null>(null);
  const [activeView, setActiveView] = useState<EducationViewMode>("months");

  const nowYear = new Date().getFullYear();
  const nowMonth = new Date().getMonth();

  const activeEducations = useMemo(
    () => educations.filter((e) => !e.is_completed),
    [educations]
  );
  const completedEducations = useMemo(
    () => educations.filter((e) => e.is_completed),
    [educations]
  );

  // ---- Hash-based expanded modal ----

  const syncExpandedModalFromHash = useCallback(() => {
    const rawHash = window.location.hash.replace("#", "");
    if (rawHash === "completed") {
      setExpandedModal(rawHash);
      return;
    }
    setExpandedModal(null);
  }, []);

  const closeExpandedModal = useCallback(() => {
    if (!window.location.hash) {
      setExpandedModal(null);
      return;
    }
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`
    );
    setExpandedModal(null);
  }, []);

  const openExpandedModal = useCallback((kind: "completed") => {
    window.location.hash = kind;
  }, []);

  // ---- Data loading ----

  const loadAllData = useCallback(async (uid: string) => {
    const [eduRows, certRows] = await Promise.all([
      fetchEducations(uid),
      fetchCertificates(uid),
    ]);
    setEducations(eduRows);
    setCertificates(certRows);
  }, []);

  const refreshData = useCallback(
    async (uid: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await loadAllData(uid);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to refresh education data.");
      } finally {
        setIsLoading(false);
      }
    },
    [loadAllData]
  );

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const session = await getSession();
        const uid = session?.user.id;
        if (!uid) throw new Error("No active session.");
        if (cancelled) return;
        setUserId(uid);
        await refreshData(uid);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Failed to load education data."
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [refreshData]);

  useEffect(() => {
    syncExpandedModalFromHash();
    window.addEventListener("hashchange", syncExpandedModalFromHash);
    return () => {
      window.removeEventListener("hashchange", syncExpandedModalFromHash);
    };
  }, [syncExpandedModalFromHash]);

  // ---- Education CRUD ----

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
    pendingLinkCertId?: string
  ) {
    if (!userId) throw new Error("No active session.");

    // Fetch fresh state to prevent race conditions where UI state hasn't updated yet after linking/uploading
    const freshEdus = await fetchEducations(userId);
    const freshEdu = existingEducation ? freshEdus.find(e => e.id === existingEducation.id) : null;
    
    const hasPendingFiles = Boolean(pendingCert || pendingLinkCertId);
    const existingCertIds = freshEdu?.certificate_ids ?? [];
    
    // Enforce rule: cannot be completed without files
    if (draft.is_completed && !hasPendingFiles && existingCertIds.length === 0) {
      draft.is_completed = false;
    }

    const nowIso = new Date().toISOString();
    const completedAt = draft.is_completed
      ? freshEdu?.completed_at ?? nowIso
      : null;

    const payload = {
      ...draft,
      completed_at: completedAt,
      certificate_ids: existingCertIds,
      updated_at: nowIso,
    };

    let savedEdu: Education;
    if (existingEducation) {
      savedEdu = await updateEducation(userId, existingEducation.id, payload);
    } else {
      savedEdu = await createEducation(userId, payload);
    }

    let needsUpdate = false;
    const newCertIds = [...payload.certificate_ids];

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
      const pcert = certificates.find(c => c.id === pendingLinkCertId);
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
      // Clean up all linked certificates and their storage files
      const linkedCerts = certificates.filter((c) => c.education_id === educationId);
      for (const cert of linkedCerts) {
        if (cert.file_name) {
          try {
            await deleteCertificateFile(cert.file_name);
          } catch {
            // Best-effort storage cleanup — don't block deletion
          }
        }
        await deleteCertificate(cert.id);
      }
    }

    await deleteEducation(educationId);
    await refreshData(userId);
  }

  function handleQuickComplete(education: Education) {
    // Open the edit modal with 'is_completed' toggled on
    setEduModalTarget({ ...education, is_completed: true });
  }

  // ---- Certificate handlers (from EducationModal side panel) ----

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

  async function handleRenameCertificate(certificateId: string, newLabel: string) {
    if (!userId) throw new Error("No active session.");
    const cert = certificates.find((c) => c.id === certificateId);
    if (!cert) return;
    
    await updateCertificate(userId, certificateId, {
      ...cert,
      label: newLabel,
      updated_at: new Date().toISOString(),
    } as CertificatePlaintext);
    
    await refreshData(userId);
  }

  async function handleDownloadCertificate(certificate: Certificate) {
    if (!userId) throw new Error("No active session.");
    const blob = await downloadCertificateFile(
      userId,
      certificate.file_name,
      certificate.file_iv,
      certificate.file_mime
    );
    // Trigger browser download
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
      // Unlink from education before deleting
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

    // Delete storage file
    if (certificate.file_name) {
      try { await deleteCertificateFile(certificate.file_name); } catch {}
    }

    // Delete DB row
    await deleteCertificate(certificate.id);
    await refreshData(userId);
  }

  // ---- Standalone Certificate CRUD (from CertificateModal) ----
  // Removed.

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-start gap-4">
        <Link
          href={ROUTES.DASHBOARD}
          className="shrink-0 rounded-lg border border-zinc-300 px-2.5 py-1 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          ← Back
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Education
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Track courses, certifications, and uploaded certificates.
          </p>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <ActiveEducationsBox
          educations={activeEducations}
          isLoading={isLoading}
          view={activeView}
          nowYear={nowYear}
          nowMonth={nowMonth}
          onViewChange={setActiveView}
          onAdd={() => setEduModalTarget("create")}
          onSelectEducation={(edu) => setEduModalTarget(edu)}
          onMarkComplete={handleQuickComplete}
        />

        <div className="flex flex-col gap-4">
          <Link
            href="/education/store"
            className="flex items-center justify-center gap-2 w-full rounded-xl border border-zinc-200 bg-white p-4 shadow-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800/80 transition-colors"
          >
            <FolderIcon className="h-5 w-5 text-amber-500" />
            Certificate Store
          </Link>

          <CompletedEducationsBox
            educations={completedEducations}
            certificates={certificates}
            isLoading={isLoading}
            onOpenExpanded={() => openExpandedModal("completed")}
            onSelectEducation={(edu) => setEduModalTarget(edu)}
          />
        </div>
      </section>

      {error && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <span>{error}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => userId && refreshData(userId)}
            className="border border-red-300 hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-900/40"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Expanded modals (hash-driven) */}
      {expandedModal === "completed" && (
        <CompletedEducationsModal
          educations={completedEducations}
          certificates={certificates}
          onClose={closeExpandedModal}
          onSelectEducation={(edu) => {
            closeExpandedModal();
            setEduModalTarget(edu);
          }}
        />
      )}

      {/* Expanded modals (hash-driven) */}

      {/* CRUD modals (state-driven) */}
      {eduModalTarget && (
        <EducationModal
          education={eduModalTarget === "create" ? null : eduModalTarget}
          certificates={certificates}
          userId={userId || ""}
          onClose={() => setEduModalTarget(null)}
          onSave={handleEducationSave}
          onDelete={handleEducationDelete}
          onUploadCertificate={handleUploadCertificateForEducation}
          onRenameCertificate={handleRenameCertificate}
          onDownloadCertificate={handleDownloadCertificate}
          onDeleteCertificate={handleDeleteCertificateFromEducation}
          onLinkCertificate={handleLinkCertificate}
          onUnlinkCertificate={handleUnlinkCertificate}
        />
      )}

      {/* CRUD modals (state-driven) */}
    </div>
  );
}
