"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  Search,
  Archive,
  Book,
  MoreVertical,
  ChevronUp,
  PanelLeftClose,
} from "lucide-react";
import { useNotesStore } from "./useNotesStore";
import {
  createNotebook,
  updateNotebook,
  deleteNotebook,
  reorderNotebooks,
  createSection,
  updateSection,
  deleteSection,
  reorderSections,
} from "@/api/notes";
import { ROUTES } from "@/routes/paths";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { useLocalStorage } from "@/lib/useLocalStorage";
import type { Notebook, Section } from "@/types/notes";

interface NotebookTreeProps {
  userId: string;
  activeSectionId: string | null;
  onSelectSection: (sectionId: string) => void;
  onCollapse?: () => void;
  isPagesCollapsed?: boolean;
}

const SECTION_COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
];

export default function NotebookTree({
  userId,
  activeSectionId,
  onSelectSection,
  onCollapse,
  isPagesCollapsed,
}: NotebookTreeProps) {
  const { state, dispatch, openPage } = useNotesStore();

  // Collapsed notebook IDs stored in localStorage
  const [collapsedNotebooks, setCollapsedNotebooks] = useLocalStorage<string[]>(
    "notes_collapsed_notebooks",
    []
  );

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Edit / Delete dialog states
  const [editingItem, setEditingItem] = useState<{
    type: "notebook" | "section";
    id: string;
    name: string;
  } | null>(null);

  const [itemToDelete, setItemToDelete] = useState<{
    type: "notebook" | "section";
    id: string;
    name: string;
    childCount: number;
  } | null>(null);

  // Toggle collapse state
  const toggleCollapse = (notebookId: string) => {
    setCollapsedNotebooks((prev) =>
      prev.includes(notebookId)
        ? prev.filter((id) => id !== notebookId)
        : [...prev, notebookId]
    );
  };

  // Group sections by notebook_id
  const sectionsByNotebook = useMemo(() => {
    const map = new Map<string, Section[]>();
    for (const sec of state.tree.sections) {
      const list = map.get(sec.notebook_id) || [];
      list.push(sec);
      map.set(sec.notebook_id, list);
    }
    // Sort each list by order
    for (const [key, list] of map.entries()) {
      map.set(key, list.sort((a, b) => a.order - b.order));
    }
    return map;
  }, [state.tree.sections]);

  // Client-side search across all page titles
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return state.tree.pages.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.tags?.some((t) => t.toLowerCase().includes(q))
    );
  }, [state.tree.pages, searchQuery]);

  // Add notebook
  const handleAddNotebook = async () => {
    if (!userId) return;
    try {
      const newNb = await createNotebook(userId, {
        name: "New Notebook",
        order: state.tree.notebooks.length,
        updated_at: new Date().toISOString(),
      });
      dispatch({
        type: "SET_TREE",
        payload: {
          notebooks: [...state.tree.notebooks, newNb],
        },
      });
      setEditingItem({
        type: "notebook",
        id: newNb.id,
        name: newNb.name,
      });
    } catch (err) {
      console.error("Failed to create notebook:", err);
    }
  };

  // Add section to notebook
  const handleAddSection = async (notebookId: string) => {
    if (!userId) return;
    try {
      const existing = sectionsByNotebook.get(notebookId) || [];
      const color = SECTION_COLORS[existing.length % SECTION_COLORS.length];
      const newSec = await createSection(userId, {
        notebook_id: notebookId,
        name: "New Section",
        order: existing.length,
        color,
        updated_at: new Date().toISOString(),
      });

      dispatch({
        type: "SET_TREE",
        payload: {
          sections: [...state.tree.sections, newSec],
        },
      });

      // Expand notebook if collapsed
      if (collapsedNotebooks.includes(notebookId)) {
        toggleCollapse(notebookId);
      }

      onSelectSection(newSec.id);
      setEditingItem({
        type: "section",
        id: newSec.id,
        name: newSec.name,
      });
    } catch (err) {
      console.error("Failed to create section:", err);
    }
  };

  // Save rename
  const handleSaveRename = async () => {
    if (!userId || !editingItem) return;
    const name = editingItem.name.trim();
    if (!name) {
      setEditingItem(null);
      return;
    }

    try {
      if (editingItem.type === "notebook") {
        const nb = state.tree.notebooks.find((n) => n.id === editingItem.id);
        if (nb) {
          const updated = await updateNotebook(userId, nb.id, { ...nb, name });
          dispatch({
            type: "SET_TREE",
            payload: {
              notebooks: state.tree.notebooks.map((n) =>
                n.id === nb.id ? updated : n
              ),
            },
          });
        }
      } else {
        const sec = state.tree.sections.find((s) => s.id === editingItem.id);
        if (sec) {
          const updated = await updateSection(userId, sec.id, { ...sec, name });
          dispatch({
            type: "SET_TREE",
            payload: {
              sections: state.tree.sections.map((s) =>
                s.id === sec.id ? updated : s
              ),
            },
          });
        }
      }
    } catch (err) {
      console.error("Failed to save rename:", err);
    } finally {
      setEditingItem(null);
    }
  };

  // Confirm delete
  const handleConfirmDelete = async () => {
    if (!userId || !itemToDelete) return;

    try {
      if (itemToDelete.type === "notebook") {
        await deleteNotebook(userId, itemToDelete.id);
        // Find deleted sections & pages
        const deletedSections = state.tree.sections.filter(
          (s) => s.notebook_id === itemToDelete.id
        );
        const deletedSectionIds = new Set(deletedSections.map((s) => s.id));
        const deletedPages = state.tree.pages.filter((p) =>
          deletedSectionIds.has(p.section_id)
        );

        dispatch({
          type: "SET_TREE",
          payload: {
            notebooks: state.tree.notebooks.filter(
              (n) => n.id !== itemToDelete.id
            ),
            sections: state.tree.sections.filter(
              (s) => s.notebook_id !== itemToDelete.id
            ),
            pages: state.tree.pages.filter(
              (p) => !deletedSectionIds.has(p.section_id)
            ),
          },
        });

        // Close tabs for any deleted pages
        deletedPages.forEach((p) => {
          state.panes.forEach((pane, paneIdx) => {
            if (pane.tabs.includes(p.id)) {
              dispatch({
                type: "CLOSE_TAB",
                payload: { paneIndex: paneIdx, pageId: p.id },
              });
            }
          });
        });

        if (deletedSectionIds.has(activeSectionId || "")) {
          onSelectSection("");
        }
      } else {
        await deleteSection(userId, itemToDelete.id);
        const deletedPages = state.tree.pages.filter(
          (p) => p.section_id === itemToDelete.id
        );

        dispatch({
          type: "SET_TREE",
          payload: {
            sections: state.tree.sections.filter(
              (s) => s.id !== itemToDelete.id
            ),
            pages: state.tree.pages.filter(
              (p) => p.section_id !== itemToDelete.id
            ),
          },
        });

        deletedPages.forEach((p) => {
          state.panes.forEach((pane, paneIdx) => {
            if (pane.tabs.includes(p.id)) {
              dispatch({
                type: "CLOSE_TAB",
                payload: { paneIndex: paneIdx, pageId: p.id },
              });
            }
          });
        });

        if (activeSectionId === itemToDelete.id) {
          onSelectSection("");
        }
      }
    } catch (err) {
      console.error("Failed to delete item:", err);
    } finally {
      setItemToDelete(null);
    }
  };

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-900 select-none">
      {/* Search Bar & Sidebar Controls */}
      <div className="relative mb-3 flex items-center gap-1.5">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search all notes..."
            className="w-full rounded-lg border border-zinc-200 bg-white py-1.5 pl-8 pr-3 text-xs text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            title={isPagesCollapsed ? "Collapse notebooks & sections" : "Collapse pages sidebar"}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 shadow-sm hover:bg-zinc-100 hover:text-zinc-800 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
          >
            <PanelLeftClose className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* If searching, display search results */}
      {searchQuery.trim() ? (
        <div className="flex-1 overflow-y-auto space-y-1">
          <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-1">
            Search Results ({searchResults.length})
          </span>
          {searchResults.length === 0 ? (
            <div className="p-3 text-center text-zinc-400">No matching notes</div>
          ) : (
            searchResults.map((page) => (
              <div
                key={page.id}
                onClick={() => {
                  onSelectSection(page.section_id);
                  openPage(page.id);
                }}
                className="flex items-center gap-2 rounded-lg p-2 hover:bg-zinc-200/60 cursor-pointer dark:hover:bg-zinc-800/60"
              >
                <Book className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                <span className="truncate font-medium text-zinc-800 dark:text-zinc-200">
                  {page.title}
                </span>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Notebooks & Sections tree */
        <div className="flex-1 overflow-y-auto space-y-2">
          <div className="flex items-center justify-between px-1 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            <span>Notebooks</span>
            <button
              type="button"
              onClick={handleAddNotebook}
              title="Add Notebook"
              className="rounded p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {state.tree.notebooks.map((nb) => {
            const isCollapsed = collapsedNotebooks.includes(nb.id);
            const sections = sectionsByNotebook.get(nb.id) || [];
            const isEditing = editingItem?.id === nb.id;

            return (
              <div key={nb.id} className="space-y-1">
                {/* Notebook Row */}
                <div className="group flex items-center justify-between rounded-lg px-2 py-1.5 text-zinc-800 hover:bg-zinc-200/60 dark:text-zinc-200 dark:hover:bg-zinc-800/60">
                  <div
                    className="flex items-center gap-1.5 truncate flex-1 cursor-pointer"
                    onClick={() => toggleCollapse(nb.id)}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                    )}
                    {isCollapsed ? (
                      <Folder className="h-4 w-4 shrink-0 text-amber-500" />
                    ) : (
                      <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
                    )}

                    {isEditing ? (
                      <input
                        type="text"
                        autoFocus
                        value={editingItem.name}
                        onChange={(e) =>
                          setEditingItem({ ...editingItem, name: e.target.value })
                        }
                        onBlur={handleSaveRename}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveRename();
                          if (e.key === "Escape") setEditingItem(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full rounded border border-blue-400 bg-white px-1 py-0.5 text-xs text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                    ) : (
                      <span className="truncate font-semibold">{nb.name}</span>
                    )}
                  </div>

                  {/* Notebook Actions */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddSection(nb.id);
                      }}
                      title="Add Section"
                      className="rounded p-1 hover:bg-zinc-300 dark:hover:bg-zinc-700"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingItem({
                          type: "notebook",
                          id: nb.id,
                          name: nb.name,
                        });
                      }}
                      title="Rename Notebook"
                      className="rounded p-1 hover:bg-zinc-300 dark:hover:bg-zinc-700"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setItemToDelete({
                          type: "notebook",
                          id: nb.id,
                          name: nb.name,
                          childCount: sections.length,
                        });
                      }}
                      title="Delete Notebook"
                      className="rounded p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Sections List */}
                {!isCollapsed && (
                  <div className="ml-5 pl-2 border-l border-zinc-200 dark:border-zinc-800 space-y-0.5">
                    {sections.length === 0 ? (
                      <div className="py-1 text-[11px] text-zinc-400 italic">
                        No sections
                      </div>
                    ) : (
                      sections.map((sec) => {
                        const isSecActive = activeSectionId === sec.id;
                        const isSecEditing = editingItem?.id === sec.id;

                        return (
                          <div
                            key={sec.id}
                            onClick={() => onSelectSection(sec.id)}
                            className={`group flex items-center justify-between rounded-md px-2 py-1.5 cursor-pointer transition-colors ${
                              isSecActive
                                ? "bg-blue-100/70 font-medium text-blue-900 dark:bg-blue-950/50 dark:text-blue-200"
                                : "text-zinc-600 hover:bg-zinc-200/50 dark:text-zinc-400 dark:hover:bg-zinc-800/50"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 truncate flex-1">
                              <span
                                className="h-2 w-2 rounded-full shrink-0"
                                style={{ backgroundColor: sec.color || "#3b82f6" }}
                              />
                              {isSecEditing ? (
                                <input
                                  type="text"
                                  autoFocus
                                  value={editingItem.name}
                                  onChange={(e) =>
                                    setEditingItem({
                                      ...editingItem,
                                      name: e.target.value,
                                    })
                                  }
                                  onBlur={handleSaveRename}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSaveRename();
                                    if (e.key === "Escape") setEditingItem(null);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full rounded border border-blue-400 bg-white px-1 py-0.5 text-xs text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                                />
                              ) : (
                                <span className="truncate">{sec.name}</span>
                              )}
                            </div>

                            {/* Section actions */}
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingItem({
                                    type: "section",
                                    id: sec.id,
                                    name: sec.name,
                                  });
                                }}
                                title="Rename Section"
                                className="rounded p-0.5 hover:bg-zinc-300 dark:hover:bg-zinc-700"
                              >
                                <Pencil className="h-2.5 w-2.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setItemToDelete({
                                    type: "section",
                                    id: sec.id,
                                    name: sec.name,
                                    childCount: 0,
                                  });
                                }}
                                title="Delete Section"
                                className="rounded p-0.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-950/40"
                              >
                                <Trash2 className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer Link: Notes Store */}
      <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <Link
          href={ROUTES.NOTES_STORE}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white py-2 font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
        >
          <Archive className="h-3.5 w-3.5 text-zinc-500" />
          Notes Store
        </Link>
      </div>

      {/* Delete Confirmation Dialog */}
      {itemToDelete && (
        <ConfirmDialog
          title={`Delete ${itemToDelete.type === "notebook" ? "Notebook" : "Section"}`}
          description={`Are you sure you want to delete "${itemToDelete.name}"? ${
            itemToDelete.type === "notebook"
              ? "This will permanently delete all its sections, pages, canvas content, and attached files."
              : "This will permanently delete all its pages, canvas content, and attached files."
          }`}
          confirmLabel={`Delete ${itemToDelete.type === "notebook" ? "Notebook" : "Section"}`}
          onConfirm={handleConfirmDelete}
          onCancel={() => setItemToDelete(null)}
        />
      )}
    </div>
  );
}
