"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import type { Expense } from "@/types/expense";
import type { Document } from "@/types/document";
import { downloadDocumentFile } from "@/api/common/documentStorage";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import GlobalActionModal from "@/components/common/GlobalActionModal";
import type { ModalFile } from "@/components/common/GlobalActionModal";
import { InputField } from "@/components/common/FormField";
import RichTextEditor from "@/components/common/RichTextEditor";
import ErrorBanner from "@/components/common/ErrorBanner";
import Toast from "@/components/common/Toast";
import type { ToastType } from "@/components/common/Toast";

// --- Types ---

export interface ExpenseFileAction {
  newFiles: File[];
  removeDocIds: string[];
  /** ID of an existing standalone document to link */
  linkDocId?: string;
}

interface ExpenseModalProps {
  expense: Expense | null;
  defaultDate?: string;
  attachedDocuments: Document[];
  /** All standalone (unlinked) expense documents — for the "link existing" dropdown */
  standaloneDocuments: Document[];
  userId: string;
  onClose: () => void;
  onSave: (
    draft: { item: string; seller: string; cost: number; date: string; reason: string; invoice: string },
    existingExpense: Expense | null,
    fileAction?: ExpenseFileAction,
  ) => Promise<void>;
  onDelete: (expenseId: string) => Promise<void>;
  zClassName?: string;
}

