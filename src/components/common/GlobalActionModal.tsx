"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import DocPreviewPanel from "./DocPreviewPanel";
import FileUploadZone from "./FileUploadZone";
import Button from "./Button";
import ConfirmDialog from "@/components/taskmanager/ConfirmDialog";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  LinkSlashIcon,
  ArrowPathIcon,
  DocumentIcon,
} from "@/components/common/Icons";

// --- Types ---

export interface ModalFile {
  id: string;
  name: string;
  mime?: string;
  iv?: string;
  /** Local File object for unsaved/new files — enables instant preview via blob URL */
  file?: File | null;
  isNew?: boolean;
  isMarkedForDeletion?: boolean;
}

export interface GlobalActionModalProps {
  title: string;
  onClose: () => void;
  /** When true, shows confirmation if user tries to close with Esc or backdrop click */
  isDirty?: boolean;
  /** Form content (left panel) */
  children: ReactNode;

  // --- Right panel: files ---
  files?: ModalFile[];
  selectedFileId?: string | null;
  onSelectFile?: (fileId: string) => void;

  // --- File actions (appear as explicit icon buttons in the nav bar) ---
  onFileDelete?: (fileId: string) => void;
  onFileUnlink?: (fileId: string) => void;
  onFileDownload?: (fileId: string) => void;

  // --- Upload / Link ---
  onFileUpload?: (file: File) => void;
  onLinkFile?: () => void;
  isUploading?: boolean;

  // --- Preview loading for remote encrypted files ---
  onLoadPreview?: (fileId: string) => Promise<Blob>;

  // --- Action buttons (rendered in left panel footer) ---
  onSave: () => Promise<void>;
  isSaving?: boolean;
  onDelete?: () => Promise<void>;
  deleteLabel?: string;

  // --- Style ---
  maxWidthClassName?: string;
  zClassName?: string;

  // --- Right panel custom content (e.g. link dropdown from parent) ---
  rightPanelExtras?: ReactNode;
}

// ============================================================
// Global Action Modal
// ============================================================

