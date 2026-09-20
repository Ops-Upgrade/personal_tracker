"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useMemo,
  type ReactNode,
} from "react";
import type {
  Notebook,
  Section,
  Page,
  PageContent,
  CanvasBlock,
} from "@/types/notes";

export interface NoteTree {
  notebooks: Notebook[];
  sections: Section[];
  pages: Page[];
}

export interface PaneState {
  tabs: string[]; // page IDs
  activePageId: string;
}

export type PointerTool = "default" | "textbox" | "pen" | "eraser";

export interface SelectionState {
  kind: "text" | "image" | "none";
  blockId?: string;
}

export type SyncStatus = "saved" | "syncing" | "offline";

export interface PageContentState {
  content: PageContent;
  dirty: boolean | "conflicted";
  lastSyncedRevision: number;
}

export interface NotesState {
  tree: NoteTree;
  activePageId: string | null;
  panes: PaneState[];
  focusedPaneIndex: number;
  pageContents: Map<string, PageContentState>;
  selection: SelectionState;
  pointerTool: PointerTool;
  syncStatus: SyncStatus;
}

export type NotesAction =
  | { type: "SET_TREE"; payload: Partial<NoteTree> }
  | {
      type: "OPEN_PAGE";
      payload: {
        pageId: string;
        content?: PageContent;
        paneIndex?: number;
      };
    }
  | {
      type: "CLOSE_TAB";
      payload: {
        paneIndex: number;
        pageId: string;
      };
    }
  | { type: "SET_FOCUSED_PANE"; payload: number }
  | { type: "SPLIT_PANE"; payload: { pageId?: string } }
  | { type: "CLOSE_PANE"; payload: number }
  | { type: "SET_SELECTION"; payload: SelectionState }
  | { type: "SET_POINTER_TOOL"; payload: PointerTool }
  | { type: "SET_SYNC_STATUS"; payload: SyncStatus }
  | {
      type: "SET_PAGE_CONTENT";
      payload: {
        pageId: string;
        content: PageContent;
        dirty?: boolean | "conflicted";
        lastSyncedRevision?: number;
      };
    }
  | {
      type: "MUTATE_PAGE_CONTENT";
      payload: {
        pageId: string;
        mutator: (content: PageContent) => PageContent;
      };
    }
  | {
      type: "SET_PAGE_DIRTY";
      payload: {
        pageId: string;
        dirty: boolean | "conflicted";
      };
    };

