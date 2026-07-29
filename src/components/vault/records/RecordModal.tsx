"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import GlobalActionModal from "@/components/common/GlobalActionModal";
import type { ModalFile } from "@/components/common/GlobalActionModal";
import { InputField } from "@/components/common/FormField";
import { useActionForm } from "@/hooks/useActionForm";
import { createVaultEntry, updateVaultEntry, deleteVaultEntry } from "@/api/vault";
import { fetchDocuments, createDocument, updateDocument, deleteDocument } from "@/api/common/documents";
import { uploadDocumentFile, downloadDocumentFile, deleteDocumentFile } from "@/api/common/documentStorage";
import type { Document, DocumentPlaintext } from "@/types/document";
import type { PersonalRecord, PersonalRecordPlaintext } from "@/types/vault";

interface RecordModalProps {
  userId: string;
  record?: PersonalRecord | null;
  onClose: () => void;
  onSaved: (record: PersonalRecord) => void;
}

export default function RecordModal({ userId, record, onClose, onSaved }: RecordModalProps) {
  const isEditing = !!record;

  // --- Form state ---
  const [name, setName] = useState(record?.name ?? "");
  const [value, setValue] = useState(record?.value ?? "");

  const { isSaving, error, setError, withSubmit } = useActionForm();

  // --- Document state ---
  const [documents, setDocuments] = useState<Document[]>([]);
  const [newFiles, setNewFiles] = useState<{ file: File; label: string; tempId: string }[]>([]);
  const [markedForDeletion, setMarkedForDeletion] = useState<Set<string>>(new Set());
  const [markedForUnlink, setMarkedForUnlink] = useState<Set<string>>(new Set());
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // --- Sync form state when record changes ---
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- by-design: sync form state when editing a different record
    setName(record?.name ?? "");
    setValue(record?.value ?? "");
    setNewFiles([]);
    setMarkedForDeletion(new Set());
    setMarkedForUnlink(new Set());
    setSelectedFileId(null);
    setError(null);
  }, [record, setError]);

  // --- Load documents ---
  useEffect(() => {
    if (!userId) return;
    fetchDocuments(userId)
      .then((docs) => {
        const attached = docs.filter(
          (d) => d.domain === "vault" && d.linked_id === record?.id
        );
        setDocuments(attached);
        if (attached.length > 0 && !selectedFileId) {
          setSelectedFileId(attached[0].id);
        }
      })
      .catch(() => {});
  }, [userId, record?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Dirty check ---
  const hasFormChanges = name !== (record?.name ?? "") || value !== (record?.value ?? "");
  const isDirty = hasFormChanges || newFiles.length > 0 || markedForDeletion.size > 0 || markedForUnlink.size > 0;

  // --- Build files for GlobalActionModal ---
  const modalFiles: ModalFile[] = useMemo(() => {
    const result: ModalFile[] = [];

    // Existing documents (not marked for deletion/unlink)
    for (const doc of documents) {
      if (markedForDeletion.has(doc.id) || markedForUnlink.has(doc.id)) continue;
      result.push({
        id: doc.id,
        name: doc.label || doc.file_name || "Unnamed",
        mime: doc.file_mime,
        iv: doc.file_iv,
      });
    }

    // New files
    for (const nf of newFiles) {
      result.push({
        id: nf.tempId,
        name: nf.label,
        mime: nf.file.type,
        file: nf.file,
        isNew: true,
      });
    }

    return result;
  }, [documents, newFiles, markedForDeletion, markedForUnlink]);

  // --- File handlers ---

  const handleFileUpload = useCallback(
    async (file: File) => {
      setIsUploading(true);
      try {
        if (!record) {
          // No record yet — stage locally until save
          const tempId = `new-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          setNewFiles((prev) => [...prev, { file, label: file.name, tempId }]);
          return;
        }
        // Record exists — upload immediately
        const { fileName, iv, mimeType } = await uploadDocumentFile(userId, file);
        const now = new Date().toISOString();
        const doc = await createDocument(userId, {
          label: file.name,
          file_name: fileName,
          file_iv: iv,
          file_mime: mimeType,
          domain: "vault",
          linked_id: record.id,
          updated_at: now,
        });
        setDocuments((prev) => [...prev, doc]);
        setSelectedFileId(doc.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setIsUploading(false);
      }
    },
    [userId, record, setError]
  );

  const handleFileDownload = useCallback(
    async (fileId: string) => {
      // New file (local)
      const nf = newFiles.find((f) => f.tempId === fileId);
      if (nf) {
        const url = URL.createObjectURL(nf.file);
        const a = document.createElement("a");
        a.href = url;
        a.download = nf.label;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      }
      // Existing document
      const doc = documents.find((d) => d.id === fileId);
      if (!doc) return;
      try {
        const blob = await downloadDocumentFile(userId, doc.file_name, doc.file_iv, doc.file_mime);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = doc.label || "document";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Download failed");
      }
    },
    [userId, documents, newFiles, setError]
  );

  const handleFileDelete = useCallback(
    (fileId: string) => {
      // New file — just remove from local staging
      const nf = newFiles.find((f) => f.tempId === fileId);
      if (nf) {
        setNewFiles((prev) => prev.filter((f) => f.tempId !== fileId));
        if (selectedFileId === fileId) setSelectedFileId(null);
        return;
      }
      // Existing doc — mark for deletion
      setMarkedForDeletion((prev) => {
        const next = new Set(prev);
        if (next.has(fileId)) next.delete(fileId);
        else next.add(fileId);
        return next;
      });
      setMarkedForUnlink((prev) => {
        const next = new Set(prev);
        next.delete(fileId);
        return next;
      });
    },
    [newFiles, selectedFileId]
  );

  const handleFileUnlink = useCallback(
    (fileId: string) => {
      setMarkedForUnlink((prev) => {
        const next = new Set(prev);
        if (next.has(fileId)) next.delete(fileId);
        else next.add(fileId);
        return next;
      });
      setMarkedForDeletion((prev) => {
        const next = new Set(prev);
        next.delete(fileId);
        return next;
      });
    },
    []
  );

  const handleFileRename = useCallback(
    (fileId: string, newName: string) => {
      // Check new files
      const nf = newFiles.find((f) => f.tempId === fileId);
      if (nf) {
        setNewFiles((prev) =>
          prev.map((f) => (f.tempId === fileId ? { ...f, label: newName } : f))
        );
        return;
      }
      // Update existing doc label in local state (server update on save)
      setDocuments((prev) =>
        prev.map((d) => (d.id === fileId ? { ...d, label: newName } : d))
      );
    },
    [newFiles]
  );

  const handleLoadPreview = useCallback(
    async (fileId: string): Promise<Blob> => {
      const nf = newFiles.find((f) => f.tempId === fileId);
      if (nf) return nf.file;
      const doc = documents.find((d) => d.id === fileId);
      if (!doc?.file_name) throw new Error("Cannot load preview");
      return downloadDocumentFile(userId, doc.file_name, doc.file_iv, doc.file_mime);
    },
    [userId, documents, newFiles]
  );

  // Track original document labels for rename detection on save
  const documentOriginalLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const doc of documents) {
      map.set(doc.id, doc.label || "");
    }
    return map;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Save ---

  const handleSave = async () => {
    if (!name.trim() || !value.trim()) {
      setError("Name and value are required.");
      return;
    }

    const result = await withSubmit(async () => {
      const now = new Date().toISOString();
      const plaintext: PersonalRecordPlaintext = {
        section: "records",
        name: name.trim(),
        value: value.trim(),
        updated_at: now,
      };

      let savedRecord: PersonalRecord;

      if (isEditing && record) {
        savedRecord = await updateVaultEntry(userId, record.id, plaintext) as PersonalRecord;
      } else {
        savedRecord = await createVaultEntry(userId, plaintext) as PersonalRecord;
      }

      // Handle document deletions
      for (const docId of markedForDeletion) {
        const doc = documents.find((d) => d.id === docId);
        if (doc) {
          if (doc.file_name) {
            try { await deleteDocumentFile(userId, doc.file_name); } catch { /* best-effort */ }
          }
          try { await deleteDocument(docId); } catch { /* best-effort */ }
        }
      }

      // Handle document unlinks
      for (const docId of markedForUnlink) {
        const doc = documents.find((d) => d.id === docId);
        if (doc) {
          try {
            await updateDocument(userId, docId, {
              ...doc,
              linked_id: "",
              updated_at: now,
            } as DocumentPlaintext);
          } catch { /* best-effort */ }
        }
      }

      // Handle new file uploads
      for (const nf of newFiles) {
        try {
          const { fileName, iv, mimeType } = await uploadDocumentFile(userId, nf.file);
          await createDocument(userId, {
            label: nf.label,
            file_name: fileName,
            file_iv: iv,
            file_mime: mimeType,
            domain: "vault",
            linked_id: savedRecord.id,
            updated_at: now,
          });
        } catch { /* best-effort */ }
      }

      // Rename any documents with changed labels
      for (const doc of documents) {
        const original = documentOriginalLabels.get(doc.id);
        if (original && original !== doc.label) {
          try {
            await updateDocument(userId, doc.id, {
              ...doc,
              label: doc.label,
              updated_at: now,
            } as DocumentPlaintext);
          } catch { /* best-effort */ }
        }
      }

      onSaved(savedRecord);
      onClose();
    });
    void result;
  };

  // --- Delete ---

  const handleDelete = async () => {
    if (!record) return;
    await withSubmit(async () => {
      // Delete associated documents first
      for (const doc of documents) {
        if (doc.file_name) {
          try { await deleteDocumentFile(userId, doc.file_name); } catch { /* best-effort */ }
        }
        try { await deleteDocument(doc.id); } catch { /* best-effort */ }
      }
      await deleteVaultEntry(record.id);
      onClose();
    });
  };

  return (
    <GlobalActionModal
      title={isEditing ? "Edit Record" : "Add Record"}
      onClose={onClose}
      isDirty={isDirty}
      files={modalFiles}
      selectedFileId={selectedFileId}
      onSelectFile={setSelectedFileId}
      onFileUpload={handleFileUpload}
      onFileDownload={modalFiles.length > 0 ? handleFileDownload : undefined}
      onFileDelete={modalFiles.length > 0 ? handleFileDelete : undefined}
      onFileUnlink={modalFiles.length > 0 ? handleFileUnlink : undefined}
      onFileRename={modalFiles.length > 0 ? handleFileRename : undefined}
      onLoadPreview={handleLoadPreview}
      isUploading={isUploading}
      onSave={handleSave}
      isSaving={isSaving}
      onDelete={isEditing ? handleDelete : undefined}
      deleteLabel="Delete Record"
    >
      <div className="space-y-4">
        {error && (
          <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
        )}
        <InputField
          label="Name"
          value={name}
          onChange={setName}
          placeholder="e.g. Aadhaar Number"
          disabled={isSaving}
        />
        <InputField
          label="Value"
          value={value}
          onChange={setValue}
          placeholder="The reference number or ID"
          disabled={isSaving}
        />
      </div>
    </GlobalActionModal>
  );
}
