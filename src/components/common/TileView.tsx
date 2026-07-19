"use client";

import { useState, useMemo } from "react";
import {
  Download,
  Trash2,
  File,
  FileText,
  Image as ImageIcon,
  Plus,
  Pencil,
} from "lucide-react";
import { LinkSlashIcon, LinkIcon } from "@/components/common/Icons";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import ViewToggle from "@/components/common/ViewToggle";
import SearchBar from "@/components/common/SearchBar";
import type { ViewToggleOption } from "@/components/common/ViewToggle";

const STORE_VIEW_OPTIONS: readonly ViewToggleOption<"tiles" | "list">[] = [
  { value: "tiles", label: "Tiles" },
  { value: "list", label: "List" },
];

export interface DocumentTile {
  id: string;
  fileName: string;
  fileUrl?: string;
  thumbnailUrl?: string | null;
  linkedItemName?: string | null;
  /** MIME type (e.g. "application/pdf"). When provided, used for icon resolution instead of filename extension. */
  mime?: string;
}

/** Map domain accent colours to Tailwind classes so each feature's store inherits its parent theme. */
const DOMAIN_THEMES = {
  taskmanager: {
    primaryBtn:
      "bg-sky-600 hover:bg-sky-500 focus-visible:outline-sky-600",
    primaryText:
      "text-sky-600 hover:text-sky-500 dark:text-sky-400 dark:hover:text-sky-300",
    lightBg:
      "bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950/30 dark:text-sky-400 dark:hover:bg-sky-950/50",
    icon: "text-sky-500",
    iconLarge: "text-sky-500/50",
    iconHover: "hover:text-sky-500",
    downloadHover: "hover:text-sky-600",
    borderFocus:
      "border-sky-400 focus:ring-sky-500 dark:border-sky-600",
    hoverBorder:
      "hover:border-sky-200 dark:hover:border-sky-800",
    checkbox: "text-sky-600 focus:ring-sky-600",
  },
  education: {
    primaryBtn:
      "bg-amber-600 hover:bg-amber-500 focus-visible:outline-amber-600",
    primaryText:
      "text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300",
    lightBg:
      "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:hover:bg-amber-950/50",
    icon: "text-amber-500",
    iconLarge: "text-amber-500/50",
    iconHover: "hover:text-amber-500",
    downloadHover: "hover:text-amber-600",
    borderFocus:
      "border-amber-400 focus:ring-amber-500 dark:border-amber-600",
    hoverBorder:
      "hover:border-amber-200 dark:hover:border-amber-800",
    checkbox: "text-amber-600 focus:ring-amber-600",
  },
  medical: {
    primaryBtn:
      "bg-rose-600 hover:bg-rose-500 focus-visible:outline-rose-600",
    primaryText:
      "text-rose-600 hover:text-rose-500 dark:text-rose-400 dark:hover:text-rose-300",
    lightBg:
      "bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-950/50",
    icon: "text-rose-500",
    iconLarge: "text-rose-500/50",
    iconHover: "hover:text-rose-500",
    downloadHover: "hover:text-rose-600",
    borderFocus:
      "border-rose-400 focus:ring-rose-500 dark:border-rose-600",
    hoverBorder:
      "hover:border-rose-200 dark:hover:border-rose-800",
    checkbox: "text-rose-600 focus:ring-rose-600",
  },
  expense: {
    primaryBtn:
      "bg-emerald-600 hover:bg-emerald-500 focus-visible:outline-emerald-600",
    primaryText:
      "text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300",
    lightBg:
      "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-950/50",
    icon: "text-emerald-500",
    iconLarge: "text-emerald-500/50",
    iconHover: "hover:text-emerald-500",
    downloadHover: "hover:text-emerald-600",
    borderFocus:
      "border-emerald-400 focus:ring-emerald-500 dark:border-emerald-600",
    hoverBorder:
      "hover:border-emerald-200 dark:hover:border-emerald-800",
    checkbox: "text-emerald-600 focus:ring-emerald-600",
  },
} as const;

type Domain = keyof typeof DOMAIN_THEMES;

interface TileViewProps {
  documents: DocumentTile[];
  isLoading?: boolean;
  onDownload?: (fileId: string) => void;
  onDeleteConfirmed?: (fileId: string, cascadeMode: 'unlink' | 'cascade') => void;
  onUnlinkConfirmed?: (fileId: string) => void;
  onAdd?: () => void;
  onActionClick?: (fileId: string) => void;
  title?: React.ReactNode;
  getDeleteWarningText?: (doc: DocumentTile) => string;
  onRenameConfirmed?: (fileId: string, newName: string) => void;
  // Bulk selection
  selectionEnabled?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (id: string, checked: boolean) => void;
  onSelectAll?: (checked: boolean) => void;
  /** Rendered in place of the search bar when items are selected */
  bulkActions?: React.ReactNode;
  /** Feature domain for accent colour theming. Defaults to "expense" (green). */
  domain?: Domain;
}

