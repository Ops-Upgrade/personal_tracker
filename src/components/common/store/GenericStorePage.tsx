"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  Eye,
  EyeOff,
  Copy,
  Check,
  File,
  FileText,
  Image as ImageIcon,
  Link,
  Pencil,
  Trash2,
} from "lucide-react";
import { LinkSlashIcon, PaperClipIcon } from "@/components/common/Icons";
import BackButton from "@/components/common/BackButton";
import BoxContainer from "@/components/common/BoxContainer";
import BulkActionBar from "@/components/common/BulkActionBar";
import Button from "@/components/common/Button";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import DataListView from "@/components/common/DataListView";
import ErrorBanner from "@/components/common/ErrorBanner";
import OverlayActionButton from "@/components/common/OverlayActionButton";
import GenericDomainModal, {
  type FieldDef,
  type StoreParentRecord,
} from "@/components/common/GenericDomainModal";
import { storeToModalDomain } from "../modalDomainConfig";
import BulkLinkModal from "./BulkLinkModal";
import {
  getStoreAdapter,
  type DocStoreAdapter,
  type RecordStoreAdapter,
  type StoreDomainKey,
} from "./storeAdapters";
import { getUniqueFileName } from "@/lib/viewHelpers";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { getSession } from "@/api/auth";
import {
  updateDocument,
  deleteDocument,
} from "@/api/common/documents";
import {
  downloadDocumentFile,
  deleteDocumentFile,
} from "@/api/common/documentStorage";
import { useSelection } from "@/hooks/useSelection";
import type { Document, DocumentPlaintext } from "@/types/document";
import type { VaultRecordItem } from "@/types/vault";

// ============================================================
// Types
// ============================================================

/** Declarative header action (replaces raw JSX + external ConfirmDialog). */
export interface HeaderAction {
  label: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  requireConfirm?: boolean;
  confirmTitle?: string;
  confirmDescription?: string;
  confirmLabel?: string;
  onAction: () => void | Promise<void>;
}

/** Unified, declarative store-page contract. All domain behavior lives in the adapter registry. */
export interface GenericStorePageProps {
  /** Declarative plan conformance; the adapter registry is authoritative. */
  storeType?: "doc" | "record";
  /** Adapter registry key — drives all fetching, mapping and CRUD. */
  domain: StoreDomainKey;
  /** Field schema for the record modal + the standalone parent-creation form. */
  modalFields: FieldDef[];
  title: string;
  description?: string;
  backHref: string;
  backLabel?: string;
  /** Extra data for scope-scoped adapters (e.g. vault_bank_details → { bankId }). */
  scope?: Record<string, string>;
  /** Show the Add button (default false — Expense and Medical intentionally omit). */
  allowAdd?: boolean;
  /** Tile layout mode. */
  tileLayout?: "standard" | "body-only";
  /** Cosmetic overrides (adapter defaults otherwise). */
  searchPlaceholder?: string;
  emptyMessage?: string;
  /** Declarative header actions. */
  headerActions?: HeaderAction[];
  /** When true, hides selection checkboxes and disables bulk selection (record stores). */
  disableSelection?: boolean;
}

// ============================================================
// Constants
// ============================================================

const DOMAIN_THEMES = {
  taskmanager: {
    primaryBtn: "bg-sky-600 hover:bg-sky-500 focus-visible:outline-sky-600",
    lightBg:
      "bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950/30 dark:text-sky-400 dark:hover:bg-sky-950/50",
    inputFocus: "focus:border-sky-500 focus:ring-sky-500",
    hoverBorder: "hover:border-sky-500 dark:hover:border-sky-500/50",
    icon: "text-sky-500",
    iconLarge: "text-sky-500/50",
    iconHover: "hover:text-sky-600 dark:hover:text-sky-400",
  },
  education: {
    primaryBtn: "bg-amber-600 hover:bg-amber-500 focus-visible:outline-amber-600",
    lightBg:
      "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:hover:bg-amber-950/50",
    inputFocus: "focus:border-amber-500 focus:ring-amber-500",
    hoverBorder: "hover:border-amber-500 dark:hover:border-amber-500/50",
    icon: "text-amber-500",
    iconLarge: "text-amber-500/50",
    iconHover: "hover:text-amber-600 dark:hover:text-amber-400",
  },
  medical: {
    primaryBtn: "bg-rose-600 hover:bg-rose-500 focus-visible:outline-rose-600",
    lightBg:
      "bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-950/50",
    inputFocus: "focus:border-rose-500 focus:ring-rose-500",
    hoverBorder: "hover:border-rose-500 dark:hover:border-rose-500/50",
    icon: "text-rose-500",
    iconLarge: "text-rose-500/50",
    iconHover: "hover:text-rose-600 dark:hover:text-rose-400",
  },
  expense: {
    primaryBtn: "bg-emerald-600 hover:bg-emerald-500 focus-visible:outline-emerald-600",
    lightBg:
      "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-950/50",
    inputFocus: "focus:border-emerald-500 focus:ring-emerald-500",
    hoverBorder: "hover:border-emerald-500 dark:hover:border-emerald-500/50",
    icon: "text-emerald-500",
    iconLarge: "text-emerald-500/50",
    iconHover: "hover:text-emerald-600 dark:hover:text-emerald-400",
  },
  vault: {
    primaryBtn:
      "bg-zinc-900 text-white hover:bg-black focus-visible:outline-zinc-900 dark:bg-zinc-100 dark:text-black dark:hover:bg-white dark:focus-visible:outline-zinc-100",
    lightBg:
      "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800",
    inputFocus: "focus:border-zinc-900 focus:ring-zinc-900 dark:focus:border-zinc-100 dark:focus:ring-zinc-100",
    hoverBorder: "hover:border-zinc-300 dark:hover:border-zinc-700",
    icon: "text-zinc-900 dark:text-zinc-100",
    iconLarge: "text-zinc-900/50 dark:text-zinc-100/50",
    iconHover: "hover:text-black dark:hover:text-white",
  },
} as const;

type DomainTheme = keyof typeof DOMAIN_THEMES;

// ============================================================
// Shared types
// ============================================================

interface DocumentTile {
  id: string;
  fileName: string;
  fileUrl?: string;
  thumbnailUrl?: string | null;
  linkedItemName?: string | null;
  isLinked?: boolean;
  mime?: string;
}

// ============================================================
// GenericStorePage — router
// ============================================================

