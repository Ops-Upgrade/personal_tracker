"use client";

import { useEffect, useState, useCallback } from "react";
import type { Expense } from "@/types/expense";
import ModalFrame from "@/components/taskmanager/ModalFrame";
import ConfirmDialog from "@/components/taskmanager/ConfirmDialog";

// --- Inline SVG Icon Components (avoids ambiguous module resolution) ---

function XMarkIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

function ArrowDownTrayIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}

function EyeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );
}

function DocumentIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  );
}

function PhotoIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.41a2.25 2.25 0 0 1 3.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
  );
}

function LinkIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
    </svg>
  );
}

function ArrowPathIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m-8.331-8.331a.75.75 0 0 1 1.06 0l4.242 4.242a.75.75 0 0 1 0 1.06l-4.242 4.242a.75.75 0 0 1-1.06-1.06l2.97-2.97H5.25a.75.75 0 0 1 0-1.5h8.19l-2.97-2.97a.75.75 0 0 1 0-1.06Z" />
    </svg>
  );
}

function ExclamationTriangleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
  );
}

function ShieldExclamationIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.25-8.25-3.286Zm0 13.036h.008v.008H12v-.008Z" />
    </svg>
  );
}

function NoSymbolIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
  );
}

function DocumentTextIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  );
}

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
}

// --- Constants ---

const ALLOWED_EXTENSIONS = ".pdf,.jpg,.jpeg,.png,.webp";
const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];
const MAX_FILE_SIZE = 45 * 1024 * 1024; // 45 MiB

// --- Helpers ---

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================================
// Invoice Preview Modal (in-app)
// ============================================================

interface InvoicePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  previewUrl: string | null;
  previewError: string | null;
  isDownloading: boolean;
  mimeType: string;
  fileName: string;
}

