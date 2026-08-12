"use client";

import { useCallback, useRef, useState } from "react";
import { ROUTES } from "@/routes/paths";
import { fetchVaultEntriesBySection, deleteVaultEntry, createVaultEntry, updateVaultEntry } from "@/api/vault";
import { fetchDocuments, createDocument, updateDocument, deleteDocument } from "@/api/common/documents";
import { uploadDocumentFile, deleteDocumentFile } from "@/api/common/documentStorage";
import GenericStorePage from "@/components/common/store/GenericStorePage";
import GenericDomainModal, { type FieldDef, type FileActions } from "@/components/common/GenericDomainModal";
import type { Document, DocumentPlaintext } from "@/types/document";
import type { PersonalRecord, PersonalRecordPlaintext, VaultRecordItem } from "@/types/vault";

const RECORD_FIELDS: FieldDef[] = [
  { key: "name", type: "text", label: "Name", placeholder: "e.g. Aadhaar Number" },
  { key: "value", type: "text", label: "Value", placeholder: "The reference number or ID", isCopyable: true },
];

export default function RecordsView() {
  // Document state for the active record modal
  const [docs, setDocs] = useState<Document[]>([]);
  const docOriginalLabels = useRef<Map<string, string>>(new Map());

  const fetchDocs = useCallback(async (uid: string) => {
    try {
      const all = await fetchDocuments(uid);
      setDocs(all);
    } catch { /* ignore */ }
  }, []);

  const fetchData = useCallback(
    async (userId: string) => {
      // Also fetch documents in parallel
      fetchDocs(userId);
      return fetchVaultEntriesBySection(userId, "records") as Promise<PersonalRecord[]>;
    },
    [fetchDocs],
  );

  const mapRecordToItem = useCallback(
    (r: PersonalRecord): VaultRecordItem => ({
      id: r.id,
      title: r.name,
      values: [{ value: r.value }],
      hasFiles: docs.some((d) => d.linked_id === r.id && d.domain === "vault"),
    }),
    [docs],
  );

  const onDeleteRecord = useCallback(async (id: string) => { await deleteVaultEntry(id); }, []);
  const onBulkDeleteRecords = useCallback(async (ids: string[]) => {
    for (const id of ids) await deleteVaultEntry(id);
  }, []);

  return (
    <GenericStorePage<PersonalRecord>
      storeType="record"
      title="Personal Records"
      description="Manage your personal reference records."
      backHref={ROUTES.VAULT}
      fetchData={fetchData}
      onDeleteRecord={onDeleteRecord}
      onBulkDeleteRecords={onBulkDeleteRecords}
      itemName="record"
      mapRecordToItem={mapRecordToItem}
      tileLayout="body-only"
      recordModalSlot={({ record, userId, onSaved, onClose }) => {
        const isEditing = !!record;
        const attachedDocuments = isEditing && record
          ? docs.filter((d) => d.domain === "vault" && d.linked_id === record.id)
          : [];

        // Track original labels for rename detection
        for (const doc of attachedDocuments) {
          if (!docOriginalLabels.current.has(doc.id)) {
            docOriginalLabels.current.set(doc.id, doc.label || "");
          }
        }

        const handleSave = async (formData: Record<string, unknown>, fileActions: FileActions) => {
          const nm = (formData.name as string).trim();
          const vl = (formData.value as string).trim();
          if (!nm || !vl) throw new Error("Name and value are required.");

          const now = new Date().toISOString();
          const plaintext: PersonalRecordPlaintext = {
            section: "records", name: nm, value: vl, updated_at: now,
          };

          let savedRecord: PersonalRecord;
          if (isEditing && record) {
            savedRecord = await updateVaultEntry(userId, record.id, plaintext) as PersonalRecord;
          } else {
            savedRecord = await createVaultEntry(userId, plaintext) as PersonalRecord;
          }

          // File operations
          for (const docId of fileActions.docsToDelete) {
            const doc = attachedDocuments.find((d) => d.id === docId);
            if (doc) {
              if (doc.file_name) { try { await deleteDocumentFile(userId, doc.file_name); } catch { /* best-effort */ } }
              try { await deleteDocument(docId); } catch { /* best-effort */ }
            }
          }
          for (const docId of fileActions.docsToUnlink) {
            const doc = attachedDocuments.find((d) => d.id === docId);
            if (doc) {
              try { await updateDocument(userId, docId, { ...doc, linked_id: "", updated_at: now } as DocumentPlaintext); } catch { /* best-effort */ }
            }
          }
          for (const nf of fileActions.newFiles) {
            try {
              const { fileName, iv, mimeType } = await uploadDocumentFile(userId, nf.file);
              await createDocument(userId, { label: nf.label, file_name: fileName, file_iv: iv, file_mime: mimeType, domain: "vault", linked_id: savedRecord.id, updated_at: now });
            } catch { /* best-effort */ }
          }
          for (const docId of fileActions.docsToLink) {
            const doc = attachedDocuments.find((d) => d.id === docId);
            if (doc) {
              try { await updateDocument(userId, docId, { ...doc, linked_id: savedRecord.id, updated_at: now } as DocumentPlaintext); } catch { /* best-effort */ }
            }
          }
          // Renames
          for (const doc of attachedDocuments) {
            const orig = docOriginalLabels.current.get(doc.id);
            if (orig && orig !== doc.label) {
              try { await updateDocument(userId, doc.id, { ...doc, label: doc.label, updated_at: now } as DocumentPlaintext); } catch { /* best-effort */ }
            }
          }

          onSaved(savedRecord);
        };

        const handleDelete = async () => {
          if (!record) throw new Error("Cannot delete: no record selected.");
          for (const doc of attachedDocuments) {
            if (doc.file_name) { try { await deleteDocumentFile(userId, doc.file_name); } catch { /* best-effort */ } }
            try { await deleteDocument(doc.id); } catch { /* best-effort */ }
          }
          await deleteVaultEntry(record.id);
          onClose();
        };

        return (
          <GenericDomainModal
            mode="record"
            title={isEditing ? "Edit Record" : "Add Record"}
            onClose={onClose}
            fields={RECORD_FIELDS}
            initialData={{
              name: record?.name ?? "",
              value: record?.value ?? "",
            }}
            allowFiles
            userId={userId}
            attachedDocuments={attachedDocuments}
            standaloneDocuments={[]}
            domain="vault"
            onSave={handleSave}
            onDelete={isEditing ? handleDelete : undefined}
            deleteLabel="Delete Record"
          />
        );
      }}
    />
  );
}