function notesReducer(state: NotesState, action: NotesAction): NotesState {
  switch (action.type) {
    case "SET_TREE": {
      return {
        ...state,
        tree: {
          notebooks: action.payload.notebooks ?? state.tree.notebooks,
          sections: action.payload.sections ?? state.tree.sections,
          pages: action.payload.pages ?? state.tree.pages,
        },
      };
    }

    case "OPEN_PAGE": {
      const { pageId, content, paneIndex } = action.payload;
      const targetPaneIndex =
        typeof paneIndex === "number" && paneIndex < state.panes.length
          ? paneIndex
          : state.focusedPaneIndex;

      // Update panes
      const newPanes = state.panes.map((pane, idx) => {
        if (idx !== targetPaneIndex) return pane;
        const exists = pane.tabs.includes(pageId);
        const tabs = exists ? pane.tabs : [...pane.tabs, pageId];
        return {
          ...pane,
          tabs,
          activePageId: pageId,
        };
      });

      // Update pageContents if provided
      const newPageContents = new Map(state.pageContents);
      let activeContent = content || state.pageContents.get(pageId)?.content;
      if (content) {
        const existing = newPageContents.get(pageId);
        newPageContents.set(pageId, {
          content,
          dirty: existing?.dirty ?? false,
          lastSyncedRevision: content.revision,
        });
        activeContent = content;
      }

      // Identify the flow block (or first block) to mount and focus immediately
      let flowBlockId: string | undefined;
      if (activeContent?.blocks) {
        const flow = activeContent.blocks.find(
          (b) => b.type === "text" && b.role === "flow"
        );
        flowBlockId = flow ? flow.id : activeContent.blocks[0]?.id;
      }

      return {
        ...state,
        activePageId: pageId,
        panes: newPanes,
        focusedPaneIndex: targetPaneIndex,
        pageContents: newPageContents,
        selection: flowBlockId
          ? { kind: "text", blockId: flowBlockId }
          : { kind: "none" },
      };
    }

    case "CLOSE_TAB": {
      const { paneIndex, pageId } = action.payload;
      const pane = state.panes[paneIndex];
      if (!pane) return state;

      const newTabs = pane.tabs.filter((id) => id !== pageId);
      let newActiveId = pane.activePageId;
      if (pane.activePageId === pageId) {
        const closedIdx = pane.tabs.indexOf(pageId);
        newActiveId =
          newTabs[closedIdx] || newTabs[closedIdx - 1] || newTabs[0] || "";
      }

      const newPanes = state.panes.map((p, idx) => {
        if (idx !== paneIndex) return p;
        return {
          ...p,
          tabs: newTabs,
          activePageId: newActiveId,
        };
      });

      const currentActive =
        paneIndex === state.focusedPaneIndex ? newActiveId : state.activePageId;

      return {
        ...state,
        panes: newPanes,
        activePageId: currentActive || null,
      };
    }

    case "SET_FOCUSED_PANE": {
      const idx = action.payload;
      const targetPane = state.panes[idx];
      return {
        ...state,
        focusedPaneIndex: idx,
        activePageId: targetPane?.activePageId || state.activePageId,
      };
    }

    case "SPLIT_PANE": {
      if (state.panes.length >= 2) return state;
      const newPageId =
        action.payload.pageId || state.activePageId || (state.tree.pages[0]?.id ?? "");
      const newPane: PaneState = {
        tabs: newPageId ? [newPageId] : [],
        activePageId: newPageId,
      };
      return {
        ...state,
        panes: [...state.panes, newPane],
        focusedPaneIndex: 1,
      };
    }

    case "CLOSE_PANE": {
      if (state.panes.length <= 1) return state;
      const keepIndex = action.payload === 0 ? 1 : 0;
      const remainingPane = state.panes[keepIndex];
      return {
        ...state,
        panes: [remainingPane],
        focusedPaneIndex: 0,
        activePageId: remainingPane.activePageId,
      };
    }

    case "SET_SELECTION": {
      return {
        ...state,
        selection: action.payload,
      };
    }

    case "SET_POINTER_TOOL": {
      return {
        ...state,
        pointerTool: action.payload,
      };
    }

    case "SET_SYNC_STATUS": {
      return {
        ...state,
        syncStatus: action.payload,
      };
    }

    case "SET_PAGE_CONTENT": {
      const { pageId, content, dirty, lastSyncedRevision } = action.payload;
      const newMap = new Map(state.pageContents);
      const prev = newMap.get(pageId);
      newMap.set(pageId, {
        content,
        dirty: dirty !== undefined ? dirty : (prev?.dirty ?? false),
        lastSyncedRevision:
          lastSyncedRevision !== undefined
            ? lastSyncedRevision
            : (prev?.lastSyncedRevision ?? content.revision),
      });

      return {
        ...state,
        pageContents: newMap,
      };
    }

    case "MUTATE_PAGE_CONTENT": {
      const { pageId, mutator } = action.payload;
      const current = state.pageContents.get(pageId);
      if (!current) return state;

      const updatedContent = mutator(current.content);
      const newMap = new Map(state.pageContents);
      newMap.set(pageId, {
        ...current,
        content: updatedContent,
        dirty: true,
      });

      return {
        ...state,
        pageContents: newMap,
      };
    }

    case "SET_PAGE_DIRTY": {
      const { pageId, dirty } = action.payload;
      const current = state.pageContents.get(pageId);
      if (!current) return state;

      const newMap = new Map(state.pageContents);
      newMap.set(pageId, {
        ...current,
        dirty,
      });

      return {
        ...state,
        pageContents: newMap,
      };
    }

    default:
      return state;
  }
}

const NotesContext = createContext<{
  state: NotesState;
  dispatch: React.Dispatch<NotesAction>;
  openPage: (pageId: string, content?: PageContent, paneIndex?: number) => void;
} | null>(null);

export function NotesProvider({
  children,
  initialTree,
  initialPageId,
}: {
  children: ReactNode;
  initialTree?: Partial<NoteTree>;
  initialPageId?: string;
}) {
  const initialPanes: PaneState[] = [
    {
      tabs: initialPageId ? [initialPageId] : [],
      activePageId: initialPageId || "",
    },
  ];

  const [state, dispatch] = useReducer(notesReducer, {
    tree: {
      notebooks: initialTree?.notebooks ?? [],
      sections: initialTree?.sections ?? [],
      pages: initialTree?.pages ?? [],
    },
    activePageId: initialPageId || null,
    panes: initialPanes,
    focusedPaneIndex: 0,
    pageContents: new Map(),
    selection: { kind: "none" },
    pointerTool: "default",
    syncStatus: "saved",
  });

  const openPage = useMemo(() => {
    return (pageId: string, content?: PageContent, paneIndex?: number) => {
      dispatch({
        type: "OPEN_PAGE",
        payload: { pageId, content, paneIndex },
      });
    };
  }, []);

  const value = useMemo(
    () => ({ state, dispatch, openPage }),
    [state, openPage]
  );

  return (
    <NotesContext.Provider value={value}>{children}</NotesContext.Provider>
  );
}

export function useNotesStore() {
  const ctx = useContext(NotesContext);
  if (!ctx) {
    throw new Error("useNotesStore must be used within a NotesProvider");
  }
  return ctx;
}
