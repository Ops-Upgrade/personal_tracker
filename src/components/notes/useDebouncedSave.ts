"use client";

import { useEffect, useRef, useCallback } from "react";
import { savePageContent, RevisionConflictError } from "@/api/notes";
import { useNotesStore } from "./useNotesStore";
import type { PageContent } from "@/types/notes";

const DEBOUNCE_MS = 1500;

export function useDebouncedSave(userId: string, pageId: string | null) {
  const { state, dispatch } = useNotesStore();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const pageState = pageId ? state.pageContents.get(pageId) : undefined;
  const content = pageState?.content;
  const dirty = pageState?.dirty;
  const lastSyncedRevision = pageState?.lastSyncedRevision;

  // Save crash draft to sessionStorage whenever content mutates
  useEffect(() => {
    if (!userId || !pageId || !content || dirty !== true) return;
    try {
      sessionStorage.setItem(
        `notes_draft_${userId}_${pageId}`,
        JSON.stringify({
          pageId,
          revision: content.revision,
          content,
          timestamp: Date.now(),
        })
      );
    } catch {
      // Best-effort draft storage
    }
  }, [userId, pageId, content, dirty]);

  const performSave = useCallback(
    async (
      targetContent: PageContent,
      expectedRevision: number
    ): Promise<boolean> => {
      if (!userId || !pageId) return false;

      dispatch({ type: "SET_SYNC_STATUS", payload: "syncing" });

      try {
        const saved = await savePageContent(
          userId,
          pageId,
          targetContent,
          expectedRevision
        );

        dispatch({
          type: "SET_PAGE_CONTENT",
          payload: {
            pageId,
            content: saved,
            dirty: false,
            lastSyncedRevision: saved.revision,
          },
        });
        dispatch({ type: "SET_SYNC_STATUS", payload: "saved" });

        // Clear crash draft on successful save
        try {
          sessionStorage.removeItem(`notes_draft_${userId}_${pageId}`);
        } catch {
          // Ignore
        }

        return true;
      } catch (err) {
        if (err instanceof RevisionConflictError) {
          dispatch({
            type: "SET_PAGE_DIRTY",
            payload: { pageId, dirty: "conflicted" },
          });
          dispatch({ type: "SET_SYNC_STATUS", payload: "offline" });
        } else {
          console.error("Failed to autosave note page:", err);
          dispatch({ type: "SET_SYNC_STATUS", payload: "offline" });
        }
        return false;
      }
    },
    [userId, pageId, dispatch]
  );

  // Autosave timer effect
  useEffect(() => {
    if (!userId || !pageId || !content || dirty !== true) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      performSave(content, lastSyncedRevision ?? content.revision);
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [userId, pageId, content, dirty, lastSyncedRevision, performSave]);

  const saveNow = useCallback(
    async (overrideRevision?: number) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (!content) return false;
      const rev =
        overrideRevision !== undefined
          ? overrideRevision
          : (lastSyncedRevision ?? content.revision);
      return performSave(content, rev);
    },
    [content, lastSyncedRevision, performSave]
  );

  return { saveNow };
}
