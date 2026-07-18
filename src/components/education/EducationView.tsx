"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/routes/paths";
import BackButton from "@/components/common/BackButton";
import Link from "next/link";
import { useAuthBootstrap } from "@/lib/useAuthBootstrap";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { useQueryModal } from "@/lib/useQueryModal";
import {
  createEducation,
  deleteEducation,
  fetchEducations,
  updateEducation,
} from "@/api/education";
import {
  fetchDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
} from "@/api/common/documents";
import {
  uploadDocumentFile,
  downloadDocumentFile,
  deleteDocumentFile,
} from "@/api/common/documentStorage";
import ErrorBanner from "@/components/common/ErrorBanner";
import type { Document, DocumentPlaintext } from "@/types/document";
import type { Education, EducationPlaintext, EducationViewMode } from "@/types/education";
import type { Priority } from "@/types/taskmanager";
import ActiveEducationsBox from "./ActiveEducationsBox";
import CompletedEducationsBox from "./CompletedEducationsBox";
import EducationModal from "./EducationModal";
import { FolderIcon } from "@/components/common/Icons";

/**
 * Education feature shell.
 * Query-param-driven modals (?modal=new-education, ?modal=edit-education-<id>).
 * Uses the global Document store for file attachments instead of the old certificates table.
 */