export default function TileView({
  documents,
  isLoading = false,
  onDownload,
  onDeleteConfirmed,
  onUnlinkConfirmed,
  onAdd,
  onActionClick,
  title = "Document Vault",
  getDeleteWarningText,
  onRenameConfirmed,
  selectionEnabled = false,
  selectedIds,
  onSelectionChange,
  onSelectAll,
  bulkActions,
  domain = "expense",
}: TileViewProps) {
  const theme = DOMAIN_THEMES[domain];

  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"tiles" | "list">("tiles");
  const [docToDelete, setDocToDelete] = useState<DocumentTile | null>(null);
  const [docToUnlink, setDocToUnlink] = useState<DocumentTile | null>(null);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  // Inline rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");

  const startRename = (doc: DocumentTile) => {
    setRenamingId(doc.id);
    setRenameText(doc.fileName);
  };

  const commitRename = () => {
    if (renamingId && renameText.trim() && onRenameConfirmed) {
      onRenameConfirmed(renamingId, renameText.trim());
    }
    setRenamingId(null);
    setRenameText("");
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      commitRename();
    } else if (e.key === "Escape") {
      setRenamingId(null);
      setRenameText("");
    }
  };

  const filteredDocs = useMemo(() => {
    if (!searchQuery) return documents;
    return documents.filter((doc) =>
      doc.fileName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [documents, searchQuery]);

  const handleDeleteClick = (doc: DocumentTile) => {
    setDocToDelete(doc);
  };

  const confirmDeleteWithMode = (cascadeMode: 'unlink' | 'cascade') => {
    if (!docToDelete) return;

    // Add to removingIds to trigger fade out animation
    setRemovingIds((prev) => {
      const newSet = new Set(prev);
      newSet.add(docToDelete.id);
      return newSet;
    });

    const idToRemove = docToDelete.id;
    setDocToDelete(null);

    // Give animation time to play before calling parent
    setTimeout(() => {
      if (onDeleteConfirmed) {
        onDeleteConfirmed(idToRemove, cascadeMode);
      }
      // Clean up local state after a while
      setTimeout(() => {
        setRemovingIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(idToRemove);
          return newSet;
        });
      }, 500);
    }, 300);
  };

  const defaultGetDeleteWarningText = (doc: DocumentTile) => {
    if (getDeleteWarningText) {
      return getDeleteWarningText(doc);
    }
    if (doc.linkedItemName) {
      return `This will permanently delete '${doc.fileName}'. It will also be removed from '${doc.linkedItemName}' it is currently linked to. This action cannot be undone.`;
    }
    return `This will permanently delete '${doc.fileName}'. This action cannot be undone.`;
  };

  return (
    <div className="flex flex-col h-full w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-row items-center gap-3">
          {title && (
            <div className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              {title}
            </div>
          )}
          <ViewToggle
            value={viewMode}
            onChange={setViewMode}
            options={STORE_VIEW_OPTIONS}
            ariaLabel="Store view toggle"
          />
          {selectionEnabled && selectedIds && selectedIds.size > 0 && (
            <button
              onClick={() => onSelectAll?.(selectedIds.size < filteredDocs.length)}
              className={`text-xs font-medium transition-colors ${theme.primaryText}`}
            >
              {selectedIds.size < filteredDocs.length ? `Select all (${filteredDocs.length})` : "Deselect all"}
            </button>
          )}
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto mt-3 sm:mt-0">
          {selectionEnabled && selectedIds && selectedIds.size > 0 && bulkActions ? (
            bulkActions
          ) : (
            <>
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search files..."
                className="flex-1 sm:w-64"
              />
              {onAdd && (
                <button
                  onClick={onAdd}
                  className={`inline-flex items-center justify-center gap-x-1.5 rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${theme.primaryBtn}`}
                >
                  <Plus className="-ml-0.5 h-4 w-4" />
                  Add
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Grid Area */}
      <div className="flex-1">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
            <span className="text-zinc-500 dark:text-zinc-400">Loading documents...</span>
          </div>
        ) : documents.length === 0 ? (
          <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
            <span className="text-zinc-500 dark:text-zinc-400">No documents in the vault.</span>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
            <span className="text-zinc-500 dark:text-zinc-400">No matching documents found.</span>
          </div>
        ) : viewMode === "list" ? (
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            {selectionEnabled && selectedIds && selectedIds.size > 0 && (
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50">
                <input
                  type="checkbox"
                  checked={filteredDocs.length > 0 && selectedIds.size === filteredDocs.length}
                  onChange={(e) => onSelectAll?.(e.target.checked)}
                  className={`h-4 w-4 rounded border-zinc-300 dark:border-zinc-600 dark:bg-zinc-800 ${theme.checkbox}`}
                />
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {selectedIds.size === filteredDocs.length
                    ? "All selected"
                    : `${selectedIds.size} of ${filteredDocs.length} selected`}
                </span>
                <button
                  onClick={() => onSelectAll?.(false)}
                  className="ml-auto text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
                >
                  Clear
                </button>
              </div>
            )}
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {filteredDocs.map((doc) => {
                const isRemoving = removingIds.has(doc.id);
                const isImage = doc.mime ? doc.mime.startsWith("image/") : doc.fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                const isPdf = doc.mime ? doc.mime === "application/pdf" : doc.fileName.match(/\.pdf$/i);

                return (
                  <div
                    key={doc.id}
                    onClick={() => onActionClick?.(doc.id)}
                    className={`group flex items-center justify-between gap-4 p-4 transition-all duration-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${onActionClick ? "cursor-pointer" : ""} ${isRemoving ? "opacity-0 scale-y-95" : "opacity-100 scale-y-100"
                      }`}
                  >
                    <div className="flex flex-1 items-center gap-4 min-w-0">
                      {selectionEnabled && (
                        <input
                          type="checkbox"
                          checked={selectedIds?.has(doc.id) ?? false}
                          onChange={(e) => {
                            e.stopPropagation();
                            onSelectionChange?.(doc.id, e.target.checked);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className={`h-4 w-4 shrink-0 rounded border-zinc-300 dark:border-zinc-600 dark:bg-zinc-800 transition-opacity ${
                            selectedIds?.has(doc.id)
                              ? "opacity-100"
                              : "opacity-0 group-hover:opacity-100"
                          } ${theme.checkbox}`}
                        />
                      )}
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                        {isImage ? (
                          <ImageIcon className={`h-5 w-5 ${theme.icon}`} />
                        ) : isPdf ? (
                          <FileText className="h-5 w-5 text-red-500" />
                        ) : (
                          <File className="h-5 w-5 text-zinc-400" />
                        )}
                      </div>
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        {renamingId === doc.id ? (
                          <input
                            type="text"
                            value={renameText}
                            onChange={(e) => setRenameText(e.target.value)}
                            onBlur={commitRename}
                            onKeyDown={handleRenameKeyDown}
                            className={`min-w-0 flex-1 rounded border px-1.5 py-0.5 text-sm font-medium text-zinc-900 outline-none focus:ring-1 dark:bg-zinc-800 dark:text-zinc-100 ${theme.borderFocus}`}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100" title={doc.fileName}>
                            {doc.fileName}
                          </span>
                        )}
                        {onRenameConfirmed && renamingId !== doc.id && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startRename(doc);
                            }}
                            className={`shrink-0 p-0.5 rounded text-zinc-400 opacity-0 group-hover:opacity-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all ${theme.iconHover}`}
                            title="Rename"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {doc.linkedItemName && (
                          <LinkIcon className={`h-4 w-4 shrink-0 ${theme.icon}`} />
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {doc.linkedItemName && onUnlinkConfirmed && (
                        <button
                          onClick={() => setDocToUnlink(doc)}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950/30 transition-colors"
                          title="Unlink"
                        >
                          <LinkSlashIcon className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => onDownload?.(doc.id)}
                        className={`flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${theme.downloadHover}`}
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(doc)}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredDocs.map((doc) => {
              const isRemoving = removingIds.has(doc.id);

              // Prefer MIME type for icon resolution, fall back to filename extension
              const isImage = doc.mime ? doc.mime.startsWith("image/") : doc.fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i);
              const isPdf = doc.mime ? doc.mime === "application/pdf" : doc.fileName.match(/\.pdf$/i);

              return (
                <div
                  key={doc.id}
                  onClick={() => onActionClick?.(doc.id)}
                  className={`group relative flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-all duration-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 ${onActionClick ? "cursor-pointer" : ""} ${isRemoving ? "opacity-0 scale-95" : "opacity-100 scale-100"} ${theme.hoverBorder}`}
                >
                  {/* Selection checkbox — top-left */}
                  {selectionEnabled && (
                    <div
                      className={`absolute top-2 left-2 z-10 transition-opacity ${
                        selectedIds?.has(doc.id)
                          ? "opacity-100"
                          : "opacity-0 group-hover:opacity-100"
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds?.has(doc.id) ?? false}
                        onChange={(e) => onSelectionChange?.(doc.id, e.target.checked)}
                        className={`h-4 w-4 rounded border-zinc-300 bg-white/80 dark:border-zinc-600 dark:bg-zinc-800/80 ${theme.checkbox}`}
                      />
                    </div>
                  )}
                  {/* Thumbnail Area */}
                  <div className="relative flex h-32 w-full items-center justify-center bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800 overflow-hidden">
                    {doc.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={doc.thumbnailUrl} alt={doc.fileName} className="h-full w-full object-cover" />
                    ) : isImage ? (
                      <ImageIcon className={`h-10 w-10 ${theme.iconLarge}`} />
                    ) : isPdf ? (
                      <FileText className="h-10 w-10 text-red-500/50" />
                    ) : (
                      <File className="h-10 w-10 text-zinc-400/50" />
                    )}

                    {/* Linked indicator — bottom-right of thumbnail, above footer */}
                    {doc.linkedItemName && (
                      <div className="absolute bottom-2 right-2 flex items-center justify-center rounded-full bg-white/90 p-1.5 shadow-sm backdrop-blur-sm dark:bg-zinc-900/90">
                        <LinkIcon className={`h-4 w-4 ${theme.icon}`} />
                      </div>
                    )}

                    {/* Overlay Actions — top-right */}
                    <div className="absolute inset-x-0 top-0 flex items-start justify-end p-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100 bg-gradient-to-b from-black/40 to-transparent">
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        {doc.linkedItemName && onUnlinkConfirmed && (
                          <button
                            onClick={() => setDocToUnlink(doc)}
                            className="flex h-7 w-7 items-center justify-center rounded-md bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-amber-500/80"
                            title="Unlink"
                          >
                            <LinkSlashIcon className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => onDownload?.(doc.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-md bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-white/40"
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(doc)}
                          className="flex h-7 w-7 items-center justify-center rounded-md bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-red-500/80"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Footer Area */}
                  <div className="flex flex-col p-3">
                    {renamingId === doc.id ? (
                      <input
                        type="text"
                        value={renameText}
                        onChange={(e) => setRenameText(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={handleRenameKeyDown}
                        className={`w-full rounded border px-1.5 py-0.5 text-sm font-medium text-zinc-900 outline-none focus:ring-1 dark:bg-zinc-800 dark:text-zinc-100 ${theme.borderFocus}`}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <div className="flex items-center gap-1 min-w-0">
                        <span
                          className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100"
                          title={doc.fileName}
                        >
                          {doc.fileName}
                        </span>
                        {onRenameConfirmed && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startRename(doc);
                            }}
                            className={`shrink-0 p-0.5 rounded text-zinc-400 opacity-0 group-hover:opacity-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all ${theme.iconHover}`}
                            title="Rename"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Unlink Confirmation Modal */}
      {docToUnlink && (
        <ConfirmDialog
          title="Unlink certificate?"
          description={`This will unlink '${docToUnlink.fileName}' from '${docToUnlink.linkedItemName}'. The certificate file will be kept in the store as a standalone file.`}
          confirmLabel="Unlink"
          cancelLabel="Cancel"
          onConfirm={() => {
            const id = docToUnlink.id;
            setDocToUnlink(null);
            onUnlinkConfirmed?.(id);
          }}
          onCancel={() => setDocToUnlink(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {docToDelete && docToDelete.linkedItemName ? (
        <ConfirmDialog
          title="Delete document?"
          description={`This document is linked to '${docToDelete.linkedItemName}'.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          showDeleteFilesCheckbox
          deleteFilesLabel="Delete associated record"
          onConfirm={(deleteRecord) => confirmDeleteWithMode(deleteRecord ? 'cascade' : 'unlink')}
          onCancel={() => setDocToDelete(null)}
        />
      ) : docToDelete ? (
        <ConfirmDialog
          title="Delete document?"
          description={defaultGetDeleteWarningText(docToDelete)}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onConfirm={() => confirmDeleteWithMode('unlink')}
          onCancel={() => setDocToDelete(null)}
        />
      ) : null}
    </div>
  );
}
