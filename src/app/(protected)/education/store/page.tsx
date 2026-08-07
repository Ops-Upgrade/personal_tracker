"use client";

import { useCallback, useState } from "react";
import { ROUTES } from "@/routes/paths";
import {
  fetchEducations,
  updateEducation,
  deleteEducation,
  createEducation,
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
import { InputField, TextareaField, SelectField } from "@/components/common/FormField";
import type { Education, EducationPlaintext } from "@/types/education";
import type { Document, DocumentPlaintext } from "@/types/document";
import { PRIORITIES, type Priority } from "@/types/common";
import GenericStorePage from "@/components/common/store/GenericStorePage";
import EducationModal from "@/components/education/EducationModal";

/**
 * Education Document Store.
 * Uses GenericStorePage with education records as parent items.
 *
 * Clicking a linked cert opens EducationModal to edit the parent education.
 * Standalone upload offers inline "create new education" form.
 */
export default function EducationStorePage() {
  // --- Inline education creation form state ---
  const [newEduName, setNewEduName] = useState("");
  const [newEduProvider, setNewEduProvider] = useState("");
  const [newEduPriority, setNewEduPriority] = useState<Priority>("medium");
  const [newEduDueDate, setNewEduDueDate] = useState("");
  const [newEduDescription, setNewEduDescription] = useState("");

  // --- fetchData ---
  const fetchData = useCallback(async (userId: string) => {
    const [edus, docs] = await Promise.all([
      fetchEducations(userId),
      fetchDocuments(userId),
    ]);
    return { domainRows: edus, documents: docs };
  }, []);

  // --- deriveParentRecords ---
  const deriveParentRecords = useCallback(
    (rows: Education[]) => rows.map((e) => ({ id: e.id, name: e.name })),
    [],
  );

  // --- onLinkedRecordClick ---
  const onLinkedRecordClick = useCallback(
    (docId: string, allDocuments: Document[], allRows: Education[]) => {
      const doc = allDocuments.find((d) => d.id === docId);
      if (!doc?.linked_id) return null;
      return allRows.find((e) => e.id === doc.linked_id) ?? null;
    },
    [],
  );

  // --- Parent CRUD handlers ---

  const handleDeleteParent = useCallback(
    async (parentId: string, _userId: string, refreshAll: () => Promise<void>) => {
      await deleteEducation(parentId);
      await refreshAll();
    },
    [],
  );

  const handleUnlinkFromParent = useCallback(
    async (
      documentId: string,
      parentId: string,
      userId: string,
      refreshAll: () => Promise<void>,
    ) => {
      const edus = await fetchEducations(userId);
      const edu = edus.find((e) => e.id === parentId);
      if (edu) {
        const newDocIds = edu.document_ids.filter((id) => id !== documentId);
        await updateEducation(userId, parentId, {
          ...edu,
          document_ids: newDocIds,
          updated_at: new Date().toISOString(),
        } as EducationPlaintext);
      }
      await refreshAll();
    },
    [],
  );

  const handleBulkLinkToParent = useCallback(
    async (
      documentIds: string[],
      parentId: string,
      userId: string,
      refreshAll: () => Promise<void>,
    ) => {
      const edus = await fetchEducations(userId);
      const edu = edus.find((e) => e.id === parentId);
      if (edu) {
        const merged = [...new Set([...edu.document_ids, ...documentIds])];
        await updateEducation(userId, parentId, {
          ...edu,
          document_ids: merged,
          updated_at: new Date().toISOString(),
        } as EducationPlaintext);
      }
      await refreshAll();
    },
    [],
  );

  const handleDocumentSaved = useCallback(
    async (
      documentId: string,
      newLinkedId: string,
      oldLinkedId: string,
      userId: string,
      refreshAll: () => Promise<void>,
    ) => {
      if (oldLinkedId === newLinkedId) {
        await refreshAll();
        return;
      }

      const edus = await fetchEducations(userId);

      if (oldLinkedId) {
        const oldEdu = edus.find((e) => e.id === oldLinkedId);
        if (oldEdu) {
          const newDocIds = oldEdu.document_ids.filter((id) => id !== documentId);
          await updateEducation(userId, oldLinkedId, {
            ...oldEdu,
            document_ids: newDocIds,
            updated_at: new Date().toISOString(),
          } as EducationPlaintext);
        }
      }

      if (newLinkedId) {
        const newEdu = edus.find((e) => e.id === newLinkedId);
        if (newEdu) {
          const merged = [...new Set([...newEdu.document_ids, documentId])];
          await updateEducation(userId, newLinkedId, {
            ...newEdu,
            document_ids: merged,
            updated_at: new Date().toISOString(),
          } as EducationPlaintext);
        }
      }

      await refreshAll();
    },
    [],
  );

  // --- Inline record creation ---
  const renderNewRecordForm = useCallback(
    ({ disabled, isSaving }: { disabled: boolean; isSaving: boolean }) => (
      <fieldset disabled={disabled || isSaving} className="space-y-3">
        <InputField
          label="Course / Certification Name"
          value={newEduName}
          onChange={setNewEduName}
          disabled={isSaving || disabled}
          placeholder="e.g. AWS Solutions Architect"
        />
        <InputField
          label="Provider"
          value={newEduProvider}
          onChange={setNewEduProvider}
          disabled={isSaving || disabled}
          placeholder="Institution or platform"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField
            label="Priority"
            value={newEduPriority}
            onChange={(v) => setNewEduPriority(v as Priority)}
            disabled={isSaving || disabled}
            options={PRIORITIES.map((p) => ({ value: p, label: p[0].toUpperCase() + p.slice(1) }))}
          />
          <InputField
            label="Due Date"
            type="date"
            value={newEduDueDate}
            onChange={setNewEduDueDate}
            disabled={isSaving || disabled}
          />
        </div>
        <TextareaField
          label="Description"
          value={newEduDescription}
          onChange={setNewEduDescription}
          disabled={isSaving || disabled}
          rows={2}
        />
      </fieldset>
    ),
    [newEduName, newEduProvider, newEduPriority, newEduDueDate, newEduDescription],
  );

  const extractNewRecordData = useCallback((): Record<string, string> | null => {
    if (!newEduName.trim()) return null;
    return {
      name: newEduName.trim(),
      provider: newEduProvider.trim(),
      priority: newEduPriority,
      due_date: newEduDueDate,
      description: newEduDescription.trim(),
    };
  }, [newEduName, newEduProvider, newEduPriority, newEduDueDate, newEduDescription]);

  const handleCreateParentFromStore = useCallback(
    async (
      data: Record<string, string>,
      userId: string,
      refreshAll: () => Promise<void>,
    ): Promise<string> => {
      const nowIso = new Date().toISOString();
      const edu = await createEducation(userId, {
        name: data.name || "",
        provider: data.provider || "",
        priority: (data.priority as Priority) || "medium",
        due_date: data.due_date || null,
        description: data.description || "",
        is_completed: false,
        completed_at: null,
        document_ids: [],
        updated_at: nowIso,
      });
      await refreshAll();
      setNewEduName("");
      setNewEduProvider("");
      setNewEduPriority("medium");
      setNewEduDueDate("");
      setNewEduDescription("");
      return edu.id;
    },
    [],
  );

  // --- modalSlot ---
  const modalSlot = useCallback(
    ({
      linkedRecord,
      allDocuments,
      userId,
      refreshAll,
      onClose,
    }: {
      linkedRecord: Education;
      allRows: Education[];
      allDocuments: Document[];
      userId: string;
      refreshAll: () => Promise<void>;
      onClose: () => void;
    }) => (
      <EducationModalWrapper
        education={linkedRecord}
        documents={allDocuments}
        userId={userId}
        refreshAll={refreshAll}
        onClose={onClose}
      />
    ),
    [],
  );

  return (
    <GenericStorePage
      domain="education"
      title="Certificate Store"
      description="View all uploaded certificates across all your educations."
      backHref={ROUTES.EDUCATION}
      fetchData={fetchData}
      deriveParentRecords={deriveParentRecords}
      onLinkedRecordClick={onLinkedRecordClick}
      modalSlot={modalSlot}
      onDeleteParentRecord={handleDeleteParent}
      onUnlinkFromParent={handleUnlinkFromParent}
      onBulkLinkToParent={handleBulkLinkToParent}
      onDocumentSaved={handleDocumentSaved}
      renderNewRecordForm={renderNewRecordForm}
      extractNewRecordData={extractNewRecordData}
      onCreateParentFromStore={handleCreateParentFromStore}
    />
  );
}

// --- EducationModal wrapper with inline save/delete/download handlers ---

function EducationModalWrapper({
  education,
  documents,
  userId,
  refreshAll,
  onClose,
}: {
  education: Education;
  documents: Document[];
  userId: string;
  refreshAll: () => Promise<void>;
  onClose: () => void;
}) {
  const handleEducationSave = useCallback(
    async (
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
    ) => {
      if (!userId) throw new Error("No active session.");
      const freshEdus = await fetchEducations(userId);
      const freshDocs = await fetchDocuments(userId);
      const freshEdu = existingEducation
        ? freshEdus.find((e) => e.id === existingEducation.id)
        : null;
      let currentDocIds = [...(freshEdu?.document_ids ?? [])];
      const nowIso = new Date().toISOString();
      const completedAt = draft.is_completed ? freshEdu?.completed_at ?? nowIso : null;

      if (pendingUnlinkDocIds && pendingUnlinkDocIds.length > 0 && existingEducation) {
        for (const docId of pendingUnlinkDocIds) {
          const doc = freshDocs.find((d) => d.id === docId);
          if (doc) {
            await updateDocument(userId, docId, {
              ...doc,
              linked_id: "",
              updated_at: nowIso,
            } as DocumentPlaintext);
          }
          currentDocIds = currentDocIds.filter((id) => id !== docId);
        }
      }

      if (pendingDeleteDocIds && pendingDeleteDocIds.length > 0) {
        for (const docId of pendingDeleteDocIds) {
          const doc = freshDocs.find((d) => d.id === docId);
          if (doc) {
            currentDocIds = currentDocIds.filter((id) => id !== docId);
            if (doc.file_name) {
              try {
                await deleteDocumentFile(userId, doc.file_name);
              } catch {
                /* best-effort */
              }
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
        const pdoc = freshDocs.find((d) => d.id === pendingLinkDocId);
        if (pdoc) {
          await updateDocument(userId, pendingLinkDocId, {
            ...pdoc,
            linked_id: savedEdu.id,
            updated_at: nowIso,
          } as DocumentPlaintext);
          if (!newDocIds.includes(pendingLinkDocId)) newDocIds.push(pendingLinkDocId);
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

      await refreshAll();

      if (pendingUnlinkDocIds && pendingUnlinkDocIds.length > 0) {
        onClose();
        const unlinkedId = pendingUnlinkDocIds[pendingUnlinkDocIds.length - 1];
        window.location.hash = `#edit-document-${unlinkedId}`;
      }
    },
    [userId, refreshAll, onClose],
  );

  const handleEducationDelete = useCallback(
    async (educationId: string, cascadeMode: "unlink" | "cascade") => {
      if (!userId) throw new Error("No active session.");
      const eduDocs = documents.filter(
        (d) => d.domain === "education" && d.linked_id === educationId,
      );
      const nowIso = new Date().toISOString();
      if (cascadeMode === "unlink") {
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
            try {
              await deleteDocumentFile(userId, doc.file_name);
            } catch {
              /* best-effort */
            }
          }
          await deleteDocument(doc.id);
        }
      }
      await deleteEducation(educationId);
      await refreshAll();
    },
    [userId, documents, refreshAll],
  );

  const handleDownloadDocument = useCallback(
    async (doc: Document) => {
      if (!userId) throw new Error("No active session.");
      const blob = await downloadDocumentFile(
        userId,
        doc.file_name,
        doc.file_iv,
        doc.file_mime,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.label || "document";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [userId],
  );

  return (
    <EducationModal
      education={education}
      documents={documents}
      userId={userId}
      onClose={onClose}
      onSave={handleEducationSave}
      onDelete={handleEducationDelete}
      onDownloadDocument={handleDownloadDocument}
    />
  );
}
