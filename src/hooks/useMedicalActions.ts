"use client";

import { useCallback } from "react";
import { fetchDocuments, deleteDocument } from "@/api/common/documents";
import { deleteDocumentFile } from "@/api/common/documentStorage";
import { deleteMedicalRecord } from "@/api/medical";

interface UseMedicalActionsParams {
  userId: string | null;
  refresh: () => Promise<void>;
}

/**
 * Shared hook for Medical Record deletion.
 * Medical record create/edit (including file staging) is owned by
 * GenericDomainModal's medical domain config (see modalDomainConfig.ts).
 */
export function useMedicalActions({ userId, refresh }: UseMedicalActionsParams) {
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

  return { handleDelete };
}