export default function GenericStorePage(props: GenericStorePageProps) {
  const adapter = useMemo(
    () => getStoreAdapter(props.domain, props.scope),
    [props.domain, props.scope],
  );
  if (adapter.storeType === "doc") {
    // The adapter union's row types differ per domain; the stores only use
    // the row `id` directly and pass rows back through the adapter, so the
    // boundary cast to the shared shape is safe.
    return <GenericDocStore {...props} adapter={adapter as unknown as DocStoreAdapter<{ id: string }>} />;
  }
  return <GenericRecordStore {...props} adapter={adapter as unknown as RecordStoreAdapter<{ id: string }>} />;
}

// ============================================================
// HeaderActionsArea — renders declarative header actions + confirm
// ============================================================

function HeaderActionsArea({
  actions,
  pendingAction,
  onAction,
  onRequireConfirm,
  onConfirm,
  onCancelConfirm,
}: {
  actions: HeaderAction[];
  pendingAction: HeaderAction | null;
  onAction: (action: HeaderAction) => void;
  onRequireConfirm: (action: HeaderAction) => void;
  onConfirm: () => void;
  onCancelConfirm: () => void;
}) {
  if (actions.length === 0) return null;
  return (
    <>
      <div className="flex shrink-0 items-center gap-2">
        {actions.map((action, i) => (
          <Button
            key={action.label + i}
            variant={action.variant ?? "secondary"}
            size="sm"
            onClick={() => (action.requireConfirm ? onRequireConfirm(action) : onAction(action))}
          >
            {action.label}
          </Button>
        ))}
      </div>
      {pendingAction && (
        <ConfirmDialog
          title={pendingAction.confirmTitle ?? "Confirm action?"}
          description={pendingAction.confirmDescription ?? "Are you sure you want to proceed?"}
          confirmLabel={pendingAction.confirmLabel ?? "Confirm"}
          cancelLabel="Cancel"
          onConfirm={onConfirm}
          onCancel={onCancelConfirm}
        />
      )}
    </>
  );
}

// ============================================================
// InlineSecretValue — for record store tile/list values
// ============================================================

