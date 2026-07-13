"use client";

import { useEffect, useMemo, useState } from "react";
import type { Document, DocumentPlaintext } from "@/types/document";
import { downloadDocumentFile } from "@/api/common/documentStorage";
import GlobalActionModal from "@/components/common/GlobalActionModal";
import type { ModalFile } from "@/components/common/GlobalActionModal";
import ErrorBanner from "@/components/common/ErrorBanner";
import ConfirmDialog from "@/components/taskmanager/ConfirmDialog";
import { getUniqueFileName } from "./helpers";

// --- Types ---

/** Minimum shape required for a parent record shown in the link dropdown */
export interface StoreParentRecord {
  id: string;
  name: string;
}

export interface StoreDocumentSaveParams {
  file?: File;
  label: string;
  linkedParentId?: string;
  /** Optional new parent record data when creating inline */
  newParentRecord?: Record<string, string>;
  existingDocument?: Document | null;
}

interface StoreDocumentModalProps {
  /** Existing document (edit mode) or null (add mode) */
  document: Document | null;
  /** Domain the document belongs to */
  domain: DocumentPlaintext["domain"];
  /** Parent records available for linking */
  parentRecords: StoreParentRecord[];
  /** Labels of ALL existing documents in the store — used for cross-store file name dedup */
  existingLabels: string[];
  userId: string;
  onClose: () => void;
  onSave: (params: StoreDocumentSaveParams) => Promise<void>;
  onDelete?: (document: Document, cascadeMode: "unlink" | "cascade") => Promise<void>;
  /** Optional: render a "create new record" form below the link dropdown. Receives {disabled, isSaving}. Returns form fields. */
  renderNewRecordForm?: (opts: { disabled: boolean; isSaving: boolean }) => React.ReactNode;
  /** Optional: extract form data for onSave. Called when saving with form filled. */
  extractNewRecordData?: () => Record<string, string> | null;
}

