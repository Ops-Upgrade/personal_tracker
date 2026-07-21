"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import type { Expense } from "@/types/expense";
import type { Document } from "@/types/document";
import { downloadDocumentFile } from "@/api/common/documentStorage";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import GlobalActionModal from "@/components/common/GlobalActionModal";
import type { ModalFile } from "@/components/common/GlobalActionModal";
import { useModalDocumentState } from "@/lib/useModalDocumentState";
import { InputField } from "@/components/common/FormField";
import RichTextEditor from "@/components/common/RichTextEditor";
import ErrorBanner from "@/components/common/ErrorBanner";
import Toast from "@/components/common/Toast";
import type { ToastType } from "@/components/common/Toast";
import { getUniqueFileName } from "@/lib/viewHelpers";
import { stripHtml, normalizeDateForInput } from "@/lib/utils";

// --- Types ---

export interface ExpenseDraft {
  item: string;
  seller: string;
  cost: number;
  date: string;
  reason: string;
}

interface ExpenseModalProps {
  expense: Expense | null;
  defaultDate?: string;
  documents: Document[];
  userId: string;
  onClose: () => void;
  onSave: (
    draft: ExpenseDraft,
    existingExpense: Expense | null,
    pendingDoc?: { file: File; label: string },
    pendingLinkDocId?: string,
    pendingUnlinkDocIds?: string[],
    pendingDeleteDocIds?: string[],
  ) => Promise<void>;
  onDelete: (expenseId: string, cascadeMode: "unlink" | "cascade") => Promise<void>;
  onDownloadDocument: (document: Document) => Promise<void>;
  zClassName?: string;
}

// ============================================================
// Main Modal
// ============================================================

