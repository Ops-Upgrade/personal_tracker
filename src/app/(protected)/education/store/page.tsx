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
} from "@/api/common/documents";
import { InputField, SelectField } from "@/components/common/FormField";
import RichTextEditor from "@/components/common/RichTextEditor";
import type { Education, EducationPlaintext } from "@/types/education";
import type { Document } from "@/types/document";
import { PRIORITIES, type Priority } from "@/types/common";
import { useEducationActions } from "@/hooks/useEducationActions";
import GenericStorePage from "@/components/common/store/GenericStorePage";
import GenericDomainModal from "@/components/common/GenericDomainModal";
import { normalizeDateForInput } from "@/lib/utils";
import { EDUCATION_FIELDS, EDUCATION_LAYOUT } from "@/components/education/config";

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
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Description
          </label>
          <RichTextEditor
            value={newEduDescription}
            onChange={setNewEduDescription}
            disabled={isSaving || disabled}
            minHeight="6rem"
          />
        </div>
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
      <EducationStoreModal
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

// --- Education store modal (hook bridge — calls useEducationActions) ---

function EducationStoreModal({
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
  const refresh = useCallback(async () => { await refreshAll(); }, [refreshAll]);
  const { createSaveAdapter, handleEducationDelete, handleDownloadDocument } =
    useEducationActions({ userId, refresh });

  return (
    <GenericDomainModal
      mode="record"
      title="Edit education"
      fields={EDUCATION_FIELDS}
      layout={EDUCATION_LAYOUT}
      initialData={{
        name: education.name,
        provider: education.provider,
        priority: education.priority,
        due_date: normalizeDateForInput(education.due_date),
        description: education.description,
        is_completed: education.is_completed,
      }}
      allowFiles
      userId={userId}
      attachedDocuments={documents.filter(
        (d) => d.domain === "education" && d.linked_id === education.id,
      )}
      standaloneDocuments={documents.filter(
        (d) => d.domain === "education" && !d.linked_id,
      )}
      domain="education"
      onSave={async (formData, fileActions) => {
        await createSaveAdapter(education)(formData, fileActions);
        // After unlinking, navigate to the unlinked document in the store
        if (fileActions.docsToUnlink.length > 0) {
          onClose();
          const unlinkedId =
            fileActions.docsToUnlink[fileActions.docsToUnlink.length - 1];
          window.location.hash = `#edit-document-${unlinkedId}`;
        }
      }}
      onDeleteWithCascade={async (cascadeMode) => {
        await handleEducationDelete(education.id, cascadeMode);
      }}
      deleteLabel="Delete"
      onDownloadDocument={handleDownloadDocument}
      onClose={onClose}
    />
  );
}
