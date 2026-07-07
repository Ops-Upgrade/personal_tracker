"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import type { Education, Certificate } from "@/types/education";
import type { Priority } from "@/types/taskmanager";
import { PRIORITIES } from "@/types/taskmanager";
import Button from "@/components/common/Button";
import ConfirmDialog from "@/components/taskmanager/ConfirmDialog";
import ModalFrame from "@/components/taskmanager/ModalFrame";
import { certsForEducation, trunc } from "./helpers";
import { downloadCertificateFile } from "@/api/education";

// --- Inline SVG Icons ---
function XMarkIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

function ArrowDownTrayIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}

function DocumentIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  );
}

function PhotoIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.41a2.25 2.25 0 0 1 3.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
  );
}

function LinkIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
    </svg>
  );
}

function ArrowPathIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m-8.331-8.331a.75.75 0 0 1 1.06 0l4.242 4.242a.75.75 0 0 1 0 1.06l-4.242 4.242a.75.75 0 0 1-1.06-1.06l2.97-2.97H5.25a.75.75 0 0 1 0-1.5h8.19l-2.97-2.97a.75.75 0 0 1 0-1.06Z" />
    </svg>
  );
}

function NoSymbolIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
  );
}

function DocumentTextIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  );
}

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
  certificates: Certificate[];
  userId: string;
  onClose: () => void;
  onSave: (draft: EducationDraft, existingEducation: Education | null) => Promise<void>;
  onDelete: (educationId: string) => Promise<void>;
  onUploadCertificate: (educationId: string, file: File, label: string) => Promise<void>;
  onRenameCertificate: (certificateId: string, newLabel: string) => Promise<void>;
  onDownloadCertificate: (certificate: Certificate) => Promise<void>;
  onDeleteCertificate: (certificate: Certificate) => Promise<void>;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================================
