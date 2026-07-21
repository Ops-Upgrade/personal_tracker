"use client";

import { useCallback } from "react";
import type { Expense, ExpensePlaintext } from "@/types/expense";
import type { Document, DocumentPlaintext } from "@/types/document";
import { fetchExpenses, createExpense, updateExpense, deleteExpense } from "@/api/expense";
import { fetchDocuments, createDocument, updateDocument, deleteDocument } from "@/api/common/documents";
import { uploadDocumentFile, downloadDocumentFile, deleteDocumentFile } from "@/api/common/documentStorage";

interface UseExpenseActionsParams {
  userId: string | null;
  refresh: () => Promise<void>;
}

/**
 * Shared hook for Expense CRUD + document linking operations.
 * Used by ExpenseView and ExpenseStorePage to avoid duplicating
 * the same complex save/delete/download logic.
 */
export function useExpenseActions({ userId, refresh }: UseExpenseActionsParams) {
  const handleExpenseSave = useCallback(
    async (
      draft: { item: string; seller: string; cost: number; date: string; reason: string },
      existingExpense: Expense | null,
      pendingDoc?: { file: File; label: string },
      pendingLinkDocId?: string,
      pendingUnlinkDocIds?: string[],
      pendingDeleteDocIds?: string[],
    ) => {
      if (!userId) throw new Error("No active session.");
      const freshExpenses = await fetchExpenses(userId);
      const freshDocs = await fetchDocuments(userId);
      const freshExpense = existingExpense
        ? freshExpenses.find((e) => e.id === existingExpense.id)
        : null;
      let currentDocIds = [...(freshExpense?.document_ids ?? [])];
      const nowIso = new Date().toISOString();

      // Process unlinks
      if (pendingUnlinkDocIds && pendingUnlinkDocIds.length > 0 && existingExpense) {
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

      const payload: ExpensePlaintext = {
        ...draft,
        document_ids: currentDocIds,
        updated_at: nowIso,
      };

      let savedExpense: Expense;
      if (existingExpense) {
        savedExpense = await updateExpense(userId, existingExpense.id, payload);
      } else {
        savedExpense = await createExpense(userId, payload);
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
          domain: "expense",
          linked_id: savedExpense.id,
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
            linked_id: savedExpense.id,
            updated_at: nowIso,
          } as DocumentPlaintext);
          if (!newDocIds.includes(pendingLinkDocId)) newDocIds.push(pendingLinkDocId);
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        await updateExpense(userId, savedExpense.id, {
          ...payload,
          document_ids: newDocIds,
          updated_at: new Date().toISOString(),
        });
      }

      await refresh();
    },
    [userId, refresh],
  );

  const handleExpenseDelete = useCallback(
    async (expenseId: string, cascadeMode: "unlink" | "cascade") => {
      if (!userId) throw new Error("No active session.");
      const allDocs = await fetchDocuments(userId);
      const expenseDocs = allDocs.filter(
        (d) => d.domain === "expense" && d.linked_id === expenseId,
      );
      if (cascadeMode === "unlink") {
        const nowIso = new Date().toISOString();
        for (const doc of expenseDocs) {
          await updateDocument(userId, doc.id, {
            ...doc,
            linked_id: "",
            updated_at: nowIso,
          } as DocumentPlaintext);
        }
      } else {
        for (const doc of expenseDocs) {
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
      await deleteExpense(expenseId);
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

  return { handleExpenseSave, handleExpenseDelete, handleDownloadDocument };
}
