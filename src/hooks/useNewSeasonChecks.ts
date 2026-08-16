"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getMediaDetails, checkNewSeason } from "@/api/media";
import type { Media } from "@/types/media";

// ── Module-level TTL cache ──

// Survives SPA navigation within the session so back-and-forth between grid
// views doesn't refire a fetch per card. Keyed by tmdb_id. Accepted
// staleness: a badge persists until TTL even after the show page already
// downgraded the status (the cache does not invalidate on navigation — see
// PLAN-mediamanager.md Stage 11).
const NEW_SEASON_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12h

// Batch cap: grid-level checks are fan-out by nature (up to ~500 cards), so
// requests are drained behind this semaphore instead of firing all at once.
const MAX_CONCURRENT_FETCHES = 6;

interface NewSeasonCacheEntry {
  expiresAt: number;
  value: boolean;
}

const newSeasonCache = new Map<number, NewSeasonCacheEntry>();

/**
 * Centralized "new season" detection for grid views.
 *
 * MediaCard stays strictly passive: this hook does ALL TMDB fetching for a
 * grid, filtering to tracked TV shows with status "watched" — the only case
 * where a freshly added TMDB season could hide behind the umbrella status.
 * Requests are drained behind a concurrency cap, deduped through the
 * module-level TTL cache, aborted on unmount, and failures fail silently —
 * a badge is a nice-to-have, never worth an error banner.
 *
 * READ-ONLY: this hook never calls updateMedia. The page-load path
 * (TvSeriesPageWrapper.handleTmdbReady) owns backfill/downgrade persistence;
 * the badge is only a visual hint that those will happen on visit.
 *
 * Returns a map of tmdb_id → true (only entries with a detected new season
 * are present, so callers can look up `map[tmdb_id]` directly).
 */
export function useNewSeasonChecks(
  mediaItems: Media[],
): Record<number, boolean> {
  const [newSeasonMap, setNewSeasonMap] = useState<Record<number, boolean>>({});
  const abortRef = useRef<AbortController | null>(null);

  // Candidates: only watched TV shows with a tracked baseline. A watched
  // show with `tracked_season_count` undefined has no baseline to compare
  // against ("backfill") and this hook is read-only, so it is skipped — the
  // page-load path records the baseline on first visit.
  const candidates = useMemo(
    () =>
      mediaItems
        .filter(
          (m) =>
            m.type === "tv" &&
            m.status === "watched" &&
            m.tmdb_id !== undefined &&
            m.tracked_season_count !== undefined,
        )
        .map((m) => ({
          tmdbId: m.tmdb_id!,
          trackedCount: m.tracked_season_count!,
        })),
    [mediaItems],
  );

  // Stable effect identity: parent re-renders that pass a new array with the
  // same contents must not restart the whole batch.
  const candidateKey = useMemo(
    () => candidates.map((c) => `${c.tmdbId}:${c.trackedCount}`).join("|"),
    [candidates],
  );

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;

    async function run() {
      // Cache-filtered work queue: fresh hits resolve synchronously, expired
      // entries are dropped, misses are queued for the concurrency pool.
      const queue = candidates.filter((c) => {
        const cached = newSeasonCache.get(c.tmdbId);
        if (cached && cached.expiresAt > Date.now()) {
          if (cached.value) {
            setNewSeasonMap((prev) => ({ ...prev, [c.tmdbId]: true }));
          }
          return false;
        }
        if (cached) newSeasonCache.delete(c.tmdbId);
        return true;
      });

      const worker = async () => {
        for (;;) {
          if (controller.signal.aborted) return;
          const item = queue.shift();
          if (!item) return;
          try {
            const details = await getMediaDetails(
              item.tmdbId,
              "tv",
              controller.signal,
            );
            // Same verdict function as the show page so the badge and the
            // page-load downgrade can never disagree.
            const hasNew =
              checkNewSeason(
                item.trackedCount,
                details.number_of_seasons ?? 0,
              ) === "new";
            newSeasonCache.set(item.tmdbId, {
              expiresAt: Date.now() + NEW_SEASON_CACHE_TTL_MS,
              value: hasNew,
            });
            if (hasNew && !controller.signal.aborted) {
              setNewSeasonMap((prev) => ({ ...prev, [item.tmdbId]: true }));
            }
          } catch {
            // Fail silently — badges are best-effort, never surface a banner.
          }
        }
      };

      await Promise.all(
        Array.from(
          { length: Math.min(MAX_CONCURRENT_FETCHES, queue.length) },
          () => worker(),
        ),
      );
    }

    void run();

    return () => {
      // Abort any in-flight detail fetches on unmount.
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateKey]);

  return newSeasonMap;
}
