"use client";

import { useEffect, useRef, useState } from "react";
import type { Certificate, Education } from "@/types/education";
import Button from "@/components/common/Button";
import ConfirmDialog from "@/components/taskmanager/ConfirmDialog";
import DeleteOptionsDialog from "@/components/common/DeleteOptionsDialog";
import ModalFrame from "@/components/taskmanager/ModalFrame";
import { trunc } from "./helpers";
import DocPreviewPanel from "@/components/common/DocPreviewPanel";

function ArrowDownTrayIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

interface CertificateModalProps {
  certificate: Certificate | null;
  completedEducations: Education[];
  userId: string;
  onClose: () => void;
  onSave: (
    label: string,
    educationId: string,
    file: File | null,
    existingCertificate: Certificate | null
  ) => Promise<void>;
  onDelete: (certificate: Certificate, cascadeMode: 'unlink' | 'cascade') => Promise<void>;
  onDownload: (certificate: Certificate) => Promise<void>;
}

export default function CertificateModal({
  certificate,
  completedEducations,
  userId,
  onClose,
  onSave,
  onDelete,
  onDownload,
}: CertificateModalProps) {
  const [label, setLabel] = useState("");
  const [educationId, setEducationId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [certFile, setCertFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLabel(certificate?.label ?? "");
    setEducationId(certificate?.education_id ?? "");
    setError(null);
    setShowDeleteConfirm(false);
    setShowCancelConfirm(false);
    setCertFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [certificate]);

  async function handleSave() {
    if (!label.trim()) {
      setError("Certificate label is required.");
      return;
    }

    // For new certificates, require a file
    if (!certificate && !certFile) {
      setError("Please select a file to upload.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(label.trim(), educationId, certFile, certificate);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save certificate.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(cascadeMode: 'unlink' | 'cascade') {
    if (!certificate) return;
    setIsSaving(true);
    setError(null);
    try {
      await onDelete(certificate, cascadeMode);
      setShowDeleteConfirm(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete certificate.");
    } finally {
      setIsSaving(false);
    }
  }

  const hasUnsavedChanges = certificate ? (
    label !== (certificate.label ?? "") ||
    educationId !== (certificate.education_id ?? "")
  ) : (
    label !== "" ||
    educationId !== "" ||
    certFile !== null
  );

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      setShowCancelConfirm(true);
    } else {
      onClose();
    }
  };

  const showSidePanel = Boolean(certificate || certFile);
  const sidePanel = showSidePanel ? (
    <DocPreviewPanel
      cert={certificate}
      file={certFile}
      userId={userId}
      onDownload={certificate ? () => onDownload(certificate) : undefined}
      isDownloading={false} // The modal has its own download button, but we pass it anyway for consistency
      currentIndex={0}
      totalCerts={1}
      onPrev={() => {}}
      onNext={() => {}}
    />
  ) : undefined;

  return (
    <>
      <ModalFrame
        title={certificate ? "Edit Certificate" : "Add Certificate"}
        onClose={onClose}
        maxWidthClassName={showSidePanel ? "max-w-6xl" : "max-w-md"}
        sidePanel={sidePanel}
      >
        <div className="flex flex-col h-full space-y-3">
          {/* Label input removed */}

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

          {/* File upload for new, or info for existing */}
          {certificate ? (
            <div className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700">
              <span className="text-zinc-600 dark:text-zinc-300">
                File: {certificate.file_name}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDownload(certificate)}
              >
                Download
              </Button>
            </div>
          ) : (
            <div>
              <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                File (PDF, JPEG, PNG, WEBP — max 45 MB)
              </span>
              <label
                className={`flex flex-col items-center justify-center gap-1 p-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors
                  ${isSaving
                    ? "opacity-50 pointer-events-none border-zinc-300 dark:border-zinc-700"
                    : "border-zinc-300 hover:border-emerald-500 hover:bg-emerald-50 dark:border-zinc-700 dark:hover:border-emerald-600 dark:hover:bg-emerald-900/10"
                  }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setCertFile(f);
                      if (!label.trim()) {
                        // Autofill label from file name (with extension) if label is empty
                        setLabel(f.name);
                      }
                    }
                  }}
                  disabled={isSaving}
                  className="hidden"
                />
                <ArrowDownTrayIcon className="h-4 w-4 text-zinc-400" />
                {certFile ? (
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{certFile.name} ({formatBytes(certFile.size)})</span>
                ) : (
                  <>
                    <span className="text-xs text-zinc-500">Drop certificate or click to browse</span>
                    <span className="text-xs text-zinc-400">PDF, JPEG, PNG, WEBP • Max 45 MB</span>
                  </>
                )}
              </label>
              {certFile && (
                <div className="mt-2 flex justify-end">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => { setCertFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    disabled={isSaving}
                  >
                    Clear File
                  </Button>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="mt-auto flex justify-end gap-2 pt-4">
            {certificate && (
              <Button
                variant="danger"
                size="md"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isSaving}
              >
                Delete
              </Button>
            )}
            <Button
              variant="secondary"
              size="md"
              onClick={handleCancel}
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
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </ModalFrame>

      {showDeleteConfirm && certificate && (
        certificate.education_id ? (
          <DeleteOptionsDialog
            title="Delete certificate?"
            description="This certificate is linked to an education. What would you like to do?"
            unlinkOptionLabel="Delete file only (keep education)"
            cascadeOptionLabel="Delete file AND education record"
            onCancel={() => setShowDeleteConfirm(false)}
            onConfirm={(mode) => handleDelete(mode)}
          />
        ) : (
          <ConfirmDialog
            title="Delete certificate?"
            description="This will permanently delete the certificate and its file. This cannot be undone."
            onCancel={() => setShowDeleteConfirm(false)}
            onConfirm={() => handleDelete('unlink')}
          />
        )
      )}

      {showCancelConfirm && (
        <ConfirmDialog
          title="Unsaved changes"
          description={
            certFile && !certificate
              ? "You have unsaved changes. The uploaded file will be discarded if you cancel. Do you want to continue?"
              : "You have unsaved changes. If you cancel without saving, any modifications you made will be lost. Do you want to continue?"
          }
          confirmLabel="Yes, discard"
          cancelLabel="No, stay"
          onCancel={() => setShowCancelConfirm(false)}
          onConfirm={() => {
            setShowCancelConfirm(false);
            onClose();
          }}
        />
      )}
    </>
  );
}
