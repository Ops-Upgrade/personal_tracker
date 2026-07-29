"use client";

import { useCallback, useEffect, useState } from "react";
import { ROUTES } from "@/routes/paths";
import { getSession } from "@/api/auth";
import {
  fetchExpenses,
  updateExpense,
  deleteExpense,
} from "@/api/expense";
import {
  fetchDocuments,
} from "@/api/common/documents";
import type { Expense, ExpensePlaintext } from "@/types/expense";
import type { Document } from "@/types/document";
import { useExpenseActions } from "@/hooks/useExpenseActions";
import GlobalStoreView from "@/components/common/store/GlobalStoreView";
import ExpenseModal from "@/components/expense/ExpenseModal";

/**
 * Expense Receipt Store.
 * Uses GlobalStoreView with expenses as parent records.
 *
 * View-and-manage hub for receipts uploaded directly to expenses.
 * Standalone uploads and link/unlink operations are disabled —
 * receipts are permanently attached to their parent expense.
 * Clicking a linked doc opens ExpenseModal to edit the parent expense.
 */
export default function ExpenseStorePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [parentRecords, setParentRecords] = useState<{ id: string; name: string }[]>([]);
  const [allDocuments, setAllDocuments] = useState<Document[]>([]);

  // Inline modal state: linked document → open ExpenseModal for parent record
  const [linkedRecord, setLinkedRecord] = useState<Expense | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // --- Auth + data loading ---
  useEffect(() => {
    const init = async () => {
      const session = await getSession();
      if (session?.user.id) setUserId(session.user.id);
    };
    init();
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const load = async () => {
      const [exps, docs] = await Promise.all([
        fetchExpenses(userId),
        fetchDocuments(userId),
      ]);
      if (!cancelled) {
        setAllExpenses(exps);
        setAllDocuments(docs);
        setParentRecords(
          exps.map((e) => ({
            id: e.id,
            name: `${e.item}${e.seller ? ` — ${e.seller}` : ""} (₹${e.cost.toLocaleString("en-IN")})`,
          }))
        );
      }
    };
    load();
    return () => { cancelled = true; };
  }, [userId]);

  const refreshAll = useCallback(async () => {
    if (!userId) return;
    const [exps, docs] = await Promise.all([
      fetchExpenses(userId),
      fetchDocuments(userId),
    ]);
    setAllExpenses(exps);
    setAllDocuments(docs);
    setParentRecords(
      exps.map((e) => ({
        id: e.id,
        name: `${e.item}${e.seller ? ` — ${e.seller}` : ""} (₹${e.cost.toLocaleString("en-IN")})`,
      }))
    );
    setRefreshTrigger((prev) => prev + 1);
  }, [userId]);

  // --- Action click: linked doc → open ExpenseModal inline for parent ---
  const handleActionClick = useCallback(
    (docId: string) => {
      const doc = allDocuments.find((d) => d.id === docId);
      if (!doc?.linked_id) return false;
      const record = allExpenses.find((e) => e.id === doc.linked_id);
      if (record) {
        setLinkedRecord(record);
        return true; // Handled
      }
      return false; // Not handled
    },
    [allDocuments, allExpenses],
  );

  const closeLinkedRecord = useCallback(() => {
    setLinkedRecord(null);
    refreshAll();
  }, [refreshAll]);

  // --- Parent CRUD handlers ---
  const handleDeleteParent = useCallback(
    async (parentId: string) => {
      if (!userId) return;
      await deleteExpense(parentId);
      await refreshAll();
    },
    [userId, refreshAll],
  );

  // --- onDocumentSaved: sync parent expense document_ids after store-modal save ---
  const handleDocumentSaved = useCallback(
    async (documentId: string, newLinkedId: string, oldLinkedId: string) => {
      if (!userId) return;
      if (oldLinkedId === newLinkedId) {
        await refreshAll();
        return;
      }

      const exps = await fetchExpenses(userId);

      // Remove from old parent
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

      // Add to new parent
      if (newLinkedId) {
        const newExp = exps.find((e) => e.id === newLinkedId);
        if (newExp) {
          const merged = [...new Set([...(newExp.document_ids ?? []), documentId])];
          await updateExpense(userId, newLinkedId, {
            ...newExp,
            document_ids: merged,
            updated_at: new Date().toISOString(),
          } as ExpensePlaintext);
          setLinkedRecord(newExp);
        }
      }

      await refreshAll();
    },
    [userId, refreshAll],
  );

  const { handleExpenseSave, handleExpenseDelete, handleDownloadDocument } =
    useExpenseActions({ userId, refresh: refreshAll });

  return (
    <>
      <GlobalStoreView
        domain="expense"
        title="Receipt Store"
        description="View all uploaded receipts across all your expenses."
        backHref={ROUTES.EXPENSE}
        parentRecords={parentRecords}
        onDeleteParentRecord={handleDeleteParent}
        onActionClick={handleActionClick}
        hideParentRecordsList={true}
        onDocumentSaved={handleDocumentSaved}
        refreshTrigger={refreshTrigger}
        disableAdd={true}
      />

      {/* ExpenseModal for linked record editing */}
      {linkedRecord && userId && (
        <ExpenseModal
          expense={linkedRecord}
          documents={allDocuments}
          userId={userId}
          onClose={closeLinkedRecord}
          onSave={handleExpenseSave}
          onDelete={handleExpenseDelete}
          onDownloadDocument={handleDownloadDocument}
        />
      )}
    </>
  );
}
