"use client";

import { useCallback } from "react";
import type { MedicalRecord, MedicalPlaintext } from "@/types/medical";
import type { DocumentPlaintext } from "@/types/document";
import { fetchMedicalRecords, createMedicalRecord, updateMedicalRecord, deleteMedicalRecord } from "@/api/medical";
import { fetchDocuments, createDocument, updateDocument, deleteDocument } from "@/api/common/documents";
import { uploadDocumentFile, deleteDocumentFile } from "@/api/common/documentStorage";

interface UseMedicalActionsParams {
  userId: string | null;
  refresh: () => Promise<void>;
}

export interface MedicalFileAction {
  newFiles: File[];
  removeDocIds: string[];
  unlinkDocIds?: string[];
  linkDocId?: string;
}

/**
 * Shared hook for Medical Record CRUD + document linking operations.
 * Consolidates ~150 lines of duplicated handleSave/handleDelete from
 * MedicalView and medical/all pages.
 * Pattern matches useExpenseActions.ts and useEducationActions.ts.
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
      fileAction?: MedicalFileAction,
    ) => {
      if (!userId) throw new Error("No active session.");

      const freshRecords = await fetchMedicalRecords(userId);
      const freshDocs = await fetchDocuments(userId);
      const freshRecord = existingRecord
        ? freshRecords.find((r) => r.id === existingRecord.id)
        : null;

      const nowIso = new Date().toISOString();
      let document_ids = [...(freshRecord?.document_ids ?? [])];

      // Process removals
      if (fileAction?.removeDocIds) {
        for (const docId of fileAction.removeDocIds) {
          const doc = freshDocs.find((d) => d.id === docId);
          if (doc) {
            if (doc.file_name) {
              try { await deleteDocumentFile(userId, doc.file_name); } catch { /* best-effort */ }
            }
            try { await deleteDocument(docId); } catch { /* best-effort */ }
          }
          document_ids = document_ids.filter((id) => id !== docId);
        }
      }

      // Process unlinks
      if (fileAction?.unlinkDocIds) {
        for (const docId of fileAction.unlinkDocIds) {
          const doc = freshDocs.find((d) => d.id === docId);
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

      // Upload new files
      if (fileAction?.newFiles) {
        for (const file of fileAction.newFiles) {
          const { fileName, iv, mimeType } = await uploadDocumentFile(userId, file);
          const doc = await createDocument(userId, {
            label: file.name,
            file_name: fileName,
            file_iv: iv,
            file_mime: mimeType,
            domain: "medical",
            linked_id: savedRecord.id,
            updated_at: nowIso,
          });
          document_ids.push(doc.id);
        }
      }

      // Link existing standalone document
      if (fileAction?.linkDocId) {
        const linkDoc = freshDocs.find((d) => d.id === fileAction.linkDocId);
        if (linkDoc && !document_ids.includes(fileAction.linkDocId)) {
          document_ids.push(fileAction.linkDocId);
        }
      }

      // Update with final document IDs
      if (
        (fileAction?.newFiles && fileAction.newFiles.length > 0) ||
        fileAction?.linkDocId
      ) {
        await updateMedicalRecord(userId, savedRecord.id, {
          ...payload,
          document_ids,
          updated_at: new Date().toISOString(),
        });
      }

      // Fix linked_id for newly created/linked documents
      if (!existingRecord) {
        const allDocs = await fetchDocuments(userId);
        for (const doc of allDocs) {
          if (doc.domain === "medical" && doc.linked_id === "" && document_ids.includes(doc.id)) {
            await updateDocument(userId, doc.id, {
              ...doc,
              linked_id: savedRecord.id,
              updated_at: new Date().toISOString(),
            } as DocumentPlaintext);
          }
        }
      }
      if (existingRecord && fileAction?.linkDocId) {
        const linkDoc = freshDocs.find((d) => d.id === fileAction.linkDocId);
        if (linkDoc) {
          await updateDocument(userId, fileAction.linkDocId, {
            ...linkDoc,
            linked_id: existingRecord.id,
            updated_at: new Date().toISOString(),
          } as DocumentPlaintext);
        }
      }

      await refresh();
      return savedRecord;
    },
    [userId, refresh],
  );

  const handleDelete = useCallback(
    async (recordId: string, cascadeMode: "unlink" | "cascade" = "cascade") => {
      if (!userId) throw new Error("No active session.");

      const allDocs = await fetchDocuments(userId);
      const recordDocs = allDocs.filter(
        (d) => d.domain === "medical" && d.linked_id === recordId,
      );

      if (cascadeMode === "unlink") {
        const nowIso = new Date().toISOString();
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
            try { await deleteDocumentFile(userId, doc.file_name); } catch { /* best-effort */ }
          }
          try { await deleteDocument(doc.id); } catch { /* best-effort */ }
        }
      }

      await deleteMedicalRecord(recordId);
      await refresh();
    },
    [userId, refresh],
  );

  return { handleSave, handleDelete };
}
