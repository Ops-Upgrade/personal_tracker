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
import type { Certificate, Education, EducationViewMode } from "@/types/education";
import type { Priority } from "@/types/taskmanager";
import ActiveEducationsBox from "./ActiveEducationsBox";
import CompletedEducationsBox from "./CompletedEducationsBox";
import CertificateStoreBox from "./CertificateStoreBox";
import CompletedEducationsModal from "./CompletedEducationsModal";
import CertificateStoreModal from "./CertificateStoreModal";
import EducationModal from "./EducationModal";
import CertificateModal from "./CertificateModal";

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

  const [expandedModal, setExpandedModal] = useState<"completed" | "certificates" | null>(null);
  const [eduModalTarget, setEduModalTarget] = useState<Education | "create" | null>(null);
  const [certModalTarget, setCertModalTarget] = useState<Certificate | "create" | null>(null);
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
    if (rawHash === "completed" || rawHash === "certificates") {
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

  const openExpandedModal = useCallback((kind: "completed" | "certificates") => {
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
    existingEducation: Education | null
  ) {
    if (!userId) throw new Error("No active session.");
    const nowIso = new Date().toISOString();
    const completedAt = draft.is_completed
      ? existingEducation?.completed_at ?? nowIso
      : null;

    const payload = {
      ...draft,
      completed_at: completedAt,
      certificate_ids: existingEducation?.certificate_ids ?? [],
      updated_at: nowIso,
    };

    if (existingEducation) {
      await updateEducation(userId, existingEducation.id, payload);
    } else {
      await createEducation(userId, payload);
    }

    await refreshData(userId);
  }

  async function handleEducationDelete(educationId: string) {
    if (!userId) throw new Error("No active session.");

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

    await deleteEducation(educationId);
    await refreshData(userId);
  }

  function handleQuickComplete(education: Education) {
    // Open the edit modal with 'is_completed' toggled on
    setEduModalTarget({ ...education, is_completed: true });
  }

  async function handleQuickReopen(education: Education) {
    if (!userId) throw new Error("No active session.");
    const nowIso = new Date().toISOString();
    await updateEducation(userId, education.id, {
      ...education,
      is_completed: false,
      completed_at: null,
      updated_at: nowIso,
    });
    await refreshData(userId);
  }

  // ---- Certificate handlers (from EducationModal side panel) ----

  async function handleUploadCertificateForEducation(
    educationId: string,
    file: File,
    label: string
  ) {
    if (!userId) throw new Error("No active session.");

    // Upload file to storage
    const { fileName, iv, mimeType } = await uploadCertificateFile(userId, file);

    // Create certificate DB row
    const nowIso = new Date().toISOString();
    const cert = await createCertificate(userId, {
      label,
      file_name: fileName,
      file_iv: iv,
      file_mime: mimeType,
      education_id: educationId,
      updated_at: nowIso,
    });

    // Link certificate to education
    const edu = educations.find((e) => e.id === educationId);
    if (edu) {
      await updateEducation(userId, educationId, {
        ...edu,
        certificate_ids: [...edu.certificate_ids, cert.id],
        updated_at: nowIso,
      });
    }

    await refreshData(userId);
  }

  async function handleRenameCertificate(certificateId: string, newLabel: string) {
    if (!userId) throw new Error("No active session.");
    const cert = certificates.find((c) => c.id === certificateId);
    if (!cert) return;
    
    await updateCertificate(userId, certificateId, {
      ...cert,
      label: newLabel,
      updated_at: new Date().toISOString(),
    });
    
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

  async function handleDeleteCertificateFromEducation(certificate: Certificate) {
    if (!userId) throw new Error("No active session.");

    // Delete storage file
    if (certificate.file_name) {
      await deleteCertificateFile(certificate.file_name);
    }

    // Unlink from education
    if (certificate.education_id) {
      const edu = educations.find((e) => e.id === certificate.education_id);
      if (edu) {
        const nowIso = new Date().toISOString();
        await updateEducation(userId, edu.id, {
          ...edu,
          certificate_ids: edu.certificate_ids.filter((id) => id !== certificate.id),
          updated_at: nowIso,
        });
      }
    }

    // Delete DB row
    await deleteCertificate(certificate.id);
    await refreshData(userId);
  }

  // ---- Standalone Certificate CRUD (from CertificateModal) ----

  async function handleCertificateSave(
    label: string,
    educationId: string,
    file: File | null,
    existingCertificate: Certificate | null
  ) {
    if (!userId) throw new Error("No active session.");
    const nowIso = new Date().toISOString();

    if (existingCertificate) {
      // Update metadata only (file cannot be replaced)
      await updateCertificate(userId, existingCertificate.id, {
        ...existingCertificate,
        label,
        education_id: educationId,
        updated_at: nowIso,
      });

      // Update education linkage if changed
      const oldEduId = existingCertificate.education_id;
      if (oldEduId !== educationId) {
        // Remove from old education
        if (oldEduId) {
          const oldEdu = educations.find((e) => e.id === oldEduId);
          if (oldEdu) {
            await updateEducation(userId, oldEdu.id, {
              ...oldEdu,
              certificate_ids: oldEdu.certificate_ids.filter((id) => id !== existingCertificate.id),
              updated_at: nowIso,
            });
          }
        }
        // Add to new education
        if (educationId) {
          const newEdu = educations.find((e) => e.id === educationId);
          if (newEdu) {
            await updateEducation(userId, newEdu.id, {
              ...newEdu,
              certificate_ids: [...newEdu.certificate_ids, existingCertificate.id],
              updated_at: nowIso,
            });
          }
        }
      }
    } else if (file) {
      // Upload new certificate
      const { fileName, iv, mimeType } = await uploadCertificateFile(userId, file);
      const cert = await createCertificate(userId, {
        label,
        file_name: fileName,
        file_iv: iv,
        file_mime: mimeType,
        education_id: educationId,
        updated_at: nowIso,
      });

      // Link to education if specified
      if (educationId) {
        const edu = educations.find((e) => e.id === educationId);
        if (edu) {
          await updateEducation(userId, edu.id, {
            ...edu,
            certificate_ids: [...edu.certificate_ids, cert.id],
            updated_at: nowIso,
          });
        }
      }
    }

    await refreshData(userId);
  }

  async function handleCertificateDelete(certificate: Certificate) {
    await handleDeleteCertificateFromEducation(certificate);
  }

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

        <div className="grid gap-4 lg:grid-rows-2">
          <CompletedEducationsBox
            educations={completedEducations}
            certificates={certificates}
            isLoading={isLoading}
            onOpenExpanded={() => openExpandedModal("completed")}
            onSelectEducation={(edu) => setEduModalTarget(edu)}
            onReopenEducation={handleQuickReopen}
          />

          <CertificateStoreBox
            certificates={certificates}
            educations={educations}
            isLoading={isLoading}
            onAdd={() => setCertModalTarget("create")}
            onOpenExpanded={() => openExpandedModal("certificates")}
            onSelectCertificate={(cert) => setCertModalTarget(cert)}
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
          onReopenEducation={handleQuickReopen}
        />
      )}

      {expandedModal === "certificates" && (
        <CertificateStoreModal
          certificates={certificates}
          educations={educations}
          userId={userId || ""}
          onClose={closeExpandedModal}
          onSelectCertificate={(cert) => {
            closeExpandedModal();
            setCertModalTarget(cert);
          }}
        />
      )}

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
        />
      )}

      {certModalTarget && (
        <CertificateModal
          certificate={certModalTarget === "create" ? null : certModalTarget}
          completedEducations={completedEducations}
          onClose={() => setCertModalTarget(null)}
          onSave={handleCertificateSave}
          onDelete={handleCertificateDelete}
          onDownload={handleDownloadCertificate}
        />
      )}
    </div>
  );
}
