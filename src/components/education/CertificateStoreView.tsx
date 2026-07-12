"use client";

import { useCallback, useEffect, useState } from "react";
import { ROUTES } from "@/routes/paths";
import BackButton from "@/components/common/BackButton";
import { getSession } from "@/api/auth";
import {
  fetchCertificates,
  fetchEducations,
  downloadCertificateFile,
  deleteCertificateFile,
  deleteCertificate,
  updateEducation,
  updateCertificate,
  uploadCertificateFile,
  createCertificate,
  deleteEducation,
  createEducation,
} from "@/api/education";
import type {
  Certificate,
  CertificatePlaintext,
  Education,
  EducationPlaintext,
} from "@/types/education";
import type { Priority } from "@/types/taskmanager";
import TileView, { DocumentTile } from "@/components/common/TileView";
import BoxContainer from "@/components/common/BoxContainer";
import EducationModal from "./EducationModal";
import StoreCertificateModal from "./StoreCertificateModal";
import type { StoreCertificateSaveParams } from "./StoreCertificateModal";

export default function CertificateStoreView() {
  const [userId, setUserId] = useState<string | null>(null);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [educations, setEducations] = useState<Education[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Hash-driven modal state
  const [modals, setModals] = useState<{
    add: boolean;
    edit: Certificate | null;
    linkedEducation: Education | null;
  }>(() => {
    if (typeof window === "undefined")
      return { add: false, edit: null, linkedEducation: null };
    const raw = window.location.hash.replace("#", "");
    if (raw === "new-certificate")
      return { add: true, edit: null, linkedEducation: null };
    if (raw.startsWith("edit-certificate-"))
      return { add: false, edit: null, linkedEducation: null };
    return { add: false, edit: null, linkedEducation: null };
  });

  const editingCertificate = modals.edit;
  const isAddingCertificate = modals.add;
  const linkedEducation = modals.linkedEducation;

  // --- Hash parsing ---
  const resolveHash = useCallback(
    (raw: string) => {
      if (raw === "new-certificate")
        return { add: true, edit: null as Certificate | null };
      if (raw.startsWith("edit-certificate-")) {
        const certId = raw.slice(18);
        const cert = certificates.find((c) => c.id === certId);
        if (cert) return { add: false, edit: cert };
      }
      return { add: false, edit: null as Certificate | null };
    },
    [certificates]
  );

  useEffect(() => {
    const handler = () => {
      const raw = window.location.hash.replace("#", "");
      const res = resolveHash(raw);
      setModals((prev) => ({ ...prev, add: res.add, edit: res.edit }));
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, [resolveHash]);

  const clearHash = useCallback(() => {
    if (window.location.hash) {
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search
      );
    }
  }, []);

  // --- Data loading ---
  const loadData = useCallback(async () => {
    if (!userId) return;
    try {
      const [certs, edus] = await Promise.all([
        fetchCertificates(userId),
        fetchEducations(userId),
      ]);
      setCertificates(certs);
      setEducations(edus);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load certificates"
      );
    }
  }, [userId]);

  useEffect(() => {
    const init = async () => {
      try {
        const session = await getSession();
        if (!session) {
          window.location.href = "/auth/login";
          return;
        }
        setUserId(session.user.id);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to authenticate"
        );
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (userId) {
      loadData();
    }
  }, [userId, loadData]);

  // --- Download handler ---

  const handleDownload = async (certId: string) => {
    if (!userId) return;
    const cert = certificates.find((c) => c.id === certId);
    if (!cert) return;
    try {
      const blob = await downloadCertificateFile(
        userId,
        cert.file_name,
        cert.file_iv,
        cert.file_mime
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = cert.label || "certificate";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(
        "Failed to download: " +
          (err instanceof Error ? err.message : "Unknown error")
      );
    }
  };

  // --- Action click (TileView) ---

  const handleActionClick = (certId: string) => {
    const cert = certificates.find((c) => c.id === certId);
    if (!cert) return;

    // Linked file → open standard EducationModal on store page (bug fix)
    if (cert.education_id) {
      const edu = educations.find((e) => e.id === cert.education_id);
      if (edu) {
        setModals((prev) => ({ ...prev, linkedEducation: edu }));
        return;
      }
    }

    // Unlinked standalone file → open StoreCertificateModal directly
    setModals((prev) => ({ ...prev, edit: cert }));
  };

  // ============================================================
  // Store Certificate Modal handlers
  // ============================================================

  const handleStoreSave = async (params: StoreCertificateSaveParams) => {
    if (!userId) throw new Error("No active session.");
    const nowIso = new Date().toISOString();
    let resolvedEducationId = params.linkedEducationId || "";

    // If creating a new education inline, do that first
    if (!params.linkedEducationId && params.newEducation?.name) {
      const newEdu = await createEducation(userId, {
        name: params.newEducation.name,
        provider: params.newEducation.provider,
        priority: params.newEducation.priority,
        due_date: params.newEducation.due_date,
        description: params.newEducation.description,
        is_completed: true,
        completed_at: nowIso,
        certificate_ids: [],
        updated_at: nowIso,
      });
      resolvedEducationId = newEdu.id;
    }

    if (params.existingCertificate) {
      // Editing existing certificate
      const existingCert = params.existingCertificate;
      if (params.file) {
        // New file uploaded — upload and update cert
        const { fileName, iv, mimeType } = await uploadCertificateFile(
          userId,
          params.file
        );
        await updateCertificate(userId, existingCert.id, {
          ...existingCert,
          label: params.label,
          file_name: fileName,
          file_iv: iv,
          file_mime: mimeType,
          education_id: resolvedEducationId,
          updated_at: nowIso,
        } as CertificatePlaintext);
      } else {
        // No new file — just update metadata and linkage
        await updateCertificate(userId, existingCert.id, {
          ...existingCert,
          label: params.label,
          education_id: resolvedEducationId,
          updated_at: nowIso,
        } as CertificatePlaintext);
      }

      // Update education's certificate_ids if linked
      if (resolvedEducationId) {
        const freshCerts = await fetchCertificates(userId);
        const freshEdus = await fetchEducations(userId);
        const edu = freshEdus.find((e) => e.id === resolvedEducationId);
        if (edu) {
          const linkedToEdu = freshCerts.filter(
            (c) => c.education_id === resolvedEducationId
          );
          await updateEducation(userId, edu.id, {
            ...edu,
            certificate_ids: linkedToEdu.map((c) => c.id),
            updated_at: nowIso,
          } as EducationPlaintext);
        }
      }
    } else {
      // Creating new certificate
      if (!params.file) throw new Error("File is required for new certificates.");
      const { fileName, iv, mimeType } = await uploadCertificateFile(
        userId,
        params.file
      );
      await createCertificate(userId, {
        label: params.label,
        file_name: fileName,
        file_iv: iv,
        file_mime: mimeType,
        education_id: resolvedEducationId,
        updated_at: nowIso,
      });

      // Update education's certificate_ids if linked
      if (resolvedEducationId) {
        const freshCerts = await fetchCertificates(userId);
        const freshEdus = await fetchEducations(userId);
        const edu = freshEdus.find((e) => e.id === resolvedEducationId);
        if (edu) {
          const linkedToEdu = freshCerts.filter(
            (c) => c.education_id === resolvedEducationId
          );
          await updateEducation(userId, edu.id, {
            ...edu,
            certificate_ids: linkedToEdu.map((c) => c.id),
            updated_at: nowIso,
          } as EducationPlaintext);
        }
      }
    }

    await loadData();
    setModals((prev) => ({ ...prev, add: false, edit: null }));
    clearHash();
  };

  const handleStoreDelete = async (
    certificate: Certificate,
    cascadeMode: "unlink" | "cascade"
  ) => {
    if (!userId) return;
    try {
      if (cascadeMode === "cascade" && certificate.education_id) {
        await deleteEducation(certificate.education_id);
      } else if (cascadeMode === "unlink" && certificate.education_id) {
        const edu = educations.find(
          (e) => e.id === certificate.education_id
        );
        if (edu) {
          const newCertIds = edu.certificate_ids.filter(
            (id) => id !== certificate.id
          );
          const isStillCompleted =
            newCertIds.length > 0 ? edu.is_completed : false;
          await updateEducation(userId, edu.id, {
            ...edu,
            certificate_ids: newCertIds,
            is_completed: isStillCompleted,
            completed_at: isStillCompleted ? edu.completed_at : null,
            updated_at: new Date().toISOString(),
          } as EducationPlaintext);
        }
      }
      if (certificate.file_name) {
        try {
          await deleteCertificateFile(userId, certificate.file_name);
        } catch {
          /* best-effort */
        }
      }
      await deleteCertificate(certificate.id);
      await loadData();
    } catch (err) {
      alert(
        "Failed to delete certificate: " +
          (err instanceof Error ? err.message : "Unknown error")
      );
    }
  };

  // ============================================================
  // Education Modal handlers (standard mode, for linked files)
  // ============================================================

  const handleEducationSave = async (
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
    pendingDeleteCertIds?: string[]
  ) => {
    if (!userId) throw new Error("No active session.");

    const freshEdus = await fetchEducations(userId);
    const freshCerts = await fetchCertificates(userId);
    const freshEdu = existingEducation
      ? freshEdus.find((e) => e.id === existingEducation.id)
      : null;

    let currentCertIds = [...(freshEdu?.certificate_ids ?? [])];
    const nowIso = new Date().toISOString();
    const completedAt = draft.is_completed
      ? freshEdu?.completed_at ?? nowIso
      : null;

    // 1. Process unlinks
    if (pendingUnlinkCertIds && pendingUnlinkCertIds.length > 0 && existingEducation) {
      for (const certId of pendingUnlinkCertIds) {
        const cert = freshCerts.find((c) => c.id === certId);
        if (cert) {
          await updateCertificate(userId, certId, {
            ...cert,
            education_id: "",
            updated_at: nowIso,
          } as CertificatePlaintext);
        }
        currentCertIds = currentCertIds.filter((id) => id !== certId);
      }
    }

    // 2. Process deletions
    if (pendingDeleteCertIds && pendingDeleteCertIds.length > 0) {
      for (const certId of pendingDeleteCertIds) {
        const cert = freshCerts.find((c) => c.id === certId);
        if (cert) {
          currentCertIds = currentCertIds.filter((id) => id !== certId);
          if (cert.file_name) {
            try {
              await deleteCertificateFile(userId, cert.file_name);
            } catch {
              /* best-effort */
            }
          }
          await deleteCertificate(certId);
        }
      }
    }

    // 3. Save or create education
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

    // 4. Upload new certificate file
    if (pendingCert) {
      const { fileName, iv, mimeType } = await uploadCertificateFile(
        userId,
        pendingCert.file
      );
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

    // 5. Link an existing certificate
    if (pendingLinkCertId) {
      const pcert = freshCerts.find((c) => c.id === pendingLinkCertId);
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

    // 6. Update education with final cert IDs
    if (needsUpdate) {
      await updateEducation(userId, savedEdu.id, {
        ...payload,
        certificate_ids: newCertIds,
        updated_at: new Date().toISOString(),
      });
    }

    await loadData();
  };

  const handleEducationDelete = async (
    educationId: string,
    cascadeMode: "unlink" | "cascade"
  ) => {
    if (!userId) throw new Error("No active session.");

    if (cascadeMode === "unlink") {
      const linkedCerts = certificates.filter(
        (c) => c.education_id === educationId
      );
      const nowIso = new Date().toISOString();
      for (const cert of linkedCerts) {
        await updateCertificate(userId, cert.id, {
          ...cert,
          education_id: "",
          updated_at: nowIso,
        } as CertificatePlaintext);
      }
    } else {
      const linkedCerts = certificates.filter(
        (c) => c.education_id === educationId
      );
      for (const cert of linkedCerts) {
        if (cert.file_name) {
          try {
            await deleteCertificateFile(userId, cert.file_name);
          } catch {
            /* best-effort */
          }
        }
        await deleteCertificate(cert.id);
      }
    }

    await deleteEducation(educationId);
    await loadData();
  };

  const handleUploadCertificateForEducation = async (
    educationId: string,
    file: File,
    label: string
  ) => {
    if (!userId) throw new Error("No active session.");
    const nowIso = new Date().toISOString();

    const { fileName, iv, mimeType } = await uploadCertificateFile(
      userId,
      file
    );
    const cert = await createCertificate(userId, {
      label,
      file_name: fileName,
      file_iv: iv,
      file_mime: mimeType,
      education_id: educationId,
      updated_at: nowIso,
    });

    const edu = educations.find((e) => e.id === educationId);
    if (edu) {
      await updateEducation(userId, edu.id, {
        ...edu,
        certificate_ids: [...edu.certificate_ids, cert.id],
        updated_at: nowIso,
      } as EducationPlaintext);
    }

    await loadData();
    return cert;
  };

  const handleDownloadCertificate = async (certificate: Certificate) => {
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
  };

  const handleDeleteCertificateFromEducation = async (
    certificate: Certificate,
    cascadeMode: "unlink" | "cascade"
  ) => {
    if (!userId) throw new Error("No active session.");

    if (cascadeMode === "cascade" && certificate.education_id) {
      await deleteEducation(certificate.education_id);
    } else if (cascadeMode === "unlink" && certificate.education_id) {
      const edu = educations.find(
        (e) => e.id === certificate.education_id
      );
      if (edu) {
        const nowIso = new Date().toISOString();
        const newCertIds = edu.certificate_ids.filter(
          (id) => id !== certificate.id
        );
        const isStillCompleted =
          newCertIds.length > 0 ? edu.is_completed : false;
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
      try {
        await deleteCertificateFile(userId, certificate.file_name);
      } catch {
        /* best-effort */
      }
    }

    await deleteCertificate(certificate.id);
    await loadData();
  };

  const handleLinkCertificate = async (
    educationId: string,
    certificateId: string
  ) => {
    if (!userId) throw new Error("No active session.");
    const cert = certificates.find((c) => c.id === certificateId);
    if (!cert) return;
    const nowIso = new Date().toISOString();

    await updateCertificate(userId, certificateId, {
      ...cert,
      education_id: educationId,
      updated_at: nowIso,
    } as CertificatePlaintext);

    const edu = educations.find((e) => e.id === educationId);
    if (edu && !edu.certificate_ids.includes(certificateId)) {
      await updateEducation(userId, educationId, {
        ...edu,
        certificate_ids: [...edu.certificate_ids, certificateId],
        updated_at: nowIso,
      } as EducationPlaintext);
    }
    await loadData();
  };

  const handleUnlinkCertificate = async (
    educationId: string,
    certificateId: string
  ) => {
    if (!userId) throw new Error("No active session.");
    const cert = certificates.find((c) => c.id === certificateId);
    if (!cert) return;
    const nowIso = new Date().toISOString();

    await updateCertificate(userId, certificateId, {
      ...cert,
      education_id: "",
      updated_at: nowIso,
    } as CertificatePlaintext);

    const edu = educations.find((e) => e.id === educationId);
    if (edu) {
      const newCertIds = edu.certificate_ids.filter(
        (id) => id !== certificateId
      );
      const isStillCompleted =
        newCertIds.length > 0 ? edu.is_completed : false;
      await updateEducation(userId, educationId, {
        ...edu,
        certificate_ids: newCertIds,
        is_completed: isStillCompleted,
        completed_at: isStillCompleted ? edu.completed_at : null,
        updated_at: nowIso,
      } as EducationPlaintext);
    }
    await loadData();
  };

  // ============================================================
  // Delete handler for TileView
  // ============================================================

  const handleDeleteConfirmed = async (
    idToRemove: string,
    cascadeMode: "unlink" | "cascade" = "unlink"
  ) => {
    if (!userId) return;
    try {
      const cert = certificates.find((c) => c.id === idToRemove);
      if (!cert) return;
      await handleStoreDelete(cert, cascadeMode);
    } catch (err) {
      alert(
        "Failed to delete certificate: " +
          (err instanceof Error ? err.message : "Unknown error")
      );
    }
  };

  // ============================================================
  // Unlink handler for TileView
  // ============================================================

  const handleUnlinkConfirmed = async (certId: string) => {
    if (!userId) return;
    try {
      const cert = certificates.find((c) => c.id === certId);
      if (!cert || !cert.education_id) return;

      const nowIso = new Date().toISOString();

      // Unlink cert from education
      await updateCertificate(userId, certId, {
        ...cert,
        education_id: "",
        updated_at: nowIso,
      } as CertificatePlaintext);

      // Update education's certificate_ids
      const edu = educations.find((e) => e.id === cert.education_id);
      if (edu) {
        const newCertIds = edu.certificate_ids.filter((id) => id !== certId);
        const isStillCompleted = newCertIds.length > 0 ? edu.is_completed : false;
        await updateEducation(userId, edu.id, {
          ...edu,
          certificate_ids: newCertIds,
          is_completed: isStillCompleted,
          completed_at: isStillCompleted ? edu.completed_at : null,
          updated_at: nowIso,
        } as EducationPlaintext);
      }

      await loadData();
    } catch (err) {
      alert(
        "Failed to unlink certificate: " +
          (err instanceof Error ? err.message : "Unknown error")
      );
    }
  };

  // ============================================================
  // Build document tiles
  // ============================================================

  const documentTiles: DocumentTile[] = certificates.map((cert) => {
    const edu = educations.find((e) => e.id === cert.education_id);
    return {
      id: cert.id,
      fileName: cert.label || "Unnamed Certificate",
      fileUrl: "",
      linkedItemName: edu ? edu.name : null,
      thumbnailUrl: null,
      mime: cert.file_mime || undefined,
    };
  });

  // ============================================================
  // Close handlers
  // ============================================================

  const closeStoreAddModal = () => {
    setModals((prev) => ({ ...prev, add: false }));
    clearHash();
  };

  const closeStoreEditModal = () => {
    setModals((prev) => ({ ...prev, edit: null }));
    clearHash();
  };

  const closeLinkedEducationModal = () => {
    setModals((prev) => ({ ...prev, linkedEducation: null }));
    loadData();
  };

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start gap-4">
        <BackButton href={ROUTES.EDUCATION}>
          ← Back to Education
        </BackButton>
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Certificate Store
          </h1>
          <p className="mt-1 text-sm font-normal text-zinc-500 dark:text-zinc-400">
            View all uploaded certificates across all your educations.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      <BoxContainer>
        <TileView
          documents={documentTiles}
          isLoading={isLoading}
          onDownload={handleDownload}
          onDeleteConfirmed={handleDeleteConfirmed}
          onUnlinkConfirmed={handleUnlinkConfirmed}
          onActionClick={handleActionClick}
          onAdd={() => {
            setModals((prev) => ({ ...prev, add: true }));
          }}
          title=""
        />
      </BoxContainer>

      {/* Store Certificate Modal — Add mode */}
      {isAddingCertificate && userId && (
        <StoreCertificateModal
          certificate={null}
          allEducations={educations}
          existingLabels={certificates.map(c => c.label).filter((l): l is string => !!l)}
          userId={userId}
          onClose={closeStoreAddModal}
          onSave={handleStoreSave}
          onDelete={handleStoreDelete}
        />
      )}

      {/* Store Certificate Modal — Edit mode (unlinked cert) */}
      {editingCertificate && userId && (
        <StoreCertificateModal
          certificate={editingCertificate}
          allEducations={educations}
          existingLabels={certificates.map(c => c.label).filter((l): l is string => !!l)}
          userId={userId}
          onClose={closeStoreEditModal}
          onSave={handleStoreSave}
          onDelete={handleStoreDelete}
        />
      )}

      {/* Education Modal — Linked file (standard mode, stays on store page) */}
      {linkedEducation && userId && (
        <EducationModal
          education={linkedEducation}
          certificates={certificates}
          allEducations={educations}
          userId={userId}
          onClose={closeLinkedEducationModal}
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
