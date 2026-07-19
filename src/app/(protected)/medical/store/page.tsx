"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ROUTES } from "@/routes/paths";
import { getSession } from "@/api/auth";
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
import GlobalStoreView from "@/components/common/store/GlobalStoreView";
import MedicalModal from "@/components/medical/MedicalModal";

/**
 * Medical Document Store.
 * Renders the global document store filtered to the "medical" domain,
 * with medical records as linkable parent items.
 *
 * Mirrors Education's CertificateStoreView: clicking a linked document
 * opens MedicalModal for the parent record instead of StoreDocumentModal.
 */
export default function MedicalStorePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [parentRecords, setParentRecords] = useState<{ id: string; name: string }[]>([]);
  const [allRecords, setAllRecords] = useState<MedicalRecord[]>([]);
  const [allDocuments, setAllDocuments] = useState<Document[]>([]);

  // Modal state for linked document → open parent MedicalModal
  const [linkedRecord, setLinkedRecord] = useState<MedicalRecord | null>(null);

  // --- Auth + data loading (single source of truth) ---
  useEffect(() => {
    const init = async () => {
      const session = await getSession();
      if (session?.user.id) setUserId(session.user.id);
    };
    init();
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const load = async () => {
      const [records, docs] = await Promise.all([
        fetchMedicalRecords(userId),
        fetchDocuments(userId),
      ]);
      if (!cancelled) {
        setAllRecords(records);
        setAllDocuments(docs);
        setParentRecords(records.map((r) => ({ id: r.id, name: r.name })));
      }
    };
    load();
    return () => { cancelled = true; };
  }, [userId]);

  /** Refresh both records AND documents (used after mutations) */
  const refreshAll = useCallback(async () => {
    if (!userId) return;
    const [records, docs] = await Promise.all([
      fetchMedicalRecords(userId),
      fetchDocuments(userId),
    ]);
    setAllRecords(records);
    setAllDocuments(docs);
    setParentRecords(records.map((r) => ({ id: r.id, name: r.name })));
  }, [userId]);

  // --- Action click override: linked doc → open MedicalModal for parent ---
  const handleActionClick = useCallback(
    (docId: string) => {
      const doc = allDocuments.find((d) => d.id === docId);
      // Return false so GlobalStoreView opens the StoreDocumentModal for unlinked docs
      if (!doc?.linked_id) return false;
      const record = allRecords.find((r) => r.id === doc.linked_id);
      if (record) {
        setLinkedRecord(record);
        return true; // Handled
      }
      return false; // Not handled
    },
    [allDocuments, allRecords],
  );

  const closeLinkedRecord = useCallback(() => {
    setLinkedRecord(null);
    refreshAll();
  }, [refreshAll]);

  // --- Parent CRUD handlers ---

  const handleDeleteParent = useCallback(
    async (parentId: string) => {
      if (!userId) return;
      await deleteMedicalRecord(parentId);
      await refreshAll();
    },
    [userId, refreshAll],
  );

  const handleUnlinkFromParent = useCallback(
    async (documentId: string, parentId: string) => {
      if (!userId) return;
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
    [userId, refreshAll],
  );

  const handleBulkLinkToParent = useCallback(
    async (documentIds: string[], parentId: string) => {
      if (!userId) return;
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
    [userId, refreshAll],
  );

  // --- MedicalModal handlers (for linked record editing from store) ---

  const handleMedicalSave = useCallback(
    async (
      draft: { name: string; clinic: string; date: string; diagnosis_timeline: string },
      existingRecord: MedicalRecord | null,
      fileAction?: { newFiles: File[]; removeDocIds: string[]; unlinkDocIds?: string[]; linkDocId?: string },
    ) => {
      if (!userId) throw new Error("No active session.");
      const nowIso = new Date().toISOString();
      let document_ids = [...(existingRecord?.document_ids ?? [])];

      if (fileAction?.removeDocIds) {
        for (const docId of fileAction.removeDocIds) {
          const doc = allDocuments.find((d) => d.id === docId);
          if (doc?.file_name) {
            try { await deleteDocumentFile(userId, doc.file_name); } catch { /* best-effort */ }
          }
          try { await deleteDocument(docId); } catch { /* best-effort */ }
          document_ids = document_ids.filter((id) => id !== docId);
        }
      }

      // Process unlinks: clear linked_id, remove from parent, keep file
      if (fileAction?.unlinkDocIds) {
        for (const docId of fileAction.unlinkDocIds) {
          const doc = allDocuments.find((d) => d.id === docId);
          if (doc) {
            await updateDocument(userId, docId, { ...doc, linked_id: "", updated_at: nowIso } as DocumentPlaintext);
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

      // Backfill linked_id for newly created documents
      if (!existingRecord && fileAction?.newFiles && fileAction.newFiles.length > 0) {
        const freshDocs = await fetchDocuments(userId);
        for (const doc of freshDocs) {
          if (doc.domain === "medical" && doc.linked_id === "" && document_ids.includes(doc.id)) {
            await updateDocument(userId, doc.id, {
              ...doc, linked_id: savedRecord.id, updated_at: new Date().toISOString(),
            } as DocumentPlaintext);
          }
        }
      }

      await refreshAll();
    },
    [userId, allDocuments, refreshAll],
  );

  const handleMedicalDelete = useCallback(
    async (recordId: string, cascadeMode: 'unlink' | 'cascade' = 'cascade') => {
      if (!userId) throw new Error("No active session.");
      const record = allRecords.find((r) => r.id === recordId);
      if (record?.document_ids) {
        if (cascadeMode === 'unlink') {
          const nowIso = new Date().toISOString();
          for (const docId of record.document_ids) {
            const doc = allDocuments.find((d) => d.id === docId);
            if (doc) {
              await updateDocument(userId, docId, { ...doc, linked_id: "", updated_at: nowIso } as DocumentPlaintext);
            }
          }
        } else {
          for (const docId of record.document_ids) {
            const doc = allDocuments.find((d) => d.id === docId);
            if (doc?.file_name) {
              try { await deleteDocumentFile(userId, doc.file_name); } catch { /* best-effort */ }
            }
            try { await deleteDocument(docId); } catch { /* best-effort */ }
          }
        }
      }
      await deleteMedicalRecord(recordId);
      await refreshAll();
    },
    [userId, allRecords, allDocuments, refreshAll],
  );

  // Attached documents for the linked record
  const linkedAttachedDocs = useMemo(
    () =>
      linkedRecord
        ? allDocuments.filter((d) => linkedRecord.document_ids?.includes(d.id))
        : [],
    [linkedRecord, allDocuments],
  );

  const linkedStandaloneDocs = useMemo(
    () => allDocuments.filter((d) => d.domain === "medical" && !d.linked_id),
    [allDocuments],
  );

  // --- Inline record creation form state (for StoreDocumentModal) ---
  const [newRecordName, setNewRecordName] = useState("");
  const [newRecordClinic, setNewRecordClinic] = useState("");
  const [newRecordDate, setNewRecordDate] = useState("");
  const [newRecordDiagnosis, setNewRecordDiagnosis] = useState("");

  const renderNewRecordForm = useCallback(
    ({ disabled, isSaving }: { disabled: boolean; isSaving: boolean }) => (
      <fieldset disabled={disabled || isSaving} className="space-y-3">
        <InputField label="Record Name" value={newRecordName} onChange={setNewRecordName}
          disabled={isSaving || disabled} placeholder="e.g. Annual Checkup" />
        <InputField label="Clinic / Hospital" value={newRecordClinic} onChange={setNewRecordClinic}
          disabled={isSaving || disabled} placeholder="e.g. Apollo Hospital" />
        <InputField label="Date" type="date" value={newRecordDate} onChange={setNewRecordDate}
          disabled={isSaving || disabled} />
        <TextareaField label="Diagnosis / Timeline" value={newRecordDiagnosis}
          onChange={setNewRecordDiagnosis} disabled={isSaving || disabled} rows={2} />
      </fieldset>
    ),
    [newRecordName, newRecordClinic, newRecordDate, newRecordDiagnosis],
  );

  const extractNewRecordData = useCallback((): Record<string, string> | null => {
    if (!newRecordName.trim()) return null;
    return { name: newRecordName.trim(), clinic: newRecordClinic.trim(), date: newRecordDate, diagnosis_timeline: newRecordDiagnosis.trim() };
  }, [newRecordName, newRecordClinic, newRecordDate, newRecordDiagnosis]);

  const onCreateParentFromStore = useCallback(
    async (data: Record<string, string>): Promise<string> => {
      if (!userId) throw new Error("No active session.");
      const nowIso = new Date().toISOString();
      const record = await createMedicalRecord(userId, {
        name: data.name || "", clinic: data.clinic || "",
        date: data.date || nowIso.split("T")[0],
        diagnosis_timeline: data.diagnosis_timeline || "",
        document_ids: [], updated_at: nowIso,
      });
      await refreshAll();
      setNewRecordName(""); setNewRecordClinic(""); setNewRecordDate(""); setNewRecordDiagnosis("");
      return record.id;
    },
    [userId, refreshAll],
  );

  return (
    <>
      <GlobalStoreView
        domain="medical"
        title="Medical Document Store"
        description="View all uploaded medical reports and documents."
        backHref={ROUTES.MEDICAL}
        backLabel="← Back to Medical Records"
        parentRecords={parentRecords}
        onDeleteParentRecord={handleDeleteParent}
        onUnlinkFromParent={handleUnlinkFromParent}
        onBulkLinkToParent={handleBulkLinkToParent}
        onActionClick={handleActionClick}
        renderNewRecordForm={renderNewRecordForm}
        extractNewRecordData={extractNewRecordData}
        onCreateParentFromStore={onCreateParentFromStore}
      />

      {/* MedicalModal for linked record editing (mirrors Education's CertificateStoreView) */}
      {linkedRecord && userId && (
        <MedicalModal
          record={linkedRecord}
          attachedDocuments={linkedAttachedDocs}
          standaloneDocuments={linkedStandaloneDocs}
          userId={userId}
          onClose={closeLinkedRecord}
          onSave={handleMedicalSave}
          onDelete={handleMedicalDelete}
        />
      )}
    </>
  );
}