export default function ExpenseModal({
  expense,
  defaultDate,
  documents,
  userId,
  onClose,
  onSave,
  onDelete,
  onDownloadDocument,
  zClassName,
}: ExpenseModalProps) {
  // --- Form state ---
  const [item, setItem] = useState("");
  const [seller, setSeller] = useState("");
  const [cost, setCost] = useState("");
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Toast ---
  const [toastConfig, setToastConfig] = useState<{
    isVisible: boolean;
    message: string;
    type: ToastType;
  }>({ isVisible: false, message: "", type: "success" });

  const triggerToast = useCallback((message: string, type: ToastType = "success") => {
    setToastConfig({ isVisible: true, message, type });
    setTimeout(() => setToastConfig((prev) => ({ ...prev, isVisible: false })), 2000);
  }, []);

  // --- Delete confirmation ---
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // --- Document management ---
  const [newFiles, setNewFiles] = useState<{ file: File; label: string; tempId: string }[]>([]);
  const [markedForDeletion, setMarkedForDeletion] = useState<Set<string>>(new Set());
  const [selectedDocId, setSelectedDocId] = useState<string | null>(() => {
    if (!expense) return null;
    const docs = documents.filter(
      (d) => d.domain === "expense" && d.linked_id === expense.id
    );
    return docs.length > 0 ? docs[0].id : null;
  });

  // Moved up: needed by the hook below
  const linkedDocs = useMemo(
    () =>
      expense
        ? documents.filter(
            (d) => d.domain === "expense" && d.linked_id === expense.id
          )
        : [],
    [expense, documents]
  );
  const standaloneDocs = documents.filter(
    (d) => d.domain === "expense" && !d.linked_id
  );

  // Shared file state and handlers (download/preview/rename)
  const {
    handleFileDownload: hookHandleFileDownload,
    handleFileRename: hookHandleFileRename,
    handleLoadPreview: hookHandleLoadPreview,
    resetFileState: hookResetFileState,
  } = useModalDocumentState({
    attachedDocuments: linkedDocs,
    standaloneDocuments: standaloneDocs,
    userId,
    markedForRemoval: markedForDeletion,
  });

  // --- Reset form fields on open / record change ---
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- by-design: sync form state when editing a different record
    setItem(expense?.item ?? "");
    setSeller(expense?.seller ?? "");
    setCost(expense?.cost != null ? String(expense.cost) : "");
    setDate(normalizeDateForInput(expense?.date, defaultDate ?? ""));
    setReason(expense?.reason ?? "");
    setError(null);
    setShowDeleteConfirm(false);
  }, [expense, defaultDate]);

  // --- Reset file state only when the record changes (NOT on documents load) ---
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- by-design: sync file state when editing a different record
    setNewFiles([]);
    setMarkedForDeletion(new Set());
    hookResetFileState();
  }, [expense, hookResetFileState]);

  // --- Auto-select the first attached document (safe to run on documents load) ---
  useEffect(() => {
    if (expense && !selectedDocId) {
      const existingDocs = documents.filter(
        (d) => d.domain === "expense" && d.linked_id === expense.id
      );
      if (existingDocs.length > 0) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- by-design: auto-select first doc on open
        setSelectedDocId(existingDocs[0].id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expense, documents]);

  // ── Baseline form values ──
  const formBaseline = useMemo(
    () => ({
      item: expense?.item ?? "",
      seller: expense?.seller ?? "",
      cost: expense?.cost != null ? String(expense.cost) : "",
      date: normalizeDateForInput(expense?.date, defaultDate ?? ""),
      reason: expense?.reason ?? "",
    }),
    [expense, defaultDate]
  );

  // --- Dirty check ---

  const hasFormChanges =
    item !== formBaseline.item ||
    seller !== formBaseline.seller ||
    cost !== formBaseline.cost ||
    date !== formBaseline.date ||
    stripHtml(reason) !== stripHtml(formBaseline.reason);

  const isDirty =
    hasFormChanges ||
    newFiles.length > 0 ||
    markedForDeletion.size > 0;

  // --- Build files array for GlobalActionModal ---

  const files: ModalFile[] = useMemo(() => {
    type FileEntry = {
      id: string;
      rawName: string;
      mime?: string;
      iv?: string;
      file?: File | null;
      isNew?: boolean;
      isMarkedForDeletion?: boolean;
      orderGroup: number;
      orderIndex: number;
    };

    const entries: FileEntry[] = [];

    // Existing linked docs
    let idx = 0;
    for (const doc of linkedDocs) {
      const isDeletion = markedForDeletion.has(doc.id);
      entries.push({
        id: doc.id,
        rawName: doc.label || "Unnamed Document",
        mime: doc.file_mime,
        iv: doc.file_iv,
        isMarkedForDeletion: isDeletion || undefined,
        orderGroup: 0,
        orderIndex: idx++,
      });
    }

    // Newly uploaded files (unsaved)
    idx = 0;
    for (const nf of newFiles) {
      entries.push({
        id: nf.tempId,
        rawName: nf.label,
        mime: nf.file.type,
        file: nf.file,
        isNew: true,
        orderGroup: 1,
        orderIndex: idx++,
      });
    }

    // Deduplicate names
    const buckets = new Map<string, FileEntry[]>();
    for (const e of entries) {
      if (!buckets.has(e.rawName)) buckets.set(e.rawName, []);
      buckets.get(e.rawName)!.push(e);
    }

    const result: ModalFile[] = [];
    for (const [, bucket] of buckets) {
      bucket.sort(
        (a, b) => a.orderGroup - b.orderGroup || a.orderIndex - b.orderIndex
      );
      if (bucket.length === 1) {
        const e = bucket[0];
        result.push({
          id: e.id,
          name: e.rawName,
          mime: e.mime,
          iv: e.iv,
          file: e.file,
          isNew: e.isNew,
          isMarkedForDeletion: e.isMarkedForDeletion,
        });
      } else {
        bucket.forEach((e, i) => {
          result.push({
            id: e.id,
            name: `${e.rawName} (${i + 1})`,
            mime: e.mime,
            iv: e.iv,
            file: e.file,
            isNew: e.isNew,
            isMarkedForDeletion: e.isMarkedForDeletion,
          });
        });
      }
    }

    return result;
  }, [linkedDocs, newFiles, markedForDeletion]);

  // --- File action handlers ---

  const handleFileDelete = (fileId: string) => {
    const newFile = newFiles.find((nf) => nf.tempId === fileId);
    if (newFile) {
      setNewFiles((prev) => prev.filter((nf) => nf.tempId !== fileId));
      if (selectedDocId === fileId) setSelectedDocId(null);
      return;
    }

    setMarkedForDeletion((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  };

  const handleFileDownloadWrapped = async (fileId: string) => {
    const newFile = newFiles.find((nf) => nf.tempId === fileId);
    if (newFile) {
      const url = URL.createObjectURL(newFile.file);
      const a = document.createElement("a");
      a.href = url;
      a.download = newFile.label;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    }

    const doc = [...linkedDocs, ...documents].find((d) => d.id === fileId);
    if (doc) {
      try {
        await onDownloadDocument(doc);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to download document.");
      }
      return;
    }

    await hookHandleFileDownload(fileId);
  };

  const handleFileRenameWrapped = (fileId: string, newName: string) => {
    const newFile = newFiles.find((nf) => nf.tempId === fileId);
    if (newFile) {
      setNewFiles((prev) =>
        prev.map((nf) =>
          nf.tempId === fileId ? { ...nf, label: newName } : nf
        )
      );
      return;
    }

    hookHandleFileRename(fileId, newName);
  };

  const handleLoadPreviewWrapped = async (fileId: string): Promise<Blob> => {
    const newFile = newFiles.find((nf) => nf.tempId === fileId);
    if (newFile) return newFile.file;

    const doc = [...linkedDocs, ...documents].find((d) => d.id === fileId);
    if (doc?.file_name && doc?.file_iv) {
      return downloadDocumentFile(
        userId,
        doc.file_name,
        doc.file_iv,
        doc.file_mime ?? "application/octet-stream"
      );
    }

    return hookHandleLoadPreview(fileId);
  };

  const handleFileUpload = (file: File) => {
    const taken = new Set<string>();
    for (const doc of documents) {
      if (
        linkedDocs.some((ld) => ld.id === doc.id) &&
        !markedForDeletion.has(doc.id)
      ) {
        if (doc.label) taken.add(doc.label);
      }
    }

    setNewFiles((prev) => {
      for (const nf of prev) taken.add(nf.label);
      const label = getUniqueFileName(file.name, taken);
      const tempId = `new-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      return [...prev, { file, label, tempId }];
    });

    setSelectedDocId(null);
  };

  // --- Delete handler ---
  async function handleDelete() {
    if (!expense) return;
    setShowDeleteConfirm(true);
  }

  // --- Save handler ---
  const handleSaveWithFullProcessing = async () => {
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
      const docsToDelete = [...markedForDeletion];
      const firstNewFile = newFiles[0];
      const pendingDoc = firstNewFile
        ? { file: firstNewFile.file, label: firstNewFile.label }
        : undefined;

      await onSave(
        {
          item: item.trim(),
          seller: seller.trim(),
          cost: parsedCost,
          date,
          reason: reason.trim(),
        },
        expense,
        pendingDoc,
        undefined,
        undefined,
        docsToDelete.length > 0 ? docsToDelete : undefined,
      );

      triggerToast("✓ Saved", "success");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save expense."
      );
    } finally {
      setIsSaving(false);
    }
  };

  // --- Render ---

  const hasFiles = files.length > 0;
  return (
    <>
      <Toast isVisible={toastConfig.isVisible} message={toastConfig.message} type={toastConfig.type} />

      <GlobalActionModal
        title={expense ? "Edit expense" : "Add expense"}
        onClose={onClose}
        isDirty={isDirty}
        files={files}
        selectedFileId={selectedDocId}
        onSelectFile={(id) => setSelectedDocId(id)}
        onFileDelete={hasFiles ? handleFileDelete : undefined}
        onFileDownload={hasFiles ? handleFileDownloadWrapped : undefined}
        onFileRename={hasFiles ? handleFileRenameWrapped : undefined}
        onFileUpload={handleFileUpload}
        onLoadPreview={handleLoadPreviewWrapped}
        onSave={handleSaveWithFullProcessing}
        isSaving={isSaving}
        onDelete={expense ? handleDelete : undefined}
        deleteLabel="Delete"
        zClassName={zClassName}
      >
        <div className="flex flex-col h-full space-y-3">
          <InputField
            label="Item"
            value={item}
            onChange={setItem}
            disabled={isSaving}
          />
          <InputField
            label="Seller"
            value={seller}
            onChange={setSeller}
            disabled={isSaving}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <InputField
              label="Cost (₹)"
              type="number"
              min="0"
              step="0.01"
              value={cost}
              onChange={setCost}
              disabled={isSaving}
            />
            <InputField
              label="Date"
              type="date"
              value={date}
              onChange={setDate}
              disabled={isSaving}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Reason
            </label>
            <RichTextEditor
              value={reason}
              onChange={setReason}
              disabled={isSaving}
              minHeight="6rem"
            />
          </div>
          {error && <ErrorBanner message={error} />}
        </div>
      </GlobalActionModal>

      {/* Delete confirmation */}
      {showDeleteConfirm && expense && (
        <ConfirmDialog
          title="Delete expense?"
          description={
            linkedDocs.length > 0
              ? `This expense has ${linkedDocs.length} linked file(s).`
              : "Are you sure you want to delete this expense? This cannot be undone."
          }
          confirmLabel="Delete"
          cancelLabel="Cancel"
          showDeleteFilesCheckbox={linkedDocs.length > 0}
          deleteFilesLabel="Delete associated files"
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={async (deleteFiles) => {
            setShowDeleteConfirm(false);
            setIsSaving(true);
            try {
              await onDelete(
                expense.id,
                deleteFiles ? "cascade" : "unlink"
              );
              onClose();
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : "Failed to delete expense."
              );
            } finally {
              setIsSaving(false);
            }
          }}
        />
      )}
    </>
  );
}