function InvoicePreviewModal({
  isOpen,
  onClose,
  previewUrl,
  previewError,
  isDownloading,
  mimeType,
  fileName,
}: InvoicePreviewModalProps) {
  if (!isOpen) return null;

  const isPdf = mimeType === "application/pdf";
  const isImage = mimeType.startsWith("image/");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-200 truncate">
            Invoice Preview: {fileName}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-4">
          {isDownloading && (
            <div className="flex flex-col items-center gap-3 text-zinc-400">
              <ArrowPathIcon className="h-8 w-8 animate-spin" />
              <span className="text-sm">Decrypting invoice...</span>
            </div>
          )}

          {previewError && (
            <div className="flex flex-col items-center gap-3 text-red-400">
              <NoSymbolIcon className="h-8 w-8" />
              <span className="text-sm">{previewError}</span>
            </div>
          )}

          {previewUrl && isPdf && (
            <iframe
              src={previewUrl}
              className="w-full h-full min-h-[60vh] rounded-lg border border-zinc-700"
              title="Invoice PDF Preview"
            />
          )}

          {previewUrl && isImage && (
            <img
              src={previewUrl}
              alt="Invoice preview"
              className="max-w-full max-h-[75vh] object-contain rounded-lg"
            />
          )}

          {previewUrl && !isPdf && !isImage && (
            <div className="flex flex-col items-center gap-3 text-zinc-400">
              <DocumentIcon className="h-8 w-8" />
              <span className="text-sm">
                Preview not available for this file type.
              </span>
              <a
                href={previewUrl}
                download={fileName}
                className="text-sm text-emerald-400 hover:text-emerald-300 underline"
              >
                Download instead
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
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

  // --- Preview state ---
  const [isPreviewOpen, setPreviewOpen] = useState(false);
  const [isDownloading, setDownloading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const isEditing = Boolean(expense);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Reset form when modal opens / expense changes
  useEffect(() => {
    setItem(expense?.item ?? "");
    setSeller(expense?.seller ?? "");
    setCost(expense?.cost != null ? String(expense.cost) : "");
    setDate(expense?.date ?? defaultDate ?? "");
    setReason(expense?.reason ?? "");
    setInvoice(expense?.invoice ?? "");
    setInvoiceFile(null);
    setInvoiceAction("keep");
    setError(null);
    setShowDeleteConfirm(false);
  }, [expense, defaultDate]);

  // --- Derived ---

  const existingInvoiceFile = expense?.invoice_file ?? "";
  const existingInvoiceMime = expense?.invoice_mime ?? "";
  const existingInvoiceIv = expense?.invoice_iv ?? "";
  const hasExistingFile = existingInvoiceFile !== "";

  const displayFileName =
    invoiceFile?.name ||
    (hasExistingFile ? existingInvoiceFile : "");

  const fileMime = invoiceFile?.type || existingInvoiceMime || "";
  const isImageType = fileMime.startsWith("image/");
  const isPdfType = fileMime === "application/pdf";
  const FileIcon = isPdfType
    ? DocumentIcon
    : isImageType
      ? PhotoIcon
      : LinkIcon;

  // --- File handlers ---

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setInvoiceFile(file);
    if (file) setInvoiceAction("replace");
    e.target.value = "";
  };

  const handleRemoveFile = () => {
    setInvoiceFile(null);
    if (hasExistingFile) {
      setInvoiceAction("remove");
    } else {
      setInvoiceAction("keep");
    }
  };

  const handleView = useCallback(async () => {
    if (!existingInvoiceFile || !existingInvoiceIv) return;
    setPreviewOpen(true);
    setPreviewError(null);
    setDownloading(true);
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
      setPreviewUrl(url);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to decrypt invoice.";
      setPreviewError(message);
    } finally {
      setDownloading(false);
    }
  }, [
    existingInvoiceFile,
    existingInvoiceIv,
    existingInvoiceMime,
    userId,
  ]);

  const handleDownload = useCallback(async () => {
    if (!existingInvoiceFile || !existingInvoiceIv) return;
    setDownloading(true);
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
    } finally {
      setDownloading(false);
    }
  }, [
    existingInvoiceFile,
    existingInvoiceIv,
    existingInvoiceMime,
    userId,
  ]);

  // --- Save handler ---

  async function handleSave() {
    // Validate
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

    // Client-side file validation
    if (invoiceAction === "replace" && invoiceFile) {
      if (!ALLOWED_TYPES.includes(invoiceFile.type)) {
        setError("Unsupported file type. Allowed: PDF, JPEG, PNG, WEBP.");
        return;
      }
      if (invoiceFile.size > MAX_FILE_SIZE) {
        setError("File must be under 45 MB.");
        return;
      }
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
      <ModalFrame
        title={isEditing ? "Edit expense" : "Add expense"}
        onClose={onClose}
      >
        <div className="space-y-3">
          {/* Item */}
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Item
            </span>
            <input
              type="text"
              value={item}
              onChange={(e) => setItem(e.target.value)}
              disabled={isSaving}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 disabled:opacity-50"
            />
          </label>

          {/* Seller */}
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Seller
            </span>
            <input
              type="text"
              value={seller}
              onChange={(e) => setSeller(e.target.value)}
              disabled={isSaving}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 disabled:opacity-50"
            />
          </label>

          {/* Cost + Date */}
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
                disabled={isSaving}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 disabled:opacity-50"
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
                disabled={isSaving}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 disabled:opacity-50 [color-scheme:dark]"
              />
            </label>
          </div>

          {/* Reason */}
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Reason
            </span>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isSaving}
              placeholder="Why did you buy this?"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 disabled:opacity-50"
            />
          </label>

          {/* --- Invoice File Upload Zone --- */}
          <div className="space-y-2">
            <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              <DocumentTextIcon className="inline h-3.5 w-3.5 mr-1" />
              Invoice Attachment
            </span>

            {/* Existing file bar */}
            {hasExistingFile && invoiceAction !== "remove" && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/60">
                <div className="flex items-center gap-2 min-w-0">
                  <FileIcon className="h-4 w-4 shrink-0 text-zinc-400" />
                  <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate">
                    {displayFileName}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={handleView}
                    disabled={isSaving || isDownloading}
                    className="p-1 rounded-md text-zinc-400 hover:text-emerald-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-40"
                    title="View invoice"
                  >
                    <EyeIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={isSaving || isDownloading}
                    className="p-1 rounded-md text-zinc-400 hover:text-amber-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-40"
                    title="Download invoice"
                  >
                    <ArrowDownTrayIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    disabled={isSaving}
                    className="p-1 rounded-md text-zinc-400 hover:text-red-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-40"
                    title="Remove invoice"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* New file bar */}
            {invoiceFile && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 dark:border-emerald-800 dark:bg-emerald-900/20">
                <div className="flex items-center gap-2 min-w-0">
                  <FileIcon className="h-4 w-4 shrink-0 text-emerald-500" />
                  <div className="min-w-0">
                    <span className="text-sm text-emerald-700 dark:text-emerald-300 truncate block">
                      {invoiceFile.name}
                    </span>
                    <span className="text-xs text-emerald-500/70">
                      {formatBytes(invoiceFile.size)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  disabled={isSaving}
                  className="p-1 rounded-md text-emerald-500 hover:text-red-500 hover:bg-emerald-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-40"
                  title="Remove selected file"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Upload drop zone (only when no new file selected) */}
            {!invoiceFile && (
              <label
                className={`flex flex-col items-center justify-center gap-1 p-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors
                  ${isSaving
                    ? "opacity-50 pointer-events-none border-zinc-300 dark:border-zinc-700"
                    : "border-zinc-300 hover:border-emerald-500 hover:bg-emerald-50 dark:border-zinc-700 dark:hover:border-emerald-600 dark:hover:bg-emerald-900/10"
                  }`}
              >
                <input
                  type="file"
                  accept={ALLOWED_EXTENSIONS}
                  onChange={handleFileChange}
                  disabled={isSaving}
                  className="hidden"
                />
                <ArrowDownTrayIcon className="h-5 w-5 text-zinc-400" />
                <span className="text-xs text-zinc-500 text-center">
                  Drop invoice file or click to browse
                </span>
                <span className="text-xs text-zinc-400">
                  PDF, JPEG, PNG, WEBP • Max 45 MB
                </span>
              </label>
            )}

            {/* Encrypted storage notice */}
            <p className="text-xs text-zinc-400 flex items-center gap-1">
              <ShieldExclamationIcon className="h-3 w-3" />
              Files are encrypted before upload to Supabase Storage.
            </p>
          </div>

          {/* Error message */}
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
              <ExclamationTriangleIcon className="h-4 w-4" />
              {error}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-2">
            {isEditing && (
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
              {isSaving ? (
                <span className="flex items-center gap-1">
                  <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                  Saving...
                </span>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </div>
      </ModalFrame>

      {/* Delete confirmation */}
      {showDeleteConfirm && expense && (
        <ConfirmDialog
          title="Delete expense?"
          description="This action cannot be undone. The expense and its attached invoice file (if any) will be permanently removed."
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
        />
      )}

      {/* Invoice preview modal */}
      <InvoicePreviewModal
        isOpen={isPreviewOpen}
        onClose={() => {
          setPreviewOpen(false);
          if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
          }
        }}
        previewUrl={previewUrl}
        previewError={previewError}
        isDownloading={isDownloading}
        mimeType={existingInvoiceMime}
        fileName={existingInvoiceFile.replace(/\.enc$/, "")}
      />
    </>
  );
}