"use client";

import { useCallback, useMemo, useState } from "react";
import { ROUTES } from "@/routes/paths";
import {
  fetchMedicalRecords,
  updateMedicalRecord,
  deleteMedicalRecord,
  createMedicalRecord,
} from "@/api/medical";
import {
  fetchDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
} from "@/api/common/documents";
import {
  uploadDocumentFile,
  deleteDocumentFile,
} from "@/api/common/documentStorage";
import { InputField, TextareaField } from "@/components/common/FormField";
import type { MedicalRecord, MedicalPlaintext } from "@/types/medical";
import type { Document, DocumentPlaintext } from "@/types/document";
import GenericStorePage from "@/components/common/store/GenericStorePage";
import MedicalModal from "@/components/medical/MedicalModal";

/**
 * Medical Document Store.
 * Uses GenericStorePage with medical records as parent items.
 *
 * Clicking a linked document opens MedicalModal for the parent record.
 */
export default function MedicalStorePage() {
  // --- Inline record creation form state ---
  const [newRecordName, setNewRecordName] = useState("");
  const [newRecordClinic, setNewRecordClinic] = useState("");
  const [newRecordDate, setNewRecordDate] = useState("");
  const [newRecordDiagnosis, setNewRecordDiagnosis] = useState("");

  // --- fetchData ---
  const fetchData = useCallback(async (userId: string) => {
    const [records, docs] = await Promise.all([
      fetchMedicalRecords(userId),
      fetchDocuments(userId),
    ]);
    return { domainRows: records, documents: docs };
  }, []);

  // --- deriveParentRecords ---
  const deriveParentRecords = useCallback(
    (rows: MedicalRecord[]) => rows.map((r) => ({ id: r.id, name: r.name })),
    [],
  );

  // --- onLinkedRecordClick ---
  const onLinkedRecordClick = useCallback(
    (docId: string, allDocuments: Document[], allRows: MedicalRecord[]) => {
      const doc = allDocuments.find((d) => d.id === docId);
      if (!doc?.linked_id) return null;
      return allRows.find((r) => r.id === doc.linked_id) ?? null;
    },
    [],
  );

  // --- Parent CRUD handlers ---

  const handleDeleteParent = useCallback(
    async (parentId: string, _userId: string, refreshAll: () => Promise<void>) => {
      await deleteMedicalRecord(parentId);
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
      const records = await fetchMedicalRecords(userId);
      const record = records.find((r) => r.id === parentId);
      if (record) {
        const newDocIds = record.document_ids.filter((id) => id !== documentId);
        await updateMedicalRecord(userId, parentId, {
          name: record.name,
          clinic: record.clinic,
          date: record.date,
          diagnosis_timeline: record.diagnosis_timeline,
          document_ids: newDocIds,
          updated_at: new Date().toISOString(),
        } as MedicalPlaintext);
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
      const records = await fetchMedicalRecords(userId);
      const record = records.find((r) => r.id === parentId);
      if (record) {
        const merged = [...new Set([...record.document_ids, ...documentIds])];
        await updateMedicalRecord(userId, parentId, {
          ...record,
          document_ids: merged,
          updated_at: new Date().toISOString(),
        } as MedicalPlaintext);
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

      const records = await fetchMedicalRecords(userId);

      if (oldLinkedId) {
        const oldRecord = records.find((r) => r.id === oldLinkedId);
        if (oldRecord) {
          const newDocIds = oldRecord.document_ids.filter((id) => id !== documentId);
          await updateMedicalRecord(userId, oldLinkedId, {
            ...oldRecord,
            document_ids: newDocIds,
            updated_at: new Date().toISOString(),
          } as MedicalPlaintext);
        }
      }

      if (newLinkedId) {
        const newRecord = records.find((r) => r.id === newLinkedId);
        if (newRecord) {
          const merged = [...new Set([...newRecord.document_ids, documentId])];
          await updateMedicalRecord(userId, newLinkedId, {
            ...newRecord,
            document_ids: merged,
            updated_at: new Date().toISOString(),
          } as MedicalPlaintext);
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
          label="Record Name"
          value={newRecordName}
          onChange={setNewRecordName}
          disabled={isSaving || disabled}
          placeholder="e.g. Annual Checkup"
        />
        <InputField
          label="Clinic / Hospital"
          value={newRecordClinic}
          onChange={setNewRecordClinic}
          disabled={isSaving || disabled}
          placeholder="e.g. Apollo Hospital"
        />
        <InputField
          label="Date"
          type="date"
          value={newRecordDate}
          onChange={setNewRecordDate}
          disabled={isSaving || disabled}
        />
        <TextareaField
          label="Diagnosis / Timeline"
          value={newRecordDiagnosis}
          onChange={setNewRecordDiagnosis}
          disabled={isSaving || disabled}
          rows={2}
        />
      </fieldset>
    ),
    [newRecordName, newRecordClinic, newRecordDate, newRecordDiagnosis],
  );

  const extractNewRecordData = useCallback((): Record<string, string> | null => {
    if (!newRecordName.trim()) return null;
    return {
      name: newRecordName.trim(),
      clinic: newRecordClinic.trim(),
      date: newRecordDate,
      diagnosis_timeline: newRecordDiagnosis.trim(),
    };
  }, [newRecordName, newRecordClinic, newRecordDate, newRecordDiagnosis]);

  const handleCreateParentFromStore = useCallback(
    async (
      data: Record<string, string>,
      userId: string,
      refreshAll: () => Promise<void>,
    ): Promise<string> => {
      const nowIso = new Date().toISOString();
      const record = await createMedicalRecord(userId, {
        name: data.name || "",
        clinic: data.clinic || "",
        date: data.date || nowIso.split("T")[0],
        diagnosis_timeline: data.diagnosis_timeline || "",
        document_ids: [],
        updated_at: nowIso,
      });
      await refreshAll();
      setNewRecordName("");
      setNewRecordClinic("");
      setNewRecordDate("");
      setNewRecordDiagnosis("");
      return record.id;
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
      linkedRecord: MedicalRecord;
      allRows: MedicalRecord[];
      allDocuments: Document[];
      userId: string;
      refreshAll: () => Promise<void>;
      onClose: () => void;
    }) => (
      <MedicalModalWrapper
        record={linkedRecord}
        allDocuments={allDocuments}
        userId={userId}
        refreshAll={refreshAll}
        onClose={onClose}
      />
    ),
    [],
  );

  return (
    <GenericStorePage
      domain="medical"
      title="Medical Document Store"
      description="View all uploaded medical reports and documents."
      backHref={ROUTES.MEDICAL}
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

// --- MedicalModal wrapper with inline save/delete handlers ---

function MedicalModalWrapper({
  record,
  allDocuments,
  userId,
  refreshAll,
  onClose,
}: {
  record: MedicalRecord;
  allDocuments: Document[];
  userId: string;
  refreshAll: () => Promise<void>;
  onClose: () => void;
}) {
  const attachedDocuments = useMemo(
    () => allDocuments.filter((d) => record.document_ids?.includes(d.id)),
    [record, allDocuments],
  );

  const standaloneDocuments = useMemo(
    () => allDocuments.filter((d) => d.domain === "medical" && !d.linked_id),
    [allDocuments],
  );

  const handleMedicalSave = useCallback(
    async (
      draft: {
        name: string;
        clinic: string;
        date: string;
        diagnosis_timeline: string;
      },
      existingRecord: MedicalRecord | null,
      fileAction?: {
        newFiles: File[];
        removeDocIds: string[];
        unlinkDocIds?: string[];
        linkDocId?: string;
      },
    ) => {
      if (!userId) throw new Error("No active session.");
      const nowIso = new Date().toISOString();
      let document_ids = [...(existingRecord?.document_ids ?? [])];

      if (fileAction?.removeDocIds) {
        for (const docId of fileAction.removeDocIds) {
          const doc = allDocuments.find((d) => d.id === docId);
          if (doc?.file_name) {
            try {
              await deleteDocumentFile(userId, doc.file_name);
            } catch {
              /* best-effort */
            }
          }
          try {
            await deleteDocument(docId);
          } catch {
            /* best-effort */
          }
          document_ids = document_ids.filter((id) => id !== docId);
        }
      }

      if (fileAction?.unlinkDocIds) {
        for (const docId of fileAction.unlinkDocIds) {
          const doc = allDocuments.find((d) => d.id === docId);
          if (doc) {
            await updateDocument(userId, docId, {
              ...doc,
              linked_id: "",
              updated_at: nowIso,
            } as DocumentPlaintext);
          }
          document_ids = document_ids.filter((id) => id !== docId);
        }
      }

      if (fileAction?.newFiles) {
        for (const file of fileAction.newFiles) {
          const { fileName, iv, mimeType } = await uploadDocumentFile(userId, file);
          const doc = await createDocument(userId, {
            label: file.name,
            file_name: fileName,
            file_iv: iv,
            file_mime: mimeType,
            domain: "medical",
            linked_id: existingRecord?.id ?? "",
            updated_at: nowIso,
          });
          document_ids.push(doc.id);
        }
      }

      if (fileAction?.linkDocId) {
        const linkDoc = allDocuments.find((d) => d.id === fileAction.linkDocId);
        if (linkDoc && !document_ids.includes(fileAction.linkDocId)) {
          document_ids.push(fileAction.linkDocId);
          await updateDocument(userId, fileAction.linkDocId, {
            ...linkDoc,
            linked_id: existingRecord!.id,
            updated_at: nowIso,
          } as DocumentPlaintext);
        }
      }

      const payload: MedicalPlaintext = {
        name: draft.name,
        clinic: draft.clinic,
        date: draft.date,
        diagnosis_timeline: draft.diagnosis_timeline,
        document_ids,
        updated_at: nowIso,
      };

      let savedRecord: MedicalRecord;
      if (existingRecord) {
        savedRecord = await updateMedicalRecord(userId, existingRecord.id, payload);
      } else {
        savedRecord = await createMedicalRecord(userId, payload);
      }

      if (!existingRecord && fileAction?.newFiles && fileAction.newFiles.length > 0) {
        const freshDocs = await fetchDocuments(userId);
        for (const doc of freshDocs) {
          if (
            doc.domain === "medical" &&
            doc.linked_id === "" &&
            document_ids.includes(doc.id)
          ) {
            await updateDocument(userId, doc.id, {
              ...doc,
              linked_id: savedRecord.id,
              updated_at: new Date().toISOString(),
            } as DocumentPlaintext);
          }
        }
      }

      await refreshAll();

      if (fileAction?.unlinkDocIds && fileAction.unlinkDocIds.length > 0) {
        onClose();
        const unlinkedId = fileAction.unlinkDocIds[fileAction.unlinkDocIds.length - 1];
        window.location.hash = `#edit-document-${unlinkedId}`;
      }
    },
    [userId, allDocuments, refreshAll, onClose],
  );

  const handleMedicalDelete = useCallback(
    async (recordId: string, cascadeMode: "unlink" | "cascade" = "cascade") => {
      if (!userId) throw new Error("No active session.");
      const recordDocs = allDocuments.filter((d) => d.linked_id === recordId);
      const nowIso = new Date().toISOString();
      if (cascadeMode === "unlink") {
        for (const doc of recordDocs) {
          await updateDocument(userId, doc.id, {
            ...doc,
            linked_id: "",
            updated_at: nowIso,
          } as DocumentPlaintext);
        }
      } else {
        for (const doc of recordDocs) {
          if (doc.file_name) {
            try {
              await deleteDocumentFile(userId, doc.file_name);
            } catch {
              /* best-effort */
            }
          }
          try {
            await deleteDocument(doc.id);
          } catch {
            /* best-effort */
          }
        }
      }
      await deleteMedicalRecord(recordId);
      await refreshAll();
    },
    [userId, allDocuments, refreshAll],
  );

  return (
    <MedicalModal
      record={record}
      attachedDocuments={attachedDocuments}
      standaloneDocuments={standaloneDocuments}
      userId={userId}
      onClose={onClose}
      onSave={handleMedicalSave}
      onDelete={handleMedicalDelete}
    />
  );
}
