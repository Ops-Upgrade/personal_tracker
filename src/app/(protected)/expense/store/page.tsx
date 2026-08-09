"use client";

import { useCallback } from "react";
import { ROUTES } from "@/routes/paths";
import {
  fetchExpenses,
  updateExpense,
  deleteExpense,
} from "@/api/expense";
import { fetchDocuments } from "@/api/common/documents";
import { useExpenseActions } from "@/hooks/useExpenseActions";
import type { Expense, ExpensePlaintext } from "@/types/expense";
import type { Document } from "@/types/document";
import GenericStorePage from "@/components/common/store/GenericStorePage";
import GenericDomainModal from "@/components/common/GenericDomainModal";
import { normalizeDateForInput } from "@/lib/utils";
import { EXPENSE_FIELDS } from "@/components/expense/config";

/**
 * Expense Receipt Store.
 * Uses GenericStorePage with expenses as parent records.
 *
 * Clicking a linked doc opens GenericDomainModal to edit the parent expense.
 * Standalone uploads and link/unlink are disabled — receipts are permanently
 * attached to their parent expense.
 */
export default function ExpenseStorePage() {
  // --- fetchData ---
  const fetchData = useCallback(async (userId: string) => {
    const [exps, docs] = await Promise.all([
      fetchExpenses(userId),
      fetchDocuments(userId),
    ]);
    return { domainRows: exps, documents: docs };
  }, []);

  // --- deriveParentRecords ---
  const deriveParentRecords = useCallback(
    (rows: Expense[]) =>
      rows.map((e) => ({
        id: e.id,
        name: `${e.item}${e.seller ? ` — ${e.seller}` : ""} (₹${e.cost.toLocaleString("en-IN")})`,
      })),
    [],
  );

  // --- onLinkedRecordClick ---
  const onLinkedRecordClick = useCallback(
    (docId: string, allDocuments: Document[], allRows: Expense[]) => {
      const doc = allDocuments.find((d) => d.id === docId);
      if (!doc?.linked_id) return null;
      return allRows.find((e) => e.id === doc.linked_id) ?? null;
    },
    [],
  );

  // --- Handlers ---

  const handleDeleteParent = useCallback(
    async (parentId: string, _userId: string, refreshAll: () => Promise<void>) => {
      await deleteExpense(parentId);
      await refreshAll();
    },
    [],
  );

  const handleDocumentSaved = useCallback(
    async (
      documentId: string,
      newLinkedId: string,
      oldLinkedId: string,
      userId: string,
      refreshAll: () => Promise<void>,
    ) => {
      if (oldLinkedId === newLinkedId) {
        await refreshAll();
        return;
      }

      const exps = await fetchExpenses(userId);

      if (oldLinkedId) {
        const oldExp = exps.find((e) => e.id === oldLinkedId);
        if (oldExp) {
          const newDocIds = (oldExp.document_ids ?? []).filter((id) => id !== documentId);
          await updateExpense(userId, oldLinkedId, {
            ...oldExp,
            document_ids: newDocIds,
            updated_at: new Date().toISOString(),
          } as ExpensePlaintext);
        }
      }

      if (newLinkedId) {
        const newExp = exps.find((e) => e.id === newLinkedId);
        if (newExp) {
          const merged = [...new Set([...(newExp.document_ids ?? []), documentId])];
          await updateExpense(userId, newLinkedId, {
            ...newExp,
            document_ids: merged,
            updated_at: new Date().toISOString(),
          } as ExpensePlaintext);
        }
      }

      await refreshAll();
    },
    [],
  );

  // --- modalSlot ---
  const modalSlot = useCallback(
    ({
      linkedRecord,
      allDocuments,
      userId,
      refreshAll,
      onClose,
    }: {
      linkedRecord: Expense;
      allRows: Expense[];
      allDocuments: Document[];
      userId: string;
      refreshAll: () => Promise<void>;
      onClose: () => void;
    }) => (
      <ExpenseStoreModal
        expense={linkedRecord}
        documents={allDocuments}
        userId={userId}
        refreshAll={refreshAll}
        onClose={onClose}
      />
    ),
    [],
  );

  return (
    <GenericStorePage
      domain="expense"
      title="Receipt Store"
      description="View all uploaded receipts across all your expenses."
      backHref={ROUTES.EXPENSE}
      fetchData={fetchData}
      deriveParentRecords={deriveParentRecords}
      onLinkedRecordClick={onLinkedRecordClick}
      modalSlot={modalSlot}
      onDeleteParentRecord={handleDeleteParent}
      onDocumentSaved={handleDocumentSaved}
      hideParentRecordsList
      disableAdd
    />
  );
}

// --- Expense store modal (hook bridge — calls useExpenseActions) ---

function ExpenseStoreModal({
  expense,
  documents,
  userId,
  refreshAll,
  onClose,
}: {
  expense: Expense;
  documents: Document[];
  userId: string;
  refreshAll: () => Promise<void>;
  onClose: () => void;
}) {
  const { createSaveAdapter, handleExpenseDelete, handleDownloadDocument } =
    useExpenseActions({ userId, refresh: refreshAll });

  return (
    <GenericDomainModal
      mode="record"
      title="Edit expense"
      onClose={onClose}
      fields={EXPENSE_FIELDS}
      initialData={{
        item: expense.item,
        seller: expense.seller,
        cost: String(expense.cost),
        date: normalizeDateForInput(expense.date),
        reason: expense.reason,
      }}
      allowFiles
      allowLinking={false}
      userId={userId}
      attachedDocuments={documents.filter(
        (d) => d.domain === "expense" && d.linked_id === expense.id,
      )}
      domain="expense"
      onSave={createSaveAdapter(expense)}
      onDeleteWithCascade={async (cascadeMode) => {
        await handleExpenseDelete(expense.id, cascadeMode);
      }}
      deleteLabel="Delete"
      onDownloadDocument={handleDownloadDocument}
    />
  );
}
