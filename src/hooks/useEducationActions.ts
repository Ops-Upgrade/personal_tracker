"use client";

import { useCallback } from "react";
import type { Education } from "@/types/education";
import type { Document, DocumentPlaintext } from "@/types/document";
import type { Priority } from "@/types/common";
import { fetchEducations, createEducation, updateEducation, deleteEducation } from "@/api/education";
import { fetchDocuments, createDocument, updateDocument, deleteDocument } from "@/api/common/documents";
import { uploadDocumentFile, downloadDocumentFile, deleteDocumentFile } from "@/api/common/documentStorage";
import type { FileActions } from "@/components/common/GenericDomainModal";

interface UseEducationActionsParams {
  userId: string | null;
  refresh: () => Promise<void>;
}

/**
 * Shared hook for Education CRUD + document linking operations.
 * Consolidates ~90 lines of duplicated handleEducationSave/handleEducationDelete
 * from EducationView, education/all, and education/completed pages.
 * Pattern matches useExpenseActions.ts and useNoteActions.ts.
 */
export function useEducationActions({ userId, refresh }: UseEducationActionsParams) {
  const handleEducationSave = useCallback(
    async (
      draft: {
        name: string;
        provider: string;
        priority: Priority;
        due_date: string | null;
        description: string;
        is_completed: boolean;
      },
      existingEducation: Education | null,
      pendingDoc?: { file: File; label: string },
      pendingLinkDocId?: string,
      pendingUnlinkDocIds?: string[],
      pendingDeleteDocIds?: string[],
    ) => {
      if (!userId) throw new Error("No active session.");

      const freshEdus = await fetchEducations(userId);
      const freshDocs = await fetchDocuments(userId);
      const freshEdu = existingEducation ? freshEdus.find(e => e.id === existingEducation.id) : null;

      let currentDocIds = [...(freshEdu?.document_ids ?? [])];

      const nowIso = new Date().toISOString();
      const completedAt = draft.is_completed
        ? freshEdu?.completed_at ?? nowIso
        : null;

      // Process unlinks
      if (pendingUnlinkDocIds && pendingUnlinkDocIds.length > 0 && existingEducation) {
        for (const docId of pendingUnlinkDocIds) {
          const doc = freshDocs.find(d => d.id === docId);
          if (doc) {
            await updateDocument(userId, docId, {
              ...doc,
              linked_id: "",
              updated_at: nowIso,
            } as DocumentPlaintext);
          }
          currentDocIds = currentDocIds.filter(id => id !== docId);
        }
      }

      // Process deletions
      if (pendingDeleteDocIds && pendingDeleteDocIds.length > 0) {
        for (const docId of pendingDeleteDocIds) {
          const doc = freshDocs.find(d => d.id === docId);
          if (doc) {
            currentDocIds = currentDocIds.filter(id => id !== docId);
            if (doc.file_name) {
              try { await deleteDocumentFile(userId, doc.file_name); } catch { /* best-effort */ }
            }
            await deleteDocument(docId);
          }
        }
      }

      const payload = {
        ...draft,
        completed_at: completedAt,
        document_ids: currentDocIds,
        updated_at: nowIso,
      };

      let savedEdu: Education;
      if (existingEducation) {
        savedEdu = await updateEducation(userId, existingEducation.id, payload);
      } else {
        savedEdu = await createEducation(userId, payload);
      }

      let needsUpdate = false;
      const newDocIds = [...currentDocIds];

      // Handle new file upload
      if (pendingDoc) {
        const { fileName, iv, mimeType } = await uploadDocumentFile(userId, pendingDoc.file);
        const doc = await createDocument(userId, {
          label: pendingDoc.label,
          file_name: fileName,
          file_iv: iv,
          file_mime: mimeType,
          domain: "education",
          linked_id: savedEdu.id,
          updated_at: nowIso,
        });
        newDocIds.push(doc.id);
        needsUpdate = true;
      }

      // Handle linking existing document
      if (pendingLinkDocId) {
        const pdoc = freshDocs.find(d => d.id === pendingLinkDocId);
        if (pdoc) {
          await updateDocument(userId, pendingLinkDocId, {
            ...pdoc,
            linked_id: savedEdu.id,
            updated_at: nowIso,
          } as DocumentPlaintext);
          if (!newDocIds.includes(pendingLinkDocId)) {
            newDocIds.push(pendingLinkDocId);
          }
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        await updateEducation(userId, savedEdu.id, {
          ...payload,
          document_ids: newDocIds,
          updated_at: new Date().toISOString(),
        });
      }

      await refresh();
      return savedEdu;
    },
    [userId, refresh],
  );

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

  /** Schema-driven save adapter: (formData, fileActions) → handleEducationSave */
  const createSaveAdapter = useCallback(
    (existingEducation: Education | null, onSuccess?: (saved: Education) => void) => {
      return async (formData: Record<string, unknown>, fileActions: FileActions) => {
        const draft = {
          name: (formData.name as string) ?? "",
          provider: (formData.provider as string) ?? "",
          priority: (formData.priority as Priority) ?? "medium",
          due_date: (formData.due_date as string) || null,
          description: (formData.description as string) ?? "",
          is_completed: Boolean(formData.is_completed),
        };

        const firstNewFile = fileActions.newFiles[0];
        const pendingDoc = firstNewFile
          ? { file: firstNewFile.file, label: firstNewFile.label }
          : undefined;

        const saved = await handleEducationSave(
          draft,
          existingEducation,
          pendingDoc,
          fileActions.docsToLink[0] || undefined,
          fileActions.docsToUnlink.length > 0 ? fileActions.docsToUnlink : undefined,
          fileActions.docsToDelete.length > 0 ? fileActions.docsToDelete : undefined,
        );

        onSuccess?.(saved);
      };
    },
    [handleEducationSave],
  );

  return { handleEducationSave, handleEducationDelete, handleDownloadDocument, createSaveAdapter, handleToggleComplete };
}
