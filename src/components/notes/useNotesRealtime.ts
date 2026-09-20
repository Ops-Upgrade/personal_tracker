"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getPageContent } from "@/api/notes";
import { useNotesStore } from "./useNotesStore";

/**
 * Realtime subscription to notes_page_content changes for the current user.
 * Automatically applies remote updates if there are no unsaved local changes;
 * triggers conflict resolution if the remote revision is newer than local edits.
 */
export function useNotesRealtime(userId: string) {
  const { state, dispatch } = useNotesStore();

  useEffect(() => {
    if (!userId) return;

    // If WebSockets are disabled or blocked by browser extensions, fail gracefully
    if (typeof window === "undefined" || typeof window.WebSocket === "undefined") {
      console.warn("WebSockets not available; realtime sync disabled.");
      return;
    }

    try {
      const supabase = createClient();
      const channel = supabase
        .channel(`notes_realtime_${userId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "notes_page_content",
            filter: `user_id=eq.${userId}`,
          },
          async (payload) => {
            const updatedRow = payload.new as {
              id: string;
              user_id: string;
              revision: number;
            };

            const pageId = updatedRow.id;
            const current = state.pageContents.get(pageId);
            if (!current) return;

            // If no unsaved local edits, auto-apply remote content
            if (current.dirty === false) {
              try {
                const freshContent = await getPageContent(userId, pageId);
                dispatch({
                  type: "SET_PAGE_CONTENT",
                  payload: {
                    pageId,
                    content: freshContent,
                    dirty: false,
                    lastSyncedRevision: freshContent.revision,
                  },
                });
              } catch (err) {
                console.error("Failed to fetch fresh remote page content:", err);
              }
            } else if (
              current.dirty === true &&
              updatedRow.revision > current.lastSyncedRevision
            ) {
              // Local edits exist and remote revision is ahead: trigger conflict
              dispatch({
                type: "SET_PAGE_DIRTY",
                payload: { pageId, dirty: "conflicted" },
              });
            }
          }
        )
        .subscribe((_status, err) => {
          if (err) {
            console.warn("Realtime channel subscription error:", err);
          }
        });

      return () => {
        try {
          supabase.removeChannel(channel);
        } catch {
          // Best effort cleanup
        }
      };
    } catch (err) {
      console.warn("Realtime connection could not be established:", err);
    }
  }, [userId, state.pageContents, dispatch]);
}
