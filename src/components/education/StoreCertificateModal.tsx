"use client";

import { useEffect, useMemo, useState } from "react";
import type { Certificate, Education } from "@/types/education";
import type { Priority } from "@/types/taskmanager";
import { PRIORITIES } from "@/types/taskmanager";
import { downloadCertificateFile } from "@/api/education/certificateStorage";
import GlobalActionModal from "@/components/common/GlobalActionModal";
import type { ModalFile } from "@/components/common/GlobalActionModal";
import { InputField, SelectField, TextareaField } from "@/components/common/FormField";
import ErrorBanner from "@/components/common/ErrorBanner";
import ConfirmDialog from "@/components/taskmanager/ConfirmDialog";
import { getUniqueFileName, trunc } from "./helpers";

// --- Types ---

export interface StoreCertificateSaveParams {
  file?: File;
  label: string;
  linkedEducationId?: string;
  newEducation?: {
    name: string;
    provider: string;
    priority: Priority;
    due_date: string | null;
    description: string;
  };
  existingCertificate?: Certificate | null;
}

interface StoreCertificateModalProps {
  certificate: Certificate | null;
  allEducations: Education[];
  /** Labels of ALL existing certificates — used for cross-store file name dedup */
  existingLabels: string[];
  userId: string;
  onClose: () => void;
  onSave: (params: StoreCertificateSaveParams) => Promise<void>;
  onDelete?: (certificate: Certificate, cascadeMode: "unlink" | "cascade") => Promise<void>;
}