// Certificate Preview Panel (matches InvoicePreviewPanel)
// ============================================================
function CertificatePreviewPanel({ 
  cert, 
  userId, 
  onDownload, 
  isDownloading,
  currentIndex,
  totalCerts,
  onPrev,
  onNext
}: { 
  cert: Certificate, 
  userId: string, 
  onDownload: () => void, 
  isDownloading: boolean,
  currentIndex: number,
  totalCerts: number,
  onPrev: () => void,
  onNext: () => void
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  // Load preview immediately when cert changes
  useEffect(() => {
    let active = true;
    const loadPreview = async () => {
      if (!cert.file_name || !cert.file_iv) return;
      setIsLoading(true);
      setLoadError(null);
      setBlobUrl(null);
      try {
        const blob = await downloadCertificateFile(userId, cert.file_name, cert.file_iv, cert.file_mime);
        if (!active) return;
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
      } catch (err: unknown) {
        if (!active) return;
        setLoadError(err instanceof Error ? err.message : "Failed to decrypt certificate.");
      } finally {
        if (active) setIsLoading(false);
      }
    };
    loadPreview();
    return () => { active = false; };
  }, [cert, userId]);

  const mimeType = cert.file_mime || "";
  const isPdf = mimeType === "application/pdf";
  const isImage = mimeType.startsWith("image/");

  return (
    <div className="flex flex-col h-full max-h-[80vh]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        {/* Navigation */}
        <button 
          type="button" 
          disabled={currentIndex === 0}
          onClick={onPrev}
          className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 tabular-nums">
          {currentIndex + 1} / {totalCerts}
        </span>
        <button 
          type="button" 
          disabled={currentIndex === totalCerts - 1}
          onClick={onNext}
          className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>

        <span className="flex-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 truncate min-w-0 pl-2">
          {cert.label}
        </span>
        <button
          type="button"
          onClick={onDownload}
          disabled={isDownloading}
          className="cursor-pointer p-1 rounded-md text-zinc-400 hover:text-amber-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40"
          title="Download certificate"
        >
          <ArrowDownTrayIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4">
        {isLoading && (
          <div className="flex flex-col items-center gap-3 text-zinc-400">
            <ArrowPathIcon className="h-8 w-8 animate-spin" />
            <span className="text-sm">Decrypting certificate...</span>
          </div>
        )}

        {loadError && (
          <div className="flex flex-col items-center gap-3 text-red-400">
            <NoSymbolIcon className="h-8 w-8" />
            <span className="text-sm text-center">{loadError}</span>
          </div>
        )}

        {blobUrl && isPdf && (
          <iframe
            src={blobUrl}
            className="w-full h-full min-h-[400px] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white"
            title="Certificate PDF Preview"
          />
        )}

        {blobUrl && isImage && (
          <div className="relative w-full h-full min-h-[200px]">
            <Image
              src={blobUrl}
              alt="Certificate preview"
              fill
              unoptimized
              className="object-contain rounded-lg"
            />
          </div>
        )}

        {blobUrl && !isPdf && !isImage && (
          <div className="flex flex-col items-center gap-3 text-zinc-400">
            <DocumentIcon className="h-8 w-8" />
            <span className="text-sm">Preview not available for this file type.</span>
            <a
              href={blobUrl}
              download={cert.file_name}
              className="text-sm text-emerald-500 hover:text-emerald-400 underline"
            >
              Download instead
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Main Modal
// ============================================================
export default function EducationModal({
  education,
  certificates,
  userId,
  onClose,
  onSave,
  onDelete,
  onUploadCertificate,
  onRenameCertificate,
  onDownloadCertificate,
  onDeleteCertificate,
}: EducationModalProps) {
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Linked certificates for this education
  const linkedCerts = education ? certsForEducation(education.id, certificates) : [];

  // Certificate selection & rename
  const [selectedCertId, setSelectedCertId] = useState<string | null>(null);
  const [editingCertId, setEditingCertId] = useState<string | null>(null);
  const [editingCertLabel, setEditingCertLabel] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // New certificate upload state
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certLabel, setCertLabel] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(education?.name ?? "");
    setProvider(education?.provider ?? "");
    setPriority(education?.priority ?? "medium");
    setDueDate(education?.due_date ?? "");
    setDescription(education?.description ?? "");
    setIsCompleted(education?.is_completed ?? false);
    setError(null);
    setShowDeleteConfirm(false);
    
    // Reset cert states
    setCertFile(null);
    setCertLabel("");
    setUploadError(null);
    setEditingCertId(null);
    setEditingCertLabel("");
    if (linkedCerts.length > 0 && !selectedCertId) {
      setSelectedCertId(linkedCerts[0].id);
    }
  }, [education]);
  
  // Update selected cert if list changes
  useEffect(() => {
    if (linkedCerts.length > 0 && !linkedCerts.find(c => c.id === selectedCertId)) {
      setSelectedCertId(linkedCerts[0].id);
    }
  }, [linkedCerts, selectedCertId]);

  async function handleSave() {
    if (!name.trim()) {
      setError("Education name is required.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(
        {
          name: name.trim(),
          provider: provider.trim(),
          priority,
          due_date: dueDate || null,
          description: description.trim(),
          is_completed: isCompleted,
        },
        education
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save education.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!education) return;
    setIsSaving(true);
    setError(null);
    try {
      await onDelete(education.id);
      setShowDeleteConfirm(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete education.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCertificateUpload() {
    if (!education) return;
    if (!certFile) {
      setUploadError("Please select a file.");
      return;
    }
    if (!certLabel.trim()) {
      setUploadError("Please enter a label for the certificate.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    try {
      await onUploadCertificate(education.id, certFile, certLabel.trim());
      setCertFile(null);
      setCertLabel("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to upload certificate.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleRenameSubmit(certId: string) {
    if (!editingCertLabel.trim()) return;
    setIsRenaming(true);
    try {
      await onRenameCertificate(certId, editingCertLabel.trim());
      setEditingCertId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to rename certificate.");
    } finally {
      setIsRenaming(false);
    }
  }

  const handleDownload = async (cert: Certificate) => {
    setIsDownloading(true);
    try {
      await onDownloadCertificate(cert);
    } finally {
      setIsDownloading(false);
    }
  };

  const selectedIndex = linkedCerts.findIndex(c => c.id === selectedCertId);
  const selectedCert = selectedIndex >= 0 ? linkedCerts[selectedIndex] : undefined;
  const showSidePanel = Boolean(selectedCert);

  const handlePrev = () => {
    if (selectedIndex > 0) setSelectedCertId(linkedCerts[selectedIndex - 1].id);
  };
  const handleNext = () => {
    if (selectedIndex < linkedCerts.length - 1) setSelectedCertId(linkedCerts[selectedIndex + 1].id);
  };

  const sidePanel = selectedCert ? (
    <CertificatePreviewPanel 
      cert={selectedCert} 
      userId={userId} 
      onDownload={() => handleDownload(selectedCert)}
      isDownloading={isDownloading}
      currentIndex={selectedIndex}
      totalCerts={linkedCerts.length}
      onPrev={handlePrev}
      onNext={handleNext}
    />
  ) : undefined;

  return (
    <>
      <ModalFrame
        title={education ? "Edit education" : "Add education"}
        onClose={onClose}
        maxWidthClassName={showSidePanel ? "max-w-6xl" : "max-w-md"}
        sidePanel={sidePanel}
      >
        <div className="space-y-3">
          {/* Name */}
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Course / Certification Name
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSaving}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 disabled:opacity-50"
            />
          </label>

          {/* Provider */}
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Provider
            </span>
            <input
              type="text"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              disabled={isSaving}
              placeholder="Institution or platform"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 disabled:opacity-50"
            />
          </label>
          
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Priority */}
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Priority
              </span>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                disabled={isSaving}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 disabled:opacity-50"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p[0].toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </select>
            </label>

            {/* Due Date */}
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Due Date
              </span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={isSaving}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 disabled:opacity-50 [color-scheme:dark]"
              />
            </label>
          </div>

          {/* Description */}
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Description
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSaving}
              rows={2}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 disabled:opacity-50"
            />
          </label>

          {/* Mark complete */}
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={isCompleted}
              onChange={(e) => setIsCompleted(e.target.checked)}
              disabled={isSaving}
            />
            Mark complete
          </label>

          {/* --- Certificates Upload & Management Zone --- */}
          {education && isCompleted && (
            <div className="space-y-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                <DocumentTextIcon className="inline h-3.5 w-3.5 mr-1" />
                Certificates
              </span>

              {/* Existing Certificates List */}
              {linkedCerts.length > 0 && (
                <div className="space-y-2">
                  {linkedCerts.map((cert) => {
                    const isEditing = editingCertId === cert.id;
                    const isSelected = selectedCertId === cert.id;
                    const mimeType = cert.file_mime || "";
                    const FileIcon = mimeType === "application/pdf" ? DocumentIcon : mimeType.startsWith("image/") ? PhotoIcon : LinkIcon;
                    
                    return (
                      <div
                        key={cert.id}
                        className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors cursor-pointer
                          ${isSelected 
                            ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700/50 dark:bg-emerald-900/20" 
                            : "border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/60 hover:border-zinc-400 dark:hover:border-zinc-600"
                          }
                        `}
                        onClick={() => setSelectedCertId(cert.id)}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <FileIcon className={`h-4 w-4 shrink-0 ${isSelected ? "text-emerald-500" : "text-zinc-400"}`} />
                          {isEditing ? (
                            <input
                              type="text"
                              autoFocus
                              value={editingCertLabel}
                              onChange={(e) => setEditingCertLabel(e.target.value)}
                              className="flex-1 w-full rounded border border-zinc-300 px-1.5 py-0.5 text-xs outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleRenameSubmit(cert.id);
                                if (e.key === "Escape") setEditingCertId(null);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              disabled={isRenaming}
                            />
                          ) : (
                            <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate">
                              {trunc(cert.label, 30)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {isEditing ? (
                            <>
                              <Button variant="success" size="sm" onClick={() => handleRenameSubmit(cert.id)} disabled={isRenaming}>✓</Button>
                              <Button variant="secondary" size="sm" onClick={() => setEditingCertId(null)} disabled={isRenaming}>✕</Button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => { setEditingCertId(cert.id); setEditingCertLabel(cert.label); }}
                                className="p-1 rounded-md text-zinc-400 hover:text-amber-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                                title="Rename"
                              >
                                ✎
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownload(cert)}
                                disabled={isDownloading}
                                className="p-1 rounded-md text-zinc-400 hover:text-emerald-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                                title="Download"
                              >
                                <ArrowDownTrayIcon className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (selectedCertId === cert.id) setSelectedCertId(null);
                                  onDeleteCertificate(cert);
                                }}
                                className="p-1 rounded-md text-zinc-400 hover:text-red-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                                title="Remove"
                              >
                                <XMarkIcon className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Upload New Certificate Form */}
              <div className="space-y-2 mt-2">
                {/* File Input Zone */}
                <label
                  className={`flex flex-col items-center justify-center gap-1 p-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors
                    ${isUploading || isSaving
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
                      if (f) setCertFile(f);
                    }}
                    disabled={isUploading || isSaving}
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
                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      value={certLabel}
                      onChange={(e) => setCertLabel(e.target.value)}
                      placeholder="Label (e.g. AWS Certified...)"
                      className="flex-1 rounded border border-zinc-300 px-2 py-1.5 text-xs outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleCertificateUpload}
                      disabled={isUploading || !certLabel.trim()}
                    >
                      {isUploading ? "Uploading..." : "Upload"}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => { setCertFile(null); setCertLabel(""); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                      disabled={isUploading}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
                {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-2">
            {education && (
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
              Save
            </Button>
          </div>
        </div>
      </ModalFrame>

      {showDeleteConfirm && education && (
        <ConfirmDialog
          title="Delete education?"
          description="Are you sure? This will also remove all linked certificates. This cannot be undone."
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
        />
      )}
    </>
  );
}
