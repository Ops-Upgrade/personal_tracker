"use client";

import { useEffect, useState } from "react";
import type { Expense } from "@/types/expense";
import ModalFrame from "@/components/taskmanager/ModalFrame";
import ConfirmDialog from "@/components/taskmanager/ConfirmDialog";

interface ExpenseModalProps {
  expense: Expense | null; // null = create mode
  defaultDate?: string; // pre-fill date for create (YYYY-MM-DD)
  onClose: () => void;
  onSave: (
    draft: {
      item: string;
      seller: string;
      cost: number;
      date: string;
      reason: string;
      invoice: string;
    },
    existingExpense: Expense | null
  ) => Promise<void>;
  onDelete: (expenseId: string) => Promise<void>;
}

/**
 * Shared create/edit modal for a single expense item.
 * F2.5 (create mode) + F2.6 (edit mode).
 */
export default function ExpenseModal({
  expense,
  defaultDate,
  onClose,
  onSave,
  onDelete,
}: ExpenseModalProps) {
  const [item, setItem] = useState("");
  const [seller, setSeller] = useState("");
  const [cost, setCost] = useState("");
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [invoice, setInvoice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItem(expense?.item ?? "");
    setSeller(expense?.seller ?? "");
    setCost(expense?.cost != null ? String(expense.cost) : "");
    setDate(expense?.date ?? defaultDate ?? "");
    setReason(expense?.reason ?? "");
    setInvoice(expense?.invoice ?? "");
    setError(null);
    setShowDeleteConfirm(false);
  }, [expense, defaultDate]);

  async function handleSave() {
    if (!item.trim()) {
      setError("Item name is required.");
      return;
    }
    const parsedCost = parseFloat(cost);
    if (isNaN(parsedCost) || parsedCost < 0) {
      setError("Please enter a valid cost.");
      return;
    }
    if (!date) {
      setError("Date is required.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(
        {
          item: item.trim(),
          seller: seller.trim(),
          cost: parsedCost,
          date,
          reason: reason.trim(),
          invoice: invoice.trim(),
        },
        expense
      );
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save expense."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!expense) return;
    setIsSaving(true);
    setError(null);
    try {
      await onDelete(expense.id);
      setShowDeleteConfirm(false);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete expense."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <ModalFrame
        title={expense ? "Edit expense" : "Add expense"}
        onClose={onClose}
      >
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Item
            </span>
            <input
              type="text"
              value={item}
              onChange={(e) => setItem(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Seller
            </span>
            <input
              type="text"
              value={seller}
              onChange={(e) => setSeller(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Cost (₹)
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Date
              </span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Reason
            </span>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Invoice
            </span>
            <input
              type="text"
              value={invoice}
              onChange={(e) => setInvoice(e.target.value)}
              placeholder="Receipt code, URL, or note"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            {expense && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isSaving}
                className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"
              >
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Save
            </button>
          </div>
        </div>
      </ModalFrame>

      {showDeleteConfirm && expense && (
        <ConfirmDialog
          title="Delete expense?"
          description="Are you sure? This cannot be undone."
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
        />
      )}
    </>
  );
}
