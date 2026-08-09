"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import type { Document } from "@/types/document";
import DocPreviewPanel from "./DocPreviewPanel";
import FileUploadZone from "./FileUploadZone";
import Button from "./Button";
import ConfirmDialog from "./ConfirmDialog";
import ErrorBanner from "./ErrorBanner";
import Toast, { type ToastType } from "./Toast";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  LinkSlashIcon,
  ArrowPathIcon,
  DocumentIcon,
} from "./Icons";
import { InputField, SelectField, CheckboxField } from "./FormField";
import RichTextEditor from "./RichTextEditor";
import { Pencil } from "lucide-react";
import { downloadDocumentFile } from "@/api/common/documentStorage";
import { trunc } from "@/lib/viewHelpers";
import { getUniqueFileName } from "@/lib/viewHelpers";

// ============================================================================
// Types
// ============================================================================

export interface ModalFile {
  id: string;
  name: string;
  mime?: string;
  iv?: string;
  /** Local File object for unsaved/new files — enables instant preview via blob URL */
  file?: File | null;
  isNew?: boolean;
  isMarkedForDeletion?: boolean;
  isMarkedForUnlink?: boolean;
}

export interface NewFileEntry {
  file: File;
  label: string;
  tempId: string;
}

export interface FileActions {
  newFiles: NewFileEntry[];
  docsToLink: string[];
  docsToUnlink: string[];
  docsToDelete: string[];
  /** Standalone file mode: linked parent record ID */
  linkedParentId?: string;
  /** Standalone file mode: new record data from inline form */
  newRecordData?: Record<string, string> | null;
}

/** Minimum shape for a parent record shown in the link dropdown */
export interface StoreParentRecord {
  id: string;
  name: string;
}

// ============================================================================
// Field Schema
// ============================================================================

export type FieldType =
  | "text"
  | "date"
  | "number"
  | "password"
  | "select"
  | "richtext"
  | "checkbox";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  /** For number fields */
  min?: number;
  step?: string;
  /** For select fields */
  options?: { value: string; label: string }[];
  /** For richtext fields */
  minHeight?: string;
}

interface ToastConfig {
  isVisible: boolean;
  message: string;
  type: ToastType;
}

// ============================================================================
// GenericDomainModal
// ============================================================================

export interface GenericDomainModalProps {
  // ── Mode ──
  /** "record" = left form + optional right files; "standalone_file" = left link/create + right single file */
  mode: "record" | "standalone_file";

  // ── Basic modal config ──
  title: string;
  onClose: () => void;
  /** Optional saved-callback: called after successful save (for modals that want to close) */
  onSaved?: () => void;

  // ── Form schema (record mode) ──
  /** Field definitions for the form. Only used in record mode. */
  fields?: FieldDef[];
  /** Initial values keyed by field key. Also used as the baseline for dirty checking. */
  initialData?: Record<string, unknown>;
  /** Optional: group field keys into rows. Each sub-array = one grid row.
   *  Fields in the same row share equal column width (up to sm:grid-cols-3).
   *  If omitted, each field gets its own full-width row. */
  layout?: string[][];

  // ── File handling (opt-in) ──
  /** Enables the right file pane for record mode. Ignored for standalone_file mode (always on). */
  allowFiles?: boolean;
  /** When false, hides the "Unlink" file action and the link-to-existing-document
   *  dropdown. Use for domains that don't support linking standalone files (e.g. expense, medical).
   *  Defaults to true (linking enabled). */
  allowLinking?: boolean;
  /** User ID for downloading/previewing encrypted files */
  userId?: string;
  /** Documents currently attached to the record being edited */
  attachedDocuments?: Document[];
  /** Standalone (unlinked) documents available for linking */
  standaloneDocuments?: Document[];
  /** Domain filter label used in the link-dropdown placeholder (e.g. "education", "taskmanager") */
  domain?: string;

  // ── Standalone file mode: parent linking ──
  parentRecords?: StoreParentRecord[];
  renderNewRecordForm?: (opts: {
    disabled: boolean;
    isSaving: boolean;
  }) => ReactNode;
  extractNewRecordData?: () => Record<string, string> | null;

  // ── Actions ──
  /** Called on save with form data + file actions. Throw on error; the shell catches + displays it. */
  onSave: (formData: Record<string, unknown>, fileActions: FileActions) => Promise<void>;
  /** Simple delete (no cascade). Show confirm dialog → call this. Throw on error. */
  onDelete?: () => Promise<void>;
  /** Cascade-aware delete. Shows confirm dialog with "delete associated files" checkbox. */
  onDeleteWithCascade?: (
    cascadeMode: "unlink" | "cascade",
  ) => Promise<void>;
  /** Label for delete button */
  deleteLabel?: string;
  /** Override the cascade-delete description text */
  deleteCascadeDescription?: string;
  /** Override the cascade-delete checkbox label */
  deleteCascadeFilesLabel?: string;

  // ── Document download override (domain-specific, e.g. from R2 vs local store) ──
  onDownloadDocument?: (doc: Document) => Promise<void>;

