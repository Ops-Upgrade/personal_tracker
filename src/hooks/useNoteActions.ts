"use client";

import { useCallback } from "react";
import type { Document, DocumentPlaintext } from "@/types/document";
import { deleteNote } from "@/api/taskmanager";
import { fetchDocuments, updateDocument, deleteDocument } from "@/api/common/documents";
import { downloadFile, deleteFile } from "@/api/common/encryptedFileStorage";

interface UseNoteActionsParams {
  userId: string | null;
  refresh: () => Promise<void>;
}

/**
 * Shared hook for Note delete + document download operations.
 * Note create/edit (including file staging) is owned by GenericDomainModal's
 * taskmanager_notes domain config (see modalDomainConfig.ts).
 */
export function useNoteActions({ userId, refresh }: UseNoteActionsParams) {
  const handleNoteDelete = useCallback(
    async (noteId: string, cascadeMode: "unlink" | "cascade") => {
      if (!userId) throw new Error("No active session.");
      const allDocs = await fetchDocuments(userId);
      const noteDocs = allDocs.filter(
        (d) => d.domain === "taskmanager" && d.linked_id === noteId,
      );
      if (cascadeMode === "unlink") {
        const nowIso = new Date().toISOString();
        for (const doc of noteDocs) {
          await updateDocument(userId, doc.id, {
            ...doc,
            linked_id: "",
            updated_at: nowIso,
          } as DocumentPlaintext);
        }
      } else {
        for (const doc of noteDocs) {
          if (doc.file_name) {
            try {
              await deleteFile(userId, doc.file_name);
            } catch {
              /* best-effort */
            }
          }
          await deleteDocument(doc.id);
        }
      }
      await deleteNote(noteId);
      await refresh();
    },
    [userId, refresh],
  );

  const handleDownloadDocument = useCallback(
    async (doc: Document) => {
      if (!userId) throw new Error("No active session.");
      const blob = await downloadFile(
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

  return { handleNoteDelete, handleDownloadDocument };
}
