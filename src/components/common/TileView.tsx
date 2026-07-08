"use client";

import { useState, useMemo } from "react";
import { 
  Search, 
  Download, 
  Trash2, 
  MoreVertical, 
  File, 
  FileText,
  Image as ImageIcon,
  Plus
} from "lucide-react";
import ConfirmDialog from "@/components/taskmanager/ConfirmDialog";
import ViewToggle from "@/components/common/ViewToggle";
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
}

interface TileViewProps {
  documents: DocumentTile[];
  isLoading?: boolean;
  onDownload?: (fileId: string) => void;
  onDeleteConfirmed?: (fileId: string) => void;
  onAdd?: () => void;
  onActionClick?: (fileId: string) => void;
  title?: React.ReactNode;
  getDeleteWarningText?: (doc: DocumentTile) => string;
}

export default function TileView({
  documents,
  isLoading = false,
  onDownload,
  onDeleteConfirmed,
  onAdd,
  onActionClick,
  title = "Document Vault",
  getDeleteWarningText,
}: TileViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"tiles" | "list">("tiles");
  const [docToDelete, setDocToDelete] = useState<DocumentTile | null>(null);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  const filteredDocs = useMemo(() => {
    if (!searchQuery) return documents;
    return documents.filter((doc) =>
      doc.fileName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [documents, searchQuery]);

  const handleDeleteClick = (doc: DocumentTile) => {
    setDocToDelete(doc);
  };

  const confirmDelete = () => {
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
        onDeleteConfirmed(idToRemove);
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
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto mt-3 sm:mt-0">
          <div className="relative flex-1 sm:w-64">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full rounded-md border-0 py-2 pl-9 pr-3 text-zinc-900 ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm sm:leading-6 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700 dark:focus:ring-emerald-500"
            />
          </div>
          {onAdd && (
            <button
              onClick={onAdd}
              className="inline-flex items-center justify-center gap-x-1.5 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              <Plus className="-ml-0.5 h-4 w-4" />
              Add
            </button>
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
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {filteredDocs.map((doc) => {
                const isRemoving = removingIds.has(doc.id);
                const isImage = doc.fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                const isPdf = doc.fileName.match(/\.pdf$/i);

                return (
                  <div
                    key={doc.id}
                    onClick={() => onActionClick?.(doc.id)}
                    className={`group flex items-center justify-between gap-4 p-4 transition-all duration-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${onActionClick ? "cursor-pointer" : ""} ${
                      isRemoving ? "opacity-0 scale-y-95" : "opacity-100 scale-y-100"
                    }`}
                  >
                    <div className="flex flex-1 items-center gap-4 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                        {isImage ? (
                          <ImageIcon className="h-5 w-5 text-emerald-500" />
                        ) : isPdf ? (
                          <FileText className="h-5 w-5 text-red-500" />
                        ) : (
                          <File className="h-5 w-5 text-zinc-400" />
                        )}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100" title={doc.fileName}>
                          {doc.fileName}
                        </span>
                        <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                          {doc.linkedItemName ? (
                            <span className="text-emerald-600 dark:text-emerald-400">Linked to: {doc.linkedItemName}</span>
                          ) : (
                            "Standalone"
                          )}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onDownload?.(doc.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-emerald-600 dark:hover:bg-zinc-800 transition-colors"
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
              
              // Basic logic to determine icon based on extension if thumbnailUrl is missing
              const isImage = doc.fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i);
              const isPdf = doc.fileName.match(/\.pdf$/i);

              return (
                <div
                  key={doc.id}
                  onClick={() => onActionClick?.(doc.id)}
                  className={`group relative flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-all duration-300 hover:shadow-md hover:border-emerald-200 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-800 ${onActionClick ? "cursor-pointer" : ""} ${
                    isRemoving ? "opacity-0 scale-95" : "opacity-100 scale-100"
                  }`}
                >
                  {/* Thumbnail Area */}
                  <div className="relative flex h-32 w-full items-center justify-center bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800 overflow-hidden">
                    {doc.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={doc.thumbnailUrl} alt={doc.fileName} className="h-full w-full object-cover" />
                    ) : isImage ? (
                      <ImageIcon className="h-10 w-10 text-emerald-500/50" />
                    ) : isPdf ? (
                      <FileText className="h-10 w-10 text-red-500/50" />
                    ) : (
                      <File className="h-10 w-10 text-zinc-400/50" />
                    )}

                    {/* Overlay Actions */}
                    <div className="absolute inset-x-0 top-0 flex items-start justify-between p-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100 bg-gradient-to-b from-black/40 to-transparent">
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
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
                    <span 
                      className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100" 
                      title={doc.fileName}
                    >
                      {doc.fileName}
                    </span>
                    <span className="mt-0.5 truncate text-xs">
                      {doc.linkedItemName ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          Linked to: {doc.linkedItemName}
                        </span>
                      ) : (
                        <span className="text-zinc-500 dark:text-zinc-400">
                          Standalone
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {docToDelete && (
        <ConfirmDialog
          title="Delete document?"
          description={defaultGetDeleteWarningText(docToDelete)}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onConfirm={confirmDelete}
          onCancel={() => setDocToDelete(null)}
        />
      )}
    </div>
  );
}