export default function GlobalActionModal({
  title,
  onClose,
  isDirty = false,
  children,
  files = [],
  selectedFileId = null,
  onSelectFile,
  onFileDelete,
  onFileUnlink,
  onFileDownload,
  onFileUpload,
  onLinkFile,
  isUploading = false,
  onLoadPreview,
  onSave,
  isSaving = false,
  onDelete,
  deleteLabel = "Delete",
  maxWidthClassName,
  zClassName = "z-40",
  rightPanelExtras,
}: GlobalActionModalProps) {
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [fileDropdownOpen, setFileDropdownOpen] = useState(false);

  // --- isDirty ref so Esc handler never sees stale closure (Task 1.3) ---
  const isDirtyRef = useRef(isDirty);
  useEffect(() => {
    isDirtyRef.current = isDirty;
  });

  const showRightPanel = !!(files.length > 0 || onFileUpload || onLinkFile || rightPanelExtras);
  const hasFiles = files.length > 0;

  // Derive computed max-width: if right panel is hidden, use narrower modal
  const computedMaxWidth = maxWidthClassName ?? (showRightPanel ? "max-w-6xl" : "max-w-md");

  // --- Current selected file ---
  const selectedIndex = selectedFileId
    ? files.findIndex((f) => f.id === selectedFileId)
    : -1;
  const selectedFile = selectedIndex >= 0 ? files[selectedIndex] : undefined;

  // --- Navigation ---
  const handlePrev = () => {
    if (!onSelectFile || selectedIndex <= 0) return;
    onSelectFile(files[selectedIndex - 1].id);
  };

  const handleNext = () => {
    if (!onSelectFile || selectedIndex >= files.length - 1) return;
    onSelectFile(files[selectedIndex + 1].id);
  };

  // --- Close handling (Esc / Backdrop) ---
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      attemptClose();
    }
  };

  const attemptClose = () => {
    if (isDirtyRef.current) {
      setShowCloseConfirm(true);
    } else {
      onClose();
    }
  };

  // Esc key handler — uses ref so isDirty never goes stale
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isDirtyRef.current) {
          setShowCloseConfirm(true);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // --- Render ---

  return (
    <>
      <div
        className={`fixed inset-0 ${zClassName} flex items-center justify-center bg-zinc-950/60 p-4`}
        onClick={handleBackdropClick}
      >
        <div
          className={`w-full ${computedMaxWidth} rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 flex flex-col min-h-[65vh] max-h-[85vh]`}
        >
          {/* Header */}
          <header className="shrink-0 flex items-center border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {title}
            </h2>
          </header>

          {/* Body: flex row (desktop), col (mobile). Both sides locked to same height. */}
          <div className={`flex flex-1 min-h-0 ${showRightPanel ? "flex-col sm:flex-row" : ""}`}>
            {/* ============================================================ */}
            {/* Left: Form area + footer buttons (Task 1.1)                   */}
            {/* ============================================================ */}
            <div className="flex-1 min-w-0 min-h-0 flex flex-col">
              {/* Scrollable form content */}
              <div className="flex-1 overflow-y-auto p-4">{children}</div>

              {/* Footer: Action buttons anchored to left panel bottom */}
              <div className="shrink-0 flex justify-end gap-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
                {onDelete && (
                  <Button
                    variant="danger"
                    size="md"
                    onClick={onDelete}
                    disabled={isSaving}
                  >
                    {deleteLabel}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="md"
                  onClick={attemptClose}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={onSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <span className="flex items-center gap-1">
                      <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
            </div>

            {/* ============================================================ */}
            {/* Right: Files panel                                            */}
            {/* ============================================================ */}
            {showRightPanel && (
              <div className="shrink-0 border-t border-zinc-200 sm:w-[420px] sm:border-l sm:border-t-0 dark:border-zinc-800 flex flex-col min-h-0">
                {/* ---- Nav bar with explicit action buttons (Task 1.6) ---- */}
                {hasFiles && selectedFile && (
                  <div className="shrink-0 flex items-center gap-1 px-3 py-2 border-b border-zinc-200 dark:border-zinc-800">
                    {/* < > navigation */}
                    <button
                      type="button"
                      disabled={selectedIndex <= 0}
                      onClick={handlePrev}
                      className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Previous file"
                    >
                      <ChevronLeftIcon className="h-4 w-4" />
                    </button>
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 tabular-nums min-w-[2.5rem] text-center">
                      {selectedIndex + 1} / {files.length}
                    </span>
                    <button
                      type="button"
                      disabled={selectedIndex >= files.length - 1}
                      onClick={handleNext}
                      className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Next file"
                    >
                      <ChevronRightIcon className="h-4 w-4" />
                    </button>

                    {/* File name + dropdown to jump to any file */}
                    <div className="relative flex-1 min-w-0 ml-1">
                      <button
                        type="button"
                        onClick={() => setFileDropdownOpen(prev => !prev)}
                        onBlur={() => setTimeout(() => setFileDropdownOpen(false), 150)}
                        className="flex items-center gap-0.5 w-full min-w-0 text-left"
                      >
                        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 truncate">
                          {selectedFile.name}
                        </span>
                        <svg className={`h-3 w-3 shrink-0 text-zinc-400 transition-transform ${fileDropdownOpen ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                        </svg>
                      </button>
                      {fileDropdownOpen && (
                        <div className="absolute z-20 left-0 top-full mt-1 w-56 rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                          <div className="max-h-48 overflow-y-auto py-1">
                            {files.map((f) => {
                              const isActive = f.id === selectedFileId;
                              return (
                                <button
                                  key={f.id}
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => { onSelectFile?.(f.id); setFileDropdownOpen(false); }}
                                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
                                    isActive
                                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                                      : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                  }`}
                                >
                                  <span className="flex-1 truncate">{f.name}</span>
                                  {f.isNew && (
                                    <span className="inline-flex items-center shrink-0 rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800 dark:bg-amber-800 dark:text-amber-200">
                                      New
                                    </span>
                                  )}
                                  {f.isMarkedForDeletion && (
                                    <span className="inline-flex items-center shrink-0 rounded-full bg-red-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-800 dark:bg-red-800 dark:text-red-200">
                                      Del
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Badges */}
                    {selectedFile.isNew && (
                      <span className="inline-flex items-center shrink-0 rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800 dark:bg-amber-800 dark:text-amber-200">
                        Unsaved
                      </span>
                    )}
                    {selectedFile.isMarkedForDeletion && (
                      <span className="inline-flex items-center shrink-0 rounded-full bg-red-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-800 dark:bg-red-800 dark:text-red-200">
                        To delete
                      </span>
                    )}

                    {/* Explicit action buttons (replaces ... menu) */}
                    <div className="flex items-center gap-0.5 ml-1">
                      {onFileUnlink && (
                        <button
                          type="button"
                          onClick={() => onFileUnlink(selectedFile.id)}
                          className="p-1 rounded text-zinc-400 hover:text-amber-500 hover:bg-zinc-100 dark:text-zinc-500 dark:hover:text-amber-400 dark:hover:bg-zinc-800 transition-colors"
                          title="Unlink"
                        >
                          <LinkSlashIcon className="h-4 w-4" />
                        </button>
                      )}
                      {onFileDownload && (
                        <button
                          type="button"
                          onClick={() => onFileDownload(selectedFile.id)}
                          className="p-1 rounded text-zinc-400 hover:text-amber-500 hover:bg-zinc-100 dark:text-zinc-500 dark:hover:text-amber-400 dark:hover:bg-zinc-800 transition-colors"
                          title="Download"
                        >
                          <ArrowDownTrayIcon className="h-4 w-4" />
                        </button>
                      )}
                      {onFileDelete && (
                        <button
                          type="button"
                          onClick={() => onFileDelete(selectedFile.id)}
                          className="p-1 rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:text-zinc-500 dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                          title="Delete"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* ---- Empty state: FileUploadZone + optional extras (Task 1.4 / 2.1) ---- */}
                {!hasFiles && (
                  <div className="flex-1 flex flex-col items-center justify-center p-4 min-h-0 gap-4">
                    {onFileUpload ? (
                      <>
                        <FileUploadZone
                          accept=".pdf,.jpg,.jpeg,.png,.webp"
                          file={null}
                          hasExistingFile={false}
                          onFileSelect={onFileUpload}
                          onFileClear={() => {}}
                          showEncryptedNotice={true}
                          multiple
                        />
                        {rightPanelExtras && (
                          <>
                            <div className="flex items-center gap-2 w-full max-w-xs">
                              <div className="flex-1 border-t border-zinc-200 dark:border-zinc-700" />
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">or</span>
                              <div className="flex-1 border-t border-zinc-200 dark:border-zinc-700" />
                            </div>
                            <div className="w-full">{rightPanelExtras}</div>
                          </>
                        )}
                      </>
                    ) : rightPanelExtras ? (
                      <div className="w-full">{rightPanelExtras}</div>
                    ) : (
                      <p className="text-sm text-zinc-400 dark:text-zinc-500">
                        No files attached
                      </p>
                    )}
                  </div>
                )}

                {/* ---- File list view: queued files, no preview (Task 1.5) ---- */}
                {hasFiles && !selectedFile && (
                  <div className="flex-1 overflow-y-auto min-h-0">
                    {files.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center gap-2 px-3 py-2 border-b border-zinc-100 last:border-b-0 dark:border-zinc-800/50"
                      >
                        <button
                          type="button"
                          onClick={() => onSelectFile?.(f.id)}
                          className="flex flex-1 items-center gap-2 min-w-0 text-left hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                        >
                          <DocumentIcon className="h-4 w-4 shrink-0 text-zinc-400" />
                          <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate">
                            {f.name}
                          </span>
                        </button>
                        {/* Badges */}
                        {f.isNew && (
                          <span className="inline-flex items-center shrink-0 rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800 dark:bg-amber-800 dark:text-amber-200">
                            Unsaved
                          </span>
                        )}
                        {f.isMarkedForDeletion && (
                          <span className="inline-flex items-center shrink-0 rounded-full bg-red-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-800 dark:bg-red-800 dark:text-red-200">
                            To delete
                          </span>
                        )}
                        {/* X button to delete/remove from queue */}
                        {onFileDelete && (
                          <button
                            type="button"
                            onClick={() => onFileDelete(f.id)}
                            className="p-1 rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:text-zinc-500 dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-colors shrink-0"
                            title="Remove"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* ---- Preview (only when file explicitly selected) ---- */}
                {hasFiles && selectedFile && (
                  <div className="flex-1 min-h-0">
                    <DocPreviewPanel
                      file={selectedFile.file ?? null}
                      existingFileName={
                        !selectedFile.file ? selectedFile.name : null
                      }
                      existingMime={selectedFile.mime}
                      existingIv={selectedFile.iv}
                      onLoadPreview={
                        !selectedFile.file && selectedFile.iv && onLoadPreview
                          ? () => onLoadPreview(selectedFile.id)
                          : undefined
                      }
                    />
                  </div>
                )}

                {/* Bottom: upload zone + extras side-by-side (Task 1.4 / 2.1) */}
                {hasFiles && (onFileUpload || rightPanelExtras || onLinkFile) && (
                  <div className="shrink-0 flex items-stretch border-t border-zinc-200 dark:border-zinc-800">
                    {onFileUpload && (
                      <div className="flex-1 min-w-0 px-4 py-3">
                        <FileUploadZone
                          accept=".pdf,.jpg,.jpeg,.png,.webp"
                          file={null}
                          hasExistingFile={true}
                          onFileSelect={onFileUpload}
                          onFileClear={() => {}}
                          showEncryptedNotice={false}
                          disabled={isUploading || isSaving}
                          multiple
                        />
                      </div>
                    )}
                    {rightPanelExtras && (
                      <div className="shrink-0 border-l border-zinc-200 dark:border-zinc-800 px-4 py-3 flex items-center">
                        {rightPanelExtras}
                      </div>
                    )}
                    {onLinkFile && (
                      <div className="shrink-0 border-l border-zinc-200 dark:border-zinc-800 px-4 py-3 flex items-center">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={onLinkFile}
                          disabled={isSaving}
                        >
                          Link file
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Close confirmation */}
      {showCloseConfirm && (
        <ConfirmDialog
          title="Unsaved changes"
          description="You have unsaved changes. If you cancel without saving, your changes will be lost. Do you want to continue?"
          confirmLabel="Yes, discard"
          cancelLabel="No, stay"
          onCancel={() => setShowCloseConfirm(false)}
          onConfirm={() => {
            setShowCloseConfirm(false);
            onClose();
          }}
        />
      )}
    </>
  );
}
