"use client";

import { useState, useMemo, useCallback } from "react";
import type { Document } from "@/types/document";
import type { ModalFile } from "@/components/common/GlobalActionModal";
import { downloadDocumentFile } from "@/api/common/documentStorage";

// ── Types ──

export interface NewFileEntry {
  file: File;
  name: string; // display name (may differ from file.name after dedup/rename)
  tempId: string;
}

export interface UseModalDocumentStateParams {
  /** Documents already linked to the parent record. */
  attachedDocuments: Document[];
  /** All standalone (unlinked) documents available for linking. */
  standaloneDocuments: Document[];
  /** The authenticated user ID (for downloading/previewing). */
  userId: string;
  /** IDs the user has marked for removal/deletion. Managed externally so callers
   *  can differentiate "delete" vs "unlink" (Education) from simple removal (Medical). */
  markedForRemoval?: Set<string>;
}

export interface UseModalDocumentStateReturn {
  // ── State ──
  newFiles: NewFileEntry[];
  setNewFiles: React.Dispatch<React.SetStateAction<NewFileEntry[]>>;
  stagedLinkDocId: string | null;
  setStagedLinkDocId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedFileId: string | null;
  setSelectedFileId: React.Dispatch<React.SetStateAction<string | null>>;
  linkSearchQuery: string;
  setLinkSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  linkDropdownOpen: boolean;
  setLinkDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // ── Computed ──
  /** The ModalFile[] array ready to pass to GlobalActionModal. */
  files: ModalFile[];
  /** Standalone docs available for linking (excludes staged). */
  availableStandalone: Document[];
  /** Filtered standalone docs based on linkSearchQuery. */
  filteredLinkDocs: Document[];

  // ── Handlers ──
  /** Stage a new file upload (generates a tempId internally). */
  addNewFile: (file: File, name?: string) => void;
  /** Remove a staged new file by tempId. Does NOT touch markedForRemoval. */
  removeNewFile: (tempId: string) => void;
  /** Download a file (new or existing attached doc). */
  handleFileDownload: (fileId: string) => Promise<void>;
  /** Rename a new file entry. */
  handleFileRename: (fileId: string, newName: string) => void;
  /** Load a file as a Blob for preview. */
  handleLoadPreview: (fileId: string) => Promise<Blob>;
  /** Select a standalone doc from the link dropdown. */
  handleLinkDropdownSelect: (docId: string) => void;

  // ── Reset ──
  resetFileState: () => void;
}

// ── Hook ──

export function useModalDocumentState({
  attachedDocuments,
  standaloneDocuments,
  userId,
  markedForRemoval,
}: UseModalDocumentStateParams): UseModalDocumentStateReturn {
  const [newFiles, setNewFiles] = useState<NewFileEntry[]>([]);
  const [stagedLinkDocId, setStagedLinkDocId] = useState<string | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [linkSearchQuery, setLinkSearchQuery] = useState("");
  const [linkDropdownOpen, setLinkDropdownOpen] = useState(false);

  // ── Derived: files array for GlobalActionModal ──

  const files: ModalFile[] = useMemo(() => {
    const result: ModalFile[] = [];

    // Existing attached documents (exclude those marked for removal)
    for (const doc of attachedDocuments) {
      if (markedForRemoval?.has(doc.id)) continue;
      result.push({
        id: doc.id,
        name: doc.label || doc.file_name || "Unnamed Document",
        mime: doc.file_mime,
        iv: doc.file_iv,
      });
    }

    // Newly staged files
    for (const nf of newFiles) {
      result.push({
        id: nf.tempId,
        name: nf.name,
        mime: nf.file.type,
        file: nf.file,
        isNew: true,
      });
    }

    // Staged link (existing standalone document being linked)
    if (stagedLinkDocId) {
      const sd = standaloneDocuments.find((d) => d.id === stagedLinkDocId);
      if (sd) {
        result.push({
          id: sd.id,
          name: sd.label || sd.file_name || "Unnamed Document",
          mime: sd.file_mime,
          iv: sd.file_iv,
          isNew: true,
        });
      }
    }

    return result;
  }, [attachedDocuments, newFiles, markedForRemoval, stagedLinkDocId, standaloneDocuments]);

  // ── Derived: available standalone docs ──

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

  // ── Handlers ──

  const addNewFile = useCallback((file: File, name?: string) => {
    const tempId = `new-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setNewFiles((prev) => [...prev, { file, name: name ?? file.name, tempId }]);
    setSelectedFileId(null);
  }, []);

  const removeNewFile = useCallback((tempId: string) => {
    setNewFiles((prev) => prev.filter((nf) => nf.tempId !== tempId));
  }, []);

  const handleFileDownload = useCallback(
    async (fileId: string) => {
      // Check new files first
      const newFile = newFiles.find((nf) => nf.tempId === fileId);
      if (newFile) {
        const url = URL.createObjectURL(newFile.file);
        const a = document.createElement("a");
        a.href = url;
        a.download = newFile.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      }

      // Check attached documents
      const doc = attachedDocuments.find((d) => d.id === fileId);
      if (!doc || !doc.file_name || !doc.file_iv || !doc.file_mime) return;
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
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : "Failed to download document.");
      }
    },
    [newFiles, attachedDocuments, userId],
  );

  const handleFileRename = useCallback(
    (fileId: string, newName: string) => {
      setNewFiles((prev) =>
        prev.map((nf) =>
          nf.tempId === fileId ? { ...nf, name: newName } : nf,
        ),
      );
    },
    [],
  );

  const handleLoadPreview = useCallback(
    async (fileId: string): Promise<Blob> => {
      const newFile = newFiles.find((nf) => nf.tempId === fileId);
      if (newFile) return newFile.file;

      const doc = attachedDocuments.find((d) => d.id === fileId);
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
    [newFiles, attachedDocuments, userId],
  );

  const handleLinkDropdownSelect = useCallback(
    (docId: string) => {
      if (!docId) return;
      setStagedLinkDocId(docId);
      setLinkSearchQuery("");
      setLinkDropdownOpen(false);
      setSelectedFileId(null);
    },
    [],
  );

  const resetFileState = useCallback(() => {
    setNewFiles([]);
    setStagedLinkDocId(null);
    setSelectedFileId(null);
    setLinkSearchQuery("");
    setLinkDropdownOpen(false);
  }, []);

  return {
    newFiles,
    setNewFiles,
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
    handleLinkDropdownSelect,
    resetFileState,
  };
}
