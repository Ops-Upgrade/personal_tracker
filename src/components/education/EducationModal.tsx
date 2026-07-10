"use client";

import { useEffect, useMemo, useState } from "react";
import type { Education, Certificate } from "@/types/education";
import { downloadCertificateFile } from "@/api/education/certificateStorage";
import type { Priority } from "@/types/taskmanager";
import { PRIORITIES } from "@/types/taskmanager";
import ConfirmDialog from "@/components/taskmanager/ConfirmDialog";
import GlobalActionModal from "@/components/common/GlobalActionModal";
import type { ModalFile } from "@/components/common/GlobalActionModal";
import { InputField, SelectField, TextareaField, CheckboxField } from "@/components/common/FormField";
import ErrorBanner from "@/components/common/ErrorBanner";
import { certsForEducation, getUniqueFileName, trunc } from "./helpers";

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
  certificates: Certificate[];
  /** ALL educations (needed for standalone mode dropdown) */
  allEducations?: Education[];
  userId: string;
  onClose: () => void;
  onSave: (draft: EducationDraft, existingEducation: Education | null, pendingCert?: { file: File; label: string }, pendingLinkCertId?: string, pendingUnlinkCertIds?: string[], pendingDeleteCertIds?: string[]) => Promise<void>;
  onDelete: (educationId: string, cascadeMode: 'unlink' | 'cascade') => Promise<void>;
  onUploadCertificate: (educationId: string, file: File, label: string) => Promise<Certificate>;
  onDownloadCertificate: (certificate: Certificate) => Promise<void>;
  onDeleteCertificate: (certificate: Certificate, cascadeMode: 'unlink' | 'cascade') => Promise<void>;
  onLinkCertificate: (educationId: string, certificateId: string) => Promise<void>;
  onUnlinkCertificate: (educationId: string, certificateId: string) => Promise<void>;
  // --- Standalone mode (Task 2.2) ---
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
  certificates,
  allEducations,
  userId,
  onClose,
  onSave,
  onDelete,
  onDownloadCertificate,
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

  // --- Certificate management ---
  const [newFiles, setNewFiles] = useState<{ file: File; label: string; tempId: string }[]>([]);
  const [markedForDeletion, setMarkedForDeletion] = useState<Set<string>>(new Set());
  const [markedForUnlink, setMarkedForUnlink] = useState<Set<string>>(new Set());
  const [stagedLinkCertId, setStagedLinkCertId] = useState<string | null>(null);
  const [selectedCertId, setSelectedCertId] = useState<string | null>(() => {
    // Set before first render — no one-frame queue flash (matching ExpenseModal behavior)
    if (isStandaloneMode || !education) return null;
    const certs = certsForEducation(education.id, certificates);
    return certs.length > 0 ? certs[0].id : null;
  });

  const [linkSearchQuery, setLinkSearchQuery] = useState("");
  const [linkDropdownOpen, setLinkDropdownOpen] = useState(false);

  // Standalone mode state (Task 2.2)
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
    setStagedLinkCertId(null);
    // Auto-select first existing cert on open (matching ExpenseModal behavior)
    const existingCerts = education ? certsForEducation(education.id, certificates) : [];
    setSelectedCertId(existingCerts.length > 0 ? existingCerts[0].id : null);
    setLinkSearchQuery("");
    setLinkDropdownOpen(false);
    setStandaloneFile(null);
    setStandaloneLinkedEduId("");
    setStandaloneNewEduName("");
    setStandaloneNewEduProvider("");
  }, [education, isStandaloneMode, certificates]);

  // ── Baseline form values (single source of truth for both reset AND dirty check) ──
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

  const linkedCerts = useMemo(
    () => education ? certsForEducation(education.id, certificates) : [],
    [education, certificates]
  );
  const standaloneCerts = certificates.filter(c => !c.education_id);

  // Compare current form state against baseline (computed once, never mismatches)
  const hasFormChanges =
    name !== formBaseline.name ||
    provider !== formBaseline.provider ||
    priority !== formBaseline.priority ||
    dueDate !== formBaseline.dueDate ||
    description !== formBaseline.description ||
    isCompleted !== formBaseline.isCompleted;

  const isDirty = isStandaloneMode
    ? standaloneFile !== null || standaloneLinkedEduId !== "" || standaloneNewEduName !== "" || standaloneNewEduProvider !== ""
    : hasFormChanges || newFiles.length > 0 || stagedLinkCertId !== null || markedForDeletion.size > 0 || markedForUnlink.size > 0;

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
      orderGroup: number;   // 0=existing certs, 1=new uploads, 2=staged link
      orderIndex: number;   // position within group for stable numbering
    };

    const entries: FileEntry[] = [];

    // Existing linked certs (skip those marked for deletion or unlink)
    let idx = 0;
    for (const cert of linkedCerts) {
      if (markedForDeletion.has(cert.id)) continue;
      if (markedForUnlink.has(cert.id)) continue;
      entries.push({
        id: cert.id,
        rawName: cert.label || "Unnamed Certificate",
        mime: cert.file_mime,
        iv: cert.file_iv,
        isMarkedForDeletion: false,
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

    // Staged link cert
    if (stagedLinkCertId) {
      const sc = certificates.find(c => c.id === stagedLinkCertId);
      if (sc) {
        entries.push({
          id: sc.id,
          rawName: sc.label || "Unnamed Certificate",
          mime: sc.file_mime,
          iv: sc.file_iv,
          isNew: true,
          orderGroup: 2,
          orderIndex: 0,
        });
      }
    }

    // Number duplicates: group by rawName, append (1)/(2)/… when >1
    const buckets = new Map<string, FileEntry[]>();
    for (const e of entries) {
      if (!buckets.has(e.rawName)) buckets.set(e.rawName, []);
      buckets.get(e.rawName)!.push(e);
    }

    const result: ModalFile[] = [];
    for (const [, bucket] of buckets) {
      // Stable sort: existing certs first, then new uploads, then staged
      bucket.sort((a, b) => a.orderGroup - b.orderGroup || a.orderIndex - b.orderIndex);
      if (bucket.length === 1) {
        const e = bucket[0];
        result.push({ id: e.id, name: e.rawName, mime: e.mime, iv: e.iv, file: e.file, isNew: e.isNew, isMarkedForDeletion: e.isMarkedForDeletion });
      } else {
        bucket.forEach((e, i) => {
          result.push({ id: e.id, name: `${e.rawName} (${i + 1})`, mime: e.mime, iv: e.iv, file: e.file, isNew: e.isNew, isMarkedForDeletion: e.isMarkedForDeletion });
        });
      }
    }

    return result;
  }, [isStandaloneMode, standaloneFile, linkedCerts, newFiles, stagedLinkCertId, markedForDeletion, markedForUnlink, certificates]);

  // --- File action handlers ---

  const handleFileDelete = (fileId: string) => {
    if (isStandaloneMode) {
      setStandaloneFile(null);
      setSelectedCertId(null);
      return;
    }

    // If it's a new (unsaved) file, remove it immediately
    const newFile = newFiles.find(nf => nf.tempId === fileId);
    if (newFile) {
      setNewFiles(prev => prev.filter(nf => nf.tempId !== fileId));
      if (selectedCertId === fileId) setSelectedCertId(null);
      return;
    }

    // If it's the staged link, unstage it
    if (stagedLinkCertId === fileId) {
      setStagedLinkCertId(null);
      if (selectedCertId === fileId) setSelectedCertId(null);
      return;
    }

    // Toggle mark for deletion
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
    if (stagedLinkCertId === fileId) { setStagedLinkCertId(null); return; }
    if (newFiles.find(nf => nf.tempId === fileId)) return;

    setMarkedForUnlink(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
    setMarkedForDeletion(prev => { const next = new Set(prev); next.delete(fileId); return next; });
  };

  const handleFileDownload = async (fileId: string) => {
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

    const newFile = newFiles.find(nf => nf.tempId === fileId);
    if (newFile) {
      const url = URL.createObjectURL(newFile.file);
      const a = document.createElement("a");
      a.href = url; a.download = newFile.label;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
      return;
    }

    const cert = [...linkedCerts, ...certificates].find(c => c.id === fileId);
    if (!cert) return;

    try { await onDownloadCertificate(cert); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed to download certificate."); }
  };

  const handleFileUpload = (file: File) => {
    if (isStandaloneMode) {
      // Standalone mode: dedup against all existing certificate labels
      const existingNames = new Set(certificates.map(c => c.label || ""));
      const uniqueName = getUniqueFileName(file.name, existingNames);
      // Rename the file object so the dedup'd name is stored
      const renamedFile = new File([file], uniqueName, { type: file.type, lastModified: file.lastModified });
      setStandaloneFile(renamedFile);
      return;
    }

    // Build the set of all taken names across the ENTIRE certificate store
    const taken = new Set<string>();
    // All existing certificates (entire store) — skip those marked for deletion/unlink in this session
    for (const cert of certificates) {
      if (linkedCerts.some(lc => lc.id === cert.id)) {
        // For certs linked to this education, respect deletion/unlink marks
        if (markedForDeletion.has(cert.id)) continue;
        if (markedForUnlink.has(cert.id)) continue;
      }
      if (cert.label) taken.add(cert.label);
    }
    // Also consider the staged link cert (already in certificates, but ensure it's included)
    if (stagedLinkCertId) {
      const sc = certificates.find(c => c.id === stagedLinkCertId);
      if (sc && sc.label) taken.add(sc.label);
    }

    setNewFiles(prev => {
      // Also include already-queued new files in this session
      for (const nf of prev) taken.add(nf.label);

      const label = getUniqueFileName(file.name, taken);

      const tempId = `new-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      return [...prev, { file, label, tempId }];
    });

    // Return to queue view so the newly added file is visible in the list
    setSelectedCertId(null);
  };

  const handleLinkDropdownSelect = (certId: string) => {
    if (!certId) return;
    setStagedLinkCertId(certId);
    setLinkSearchQuery("");
    setLinkDropdownOpen(false);
    // Return to queue view so the newly linked file is visible in the list
    setSelectedCertId(null);
  };

  // Standalone certs available for linking (excludes currently staged, searches label + file_name)
  const filteredLinkCerts = useMemo(() => {
    const available = stagedLinkCertId
      ? standaloneCerts.filter(c => c.id !== stagedLinkCertId)
      : standaloneCerts;
    if (!linkSearchQuery.trim()) return available;
    const q = linkSearchQuery.toLowerCase();
    return available.filter(c =>
      (c.label || "").toLowerCase().includes(q) ||
      (c.file_name || "").toLowerCase().includes(q)
    );
  }, [standaloneCerts, linkSearchQuery, stagedLinkCertId]);

  const handleLoadPreview = async (fileId: string): Promise<Blob> => {
    if (isStandaloneMode && standaloneFile) return standaloneFile;

    const newFile = newFiles.find(nf => nf.tempId === fileId);
    if (newFile) return newFile.file;

    const cert = [...linkedCerts, ...certificates].find(c => c.id === fileId);
    if (!cert || !cert.file_name || !cert.file_iv || !cert.file_mime) {
      throw new Error("Cannot load preview for this file.");
    }
    return downloadCertificateFile(userId, cert.file_name, cert.file_iv, cert.file_mime);
  };

  // --- Delete handler ---
  async function handleDelete() {
    if (!education) return;
    setShowDeleteConfirm(true);
  }

  // --- Save handler ---
  const handleSaveWithFullProcessing = async () => {
    // Standalone mode save (Task 2.2)
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

    // Standard mode save
    if (!name.trim()) {
      setError("Education name is required.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Capture all mutable state BEFORE any async operations.
      // All cert operations (unlink, delete, link, upload) are passed to onSave
      // so they execute atomically with a single refreshData at the end,
      // avoiding mid-save re-renders that reset modal state.
      const certsToUnlink = [...markedForUnlink];
      const certsToDelete = [...markedForDeletion];
      const certToLink = stagedLinkCertId;
      const firstNewFile = newFiles[0];
      const pendingCert = firstNewFile ? { file: firstNewFile.file, label: firstNewFile.label } : undefined;
      const finalName = name.trim();
      const finalProvider = provider.trim();
      const finalPriority = priority;
      const finalDueDate = dueDate || null;
      const finalDescription = description.trim();
      const finalIsCompleted = isCompleted;

      // All operations consolidated into onSave to prevent refreshData race conditions
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
        pendingCert,
        certToLink ?? undefined,
        certsToUnlink.length > 0 ? certsToUnlink : undefined,
        certsToDelete.length > 0 ? certsToDelete : undefined,
      );

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save education.");
    } finally {
      setIsSaving(false);
    }
  };

  // --- Build link dropdown (Task 2.1) for rightPanelExtras ---
  // Searchable combobox: input IS the trigger with chevron beside it
  const linkDropdownExtras = useMemo(() => {
    if (isStandaloneMode) return null;
    if (standaloneCerts.length === 0 && !stagedLinkCertId) return null;

    // Build display names: show label only; number duplicates (no UUIDs exposed)
    const labelBuckets = new Map<string, Certificate[]>();
    for (const cert of standaloneCerts) {
      const key = cert.label || "Unnamed";
      if (!labelBuckets.has(key)) labelBuckets.set(key, []);
      labelBuckets.get(key)!.push(cert);
    }
    const displayName = new Map<string, string>();
    for (const [, bucket] of labelBuckets) {
      if (bucket.length === 1) {
        displayName.set(bucket[0].id, trunc(bucket[0].label || "Unnamed", 55));
      } else {
        // Stable sort by created_at so numbering is consistent
        bucket.sort((a, b) => a.created_at.localeCompare(b.created_at));
        bucket.forEach((cert, i) => {
          displayName.set(cert.id, `${trunc(cert.label || "Unnamed", 50)} (${i + 1})`);
        });
      }
    }
    const fmt = (cert: Certificate): string =>
      displayName.get(cert.id) || trunc(cert.label || "Unnamed", 55);

    const stagedCert = stagedLinkCertId
      ? standaloneCerts.find(c => c.id === stagedLinkCertId)
      : null;
    const stagedLabel = stagedCert ? fmt(stagedCert) : null;

    // If a cert is staged, show its full display name; otherwise show typed query
    const displayValue = stagedLinkCertId ? (stagedLabel ?? "") : linkSearchQuery;

    return (
      <div className="relative w-full">
          {/* Label */}
          <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Select a file from the store
          </span>

          {/* Combobox: input + chevron — type to filter, chevron toggles dropdown */}
          <div className="relative flex items-center">
            <input
              type="text"
              value={displayValue}
              onChange={(e) => {
                if (stagedLinkCertId) setStagedLinkCertId(null);
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

          {/* Dropdown popup: filtered results */}
          {linkDropdownOpen && (
            <div className="absolute z-10 mt-1 w-full rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              {filteredLinkCerts.length > 0 ? (
                <div className="max-h-36 overflow-y-auto">
                  {filteredLinkCerts.map(cert => (
                    <button
                      key={cert.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleLinkDropdownSelect(cert.id)}
                      className="w-full px-3 py-1.5 text-left text-xs text-zinc-700 hover:bg-emerald-50 hover:text-emerald-700 dark:text-zinc-300 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400"
                    >
                      {fmt(cert)}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-3 py-2 text-xs text-zinc-400">
                  {linkSearchQuery ? "No certificates found" : "No certificates available"}
                </div>
              )}
            </div>
          )}
        </div>
    );

  }, [isStandaloneMode, linkSearchQuery, linkDropdownOpen, filteredLinkCerts, stagedLinkCertId, standaloneCerts, isSaving]);

  // --- Render ---

  // Standalone mode: use simpler modal (no delete for new cert)
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
          selectedFileId={selectedCertId}
          onSelectFile={(id) => setSelectedCertId(id)}
          onFileDelete={standaloneFile ? handleFileDelete : undefined}
          onFileDownload={standaloneFile ? handleFileDownload : undefined}
          onFileUpload={handleFileUpload}
          onLoadPreview={standaloneFile ? handleLoadPreview : undefined}
          onSave={handleSaveWithFullProcessing}
          isSaving={isSaving}
        >
          <div className="flex flex-col h-full space-y-3">
            {/* Link to existing record dropdown (Task 2.2 item 3) */}
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

            {/* --- or --- divider (Task 2.2 item 4) */}
            <div className="flex items-center gap-2">
              <div className="flex-1 border-t border-zinc-200 dark:border-zinc-700" />
              <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase">— or —</span>
              <div className="flex-1 border-t border-zinc-200 dark:border-zinc-700" />
            </div>

            {/* New Education form (Task 2.2 item 5) — disabled if dropdown selected */}
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
        selectedFileId={selectedCertId}
        onSelectFile={(id) => setSelectedCertId(id)}
        onFileDelete={hasFiles ? handleFileDelete : undefined}
        onFileUnlink={hasFiles ? handleFileUnlink : undefined}
        onFileDownload={hasFiles ? handleFileDownload : undefined}
        onFileUpload={handleFileUpload}
        onLoadPreview={handleLoadPreview}
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

          <TextareaField label="Description" value={description} onChange={setDescription} disabled={isSaving} rows={2} />

          <CheckboxField label="Mark as complete (acquired)" checked={isCompleted} onChange={setIsCompleted} disabled={isSaving} id="is_completed" />

          {isCompleted && (
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {files.length} certificate{files.length !== 1 ? "s" : ""} attached
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
            linkedCerts.length > 0
              ? `This education has ${linkedCerts.length} linked certificate(s).`
              : "Are you sure you want to delete this education? This cannot be undone."
          }
          confirmLabel="Delete"
          cancelLabel="Cancel"
          showDeleteFilesCheckbox={linkedCerts.length > 0}
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
