"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import type { Education } from "@/types/education";
import type { Document } from "@/types/document";
import { downloadDocumentFile } from "@/api/common/documentStorage";
import type { Priority } from "@/types/taskmanager";
import { PRIORITIES } from "@/types/taskmanager";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import GlobalActionModal from "@/components/common/GlobalActionModal";
import type { ModalFile } from "@/components/common/GlobalActionModal";
import { useModalDocumentState } from "@/lib/useModalDocumentState";
import { InputField, SelectField, CheckboxField } from "@/components/common/FormField";
import RichTextEditor from "@/components/common/RichTextEditor";
import ErrorBanner from "@/components/common/ErrorBanner";
import { docsForEducation, getUniqueFileName, trunc } from "./helpers";

// --- Types ---

interface EducationDraft {
  name: string;
  provider: string;
  priority: Priority;
  due_date: string | null;
  description: string;
  is_completed: boolean;
}

interface EducationModalProps {
  education: Education | null;
  documents: Document[];
  /** ALL educations (needed for standalone mode dropdown) */
  allEducations?: Education[];
  userId: string;
  onClose: () => void;
  onSave: (draft: EducationDraft, existingEducation: Education | null, pendingDoc?: { file: File; label: string }, pendingLinkDocId?: string, pendingUnlinkDocIds?: string[], pendingDeleteDocIds?: string[]) => Promise<void>;
  onDelete: (educationId: string, cascadeMode: 'unlink' | 'cascade') => Promise<void>;
  onUploadDocument: (educationId: string, file: File, label: string) => Promise<Document>;
  onDownloadDocument: (document: Document) => Promise<void>;
  onDeleteDocument: (document: Document, cascadeMode: 'unlink' | 'cascade') => Promise<void>;
  onLinkDocument: (educationId: string, documentId: string) => Promise<void>;
  onUnlinkDocument: (educationId: string, documentId: string) => Promise<void>;
  // --- Standalone mode ---
  /** When true: form becomes "link existing OR create new" instead of standard education edit */
  isStandaloneMode?: boolean;
  /** Called instead of onSave in standalone mode */
  onSaveStandalone?: (params: {
    file: File;
    label: string;
    linkedEducationId?: string;
    newEducation?: { name: string; provider: string };
  }) => Promise<void>;
}

// ============================================================
// Main Modal
// ============================================================

