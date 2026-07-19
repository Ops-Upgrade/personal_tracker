"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Image from "next/image";
import { Trash2 } from "lucide-react";
import { ROUTES } from "@/routes/paths";
import BackButton from "@/components/common/BackButton";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import ReviewSection from "@/components/media/shared/ReviewSection";
import Toast from "@/components/media/shared/Toast";
import type { ToastType } from "@/components/media/shared/Toast";
import { tmdbStillUrl } from "@/components/media/constants";
import StatusChipGroup from "@/components/media/shared/StatusChipGroup";
import StickyActionBar from "@/components/media/shared/StickyActionBar";
import UntrackConfirmation from "@/components/media/shared/UntrackConfirmation";
import { useNavigationGuard } from "@/hooks/useNavigationGuard";
import {
  getMediaDetails,
  getSeasonDetails,
  getMediaByTmdbId,
  listMedia,
  createMedia,
  updateMedia,
  findDuplicate,
  formatEpisodeKey,
  computeShowStatus,
  getEffectiveEpisodeStatus,
} from "@/api/media";
import type {
  TmdbDetails,
  TmdbSeasonDetails,
  Media,
  MediaPlaintext,
  EpisodeTracking,
} from "@/types/media";

interface EpisodePageProps {
  tmdbId: number;
  seasonNumber: number;
  episodeNumber: number;
  userId: string;
  userName?: string;
  userAvatarUrl?: string;
  onRefresh?: () => void;
}

