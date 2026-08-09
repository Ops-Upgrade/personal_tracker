"use client";

import { useCallback } from "react";
import type { Note } from "@/types/taskmanager";
import type { Document, DocumentPlaintext } from "@/types/document";
import { fetchNotes, createNote, updateNote, deleteNote } from "@/api/taskmanager";
import { fetchDocuments, createDocument, updateDocument, deleteDocument } from "@/api/common/documents";
import { uploadDocumentFile, downloadDocumentFile, deleteDocumentFile } from "@/api/common/documentStorage";
import type { FileActions } from "@/components/common/GenericDomainModal";

interface UseNoteActionsParams {
  userId: string | null;
  refresh: () => Promise<void>;
}

/**
 * Shared hook for Note CRUD + document linking operations.
 * Used by TaskManagerView, NotesPage, and TaskManagerStorePage to avoid
 * duplicating the same complex save/delete/download logic.
 */
export function useNoteActions({ userId, refresh }: UseNoteActionsParams) {
  const handleNoteSave = useCallback(
    async (
      draft: { name: string; content: string },
      existingNote: Note | null,
      pendingDoc?: { file: File; label: string },
      pendingLinkDocId?: string,
      pendingUnlinkDocIds?: string[],
      pendingDeleteDocIds?: string[],
    ) => {
      if (!userId) throw new Error("No active session.");
      const freshNotes = await fetchNotes(userId);
      const freshDocs = await fetchDocuments(userId);
      const freshNote = existingNote
        ? freshNotes.find((n) => n.id === existingNote.id)
        : null;
      let currentDocIds = [...(freshNote?.document_ids ?? [])];
      const nowIso = new Date().toISOString();

      // Process unlinks
      if (pendingUnlinkDocIds && pendingUnlinkDocIds.length > 0 && existingNote) {
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
              try {
                await deleteDocumentFile(userId, doc.file_name);
              } catch {
                /* best-effort */
              }
            }
            await deleteDocument(docId);
          }
        }
      }

      const payload = { ...draft, document_ids: currentDocIds, updated_at: nowIso };
      let savedNote: Note;
      if (existingNote) {
        savedNote = await updateNote(userId, existingNote.id, payload);
      } else {
        savedNote = await createNote(userId, payload);
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
          domain: "taskmanager",
          linked_id: savedNote.id,
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
            linked_id: savedNote.id,
            updated_at: nowIso,
          } as DocumentPlaintext);
          if (!newDocIds.includes(pendingLinkDocId)) newDocIds.push(pendingLinkDocId);
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        await updateNote(userId, savedNote.id, {
          ...payload,
          document_ids: newDocIds,
          updated_at: new Date().toISOString(),
        });
      }

      await refresh();
      return savedNote;
    },
    [userId, refresh],
  );

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
              await deleteDocumentFile(userId, doc.file_name);
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

  /** Schema-driven save adapter: (formData, fileActions) → handleNoteSave */
  const createSaveAdapter = useCallback(
    (existingNote: Note | null, onSuccess?: (saved: Note) => void) => {
      return async (formData: Record<string, unknown>, fileActions: FileActions) => {
        const name = (formData.name as string).trim();
        if (!name) throw new Error("Note name is required.");
        const content = (formData.content as string).trim();

        const firstNewFile = fileActions.newFiles[0];
        const pendingDoc = firstNewFile
          ? { file: firstNewFile.file, label: firstNewFile.label }
          : undefined;

        const saved = await handleNoteSave(
          { name, content },
          existingNote,
          pendingDoc,
          fileActions.docsToLink[0] || undefined,
          fileActions.docsToUnlink.length > 0 ? fileActions.docsToUnlink : undefined,
          fileActions.docsToDelete.length > 0 ? fileActions.docsToDelete : undefined,
        );

        onSuccess?.(saved);
      };
    },
    [handleNoteSave],
  );

  return { handleNoteSave, handleNoteDelete, handleDownloadDocument, createSaveAdapter };
}
