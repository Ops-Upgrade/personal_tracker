"use client";

import React, { useState, useEffect, useRef } from "react";
import { PanelLeftOpen } from "lucide-react";
import type { Editor } from "@tiptap/react";
import { useNotesData } from "@/hooks/useNotesData";
import { NotesProvider, useNotesStore } from "./useNotesStore";
import { useNotesRealtime } from "./useNotesRealtime";
import NotebookTree from "./NotebookTree";
import SectionPageList from "./SectionPageList";
import PageCanvas from "./PageCanvas";
import PageTabs from "./PageTabs";
import FormattingSidebar from "./FormattingSidebar";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import ErrorBanner from "@/components/common/ErrorBanner";
import { createNotebook, createSection, createPage } from "@/api/notes";
import { useLocalStorage } from "@/lib/useLocalStorage";

interface NotesViewProps {
  initialPageId?: string;
}

type LeftSidebarMode = "all" | "notebooks" | "closed";

function NotesViewContent({ userId }: { userId: string }) {
  const { state, dispatch, openPage } = useNotesStore();
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null);
  const lastActivePageIdRef = useRef<string | null>(null);

  // Drawing tool state
  const [penColor, setPenColor] = useState("#2563eb");
  const [penSize, setPenSize] = useState(3);

  // Left & right sidebar toggles stored in localStorage
  const [leftSidebarMode, setLeftSidebarMode] = useLocalStorage<LeftSidebarMode>(
    "notes_left_sidebar_mode",
    "all"
  );
  const [sidebarOpen, setSidebarOpen] = useLocalStorage<boolean>(
    "notes_formatting_sidebar_open",
    true
  );

  // Initialize realtime sync
  useNotesRealtime(userId);

  // Synchronize activeSectionId when activePageId changes or on initial load
  useEffect(() => {
    if (state.activePageId) {
      if (state.activePageId !== lastActivePageIdRef.current) {
        lastActivePageIdRef.current = state.activePageId;
        const page = state.tree.pages.find((p) => p.id === state.activePageId);
        if (page) {
          setActiveSectionId(page.section_id);
        }
      }
    } else {
      lastActivePageIdRef.current = null;
      if (!activeSectionId && state.tree.sections.length > 0) {
        setActiveSectionId(state.tree.sections[0].id);
      }
    }
  }, [state.activePageId, state.tree.pages, state.tree.sections, activeSectionId]);

  // Add floating text shortcut
  const handleAddFloatingText = () => {
    if (!state.activePageId) return;
    const pageId = state.activePageId;
    const current = state.pageContents.get(pageId)?.content;

    const newBlock = {
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
      type: "text" as const,
      role: "floating" as const,
      x: 120,
      y: 160,
      w: 240,
      h: 120,
      z: (current?.blocks.length || 0) + 1,
      html: "",
    };

    dispatch({
      type: "MUTATE_PAGE_CONTENT",
      payload: {
        pageId,
        mutator: (prev) => ({
          ...prev,
          blocks: [...prev.blocks, newBlock],
        }),
      },
    });

    dispatch({
      type: "SET_SELECTION",
      payload: { kind: "text", blockId: newBlock.id },
    });
  };

  // Add image trigger shortcut
  const handleAddImageClick = () => {
    const input = document.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement;
    if (input) input.click();
  };

  // Progressive left sidebar collapse handler:
  // 1st click closes pages sidebar; 2nd click closes notebooks sidebar
  const handleLeftSidebarCollapse = () => {
    if (leftSidebarMode === "all") {
      setLeftSidebarMode("notebooks");
    } else if (leftSidebarMode === "notebooks") {
      setLeftSidebarMode("closed");
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full overflow-hidden bg-white dark:bg-zinc-950">
      {/* 1. Left Sidebar: Notebooks, Sections & Pages */}
      {leftSidebarMode !== "closed" ? (
        <div className="relative flex shrink-0 border-r border-zinc-200 dark:border-zinc-800">
          <NotebookTree
            userId={userId}
            activeSectionId={activeSectionId}
            onSelectSection={(id) => {
              setActiveSectionId(id);
              if (leftSidebarMode === "notebooks") {
                setLeftSidebarMode("all");
              }
            }}
            onCollapse={handleLeftSidebarCollapse}
            isPagesCollapsed={leftSidebarMode === "notebooks"}
          />
          {leftSidebarMode === "all" && (
            <SectionPageList
              userId={userId}
              activeSectionId={activeSectionId}
            />
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setLeftSidebarMode("all")}
          title="Open left sidebar"
          className="fixed left-3 top-20 z-30 flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-white shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        >
          <PanelLeftOpen className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
        </button>
      )}

      {/* 2. Main Editor & Canvas Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {state.panes.length === 1 ? (
          // Single pane layout
          <div className="flex flex-1 flex-col overflow-hidden">
            <PageTabs paneIndex={0} userId={userId} activeSectionId={activeSectionId} />
            <div className="flex-1 overflow-hidden">
              <PageCanvas
                userId={userId}
                pageId={state.panes[0]?.activePageId || null}
                paneIndex={0}
                penColor={penColor}
                penSize={penSize}
                onActiveEditorChange={setActiveEditor}
              />
            </div>
          </div>
        ) : (
          // Two-pane split layout
          <div className="flex flex-1 overflow-hidden">
            <div className="flex flex-1 flex-col border-r border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <PageTabs paneIndex={0} userId={userId} activeSectionId={activeSectionId} />
              <div className="flex-1 overflow-hidden">
                <PageCanvas
                  userId={userId}
                  pageId={state.panes[0]?.activePageId || null}
                  paneIndex={0}
                  penColor={penColor}
                  penSize={penSize}
                  onActiveEditorChange={setActiveEditor}
                />
              </div>
            </div>
            <div className="flex flex-1 flex-col overflow-hidden">
              <PageTabs paneIndex={1} userId={userId} activeSectionId={activeSectionId} />
              <div className="flex-1 overflow-hidden">
                <PageCanvas
                  userId={userId}
                  pageId={state.panes[1]?.activePageId || null}
                  paneIndex={1}
                  penColor={penColor}
                  penSize={penSize}
                  onActiveEditorChange={setActiveEditor}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Right Tools / Formatting Sidebar */}
      <FormattingSidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        penColor={penColor}
        onChangePenColor={setPenColor}
        penSize={penSize}
        onChangePenSize={setPenSize}
        onAddFloatingText={handleAddFloatingText}
        onAddImageClick={handleAddImageClick}
        activeEditor={activeEditor}
      />
    </div>
  );
}

export default function NotesView({ initialPageId }: NotesViewProps) {
  const {
    userId,
    notebooks,
    sections,
    pages,
    isLoading,
    error,
    refreshData,
    setNotebooks,
    setSections,
    setPages,
  } = useNotesData();

  const [bootstrapped, setBootstrapped] = useState(false);

  // First-run auto-creation: if no notebooks exist, create initial hierarchy
  useEffect(() => {
    if (isLoading || bootstrapped || !userId) return;

    async function ensureInitialData() {
      if (notebooks.length === 0) {
        try {
          const nowIso = new Date().toISOString();
          const nb = await createNotebook(userId, {
            name: "My Notebook",
            order: 0,
            updated_at: nowIso,
          });
          const sec = await createSection(userId, {
            notebook_id: nb.id,
            name: "General",
            order: 0,
            color: "#3b82f6",
            updated_at: nowIso,
          });
          const page = await createPage(userId, {
            section_id: sec.id,
            title: "Welcome to Notes",
            order: 0,
            tags: ["welcome"],
            image_ids: [],
            created_at: nowIso,
            updated_at: nowIso,
          });

          setNotebooks([nb]);
          setSections([sec]);
          setPages([page]);
        } catch (err) {
          console.error("Failed to create default notes hierarchy:", err);
        }
      }
      setBootstrapped(true);
    }

    ensureInitialData();
  }, [isLoading, bootstrapped, userId, notebooks.length, setNotebooks, setSections, setPages]);

  if (isLoading && !bootstrapped) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <ErrorBanner
          message={error}
          onRetry={() => {
            if (userId) refreshData(userId);
          }}
        />
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <NotesProvider
      initialTree={{ notebooks, sections, pages }}
      initialPageId={initialPageId || pages[0]?.id}
    >
      <NotesViewContent userId={userId} />
    </NotesProvider>
  );
}
