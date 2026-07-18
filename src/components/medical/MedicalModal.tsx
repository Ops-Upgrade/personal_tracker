"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import type { MedicalRecord } from "@/types/medical";
import type { Document } from "@/types/document";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import GlobalActionModal from "@/components/common/GlobalActionModal";
import { useModalDocumentState } from "@/lib/useModalDocumentState";
import { InputField } from "@/components/common/FormField";
import RichTextEditor from "@/components/common/RichTextEditor";
import ErrorBanner from "@/components/common/ErrorBanner";

// --- Types ---

interface MedicalDraft {
  name: string;
  clinic: string;
  date: string;
  diagnosis_timeline: string;
}

export interface MedicalFileAction {
  newFiles: File[];
  removeDocIds: string[];
  /** ID of an existing standalone document to link to this record */
  linkDocId?: string;
}

interface MedicalModalProps {
  record: MedicalRecord | null; // null = create mode
  defaultDate?: string;
  /** Documents currently linked to this record (for display/download) */
  attachedDocuments: Document[];
  /** All standalone (unlinked) documents in the medical store — for the "link existing" dropdown */
  standaloneDocuments: Document[];
  userId: string;
  onClose: () => void;
  onSave: (
    draft: MedicalDraft,
    existingRecord: MedicalRecord | null,
    fileAction?: MedicalFileAction,
  ) => Promise<void>;
  onDelete: (recordId: string) => Promise<void>;
}