export default function EpisodePage({
  tmdbId,
  seasonNumber,
  episodeNumber,
  userId,
  userName,
  userAvatarUrl,
  onRefresh,
}: EpisodePageProps) {
  const [seasonData, setSeasonData] = useState<TmdbSeasonDetails | null>(null);
  const [showData, setShowData] = useState<TmdbDetails | null>(null);
  const [localMedia, setLocalMedia] = useState<Media | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showRemove, setShowRemove] = useState(false);

  const episodeKey = formatEpisodeKey(seasonNumber, episodeNumber);
  const episode = seasonData?.episodes?.find(
    (e) => e.episode_number === episodeNumber
  );

  // ── Local form state ──
  const [status, setStatus] = useState<EpisodeTracking["status"] | undefined>(undefined);
  const [rating, setRating] = useState(0);
  const [watchedOn, setWatchedOn] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");

  // Snapshot of original values for isDirty comparison
  const [originalEpisode, setOriginalEpisode] = useState<{
    status: string;
    rating: number;
    watched_on: string;
    review_notes: string;
  } | null>(null);

  // ── Toast ──
  const [toastConfig, setToastConfig] = useState<{
    isVisible: boolean;
    message: string;
    type: ToastType;
  }>({ isVisible: false, message: "", type: "success" });
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerToast = useCallback((message: string, type: ToastType = "success") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastConfig({ isVisible: true, message, type });
    toastTimerRef.current = setTimeout(() => {
      setToastConfig((prev) => ({ ...prev, isVisible: false }));
    }, 2000);
  }, []);

  // ── Load ──

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [show, season, existing] = await Promise.all([
        getMediaDetails(tmdbId, "tv"),
        getSeasonDetails(tmdbId, seasonNumber),
        getMediaByTmdbId(userId, tmdbId, "tv"),
      ]);
      setShowData(show);
      setSeasonData(season);

      if (existing) {
        setLocalMedia(existing);
        const epData = existing.episodes?.[episodeKey];
        const { status: effectiveStatus } = getEffectiveEpisodeStatus(
          existing.status,
          epData?.status,
        );
        setStatus(effectiveStatus as EpisodeTracking["status"]);
        setRating(epData?.rating ?? 0);
        setWatchedOn(epData?.watched_on ?? "");
        setReviewNotes(epData?.review_notes ?? "");
        setOriginalEpisode({
          status: effectiveStatus,
          rating: epData?.rating ?? 0,
          watched_on: epData?.watched_on ?? "",
          review_notes: epData?.review_notes ?? "",
        });
      } else {
        setOriginalEpisode(null);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load episode."
      );
    } finally {
      setLoading(false);
    }
  }, [tmdbId, seasonNumber, episodeKey, userId]);

  useEffect(() => {
    load();
  }, [load]);

  // ── isDirty ──
  const hasEpisodeRecord = localMedia?.episodes?.[episodeKey] !== undefined;

  const isDirty = useMemo(() => {
    if (!originalEpisode) {
      // No media tracked at all — dirty if anything was entered
      return (
        status !== undefined ||
        rating !== 0 ||
        watchedOn !== "" ||
        reviewNotes !== ""
      );
    }
    // Compare against the loaded snapshot (works for both virtual and explicit episodes)
    return (
      status !== originalEpisode.status ||
      rating !== originalEpisode.rating ||
      watchedOn !== originalEpisode.watched_on ||
      reviewNotes !== originalEpisode.review_notes
    );
  }, [originalEpisode, status, rating, watchedOn, reviewNotes]);

  // ── Navigation guard ──
  function doCancel() {
    if (originalEpisode) {
      setStatus(originalEpisode.status as EpisodeTracking["status"]);
      setRating(originalEpisode.rating);
      setWatchedOn(originalEpisode.watched_on);
      setReviewNotes(originalEpisode.review_notes);
    } else {
      setStatus(undefined);
      setRating(0);
      setWatchedOn("");
      setReviewNotes("");
    }
  }

  const {
    showUnsavedDialog,
    handleCancel,
    handleBackClick,
    handleDiscardAndNavigate,
    closeUnsavedDialog,
  } = useNavigationGuard({
    isDirty,
    doCancel,
    fallbackRoute: `${ROUTES.MEDIA}?tab=manager`,
  });

  // ── Handlers (local state only — save is manual) ──

  function handleStatusClick(newStatus: EpisodeTracking["status"]) {
    setStatus(newStatus);
    if (newStatus === "watched" && !watchedOn) {
      const today = new Date().toISOString().split("T")[0];
      setWatchedOn(today);
    }
  }

  function handleRatingChange(newRating: number) {
    setRating(newRating);
    const currentStatus = status ?? "unwatched";
    if (currentStatus === "unwatched" && newRating > 0) {
      setStatus("watched");
      if (!watchedOn) {
        const today = new Date().toISOString().split("T")[0];
        setWatchedOn(today);
      }
    }
  }

  function handleNotesBlur() {
    const currentStatus = status ?? "unwatched";
    if (currentStatus === "unwatched" && reviewNotes) {
      setStatus("watched");
      if (!watchedOn) {
        const today = new Date().toISOString().split("T")[0];
        setWatchedOn(today);
      }
    }
  }

  // ── Save ──

  async function handleSave() {
    if (!userId) return;
    setSaving(true);
    try {
      const episodeEntry: EpisodeTracking = {
        status: status ?? "unwatched",
        rating: rating || undefined,
        watched_on: watchedOn || undefined,
        review_notes: reviewNotes || undefined,
      };

      if (localMedia) {
        // Update existing parent show
        const updatedEpisodes = {
          ...(localMedia.episodes ?? {}),
          [episodeKey]: episodeEntry,
        };
        const parentPatch: Partial<MediaPlaintext> = { episodes: updatedEpisodes };

        // Bubble up to "watching" if parent is unwatched
        if (
          localMedia.status === "unwatched" &&
          (episodeEntry.status !== "unwatched" || episodeEntry.rating || episodeEntry.review_notes)
        ) {
          parentPatch.status = "watching";
        }

        // Check if this interaction completes the show
        const totalEpisodes = showData?.number_of_episodes ?? 0;
        const computedParentStatus = computeShowStatus(updatedEpisodes, totalEpisodes);
        if (computedParentStatus) {
          const isDowngradeFromWatched =
            localMedia.status === "watched" && computedParentStatus !== "watched";
          if (isDowngradeFromWatched) {
            // INVARIANT: Any explicit non-watched status breaks the umbrella.
            if (episodeEntry.status && episodeEntry.status !== "watched") {
              parentPatch.status = "watching";
            }
          } else {
            parentPatch.status = computedParentStatus;
          }
        }

        const updated = await updateMedia(userId, localMedia.id, parentPatch);
        setLocalMedia(updated);

        // Update original snapshot so isDirty becomes false
        const epData = updated.episodes?.[episodeKey];
        setOriginalEpisode({
          status: epData?.status ?? "unwatched",
          rating: epData?.rating ?? 0,
          watched_on: epData?.watched_on ?? "",
          review_notes: epData?.review_notes ?? "",
        });
      } else {
        // Auto-create parent — read from cache (instant, no network)
        const mediaList = await listMedia(userId);
        const dup = findDuplicate(tmdbId, "tv", mediaList);

        if (dup) {
          // Parent exists but wasn't in localMedia (race or stale cache)
          const updatedEpisodes = { ...(dup.episodes ?? {}), [episodeKey]: episodeEntry };
          const parentPatch: Partial<MediaPlaintext> = { episodes: updatedEpisodes };

          if (
            dup.status === "unwatched" &&
            (episodeEntry.status !== "unwatched" || episodeEntry.rating || episodeEntry.review_notes)
          ) {
            parentPatch.status = "watching";
          }

          const totalEpisodes = showData?.number_of_episodes ?? 0;
          const computedParentStatus = computeShowStatus(updatedEpisodes, totalEpisodes);
          if (computedParentStatus) {
            const isDowngradeFromWatched =
              dup.status === "watched" && computedParentStatus !== "watched";
            if (isDowngradeFromWatched) {
              // INVARIANT: Any explicit non-watched status breaks the umbrella.
              if (episodeEntry.status && episodeEntry.status !== "watched") {
                parentPatch.status = "watching";
              }
            } else {
              parentPatch.status = computedParentStatus;
            }
          }

          const updated = await updateMedia(userId, dup.id, parentPatch);
          setLocalMedia(updated);

          const epData = updated.episodes?.[episodeKey];
          setOriginalEpisode({
            status: epData?.status ?? "unwatched",
            rating: epData?.rating ?? 0,
            watched_on: epData?.watched_on ?? "",
            review_notes: epData?.review_notes ?? "",
          });
        } else {
          // Brand-new parent show
          const newMedia = await createMedia(userId, {
            tmdb_id: tmdbId,
            type: "tv",
            title: showData?.name ?? "TV Series",
            status: "watching",
            episodes: { [episodeKey]: episodeEntry },
          });
          setLocalMedia(newMedia);

          const epData = newMedia.episodes?.[episodeKey];
          setOriginalEpisode({
            status: epData?.status ?? "unwatched",
            rating: epData?.rating ?? 0,
            watched_on: epData?.watched_on ?? "",
            review_notes: epData?.review_notes ?? "",
          });
        }
      }

      triggerToast("✓ Progress saved", "success");
      onRefresh?.();
    } catch {
      triggerToast("Save failed. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  // ── Delete episode record ──

  async function handleDeleteEpisode() {
    if (!userId || !localMedia) return;
    setSaving(true);
    try {
      const currentMedia = localMedia;
      const updatedEpisodes = { ...(currentMedia.episodes ?? {}) };

      // Delete only this specific episode's tracking record
      delete updatedEpisodes[episodeKey];

      const parentPatch: Partial<MediaPlaintext> = { episodes: updatedEpisodes };

      // Recalculate parent status in case removing this episode changes completion.
      // DESIGN: When computeShowStatus returns null (0 episodes remaining), we
      // intentionally skip the parent status update — the umbrella status
      // ("Watching" or "Watched") is preserved while the virtual fallback in
      // getEffectiveEpisodeStatus correctly presents the inherited state.
      const totalEpisodes = showData?.number_of_episodes ?? 0;
      const computedParentStatus = computeShowStatus(updatedEpisodes, totalEpisodes);
      if (computedParentStatus) {
        parentPatch.status = computedParentStatus;
      }

      const updated = await updateMedia(userId, currentMedia.id, parentPatch);
      setLocalMedia(updated);

      // Reset the local UI state back to default
      setStatus(undefined);
      setRating(0);
      setWatchedOn("");
      setReviewNotes("");
      setOriginalEpisode(null);

      triggerToast("Episode record deleted.", "success");
      onRefresh?.();
    } catch {
      triggerToast("Failed to delete episode record. Please try again.", "error");
    } finally {
      setSaving(false);
      setShowRemove(false);
    }
  }

  const stillUrl = episode?.still_path
    ? tmdbStillUrl(episode.still_path, "w780")
    : null;

  if (loading) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        Loading episode details…
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <BackButton onClick={handleBackClick} />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      {/* ── Row 1: Image + Text ── */}
      <div className="flex flex-col md:flex-row gap-8 mb-10 mt-2">
        {/* Episode still */}
        <div className="w-full md:w-1/2 lg:w-[45%] shrink-0">
          <div className="relative aspect-video bg-zinc-100 dark:bg-zinc-800 rounded-xl overflow-hidden w-full shadow-sm">
            {stillUrl ? (
              <Image
                src={stillUrl}
                alt={episode?.name ?? `Episode ${episodeNumber}`}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-zinc-400">
                No episode still available
              </div>
            )}
          </div>
        </div>

        {/* Text */}
        <div className="flex-1 flex flex-col justify-center space-y-6">
          <div>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 mb-2">
              SEASON {seasonNumber}, EPISODE {episodeNumber}
            </span>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
              {episode?.name ?? `Episode ${episodeNumber}`}
            </h1>
            {(episode?.air_date || episode?.runtime) && (
              <p className="mt-3 text-base font-medium text-zinc-500 dark:text-zinc-400">
                {episode?.air_date ? `Aired: ${(([y, m, d]) => `${d}-${m}-${y}`)(episode.air_date.split("-"))}` : ""}
                {episode?.air_date && episode?.runtime ? " • " : ""}
                {episode?.runtime ? (episode.runtime >= 60 ? `${Math.floor(episode.runtime / 60)}h ${episode.runtime % 60}m` : `${episode.runtime}m`) : ""}
              </p>
            )}
          </div>

          {episode?.overview && (
            <p className="text-base lg:text-lg text-zinc-600 dark:text-zinc-300 leading-relaxed max-w-4xl">
              {episode.overview}
            </p>
          )}
        </div>
      </div>

      <Toast isVisible={toastConfig.isVisible} message={toastConfig.message} type={toastConfig.type} />

      {/* ── Delete button ── */}
      <div className="flex justify-end mb-2">
        {hasEpisodeRecord && (
          <button
            type="button"
            onClick={() => setShowRemove(true)}
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm border-none transition-colors text-sm"
          >
            <Trash2 size={16} />
            Delete Episode Record
          </button>
        )}
      </div>

      {/* Tracking Form (Parity Layout) */}
      <div className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 p-6 md:p-8 dark:border-zinc-800 dark:bg-zinc-900/50">

        <div className="mb-6">
          <StatusChipGroup
            status={status}
            onStatusChange={handleStatusClick}
            showWatchedOn
            watchedOn={watchedOn}
            onWatchedOnChange={setWatchedOn}
          />
        </div>

        <ReviewSection
          rating={rating}
          onRatingChange={handleRatingChange}
          reviewNotes={reviewNotes}
          onReviewNotesChange={setReviewNotes}
          userName={userName}
          userAvatarUrl={userAvatarUrl}
          onBlur={handleNotesBlur}
        />
      </div>

      {/* ── Action Bar ── */}
      <StickyActionBar
        onSave={handleSave}
        onCancel={handleCancel}
        saving={saving}
        isDirty={isDirty}
      />

      {/* Remove confirmation */}
      <UntrackConfirmation
        open={showRemove}
        mediaType="episode"
        onConfirm={handleDeleteEpisode}
        onCancel={() => setShowRemove(false)}
      />

      {/* Unsaved changes guard */}
      {showUnsavedDialog && (
        <ConfirmDialog
          title="Unsaved Changes"
          description="You have unsaved tracking data. Discard changes?"
          confirmLabel="Discard"
          cancelLabel="Keep Editing"
          onConfirm={handleDiscardAndNavigate}
          onCancel={closeUnsavedDialog}
        />
      )}
    </div>
  );
}
