"use client";

import { useCallback } from "react";
import { ROUTES } from "@/routes/paths";
import {
  fetchMedicalRecords,
  updateMedicalRecord,
  deleteMedicalRecord,
} from "@/api/medical";
import {
  fetchDocuments,
} from "@/api/common/documents";
import type { MedicalRecord, MedicalPlaintext } from "@/types/medical";
import type { Document } from "@/types/document";
import { useMedicalActions } from "@/hooks/useMedicalActions";
import GenericStorePage from "@/components/common/store/GenericStorePage";
import GenericDomainModal, { type FieldDef } from "@/components/common/GenericDomainModal";

/** Schema for the medical record edit modal */
const MEDICAL_FIELDS: FieldDef[] = [
  { key: "name", type: "text", label: "Name" },
  { key: "clinic", type: "text", label: "Clinic / Doctor" },
  { key: "date", type: "date", label: "Date" },
  { key: "diagnosis_timeline", type: "richtext", label: "Diagnosis Timeline", minHeight: "8rem" },
];

/**
 * Medical Document Store.
 * Uses GenericStorePage with medical records as parent items.
 *
 * Clicking a linked document opens the record edit modal for the parent record.
 */
export default function MedicalStorePage() {
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
      <MedicalStoreModal
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
      disableAdd={true}
    />
  );
}

// --- Medical store modal (hook bridge — calls useMedicalActions) ---

function MedicalStoreModal({
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
  const refresh = useCallback(async () => { await refreshAll(); }, [refreshAll]);
  const { createSaveAdapter, handleDelete } = useMedicalActions({ userId, refresh });

  return (
    <GenericDomainModal
      key={record.id}
      mode="record"
      title="Edit medical record"
      onClose={onClose}
      fields={MEDICAL_FIELDS}
      initialData={{
        name: record.name,
        clinic: record.clinic,
        date: record.date,
        diagnosis_timeline: record.diagnosis_timeline,
      }}
      allowFiles
      allowLinking={false}
      userId={userId}
      attachedDocuments={allDocuments.filter(
        (d) => d.domain === "medical" && d.linked_id === record.id,
      )}
      domain="medical"
      onSave={createSaveAdapter(record)}
      onDelete={async () => {
        await handleDelete(record.id);
      }}
      deleteLabel="Delete"
    />
  );
}