export default function EducationModal({
  education,
  documents,
  allEducations,
  userId,
  onClose,
  onSave,
  onDelete,
  onDownloadDocument,
  isStandaloneMode = false,
  onSaveStandalone,
}: EducationModalProps) {
  // --- Form state ---
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Delete confirmation ---
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // --- Document management ---
  const [newFiles, setNewFiles] = useState<{ file: File; label: string; tempId: string }[]>([]);
  const [markedForDeletion, setMarkedForDeletion] = useState<Set<string>>(new Set());
  const [markedForUnlink, setMarkedForUnlink] = useState<Set<string>>(new Set());
  const [selectedDocId, setSelectedDocId] = useState<string | null>(() => {
    if (isStandaloneMode || !education) return null;
    const docs = docsForEducation(education.id, documents);
    return docs.length > 0 ? docs[0].id : null;
  });

  // Moved up: needed by the hook below
  const linkedDocs = useMemo(
    () => education ? docsForEducation(education.id, documents) : [],
    [education, documents]
  );
  const standaloneDocs = documents.filter(
    (d) => d.domain === "education" && !d.linked_id
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

  // Standalone mode state
  const [standaloneFile, setStandaloneFile] = useState<File | null>(null);
  const [standaloneLinkedEduId, setStandaloneLinkedEduId] = useState("");
  const [standaloneNewEduName, setStandaloneNewEduName] = useState("");
  const [standaloneNewEduProvider, setStandaloneNewEduProvider] = useState("");

  // --- Reset on open ---
  useEffect(() => {
    if (isStandaloneMode) {
      setName("");
      setProvider("");
      setPriority("medium");
      setDueDate("");
      setDescription("");
      setIsCompleted(false);
    } else {
      const todayStr = new Date().toISOString().split("T")[0];
      setName(education?.name ?? "");
      setProvider(education?.provider ?? "");
      setPriority(education?.priority ?? "medium");
      setDueDate(education ? (education?.due_date ?? "") : todayStr);
      setDescription(education?.description ?? "");
      setIsCompleted(education?.is_completed ?? false);
    }
    setError(null);
    setShowDeleteConfirm(false);
    setNewFiles([]);
    setMarkedForDeletion(new Set());
    setMarkedForUnlink(new Set());
    hookResetFileState();
    const existingDocs = education ? docsForEducation(education.id, documents) : [];
    setSelectedDocId(existingDocs.length > 0 ? existingDocs[0].id : null);
    setStandaloneFile(null);
    setStandaloneLinkedEduId("");
    setStandaloneNewEduName("");
    setStandaloneNewEduProvider("");
  }, [education, isStandaloneMode, documents]);

  // ── Baseline form values ──
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const formBaseline = useMemo(() => ({
    name: education?.name ?? "",
    provider: education?.provider ?? "",
    priority: education?.priority ?? "medium",
    dueDate: education ? (education.due_date ?? "") : todayStr,
    description: education?.description ?? "",
    isCompleted: education?.is_completed ?? false,
  }), [education, todayStr]);

  // --- Dirty check ---

  const hasFormChanges =
    name !== formBaseline.name ||
    provider !== formBaseline.provider ||
    priority !== formBaseline.priority ||
    dueDate !== formBaseline.dueDate ||
    description !== formBaseline.description ||
    isCompleted !== formBaseline.isCompleted;

  const isDirty = isStandaloneMode
    ? standaloneFile !== null || standaloneLinkedEduId !== "" || standaloneNewEduName !== "" || standaloneNewEduProvider !== ""
    : hasFormChanges || newFiles.length > 0 || stagedLinkDocId !== null || markedForDeletion.size > 0 || markedForUnlink.size > 0;

  // --- Build files array for GlobalActionModal ---

  const files: ModalFile[] = useMemo(() => {
    if (isStandaloneMode) {
      if (!standaloneFile) return [];
      return [{
        id: "standalone-file",
        name: standaloneFile.name,
        mime: standaloneFile.type,
        file: standaloneFile,
        isNew: true,
      }];
    }

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
      const sd = documents.find(d => d.id === stagedLinkDocId);
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

    // Number duplicates
    const buckets = new Map<string, FileEntry[]>();
    for (const e of entries) {
      if (!buckets.has(e.rawName)) buckets.set(e.rawName, []);
      buckets.get(e.rawName)!.push(e);
    }

    const result: ModalFile[] = [];
    for (const [, bucket] of buckets) {
      bucket.sort((a, b) => a.orderGroup - b.orderGroup || a.orderIndex - b.orderIndex);
      if (bucket.length === 1) {
        const e = bucket[0];
        result.push({ id: e.id, name: e.rawName, mime: e.mime, iv: e.iv, file: e.file, isNew: e.isNew, isMarkedForDeletion: e.isMarkedForDeletion, isMarkedForUnlink: e.isMarkedForUnlink });
      } else {
        bucket.forEach((e, i) => {
          result.push({ id: e.id, name: `${e.rawName} (${i + 1})`, mime: e.mime, iv: e.iv, file: e.file, isNew: e.isNew, isMarkedForDeletion: e.isMarkedForDeletion, isMarkedForUnlink: e.isMarkedForUnlink });
        });
      }
    }

    return result;
  }, [isStandaloneMode, standaloneFile, linkedDocs, newFiles, stagedLinkDocId, markedForDeletion, markedForUnlink, documents]);

  // --- File action handlers ---

  const handleFileDelete = (fileId: string) => {
    if (isStandaloneMode) {
      setStandaloneFile(null);
      setSelectedDocId(null);
      return;
    }

    const newFile = newFiles.find(nf => nf.tempId === fileId);
    if (newFile) {
      setNewFiles(prev => prev.filter(nf => nf.tempId !== fileId));
      if (selectedDocId === fileId) setSelectedDocId(null);
      return;
    }

    if (stagedLinkDocId === fileId) {
      setStagedLinkDocId(null);
      if (selectedDocId === fileId) setSelectedDocId(null);
      return;
    }

    setMarkedForDeletion(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
    setMarkedForUnlink(prev => { const next = new Set(prev); next.delete(fileId); return next; });
  };

  const handleFileUnlink = (fileId: string) => {
    if (isStandaloneMode) return;
    if (stagedLinkDocId === fileId) { setStagedLinkDocId(null); return; }
    if (newFiles.find(nf => nf.tempId === fileId)) return;

    setMarkedForUnlink(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
    setMarkedForDeletion(prev => { const next = new Set(prev); next.delete(fileId); return next; });
  };

  const handleFileDownloadWrapped = async (fileId: string) => {
    if (isStandaloneMode) {
      if (standaloneFile) {
        const url = URL.createObjectURL(standaloneFile);
        const a = document.createElement("a");
        a.href = url; a.download = standaloneFile.name;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
      }
      return;
    }

    // For new files (not yet on server), use local download
    const newFile = newFiles.find(nf => nf.tempId === fileId);
    if (newFile) {
      const url = URL.createObjectURL(newFile.file);
      const a = document.createElement("a");
      a.href = url; a.download = newFile.label;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
      return;
    }

    // For docs from the global store, use the Education-specific download callback
    const doc = [...linkedDocs, ...documents].find(d => d.id === fileId);
    if (doc) {
      try { await onDownloadDocument(doc); }
      catch (err) { alert(err instanceof Error ? err.message : "Failed to download document."); }
      return;
    }

    // Fallback to hook's download (attached documents from R2)
    await hookHandleFileDownload(fileId);
  };

  const handleFileRenameWrapped = (fileId: string, newName: string) => {
    if (isStandaloneMode && fileId === "standalone-file" && standaloneFile) {
      const renamed = new File([standaloneFile], newName, {
        type: standaloneFile.type,
        lastModified: standaloneFile.lastModified,
      });
      setStandaloneFile(renamed);
      return;
    }

    const newFile = newFiles.find((nf) => nf.tempId === fileId);
    if (newFile) {
      setNewFiles((prev) =>
        prev.map((nf) =>
          nf.tempId === fileId ? { ...nf, label: newName } : nf
        )
      );
      return;
    }

    // Delegate to hook for attached doc renames
    hookHandleFileRename(fileId, newName);
  };

  const handleLoadPreviewWrapped = async (fileId: string): Promise<Blob> => {
    if (isStandaloneMode && standaloneFile) return standaloneFile;

    const newFile = newFiles.find(nf => nf.tempId === fileId);
    if (newFile) return newFile.file;

    // For docs from the store, try via download callback
    const doc = [...linkedDocs, ...documents].find(d => d.id === fileId);
    if (doc?.file_name && doc?.file_iv) {
      return downloadDocumentFile(userId, doc.file_name, doc.file_iv, doc.file_mime ?? "application/octet-stream");
    }

    // Fallback to hook
    return hookHandleLoadPreview(fileId);
  };

  const handleFileUpload = (file: File) => {
    if (isStandaloneMode) {
      const existingNames = new Set(documents.map(d => d.label || ""));
      const uniqueName = getUniqueFileName(file.name, existingNames);
      const renamedFile = new File([file], uniqueName, { type: file.type, lastModified: file.lastModified });
      setStandaloneFile(renamedFile);
      return;
    }

    const taken = new Set<string>();
    for (const doc of documents) {
      if (linkedDocs.some(ld => ld.id === doc.id)) {
        if (markedForDeletion.has(doc.id)) continue;
        if (markedForUnlink.has(doc.id)) continue;
      }
      if (doc.label) taken.add(doc.label);
    }
    if (stagedLinkDocId) {
      const sd = documents.find(d => d.id === stagedLinkDocId);
      if (sd && sd.label) taken.add(sd.label);
    }

    setNewFiles(prev => {
      for (const nf of prev) taken.add(nf.label);
      const label = getUniqueFileName(file.name, taken);
      const tempId = `new-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      return [...prev, { file, label, tempId }];
    });

    setSelectedDocId(null);
  };

  // Wrap hook's linkDropdownSelect to also clear Education-specific selectedDocId
  const handleLinkDropdownSelectWrapped = useCallback((docId: string) => {
    handleLinkDropdownSelect(docId);
    setSelectedDocId(null);
  }, [handleLinkDropdownSelect, setSelectedDocId]);

  // --- Delete handler ---
  async function handleDelete() {
    if (!education) return;
    setShowDeleteConfirm(true);
  }

  // --- Save handler ---
  const handleSaveWithFullProcessing = async () => {
    if (isStandaloneMode) {
      if (!standaloneFile) {
        setError("Please upload a certificate file.");
        return;
      }
      if (!standaloneLinkedEduId && !standaloneNewEduName.trim()) {
        setError("Please select an education or create a new one.");
        return;
      }
      setIsSaving(true);
      setError(null);
      try {
        await onSaveStandalone?.({
          file: standaloneFile,
          label: standaloneFile.name,
          linkedEducationId: standaloneLinkedEduId || undefined,
          newEducation: standaloneNewEduName.trim()
            ? { name: standaloneNewEduName.trim(), provider: standaloneNewEduProvider.trim() }
            : undefined,
        });
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save certificate.");
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (!name.trim()) {
      setError("Education name is required.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const docsToUnlink = [...markedForUnlink];
      const docsToDelete = [...markedForDeletion];
      const docToLink = stagedLinkDocId;
      const firstNewFile = newFiles[0];
      const pendingDoc = firstNewFile ? { file: firstNewFile.file, label: firstNewFile.label } : undefined;
      const finalName = name.trim();
      const finalProvider = provider.trim();
      const finalPriority = priority;
      const finalDueDate = dueDate || null;
      const finalDescription = description.trim();
      const finalIsCompleted = isCompleted;

      await onSave(
        {
          name: finalName,
          provider: finalProvider,
          priority: finalPriority,
          due_date: finalDueDate,
          description: finalDescription,
          is_completed: finalIsCompleted,
        },
        education,
        pendingDoc,
        docToLink ?? undefined,
        docsToUnlink.length > 0 ? docsToUnlink : undefined,
        docsToDelete.length > 0 ? docsToDelete : undefined,
      );

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save education.");
    } finally {
      setIsSaving(false);
    }
  };

  // --- Build link dropdown for rightPanelExtras ---
  const linkDropdownExtras = useMemo(() => {
    if (isStandaloneMode) return null;
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
          displayName.set(doc.id, `${trunc(doc.label || "Unnamed", 50)} (${i + 1})`);
        });
      }
    }
    const fmt = (doc: Document): string =>
      displayName.get(doc.id) || trunc(doc.label || "Unnamed", 55);

    const stagedDoc = stagedLinkDocId
      ? standaloneDocs.find(d => d.id === stagedLinkDocId)
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
            onFocus={() => { if (!linkDropdownOpen) setLinkDropdownOpen(true); }}
            onBlur={() => setTimeout(() => setLinkDropdownOpen(false), 150)}
            placeholder="Select file..."
            disabled={isSaving}
            className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 pr-7 text-xs outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => { setLinkDropdownOpen(prev => !prev); }}
            disabled={isSaving}
            className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 disabled:opacity-50"
          >
            <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {linkDropdownOpen && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            {filteredLinkDocs.length > 0 ? (
              <div className="max-h-36 overflow-y-auto">
                {filteredLinkDocs.map(doc => (
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
                {linkSearchQuery ? "No documents found" : "No documents available"}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }, [isStandaloneMode, linkSearchQuery, linkDropdownOpen, filteredLinkDocs, stagedLinkDocId, standaloneDocs, isSaving]);

  // --- Render ---

  // Standalone mode
  if (isStandaloneMode) {
    const eduOptions = allEducations || [];
    const standaloneFormDisabled = standaloneLinkedEduId !== "";

    return (
      <>
        <GlobalActionModal
          title="Add Certificate"
          onClose={onClose}
          isDirty={isDirty}
          files={files}
          selectedFileId={selectedDocId}
          onSelectFile={(id) => setSelectedDocId(id)}
          onFileDelete={standaloneFile ? handleFileDelete : undefined}
          onFileDownload={standaloneFile ? handleFileDownloadWrapped : undefined}
          onFileRename={standaloneFile ? handleFileRenameWrapped : undefined}
          onFileUpload={handleFileUpload}
          onLoadPreview={standaloneFile ? handleLoadPreviewWrapped : undefined}
          onSave={handleSaveWithFullProcessing}
          isSaving={isSaving}
        >
          <div className="flex flex-col h-full space-y-3">
            <div>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Link to existing record
                </span>
                <div className="flex items-center gap-2">
                  <select
                    value={standaloneLinkedEduId}
                    onChange={(e) => {
                      setStandaloneLinkedEduId(e.target.value);
                      if (e.target.value) {
                        setStandaloneNewEduName("");
                        setStandaloneNewEduProvider("");
                      }
                    }}
                    className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 min-w-0"
                  >
                    <option value="">— Select an education —</option>
                    {eduOptions.map((edu) => (
                      <option key={edu.id} value={edu.id}>
                        {trunc(edu.name, 50)}{edu.is_completed ? " ✓" : ""}
                      </option>
                    ))}
                  </select>
                  {standaloneLinkedEduId && (
                    <button
                      type="button"
                      onClick={() => setStandaloneLinkedEduId("")}
                      className="shrink-0 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 border-t border-zinc-200 dark:border-zinc-700" />
              <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase">— or —</span>
              <div className="flex-1 border-t border-zinc-200 dark:border-zinc-700" />
            </div>

            <fieldset disabled={standaloneFormDisabled} className="space-y-3">
              <InputField label="Education Name" value={standaloneNewEduName} onChange={setStandaloneNewEduName} disabled={isSaving || standaloneFormDisabled} placeholder="e.g. AWS Solutions Architect" />
              <InputField label="Provider" value={standaloneNewEduProvider} onChange={setStandaloneNewEduProvider} disabled={isSaving || standaloneFormDisabled} placeholder="e.g. Amazon Web Services" />
            </fieldset>

            {error && <ErrorBanner message={error} />}
          </div>
        </GlobalActionModal>
      </>
    );
  }

  const hasFiles = files.length > 0;

  // --- Standard mode ---
  return (
    <>
      <GlobalActionModal
        title={education ? "Edit education" : "Add education"}
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
        onDelete={education ? handleDelete : undefined}
        deleteLabel="Delete"
        rightPanelExtras={linkDropdownExtras}
      >
        <div className="flex flex-col h-full space-y-3">
          <InputField label="Course / Certification Name" value={name} onChange={setName} disabled={isSaving} />
          <InputField label="Provider" value={provider} onChange={setProvider} disabled={isSaving} placeholder="Institution or platform" />

          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              label="Priority"
              value={priority}
              onChange={(v) => setPriority(v as Priority)}
              disabled={isSaving}
              options={PRIORITIES.map((p) => ({ value: p, label: p[0].toUpperCase() + p.slice(1) }))}
            />
            <InputField label="Due Date" type="date" value={dueDate} onChange={setDueDate} disabled={isSaving} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Description
            </label>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              disabled={isSaving}
              minHeight="8rem"
            />
          </div>

          <CheckboxField label="Mark as complete (acquired)" checked={isCompleted} onChange={setIsCompleted} disabled={isSaving} id="is_completed" />

          {isCompleted && (
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {files.length} file{files.length !== 1 ? "s" : ""} attached
              {markedForDeletion.size > 0 && (
                <span className="ml-2 text-red-500">({markedForDeletion.size} marked for deletion)</span>
              )}
              {markedForUnlink.size > 0 && (
                <span className="ml-2 text-amber-500">({markedForUnlink.size} marked for unlink)</span>
              )}
            </div>
          )}

          {error && <ErrorBanner message={error} />}
        </div>
      </GlobalActionModal>

      {/* Delete confirmation */}
      {showDeleteConfirm && education && (
        <ConfirmDialog
          title="Delete education?"
          description={
            linkedDocs.length > 0
              ? `This education has ${linkedDocs.length} linked file(s).`
              : "Are you sure you want to delete this education? This cannot be undone."
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
              await onDelete(education.id, deleteFiles ? 'cascade' : 'unlink');
              onClose();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to delete education.");
            } finally {
              setIsSaving(false);
            }
          }}
        />
      )}
    </>
  );
}
