"use client";

import React from "react";
import { X, Columns, Minimize2, FileText, Plus } from "lucide-react";
import { useNotesStore } from "./useNotesStore";
import { createPage } from "@/api/notes";

interface PageTabsProps {
  paneIndex: number;
  userId: string;
  activeSectionId?: string | null;
}

export default function PageTabs({
  paneIndex,
  userId,
  activeSectionId,
}: PageTabsProps) {
  const { state, dispatch, openPage } = useNotesStore();
  const pane = state.panes[paneIndex];
  if (!pane) return null;

  const pageMap = new Map(state.tree.pages.map((p) => [p.id, p]));

  const handleCreatePage = async () => {
    if (!userId) return;
    const activePage = pageMap.get(pane.activePageId || "");
    const targetSectionId =
      activeSectionId ||
      activePage?.section_id ||
      (state.tree.sections.length > 0 ? state.tree.sections[0].id : null);

    if (!targetSectionId) return;

    try {
      const nowIso = new Date().toISOString();
      const existingPages = state.tree.pages.filter(
        (p) => p.section_id === targetSectionId
      );
      const newPage = await createPage(userId, {
        section_id: targetSectionId,
        title: "Untitled Page",
        order: existingPages.length,
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

      openPage(newPage.id, undefined, paneIndex);
    } catch (err) {
      console.error("Failed to create new page from tab bar:", err);
    }
  };

  return (
    <div className="flex h-10 w-full items-center justify-between border-b border-zinc-200 bg-zinc-100/80 px-2 text-xs dark:border-zinc-800 dark:bg-zinc-900/80 select-none">
      {/* Scrollable tab list */}
      <div className="flex flex-1 items-center gap-1 overflow-x-auto no-scrollbar">
        {pane.tabs.map((pageId) => {
          const page = pageMap.get(pageId);
          const title = page?.title || "Untitled";
          const isActive = pane.activePageId === pageId;

          return (
            <div
              key={pageId}
              onClick={() => openPage(pageId, undefined, paneIndex)}
              className={`group flex h-8 max-w-[180px] shrink-0 cursor-pointer items-center gap-1.5 rounded-t-md px-3 font-medium transition-colors ${
                isActive
                  ? "border-b-2 border-blue-600 bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-300"
              }`}
            >
              <FileText className="h-3.5 w-3.5 shrink-0 opacity-60" />
              <span className="truncate">{title}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({
                    type: "CLOSE_TAB",
                    payload: { paneIndex, pageId },
                  });
                }}
                className="ml-1 rounded p-0.5 opacity-0 hover:bg-zinc-200 group-hover:opacity-100 dark:hover:bg-zinc-700"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}

        {/* Plus button to add a new page */}
        <button
          type="button"
          onClick={handleCreatePage}
          title="New Page"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Pane controls & Sync Status */}
      <div className="flex items-center gap-2 pl-2">
        {/* Sync Status Pill */}
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
          <span
            className={`h-2 w-2 rounded-full ${
              state.syncStatus === "saved"
                ? "bg-emerald-500"
                : state.syncStatus === "syncing"
                ? "bg-amber-500 animate-pulse"
                : "bg-red-500"
            }`}
          />
          <span className="capitalize">{state.syncStatus}</span>
        </div>

        {/* Split / Close Split Button */}
        {state.panes.length === 1 ? (
          <button
            type="button"
            onClick={() => dispatch({ type: "SPLIT_PANE", payload: {} })}
            title="Split editor right"
            className="flex h-7 items-center gap-1 rounded border border-zinc-200 bg-white px-2 text-zinc-600 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            <Columns className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Split</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => dispatch({ type: "CLOSE_PANE", payload: paneIndex })}
            title="Close this pane split"
            className="flex h-7 items-center gap-1 rounded border border-zinc-200 bg-white px-2 text-zinc-600 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            <Minimize2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Close</span>
          </button>
        )}
      </div>
    </div>
  );
}
