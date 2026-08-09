"use client";

import { useCallback } from "react";
import type { MedicalRecord, MedicalPlaintext } from "@/types/medical";
import type { Document, DocumentPlaintext } from "@/types/document";
import { fetchMedicalRecords, createMedicalRecord, updateMedicalRecord, deleteMedicalRecord } from "@/api/medical";
import { fetchDocuments, createDocument, updateDocument, deleteDocument } from "@/api/common/documents";
import { uploadDocumentFile, downloadDocumentFile, deleteDocumentFile } from "@/api/common/documentStorage";
import type { FileActions } from "@/components/common/GenericDomainModal";

interface UseMedicalActionsParams {
  userId: string | null;
  refresh: () => Promise<void>;
}

/**
 * Shared hook for Medical Record CRUD + document linking operations.
 * Matches the exact flat-param pattern of useExpenseActions and useEducationActions.
 */
export function useMedicalActions({ userId, refresh }: UseMedicalActionsParams) {
  const handleSave = useCallback(
    async (
      draft: {
        name: string;
        clinic: string;
        date: string;
        diagnosis_timeline: string;
      },
      existingRecord: MedicalRecord | null,
      pendingDoc?: { file: File; label: string },
      pendingLinkDocId?: string,
      pendingUnlinkDocIds?: string[],
      pendingDeleteDocIds?: string[],
    ) => {
      if (!userId) throw new Error("No active session.");

      const freshRecords = await fetchMedicalRecords(userId);
      const freshDocs = await fetchDocuments(userId);
      const freshRecord = existingRecord
        ? freshRecords.find((r) => r.id === existingRecord.id)
        : null;

      let currentDocIds = [...(freshRecord?.document_ids ?? [])];
      const nowIso = new Date().toISOString();

      // Process unlinks
      if (pendingUnlinkDocIds && pendingUnlinkDocIds.length > 0 && existingRecord) {
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

      // Process deletions
      if (pendingDeleteDocIds && pendingDeleteDocIds.length > 0) {
        for (const docId of pendingDeleteDocIds) {
          const doc = freshDocs.find((d) => d.id === docId);
          if (doc) {
            currentDocIds = currentDocIds.filter((id) => id !== docId);
            if (doc.file_name) {
              try { await deleteDocumentFile(userId, doc.file_name); } catch { /* best-effort */ }
            }
            await deleteDocument(docId);
          }
        }
      }

      const payload: MedicalPlaintext = {
        name: draft.name,
        clinic: draft.clinic,
        date: draft.date,
        diagnosis_timeline: draft.diagnosis_timeline,
        document_ids: currentDocIds,
        updated_at: nowIso,
      };

      let savedRecord: MedicalRecord;
      if (existingRecord) {
        savedRecord = await updateMedicalRecord(userId, existingRecord.id, payload);
      } else {
        savedRecord = await createMedicalRecord(userId, payload);
      }

      // Handle new file upload
      let needsUpdate = false;
      const newDocIds = [...currentDocIds];

      if (pendingDoc) {
        const { fileName, iv, mimeType } = await uploadDocumentFile(
          userId,
          pendingDoc.file,
        );
        const doc = await createDocument(userId, {
          label: pendingDoc.label,
          file_name: fileName,
          file_iv: iv,
          file_mime: mimeType,
          domain: "medical",
          linked_id: savedRecord.id,
          updated_at: nowIso,
        });
        newDocIds.push(doc.id);
        needsUpdate = true;
      }

      // Handle linking existing document
      if (pendingLinkDocId) {
        const pdoc = freshDocs.find((d) => d.id === pendingLinkDocId);
        if (pdoc) {
          await updateDocument(userId, pendingLinkDocId, {
            ...pdoc,
            linked_id: savedRecord.id,
            updated_at: nowIso,
          } as DocumentPlaintext);
          if (!newDocIds.includes(pendingLinkDocId)) newDocIds.push(pendingLinkDocId);
          needsUpdate = true;
        }
      }

      // Fix linked_id for newly created/linked documents (only for new records)
      if (!existingRecord) {
        const allDocs = await fetchDocuments(userId);
        for (const doc of allDocs) {
          if (doc.domain === "medical" && doc.linked_id === "" && newDocIds.includes(doc.id)) {
            await updateDocument(userId, doc.id, {
              ...doc,
              linked_id: savedRecord.id,
              updated_at: new Date().toISOString(),
            } as DocumentPlaintext);
          }
        }
      }

      if (needsUpdate) {
        await updateMedicalRecord(userId, savedRecord.id, {
          ...payload,
          document_ids: newDocIds,
          updated_at: new Date().toISOString(),
        });
      }

      await refresh();
      return savedRecord;
    },
    [userId, refresh],
  );

  const handleDelete = useCallback(
    async (recordId: string) => {
      if (!userId) throw new Error("No active session.");

      const allDocs = await fetchDocuments(userId);
      const recordDocs = allDocs.filter(
        (d) => d.domain === "medical" && d.linked_id === recordId,
      );

      // Always cascade-delete attached documents
      for (const doc of recordDocs) {
        if (doc.file_name) {
          try { await deleteDocumentFile(userId, doc.file_name); } catch { /* best-effort */ }
        }
        try { await deleteDocument(doc.id); } catch { /* best-effort */ }
      }

      await deleteMedicalRecord(recordId);
      await refresh();
    },
    [userId, refresh],
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

  /** Schema-driven save adapter: (formData, fileActions) → handleSave */
  const createSaveAdapter = useCallback(
    (existingRecord: MedicalRecord | null, onSuccess?: (saved: MedicalRecord) => void) => {
      return async (formData: Record<string, unknown>, fileActions: FileActions) => {
        const name = (formData.name as string).trim();
        if (!name) throw new Error("Record name is required.");
        const date = (formData.date as string) || "";
        if (!date) throw new Error("Date is required.");

        const firstNewFile = fileActions.newFiles[0];
        const pendingDoc = firstNewFile
          ? { file: firstNewFile.file, label: firstNewFile.label }
          : undefined;

        const saved = await handleSave(
          {
            name,
            clinic: (formData.clinic as string).trim(),
            date,
            diagnosis_timeline: (formData.diagnosis_timeline as string).trim(),
          },
          existingRecord,
          pendingDoc,
          fileActions.docsToLink[0] || undefined,
          fileActions.docsToUnlink.length > 0 ? fileActions.docsToUnlink : undefined,
          fileActions.docsToDelete.length > 0 ? fileActions.docsToDelete : undefined,
        );

        onSuccess?.(saved);
      };
    },
    [handleSave],
  );

  return { handleSave, handleDelete, handleDownloadDocument, createSaveAdapter };
}