export default function StoreCertificateModal({
  certificate,
  allEducations,
  existingLabels,
  userId,
  onClose,
  onSave,
  onDelete,
}: StoreCertificateModalProps) {
  const isEditing = Boolean(certificate);

  // --- File state (single file only) ---
  const [storeFile, setStoreFile] = useState<File | null>(null);

  // --- Education dropdown state ---
  const [linkedEduId, setLinkedEduId] = useState("");
  const [eduSearchQuery, setEduSearchQuery] = useState("");
  const [eduDropdownOpen, setEduDropdownOpen] = useState(false);

  // --- New education form state ---
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");

  // --- UI state ---
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(() => {
    // Auto-select existing file in edit mode so preview + actions show immediately
    if (certificate?.file_name) return certificate.id;
    return null;
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const formDisabled = linkedEduId !== "";

  // --- Reset on open ---
  useEffect(() => {
    setLinkedEduId(certificate?.education_id ?? "");
    setName("");
    setProvider("");
    setPriority("medium");
    setDueDate("");
    setDescription("");
    setStoreFile(null);
    setSelectedFileId(certificate?.file_name ? certificate.id : null);
    setEduSearchQuery("");
    setEduDropdownOpen(false);
    setError(null);
    setShowDeleteConfirm(false);
  }, [certificate]);

  // --- Filtered educations for searchable dropdown ---
  const filteredEducations = useMemo(() => {
    if (!eduSearchQuery.trim()) return allEducations;
    const q = eduSearchQuery.toLowerCase();
    return allEducations.filter(
      (e) =>
        (e.name || "").toLowerCase().includes(q) ||
        (e.provider || "").toLowerCase().includes(q)
    );
  }, [allEducations, eduSearchQuery]);

  // --- Selected education display value ---
  const selectedEdu = linkedEduId
    ? allEducations.find((e) => e.id === linkedEduId)
    : null;
  const displayValue = linkedEduId && selectedEdu
    ? trunc(selectedEdu.name, 55)
    : eduSearchQuery;

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
    if (isEditing && certificate?.file_name) {
      return [
        {
          id: certificate.id,
          name: certificate.label || certificate.file_name || "Unnamed Certificate",
          mime: certificate.file_mime,
          iv: certificate.file_iv,
        },
      ];
    }
    return [];
  }, [storeFile, isEditing, certificate]);

  // --- Dirty check ---
  const isDirty = isEditing
    ? storeFile !== null ||
      linkedEduId !== (certificate?.education_id ?? "")
    : storeFile !== null ||
      linkedEduId !== "" ||
      name !== "" ||
      provider !== "" ||
      description !== "";

  // --- File handlers ---

  const handleFileUpload = (file: File) => {
    // Dedup against ALL existing certificate labels in the store
    const taken = new Set(existingLabels);
    // When editing, exclude the current cert's own label (it can keep its name)
    if (certificate?.label) taken.delete(certificate.label);

    const uniqueName = getUniqueFileName(file.name, taken);
    // Create renamed file so the dedup'd name becomes canonical
    const renamedFile = uniqueName !== file.name
      ? new File([file], uniqueName, { type: file.type, lastModified: file.lastModified })
      : file;

    setStoreFile(renamedFile);
    setSelectedFileId("store-file");
  };

  const handleFileRename = (fileId: string, newName: string) => {
    // Rename unsaved file (storeFile)
    if (fileId === "store-file" && storeFile) {
      const renamedFile = new File([storeFile], newName, {
        type: storeFile.type,
        lastModified: storeFile.lastModified,
      });
      setStoreFile(renamedFile);
    }
    // For existing certificate in edit mode, update label locally
    // (The save handler uses storeFile?.name || certificate?.label, so
    //  if we had a local label override it would go here. Since the plan
    //  focuses on unsaved files, the cert label rename flows through
    //  the TileView → API path instead.)
  };

  const handleFileDelete = () => {
    // Edit mode: deleting the file means complete delete of the certificate
    if (isEditing && certificate && onDelete) {
      setShowDeleteConfirm(true);
      return;
    }
    // Add mode: just remove the new file from queue
    setStoreFile(null);
    setSelectedFileId(null);
  };

  const handleFileDownload = async () => {
    // New local file — download via blob URL
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
    // Existing certificate file — download from server
    if (isEditing && certificate?.file_name && certificate?.file_iv && certificate?.file_mime) {
      try {
        const blob = await downloadCertificateFile(
          userId,
          certificate.file_name,
          certificate.file_iv,
          certificate.file_mime
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = certificate.label || "certificate";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        alert(
          "Failed to download: " +
            (err instanceof Error ? err.message : "Unknown error")
        );
      }
    }
  };

  const handleLoadPreview = async (): Promise<Blob> => {
    if (storeFile) return storeFile;
    if (
      isEditing &&
      certificate?.file_name &&
      certificate?.file_iv &&
      certificate?.file_mime
    ) {
      return downloadCertificateFile(
        userId,
        certificate.file_name,
        certificate.file_iv,
        certificate.file_mime
      );
    }
    throw new Error("Cannot load preview.");
  };

  // --- Save ---

  const handleSave = async () => {
    // Validate file requirement for add mode
    if (!storeFile && !isEditing) {
      setError("Please upload a certificate file.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave({
        file: storeFile || undefined,
        label: storeFile?.name || certificate?.label || "Certificate",
        linkedEducationId: linkedEduId || undefined,
        newEducation:
          !linkedEduId && name.trim()
            ? {
                name: name.trim(),
                provider: provider.trim(),
                priority,
                due_date: dueDate || null,
                description: description.trim(),
              }
            : undefined,
        existingCertificate: certificate,
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save certificate."
      );
    } finally {
      setIsSaving(false);
    }
  };

  // --- Delete ---

  const handleDeleteClick = async () => {
    if (!certificate || !onDelete) return;
    setShowDeleteConfirm(true);
  };

  // --- Render ---

  return (
    <>
      <GlobalActionModal
        title={isEditing ? "Edit Certificate" : "Add Certificate"}
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
        onDelete={
          isEditing && onDelete ? handleDeleteClick : undefined
        }
        deleteLabel="Delete"
      >
        <div className="flex flex-col h-full space-y-3">
          {/* Searchable education dropdown + clear button */}
          <div className="relative">
            <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Link to existing education record
            </span>
            <div className="relative flex items-center">
              <input
                type="text"
                value={displayValue}
                onChange={(e) => {
                  if (linkedEduId) setLinkedEduId("");
                  setEduSearchQuery(e.target.value);
                  if (!eduDropdownOpen) setEduDropdownOpen(true);
                }}
                onFocus={() => {
                  if (!eduDropdownOpen) setEduDropdownOpen(true);
                }}
                onBlur={() =>
                  setTimeout(() => setEduDropdownOpen(false), 150)
                }
                placeholder="Search education..."
                disabled={isSaving}
                className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 pr-16 text-xs outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                {linkedEduId && (
                  <button
                    type="button"
                    onClick={() => {
                      setLinkedEduId("");
                      setEduSearchQuery("");
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
                  onClick={() => setEduDropdownOpen((prev) => !prev)}
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

            {/* Dropdown popup */}
            {eduDropdownOpen && (
              <div className="absolute z-20 mt-1 w-full rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                {filteredEducations.length > 0 ? (
                  <div className="max-h-36 overflow-y-auto">
                    {filteredEducations.map((edu) => (
                      <button
                        key={edu.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setLinkedEduId(edu.id);
                          setEduSearchQuery("");
                          setEduDropdownOpen(false);
                        }}
                        className="w-full px-3 py-1.5 text-left text-xs text-zinc-700 hover:bg-emerald-50 hover:text-emerald-700 dark:text-zinc-300 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400"
                      >
                        {trunc(edu.name, 55)}
                        {edu.is_completed ? " ✓" : ""}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-3 py-2 text-xs text-zinc-400">
                    {eduSearchQuery
                      ? "No matching educations"
                      : "No educations available"}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* --- or --- divider */}
          <div className="flex items-center gap-2">
            <div className="flex-1 border-t border-zinc-200 dark:border-zinc-700" />
            <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase">
              — or —
            </span>
            <div className="flex-1 border-t border-zinc-200 dark:border-zinc-700" />
          </div>

          {/* Education form (disabled when dropdown selected) */}
          <fieldset disabled={formDisabled} className="space-y-3">
            <InputField
              label="Course / Certification Name"
              value={name}
              onChange={setName}
              disabled={isSaving || formDisabled}
            />
            <InputField
              label="Provider"
              value={provider}
              onChange={setProvider}
              disabled={isSaving || formDisabled}
              placeholder="Institution or platform"
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                label="Priority"
                value={priority}
                onChange={(v) => setPriority(v as Priority)}
                disabled={isSaving || formDisabled}
                options={PRIORITIES.map((p) => ({
                  value: p,
                  label: p[0].toUpperCase() + p.slice(1),
                }))}
              />
              <InputField
                label="Due Date"
                type="date"
                value={dueDate}
                onChange={setDueDate}
                disabled={isSaving || formDisabled}
              />
            </div>

            <TextareaField
              label="Description"
              value={description}
              onChange={setDescription}
              disabled={isSaving || formDisabled}
              rows={2}
            />
          </fieldset>

          {error && <ErrorBanner message={error} />}
        </div>
      </GlobalActionModal>

      {/* Delete confirmation */}
      {showDeleteConfirm && certificate && onDelete && (
        certificate.education_id ? (
          <ConfirmDialog
            title="Delete certificate?"
            description="This certificate is linked to an education. Deleting it will also unlink it from the education. The file will be permanently removed."
            confirmLabel="Delete"
            cancelLabel="Cancel"
            showDeleteFilesCheckbox
            deleteFilesLabel="Delete associated education record"
            onCancel={() => setShowDeleteConfirm(false)}
            onConfirm={async (deleteRecord) => {
              setShowDeleteConfirm(false);
              setIsSaving(true);
              try {
                await onDelete(
                  certificate,
                  deleteRecord ? "cascade" : "unlink"
                );
                onClose();
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : "Failed to delete certificate."
                );
              } finally {
                setIsSaving(false);
              }
            }}
          />
        ) : (
          <ConfirmDialog
            title="Delete certificate?"
            description="This will permanently delete the certificate and its file. This cannot be undone."
            onCancel={() => setShowDeleteConfirm(false)}
            onConfirm={async () => {
              setShowDeleteConfirm(false);
              setIsSaving(true);
              try {
                await onDelete(certificate, "unlink");
                onClose();
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : "Failed to delete certificate."
                );
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