export default function MedicalModal({
  record,
  defaultDate,
  attachedDocuments,
  standaloneDocuments,
  userId,
  onClose,
  onSave,
  onDelete,
}: MedicalModalProps) {
  const [name, setName] = useState(record?.name ?? "");
  const [clinic, setClinic] = useState(record?.clinic ?? "");
  const [date, setDate] = useState(record?.date ?? defaultDate ?? new Date().toISOString().split("T")[0]);
  const [diagnosisTimeline, setDiagnosisTimeline] = useState(record?.diagnosis_timeline ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // --- File state (from shared hook) ---
  const [markedForRemoval, setMarkedForRemoval] = useState<Set<string>>(new Set());

  const {
    newFiles,
    stagedLinkDocId,
    setStagedLinkDocId,
    selectedFileId,
    setSelectedFileId,
    linkSearchQuery,
    setLinkSearchQuery,
    linkDropdownOpen,
    setLinkDropdownOpen,
    files,
    availableStandalone,
    filteredLinkDocs,
    addNewFile,
    removeNewFile,
    handleFileDownload,
    handleFileRename,
    handleLoadPreview,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    handleLinkDropdownSelect,
    resetFileState,
  } = useModalDocumentState({
    attachedDocuments,
    standaloneDocuments,
    userId,
    markedForRemoval,
  });

  const isEditing = Boolean(record);

  // ── Baseline: computed once, used by both reset AND dirty check ──
  const baseline = useMemo(() => ({
    name: record?.name ?? "",
    clinic: record?.clinic ?? "",
    date: record?.date ?? defaultDate ?? new Date().toISOString().split("T")[0],
    diagnosisTimeline: record?.diagnosis_timeline ?? "",
  }), [record, defaultDate]);

  // Reset form to baseline whenever the record changes
  useEffect(() => {
    setName(baseline.name);
    setClinic(baseline.clinic);
    setDate(baseline.date);
    setDiagnosisTimeline(baseline.diagnosisTimeline);
    setIsSaving(false);
    setError(null);
    setShowDeleteConfirm(false);
    setMarkedForRemoval(new Set());
    resetFileState();
  }, [baseline, resetFileState]);

  // Dirty check
  const isDirty =
    name !== baseline.name ||
    clinic !== baseline.clinic ||
    date !== baseline.date ||
    diagnosisTimeline !== baseline.diagnosisTimeline ||
    newFiles.length > 0 ||
    markedForRemoval.size > 0 ||
    stagedLinkDocId !== null;

  // --- File handlers (wrap shared hook with modal-specific logic) ---

  const handleFileUploadWrapped = useCallback((file: File) => {
    addNewFile(file);
  }, [addNewFile]);

  const handleFileDeleteWrapped = useCallback((fileId: string) => {
    // If it's the staged link, unstage it
    if (stagedLinkDocId === fileId) {
      setStagedLinkDocId(null);
      if (selectedFileId === fileId) setSelectedFileId(null);
      return;
    }

    const newFile = newFiles.find((nf) => nf.tempId === fileId);
    if (newFile) {
      removeNewFile(fileId);
      if (selectedFileId === fileId) setSelectedFileId(null);
      return;
    }

    setMarkedForRemoval((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  }, [newFiles, selectedFileId, stagedLinkDocId, removeNewFile, setStagedLinkDocId, setSelectedFileId]);

  const hasFiles = files.length > 0;

  // --- Save handler ---

  async function handleSave() {
    if (!name.trim()) {
      setError("Record name is required.");
      return;
    }
    if (!date) {
      setError("Date is required.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const fileAction: MedicalFileAction | undefined =
        newFiles.length > 0 || markedForRemoval.size > 0 || stagedLinkDocId
          ? {
              newFiles: newFiles.map((nf) => nf.file),
              removeDocIds: [...markedForRemoval],
              linkDocId: stagedLinkDocId ?? undefined,
            }
          : undefined;

      await onSave(
        {
          name: name.trim(),
          clinic: clinic.trim(),
          date,
          diagnosis_timeline: diagnosisTimeline,
        },
        record,
        fileAction,
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save medical record.");
    } finally {
      setIsSaving(false);
    }
  }

  // --- Delete handler ---

  async function handleDelete() {
    if (!record) return;
    setShowDeleteConfirm(true);
  }

  async function confirmDelete() {
    if (!record) return;
    try {
      await onDelete(record.id);
      setShowDeleteConfirm(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete medical record.");
    }
  }

  // --- Link dropdown for rightPanelExtras ---
  const stagedLinkDoc = stagedLinkDocId
    ? standaloneDocuments.find((d) => d.id === stagedLinkDocId)
    : null;
  const stagedLinkLabel = stagedLinkDoc
    ? (stagedLinkDoc.label || stagedLinkDoc.file_name || "Unnamed")
    : null;
  const linkDisplayValue = stagedLinkDocId ? (stagedLinkLabel ?? "") : linkSearchQuery;

  const linkDropdownExtras = useMemo(() => {
    if (availableStandalone.length === 0 && !stagedLinkDocId) return null;

    return (
      <div className="relative w-full">
        <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Select a file from the store
        </span>
        <div className="relative flex items-center">
          <input
            type="text"
            value={linkDisplayValue.length > 55 ? linkDisplayValue.slice(0, 55) + "…" : linkDisplayValue}
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
            onClick={() => setLinkDropdownOpen((prev) => !prev)}
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
                {filteredLinkDocs.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setStagedLinkDocId(doc.id);
                      setLinkSearchQuery("");
                      setLinkDropdownOpen(false);
                      setSelectedFileId(null);
                    }}
                    className="w-full px-3 py-1.5 text-left text-xs text-zinc-700 hover:bg-emerald-50 hover:text-emerald-700 dark:text-zinc-300 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400"
                  >
                    {(doc.label || doc.file_name || "Unnamed").length > 55
                      ? (doc.label || doc.file_name || "Unnamed").slice(0, 55) + "…"
                      : (doc.label || doc.file_name || "Unnamed")}
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
  }, [availableStandalone.length, stagedLinkDocId, linkDisplayValue, linkDropdownOpen, filteredLinkDocs, linkSearchQuery, isSaving, setLinkDropdownOpen, setLinkSearchQuery, setSelectedFileId, setStagedLinkDocId]);

  // --- Render ---

  return (
    <>
      <GlobalActionModal
        title={isEditing ? "Edit medical record" : "Add medical record"}
        onClose={onClose}
        isDirty={isDirty}
        files={files}
        selectedFileId={selectedFileId}
        onSelectFile={(id) => setSelectedFileId(id)}
        onFileUpload={handleFileUploadWrapped}
        onFileDelete={hasFiles ? handleFileDeleteWrapped : undefined}
        onFileDownload={hasFiles ? handleFileDownload : undefined}
        onFileRename={hasFiles ? handleFileRename : undefined}
        onLoadPreview={hasFiles ? handleLoadPreview : undefined}
        onSave={handleSave}
        isSaving={isSaving}
        onDelete={isEditing ? handleDelete : undefined}
        deleteLabel="Delete"
        rightPanelExtras={linkDropdownExtras}
      >
        <div className="space-y-3">
          <InputField
            label="Record Name"
            value={name}
            onChange={setName}
            disabled={isSaving}
            placeholder="e.g. Annual Checkup, Blood Test Results"
          />
          <InputField
            label="Clinic / Hospital"
            value={clinic}
            onChange={setClinic}
            disabled={isSaving}
            placeholder="e.g. Apollo Hospital, Local Clinic"
          />
          <InputField
            label="Date"
            type="date"
            value={date}
            onChange={setDate}
            disabled={isSaving}
          />

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Diagnosis / Timeline
            </label>
            <RichTextEditor
              value={diagnosisTimeline}
              onChange={setDiagnosisTimeline}
              disabled={isSaving}
              minHeight="10rem"
            />
          </div>

          {error && <ErrorBanner message={error} />}
        </div>
      </GlobalActionModal>

      {/* Delete confirmation */}
      {showDeleteConfirm && record && (
        <ConfirmDialog
          title="Delete medical record?"
          description="This action cannot be undone. The medical record will be permanently removed."
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={confirmDelete}
        />
      )}
    </>
  );
}
