"use client";

import React, { useState, useMemo } from "react";
import {
  Plus,
  Search,
  FileText,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { useNotesStore } from "./useNotesStore";
import {
  createPage,
  updatePageMeta,
  deletePage,
  reorderPages,
} from "@/api/notes";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import type { Page } from "@/types/notes";

interface SectionPageListProps {
  userId: string;
  activeSectionId: string | null;
}

export default function SectionPageList({
  userId,
  activeSectionId,
}: SectionPageListProps) {
  const { state, dispatch, openPage } = useNotesStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [pageToDelete, setPageToDelete] = useState<Page | null>(null);

  // Filter pages belonging to active section
  const sectionPages = useMemo(() => {
    if (!activeSectionId) return [];
    return state.tree.pages
      .filter((p) => p.section_id === activeSectionId)
      .sort((a, b) => a.order - b.order);
  }, [state.tree.pages, activeSectionId]);

  // Apply search query
  const filteredPages = useMemo(() => {
    if (!searchQuery.trim()) return sectionPages;
    const q = searchQuery.toLowerCase();
    return sectionPages.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.tags?.some((t) => t.toLowerCase().includes(q))
    );
  }, [sectionPages, searchQuery]);

  const activeSection = useMemo(() => {
    return state.tree.sections.find((s) => s.id === activeSectionId);
  }, [state.tree.sections, activeSectionId]);

  // Create new page in this section
  const handleCreatePage = async () => {
    if (!userId || !activeSectionId) return;

    try {
      const nowIso = new Date().toISOString();
      const newPage = await createPage(userId, {
        section_id: activeSectionId,
        title: "Untitled Page",
        order: sectionPages.length,
        tags: [],
        image_ids: [],
        created_at: nowIso,
        updated_at: nowIso,
      });

      dispatch({
        type: "SET_TREE",
        payload: {
          pages: [...state.tree.pages, newPage],
        },
      });

      openPage(newPage.id);
    } catch (err) {
      console.error("Failed to create note page:", err);
    }
  };

  // Rename page
  const handleSaveRename = async (page: Page) => {
    if (!userId) return;
    const title = editingTitle.trim() || page.title;
    setEditingPageId(null);

    if (title === page.title) return;

    try {
      const updated = await updatePageMeta(userId, page.id, {
        ...page,
        title,
      });

      dispatch({
        type: "SET_TREE",
        payload: {
          pages: state.tree.pages.map((p) => (p.id === page.id ? updated : p)),
        },
      });
    } catch (err) {
      console.error("Failed to rename note page:", err);
    }
  };

  // Delete page
  const handleConfirmDelete = async () => {
    if (!userId || !pageToDelete) return;

    try {
      await deletePage(userId, pageToDelete.id);

      dispatch({
        type: "SET_TREE",
        payload: {
          pages: state.tree.pages.filter((p) => p.id !== pageToDelete.id),
        },
      });

      // Close tab in all panes
      state.panes.forEach((pane, paneIdx) => {
        if (pane.tabs.includes(pageToDelete.id)) {
          dispatch({
            type: "CLOSE_TAB",
            payload: { paneIndex: paneIdx, pageId: pageToDelete.id },
          });
        }
      });

      setPageToDelete(null);
    } catch (err) {
      console.error("Failed to delete note page:", err);
    }
  };

  // Move page up/down
  const handleMovePage = async (pageId: string, direction: "up" | "down") => {
    if (!userId) return;
    const index = sectionPages.findIndex((p) => p.id === pageId);
    if (index === -1) return;
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === sectionPages.length - 1) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const reordered = [...sectionPages];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    const orderedIds = reordered.map((p) => p.id);
    try {
      await reorderPages(userId, orderedIds);
      const updatedPages = state.tree.pages.map((p) => {
        const newOrder = orderedIds.indexOf(p.id);
        return newOrder !== -1 ? { ...p, order: newOrder } : p;
      });
      dispatch({ type: "SET_TREE", payload: { pages: updatedPages } });
    } catch (err) {
      console.error("Failed to reorder note pages:", err);
    }
  };

  if (!activeSectionId) {
    return (
      <div className="flex h-full w-60 shrink-0 flex-col items-center justify-center border-r border-zinc-200 bg-zinc-50/50 p-4 text-center text-xs text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950/50 select-none">
        Select a section to view pages
      </div>
    );
  }

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50/50 text-xs dark:border-zinc-800 dark:bg-zinc-950/50">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 p-3 dark:border-zinc-800">
        <div className="flex items-center gap-1.5 truncate">
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: activeSection?.color || "#3b82f6" }}
          />
          <h2 className="font-semibold text-zinc-900 truncate dark:text-zinc-100">
            {activeSection?.name || "Section"}
          </h2>
          <span className="text-[10px] text-zinc-400">({sectionPages.length})</span>
        </div>
        <button
          type="button"
          onClick={handleCreatePage}
          title="New Page"
          className="flex h-6 w-6 items-center justify-center rounded-md bg-white text-zinc-600 shadow-sm hover:bg-zinc-100 hover:text-zinc-900 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Search Input */}
      <div className="p-2 border-b border-zinc-200 dark:border-zinc-800">
        <div className="relative flex items-center">
          <Search className="absolute left-2 h-3.5 w-3.5 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search pages..."
            className="w-full rounded-md border border-zinc-200 bg-white py-1.5 pl-7 pr-2 text-xs text-zinc-800 placeholder-zinc-400 focus:border-blue-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
          />
        </div>
      </div>

      {/* Page List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredPages.length === 0 ? (
          <div className="p-4 text-center text-zinc-400 text-[11px]">
            No pages found in this section.
          </div>
        ) : (
          filteredPages.map((page, idx) => {
            const isActive = state.activePageId === page.id;
            const isEditing = editingPageId === page.id;

            return (
              <div
                key={page.id}
                onClick={() => openPage(page.id)}
                className={`group flex items-center justify-between rounded-lg px-2.5 py-2 cursor-pointer transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-900 font-medium dark:bg-blue-950/40 dark:text-blue-200"
                    : "text-zinc-700 hover:bg-zinc-100/80 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
                }`}
              >
                <div className="flex items-center gap-2 truncate flex-1 mr-1">
                  <FileText className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  {isEditing ? (
                    <input
                      type="text"
                      autoFocus
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={() => handleSaveRename(page)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveRename(page);
                        if (e.key === "Escape") setEditingPageId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full rounded border border-blue-400 bg-white px-1 py-0.5 text-xs text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  ) : (
                    <span
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingPageId(page.id);
                        setEditingTitle(page.title);
                      }}
                      className="truncate"
                    >
                      {page.title || "Untitled"}
                    </span>
                  )}
                </div>

                {/* Hover actions */}
                <div
                  className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => handleMovePage(page.id, "up")}
                    className="rounded p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-30"
                    title="Move up"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === filteredPages.length - 1}
                    onClick={() => handleMovePage(page.id, "down")}
                    className="rounded p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-30"
                    title="Move down"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPageId(page.id);
                      setEditingTitle(page.title);
                    }}
                    className="rounded p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    title="Rename"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPageToDelete(page)}
                    className="rounded p-0.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-950/40"
                    title="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {pageToDelete && (
        <ConfirmDialog
          title="Delete Page"
          description={`Are you sure you want to delete "${pageToDelete.title}"? All canvas blocks and drawing strokes on this page will be permanently removed.`}
          confirmLabel="Delete Page"
          onConfirm={handleConfirmDelete}
          onCancel={() => setPageToDelete(null)}
        />
      )}
    </div>
  );
}