  // ── Styling ──
  maxWidthClassName?: string;
  zClassName?: string;
}

/** Normalize richtext content for dirty comparison.
 *  Empty HTML like `<p><br></p>` or `<p></p>` is treated as empty string. */
function normaliseRichtext(value: unknown): string {
  if (typeof value !== "string") return "";
  const stripped = value
    .replace(/<p>\s*<br\s*\/?>\s*<\/p>/gi, "")
    .replace(/<p>\s*<\/p>/gi, "")
    .replace(/&nbsp;/g, " ")
    .trim();
  return stripped;
}

export default function GenericDomainModal({
  mode,
  title,
  onClose,
  onSaved,
  fields = [],
  initialData = {},
  layout,
  allowFiles = false,
  allowLinking = true,
  userId = "",
  attachedDocuments = [],
  standaloneDocuments = [],
  domain = "",
  parentRecords = [],
  renderNewRecordForm,
  extractNewRecordData,
  onSave,
  onDelete,
  onDeleteWithCascade,
  deleteLabel = "Delete",
  deleteCascadeDescription,
  deleteCascadeFilesLabel,
  onDownloadDocument,
  maxWidthClassName,
  zClassName = "z-40",
}: GenericDomainModalProps) {
  // =========================================================================
  // Base UI state (was useModalBaseState)
  // =========================================================================
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [toastConfig, setToastConfig] = useState<ToastConfig>({
    isVisible: false,
    message: "",
    type: "success",
  });

  const triggerToast = useCallback(
    (message: string, type: ToastType = "success") => {
      setToastConfig({ isVisible: true, message, type });
      setTimeout(
        () => setToastConfig((prev) => ({ ...prev, isVisible: false })),
        2000,
      );
    },
    [],
  );

  // =========================================================================
  // Form state (schema-driven)
  // =========================================================================
  const [formData, setFormData] =
    useState<Record<string, unknown>>(initialData);

  // Sync formData when initialData changes (e.g. record switch, edit→create)
  const initialDataKey = JSON.stringify(initialData);
  const [prevDataKey, setPrevDataKey] = useState(initialDataKey);
  if (initialDataKey !== prevDataKey) {
    setPrevDataKey(initialDataKey);
    setFormData({ ...initialData });
  }

  const updateField = useCallback(
    (key: string, value: unknown) =>
      setFormData((prev) => ({ ...prev, [key]: value })),
    [],
  );

  // =========================================================================
  // File state (was useModalDocumentState, now fully owned here)
  // =========================================================================
  const [newFiles, setNewFiles] = useState<NewFileEntry[]>([]);
  const [markedForDeletion, setMarkedForDeletion] = useState<Set<string>>(
    new Set(),
  );
  const [markedForUnlink, setMarkedForUnlink] = useState<Set<string>>(
    new Set(),
  );
  const [stagedLinkDocId, setStagedLinkDocId] = useState<string | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [linkSearchQuery, setLinkSearchQuery] = useState("");
  const [linkDropdownOpen, setLinkDropdownOpen] = useState(false);

  // When standaloneDocuments change (e.g. after save),
  // clear stagedLinkDocId if the doc is no longer available.
  const [prevStandaloneDocs, setPrevStandaloneDocs] = useState(standaloneDocuments);
  if (standaloneDocuments !== prevStandaloneDocs) {
    setPrevStandaloneDocs(standaloneDocuments);
    if (stagedLinkDocId) {
      const stillExists = standaloneDocuments.some(
        (d) => d.id === stagedLinkDocId,
      );
      if (!stillExists) setStagedLinkDocId(null);
    }
  }

  // ── Reset all file state ──
  const resetFileState = useCallback(() => {
    setNewFiles([]);
    setMarkedForDeletion(new Set());
    setMarkedForUnlink(new Set());
    setStagedLinkDocId(null);
    setSelectedFileId(null);
    setLinkSearchQuery("");
    setLinkDropdownOpen(false);
  }, []);

  // =========================================================================
  // Derived: files array for the file panel
  // =========================================================================

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

    // Existing attached documents (keep all for badges, marked ones stay visible)
    let idx = 0;
    for (const doc of attachedDocuments) {
      entries.push({
        id: doc.id,
        rawName: doc.label || doc.file_name || "Unnamed Document",
        mime: doc.file_mime,
        iv: doc.file_iv,
        isMarkedForDeletion: markedForDeletion.has(doc.id) || undefined,
        isMarkedForUnlink: markedForUnlink.has(doc.id) || undefined,
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

    // Staged link (existing standalone document being linked)
    if (stagedLinkDocId) {
      const sd = standaloneDocuments.find((d) => d.id === stagedLinkDocId);
      if (sd) {
        entries.push({
          id: sd.id,
          rawName: sd.label || sd.file_name || "Unnamed Document",
          mime: sd.file_mime,
          iv: sd.file_iv,
          isNew: true,
          orderGroup: 2,
          orderIndex: 0,
        });
      }
    }

    // Deduplicate names by suffixing (1), (2), ...
    const buckets = new Map<string, FileEntry[]>();
    for (const e of entries) {
      if (!buckets.has(e.rawName)) buckets.set(e.rawName, []);
      buckets.get(e.rawName)!.push(e);
    }

    const result: ModalFile[] = [];
    for (const [, bucket] of buckets) {
      bucket.sort(
        (a, b) => a.orderGroup - b.orderGroup || a.orderIndex - b.orderIndex,
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
  }, [
    attachedDocuments,
    newFiles,
    stagedLinkDocId,
    markedForDeletion,
    markedForUnlink,
    standaloneDocuments,
  ]);

  // ── Auto-select first file once on initial load ──
  const hasAutoSelectedRef = useRef(false);
  useEffect(() => {
    if (!hasAutoSelectedRef.current && selectedFileId === null && files.length > 0) {
      hasAutoSelectedRef.current = true;
      setSelectedFileId(files[0].id);
    }
  }, [files, selectedFileId]);

  // =========================================================================
  // Derived: available/filtered standalone docs for link dropdown
  // =========================================================================

  const availableStandalone = useMemo(() => {
    const linked = new Set(attachedDocuments.map((d) => d.id));
    return standaloneDocuments.filter(
      (d) => !linked.has(d.id) && d.id !== stagedLinkDocId,
    );
  }, [standaloneDocuments, attachedDocuments, stagedLinkDocId]);

  const filteredLinkDocs = useMemo(() => {
    if (!linkSearchQuery.trim()) return availableStandalone;
    const q = linkSearchQuery.toLowerCase();
    return availableStandalone.filter(
      (d) =>
        (d.label || "").toLowerCase().includes(q) ||
        (d.file_name || "").toLowerCase().includes(q),
    );
  }, [availableStandalone, linkSearchQuery]);

  // =========================================================================
  // Dirty check
  // =========================================================================

  // Normalize richtext fields for dirty comparison: empty HTML like
  // "<p><br></p>" or "<p></p>" is equivalent to an empty string.
  const isFormDirty = useMemo(() => {
    const keys = new Set([...Object.keys(formData), ...Object.keys(initialData)]);
    for (const key of keys) {
      const field = fields.find((f) => f.key === key);
      const a = field?.type === "richtext" ? normaliseRichtext(formData[key]) : (formData[key] ?? "");
      const b = field?.type === "richtext" ? normaliseRichtext(initialData[key]) : (initialData[key] ?? "");
      if (JSON.stringify(a) !== JSON.stringify(b)) return true;
    }
    return false;
  }, [formData, initialData, fields]);

  const isFileDirty =
    newFiles.length > 0 ||
    stagedLinkDocId !== null ||
    markedForDeletion.size > 0 ||
    markedForUnlink.size > 0;

  const isDirty = isFormDirty || isFileDirty;

  // =========================================================================
  // File handlers
  // =========================================================================

  const handleFileUpload = useCallback(
    (file: File) => {
      const taken = new Set<string>();
      // Collect taken names from existing docs (not marked for removal)
      for (const doc of attachedDocuments) {
        if (markedForDeletion.has(doc.id) || markedForUnlink.has(doc.id))
          continue;
        if (doc.label) taken.add(doc.label);
      }
      // From staged link
      if (stagedLinkDocId) {
        const sd = standaloneDocuments.find((d) => d.id === stagedLinkDocId);
        if (sd?.label) taken.add(sd.label);
      }
      // From already-staged new files
      for (const nf of newFiles) taken.add(nf.label);

      const label = getUniqueFileName(file.name, taken);
      const tempId = `new-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      setNewFiles((prev) => [...prev, { file, label, tempId }]);
      setSelectedFileId(null);
    },
    [
      attachedDocuments,
      newFiles,
      markedForDeletion,
      markedForUnlink,
      stagedLinkDocId,
      standaloneDocuments,
    ],
  );

  const handleFileDelete = useCallback(
    (fileId: string) => {
      // New file — just remove from staging
      const newFile = newFiles.find((nf) => nf.tempId === fileId);
      if (newFile) {
        setNewFiles((prev) => prev.filter((nf) => nf.tempId !== fileId));
        if (selectedFileId === fileId) setSelectedFileId(null);
        return;
      }

      // Staged link — clear it
      if (stagedLinkDocId === fileId) {
        setStagedLinkDocId(null);
        if (selectedFileId === fileId) setSelectedFileId(null);
        return;
      }

      // Existing doc — toggle markedForDeletion, clear unlink
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
    },
    [newFiles, stagedLinkDocId, selectedFileId],
  );

  const handleFileUnlink = useCallback(
    (fileId: string) => {
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
    },
    [newFiles, stagedLinkDocId],
  );

  const handleFileDownload = useCallback(
    async (fileId: string) => {
      // New file (local)
      const nf = newFiles.find((f) => f.tempId === fileId);
      if (nf) {
        const url = URL.createObjectURL(nf.file);
        const a = document.createElement("a");
        a.href = url;
        a.download = nf.label;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      }

      // Try attached + all documents
      const allDocs = [...attachedDocuments, ...standaloneDocuments];
      const doc = allDocs.find((d) => d.id === fileId);
      if (!doc) return;

      // Domain-specific download
      if (onDownloadDocument) {
        try {
          await onDownloadDocument(doc);
        } catch (err) {
          alert(
            err instanceof Error
              ? err.message
              : "Failed to download document.",
          );
        }
        return;
      }

      // Generic R2 download
      if (doc.file_name && doc.file_iv && doc.file_mime) {
        try {
          const blob = await downloadDocumentFile(
            userId,
            doc.file_name,
            doc.file_iv,
            doc.file_mime,
          );
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = doc.label || "document";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } catch (err) {
          alert(
            err instanceof Error
              ? err.message
              : "Failed to download document.",
          );
        }
      }
    },
    [
      newFiles,
      attachedDocuments,
      standaloneDocuments,
      userId,
      onDownloadDocument,
    ],
  );

  const handleFileRename = useCallback(
    (fileId: string, newName: string) => {
      // Check new files
      const nf = newFiles.find((f) => f.tempId === fileId);
      if (nf) {
        setNewFiles((prev) =>
          prev.map((f) =>
            f.tempId === fileId ? { ...f, label: newName } : f,
          ),
        );
        return;
      }
      // For existing docs, the rename is handled by the domain on save
      // (we don't mutate attachedDocuments here)
    },
    [newFiles],
  );

  const handleLoadPreview = useCallback(
    async (fileId: string): Promise<Blob> => {
      const nf = newFiles.find((f) => f.tempId === fileId);
      if (nf) return nf.file;

      const allDocs = [...attachedDocuments, ...standaloneDocuments];
      const doc = allDocs.find((d) => d.id === fileId);
      if (!doc || !doc.file_name || !doc.file_iv || !doc.file_mime) {
        throw new Error("Cannot load preview.");
      }
      return downloadDocumentFile(
        userId,
        doc.file_name,
        doc.file_iv,
        doc.file_mime,
      );
    },
    [newFiles, attachedDocuments, standaloneDocuments, userId],
  );

  const handleLinkDropdownSelect = useCallback((docId: string) => {
    if (!docId) return;
    setStagedLinkDocId(docId);
    setLinkSearchQuery("");
    setLinkDropdownOpen(false);
    setSelectedFileId(null);
  }, []);

  // =========================================================================
  // Save handler
  // =========================================================================

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      // Auto-trim text/richtext/password fields
      const trimmedFormData = { ...formData };
      for (const field of fields) {
        if (
          field.type === "text" ||
          field.type === "richtext" ||
          field.type === "password"
        ) {
          if (typeof trimmedFormData[field.key] === "string") {
            trimmedFormData[field.key] = (
              trimmedFormData[field.key] as string
            ).trim();
          }
        }
      }

      const fileActions: FileActions = {
        newFiles: [...newFiles],
        docsToLink: stagedLinkDocId ? [stagedLinkDocId] : [],
        docsToUnlink: [...markedForUnlink],
        docsToDelete: [...markedForDeletion],
        linkedParentId: isStandaloneFile
          ? parentLinkedId || undefined
          : undefined,
        newRecordData: isStandaloneFile
          ? (extractNewRecordData?.() ?? null)
          : null,
      };

      await onSave(trimmedFormData, fileActions);

      // Sync formData with trimmed values so dirty check resets
      setFormData(trimmedFormData);

      // Clear file state on success
      resetFileState();

      triggerToast("✓ Saved", "success");
      onSaved?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  // =========================================================================
  // Delete handler
  // =========================================================================

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async (
    cascadeModeOrDeleteFiles?: boolean | string,
  ) => {
    setShowDeleteConfirm(false);
    setIsSaving(true);
    setError(null);
    try {
      if (
        onDeleteWithCascade &&
        typeof cascadeModeOrDeleteFiles === "boolean"
      ) {
        // Cascade dialog: user chose cascade or unlink
        await onDeleteWithCascade(
          cascadeModeOrDeleteFiles ? "cascade" : "unlink",
        );
      } else if (onDeleteWithCascade) {
        // Simple dialog: default to unlink
        await onDeleteWithCascade("unlink");
      } else if (onDelete) {
        await onDelete();
      }
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  // =========================================================================
  // File navigation
  // =========================================================================

  const selectedIndex = selectedFileId
    ? files.findIndex((f) => f.id === selectedFileId)
    : -1;
  const selectedFile = selectedIndex >= 0 ? files[selectedIndex] : undefined;

  const handlePrev = () => {
    if (selectedIndex <= 0) return;
    setSelectedFileId(files[selectedIndex - 1].id);
  };

  const handleNext = () => {
    if (selectedIndex >= files.length - 1) return;
    setSelectedFileId(files[selectedIndex + 1].id);
  };

  // =========================================================================
  // Close handling (Esc / Backdrop)
  // =========================================================================

  const isDirtyRef = useRef(isDirty);
  useLayoutEffect(() => {
    isDirtyRef.current = isDirty;
  });

  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const attemptClose = () => {
    if (isDirtyRef.current) {
      setShowCloseConfirm(true);
    } else {
      onClose();
    }
  };

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

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      attemptClose();
    }
  };

  // =========================================================================
  // Inline rename state
  // =========================================================================

  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");

  const startRename = (file: ModalFile) => {
    setRenamingFileId(file.id);
    setRenameText(file.name);
  };

  const commitRename = () => {
    if (renamingFileId && renameText.trim() && handleFileRename) {
      handleFileRename(renamingFileId, renameText.trim());
    }
    setRenamingFileId(null);
    setRenameText("");
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      commitRename();
    } else if (e.key === "Escape") {
      setRenamingFileId(null);
      setRenameText("");
    }
  };

  // =========================================================================
  // File dropdown state
  // =========================================================================

  const [fileDropdownOpen, setFileDropdownOpen] = useState(false);

  // =========================================================================
  // Standalone file mode: parent record dropdown
  // =========================================================================

  const [parentLinkedId, setParentLinkedId] = useState("");
  const [parentSearchQuery, setParentSearchQuery] = useState("");
  const [parentDropdownOpen, setParentDropdownOpen] = useState(false);

  const filteredParents = useMemo(() => {
    if (!parentSearchQuery.trim()) return parentRecords;
    const q = parentSearchQuery.toLowerCase();
    return parentRecords.filter((r) => r.name.toLowerCase().includes(q));
  }, [parentRecords, parentSearchQuery]);

  const selectedParent = parentLinkedId
    ? parentRecords.find((r) => r.id === parentLinkedId)
    : null;
  const parentDisplayValue =
    parentLinkedId && selectedParent
      ? selectedParent.name.length > 55
        ? selectedParent.name.slice(0, 55) + "…"
        : selectedParent.name
      : parentSearchQuery;

  // =========================================================================
  // Layout decisions
  // =========================================================================

  const isStandaloneFile = mode === "standalone_file";
  const hasFiles = files.length > 0;

  // For standalone_file: max 1 file, upload only allowed if no file yet
  const canUploadStandalone =
    !isStandaloneFile || (isStandaloneFile && files.length === 0);

  // Show right panel if:
  // - record mode with allowFiles (always show upload zone, even empty)
  // - standalone_file mode (always show)


  // For record mode without files: no right panel at all
  const actualShowRightPanel = isStandaloneFile
    ? true
    : allowFiles;

  const computedMaxWidth =
    maxWidthClassName ??
    (actualShowRightPanel ? "max-w-6xl" : "max-w-md");

  // =========================================================================
  // Link dropdown extras (for record mode with standalone document linking)
  // =========================================================================

  const linkDropdownExtras = useMemo(() => {
    if (isStandaloneFile) return null;
    if (!allowFiles) return null;
    if (standaloneDocuments.length === 0 && !stagedLinkDocId) return null;

    // Build display names (with dedup numbering)
    const labelBuckets = new Map<string, Document[]>();
    for (const doc of standaloneDocuments) {
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
            `${trunc(doc.label || "Unnamed", 50)} (${i + 1})`,
          );
        });
      }
    }

    const fmt = (doc: Document): string =>
      displayName.get(doc.id) || trunc(doc.label || "Unnamed", 55);

    const stagedDoc = stagedLinkDocId
      ? standaloneDocuments.find((d) => d.id === stagedLinkDocId)
      : null;
    const stagedLabel = stagedDoc ? fmt(stagedDoc) : null;
    const displayValue = stagedLinkDocId
      ? (stagedLabel ?? "")
      : linkSearchQuery;

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
            onClick={() => setLinkDropdownOpen((prev) => !prev)}
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
                    onClick={() => handleLinkDropdownSelect(doc.id)}
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
    isStandaloneFile,
    allowFiles,
    standaloneDocuments,
    stagedLinkDocId,
    linkSearchQuery,
    linkDropdownOpen,
    filteredLinkDocs,
    isSaving,
    handleLinkDropdownSelect,
  ]);

  // =========================================================================
  // Linked docs count / cascade-delete trigger
  // =========================================================================

  const linkedDocCount = attachedDocuments.length;

  // For standalone_file mode, show cascade only if the document is linked to a parent record.
  // For record mode, show cascade when there are linked files (attached docs).
  const showDeleteCascade = isStandaloneFile
    ? linkedDocCount > 0 && !!attachedDocuments[0]?.linked_id
    : linkedDocCount > 0;

  // =========================================================================
  // Dynamic field rendering (schema-driven form)
  // =========================================================================

  const renderField = useCallback(
    (field: FieldDef) => {
      const value = formData[field.key] ?? "";
      const disabled = isSaving;

      switch (field.type) {
        case "text":
          return (
            <InputField
              key={field.key}
              label={field.label}
              value={value as string}
              onChange={(v) => updateField(field.key, v)}
              placeholder={field.placeholder}
              disabled={disabled}
            />
          );
        case "date":
          return (
            <InputField
              key={field.key}
              label={field.label}
              type="date"
              value={value as string}
              onChange={(v) => updateField(field.key, v)}
              disabled={disabled}
            />
          );
        case "number":
          return (
            <InputField
              key={field.key}
              label={field.label}
              type="number"
              value={value as string}
              onChange={(v) => updateField(field.key, v)}
              placeholder={field.placeholder}
              min={field.min}
              step={field.step}
              disabled={disabled}
            />
          );
        case "password":
          return (
            <InputField
              key={field.key}
              label={field.label}
              type="password"
              value={value as string}
              onChange={(v) => updateField(field.key, v)}
              placeholder={field.placeholder}
              disabled={disabled}
            />
          );
        case "select":
          return (
            <SelectField
              key={field.key}
              label={field.label}
              value={value as string}
              onChange={(v) => updateField(field.key, v)}
              options={field.options || []}
              disabled={disabled}
            />
          );
        case "richtext":
          return (
            <div key={field.key}>
              <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                {field.label}
              </label>
              <RichTextEditor
                value={value as string}
                onChange={(v) => updateField(field.key, v)}
                disabled={disabled}
                minHeight={field.minHeight || "8rem"}
              />
            </div>
          );
        case "checkbox":
          return (
            <CheckboxField
              key={field.key}
              label={field.label}
              checked={!!value}
              onChange={(v) => updateField(field.key, v)}
              disabled={disabled}
              id={field.key}
            />
          );
        default:
          return null;
      }
    },
    [formData, isSaving, updateField],
  );

  const renderFormFields = useMemo(() => {
    if (fields.length === 0) return null;

    const fieldMap = new Map(fields.map((f) => [f.key, f]));

    if (layout && layout.length > 0) {
      return layout.map((row, rowIdx) => {
        const cols = Math.min(row.length, 3);
        const colClass =
          cols >= 3
            ? "sm:grid-cols-3"
            : cols === 2
              ? "sm:grid-cols-2"
              : "sm:grid-cols-1";
        return (
          <div key={rowIdx} className={`grid gap-3 ${colClass}`}>
            {row.map((key) => {
              const field = fieldMap.get(key);
              return field ? renderField(field) : null;
            })}
          </div>
        );
      });
    }

    // No layout: one field per row
    return (
      <div className="flex flex-col space-y-3">
        {fields.map((f) => renderField(f))}
      </div>
    );
  }, [fields, layout, renderField]);

  // =========================================================================
  // Render
  // =========================================================================

  const domainLabel = domain
    ? domain.charAt(0).toUpperCase() + domain.slice(1)
    : "";

  return (
    <>
      <Toast
        isVisible={toastConfig.isVisible}
        message={toastConfig.message}
        type={toastConfig.type}
      />

      {/* ================================================================= */}
      {/* Modal backdrop + container                                        */}
      {/* ================================================================= */}
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

          {/* Body */}
          <div
            className={`flex flex-1 min-h-0 ${actualShowRightPanel ? "flex-col sm:flex-row" : ""}`}
          >
            {/* ============================================================= */}
            {/* Left: Form area (record mode) or Link/Create (standalone)      */}
            {/* ============================================================= */}
            <div className="flex-1 min-w-0 min-h-0 flex flex-col">
              <div className="flex-1 overflow-y-auto p-4">
                {isStandaloneFile ? (
                  /* ---- Standalone file mode: link/create form ---- */
                  <div className="flex flex-col h-full space-y-3">
                    {/* Parent record dropdown */}
                    {parentRecords.length > 0 && (
                      <div className="relative">
                        <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                          Link to existing {domainLabel} record
                        </span>
                        <div className="relative flex items-center">
                          <input
                            type="text"
                            value={parentDisplayValue}
                            onChange={(e) => {
                              if (parentLinkedId) setParentLinkedId("");
                              setParentSearchQuery(e.target.value);
                              if (!parentDropdownOpen)
                                setParentDropdownOpen(true);
                            }}
                            onFocus={() => {
                              if (!parentDropdownOpen)
                                setParentDropdownOpen(true);
                            }}
                            onBlur={() =>
                              setTimeout(
                                () => setParentDropdownOpen(false),
                                150,
                              )
                            }
                            placeholder={`Search ${domain} records...`}
                            disabled={isSaving}
                            className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 pr-16 text-xs outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                          />
                          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                            {parentLinkedId && (
                              <button
                                type="button"
                                onClick={() => {
                                  setParentLinkedId("");
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
                              onClick={() =>
                                setParentDropdownOpen((prev) => !prev)
                              }
                              disabled={isSaving}
                              className="p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 disabled:opacity-50"
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
                        </div>

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
                                      setParentLinkedId(parent.id);
                                      setParentSearchQuery("");
                                      setParentDropdownOpen(false);
                                    }}
                                    className="w-full px-3 py-1.5 text-left text-xs text-zinc-700 hover:bg-emerald-50 hover:text-emerald-700 dark:text-zinc-300 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400"
                                  >
                                    {parent.name.length > 55
                                      ? parent.name.slice(0, 55) + "…"
                                      : parent.name}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="px-3 py-2 text-xs text-zinc-400">
                                {parentSearchQuery
                                  ? "No matching records"
                                  : `No ${domain} records available`}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* --- or --- divider + inline creation form */}
                    {renderNewRecordForm && (
                      <>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 border-t border-zinc-200 dark:border-zinc-700" />
                          <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase">
                            — or —
                          </span>
                          <div className="flex-1 border-t border-zinc-200 dark:border-zinc-700" />
                        </div>
                        {renderNewRecordForm({
                          disabled: parentLinkedId !== "",
                          isSaving,
                        })}
                      </>
                    )}

                    {error && <ErrorBanner message={error} />}
                  </div>
                ) : (
                  /* ---- Record mode: schema-driven form fields ---- */
                  <div className="flex flex-col h-full space-y-3">
                    {error && <ErrorBanner message={error} />}
                    {renderFormFields}
                  </div>
                )}
              </div>

              {/* Footer: Action buttons */}
              <div className="shrink-0 flex justify-end gap-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
                {(onDelete || onDeleteWithCascade) && (
                  <Button
                    variant="danger"
                    size="md"
                    onClick={handleDeleteClick}
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
                  onClick={handleSave}
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

            {/* ============================================================= */}
            {/* Right: Files panel                                             */}
            {/* ============================================================= */}
            {actualShowRightPanel && (
              <div className="sm:shrink-0 border-t border-zinc-200 sm:w-[420px] sm:border-l sm:border-t-0 dark:border-zinc-800 flex flex-col min-h-0 flex-1 min-w-0">
                {/* ---- Nav bar with action buttons ---- */}
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

                    {/* File name + dropdown */}
                    <div className="relative flex-1 min-w-0 ml-1">
                      {renamingFileId === selectedFile.id ? (
                        <input
                          type="text"
                          value={renameText}
                          onChange={(e) => setRenameText(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={handleRenameKeyDown}
                          className="w-full rounded border border-emerald-400 px-1 py-0.5 text-xs font-medium text-zinc-900 outline-none focus:ring-1 focus:ring-emerald-500 dark:bg-zinc-800 dark:text-zinc-100 dark:border-emerald-600"
                          autoFocus
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setFileDropdownOpen((prev) => !prev)
                          }
                          onBlur={() =>
                            setTimeout(
                              () => setFileDropdownOpen(false),
                              150,
                            )
                          }
                          className="flex items-center gap-0.5 w-full min-w-0 text-left"
                        >
                          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 truncate">
                            {selectedFile.name}
                          </span>
                          <svg
                            className={`h-3 w-3 shrink-0 text-zinc-400 transition-transform ${fileDropdownOpen ? "rotate-180" : ""}`}
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
                      )}
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
                                  onClick={() => {
                                    setSelectedFileId(f.id);
                                    setFileDropdownOpen(false);
                                  }}
                                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
                                    isActive
                                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                                      : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                  }`}
                                >
                                  <span className="flex-1 truncate">
                                    {f.name}
                                  </span>
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
                    {selectedFile.isMarkedForUnlink && (
                      <span className="inline-flex items-center shrink-0 rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800 dark:bg-amber-800 dark:text-amber-200">
                        To unlink
                      </span>
                    )}
                    {selectedFile.isMarkedForDeletion && (
                      <span className="inline-flex items-center shrink-0 rounded-full bg-red-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-800 dark:bg-red-800 dark:text-red-200">
                        To delete
                      </span>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-0.5 ml-1">
                      <button
                        type="button"
                        onClick={() => startRename(selectedFile)}
                        className="p-1 rounded text-zinc-400 hover:text-emerald-500 hover:bg-zinc-100 dark:text-zinc-500 dark:hover:text-emerald-400 dark:hover:bg-zinc-800 transition-colors"
                        title="Rename"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {allowLinking && !isStandaloneFile && handleFileUnlink && (
                        <button
                          type="button"
                          onClick={() =>
                            handleFileUnlink(selectedFile.id)
                          }
                          className="p-1 rounded text-zinc-400 hover:text-amber-500 hover:bg-zinc-100 dark:text-zinc-500 dark:hover:text-amber-400 dark:hover:bg-zinc-800 transition-colors"
                          title="Unlink"
                        >
                          <LinkSlashIcon className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          handleFileDownload(selectedFile.id)
                        }
                        className="p-1 rounded text-zinc-400 hover:text-amber-500 hover:bg-zinc-100 dark:text-zinc-500 dark:hover:text-amber-400 dark:hover:bg-zinc-800 transition-colors"
                        title="Download"
                      >
                        <ArrowDownTrayIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleFileDelete(selectedFile.id)
                        }
                        className="p-1 rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:text-zinc-500 dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                        title="Delete"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* ---- Empty state: FileUploadZone + link extras ---- */}
                {!hasFiles && (
                  <div className="flex-1 flex flex-col items-center justify-center p-4 min-h-0 gap-4">
                    {canUploadStandalone ? (
                      <>
                        <FileUploadZone
                          accept=".pdf,.jpg,.jpeg,.png,.webp"
                          file={null}
                          hasExistingFile={false}
                          onFileSelect={handleFileUpload}
                          onFileClear={() => {}}
                          showEncryptedNotice={true}
                          multiple={!isStandaloneFile}
                        />
                        {allowLinking && !isStandaloneFile && linkDropdownExtras && (
                          <>
                            <div className="flex items-center gap-2 w-full max-w-xs">
                              <div className="flex-1 border-t border-zinc-200 dark:border-zinc-700" />
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                                or
                              </span>
                              <div className="flex-1 border-t border-zinc-200 dark:border-zinc-700" />
                            </div>
                            <div className="w-full">{linkDropdownExtras}</div>
                          </>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-zinc-400 dark:text-zinc-500">
                        One file already attached
                      </p>
                    )}
                  </div>
                )}

                {/* ---- File list view (no preview selected) ---- */}
                {hasFiles && !selectedFile && (
                  <div className="flex-1 overflow-y-auto min-h-0">
                    {files.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center gap-2 px-3 py-2 border-b border-zinc-100 last:border-b-0 dark:border-zinc-800/50"
                      >
                        {renamingFileId === f.id ? (
                          <input
                            type="text"
                            value={renameText}
                            onChange={(e) => setRenameText(e.target.value)}
                            onBlur={commitRename}
                            onKeyDown={handleRenameKeyDown}
                            className="flex-1 min-w-0 rounded border border-emerald-400 px-1.5 py-0.5 text-sm text-zinc-900 outline-none focus:ring-1 focus:ring-emerald-500 dark:bg-zinc-800 dark:text-zinc-100 dark:border-emerald-600"
                            autoFocus
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedFileId(f.id)}
                            className="flex flex-1 items-center gap-2 min-w-0 text-left hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                          >
                            <DocumentIcon className="h-4 w-4 shrink-0 text-zinc-400" />
                            <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate">
                              {f.name}
                            </span>
                          </button>
                        )}
                        {/* Badges */}
                        {f.isNew && (
                          <span className="inline-flex items-center shrink-0 rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800 dark:bg-amber-800 dark:text-amber-200">
                            Unsaved
                          </span>
                        )}
                        {f.isMarkedForUnlink && (
                          <span className="inline-flex items-center shrink-0 rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800 dark:bg-amber-800 dark:text-amber-200">
                            To unlink
                          </span>
                        )}
                        {f.isMarkedForDeletion && (
                          <span className="inline-flex items-center shrink-0 rounded-full bg-red-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-800 dark:bg-red-800 dark:text-red-200">
                            To delete
                          </span>
                        )}
                        {/* Rename button */}
                        {renamingFileId !== f.id && (
                          <button
                            type="button"
                            onClick={() => startRename(f)}
                            className="p-1 rounded text-zinc-400 hover:text-emerald-500 hover:bg-zinc-100 dark:text-zinc-500 dark:hover:text-emerald-400 dark:hover:bg-zinc-800 transition-colors shrink-0"
                            title="Rename"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {/* Remove button */}
                        <button
                          type="button"
                          onClick={() => handleFileDelete(f.id)}
                          className="p-1 rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:text-zinc-500 dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-colors shrink-0"
                          title="Remove"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
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
                        !selectedFile.file && selectedFile.iv
                          ? () => handleLoadPreview(selectedFile.id)
                          : undefined
                      }
                    />
                  </div>
                )}

                {/* Bottom: upload zone + link extras (when files exist) */}
                {hasFiles && canUploadStandalone && (
                  <div className="shrink-0 flex items-stretch border-t border-zinc-200 dark:border-zinc-800">
                    <div className="flex-1 min-w-0 px-4 py-3">
                      <FileUploadZone
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        file={null}
                        hasExistingFile={true}
                        onFileSelect={handleFileUpload}
                        onFileClear={() => {}}
                        showEncryptedNotice={false}
                        disabled={isSaving}
                        multiple={!isStandaloneFile}
                      />
                    </div>
                    {allowLinking && !isStandaloneFile && linkDropdownExtras && (
                      <div className="shrink-0 border-l border-zinc-200 dark:border-zinc-800 px-4 py-3 flex items-center">
                        {linkDropdownExtras}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Close confirmation (unsaved changes) */}
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

      {/* Delete confirmation (cascade mode) */}
      {showDeleteConfirm && onDeleteWithCascade && showDeleteCascade && (
        <ConfirmDialog
          title={`${deleteLabel}?`}
          description={
            deleteCascadeDescription ??
            `This record has ${linkedDocCount} linked file(s).`
          }
          confirmLabel={deleteLabel}
          cancelLabel="Cancel"
          showDeleteFilesCheckbox
          deleteFilesLabel={deleteCascadeFilesLabel ?? "Delete associated files"}
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={async (deleteFiles) => {
            await handleDeleteConfirm(deleteFiles);
          }}
        />
      )}

      {showDeleteConfirm &&
        !showDeleteCascade &&
        (onDelete || onDeleteWithCascade) && (
          <ConfirmDialog
            title={`${deleteLabel}?`}
            description="Are you sure? This cannot be undone."
            confirmLabel={deleteLabel}
            cancelLabel="Cancel"
            onCancel={() => setShowDeleteConfirm(false)}
            onConfirm={async () => {
              await handleDeleteConfirm();
            }}
          />
        )}
    </>
  );
}