function InlineSecretValue({ value, isSecret, isCopyable = true }: { value: string; isSecret: boolean; isCopyable?: boolean }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch { /* noop */ }
    },
    [value],
  );

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setRevealed((r) => !r);
  }, []);

  return (
    <div
      className="group/val flex flex-1 min-w-0 items-center gap-1 rounded px-1 py-2 -mx-1 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors cursor-text"
      onClick={(e) => e.stopPropagation()}
    >
      <span
        className="text-base text-zinc-700 dark:text-zinc-300 font-mono truncate flex-1 min-w-0"
        title={isSecret && !revealed ? undefined : value}
      >
        {isSecret && !revealed ? "••••••••" : value}
      </span>
      <div className="flex shrink-0 items-center gap-1 opacity-100 md:opacity-0 md:group-hover/val:opacity-100 focus-within:opacity-100 transition-opacity">
        {isSecret && (
          <button
            type="button"
            onClick={handleToggle}
            className="cursor-pointer flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300 transition-colors"
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
        {isCopyable !== false && (
          <button
            type="button"
            onClick={handleCopy}
            className="cursor-pointer flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300 transition-colors"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// GenericDocStore — document store (absorbed GlobalStoreView)
// ============================================================

type GenericDocStoreProps<T extends { id: string }> = GenericStorePageProps & {
  adapter: DocStoreAdapter<T>;
};

function GenericDocStore<T extends { id: string }>({
  adapter,
  domain: domainKey,
  modalFields,
  title,
  description,
  backHref,
  backLabel = "← Back",
  allowAdd = false,
  searchPlaceholder,
  emptyMessage,
  headerActions,
}: GenericDocStoreProps<T>) {
  const theme = DOMAIN_THEMES[adapter.domain as DomainTheme] ?? DOMAIN_THEMES.expense;

  // --- Core state ---
  const [userId, setUserId] = useState<string | null>(null);
  const [allRows, setAllRows] = useState<T[]>([]);
  const [allDocuments, setAllDocuments] = useState<Document[]>([]);
  const [parentRecords, setParentRecords] = useState<StoreParentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Domain modal state
  const [linkedRecord, setLinkedRecord] = useState<T | null>(null);

  // Store doc modal state (hash-driven)
  const [modals, setModals] = useState<{ add: boolean; edit: Document | null }>(() => {
    if (typeof window === "undefined") return { add: false, edit: null };
    const raw = window.location.hash.replace("#", "");
    if (raw === "new-document") return { add: true, edit: null };
    if (raw.startsWith("edit-document-")) return { add: false, edit: null };
    return { add: false, edit: null };
  });

  const editingDocument = useMemo(() => {
    if (!modals.edit) return null;
    return allDocuments.find((d) => d.id === modals.edit!.id) || modals.edit;
  }, [modals.edit, allDocuments]);

  const isAddingDocument = modals.add;

  // Modal domain key (store registry keys differ from modal registry keys —
  // see storeToModalDomain in modalDomainConfig.ts).
  const modalDomain = storeToModalDomain(domainKey);

  // Bulk selection
  const { selectedIds, toggleSelection, selectAll, clearSelection } = useSelection();

  // Bulk action state
  const [showBulkRename, setShowBulkRename] = useState(false);
  const [bulkRenameBase, setBulkRenameBase] = useState("");
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [showBulkLink, setShowBulkLink] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  // Tile-level delete/unlink confirmation
  const [docToUnlink, setDocToUnlink] = useState<DocumentTile | null>(null);
  const [docToDelete, setDocToDelete] = useState<DocumentTile | null>(null);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  // Inline rename
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");
  // Header actions
  const [pendingHeaderAction, setPendingHeaderAction] = useState<HeaderAction | null>(null);

  // --- Adapter capability gates (handler opt-in → action visibility) ---
  const canUnlink = !!adapter.unlinkFromParent;
  const canBulkLink = !!adapter.bulkLinkToParent;
  const canCascadeDelete = !!adapter.deleteParent;

  // --- Derived ---
  const domainDocuments = useMemo(
    () => allDocuments.filter((d) => d.domain === adapter.domain),
    [allDocuments, adapter.domain],
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

  // --- Auth init ---
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

  // --- Data loading ---
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const { rows, documents } = await adapter.fetchData(userId);
        if (!cancelled) {
          setAllRows(rows);
          setAllDocuments(documents);
          setParentRecords(adapter.deriveParentRecords(rows));
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load data");
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [userId, adapter]);

  // --- Refresh cycle ---
  const refreshAll = useCallback(async () => {
    if (!userId) return;
    const { rows, documents } = await adapter.fetchData(userId);
    setAllRows(rows);
    setAllDocuments(documents);
    setParentRecords(adapter.deriveParentRecords(rows));
  }, [userId, adapter]);

  // --- Hash management ---
  const resolveHash = useCallback(
    (raw: string) => {
      if (raw === "new-document") return { add: true, edit: null as Document | null };
      if (raw.startsWith("edit-document-")) {
        const docId = raw.slice(14);
        const found = allDocuments.find((d) => d.id === docId);
        if (found) return { add: false, edit: found };
      }
      return { add: false, edit: null as Document | null };
    },
    [allDocuments],
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

  // --- Tile interaction handlers ---
  const handleDownload = async (docId: string) => {
    if (!userId) return;
    const d = allDocuments.find((x) => x.id === docId);
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

  const handleActionClick = useCallback(
    (docId: string) => {
      const doc = allDocuments.find((d) => d.id === docId);
      if (!doc?.linked_id) return false;
      const record = allRows.find((r) => r.id === doc.linked_id);
      if (record) {
        setLinkedRecord(record);
        return true;
      }
      return false;
    },
    [allDocuments, allRows],
  );

  // --- Tile-level delete (page-owned; the modal owns its own delete via
  // modalDomainConfig, and the bulk flow lives in executeBulkDelete) ---
  const handleTileDelete = async (d: Document, cascadeMode: "unlink" | "cascade") => {
    if (!userId) return;
    try {
      if (cascadeMode === "cascade" && d.linked_id && adapter.deleteParent) {
        await adapter.deleteParent(userId, d.linked_id);
      } else if (cascadeMode === "unlink" && d.linked_id && adapter.unlinkFromParent) {
        await adapter.unlinkFromParent(userId, d.id, d.linked_id);
      }
      if (d.file_name) {
        try { await deleteDocumentFile(userId, d.file_name); } catch { /* best-effort */ }
      }
      await deleteDocument(d.id);
      await refreshAll();
    } catch (err) {
      alert("Failed to delete document: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  // --- Inline rename ---
  const startRename = (doc: DocumentTile) => { setRenamingId(doc.id); setRenameText(doc.fileName); };
  const commitRename = () => {
    if (renamingId && renameText.trim()) {
      handleRenameConfirmed(renamingId, renameText.trim());
    }
    setRenamingId(null);
    setRenameText("");
  };
  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") commitRename();
    else if (e.key === "Escape") { setRenamingId(null); setRenameText(""); }
  };

  const handleRenameConfirmed = async (docId: string, newName: string) => {
    if (!userId) return;
    try {
      const d = allDocuments.find((x) => x.id === docId);
      if (!d) return;
      await updateDocument(userId, docId, { ...d, label: newName, updated_at: new Date().toISOString() } as DocumentPlaintext);
      await refreshAll();
    } catch (err) {
      alert("Failed to rename: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  // --- Tile-level delete ---
  const confirmDeleteWithMode = (cascadeMode: "unlink" | "cascade") => {
    if (!docToDelete) return;
    setRemovingIds((prev) => { const n = new Set(prev); n.add(docToDelete.id); return n; });
    const idToRemove = docToDelete.id;
    setDocToDelete(null);
    setTimeout(() => {
      handleTileDelete(allDocuments.find((x) => x.id === idToRemove)!, cascadeMode);
      setTimeout(() => { setRemovingIds((prev) => { const n = new Set(prev); n.delete(idToRemove); return n; }); }, 500);
    }, 300);
  };

  // --- Bulk actions ---
  const executeBulkRename = async (baseName: string) => {
    if (!userId || !baseName.trim()) return;
    setBulkProcessing(true);
    try {
      const takenNames = new Set(domainDocuments.map((d) => d.label || ""));
      for (const d of bulkSelectedDocs) { if (d.label) takenNames.delete(d.label); }
      const updates = bulkSelectedDocs.map((d) => {
        const newName = getUniqueFileName(baseName.trim(), takenNames);
        takenNames.add(newName);
        return updateDocument(userId, d.id, { ...d, label: newName, updated_at: new Date().toISOString() } as DocumentPlaintext);
      });
      await Promise.all(updates);
      await refreshAll();
      clearSelection();
    } catch (err) {
      alert("Failed to bulk rename: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setBulkProcessing(false); setShowBulkRename(false); setBulkRenameBase("");
    }
  };

  const executeBulkDelete = async (cascade: boolean) => {
    if (!userId) return;
    setBulkProcessing(true);
    try {
      for (const d of bulkSelectedDocs) {
        if (cascade && d.linked_id && adapter.deleteParent) {
          try { await adapter.deleteParent(userId, d.linked_id); } catch { /* best-effort */ }
        } else if (!cascade && d.linked_id && adapter.unlinkFromParent) {
          await adapter.unlinkFromParent(userId, d.id, d.linked_id);
        }
        if (d.file_name) { try { await deleteDocumentFile(userId, d.file_name); } catch { /* best-effort */ } }
        await deleteDocument(d.id);
      }
      await refreshAll();
      clearSelection();
    } catch (err) {
      alert("Failed to bulk delete: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setBulkProcessing(false); setShowBulkDelete(false);
    }
  };

  const handleBulkLinkSave = async (parentId: string) => {
    if (!userId || !parentId) return;
    setBulkProcessing(true);
    try {
      if (adapter.bulkLinkToParent) {
        await adapter.bulkLinkToParent(userId, bulkSelectedDocs.map((d) => d.id), parentId);
        await refreshAll();
        clearSelection();
        setShowBulkLink(false);
      }
    } catch (err) {
      alert("Failed to bulk link: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setBulkProcessing(false);
    }
  };

  // --- Build document tiles ---
  const documentTiles: DocumentTile[] = useMemo(
    () =>
      domainDocuments.map((d) => {
        const parent = parentRecords.find((r) => r.id === d.linked_id);
        return {
          id: d.id, fileName: d.label || "Unnamed Document", fileUrl: "",
          linkedItemName: parent ? parent.name : null, isLinked: !!d.linked_id,
          thumbnailUrl: null, mime: d.file_mime || undefined,
        };
      }),
    [domainDocuments, parentRecords],
  );

  // --- Search / view state ---
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useLocalStorage<"tiles" | "list">("store_view_" + domainKey, "tiles");

  const filteredDocs = useMemo(() => {
    if (!searchQuery) return documentTiles;
    return documentTiles.filter((doc) => doc.fileName.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [documentTiles, searchQuery]);

  // --- Tile renderers ---
  const renderDocListRow = (i: number) => {
    const doc = filteredDocs[i];
    const isRemoving = removingIds.has(doc.id);
    const isImage = doc.mime ? doc.mime.startsWith("image/") : doc.fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    const isPdf = doc.mime ? doc.mime === "application/pdf" : doc.fileName.match(/\.pdf$/i);
    const isSelected = selectedIds.has(doc.id);

    return (
      <div
        key={doc.id}
        onClick={() => {
          const d = allDocuments.find((x) => x.id === doc.id);
          if (!d?.linked_id) {
            setModals((prev) => ({ ...prev, edit: d || null }));
          } else {
            const handled = handleActionClick(doc.id);
            if (!handled) setModals((prev) => ({ ...prev, edit: d || null }));
          }
        }}
        className={`group flex items-center justify-between gap-4 p-4 transition-all duration-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer ${isRemoving ? "opacity-0 scale-y-95" : "opacity-100 scale-y-100"}`}
      >
        <div className="flex flex-1 items-center gap-4 min-w-0">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => { e.stopPropagation(); toggleSelection(doc.id, e.target.checked); }}
            onClick={(e) => e.stopPropagation()}
            className={`h-4 w-4 shrink-0 rounded border-zinc-300 dark:border-zinc-600 dark:bg-zinc-800 transition-opacity ${isSelected ? "opacity-100" : "opacity-100 md:opacity-0 md:group-hover:opacity-100"} ${theme.inputFocus}`}
          />
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
            {isImage ? <ImageIcon className={`h-5 w-5 ${theme.icon}`} /> : isPdf ? <FileText className={`h-5 w-5 ${theme.icon}`} /> : <File className={`h-5 w-5 ${theme.icon}`} />}
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {renamingId === doc.id ? (
              <input type="text" value={renameText} onChange={(e) => setRenameText(e.target.value)} onBlur={commitRename} onKeyDown={handleRenameKeyDown}
                className={`min-w-0 flex-1 rounded border px-1.5 py-0.5 text-sm font-medium text-zinc-900 outline-none focus:ring-1 dark:bg-zinc-800 dark:text-zinc-100 ${theme.inputFocus}`}
                autoFocus onClick={(e) => e.stopPropagation()} />
            ) : (
              <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100" title={doc.fileName}>{doc.fileName}</span>
            )}
            {renamingId !== doc.id && (
              <button onClick={(e) => { e.stopPropagation(); startRename(doc); }}
                className={`shrink-0 p-0.5 rounded opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all ${theme.icon} ${theme.iconHover}`}>
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {(doc.linkedItemName || doc.isLinked) && <Link className={`h-4 w-4 shrink-0 ${theme.icon}`} />}
          </div>
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {doc.linkedItemName && canUnlink && (
            <button onClick={() => setDocToUnlink(doc)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950/30 transition-colors" title="Unlink">
              <LinkSlashIcon className="h-4 w-4" />
            </button>
          )}
          <button onClick={() => handleDownload(doc.id)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors hover:text-zinc-600" title="Download">
            <Download className="h-4 w-4" />
          </button>
          <button onClick={() => setDocToDelete(doc)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 transition-colors" title="Delete">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  };

  const renderDocGridTile = (i: number) => {
    const doc = filteredDocs[i];
    const isRemoving = removingIds.has(doc.id);
    const isImage = doc.mime ? doc.mime.startsWith("image/") : doc.fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    const isPdf = doc.mime ? doc.mime === "application/pdf" : doc.fileName.match(/\.pdf$/i);
    const isSelected = selectedIds.has(doc.id);

    return (
      <div
        key={doc.id}
        onClick={() => {
          const d = allDocuments.find((x) => x.id === doc.id);
          if (!d?.linked_id) {
            setModals((prev) => ({ ...prev, edit: d || null }));
          } else {
            const handled = handleActionClick(doc.id);
            if (!handled) setModals((prev) => ({ ...prev, edit: d || null }));
          }
        }}
        className={`group relative flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-all duration-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 cursor-pointer ${theme.hoverBorder} ${isRemoving ? "opacity-0 scale-95" : "opacity-100 scale-100"}`}
      >
        {/* Selection checkbox */}
        <div className={`absolute top-2 left-2 z-10 transition-opacity ${isSelected ? "opacity-100" : "opacity-100 md:opacity-0 md:group-hover:opacity-100"}`} onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" checked={isSelected} onChange={(e) => toggleSelection(doc.id, e.target.checked)}
            className={`h-4 w-4 rounded border-zinc-300 bg-white/80 dark:border-zinc-600 dark:bg-zinc-800/80 ${theme.inputFocus}`} />
        </div>
        {/* Thumbnail */}
        <div className="relative flex h-32 w-full items-center justify-center bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800 overflow-hidden">
          {isImage ? <ImageIcon className={`h-10 w-10 ${theme.iconLarge}`} /> : isPdf ? <FileText className={`h-10 w-10 ${theme.iconLarge}`} /> : <File className={`h-10 w-10 ${theme.iconLarge}`} />}
          {(doc.linkedItemName || doc.isLinked) && (
            <div className="absolute bottom-2 right-2 flex items-center justify-center rounded-full bg-white/90 p-1.5 shadow-sm backdrop-blur-sm dark:bg-zinc-900/90">
              <Link className={`h-4 w-4 ${theme.icon}`} />
            </div>
          )}
          {/* Overlay actions */}
          <div className="absolute inset-x-0 top-0 flex items-start justify-end p-2 opacity-100 md:opacity-0 transition-opacity duration-200 md:group-hover:opacity-100 bg-gradient-to-b from-black/40 to-transparent">
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              {doc.linkedItemName && canUnlink && (
                <OverlayActionButton onClick={() => setDocToUnlink(doc)} title="Unlink" className="hover:bg-amber-500/80"><LinkSlashIcon className="h-4 w-4" /></OverlayActionButton>
              )}
              <OverlayActionButton onClick={() => handleDownload(doc.id)} title="Download" className="hover:bg-white/40"><Download className="h-4 w-4" /></OverlayActionButton>
              <OverlayActionButton onClick={() => setDocToDelete(doc)} title="Delete" className="hover:bg-red-500/80"><Trash2 className="h-4 w-4" /></OverlayActionButton>
            </div>
          </div>
        </div>
        {/* Footer */}
        <div className="flex flex-col p-3">
          {renamingId === doc.id ? (
            <input type="text" value={renameText} onChange={(e) => setRenameText(e.target.value)} onBlur={commitRename} onKeyDown={handleRenameKeyDown}
              className={`w-full rounded border px-1.5 py-0.5 text-sm font-medium text-zinc-900 outline-none focus:ring-1 dark:bg-zinc-800 dark:text-zinc-100 ${theme.inputFocus}`}
              autoFocus onClick={(e) => e.stopPropagation()} />
          ) : (
            <div className="flex items-center gap-1 min-w-0">
              <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100" title={doc.fileName}>{doc.fileName}</span>
              <button onClick={(e) => { e.stopPropagation(); startRename(doc); }}
                className={`shrink-0 p-0.5 rounded opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all ${theme.icon} ${theme.iconHover}`}>
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // --- Modal close helpers ---
  const closeStoreAddModal = () => { setModals((prev) => ({ ...prev, add: false })); clearHash(); };
  const closeStoreEditModal = () => { setModals((prev) => ({ ...prev, edit: null })); clearHash(); };
  const closeLinkedRecord = useCallback(() => { setLinkedRecord(null); refreshAll(); }, [refreshAll]);

  // --- Header action handlers ---
  const runHeaderAction = useCallback((action: HeaderAction) => {
    void action.onAction();
  }, []);

  // --- Render ---
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start gap-4">
        <BackButton href={backHref}>{backLabel}</BackButton>
        <div className="flex w-full items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{title}</h1>
            {description && <p className="mt-1 text-sm font-normal text-zinc-500 dark:text-zinc-400">{description}</p>}
          </div>
          {headerActions && (
            <HeaderActionsArea
              actions={headerActions}
              pendingAction={pendingHeaderAction}
              onAction={runHeaderAction}
              onRequireConfirm={setPendingHeaderAction}
              onConfirm={() => {
                const action = pendingHeaderAction;
                setPendingHeaderAction(null);
                if (action) void action.onAction();
              }}
              onCancelConfirm={() => setPendingHeaderAction(null)}
            />
          )}
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={userId ? () => refreshAll() : undefined} />}

      <BoxContainer className="flex flex-col h-full w-full space-y-6">
        <DataListView
          viewMode={viewMode} onViewModeChange={setViewMode}
          searchQuery={searchQuery} onSearchChange={setSearchQuery}
          searchPlaceholder={searchPlaceholder ?? adapter.searchPlaceholder}
          isLoading={isLoading}
          isEmpty={documentTiles.length === 0}
          isFilteredEmpty={filteredDocs.length === 0 && documentTiles.length > 0}
          emptyMessage={emptyMessage ?? adapter.emptyMessage}
          onAdd={allowAdd ? () => setModals((prev) => ({ ...prev, add: true })) : undefined}
          selectionEnabled selectedCount={selectedIds.size} totalCount={filteredDocs.length}
          onSelectAll={(checked) => { if (checked) selectAll(domainDocuments.map((d) => d.id)); else clearSelection(); }}
          onClearSelection={() => clearSelection()}
          bulkActionBar={
            <BulkActionBar selectedCount={selectedIds.size} onClear={clearSelection}>
              <button onClick={() => { setBulkRenameBase(""); setShowBulkRename(true); }}
                className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-colors">
                <Pencil className="h-4 w-4" /> Rename
              </button>
              <button onClick={() => setShowBulkDelete(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50 transition-colors">
                <Trash2 className="h-4 w-4" /> Delete
              </button>
              {canBulkLink && (
                <button onClick={() => setShowBulkLink(true)} disabled={!allBulkUnlinked}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${theme.lightBg}`}>
                  <Link className="h-4 w-4" /> Link
                </button>
              )}
            </BulkActionBar>
          }
          itemCount={filteredDocs.length}
          toggleActiveClassName={theme.lightBg}
          themeBtnClassName={theme.primaryBtn}
          themeInputFocus={theme.inputFocus}
          renderListRow={renderDocListRow}
          renderGridTile={renderDocGridTile}
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
            <input type="text" value={bulkRenameBase} onChange={(e) => setBulkRenameBase(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && bulkRenameBase.trim()) executeBulkRename(bulkRenameBase); }}
              placeholder="e.g., AWS Certification" autoFocus disabled={bulkProcessing}
              className={`mt-3 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-1 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 disabled:opacity-50 ${theme.inputFocus}`} />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { setShowBulkRename(false); setBulkRenameBase(""); }} disabled={bulkProcessing}
                className="inline-flex items-center rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 disabled:opacity-50">Cancel</button>
              <button onClick={() => executeBulkRename(bulkRenameBase)} disabled={!bulkRenameBase.trim() || bulkProcessing}
                className={`inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed ${theme.primaryBtn}`}>
                {bulkProcessing ? "Renaming..." : "Rename All"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation */}
      {showBulkDelete && (anyBulkLinked && canCascadeDelete ? (
        <ConfirmDialog title="Bulk Delete"
          description={`You are about to delete ${selectedIds.size} document${selectedIds.size !== 1 ? "s" : ""}. Some are linked to records.`}
          confirmLabel={bulkProcessing ? "Deleting..." : "Delete"} cancelLabel="Cancel"
          showDeleteFilesCheckbox deleteFilesLabel="Delete associated record(s)"
          onCancel={() => setShowBulkDelete(false)} onConfirm={(deleteRecord) => executeBulkDelete(!!deleteRecord)} />
      ) : (
        <ConfirmDialog title="Bulk Delete"
          description={`You are about to permanently delete ${selectedIds.size} document${selectedIds.size !== 1 ? "s" : ""}. This action cannot be undone.`}
          confirmLabel={bulkProcessing ? "Deleting..." : "Delete"} cancelLabel="Cancel"
          onCancel={() => setShowBulkDelete(false)} onConfirm={() => executeBulkDelete(false)} />
      ))}

      {/* Bulk Link Modal */}
      {showBulkLink && userId && canBulkLink && (
        <BulkLinkModal parentRecords={parentRecords} selectedCount={selectedIds.size} isProcessing={bulkProcessing}
          onClose={() => setShowBulkLink(false)} onSave={handleBulkLinkSave} />
      )}

      {/* Tile-level Unlink Confirmation */}
      {docToUnlink && (
        <ConfirmDialog title="Unlink certificate?"
          description={`This will unlink '${docToUnlink.fileName}' from '${docToUnlink.linkedItemName}'. The certificate file will be kept in the store as a standalone file.`}
          confirmLabel="Unlink" cancelLabel="Cancel"
          onConfirm={async () => {
            const id = docToUnlink.id;
            const parentId = allDocuments.find((x) => x.id === id)?.linked_id || "";
            setDocToUnlink(null);
            if (userId && adapter.unlinkFromParent) {
              try {
                await adapter.unlinkFromParent(userId, id, parentId);
                await refreshAll();
              } catch (err) {
                alert("Failed to unlink: " + (err instanceof Error ? err.message : "Unknown error"));
              }
            }
          }}
          onCancel={() => setDocToUnlink(null)} />
      )}

      {/* Tile-level Delete Confirmation */}
      {docToDelete && (docToDelete.linkedItemName || docToDelete.isLinked) && canCascadeDelete ? (
        <ConfirmDialog title="Delete document?"
          description={`This document is linked to ${docToDelete.linkedItemName ? `'${docToDelete.linkedItemName}'` : "an associated record"}.`}
          confirmLabel="Delete" cancelLabel="Cancel" showDeleteFilesCheckbox deleteFilesLabel="Delete associated record"
          onConfirm={(deleteRecord) => confirmDeleteWithMode(deleteRecord ? "cascade" : "unlink")}
          onCancel={() => setDocToDelete(null)} />
      ) : docToDelete && (docToDelete.linkedItemName || docToDelete.isLinked) ? (
        <ConfirmDialog title="Delete document?"
          description={`This document is linked to ${docToDelete.linkedItemName ? `'${docToDelete.linkedItemName}'` : "an associated record"}.`}
          confirmLabel="Delete" cancelLabel="Cancel"
          onConfirm={() => confirmDeleteWithMode("unlink")}
          onCancel={() => setDocToDelete(null)} />
      ) : docToDelete ? (
        <ConfirmDialog title="Delete document?"
          description={`This will permanently delete '${docToDelete.fileName}'. This action cannot be undone.`}
          confirmLabel="Delete" cancelLabel="Cancel"
          onConfirm={() => confirmDeleteWithMode("unlink")} onCancel={() => setDocToDelete(null)} />
      ) : null}

      {/* GenericDomainModal — Add mode (standalone_file) */}
      {isAddingDocument && userId && (
        <GenericDomainModal
          mode="standalone_file"
          domain={modalDomain}
          fields={modalFields}
          userId={userId}
          onClose={closeStoreAddModal}
          onSaved={async (saved) => {
            const fresh = await adapter.fetchData(userId);
            setAllRows(fresh.rows);
            setAllDocuments(fresh.documents);
            setParentRecords(adapter.deriveParentRecords(fresh.rows));
            if (saved.linkedId) {
              // Linked to a (possibly inline-created) parent: jump to the record modal.
              setModals({ add: false, edit: null });
              clearHash();
              const parent = fresh.rows.find((r) => r.id === saved.linkedId);
              if (parent) setLinkedRecord(parent);
            } else {
              // Standalone: stay in the edit modal for the freshly saved doc.
              const updatedDoc = fresh.documents.find((d) => d.id === saved.id);
              if (updatedDoc) {
                setModals({ add: false, edit: updatedDoc });
                window.history.replaceState(
                  null,
                  "",
                  window.location.pathname + window.location.search + `#edit-document-${saved.id}`,
                );
              } else {
                setModals({ add: false, edit: null });
                clearHash();
              }
            }
          }}
        />
      )}

      {/* GenericDomainModal — Edit mode (standalone_file) */}
      {editingDocument && userId && (
        <GenericDomainModal
          mode="standalone_file"
          domain={modalDomain}
          target={{
            type: "document",
            id: editingDocument.id,
            data: editingDocument as unknown as Record<string, unknown>,
          }}
          fields={modalFields}
          userId={userId}
          onClose={closeStoreEditModal}
          onSaved={async (saved) => {
            const fresh = await adapter.fetchData(userId);
            setAllRows(fresh.rows);
            setAllDocuments(fresh.documents);
            setParentRecords(adapter.deriveParentRecords(fresh.rows));
            if (saved.linkedId) {
              setModals({ add: false, edit: null });
              clearHash();
              const parent = fresh.rows.find((r) => r.id === saved.linkedId);
              if (parent) setLinkedRecord(parent);
            } else {
              const updatedDoc = fresh.documents.find((d) => d.id === saved.id);
              if (updatedDoc) {
                setModals({ add: false, edit: updatedDoc });
                window.history.replaceState(
                  null,
                  "",
                  window.location.pathname + window.location.search + `#edit-document-${saved.id}`,
                );
              } else {
                setModals({ add: false, edit: null });
                clearHash();
              }
            }
          }}
          onDeleted={async () => {
            await refreshAll();
          }}
        />
      )}

      {/* Record modal (linked parent record or standalone record) */}
      {linkedRecord && userId && (
        <GenericDomainModal
          mode="record"
          domain={modalDomain}
          target={{
            type: "record",
            id: linkedRecord.id,
            data: linkedRecord as unknown as Record<string, unknown>,
          }}
          fields={modalFields}
          userId={userId}
          onClose={closeLinkedRecord}
          onSaved={async (_saved, sctx) => {
            await refreshAll();
            if (sctx.unlinkedDocIds.length > 0) {
              // A doc was unlinked from this record: jump to its edit modal.
              setLinkedRecord(null);
              const unlinkedId =
                sctx.unlinkedDocIds[sctx.unlinkedDocIds.length - 1];
              window.location.hash = `#edit-document-${unlinkedId}`;
            }
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// GenericRecordStore — record store (absorbed VaultRecordView)
// ============================================================

type GenericRecordStoreProps<T extends { id: string }> = GenericStorePageProps & {
  adapter: RecordStoreAdapter<T>;
};

function GenericRecordStore<T extends { id: string }>({
  adapter,
  domain: domainKey,
  modalFields,
  title,
  description,
  backHref,
  backLabel = "← Back",
  scope,
  allowAdd = false,
  tileLayout,
  searchPlaceholder,
  emptyMessage,
  headerActions,
  disableSelection = false,
}: GenericRecordStoreProps<T>) {
  const theme = DOMAIN_THEMES.vault;
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [data, setData] = useState<T[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [pageTitle, setPageTitle] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingHeaderAction, setPendingHeaderAction] = useState<HeaderAction | null>(null);

  // Auth
  useEffect(() => {
    const init = async () => {
      const session = await getSession();
      if (session?.user?.id) setUserId(session.user.id);
      setIsLoading(false);
    };
    init();
  }, []);

  // Data loading
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await adapter.fetchData(userId, scope);
        if (!cancelled) {
          setData(res.rows);
          setDocuments(res.documents ?? []);
          setPageTitle(res.pageTitle ?? null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load data");
      }
    };
    load();
    return () => { cancelled = true; };
  }, [userId, adapter, scope]);

  const reload = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await adapter.fetchData(userId, scope);
      setData(res.rows);
      setDocuments(res.documents ?? []);
      setPageTitle(res.pageTitle ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    }
  }, [userId, adapter, scope]);

  // Selection
  const { selectedIds, toggleSelection, selectAll, clearSelection } = useSelection();
  const [modalRecord, setModalRecord] = useState<T | null | undefined>(undefined);

  // Optimistic save
  const handleSaved = useCallback((entry: T) => {
    setData((prev) => {
      const idx = prev.findIndex((r) => r.id === entry.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = entry; return next; }
      return [entry, ...prev];
    });
    // Sync the open modal with the saved entry so its initialData refreshes and
    // the dirty check clears — otherwise cancelling right after a save triggers
    // a spurious "unsaved changes" prompt.
    // Add mode (modalRecord === null): the freshly created record has no
    // editable stale state left, so close the modal.
    setModalRecord((prev) => {
      if (prev === null) return undefined;
      return prev && prev.id === entry.id ? entry : prev;
    });
    reload();
  }, [reload]);

  // Delete confirmation (inline, not via useDeleteConfirm to use our callbacks)
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const plural = adapter.itemNamePlural ?? `${adapter.itemName}s`;

  const handleSingleDelete = useCallback(async () => {
    if (!itemToDelete || !userId) return;
    await adapter.deleteRecord(userId, itemToDelete);
    setItemToDelete(null);
    clearSelection();
    await reload();
  }, [itemToDelete, userId, adapter, clearSelection, reload]);

  const handleBulkDelete = useCallback(async () => {
    if (!userId) return;
    await adapter.bulkDeleteRecords(userId, Array.from(selectedIds));
    setIsBulkDeleting(false);
    clearSelection();
    await reload();
  }, [selectedIds, userId, adapter, clearSelection, reload]);

  // Derived items
  const items: VaultRecordItem[] = useMemo(
    () => data.map((r) => adapter.mapRecordToItem(r, documents)),
    [data, adapter, documents],
  );

  // Bulk actions bar
  const bulkActions = (
    <BulkActionBar selectedCount={selectedIds.size} onClear={clearSelection}>
      <button onClick={() => setIsBulkDeleting(true)}
        className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50 transition-colors">
        <Trash2 className="h-4 w-4" /> Delete
      </button>
    </BulkActionBar>
  );

  const handleSelectAll = useCallback(
    (checked: boolean) => { if (checked) selectAll(data.map((r) => r.id)); else clearSelection(); },
    [data, selectAll, clearSelection],
  );

  const handleActionClick = useCallback(
    (id: string) => {
      if (adapter.getRowHref) {
        const record = data.find((r) => r.id === id);
        if (record) router.push(adapter.getRowHref(record));
        return;
      }
      const record = data.find((r) => r.id === id);
      if (record) setModalRecord(record);
    },
    [data, adapter, router],
  );

  const closeModal = useCallback(() => { setModalRecord(undefined); reload(); }, [reload]);

  // Search / view state
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useLocalStorage<"tiles" | "list">("store_view_" + domainKey, "tiles");

  const filtered = useMemo(() => {
    if (!searchQuery) return items;
    const q = searchQuery.toLowerCase();
    return items.filter((item) =>
      item.title.toLowerCase().includes(q) || item.values.some((v) => !v.isSecret && v.value.toLowerCase().includes(q)),
    );
  }, [items, searchQuery]);

  const effectiveTileLayout = tileLayout ?? adapter.tileLayout ?? "standard";

  // --- Tile/list renderers ---
  const renderListRow = (i: number) => {
    const item = filtered[i];
    const isSelected = selectedIds.has(item.id);
    return (
      <div key={item.id} onClick={() => handleActionClick(item.id)}
        className={`group flex items-center gap-4 px-4 py-4 min-h-[72px] transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer`}>
        {!disableSelection && (
          <input type="checkbox" checked={isSelected} onChange={(e) => { e.stopPropagation(); toggleSelection(item.id, e.target.checked); }}
            onClick={(e) => e.stopPropagation()}
            className={`h-4 w-4 shrink-0 rounded border-zinc-300 dark:border-zinc-600 dark:bg-zinc-800 transition-opacity ${isSelected ? "opacity-100" : "opacity-100 md:opacity-0 md:group-hover:opacity-100"} ${theme.inputFocus}`} />
        )}
        {/* Name + values: stacked on mobile, side-by-side columns on desktop */}
        <div className="flex flex-col sm:flex-row flex-1 min-w-0 items-start sm:items-center gap-4">
          {effectiveTileLayout === "body-only" ? (
            <div className="w-full sm:w-1/3 sm:min-w-[120px] pt-0.5 flex items-start">
              <div className="flex-1 min-w-0 flex items-center gap-1 rounded px-1 py-2 -mx-1 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors cursor-text" onClick={(e) => e.stopPropagation()}>
                <span className="text-base text-zinc-700 dark:text-zinc-300 font-mono overflow-x-auto whitespace-nowrap flex-1 min-w-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">{item.title}</span>
              </div>
            </div>
          ) : (
            <div className="w-full sm:w-1/3 sm:min-w-[120px] font-medium text-sm text-zinc-900 dark:text-zinc-100 break-words pt-0.5">{item.title}</div>
          )}
          <div className="w-px hidden sm:block bg-zinc-200 dark:bg-zinc-700 self-stretch min-h-[1.5rem]" />
          <div className="flex-1 w-full flex flex-col gap-1 min-w-0">
            {item.values.map((v, idx) => (
              <div key={idx} className="flex items-center gap-2 min-w-0">
                {v.label && <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400 w-24 shrink-0">{v.label}</span>}
                <div className="flex-1 min-w-0"><InlineSecretValue value={v.value} isSecret={v.isSecret ?? false} isCopyable={v.isCopyable} /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={(e) => { e.stopPropagation(); setItemToDelete(item.id); }}
            className="cursor-pointer flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all" title="Delete">
            <Trash2 className="h-4 w-4" />
          </button>
          {item.hasFiles && (
            <span title="Has files" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${theme.icon}`}>
              <PaperClipIcon className="h-4 w-4" />
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderGridTile = (i: number) => {
    const item = filtered[i];
    const isSelected = selectedIds.has(item.id);
    return (
      <div key={item.id} onClick={() => handleActionClick(item.id)}
        className={`group relative flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-all duration-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 cursor-pointer min-h-[9rem] ${theme.hoverBorder}`}>
        <div className="flex items-center justify-between gap-2 px-3 py-3 border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700/50 dark:bg-zinc-800/50">
          <div className="flex items-center gap-2 min-w-0">
            {!disableSelection && (
              <input type="checkbox" checked={isSelected} onChange={(e) => toggleSelection(item.id, e.target.checked)} onClick={(e) => e.stopPropagation()}
                className={`h-4 w-4 shrink-0 rounded border-zinc-300 dark:border-zinc-600 dark:bg-zinc-800 ${theme.inputFocus} transition-opacity ${isSelected ? "opacity-100" : "opacity-100 md:opacity-0 md:group-hover:opacity-100"}`} />
            )}
            <span className="block truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100" title={effectiveTileLayout === "standard" ? item.title : undefined}>
              {effectiveTileLayout === "standard" ? item.title : " "}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={(e) => { e.stopPropagation(); setItemToDelete(item.id); }}
              className="cursor-pointer flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/60 text-zinc-700 backdrop-blur-sm transition-all hover:bg-red-500/80 hover:text-white dark:bg-black/40 dark:text-zinc-300 opacity-100 md:opacity-0 md:group-hover:opacity-100" title="Delete">
              <Trash2 className="h-4 w-4" />
            </button>
            {item.hasFiles && (
              <span title="Has files" className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${theme.icon}`}>
                <PaperClipIcon className="h-4 w-4" />
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col flex-1 p-3 gap-2 justify-end overflow-hidden">
          {effectiveTileLayout === "body-only" && (
            <div className="flex flex-col overflow-hidden">
              <div className="flex items-center gap-1 rounded px-1 py-2 -mx-1 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors cursor-text" onClick={(e) => e.stopPropagation()}>
                <span className="text-base text-zinc-700 dark:text-zinc-300 font-mono overflow-x-auto whitespace-nowrap flex-1 min-w-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">{item.title}</span>
              </div>
            </div>
          )}
          {item.values.map((v, idx) => (
            <div key={idx} className="flex min-w-0 flex-col overflow-hidden">
              {v.label && <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-1">{v.label}</span>}
              <InlineSecretValue value={v.value} isSecret={v.isSecret ?? false} isCopyable={v.isCopyable} />
            </div>
          ))}
        </div>
      </div>
    );
  };

  const selectedCount = selectedIds.size;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col items-start gap-4">
        {backHref && <BackButton href={backHref}>{backLabel}</BackButton>}
        <div className="flex w-full items-end justify-between">
          <div>
            {title && <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{pageTitle ?? title}</h1>}
            {description && <p className="mt-1 text-sm font-normal text-zinc-500 dark:text-zinc-400">{description}</p>}
          </div>
          {headerActions && (
            <HeaderActionsArea
              actions={headerActions}
              pendingAction={pendingHeaderAction}
              onAction={(action) => void action.onAction()}
              onRequireConfirm={setPendingHeaderAction}
              onConfirm={() => {
                const action = pendingHeaderAction;
                setPendingHeaderAction(null);
                if (action) void action.onAction();
              }}
              onCancelConfirm={() => setPendingHeaderAction(null)}
            />
          )}
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={userId ? () => reload() : undefined} />}

      <BoxContainer className="flex flex-col h-full w-full space-y-6">
        <DataListView
          viewMode={viewMode} onViewModeChange={setViewMode}
          searchQuery={searchQuery} onSearchChange={setSearchQuery}
          searchPlaceholder={searchPlaceholder ?? adapter.searchPlaceholder ?? "Search..."}
          isLoading={isLoading} isEmpty={items.length === 0}
          isFilteredEmpty={filtered.length === 0 && items.length > 0}
          emptyMessage={emptyMessage ?? adapter.emptyMessage ?? "No items to display."}
          onAdd={allowAdd && userId ? () => setModalRecord(null) : undefined}
          selectionEnabled={!disableSelection} selectedCount={selectedCount} totalCount={filtered.length}
          onSelectAll={handleSelectAll} onClearSelection={() => handleSelectAll(false)}
          bulkActionBar={bulkActions}
          itemCount={filtered.length}
          toggleActiveClassName={theme.lightBg}
          themeBtnClassName={theme.primaryBtn}
          themeInputFocus={theme.inputFocus}
          renderListRow={renderListRow}
          renderGridTile={renderGridTile}
        />
      </BoxContainer>

      {/* Record modal */}
      {modalRecord !== undefined && userId && (
        <GenericDomainModal
          mode="record"
          domain={domainKey}
          scope={scope}
          target={
            modalRecord
              ? {
                  type: "record",
                  id: modalRecord.id,
                  data: modalRecord as unknown as Record<string, unknown>,
                }
              : undefined
          }
          fields={modalFields}
          userId={userId}
          onClose={closeModal}
          onSaved={async (saved) => {
            if (saved.data) handleSaved(saved.data as unknown as T);
          }}
        />
      )}

      {/* Delete confirmation modals */}
      {itemToDelete && (
        <ConfirmDialog title={`Delete ${adapter.itemName}?`}
          description={adapter.singleDeleteDescription ?? `This will permanently delete this ${adapter.itemName}. This action cannot be undone.`}
          confirmLabel="Delete" cancelLabel="Cancel" onConfirm={handleSingleDelete} onCancel={() => setItemToDelete(null)} />
      )}
      {isBulkDeleting && (
        <ConfirmDialog title={`Delete selected ${plural}?`}
          description={`This will permanently delete ${selectedIds.size} selected ${plural}. This action cannot be undone.`}
          confirmLabel="Delete All" cancelLabel="Cancel" onConfirm={handleBulkDelete} onCancel={() => setIsBulkDeleting(false)} />
      )}
    </div>
  );
}
