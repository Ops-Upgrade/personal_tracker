"use client";

import { useEffect, useRef, useState } from "react";
import type { Certificate, Education } from "@/types/education";
import Button from "@/components/common/Button";
import ConfirmDialog from "@/components/taskmanager/ConfirmDialog";
import ModalFrame from "@/components/taskmanager/ModalFrame";

interface CertificateModalProps {
  certificate: Certificate | null;
  completedEducations: Education[];
  onClose: () => void;
  onSave: (
    label: string,
    educationId: string,
    file: File | null,
    existingCertificate: Certificate | null
  ) => Promise<void>;
  onDelete: (certificate: Certificate) => Promise<void>;
  onDownload: (certificate: Certificate) => Promise<void>;
}

export default function CertificateModal({
  certificate,
  completedEducations,
  onClose,
  onSave,
  onDelete,
  onDownload,
}: CertificateModalProps) {
  const [label, setLabel] = useState("");
  const [educationId, setEducationId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLabel(certificate?.label ?? "");
    setEducationId(certificate?.education_id ?? "");
    setError(null);
    setShowDeleteConfirm(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [certificate]);

  async function handleSave() {
    if (!label.trim()) {
      setError("Certificate label is required.");
      return;
    }

    // For new certificates, require a file
    const file = fileInputRef.current?.files?.[0] ?? null;
    if (!certificate && !file) {
      setError("Please select a file to upload.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(label.trim(), educationId, file, certificate);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save certificate.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!certificate) return;
    setIsSaving(true);
    setError(null);
    try {
      await onDelete(certificate);
      setShowDeleteConfirm(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete certificate.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <ModalFrame
        title={certificate ? "Edit certificate" : "Upload certificate"}
        onClose={onClose}
      >
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Label
            </span>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. AWS Solutions Architect"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Link to Education (optional)
            </span>
            <select
              value={educationId}
              onChange={(e) => setEducationId(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            >
              <option value="">— Standalone —</option>
              {completedEducations.map((edu) => (
                <option key={edu.id} value={edu.id}>
                  {edu.name}
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
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                File (PDF, JPEG, PNG, WEBP — max 45 MB)
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                className="w-full text-sm text-zinc-600 file:mr-2 file:rounded file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-700 dark:text-zinc-400 dark:file:bg-zinc-800 dark:file:text-zinc-300"
              />
            </label>
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex justify-end gap-2">
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
              onClick={onClose}
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
        <ConfirmDialog
          title="Delete certificate?"
          description="This will permanently delete the certificate and its file. This cannot be undone."
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
        />
      )}
    </>
  );
}
