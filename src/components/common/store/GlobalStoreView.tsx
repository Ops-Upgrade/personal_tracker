"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Trash2, Link } from "lucide-react";
import BackButton from "@/components/common/BackButton";
import ErrorBanner from "@/components/common/ErrorBanner";
import { getSession } from "@/api/auth";
import {
  fetchDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
} from "@/api/common/documents";
import {
  uploadDocumentFile,
  downloadDocumentFile,
  deleteDocumentFile,
} from "@/api/common/documentStorage";
import type { Document, DocumentPlaintext } from "@/types/document";
import TileView, { DocumentTile } from "@/components/common/TileView";
import BoxContainer from "@/components/common/BoxContainer";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import StoreDocumentModal from "./StoreDocumentModal";
import type { StoreDocumentSaveParams, StoreParentRecord } from "./StoreDocumentModal";
import BulkLinkModal from "./BulkLinkModal";
import { getUniqueFileName } from "./helpers";

// --- Props ---

interface GlobalStoreViewProps {
  /** Domain discriminator for documents */
  domain: DocumentPlaintext["domain"];
  /** Page title */
  title: string;
  /** Subtitle / description */
  description?: string;
  /** Back button href */
  backHref: string;
  /** Back button label */
  backLabel?: string;
  /** Parent records available for linking (id + name) */
  parentRecords: StoreParentRecord[];
  /** Called when a parent record should be cascade-deleted */
  onDeleteParentRecord?: (parentId: string) => Promise<void>;
  /** Called when a document is unlinked from its parent */
  onUnlinkFromParent?: (documentId: string, parentId: string) => Promise<void>;
  /** Called when documents are bulk-linked to a parent */
  onBulkLinkToParent?: (documentIds: string[], parentId: string) => Promise<void>;
  /** Override for clicking a document tile. Return `false` to fall back to opening StoreDocumentModal. */
  onActionClick?: (documentId: string) => boolean | void;
  /** Optional: render a "create new record" form in StoreDocumentModal (for standalone uploads). */
  renderNewRecordForm?: (opts: { disabled: boolean; isSaving: boolean }) => React.ReactNode;
  /** Optional: extract form data for onSave when creating a new parent record inline. */
  extractNewRecordData?: () => Record<string, string> | null;
  /** Optional: called when a new parent record is created inline. Receives the new record data and returns the new parent ID. */
  onCreateParentFromStore?: (data: Record<string, string>) => Promise<string>;
  /** When true, parent record names are hidden from the document tile display.
   *  Linking logic (modals, bulk operations) is unaffected. */
  hideParentRecordsList?: boolean;
}

