"use client";

import { useCallback } from "react";
import type { Document, DocumentPlaintext } from "@/types/document";
import { deleteExpense } from "@/api/expense";
import { fetchDocuments, updateDocument, deleteDocument } from "@/api/common/documents";
import { downloadDocumentFile, deleteDocumentFile } from "@/api/common/documentStorage";

interface UseExpenseActionsParams {
  userId: string | null;
  refresh: () => Promise<void>;
}

/**
 * Shared hook for Expense delete + document download operations.
 * Expense create/edit (including file staging) is owned by GenericDomainModal's
 * expense domain config (see modalDomainConfig.ts).
 */
export function useExpenseActions({ userId, refresh }: UseExpenseActionsParams) {
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

  return { handleExpenseDelete, handleDownloadDocument };
}
