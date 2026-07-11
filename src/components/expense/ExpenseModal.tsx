"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import type { Expense } from "@/types/expense";
import ConfirmDialog from "@/components/taskmanager/ConfirmDialog";
import GlobalActionModal from "@/components/common/GlobalActionModal";
import type { ModalFile } from "@/components/common/GlobalActionModal";
import { InputField } from "@/components/common/FormField";
import ErrorBanner from "@/components/common/ErrorBanner";

// --- Types ---

type InvoiceAction = "keep" | "replace" | "remove";

interface ExpenseModalProps {
  expense: Expense | null; // null = create mode
  defaultDate?: string; // pre-fill date for create (YYYY-MM-DD)
  userId: string;
  isSaving?: boolean;
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
    existingExpense: Expense | null,
    fileAction: { action: "upload" | "remove" | "keep"; file?: File }
  ) => Promise<void>;
  onDelete: (expenseId: string) => Promise<void>;
  zClassName?: string;
}

// ============================================================
// Main Modal
// ============================================================

export default function ExpenseModal({
  expense,
  defaultDate,
  userId,
  isSaving,
  onClose,
  onSave,
  onDelete,
  zClassName,
}: ExpenseModalProps) {
  // --- Form state ---
  const [item, setItem] = useState("");
  const [seller, setSeller] = useState("");
  const [cost, setCost] = useState("");
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [invoice, setInvoice] = useState("");
  const [error, setError] = useState<string | null>(null);

  // --- Invoice file state ---
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [invoiceAction, setInvoiceAction] = useState<InvoiceAction>("keep");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // Explicit file selection — null = list view, set = preview (Task 1.5)
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  const isEditing = Boolean(expense);

  // ── Baseline: computed once, used by both reset AND dirty check ──
  const baseline = useMemo(() => ({
    item: expense?.item ?? "",
    seller: expense?.seller ?? "",
    cost: expense?.cost != null ? String(expense.cost) : "",
    date: expense?.date ?? defaultDate ?? "",
    reason: expense?.reason ?? "",
    invoice: expense?.invoice ?? "",
  }), [expense, defaultDate]);

  // Reset form to baseline whenever the record changes
  useEffect(() => {
    setItem(baseline.item);
    setSeller(baseline.seller);
    setCost(baseline.cost);
    setDate(baseline.date);
    setReason(baseline.reason);
    setInvoice(baseline.invoice);
    setInvoiceFile(null);
    setInvoiceAction("keep");
    setError(null);
    setShowDeleteConfirm(false);
    // Auto-select existing file (already saved), null for new uploads
    setSelectedFileId(expense?.invoice_file ? (expense.id ?? null) : null);
  }, [baseline, expense?.id, expense?.invoice_file]);

  // --- Derived ---
  const existingInvoiceFile = expense?.invoice_file ?? "";
  const existingInvoiceMime = expense?.invoice_mime ?? "";
  const existingInvoiceIv = expense?.invoice_iv ?? "";
  const hasExistingFile = existingInvoiceFile !== "";

  // Dirty check: compare current state against the same baseline object
  const isDirty =
    item !== baseline.item ||
    seller !== baseline.seller ||
    cost !== baseline.cost ||
    date !== baseline.date ||
    reason !== baseline.reason ||
    invoice !== baseline.invoice ||
    invoiceAction !== "keep" ||
    invoiceFile !== null;

  // --- Build files array for GlobalActionModal ---

  const expenseFileId = expense?.id ?? "new-expense-invoice";

  const files: ModalFile[] = [];
  if (invoiceFile) {
    files.push({
      id: expenseFileId,
      name: invoiceFile.name,
      mime: invoiceFile.type,
      file: invoiceFile,
      isNew: true,
    });
  } else if (hasExistingFile && invoiceAction !== "remove") {
    files.push({
      id: expenseFileId,
      name: existingInvoiceFile,
      mime: existingInvoiceMime,
      iv: existingInvoiceIv,
    });
  }

  // --- File handlers ---

  const handleFileUpload = useCallback((file: File) => {
    setInvoiceFile(file);
    setInvoiceAction("replace");
    // Don't auto-select — queue first, preview on click (Task 1.5)
    setSelectedFileId(null);
  }, []);

  const handleFileDelete = useCallback(() => {
    if (invoiceFile) {
      setInvoiceFile(null);
      setInvoiceAction("keep");
    } else if (hasExistingFile) {
      setInvoiceAction("remove");
    }
  }, [invoiceFile, hasExistingFile]);

  const handleFileDownload = useCallback(async () => {
    if (!existingInvoiceFile || !existingInvoiceIv) return;
    try {
      const { downloadInvoice } = await import(
        "@/api/expense/invoiceStorage"
      );
      const blob = await downloadInvoice(
        userId,
        existingInvoiceFile,
        existingInvoiceIv,
        existingInvoiceMime
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = existingInvoiceFile.replace(/\.enc$/, "");
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to download invoice.";
      alert(message);
    }
  }, [
    existingInvoiceFile,
    existingInvoiceIv,
    existingInvoiceMime,
    userId,
  ]);

  const handleLoadPreview = useCallback(async () => {
    const { downloadInvoice } = await import("@/api/expense/invoiceStorage");
    return downloadInvoice(userId, existingInvoiceFile, existingInvoiceIv, existingInvoiceMime);
  }, [userId, existingInvoiceFile, existingInvoiceIv, existingInvoiceMime]);

  // --- Save handler ---

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

    setError(null);

    try {
      const fileAction: {
        action: "upload" | "remove" | "keep";
        file?: File;
      } =
        invoiceAction === "replace" && invoiceFile
          ? { action: "upload", file: invoiceFile }
          : invoiceAction === "remove"
            ? { action: "remove" }
            : { action: "keep" };

      await onSave(
        {
          item: item.trim(),
          seller: seller.trim(),
          cost: parsedCost,
          date,
          reason: reason.trim(),
          invoice: invoice.trim(),
        },
        expense,
        fileAction
      );
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save expense."
      );
    }
  }

  // --- Delete handler ---

  async function handleDelete() {
    if (!expense) return;
    setShowDeleteConfirm(true);
  }

  async function confirmDelete() {
    if (!expense) return;
    try {
      await onDelete(expense.id);
      setShowDeleteConfirm(false);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete expense."
      );
    }
  }

  // --- Render ---

  return (
    <>
      <GlobalActionModal
        title={isEditing ? "Edit expense" : "Add expense"}
        onClose={onClose}
        isDirty={isDirty}
        files={files}
        selectedFileId={selectedFileId}
        onSelectFile={(id) => setSelectedFileId(id)}
        onFileUpload={handleFileUpload}
        onFileDownload={hasExistingFile ? handleFileDownload : undefined}
        onFileDelete={hasExistingFile || invoiceFile ? handleFileDelete : undefined}
        onLoadPreview={
          hasExistingFile && invoiceAction !== "remove" && !invoiceFile
            ? handleLoadPreview
            : undefined
        }
        onSave={handleSave}
        isSaving={isSaving}
        onDelete={isEditing ? handleDelete : undefined}
        deleteLabel="Delete"
        zClassName={zClassName}
      >
        <div className="space-y-3">
          <InputField label="Item" value={item} onChange={setItem} disabled={isSaving} />
          <InputField label="Seller" value={seller} onChange={setSeller} disabled={isSaving} />

          <div className="grid gap-3 sm:grid-cols-2">
            <InputField label="Cost (₹)" type="number" min="0" step="0.01" value={cost} onChange={setCost} disabled={isSaving} />
            <InputField label="Date" type="date" value={date} onChange={setDate} disabled={isSaving} />
          </div>

          <InputField label="Reason" value={reason} onChange={setReason} disabled={isSaving} placeholder="Why did you buy this?" />

          {error && <ErrorBanner message={error} />}
        </div>
      </GlobalActionModal>

      {/* Delete confirmation */}
      {showDeleteConfirm && expense && (
        <ConfirmDialog
          title="Delete expense?"
          description="This action cannot be undone. The expense and its attached invoice file (if any) will be permanently removed."
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={confirmDelete}
        />
      )}
    </>
  );
}
