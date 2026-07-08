"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import type { Education, Certificate } from "@/types/education";
import type { Priority } from "@/types/taskmanager";
import { PRIORITIES } from "@/types/taskmanager";
import Button from "@/components/common/Button";
import ConfirmDialog from "@/components/taskmanager/ConfirmDialog";
import ModalFrame from "@/components/taskmanager/ModalFrame";
import { certsForEducation, trunc } from "./helpers";
import DocPreviewPanel from "@/components/common/DocPreviewPanel";

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

function LinkSlashIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244M3 3l18 18" />
    </svg>
  );
}

function ShieldExclamationIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.25-8.25-3.286Zm0 13.036h.008v.008H12v-.008Z" />
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
  onSave: (draft: EducationDraft, existingEducation: Education | null, pendingCert?: { file: File; label: string }, pendingLinkCertId?: string) => Promise<void>;
  onDelete: (educationId: string) => Promise<void>;
  onUploadCertificate: (educationId: string, file: File, label: string) => Promise<Certificate>;
  onRenameCertificate: (certificateId: string, newLabel: string) => Promise<void>;
  onDownloadCertificate: (certificate: Certificate) => Promise<void>;
  onDeleteCertificate: (certificate: Certificate) => Promise<void>;
  onLinkCertificate: (educationId: string, certificateId: string) => Promise<void>;
  onUnlinkCertificate: (educationId: string, certificateId: string) => Promise<void>;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  onLinkCertificate,
  onUnlinkCertificate,
}: EducationModalProps) {
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showIncompleteConfirm, setShowIncompleteConfirm] = useState(false);
  const [showPendingIncompleteConfirm, setShowPendingIncompleteConfirm] = useState(false);
  const [certToDelete, setCertToDelete] = useState<Certificate | null>(null);
  const [certToUnlink, setCertToUnlink] = useState<Certificate | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Linked certificates for this education
  const linkedCerts = useMemo(() => education ? certsForEducation(education.id, certificates) : [], [education, certificates]);
  
  // Standalone certificates (not linked to any education)
  const standaloneCerts = certificates.filter(c => !c.education_id);

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
  const [newlyUploadedCerts, setNewlyUploadedCerts] = useState<Certificate[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Standalone certificates linking state
  const [selectedStandaloneCertId, setSelectedStandaloneCertId] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const [sessionAddedCertIds, setSessionAddedCertIds] = useState<string[]>([]);

  useEffect(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    
    setName(education?.name ?? "");
    setProvider(education?.provider ?? "");
    setPriority(education?.priority ?? "medium");
    setDueDate(education ? (education.due_date ?? "") : todayStr);
    setDescription(education?.description ?? "");
    setIsCompleted(education?.is_completed ?? false);
    setError(null);
    setShowDeleteConfirm(false);
    
    // Reset cert states
    setCertFile(null);
    setCertLabel("");
    setUploadError(null);
    setNewlyUploadedCerts([]);
    setEditingCertId(null);
    setEditingCertLabel("");
    setSelectedStandaloneCertId("");
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
        education,
        (certFile && certLabel.trim()) ? { file: certFile, label: certLabel.trim() } : undefined,
        selectedStandaloneCertId || undefined
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
      const newCert = await onUploadCertificate(education.id, certFile, certLabel.trim());
      setNewlyUploadedCerts((prev) => [...prev, newCert]);
      setCertFile(null);
      setCertLabel("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to upload certificate.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleStandaloneCertLink() {
    if (!education || !selectedStandaloneCertId) return;
    setIsLinking(true);
    try {
      await onLinkCertificate(education.id, selectedStandaloneCertId);
      setSessionAddedCertIds(prev => [...prev, selectedStandaloneCertId]);
      setSelectedStandaloneCertId("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to link certificate.");
    } finally {
      setIsLinking(false);
    }
  }

  async function handleUnlinkCertificateFromEducation(certificate: Certificate) {
    if (!userId || !education) return;
    try {
      await onUnlinkCertificate(education.id, certificate.id);
      setCertToUnlink(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to unlink certificate.");
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
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to download certificate.");
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
    <DocPreviewPanel 
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

  const hasUnsavedFormChanges = education ? (
    name !== education.name ||
    provider !== education.provider ||
    priority !== education.priority ||
    dueDate !== (education.due_date ?? "") ||
    description !== education.description ||
    isCompleted !== education.is_completed
  ) : (
    name !== "" ||
    provider !== "" ||
    priority !== "medium" ||
    description !== "" ||
    isCompleted !== false
  );

  const handleCancel = () => {
    if (certFile || newlyUploadedCerts.length > 0 || selectedStandaloneCertId || sessionAddedCertIds.length > 0 || hasUnsavedFormChanges) {
      setShowCancelConfirm(true);
    } else {
      onClose();
    }
  };

  return (
    <>
      <ModalFrame
        title={education ? "Edit education" : "Add education"}
        onClose={handleCancel}
        maxWidthClassName={showSidePanel ? "max-w-6xl" : "max-w-md"}
        sidePanel={sidePanel}
      >
        <div className="flex flex-col h-full space-y-3">
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

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="is_completed"
              checked={isCompleted}
              onChange={(e) => {
                const checked = e.target.checked;
                if (!checked && education && linkedCerts.length > 0) {
                  setShowIncompleteConfirm(true);
                } else if (!checked && certFile) {
                  setShowPendingIncompleteConfirm(true);
                } else {
                  setIsCompleted(checked);
                }
              }}
              className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-600 dark:border-zinc-600 dark:bg-zinc-800 dark:checked:bg-emerald-500"
              disabled={isSaving}
            />
            <label htmlFor="is_completed" className="text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
              Mark as complete (acquired)
            </label>
          </div>

          {/* Document Section - Only visible when completed */}
          {isCompleted && (
            <div className="mt-4 p-3 rounded-lg border border-zinc-200 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/50">
              <span className="block mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                Certificates / Documents
                <span className="text-xs font-normal text-zinc-500 bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full">
                  {linkedCerts.length} attached
                </span>
              </span>

              {/* Existing Certificates List */}
              {linkedCerts.length > 0 && (
                <div className="space-y-2">
                  {linkedCerts.map((cert) => {
                    const isCertEditing = editingCertId === cert.id;
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
                          <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate">
                            {trunc(cert.label || cert.file_name || "Unnamed Certificate", 30)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
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
                            onClick={() => setCertToUnlink(cert)}
                            className="p-1 rounded-md text-zinc-400 hover:text-amber-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                            title="Unlink"
                          >
                            <LinkSlashIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setCertToDelete(cert)}
                            className="p-1 rounded-md text-zinc-400 hover:text-red-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                            title="Delete Permanently"
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
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
                      if (f) {
                        setCertFile(f);
                        setCertLabel(f.name);
                      }
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
                  <div className="flex justify-end items-center gap-2 mt-2">
                    {!education && (
                      <span className="text-xs font-medium text-amber-600 dark:text-amber-400 py-1.5 px-2 bg-amber-50 dark:bg-amber-900/20 rounded mr-auto">
                        Will upload upon saving
                      </span>
                    )}
                    {education && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleCertificateUpload}
                        disabled={isUploading}
                      >
                        {isUploading ? "Uploading..." : "Upload"}
                      </Button>
                    )}
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
              
              {/* Link Existing Standalone Certificate */}
              <div className="space-y-2 mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <span className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Or link an existing standalone certificate:
                </span>
                <div className="flex gap-2">
                  <select
                    value={selectedStandaloneCertId}
                    onChange={(e) => setSelectedStandaloneCertId(e.target.value)}
                    disabled={isLinking || isSaving || standaloneCerts.length === 0}
                    className="flex-1 rounded border border-zinc-300 px-2 py-1.5 text-xs outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 disabled:opacity-50 min-w-0"
                  >
                    <option value="" className="truncate">
                      {standaloneCerts.length === 0 ? "No standalone certificates available" : "Select a certificate..."}
                    </option>
                    {standaloneCerts.map(cert => (
                      <option key={cert.id} value={cert.id} className="truncate">
                        {trunc(cert.label || cert.file_name || "Unnamed Certificate (Corrupted)", 50)}
                      </option>
                    ))}
                  </select>
                  {!education && selectedStandaloneCertId ? (
                    <span className="text-xs font-medium text-amber-600 dark:text-amber-400 py-1.5 px-2 bg-amber-50 dark:bg-amber-900/20 rounded">
                      Will link upon saving
                    </span>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleStandaloneCertLink}
                      disabled={isLinking || isSaving || !selectedStandaloneCertId}
                    >
                      {isLinking ? "Linking..." : "Link"}
                    </Button>
                  )}
                </div>
              </div>

              {/* Encrypted storage notice */}
              <p className="text-xs text-zinc-400 flex items-center gap-1">
                <ShieldExclamationIcon className="h-3 w-3" />
                Files are encrypted before upload to Supabase Storage.
              </p>
            </div>
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          {/* Action buttons */}
          <div className="mt-auto flex justify-end gap-2 pt-4">
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

      {certToUnlink && education && (
        <ConfirmDialog
          title="Unlink certificate?"
          description="This certificate will be unlinked from this education, but it will remain in your Document Vault as a standalone file."
          confirmLabel="Yes, unlink"
          cancelLabel="Cancel"
          onCancel={() => setCertToUnlink(null)}
          onConfirm={() => handleUnlinkCertificateFromEducation(certToUnlink)}
        />
      )}

      {showCancelConfirm && (
        <ConfirmDialog
          title="Unsaved changes"
          description={
            newlyUploadedCerts.length > 0 || sessionAddedCertIds.length > 0
              ? "You have unsaved changes. Newly uploaded certificates will be deleted, and linked standalone files will be unlinked. Do you want to continue?"
              : selectedStandaloneCertId 
                ? "You have a pending standalone certificate selected. If you cancel without saving, it will not be linked to this education. Do you want to continue?"
                : "You have unsaved changes. If you cancel without saving, any modifications you made to the details will be lost. Do you want to continue?"
          }
          confirmLabel="Yes, discard"
          cancelLabel="No, stay"
          onCancel={() => setShowCancelConfirm(false)}
          onConfirm={async () => {
            setShowCancelConfirm(false);
            if (newlyUploadedCerts.length > 0 || sessionAddedCertIds.length > 0) {
              setIsSaving(true);
              try {
                for (const c of newlyUploadedCerts) {
                  await onDeleteCertificate(c);
                }
                if (education) {
                  for (const id of sessionAddedCertIds) {
                    await onUnlinkCertificate(education.id, id);
                  }
                }
              } catch (e) {
                console.error("Failed to cleanup session certs", e);
              }
              setIsSaving(false);
            }
            onClose();
          }}
        />
      )}

      {showIncompleteConfirm && education && (
        <ConfirmDialog
          title="Mark as incomplete?"
          description="Marking this education as incomplete will unlink the attached certificates (they will remain in your Vault as standalone files). Do you want to continue?"
          confirmLabel="Yes, unlink files"
          cancelLabel="Cancel"
          onCancel={() => setShowIncompleteConfirm(false)}
          onConfirm={async () => {
            setShowIncompleteConfirm(false);
            setIsSaving(true);
            setError(null);
            try {
              for (const cert of linkedCerts) {
                await onUnlinkCertificate(education.id, cert.id);
              }
              setCertFile(null);
              setCertLabel("");
              if (fileInputRef.current) fileInputRef.current.value = "";
              setIsCompleted(false);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to unlink certificates.");
            } finally {
              setIsSaving(false);
            }
          }}
        />
      )}

      {showPendingIncompleteConfirm && (
        <ConfirmDialog
          title="Discard pending upload?"
          description="Marking this education as incomplete will discard the certificate file you have selected to upload. Do you want to continue?"
          confirmLabel="Yes, discard"
          cancelLabel="Cancel"
          onCancel={() => setShowPendingIncompleteConfirm(false)}
          onConfirm={() => {
            setShowPendingIncompleteConfirm(false);
            setCertFile(null);
            setCertLabel("");
            if (fileInputRef.current) fileInputRef.current.value = "";
            setIsCompleted(false);
          }}
        />
      )}

      {certToDelete && (
        <ConfirmDialog
          title="Delete certificate?"
          description={`Are you sure you want to permanently delete the certificate "${certToDelete.label}"? This action cannot be undone.`}
          confirmLabel="Yes, delete"
          cancelLabel="Cancel"
          onCancel={() => setCertToDelete(null)}
          onConfirm={async () => {
            const cert = certToDelete;
            setCertToDelete(null);
            setIsSaving(true);
            try {
              if (selectedCertId === cert.id) setSelectedCertId(null);
              await onDeleteCertificate(cert);
              // Also remove from newlyUploadedCerts if it was just uploaded
              setNewlyUploadedCerts(prev => prev.filter(c => c.id !== cert.id));
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to delete certificate.");
            } finally {
              setIsSaving(false);
            }
          }}
        />
      )}
    </>
  );
}
