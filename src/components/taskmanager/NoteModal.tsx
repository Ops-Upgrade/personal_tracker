"use client";

import { useMemo, useState, useCallback } from "react";
import type { Note } from "@/types/taskmanager";
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
import { useModalBaseState } from "@/hooks/useModalBaseState";
import { trunc } from "./helpers";
import { getUniqueFileName } from "@/lib/viewHelpers";
import { stripHtml } from "@/lib/utils";

// --- Types ---

interface NoteDraft {
  name: string;
  content: string;
}

interface NoteModalProps {
  note: Note | null;
  documents: Document[];
  userId: string;
  onClose: () => void;
  onSave: (
    draft: NoteDraft,
    existingNote: Note | null,
    pendingDoc?: { file: File; label: string },
    pendingLinkDocId?: string,
    pendingUnlinkDocIds?: string[],
    pendingDeleteDocIds?: string[],
  ) => Promise<unknown>;
  onDelete: (noteId: string, cascadeMode: "unlink" | "cascade") => Promise<void>;
  onDownloadDocument: (document: Document) => Promise<void>;
}

// ============================================================
// Main Modal
// ============================================================

export default function NoteModal({
  note,
  documents,
  userId,
  onClose,
  onSave,
  onDelete,
  onDownloadDocument,
}: NoteModalProps) {
  // --- Form state ---
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const {
    isSaving,
    setIsSaving,
    error,
    setError,
    showDeleteConfirm,
    setShowDeleteConfirm,
    toastConfig,
    triggerToast,
  } = useModalBaseState();

  // --- Document management ---
  const [newFiles, setNewFiles] = useState<{ file: File; label: string; tempId: string }[]>([]);
  const [markedForDeletion, setMarkedForDeletion] = useState<Set<string>>(new Set());
  const [markedForUnlink, setMarkedForUnlink] = useState<Set<string>>(new Set());
  const [selectedDocId, setSelectedDocId] = useState<string | null>(() => {
    if (!note) return null;
    const docs = documents.filter(
      (d) => d.domain === "taskmanager" && d.linked_id === note.id
    );
    return docs.length > 0 ? docs[0].id : null;
  });

  // Moved up: needed by the hook below
  const linkedDocs = useMemo(
    () =>
      note
        ? documents.filter(
            (d) => d.domain === "taskmanager" && d.linked_id === note.id
          )
        : [],
    [note, documents]
  );
  const standaloneDocs = documents.filter(
    (d) => d.domain === "taskmanager" && !d.linked_id
  );

  // Shared file state and handlers (staged link, search, dropdown, download/preview/rename)
  const {
    stagedLinkDocId,
    setStagedLinkDocId,
    linkSearchQuery,
    setLinkSearchQuery,
    linkDropdownOpen,
    setLinkDropdownOpen,
    filteredLinkDocs,
    handleFileDownload: hookHandleFileDownload,
    handleFileRename: hookHandleFileRename,
    handleLoadPreview: hookHandleLoadPreview,
    handleLinkDropdownSelect,
    resetFileState: hookResetFileState,
  } = useModalDocumentState({
    attachedDocuments: linkedDocs,
    standaloneDocuments: standaloneDocs,
    userId,
    markedForRemoval: markedForDeletion,
  });

  // ── Baseline form values ──
  const formBaseline = useMemo(
    () => ({
      name: note?.name ?? "",
      content: note?.content ?? "",
    }),
    [note]
  );

  // --- Dirty check ---

  const hasFormChanges =
    name !== formBaseline.name || stripHtml(content) !== stripHtml(formBaseline.content);

  const isDirty =
    hasFormChanges ||
    newFiles.length > 0 ||
    stagedLinkDocId !== null ||
    markedForDeletion.size > 0 ||
    markedForUnlink.size > 0;

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
      isMarkedForUnlink?: boolean;
      orderGroup: number;
      orderIndex: number;
    };

    const entries: FileEntry[] = [];

    // Existing linked docs
    let idx = 0;
    for (const doc of linkedDocs) {
      const isDeletion = markedForDeletion.has(doc.id);
      const isUnlink = markedForUnlink.has(doc.id);
      entries.push({
        id: doc.id,
        rawName: doc.label || "Unnamed Document",
        mime: doc.file_mime,
        iv: doc.file_iv,
        isMarkedForDeletion: isDeletion || undefined,
        isMarkedForUnlink: isUnlink || undefined,
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

    // Staged link doc
    if (stagedLinkDocId) {
      const sd = standaloneDocs.find((d) => d.id === stagedLinkDocId);
      if (sd) {
        entries.push({
          id: sd.id,
          rawName: sd.label || "Unnamed Document",
          mime: sd.file_mime,
          iv: sd.file_iv,
          isNew: true,
          orderGroup: 2,
          orderIndex: 0,
        });
      }
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
          isMarkedForUnlink: e.isMarkedForUnlink,
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
            isMarkedForUnlink: e.isMarkedForUnlink,
          });
        });
      }
    }

    return result;
  }, [linkedDocs, newFiles, stagedLinkDocId, markedForDeletion, markedForUnlink, standaloneDocs]);

  // --- File action handlers ---

  const handleFileDelete = (fileId: string) => {
    const newFile = newFiles.find((nf) => nf.tempId === fileId);
    if (newFile) {
      setNewFiles((prev) => prev.filter((nf) => nf.tempId !== fileId));
      if (selectedDocId === fileId) setSelectedDocId(null);
      return;
    }

    if (stagedLinkDocId === fileId) {
      setStagedLinkDocId(null);
      if (selectedDocId === fileId) setSelectedDocId(null);
      return;
    }

    setMarkedForDeletion((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
    setMarkedForUnlink((prev) => {
      const next = new Set(prev);
      next.delete(fileId);
      return next;
    });
  };

  const handleFileUnlink = (fileId: string) => {
    if (stagedLinkDocId === fileId) {
      setStagedLinkDocId(null);
      return;
    }
    if (newFiles.find((nf) => nf.tempId === fileId)) return;

    setMarkedForUnlink((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
    setMarkedForDeletion((prev) => {
      const next = new Set(prev);
      next.delete(fileId);
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
        !markedForDeletion.has(doc.id) &&
        !markedForUnlink.has(doc.id)
      ) {
        if (doc.label) taken.add(doc.label);
      }
    }
    if (stagedLinkDocId) {
      const sd = documents.find((d) => d.id === stagedLinkDocId);
      if (sd && sd.label) taken.add(sd.label);
    }

    setNewFiles((prev) => {
      for (const nf of prev) taken.add(nf.label);
      const label = getUniqueFileName(file.name, taken);
      const tempId = `new-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      return [...prev, { file, label, tempId }];
    });

    setSelectedDocId(null);
  };

  const handleLinkDropdownSelectWrapped = useCallback(
    (docId: string) => {
      handleLinkDropdownSelect(docId);
      setSelectedDocId(null);
    },
    [handleLinkDropdownSelect]
  );

  // --- Delete handler ---
  async function handleDelete() {
    if (!note) return;
    setShowDeleteConfirm(true);
  }

  // --- Save handler ---
  const handleSaveWithFullProcessing = async () => {
    if (!name.trim()) {
      setError("Note name is required.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const docsToUnlink = [...markedForUnlink];
      const docsToDelete = [...markedForDeletion];
      const docToLink = stagedLinkDocId;
      const firstNewFile = newFiles[0];
      const pendingDoc = firstNewFile
        ? { file: firstNewFile.file, label: firstNewFile.label }
        : undefined;

      await onSave(
        {
          name: name.trim(),
          content: content.trim(),
        },
        note,
        pendingDoc,
        docToLink ?? undefined,
        docsToUnlink.length > 0 ? docsToUnlink : undefined,
        docsToDelete.length > 0 ? docsToDelete : undefined,
      );

      // Synchronously clear local file state so isDirty resets immediately
      setNewFiles([]);
      setMarkedForDeletion(new Set());
      setMarkedForUnlink(new Set());
      setStagedLinkDocId(null);
      hookResetFileState();

      triggerToast("✓ Saved", "success");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save note."
      );
    } finally {
      setIsSaving(false);
    }
  };

  // --- Build link dropdown for rightPanelExtras ---
  const linkDropdownExtras = useMemo(() => {
    if (standaloneDocs.length === 0 && !stagedLinkDocId) return null;

    const labelBuckets = new Map<string, Document[]>();
    for (const doc of standaloneDocs) {
      const key = doc.label || "Unnamed";
      if (!labelBuckets.has(key)) labelBuckets.set(key, []);
      labelBuckets.get(key)!.push(doc);
    }
    const displayName = new Map<string, string>();
    for (const [, bucket] of labelBuckets) {
      if (bucket.length === 1) {
        displayName.set(bucket[0].id, trunc(bucket[0].label || "Unnamed", 55));
      } else {
        bucket.sort((a, b) => a.created_at.localeCompare(b.created_at));
        bucket.forEach((doc, i) => {
          displayName.set(
            doc.id,
            `${trunc(doc.label || "Unnamed", 50)} (${i + 1})`
          );
        });
      }
    }
    const fmt = (doc: Document): string =>
      displayName.get(doc.id) || trunc(doc.label || "Unnamed", 55);

    const stagedDoc = stagedLinkDocId
      ? standaloneDocs.find((d) => d.id === stagedLinkDocId)
      : null;
    const stagedLabel = stagedDoc ? fmt(stagedDoc) : null;

    const displayValue = stagedLinkDocId ? (stagedLabel ?? "") : linkSearchQuery;

    return (
      <div className="relative w-full">
        <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Select a file from the store
        </span>

        <div className="relative flex items-center">
          <input
            type="text"
            value={displayValue}
            onChange={(e) => {
              if (stagedLinkDocId) setStagedLinkDocId(null);
              setLinkSearchQuery(e.target.value);
              if (!linkDropdownOpen) setLinkDropdownOpen(true);
            }}
            onFocus={() => {
              if (!linkDropdownOpen) setLinkDropdownOpen(true);
            }}
            onBlur={() => setTimeout(() => setLinkDropdownOpen(false), 150)}
            placeholder="Select file..."
            disabled={isSaving}
            className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 pr-7 text-xs outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => {
              setLinkDropdownOpen((prev) => !prev);
            }}
            disabled={isSaving}
            className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 disabled:opacity-50"
          >
            <svg
              className="h-3.5 w-3.5 shrink-0"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {linkDropdownOpen && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            {filteredLinkDocs.length > 0 ? (
              <div className="max-h-36 overflow-y-auto">
                {filteredLinkDocs.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleLinkDropdownSelectWrapped(doc.id)}
                    className="w-full px-3 py-1.5 text-left text-xs text-zinc-700 hover:bg-emerald-50 hover:text-emerald-700 dark:text-zinc-300 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400"
                  >
                    {fmt(doc)}
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-3 py-2 text-xs text-zinc-400">
                {linkSearchQuery
                  ? "No documents found"
                  : "No documents available"}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }, [
    linkSearchQuery,
    linkDropdownOpen,
    filteredLinkDocs,
    stagedLinkDocId,
    standaloneDocs,
    isSaving,
    handleLinkDropdownSelectWrapped,
    setLinkDropdownOpen,
    setLinkSearchQuery,
    setStagedLinkDocId,
  ]);

  // --- Render ---

  const hasFiles = files.length > 0;
  return (
    <>
      <Toast isVisible={toastConfig.isVisible} message={toastConfig.message} type={toastConfig.type} />

      <GlobalActionModal
        title={note ? "Edit note" : "Add note"}
        onClose={onClose}
        isDirty={isDirty}
        files={files}
        selectedFileId={selectedDocId}
        onSelectFile={(id) => setSelectedDocId(id)}
        onFileDelete={hasFiles ? handleFileDelete : undefined}
        onFileUnlink={hasFiles ? handleFileUnlink : undefined}
        onFileDownload={hasFiles ? handleFileDownloadWrapped : undefined}
        onFileRename={hasFiles ? handleFileRenameWrapped : undefined}
        onFileUpload={handleFileUpload}
        onLoadPreview={handleLoadPreviewWrapped}
        onSave={handleSaveWithFullProcessing}
        isSaving={isSaving}
        onDelete={note ? handleDelete : undefined}
        deleteLabel="Delete"
        rightPanelExtras={linkDropdownExtras}
      >
        <div className="flex flex-col h-full space-y-3">
          <InputField
            label="Name"
            value={name}
            onChange={setName}
            disabled={isSaving}
            placeholder="Note title"
          />

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Content
            </label>
            <RichTextEditor
              value={content}
              onChange={setContent}
              disabled={isSaving}
              minHeight="10rem"
            />
          </div>

          {error && <ErrorBanner message={error} />}
        </div>
      </GlobalActionModal>

      {/* Delete confirmation */}
      {showDeleteConfirm && note && (
        <ConfirmDialog
          title="Delete note?"
          description={
            linkedDocs.length > 0
              ? `This note has ${linkedDocs.length} linked file(s).`
              : "Are you sure you want to delete this note? This cannot be undone."
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
                note.id,
                deleteFiles ? "cascade" : "unlink"
              );
              onClose();
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : "Failed to delete note."
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