export default function ExpenseModal({
  expense,
  defaultDate,
  attachedDocuments,
  standaloneDocuments,
  userId,
  onClose,
  onSave,
  onDelete,
  zClassName,
}: ExpenseModalProps) {
  const [item, setItem] = useState(expense?.item ?? "");
  const [seller, setSeller] = useState(expense?.seller ?? "");
  const [cost, setCost] = useState(expense?.cost != null ? String(expense.cost) : "");
  const [date, setDate] = useState(expense?.date ?? defaultDate ?? "");
  const [reason, setReason] = useState(expense?.reason ?? "");
  const [invoice, setInvoice] = useState(expense?.invoice ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [toastConfig, setToastConfig] = useState<{
    isVisible: boolean;
    message: string;
    type: ToastType;
  }>({ isVisible: false, message: "", type: "success" });

  const triggerToast = useCallback((message: string, type: ToastType = "success") => {
    setToastConfig({ isVisible: true, message, type });
    setTimeout(() => setToastConfig((prev) => ({ ...prev, isVisible: false })), 2000);
  }, []);

  // File state
  const [newFiles, setNewFiles] = useState<{ file: File; tempId: string }[]>([]);
  const [markedForRemoval, setMarkedForRemoval] = useState<Set<string>>(new Set());
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [stagedLinkDocId, setStagedLinkDocId] = useState<string | null>(null);
  const [linkSearchQuery, setLinkSearchQuery] = useState("");
  const [linkDropdownOpen, setLinkDropdownOpen] = useState(false);

  const isEditing = Boolean(expense);

  const baseline = useMemo(() => ({
    item: expense?.item ?? "",
    seller: expense?.seller ?? "",
    cost: expense?.cost != null ? String(expense.cost) : "",
    date: expense?.date ?? defaultDate ?? "",
    reason: expense?.reason ?? "",
    invoice: expense?.invoice ?? "",
  }), [expense, defaultDate]);

  useEffect(() => {
    setItem(baseline.item); setSeller(baseline.seller); setCost(baseline.cost);
    setDate(baseline.date); setReason(baseline.reason); setInvoice(baseline.invoice);
    setIsSaving(false); setError(null); setShowDeleteConfirm(false);
    setNewFiles([]); setMarkedForRemoval(new Set()); setSelectedFileId(null);
    setStagedLinkDocId(null); setLinkSearchQuery(""); setLinkDropdownOpen(false);
  }, [baseline]);

  const isDirty =
    item !== baseline.item || seller !== baseline.seller || cost !== baseline.cost ||
    date !== baseline.date || reason !== baseline.reason || invoice !== baseline.invoice ||
    newFiles.length > 0 || markedForRemoval.size > 0 || stagedLinkDocId !== null;

  // --- Files array ---
  const files: ModalFile[] = useMemo(() => {
    const result: ModalFile[] = [];
    for (const doc of attachedDocuments) {
      if (markedForRemoval.has(doc.id)) continue;
      result.push({ id: doc.id, name: doc.label || doc.file_name || "Unnamed", mime: doc.file_mime, iv: doc.file_iv });
    }
    for (const nf of newFiles) {
      result.push({ id: nf.tempId, name: nf.file.name, mime: nf.file.type, file: nf.file, isNew: true });
    }
    if (stagedLinkDocId) {
      const sd = standaloneDocuments.find((d) => d.id === stagedLinkDocId);
      if (sd) result.push({ id: sd.id, name: sd.label || sd.file_name || "Unnamed", mime: sd.file_mime, iv: sd.file_iv, isNew: true });
    }
    return result;
  }, [attachedDocuments, newFiles, markedForRemoval, stagedLinkDocId, standaloneDocuments]);

  // --- File handlers ---
  const handleFileUpload = useCallback((file: File) => {
    const tempId = `new-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setNewFiles((prev) => [...prev, { file, tempId }]);
    setSelectedFileId(null);
  }, []);

  const handleFileDelete = useCallback((fileId: string) => {
    if (stagedLinkDocId === fileId) { setStagedLinkDocId(null); if (selectedFileId === fileId) setSelectedFileId(null); return; }
    const nf = newFiles.find((x) => x.tempId === fileId);
    if (nf) { setNewFiles((prev) => prev.filter((x) => x.tempId !== fileId)); if (selectedFileId === fileId) setSelectedFileId(null); return; }
    setMarkedForRemoval((prev) => { const next = new Set(prev); if (next.has(fileId)) next.delete(fileId); else next.add(fileId); return next; });
  }, [newFiles, selectedFileId, stagedLinkDocId]);

  const handleFileDownload = useCallback(async (fileId: string) => {
    const nf = newFiles.find((x) => x.tempId === fileId);
    if (nf) { const url = URL.createObjectURL(nf.file); const a = document.createElement("a"); a.href = url; a.download = nf.file.name; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); return; }
    const doc = attachedDocuments.find((d) => d.id === fileId);
    if (!doc?.file_name || !doc.file_iv || !doc.file_mime) return;
    try {
      const blob = await downloadDocumentFile(userId, doc.file_name, doc.file_iv, doc.file_mime);
      const url = URL.createObjectURL(blob); const a = document.createElement("a");
      a.href = url; a.download = doc.label || "document"; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch (err: unknown) { alert(err instanceof Error ? err.message : "Failed to download."); }
  }, [newFiles, attachedDocuments, userId]);

  const handleLoadPreview = useCallback(async (fileId: string): Promise<Blob> => {
    const nf = newFiles.find((x) => x.tempId === fileId); if (nf) return nf.file;
    const doc = attachedDocuments.find((d) => d.id === fileId);
    if (!doc?.file_name || !doc.file_iv || !doc.file_mime) throw new Error("Cannot load preview.");
    return downloadDocumentFile(userId, doc.file_name, doc.file_iv, doc.file_mime);
  }, [newFiles, attachedDocuments, userId]);

  const handleFileRename = useCallback((fileId: string, newName: string) => {
    const nf = newFiles.find((x) => x.tempId === fileId);
    if (nf) { const renamed = new File([nf.file], newName, { type: nf.file.type, lastModified: nf.file.lastModified }); setNewFiles((prev) => prev.map((x) => x.tempId === fileId ? { ...x, file: renamed } : x)); }
  }, [newFiles]);

  // --- Link dropdown ---
  const availableStandalone = useMemo(() => {
    const linked = new Set(attachedDocuments.map((d) => d.id));
    return standaloneDocuments.filter((d) => !linked.has(d.id) && d.id !== stagedLinkDocId);
  }, [standaloneDocuments, attachedDocuments, stagedLinkDocId]);

  const filteredLinkDocs = useMemo(() => {
    if (!linkSearchQuery.trim()) return availableStandalone;
    const q = linkSearchQuery.toLowerCase();
    return availableStandalone.filter((d) => (d.label || "").toLowerCase().includes(q) || (d.file_name || "").toLowerCase().includes(q));
  }, [availableStandalone, linkSearchQuery]);

  const stagedLinkDoc = stagedLinkDocId ? standaloneDocuments.find((d) => d.id === stagedLinkDocId) : null;
  const stagedLinkLabel = stagedLinkDoc ? (stagedLinkDoc.label || stagedLinkDoc.file_name || "Unnamed") : null;
  const linkDisplayValue = stagedLinkDocId ? (stagedLinkLabel ?? "") : linkSearchQuery;

  const linkDropdownExtras = useMemo(() => {
    if (availableStandalone.length === 0 && !stagedLinkDocId) return null;
    return (
      <div className="relative w-full">
        <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">Select a file from the store</span>
        <div className="relative flex items-center">
          <input
            type="text"
            value={linkDisplayValue.length > 55 ? linkDisplayValue.slice(0, 55) + "…" : linkDisplayValue}
            onChange={(e) => { if (stagedLinkDocId) setStagedLinkDocId(null); setLinkSearchQuery(e.target.value); if (!linkDropdownOpen) setLinkDropdownOpen(true); }}
            onFocus={() => { if (!linkDropdownOpen) setLinkDropdownOpen(true); }}
            onBlur={() => setTimeout(() => setLinkDropdownOpen(false), 150)}
            placeholder="Select file..." disabled={isSaving}
            className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 pr-7 text-xs outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
          <button type="button" tabIndex={-1} onClick={() => setLinkDropdownOpen((prev) => !prev)} disabled={isSaving}
            className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 disabled:opacity-50">
            <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        {linkDropdownOpen && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            {filteredLinkDocs.length > 0 ? (
              <div className="max-h-36 overflow-y-auto">
                {filteredLinkDocs.map((doc) => (
                  <button key={doc.id} type="button" onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setStagedLinkDocId(doc.id); setLinkSearchQuery(""); setLinkDropdownOpen(false); setSelectedFileId(null); }}
                    className="w-full px-3 py-1.5 text-left text-xs text-zinc-700 hover:bg-emerald-50 hover:text-emerald-700 dark:text-zinc-300 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400">
                    {(doc.label || doc.file_name || "Unnamed").length > 55 ? (doc.label || doc.file_name || "Unnamed").slice(0, 55) + "…" : (doc.label || doc.file_name || "Unnamed")}
                  </button>
                ))}
              </div>
            ) : <div className="px-3 py-2 text-xs text-zinc-400">{linkSearchQuery ? "No documents found" : "No documents available"}</div>}
          </div>
        )}
      </div>
    );
  }, [availableStandalone.length, stagedLinkDocId, linkDisplayValue, linkDropdownOpen, filteredLinkDocs, linkSearchQuery, isSaving]);

  // --- Save ---
  async function handleSave() {
    if (!item.trim()) { setError("Item name is required."); return; }
    const parsedCost = parseFloat(cost);
    if (isNaN(parsedCost) || parsedCost < 0) { setError("Please enter a valid cost."); return; }
    if (!date) { setError("Date is required."); return; }
    setIsSaving(true); setError(null);
    try {
      const fileAction: ExpenseFileAction | undefined =
        newFiles.length > 0 || markedForRemoval.size > 0 || stagedLinkDocId
          ? { newFiles: newFiles.map((nf) => nf.file), removeDocIds: [...markedForRemoval], linkDocId: stagedLinkDocId ?? undefined }
          : undefined;
      await onSave({ item: item.trim(), seller: seller.trim(), cost: parsedCost, date, reason: reason.trim(), invoice: invoice.trim() }, expense, fileAction);
      triggerToast("✓ Saved", "success");
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to save expense."); }
    finally { setIsSaving(false); }
  }

  async function handleDelete() { if (!expense) return; setShowDeleteConfirm(true); }
  async function confirmDelete() {
    if (!expense) return;
    try { await onDelete(expense.id); setShowDeleteConfirm(false); onClose(); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to delete expense."); }
  }

  const hasFiles = files.length > 0;

  return (
    <>
      <Toast isVisible={toastConfig.isVisible} message={toastConfig.message} type={toastConfig.type} />

      <GlobalActionModal
        title={isEditing ? "Edit expense" : "Add expense"} onClose={onClose} isDirty={isDirty}
        files={files} selectedFileId={selectedFileId} onSelectFile={(id) => setSelectedFileId(id)}
        onFileUpload={handleFileUpload} onFileDelete={hasFiles ? handleFileDelete : undefined}
        onFileDownload={hasFiles ? handleFileDownload : undefined}
        onFileRename={hasFiles ? handleFileRename : undefined}
        onLoadPreview={hasFiles ? handleLoadPreview : undefined}
        onSave={handleSave} isSaving={isSaving}
        onDelete={isEditing ? handleDelete : undefined} deleteLabel="Delete"
        rightPanelExtras={linkDropdownExtras} zClassName={zClassName}
      >
        <div className="space-y-3">
          <InputField label="Item" value={item} onChange={setItem} disabled={isSaving} />
          <InputField label="Seller" value={seller} onChange={setSeller} disabled={isSaving} />
          <div className="grid gap-3 sm:grid-cols-2">
            <InputField label="Cost (₹)" type="number" min="0" step="0.01" value={cost} onChange={setCost} disabled={isSaving} />
            <InputField label="Date" type="date" value={date} onChange={setDate} disabled={isSaving} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">Reason</label>
            <RichTextEditor value={reason} onChange={setReason} disabled={isSaving} minHeight="6rem" />
          </div>
          {error && <ErrorBanner message={error} />}
        </div>
      </GlobalActionModal>
      {showDeleteConfirm && expense && (
        <ConfirmDialog title="Delete expense?" description="This action cannot be undone. The expense will be permanently removed."
          onCancel={() => setShowDeleteConfirm(false)} onConfirm={confirmDelete} />
      )}
    </>
  );
}
