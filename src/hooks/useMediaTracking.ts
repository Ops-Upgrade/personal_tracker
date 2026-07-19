"use client";

import { useState, useCallback } from "react";
import { getMediaDetails, getMediaByTmdbId, listMedia } from "@/api/media";
import {
  createMedia,
  updateMedia,
  findDuplicate,
  deleteMedia,
} from "@/api/media";
import type { TmdbDetails, Media, MediaPlaintext } from "@/types/media";
import type { ToastType } from "@/components/common/Toast";

export interface ToastConfig {
  isVisible: boolean;
  message: string;
  type: ToastType;
}

interface UseMediaTrackingOptions {
  tmdbId: number;
  userId: string;
  type: "movie" | "tv";
  onRefresh?: () => void;
}

interface UseMediaTrackingReturn {
  tmdbData: TmdbDetails | null;
  localMedia: Media | null;
  allMedia: Media[];
  loading: boolean;
  error: string | null;
  saving: boolean;
  toastConfig: ToastConfig;
  hideToast: () => void;
  load: () => Promise<{ details: TmdbDetails; mediaList: Media[]; existingMedia: Media | undefined } | null>;
  /**
   * Persist local changes.
   * - If the title is already tracked → updateMedia
   * - Else → findDuplicate → update or createMedia
   * Returns the final Media record so the caller can update snapshots.
   */
  save: (
    patch: Partial<MediaPlaintext>,
    extraCreateFields?: Partial<MediaPlaintext>,
  ) => Promise<Media | null>;
  /**
   * Delete the tracked media record.
   * Resets shared state (localMedia, allMedia) and calls onRefresh.
   * Accepts an optional onResetForm callback so the page can clear its
   * own form fields after removal.
   */
  removeMedia: (onResetForm?: () => void) => Promise<void>;
  setTmdbData: React.Dispatch<React.SetStateAction<TmdbDetails | null>>;
  setLocalMedia: React.Dispatch<React.SetStateAction<Media | null>>;
  setAllMedia: React.Dispatch<React.SetStateAction<Media[]>>;
}

/**
 * Shared data-fetching and save orchestration for media tracking pages
 * (MoviePage and TvSeriesPage).
 *
 * Manages:
 *   - Loading TMDB details + user's media list
 *   - Save (create or update) with duplicate detection
 *   - Loading / error / saving / toast states
 *
 * The caller still owns the local form state (status, rating, notes, etc.)
 * and composes `patch` to pass into `save()`.
 */
export function useMediaTracking({
  tmdbId,
  userId,
  type,
  onRefresh,
}: UseMediaTrackingOptions): UseMediaTrackingReturn {
  const [tmdbData, setTmdbData] = useState<TmdbDetails | null>(null);
  const [localMedia, setLocalMedia] = useState<Media | null>(null);
  const [allMedia, setAllMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toastConfig, setToastConfig] = useState<ToastConfig>({
    isVisible: false,
    message: "",
    type: "success",
  });

  const triggerToast = useCallback((message: string, type: ToastType = "success") => {
    setToastConfig({ isVisible: true, message, type });
    setTimeout(() => setToastConfig((prev) => ({ ...prev, isVisible: false })), 2000);
  }, []);

  const hideToast = useCallback(() => {
    setToastConfig((prev) => ({ ...prev, isVisible: false }));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch TMDB details + targeted media lookup in parallel.
      // getMediaByTmdbId warms the in-memory cache on first call;
      // subsequent navigations between detail pages return instantly.
      const [details, existingMedia] = await Promise.all([
        getMediaDetails(tmdbId, type),
        getMediaByTmdbId(userId, tmdbId, type),
      ]);
      setTmdbData(details);

      if (existingMedia) {
        setLocalMedia(existingMedia);
      } else {
        setLocalMedia(null);
      }

      // Populate allMedia from cache (no network — listMedia was already
      // called by getMediaByTmdbId, so the cache is warm).
      const mediaList = await listMedia(userId);
      setAllMedia(mediaList);

      return { details, mediaList, existingMedia };
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load details.",
      );
      return null;
    } finally {
      setLoading(false);
    }
  }, [tmdbId, userId, type]);

  // The caller must call load() manually so it can hydrate local form state
  // from the returned data.

  const save = useCallback(
    async (
      patch: Partial<MediaPlaintext>,
      extraCreateFields?: Partial<MediaPlaintext>,
    ): Promise<Media | null> => {
      if (!userId) return null;
      setSaving(true);
      try {
        if (localMedia) {
          const updated = await updateMedia(userId, localMedia.id, patch);
          setLocalMedia(updated);
          triggerToast("✓ Saved", "success");
          return updated;
        }

        const dup = findDuplicate(tmdbId, type, allMedia);
        if (dup) {
          const updated = await updateMedia(userId, dup.id, patch);
          setLocalMedia(updated);
          triggerToast("✓ Saved", "success");
          return updated;
        }

        const newMedia = await createMedia(userId, {
          tmdb_id: tmdbId,
          type,
          title: "",
          ...extraCreateFields,
          ...patch,
        } as MediaPlaintext);
        setLocalMedia(newMedia);
        triggerToast("✓ You are now tracking this", "success");
        onRefresh?.();
        return newMedia;
      } catch {
        triggerToast("Save failed. Please try again.", "error");
        return null;
      } finally {
        setSaving(false);
      }
    },
    [userId, localMedia, tmdbId, type, allMedia, onRefresh, triggerToast],
  );

  const removeMedia = useCallback(
    async (onResetForm?: () => void) => {
      if (!localMedia) return;
      try {
        await deleteMedia(localMedia.id);
        setLocalMedia(null);
        setAllMedia((prev) => prev.filter((m) => m.id !== localMedia.id));
        onResetForm?.();
        onRefresh?.();
      } catch {
        triggerToast("Failed to remove media. Please try again.", "error");
      }
    },
    [localMedia, onRefresh, triggerToast],
  );

  return {
    tmdbData,
    localMedia,
    allMedia,
    loading,
    error,
    saving,
    toastConfig,
    hideToast,
    load,
    save,
    removeMedia,
    setTmdbData,
    setLocalMedia,
    setAllMedia,
  };
}
