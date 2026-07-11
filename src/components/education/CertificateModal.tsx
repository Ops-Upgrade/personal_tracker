"use client";

import { useEffect, useState } from "react";
import type { Certificate, Education } from "@/types/education";
import { downloadCertificateFile } from "@/api/education/certificateStorage";
import ConfirmDialog from "@/components/taskmanager/ConfirmDialog";
import GlobalActionModal from "@/components/common/GlobalActionModal";
import type { ModalFile } from "@/components/common/GlobalActionModal";
import ErrorBanner from "@/components/common/ErrorBanner";
import { trunc } from "./helpers";

interface CertificateModalProps {
  certificate: Certificate | null;
  completedEducations: Education[];
  userId: string;
  onClose: () => void;
  onSave: (
    label: string,
    educationId: string,
    file: File | null,
    existingCertificate: Certificate | null,
    newEducation?: { name: string; provider: string }
  ) => Promise<void>;
  onDelete: (certificate: Certificate, cascadeMode: 'unlink' | 'cascade') => Promise<void>;
  onDownload: (certificate: Certificate) => Promise<void>;
  /** When true, shows the "OR Form" for creating a new education inline (Task 3.4) */
  showNewEducationForm?: boolean;
}

export default function CertificateModal({
  certificate,
  completedEducations,
  userId,
  onClose,
  onSave,
  onDelete,
  onDownload,
  showNewEducationForm = false,
}: CertificateModalProps) {
  const [label, setLabel] = useState("");
  const [educationId, setEducationId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [certFile, setCertFile] = useState<File | null>(null);
  // Explicit file selection — null = list view, set = preview (Task 1.5)
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  // "OR Form" state for creating new education inline
  const [newEduName, setNewEduName] = useState("");
  const [newEduProvider, setNewEduProvider] = useState("");
  const [useNewEducation, setUseNewEducation] = useState(false);

  const isEditing = Boolean(certificate);

  useEffect(() => {
    setLabel(certificate?.label ?? "");
    setEducationId(certificate?.education_id ?? "");
    setError(null);
    setShowDeleteConfirm(false);
    setCertFile(null);
    setSelectedFileId(certificate?.file_name ? certificate.id : null);
    setNewEduName("");
    setNewEduProvider("");
    setUseNewEducation(false);
  }, [certificate]);

  // --- Dirty check ---
  const isDirty = certificate
    ? label !== (certificate.label ?? "") ||
      educationId !== (certificate.education_id ?? "")
    : label !== "" ||
      educationId !== "" ||
      certFile !== null ||
      (showNewEducationForm && useNewEducation && (newEduName !== "" || newEduProvider !== ""));

  // --- Files array ---

  const files: ModalFile[] = [];
  if (certFile) {
    files.push({
      id: "new-cert-file",
      name: certFile.name,
      mime: certFile.type,
      file: certFile,
      isNew: true,
    });
  } else if (certificate?.file_name) {
    files.push({
      id: certificate.id,
      name: certificate.label || certificate.file_name || "Unnamed Certificate",
      mime: certificate.file_mime,
      iv: certificate.file_iv,
    });
  }

  // --- File handlers ---

  const handleFileUpload = (file: File) => {
    setCertFile(file);
    // Don't auto-select — queue first, preview on click (Task 1.5)
    setSelectedFileId(null);
    if (!label.trim()) {
      setLabel(file.name); // Auto-take filename as label
    }
  };

  const handleFileDownload = async () => {
    if (!certificate) return;
    try {
      await onDownload(certificate);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to download certificate.");
    }
  };

  const handleLoadPreview = async (): Promise<Blob> => {
    if (certFile) return certFile;
    if (!certificate?.file_name || !certificate?.file_iv || !certificate?.file_mime) {
      throw new Error("Cannot load preview.");
    }
    return downloadCertificateFile(userId, certificate.file_name, certificate.file_iv, certificate.file_mime);
  };

  // --- Save ---

  async function handleSave() {
    if (!label.trim()) {
      setError("Certificate label is required.");
      return;
    }

    if (!certificate && !certFile) {
      setError("Please select a file to upload.");
      return;
    }

    if (showNewEducationForm && useNewEducation && !newEduName.trim()) {
      setError("Education name is required when creating a new education.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(
        label.trim(),
        educationId,
        certFile,
        certificate,
        useNewEducation && showNewEducationForm
          ? { name: newEduName.trim(), provider: newEduProvider.trim() }
          : undefined
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save certificate.");
    } finally {
      setIsSaving(false);
    }
  }

  // --- Delete ---

  async function handleDeleteClick() {
    if (!certificate) return;
    setShowDeleteConfirm(true);
  }

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
        onFileUpload={!isEditing ? handleFileUpload : undefined}
        onFileDownload={isEditing ? handleFileDownload : undefined}
        onLoadPreview={files.length > 0 ? handleLoadPreview : undefined}
        onSave={handleSave}
        isSaving={isSaving}
        onDelete={isEditing ? handleDeleteClick : undefined}
        deleteLabel="Delete"
      >
        <div className="flex flex-col h-full space-y-3">
          {/* Label */}
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Label
            </span>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              disabled={isSaving}
              placeholder="Certificate name"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 disabled:opacity-50"
            />
          </label>

          {/* Link to Education dropdown (always shown unless using new education form) */}
          {(!showNewEducationForm || !useNewEducation) && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Link to Education (optional)
              </span>
              <select
                value={educationId}
                onChange={(e) => setEducationId(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 min-w-0"
              >
                <option value="" className="truncate">— Standalone —</option>
                {completedEducations.map((edu) => (
                  <option key={edu.id} value={edu.id} className="truncate">
                    {trunc(edu.name, 50)}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* "OR Form" — create new education inline (Task 3.4) */}
          {showNewEducationForm && (
            <div className="border-t border-zinc-200 dark:border-zinc-700 pt-3 mt-1">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase">
                  — OR —
                </span>
                <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useNewEducation}
                    onChange={(e) => {
                      setUseNewEducation(e.target.checked);
                      if (e.target.checked) setEducationId("");
                    }}
                    className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-600 dark:border-zinc-600 dark:bg-zinc-800"
                  />
                  Create new education
                </label>
                {useNewEducation && (
                  <button
                    type="button"
                    onClick={() => {
                      setUseNewEducation(false);
                      setNewEduName("");
                      setNewEduProvider("");
                    }}
                    className="ml-auto text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                    title="Reset"
                  >
                    Reset
                  </button>
                )}
              </div>

              {useNewEducation && (
                <div className="space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Education Name
                    </span>
                    <input
                      type="text"
                      value={newEduName}
                      onChange={(e) => setNewEduName(e.target.value)}
                      disabled={isSaving}
                      placeholder="e.g. AWS Solutions Architect"
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 disabled:opacity-50"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Provider
                    </span>
                    <input
                      type="text"
                      value={newEduProvider}
                      onChange={(e) => setNewEduProvider(e.target.value)}
                      disabled={isSaving}
                      placeholder="e.g. Amazon Web Services"
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 disabled:opacity-50"
                    />
                  </label>
                </div>
              )}
            </div>
          )}

          {/* File info for existing certificates */}
          {isEditing && certificate?.file_name && (
            <div className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700">
              <span className="text-zinc-600 dark:text-zinc-300 truncate">
                File: {certificate.file_name}
              </span>
            </div>
          )}

          {error && <ErrorBanner message={error} />}
        </div>
      </GlobalActionModal>

      {/* Delete confirmation */}
      {showDeleteConfirm && certificate && (
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
                await onDelete(certificate, deleteRecord ? 'cascade' : 'unlink');
                onClose();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to delete certificate.");
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
                await onDelete(certificate, 'unlink');
                onClose();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to delete certificate.");
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