export default function EducationView() {
  const router = useRouter();
  const [educations, setEducations] = useState<Education[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);

  const loadAllData = useCallback(async (uid: string) => {
    const [eduRows, docRows] = await Promise.all([
      fetchEducations(uid),
      fetchDocuments(uid),
    ]);
    setEducations(eduRows);
    setDocuments(docRows);
  }, []);

  const { userId, nowYear, nowMonth, isLoading, error, refreshData } =
    useAuthBootstrap({ loadData: loadAllData, fetchServerDate: false });

  const [activeView, setActiveView] = useLocalStorage<EducationViewMode>("educationActiveView", "months");

  // Query-param-driven modal state via shared hook
  const { modalTarget, openCreate, openEdit, closeModal } = useQueryModal(educations, "education");

  // State bridge for quick-complete (overrides URL-derived target with a modified copy)
  const [quickCompleteTarget, setQuickCompleteTarget] = useState<Education | null>(null);

  const eduModalTarget = quickCompleteTarget ?? modalTarget;
  const openNewEducation = openCreate;
  const openEditEducation = openEdit;

  const closeEduModal = useCallback(() => {
    closeModal();
    setQuickCompleteTarget(null);
  }, [closeModal]);

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
    pendingDoc?: { file: File; label: string },
    pendingLinkDocId?: string,
    pendingUnlinkDocIds?: string[],
    pendingDeleteDocIds?: string[],
  ) {
    if (!userId) throw new Error("No active session.");

    const freshEdus = await fetchEducations(userId);
    const freshDocs = await fetchDocuments(userId);
    const freshEdu = existingEducation ? freshEdus.find(e => e.id === existingEducation.id) : null;

    let currentDocIds = [...(freshEdu?.document_ids ?? [])];

    const nowIso = new Date().toISOString();
    const completedAt = draft.is_completed
      ? freshEdu?.completed_at ?? nowIso
      : null;

    // --- 1. Process unlinks ---
    if (pendingUnlinkDocIds && pendingUnlinkDocIds.length > 0 && existingEducation) {
      for (const docId of pendingUnlinkDocIds) {
        const doc = freshDocs.find(d => d.id === docId);
        if (doc) {
          await updateDocument(userId, docId, {
            ...doc,
            linked_id: "",
            updated_at: nowIso,
          } as DocumentPlaintext);
        }
        currentDocIds = currentDocIds.filter(id => id !== docId);
      }
    }

    // --- 2. Process deletions ---
    if (pendingDeleteDocIds && pendingDeleteDocIds.length > 0) {
      for (const docId of pendingDeleteDocIds) {
        const doc = freshDocs.find(d => d.id === docId);
        if (doc) {
          currentDocIds = currentDocIds.filter(id => id !== docId);
          if (doc.file_name) {
            try { await deleteDocumentFile(userId, doc.file_name); } catch { /* best-effort */ }
          }
          await deleteDocument(docId);
        }
      }
    }

    // --- 3. Save or create the education ---
    const payload = {
      ...draft,
      completed_at: completedAt,
      document_ids: currentDocIds,
      updated_at: nowIso,
    };

    let savedEdu: Education;
    if (existingEducation) {
      savedEdu = await updateEducation(userId, existingEducation.id, payload);
    } else {
      savedEdu = await createEducation(userId, payload);
    }

    let needsUpdate = false;
    const newDocIds = [...currentDocIds];

    // --- 4. Upload new document file ---
    if (pendingDoc) {
      const { fileName, iv, mimeType } = await uploadDocumentFile(userId, pendingDoc.file);
      const doc = await createDocument(userId, {
        label: pendingDoc.label,
        file_name: fileName,
        file_iv: iv,
        file_mime: mimeType,
        domain: "education",
        linked_id: savedEdu.id,
        updated_at: nowIso,
      });
      newDocIds.push(doc.id);
      needsUpdate = true;
    }

    // --- 5. Link an existing unlinked document ---
    if (pendingLinkDocId) {
      const pdoc = freshDocs.find(d => d.id === pendingLinkDocId);
      if (pdoc) {
        await updateDocument(userId, pendingLinkDocId, {
          ...pdoc,
          linked_id: savedEdu.id,
          updated_at: nowIso,
        } as DocumentPlaintext);
        if (!newDocIds.includes(pendingLinkDocId)) {
          newDocIds.push(pendingLinkDocId);
        }
        needsUpdate = true;
      }
    }

    // --- 6. Update education with final doc IDs if anything changed ---
    if (needsUpdate) {
      await updateEducation(userId, savedEdu.id, {
        ...payload,
        document_ids: newDocIds,
        updated_at: new Date().toISOString(),
      });
    }

    await refreshData(userId);
  }

  async function handleEducationDelete(educationId: string, cascadeMode: 'unlink' | 'cascade') {
    if (!userId) throw new Error("No active session.");

    const eduDocs = documents.filter(
      (d) => d.domain === "education" && d.linked_id === educationId
    );

    if (cascadeMode === 'unlink') {
      const nowIso = new Date().toISOString();
      for (const doc of eduDocs) {
        await updateDocument(userId, doc.id, {
          ...doc,
          linked_id: "",
          updated_at: nowIso,
        } as DocumentPlaintext);
      }
    } else {
      for (const doc of eduDocs) {
        if (doc.file_name) {
          try { await deleteDocumentFile(userId, doc.file_name); } catch { /* best-effort */ }
        }
        await deleteDocument(doc.id);
      }
    }

    await deleteEducation(educationId);
    await refreshData(userId);
  }

  function handleQuickComplete(education: Education) {
    setQuickCompleteTarget({ ...education, is_completed: true });
  }

  // ---- Document handlers (from EducationModal side panel) ----

  async function handleLinkDocument(educationId: string, documentId: string) {
    if (!userId) throw new Error("No active session.");
    const doc = documents.find((d) => d.id === documentId);
    if (!doc) return;
    const nowIso = new Date().toISOString();

    await updateDocument(userId, documentId, {
      ...doc,
      linked_id: educationId,
      updated_at: nowIso,
    } as DocumentPlaintext);

    const edu = educations.find(e => e.id === educationId);
    if (edu && !edu.document_ids.includes(documentId)) {
      await updateEducation(userId, educationId, {
        ...edu,
        document_ids: [...edu.document_ids, documentId],
        updated_at: nowIso
      } as EducationPlaintext);
    }
    await refreshData(userId);
  }

  async function handleUnlinkDocument(educationId: string, documentId: string) {
    if (!userId) throw new Error("No active session.");
    const doc = documents.find((d) => d.id === documentId);
    if (!doc) return;
    const nowIso = new Date().toISOString();

    await updateDocument(userId, documentId, {
      ...doc,
      linked_id: "",
      updated_at: nowIso,
    } as DocumentPlaintext);

    const edu = educations.find(e => e.id === educationId);
    if (edu) {
      const newDocIds = edu.document_ids.filter(id => id !== documentId);
      await updateEducation(userId, educationId, {
        ...edu,
        document_ids: newDocIds,
        updated_at: nowIso
      } as EducationPlaintext);
    }
    await refreshData(userId);
  }

  async function handleUploadDocumentForEducation(
    educationId: string,
    file: File,
    label: string
  ) {
    if (!userId) throw new Error("No active session.");
    const nowIso = new Date().toISOString();

    const { fileName, iv, mimeType } = await uploadDocumentFile(userId, file);
    const doc = await createDocument(userId, {
      label,
      file_name: fileName,
      file_iv: iv,
      file_mime: mimeType,
      domain: "education",
      linked_id: educationId,
      updated_at: nowIso,
    });

    const edu = educations.find(e => e.id === educationId);
    if (edu) {
      await updateEducation(userId, edu.id, {
        ...edu,
        document_ids: [...edu.document_ids, doc.id],
        updated_at: nowIso,
      } as EducationPlaintext);
    }

    await refreshData(userId);
    return doc;
  }

  async function handleDownloadDocument(doc: Document) {
    if (!userId) throw new Error("No active session.");
    const blob = await downloadDocumentFile(
      userId,
      doc.file_name,
      doc.file_iv,
      doc.file_mime
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.label || "document";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleDeleteDocumentFromEducation(doc: Document, cascadeMode: 'unlink' | 'cascade') {
    if (!userId) throw new Error("No active session.");

    if (cascadeMode === 'cascade' && doc.linked_id) {
       await deleteEducation(doc.linked_id);
    } else if (cascadeMode === 'unlink' && doc.linked_id) {
      const edu = educations.find((e) => e.id === doc.linked_id);
      if (edu) {
        const nowIso = new Date().toISOString();
        const newDocIds = edu.document_ids.filter((id) => id !== doc.id);
        await updateEducation(userId, edu.id, {
          ...edu,
          document_ids: newDocIds,
          updated_at: nowIso,
        } as EducationPlaintext);
      }
    }

    if (doc.file_name) {
      try { await deleteDocumentFile(userId, doc.file_name); } catch {}
    }

    await deleteDocument(doc.id);
    await refreshData(userId);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-start gap-4">
        <BackButton href={ROUTES.DASHBOARD} />
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Education
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Track courses, certifications, and uploaded documents.
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
          onAdd={openNewEducation}
          onSelectEducation={openEditEducation}
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
            documents={documents}
            isLoading={isLoading}
            onOpenExpanded={() => router.push(ROUTES.EDUCATION_COMPLETED)}
            onSelectEducation={openEditEducation}
          />
        </div>
      </section>

      {error && (
        <ErrorBanner
          message={error}
          onRetry={() => userId && refreshData(userId)}
        />
      )}

      {eduModalTarget && (
        <EducationModal
          education={eduModalTarget === "create" ? null : eduModalTarget}
          documents={documents}
          userId={userId || ""}
          onClose={closeEduModal}
          onSave={handleEducationSave}
          onDelete={handleEducationDelete}
          onUploadDocument={handleUploadDocumentForEducation}
          onDownloadDocument={handleDownloadDocument}
          onDeleteDocument={handleDeleteDocumentFromEducation}
          onLinkDocument={handleLinkDocument}
          onUnlinkDocument={handleUnlinkDocument}
        />
      )}
    </div>
  );
}
