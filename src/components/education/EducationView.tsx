"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/routes/paths";
import BackButton from "@/components/common/BackButton";
import Link from "next/link";
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
import ErrorBanner from "@/components/common/ErrorBanner";
import type { Certificate, CertificatePlaintext, Education, EducationPlaintext, EducationViewMode } from "@/types/education";
import type { Priority } from "@/types/taskmanager";
import ActiveEducationsBox from "./ActiveEducationsBox";
import CompletedEducationsBox from "./CompletedEducationsBox";
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
 * "View All" navigates to dedicated /education/completed route.
 */
export default function EducationView() {
  const router = useRouter();
  const [educations, setEducations] = useState<Education[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);

  const loadAllData = useCallback(async (uid: string) => {
    const [eduRows, certRows] = await Promise.all([
      fetchEducations(uid),
      fetchCertificates(uid),
    ]);
    setEducations(eduRows);
    setCertificates(certRows);
  }, []);

  const { userId, nowYear, nowMonth, isLoading, error, refreshData } =
    useAuthBootstrap({ loadData: loadAllData, fetchServerDate: false });

  // Hash-driven: #new-education, #edit-<eduId>
  const [eduModalTarget, setEduModalTarget] = useState<Education | "create" | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = window.location.hash.replace("#", "");
    if (raw === "new-education") return "create";
    // For edit-education-<id>, we need educations loaded — handled in useEffect below
    return null;
  });
  const [activeView, setActiveView] = useState<EducationViewMode>("months");

  const clearHash = useCallback(() => {
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  // Hash change handler (returns derived state, doesn't call setState)
  const resolveHashState = useCallback((raw: string, currentEdus: Education[]) => {
    if (!raw) return null;
    if (raw === "new-education") return "create" as const;
    if (raw.startsWith("edit-education-")) {
      const eduId = raw.slice(15);
      const edu = currentEdus.find(e => e.id === eduId);
      if (edu) return edu;
    }
    return null;
  }, []);

  // Sync initial hash when educations load (e.g. navigating from CertificateStoreView)
  useEffect(() => {
    if (educations.length === 0) return;
    const raw = window.location.hash.replace("#", "");
    if (raw.startsWith("edit-education-")) {
      const eduId = raw.slice(15);
      const edu = educations.find(e => e.id === eduId);
      if (edu) setEduModalTarget(edu);
    }
    if (raw === "new-education" && eduModalTarget !== "create") {
      setEduModalTarget("create");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [educations]);

  useEffect(() => {
    const handler = () => {
      const raw = window.location.hash.replace("#", "");
      const resolved = resolveHashState(raw, educations);
      if (resolved) {
        setEduModalTarget(resolved);
      }
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, [educations, resolveHashState]);

  const closeEduModal = useCallback(() => {
    setEduModalTarget(null);
    clearHash();
  }, [clearHash]);

  const activeEducations = useMemo(
    () => educations.filter((e) => !e.is_completed),
    [educations]
  );
  const completedEducations = useMemo(
    () => educations.filter((e) => e.is_completed),
    [educations]
  );

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
    pendingLinkCertId?: string,
    pendingUnlinkCertIds?: string[],
    pendingDeleteCertIds?: string[],
  ) {
    if (!userId) throw new Error("No active session.");

    // Fetch fresh state so we operate on committed DB data
    const freshEdus = await fetchEducations(userId);
    const freshCerts = await fetchCertificates(userId);
    const freshEdu = existingEducation ? freshEdus.find(e => e.id === existingEducation.id) : null;

    let currentCertIds = [...(freshEdu?.certificate_ids ?? [])];

    const nowIso = new Date().toISOString();
    const completedAt = draft.is_completed
      ? freshEdu?.completed_at ?? nowIso
      : null;

    // --- 1. Process unlinks (remove cert association, keep cert in DB) ---
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

    // --- 2. Process deletions (remove cert from education, delete storage + DB row) ---
    if (pendingDeleteCertIds && pendingDeleteCertIds.length > 0) {
      for (const certId of pendingDeleteCertIds) {
        const cert = freshCerts.find(c => c.id === certId);
        if (cert) {
          // Unlink from education's cert_ids
          currentCertIds = currentCertIds.filter(id => id !== certId);
          // Delete storage file
          if (cert.file_name) {
            try { await deleteCertificateFile(userId, cert.file_name); } catch { /* best-effort */ }
          }
          // Delete DB row
          await deleteCertificate(certId);
        }
      }
    }

    // --- 3. Save or create the education ---
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

    // --- 4. Upload new certificate file ---
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

    // --- 5. Link an existing unlinked certificate ---
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

    // --- 6. Update education with final cert IDs if anything changed ---
    if (needsUpdate) {
      await updateEducation(userId, savedEdu.id, {
        ...payload,
        certificate_ids: newCertIds,
        updated_at: new Date().toISOString(),
      });
    }

    // Single refreshData call at the end — no mid-save re-renders
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
            await deleteCertificateFile(userId, cert.file_name);
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
      try { await deleteCertificateFile(userId, certificate.file_name); } catch {}
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
        <BackButton href={ROUTES.DASHBOARD}>← Back</BackButton>
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
          onAdd={() => { window.location.hash = "new-education"; }}
          onSelectEducation={(edu) => { window.location.hash = `edit-education-${edu.id}`; }}
          onMarkComplete={handleQuickComplete}
        />

        <div className="flex flex-col gap-4">
          <Link
            href={ROUTES.EDUCATION_STORE}
            className="flex items-center justify-center gap-2 w-full rounded-xl border border-zinc-200 bg-white p-4 shadow-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800/80 transition-colors"
          >
            <FolderIcon className="h-5 w-5 text-amber-500" />
            Certificate Store
          </Link>

          <CompletedEducationsBox
            educations={completedEducations}
            certificates={certificates}
            isLoading={isLoading}
            onOpenExpanded={() => router.push(ROUTES.EDUCATION_COMPLETED)}
            onSelectEducation={(edu) => { window.location.hash = `edit-education-${edu.id}`; }}
          />
        </div>
      </section>

      {error && (
        <ErrorBanner
          message={error}
          onRetry={() => userId && refreshData(userId)}
        />
      )}

      {/* CRUD modal (hash-driven) */}
      {eduModalTarget && (
        <EducationModal
          education={eduModalTarget === "create" ? null : eduModalTarget}
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
    </div>
  );
}
