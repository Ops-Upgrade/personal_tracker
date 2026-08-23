"use client";

import { useCallback } from "react";
import type { Education } from "@/types/education";
import type { Document, DocumentPlaintext } from "@/types/document";
import { deleteEducation, updateEducation } from "@/api/education";
import { fetchDocuments, updateDocument, deleteDocument } from "@/api/common/documents";
import { downloadDocumentFile, deleteDocumentFile } from "@/api/common/documentStorage";

interface UseEducationActionsParams {
  userId: string | null;
  refresh: () => Promise<void>;
}

/**
 * Shared hook for Education delete, download, and quick-complete operations.
 * Education create/edit (including file staging) is owned by GenericDomainModal's
 * education domain config (see modalDomainConfig.ts).
 */
export function useEducationActions({ userId, refresh }: UseEducationActionsParams) {
  const handleEducationDelete = useCallback(
    async (educationId: string, cascadeMode: 'unlink' | 'cascade' = 'cascade') => {
      if (!userId) throw new Error("No active session.");

      const allDocs = await fetchDocuments(userId);
      const eduDocs = allDocs.filter(
        (d) => d.domain === "education" && d.linked_id === educationId,
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

  /** Toggle is_completed on an education (used for Quick Complete). */
  const handleToggleComplete = useCallback(
    async (edu: Education, isCompleted: boolean) => {
      if (!userId) throw new Error("No active session.");
      const nowIso = new Date().toISOString();
      await updateEducation(userId, edu.id, {
        ...edu,
        is_completed: isCompleted,
        completed_at: isCompleted ? nowIso : null,
        updated_at: nowIso,
      });
      await refresh();
    },
    [userId, refresh],
  );

  return { handleEducationDelete, handleDownloadDocument, handleToggleComplete };
}