export default function GlobalStoreView({
  domain,
  title,
  description,
  backHref,
  backLabel = "← Back",
  parentRecords,
  onDeleteParentRecord,
  onUnlinkFromParent,
  onBulkLinkToParent,
  onActionClick: onActionClickOverride,
  renderNewRecordForm,
  extractNewRecordData,
  onCreateParentFromStore,
  hideParentRecordsList = false,
}: GlobalStoreViewProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Hash-driven modal state
  const [modals, setModals] = useState<{
    add: boolean;
    edit: Document | null;
  }>(() => {
    if (typeof window === "undefined") return { add: false, edit: null };
    const raw = window.location.hash.replace("#", "");
    if (raw === "new-document") return { add: true, edit: null };
    if (raw.startsWith("edit-document-")) return { add: false, edit: null };
    return { add: false, edit: null };
  });

  const editingDocument = modals.edit;
  const isAddingDocument = modals.add;

  // --- Bulk selection state ---
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkRename, setShowBulkRename] = useState(false);
  const [bulkRenameBase, setBulkRenameBase] = useState("");
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [showBulkLink, setShowBulkLink] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const domainDocuments = useMemo(
    () => documents.filter((d) => d.domain === domain),
    [documents, domain],
  );

  const bulkSelectedDocs = useMemo(
    () => domainDocuments.filter((d) => selectedIds.has(d.id)),
    [domainDocuments, selectedIds],
  );
  const allBulkUnlinked = useMemo(
    () => bulkSelectedDocs.length > 0 && bulkSelectedDocs.every((d) => !d.linked_id),
    [bulkSelectedDocs],
  );
  const anyBulkLinked = useMemo(
    () => bulkSelectedDocs.some((d) => !!d.linked_id),
    [bulkSelectedDocs],
  );

  // --- Hash parsing ---
  const resolveHash = useCallback(
    (raw: string) => {
      if (raw === "new-document") return { add: true, edit: null as Document | null };
      if (raw.startsWith("edit-document-")) {
        const docId = raw.slice(14);
        const found = documents.find((d) => d.id === docId);
        if (found) return { add: false, edit: found };
      }
      return { add: false, edit: null as Document | null };
    },
    [documents],
  );

  useEffect(() => {
    const handler = () => {
      const raw = window.location.hash.replace("#", "");
      const res = resolveHash(raw);
      setModals((prev) => ({ ...prev, add: res.add, edit: res.edit }));
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, [resolveHash]);

  const clearHash = useCallback(() => {
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  // --- Data loading ---
  const loadData = useCallback(async () => {
    if (!userId) return;
    try {
      const docs = await fetchDocuments(userId);
      setDocuments(docs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    }
  }, [userId]);

  useEffect(() => {
    const init = async () => {
      try {
        const session = await getSession();
        if (!session) {
          window.location.href = "/auth/login";
          return;
        }
        setUserId(session.user.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to authenticate");
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (userId) {
      loadData();
    }
  }, [userId, loadData]);

  // --- Download handler ---
  const handleDownload = async (docId: string) => {
    if (!userId) return;
    const d = documents.find((x) => x.id === docId);
    if (!d) return;
    try {
      const blob = await downloadDocumentFile(userId, d.file_name, d.file_iv, d.file_mime);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = d.label || "document";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to download: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  // --- Action click (TileView) ---
  const handleActionClick = (docId: string) => {
    if (onActionClickOverride) {
      const handled = onActionClickOverride(docId);
      // If the override explicitly returns false, fall through to default behavior
      if (handled !== false) return;
    }
    const d = documents.find((x) => x.id === docId);
    if (!d) return;
    setModals((prev) => ({ ...prev, edit: d }));
  };

  // --- Store Document Modal handlers ---

  const handleStoreSave = async (params: StoreDocumentSaveParams) => {
    if (!userId) throw new Error("No active session.");
    const nowIso = new Date().toISOString();
    let resolvedLinkedId = params.linkedParentId || "";

    // If creating a new parent record inline, do that first
    if (!resolvedLinkedId && params.newParentRecord && onCreateParentFromStore) {
      resolvedLinkedId = await onCreateParentFromStore(params.newParentRecord);
    }

    if (params.existingDocument) {
      const existing = params.existingDocument;
      if (params.file) {
        // Delete old file
        if (existing.file_name) {
          try { await deleteDocumentFile(userId, existing.file_name); } catch { /* best-effort */ }
        }
        const { fileName, iv, mimeType } = await uploadDocumentFile(userId, params.file);
        await updateDocument(userId, existing.id, {
          ...existing,
          label: params.label,
          file_name: fileName,
          file_iv: iv,
          file_mime: mimeType,
          linked_id: resolvedLinkedId,
          updated_at: nowIso,
        } as DocumentPlaintext);
      } else {
        await updateDocument(userId, existing.id, {
          ...existing,
          label: params.label,
          linked_id: resolvedLinkedId,
          updated_at: nowIso,
        } as DocumentPlaintext);
      }
    } else {
      if (!params.file) throw new Error("File is required for new documents.");
      const { fileName, iv, mimeType } = await uploadDocumentFile(userId, params.file);
      await createDocument(userId, {
        label: params.label,
        file_name: fileName,
        file_iv: iv,
        file_mime: mimeType,
        domain,
        linked_id: resolvedLinkedId,
        updated_at: nowIso,
      });
    }

    await loadData();
    setModals((prev) => ({ ...prev, add: false, edit: null }));
    clearHash();
  };

  const handleStoreDelete = async (d: Document, cascadeMode: "unlink" | "cascade") => {
    if (!userId) return;
    try {
      if (cascadeMode === "cascade" && d.linked_id && onDeleteParentRecord) {
        await onDeleteParentRecord(d.linked_id);
      } else if (cascadeMode === "unlink" && d.linked_id && onUnlinkFromParent) {
        await onUnlinkFromParent(d.id, d.linked_id);
      }
      if (d.file_name) {
        try { await deleteDocumentFile(userId, d.file_name); } catch { /* best-effort */ }
      }
      await deleteDocument(d.id);
      await loadData();
    } catch (err) {
      alert("Failed to delete document: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  // --- Inline rename handler ---
  const handleRenameConfirmed = async (docId: string, newName: string) => {
    if (!userId) return;
    try {
      const d = documents.find((x) => x.id === docId);
      if (!d) return;
      await updateDocument(userId, docId, {
        ...d,
        label: newName,
        updated_at: new Date().toISOString(),
      } as DocumentPlaintext);
      await loadData();
    } catch (err) {
      alert("Failed to rename: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  // --- Bulk action handlers ---

  const executeBulkRename = async (baseName: string) => {
    if (!userId || !baseName.trim()) return;
    setBulkProcessing(true);
    try {
      const takenNames = new Set(domainDocuments.map((d) => d.label || ""));
      for (const d of bulkSelectedDocs) {
        if (d.label) takenNames.delete(d.label);
      }
      const updates = bulkSelectedDocs.map((d) => {
        const newName = getUniqueFileName(baseName.trim(), takenNames);
        takenNames.add(newName);
        return updateDocument(userId, d.id, { ...d, label: newName, updated_at: new Date().toISOString() } as DocumentPlaintext);
      });
      await Promise.all(updates);
      await loadData();
      setSelectedIds(new Set());
    } catch (err) {
      alert("Failed to bulk rename: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setBulkProcessing(false);
      setShowBulkRename(false);
      setBulkRenameBase("");
    }
  };

  const executeBulkDelete = async (cascade: boolean) => {
    if (!userId) return;
    setBulkProcessing(true);
    try {
      for (const d of bulkSelectedDocs) {
        if (cascade && d.linked_id && onDeleteParentRecord) {
          try { await onDeleteParentRecord(d.linked_id); } catch { /* best-effort */ }
        } else if (!cascade && d.linked_id && onUnlinkFromParent) {
          await onUnlinkFromParent(d.id, d.linked_id);
        }
        if (d.file_name) {
          try { await deleteDocumentFile(userId, d.file_name); } catch { /* best-effort */ }
        }
        await deleteDocument(d.id);
      }
      await loadData();
      setSelectedIds(new Set());
    } catch (err) {
      alert("Failed to bulk delete: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setBulkProcessing(false);
      setShowBulkDelete(false);
    }
  };

  const handleBulkLinkSave = async (parentId: string) => {
    if (!userId || !parentId) return;
    if (onBulkLinkToParent) {
      setBulkProcessing(true);
      try {
        await onBulkLinkToParent(
          bulkSelectedDocs.map((d) => d.id),
          parentId,
        );
        await loadData();
        setSelectedIds(new Set());
        setShowBulkLink(false);
      } catch (err) {
        alert("Failed to bulk link: " + (err instanceof Error ? err.message : "Unknown error"));
      } finally {
        setBulkProcessing(false);
      }
      return;
    }

    // Fallback: update each document's linked_id directly
    setBulkProcessing(true);
    try {
      const nowIso = new Date().toISOString();
      const updates = bulkSelectedDocs.map((d) =>
        updateDocument(userId, d.id, { ...d, linked_id: parentId, updated_at: nowIso } as DocumentPlaintext),
      );
      await Promise.all(updates);
      await loadData();
      setSelectedIds(new Set());
      setShowBulkLink(false);
    } catch (err) {
      alert("Failed to bulk link: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setBulkProcessing(false);
    }
  };

  // --- Build document tiles ---
  const documentTiles: DocumentTile[] = domainDocuments.map((d) => {
    const parent = hideParentRecordsList
      ? undefined
      : parentRecords.find((r) => r.id === d.linked_id);
    return {
      id: d.id,
      fileName: d.label || "Unnamed Document",
      fileUrl: "",
      linkedItemName: parent ? parent.name : null,
      thumbnailUrl: null,
      mime: d.file_mime || undefined,
    };
  });

  // --- Close handlers ---
  const closeStoreAddModal = () => {
    setModals((prev) => ({ ...prev, add: false }));
    clearHash();
  };
  const closeStoreEditModal = () => {
    setModals((prev) => ({ ...prev, edit: null }));
    clearHash();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start gap-4">
        <BackButton href={backHref}>{backLabel}</BackButton>
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{title}</h1>
          {description && (
            <p className="mt-1 text-sm font-normal text-zinc-500 dark:text-zinc-400">
              {description}
            </p>
          )}
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={userId ? () => { if (userId) loadData(); } : undefined} />}

      <BoxContainer>
        <TileView
          documents={documentTiles}
          isLoading={isLoading}
          onDownload={handleDownload}
          onDeleteConfirmed={async (id, mode) => {
            const d = documents.find((x) => x.id === id);
            if (d) await handleStoreDelete(d, mode);
          }}
          onUnlinkConfirmed={async (id) => {
            const d = documents.find((x) => x.id === id);
            if (d && d.linked_id && onUnlinkFromParent) {
              await onUnlinkFromParent(id, d.linked_id);
              await loadData();
            }
          }}
          onActionClick={handleActionClick}
          onAdd={() => setModals((prev) => ({ ...prev, add: true }))}
          title=""
          onRenameConfirmed={handleRenameConfirmed}
          selectionEnabled
          selectedIds={selectedIds}
          onSelectionChange={(id, checked) => {
            setSelectedIds((prev) => {
              const next = new Set(prev);
              if (checked) next.add(id);
              else next.delete(id);
              return next;
            });
          }}
          onSelectAll={(checked) => {
            if (checked) setSelectedIds(new Set(domainDocuments.map((d) => d.id)));
            else setSelectedIds(new Set());
          }}
          bulkActions={
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                {selectedIds.size} selected
              </span>
              <button
                onClick={() => { setBulkRenameBase(""); setShowBulkRename(true); }}
                className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-colors"
              >
                <Pencil className="h-4 w-4" /> Rename
              </button>
              <button
                onClick={() => setShowBulkDelete(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50 transition-colors"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </button>
              <button
                onClick={() => setShowBulkLink(true)}
                disabled={!allBulkUnlinked}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-950/50 transition-colors"
              >
                <Link className="h-4 w-4" /> Link
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="ml-1 text-sm text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          }
        />
      </BoxContainer>

      {/* Bulk Rename Modal */}
      {showBulkRename && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Bulk Rename</h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              Enter a base name for {selectedIds.size} selected document{selectedIds.size !== 1 ? "s" : ""}. Numeric suffixes will be added automatically.
            </p>
            <input
              type="text"
              value={bulkRenameBase}
              onChange={(e) => setBulkRenameBase(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && bulkRenameBase.trim()) executeBulkRename(bulkRenameBase); }}
              placeholder="e.g., AWS Certification"
              autoFocus
              disabled={bulkProcessing}
              className="mt-3 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 disabled:opacity-50"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => { setShowBulkRename(false); setBulkRenameBase(""); }}
                disabled={bulkProcessing}
                className="inline-flex items-center rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => executeBulkRename(bulkRenameBase)}
                disabled={!bulkRenameBase.trim() || bulkProcessing}
                className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bulkProcessing ? "Renaming..." : "Rename All"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation */}
      {showBulkDelete && (
        anyBulkLinked ? (
          <ConfirmDialog
            title="Bulk Delete"
            description={`You are about to delete ${selectedIds.size} document${selectedIds.size !== 1 ? "s" : ""}. Some are linked to records.`}
            confirmLabel={bulkProcessing ? "Deleting..." : "Delete"}
            cancelLabel="Cancel"
            showDeleteFilesCheckbox
            deleteFilesLabel="Delete associated record(s)"
            onCancel={() => setShowBulkDelete(false)}
            onConfirm={(deleteRecord) => executeBulkDelete(!!deleteRecord)}
          />
        ) : (
          <ConfirmDialog
            title="Bulk Delete"
            description={`You are about to permanently delete ${selectedIds.size} document${selectedIds.size !== 1 ? "s" : ""}. This action cannot be undone.`}
            confirmLabel={bulkProcessing ? "Deleting..." : "Delete"}
            cancelLabel="Cancel"
            onCancel={() => setShowBulkDelete(false)}
            onConfirm={() => executeBulkDelete(false)}
          />
        )
      )}

      {/* Bulk Link Modal */}
      {showBulkLink && userId && (
        <BulkLinkModal
          parentRecords={parentRecords}
          selectedCount={selectedIds.size}
          isProcessing={bulkProcessing}
          onClose={() => setShowBulkLink(false)}
          onSave={handleBulkLinkSave}
        />
      )}

      {/* Store Document Modal — Add mode */}
      {isAddingDocument && userId && (
        <StoreDocumentModal
          document={null}
          domain={domain}
          parentRecords={parentRecords}
          existingLabels={domainDocuments.map((d) => d.label).filter((l): l is string => !!l)}
          userId={userId}
          onClose={closeStoreAddModal}
          onSave={handleStoreSave}
          onDelete={handleStoreDelete}
          renderNewRecordForm={renderNewRecordForm}
          extractNewRecordData={extractNewRecordData}
        />
      )}

      {/* Store Document Modal — Edit mode */}
      {editingDocument && userId && (
        <StoreDocumentModal
          document={editingDocument}
          domain={domain}
          parentRecords={parentRecords}
          existingLabels={domainDocuments.map((d) => d.label).filter((l): l is string => !!l)}
          userId={userId}
          onClose={closeStoreEditModal}
          onSave={handleStoreSave}
          onDelete={handleStoreDelete}
          renderNewRecordForm={renderNewRecordForm}
          extractNewRecordData={extractNewRecordData}
        />
      )}
    </div>
  );
}
