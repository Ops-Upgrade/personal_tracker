"use client";

import { useCallback, useMemo, useState } from "react";
import { useAuthBootstrap } from "@/lib/useAuthBootstrap";
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
import { ROUTES } from "@/routes/paths";
import type { Document, DocumentPlaintext } from "@/types/document";
import type { Education, EducationPlaintext } from "@/types/education";
import type { Priority } from "@/types/common";
import BoxContainer from "@/components/common/BoxContainer";
import PageShell from "@/components/common/PageShell";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import EducationTable from "@/components/education/EducationTable";
import EducationModal from "@/components/education/EducationModal";

export default function CompletedEducationsPage() {
  const [educations, setEducations] = useState<Education[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);

  const loadData = useCallback(async (uid: string) => {
    const [eduRows, docRows] = await Promise.all([
      fetchEducations(uid),
      fetchDocuments(uid),
    ]);
    setEducations(eduRows);
    setDocuments(docRows);
  }, []);

  const { userId, isLoading, error, refreshData } =
    useAuthBootstrap({ loadData, fetchServerDate: false });

  const [eduModalTarget, setEduModalTarget] = useState<Education | null>(null);

  const completedEducations = useMemo(
    () => educations.filter((e) => e.is_completed),
    [educations]
  );

  const handleEditEducation = (edu: Education) => {
    setEduModalTarget(edu);
  };

  const closeEduModal = () => setEduModalTarget(null);

  // ---- Education CRUD handlers ----

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

  return (
    <>
      <PageShell
        backHref={ROUTES.EDUCATION}
        title="Completed Educations"
        description="All your completed courses and certifications."
        error={error}
        onRetry={() => userId && refreshData(userId)}
      >
      {isLoading && <LoadingSpinner />}

      {!isLoading && (
        <BoxContainer>
          <EducationTable
            educations={completedEducations}
            documents={documents}
            onSelectEducation={handleEditEducation}
          />
        </BoxContainer>
      )}
    </PageShell>

      {eduModalTarget && (
        <EducationModal
          education={eduModalTarget}
          documents={documents}
          userId={userId || ""}
          onClose={closeEduModal}
          onSave={handleEducationSave}
          onDelete={handleEducationDelete}
          onDownloadDocument={handleDownloadDocument}
        />
      )}
    </>
  );
}