export default function StoreDocumentModal({
  document: doc,
  domain,
  parentRecords,
  existingLabels,
  userId,
  onClose,
  onSave,
  onDelete,
  renderNewRecordForm,
  extractNewRecordData,
}: StoreDocumentModalProps) {
  const isEditing = Boolean(doc);

  // --- File state (single file only) ---
  const [storeFile, setStoreFile] = useState<File | null>(null);

  // --- Parent record dropdown state ---
  const [linkedParentId, setLinkedParentId] = useState("");
  const [parentSearchQuery, setParentSearchQuery] = useState("");
  const [parentDropdownOpen, setParentDropdownOpen] = useState(false);

  // --- UI state ---
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(() => {
    if (doc?.file_name) return doc.id;
    return null;
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // --- Reset on open ---
  useEffect(() => {
    setLinkedParentId(doc?.linked_id ?? "");
    setStoreFile(null);
    setSelectedFileId(doc?.file_name ? doc.id : null);
    setParentSearchQuery("");
    setParentDropdownOpen(false);
    setError(null);
    setShowDeleteConfirm(false);
  }, [doc]);

  // --- Filtered parent records for searchable dropdown ---
  const filteredParents = useMemo(() => {
    if (!parentSearchQuery.trim()) return parentRecords;
    const q = parentSearchQuery.toLowerCase();
    return parentRecords.filter((r) => r.name.toLowerCase().includes(q));
  }, [parentRecords, parentSearchQuery]);

  // --- Selected parent display value ---
  const selectedParent = linkedParentId
    ? parentRecords.find((r) => r.id === linkedParentId)
    : null;
  const displayValue =
    linkedParentId && selectedParent
      ? selectedParent.name.length > 55
        ? selectedParent.name.slice(0, 55) + "…"
        : selectedParent.name
      : parentSearchQuery;

  // --- Files array (single file only) ---
  const files: ModalFile[] = useMemo(() => {
    if (storeFile) {
      return [
        {
          id: "store-file",
          name: storeFile.name,
          mime: storeFile.type,
          file: storeFile,
          isNew: true,
        },
      ];
    }
    if (isEditing && doc?.file_name) {
      return [
        {
          id: doc.id,
          name: doc.label || doc.file_name || "Unnamed Document",
          mime: doc.file_mime,
          iv: doc.file_iv,
        },
      ];
    }
    return [];
  }, [storeFile, isEditing, doc]);

  // --- Dirty check ---
  const formDisabled = linkedParentId !== "";
  const isDirty = isEditing
    ? storeFile !== null || linkedParentId !== (doc?.linked_id ?? "")
    : storeFile !== null || linkedParentId !== "" || (!!extractNewRecordData && !!extractNewRecordData());

  // --- File handlers ---

  const handleFileUpload = (file: File) => {
    const taken = new Set(existingLabels);
    if (doc?.label) taken.delete(doc.label);
    const uniqueName = getUniqueFileName(file.name, taken);
    const renamedFile =
      uniqueName !== file.name
        ? new File([file], uniqueName, { type: file.type, lastModified: file.lastModified })
        : file;
    setStoreFile(renamedFile);
    setSelectedFileId("store-file");
  };

  const handleFileRename = (fileId: string, newName: string) => {
    if (fileId === "store-file" && storeFile) {
      const renamedFile = new File([storeFile], newName, {
        type: storeFile.type,
        lastModified: storeFile.lastModified,
      });
      setStoreFile(renamedFile);
    }
  };

  const handleFileDelete = () => {
    if (isEditing && doc && onDelete) {
      setShowDeleteConfirm(true);
      return;
    }
    setStoreFile(null);
    setSelectedFileId(null);
  };

  const handleFileDownload = async () => {
    if (storeFile) {
      const url = URL.createObjectURL(storeFile);
      const a = document.createElement("a");
      a.href = url;
      a.download = storeFile.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    }
    if (isEditing && doc?.file_name && doc?.file_iv && doc?.file_mime) {
      try {
        const blob = await downloadDocumentFile(userId, doc.file_name, doc.file_iv, doc.file_mime);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = doc.label || "document";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        alert("Failed to download: " + (err instanceof Error ? err.message : "Unknown error"));
      }
    }
  };

  const handleLoadPreview = async (): Promise<Blob> => {
    if (storeFile) return storeFile;
    if (isEditing && doc?.file_name && doc?.file_iv && doc?.file_mime) {
      return downloadDocumentFile(userId, doc.file_name, doc.file_iv, doc.file_mime);
    }
    throw new Error("Cannot load preview.");
  };

  // --- Save ---

  const handleSave = async () => {
    if (!storeFile && !isEditing) {
      setError("Please upload a file.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const newParentData = extractNewRecordData?.() ?? undefined;

      await onSave({
        file: storeFile || undefined,
        label: storeFile?.name || doc?.label || "Document",
        linkedParentId: linkedParentId || undefined,
        newParentRecord: newParentData || undefined,
        existingDocument: doc,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save document.");
    } finally {
      setIsSaving(false);
    }
  };

  // --- Delete ---

  const handleDeleteClick = async () => {
    if (!doc || !onDelete) return;
    setShowDeleteConfirm(true);
  };

  // --- Domain label ---
  const domainLabel = domain.charAt(0).toUpperCase() + domain.slice(1);

  // --- Render ---

  return (
    <>
      <GlobalActionModal
        title={isEditing ? "Edit Document" : "Add Document"}
        onClose={onClose}
        isDirty={isDirty}
        files={files}
        selectedFileId={selectedFileId}
        onSelectFile={(id) => setSelectedFileId(id)}
        onFileDelete={files.length > 0 ? handleFileDelete : undefined}
        onFileDownload={files.length > 0 ? handleFileDownload : undefined}
        onFileRename={files.length > 0 ? handleFileRename : undefined}
        onFileUpload={!isEditing ? handleFileUpload : undefined}
        onLoadPreview={files.length > 0 ? handleLoadPreview : undefined}
        onSave={handleSave}
        isSaving={isSaving}
        onDelete={isEditing && onDelete ? handleDeleteClick : undefined}
        deleteLabel="Delete"
      >
        <div className="flex flex-col h-full space-y-3">
          {/* Searchable parent record dropdown + clear button */}
          {parentRecords.length > 0 && (
            <div className="relative">
              <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Link to existing {domainLabel} record
              </span>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={displayValue}
                  onChange={(e) => {
                    if (linkedParentId) setLinkedParentId("");
                    setParentSearchQuery(e.target.value);
                    if (!parentDropdownOpen) setParentDropdownOpen(true);
                  }}
                  onFocus={() => {
                    if (!parentDropdownOpen) setParentDropdownOpen(true);
                  }}
                  onBlur={() => setTimeout(() => setParentDropdownOpen(false), 150)}
                  placeholder={`Search ${domain} records...`}
                  disabled={isSaving}
                  className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 pr-16 text-xs outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                  {linkedParentId && (
                    <button
                      type="button"
                      onClick={() => {
                        setLinkedParentId("");
                        setParentSearchQuery("");
                      }}
                      className="px-1 py-0.5 text-xs font-medium text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded"
                      title="Clear selection"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setParentDropdownOpen((prev) => !prev)}
                    disabled={isSaving}
                    className="p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 disabled:opacity-50"
                  >
                    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Dropdown popup */}
              {parentDropdownOpen && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                  {filteredParents.length > 0 ? (
                    <div className="max-h-36 overflow-y-auto">
                      {filteredParents.map((parent) => (
                        <button
                          key={parent.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setLinkedParentId(parent.id);
                            setParentSearchQuery("");
                            setParentDropdownOpen(false);
                          }}
                          className="w-full px-3 py-1.5 text-left text-xs text-zinc-700 hover:bg-emerald-50 hover:text-emerald-700 dark:text-zinc-300 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400"
                        >
                          {parent.name.length > 55 ? parent.name.slice(0, 55) + "…" : parent.name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-3 py-2 text-xs text-zinc-400">
                      {parentSearchQuery ? "No matching records" : `No ${domain} records available`}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* --- or --- divider + inline creation form (mirrors StoreCertificateModal) */}
          {renderNewRecordForm && !isEditing && (
            <>
              <div className="flex items-center gap-2">
                <div className="flex-1 border-t border-zinc-200 dark:border-zinc-700" />
                <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase">
                  — or —
                </span>
                <div className="flex-1 border-t border-zinc-200 dark:border-zinc-700" />
              </div>
              {renderNewRecordForm({ disabled: formDisabled, isSaving })}
            </>
          )}

          {error && <ErrorBanner message={error} />}
        </div>
      </GlobalActionModal>

      {/* Delete confirmation */}
      {showDeleteConfirm && doc && onDelete && (
        doc.linked_id ? (
          <ConfirmDialog
            title="Delete document?"
            description="This document is linked to a record. Deleting it will also unlink it. The file will be permanently removed."
            confirmLabel="Delete"
            cancelLabel="Cancel"
            showDeleteFilesCheckbox
            deleteFilesLabel="Delete associated record"
            onCancel={() => setShowDeleteConfirm(false)}
            onConfirm={async (deleteRecord) => {
              setShowDeleteConfirm(false);
              setIsSaving(true);
              try {
                await onDelete(doc, deleteRecord ? "cascade" : "unlink");
                onClose();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to delete document.");
              } finally {
                setIsSaving(false);
              }
            }}
          />
        ) : (
          <ConfirmDialog
            title="Delete document?"
            description="This will permanently delete the document and its file. This cannot be undone."
            onCancel={() => setShowDeleteConfirm(false)}
            onConfirm={async () => {
              setShowDeleteConfirm(false);
              setIsSaving(true);
              try {
                await onDelete(doc, "unlink");
                onClose();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to delete document.");
              } finally {
                setIsSaving(false);
              }
            }}
          />
        )
      )}
    </>
  );
}
