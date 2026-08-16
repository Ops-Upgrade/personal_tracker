"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { ROUTES } from "@/routes/paths";
import BackButton from "@/components/common/BackButton";
import ErrorBanner from "@/components/common/ErrorBanner";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import ReviewSection from "@/components/media/shared/ReviewSection";
import Toast from "@/components/common/Toast";
import type { ToastType } from "@/components/common/Toast";
import { tmdbStillUrl } from "@/components/media/constants";
import StatusChipGroup from "@/components/media/shared/StatusChipGroup";
import StickyActionBar from "@/components/media/shared/StickyActionBar";
import UntrackConfirmation from "@/components/media/shared/UntrackConfirmation";
import { useNavigationGuard } from "@/hooks/useNavigationGuard";
import { useTmdbRetry } from "@/hooks/useTmdbRetry";
import {
  getMediaDetails,
  getSeasonDetails,
  getMediaByTmdbId,
  saveEpisode,
  deleteEpisodeRecord,
  formatSeasonKey,
  formatEpisodeKeyShort,
  getEffectiveEpisodeStatus,
} from "@/api/media";
import type {
  TmdbDetails,
  TmdbSeasonDetails,
  Media,
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
  const { loading, error, execute, clearError } = useTmdbRetry();
  const [saving, setSaving] = useState(false);
  const [showRemove, setShowRemove] = useState(false);

  const seasonKey = formatSeasonKey(seasonNumber);
  const episodeKeyShort = formatEpisodeKeyShort(episodeNumber);
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

  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      try {
        await execute(async () => {
          const [show, season, existing] = await Promise.all([
            getMediaDetails(tmdbId, "tv"),
            getSeasonDetails(tmdbId, seasonNumber),
            getMediaByTmdbId(userId, tmdbId, "tv"),
          ]);
          setShowData(show);
          setSeasonData(season);

          if (existing) {
            setLocalMedia(existing);
            const epData = existing.seasons?.[seasonKey]?.episodes?.[episodeKeyShort];
            const { status: effectiveStatus } = getEffectiveEpisodeStatus(
              existing.status,
              existing.seasons?.[seasonKey]?.status,
              epData?.status,
              seasonNumber === 1 && episodeNumber === 1,
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
        });
      } catch {
        // execute already surfaced the generic error via its own state
      }
    };
    loadData();
  }, [execute, tmdbId, seasonNumber, episodeNumber, userId, seasonKey, episodeKeyShort, retryCount]);

  // ── isDirty ──
  const hasEpisodeRecord = localMedia?.seasons?.[seasonKey]?.episodes?.[episodeKeyShort] !== undefined;

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
    fallbackRoute: `${ROUTES.MEDIA}/tv/${tmdbId}?tab=episodes`,
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

      // Persist via the extracted handler (updates the tracked parent with
      // override-breaking + status bubbling, or auto-creates the parent with
      // status "watching" for an untracked show).
      const updated = await saveEpisode({
        userId,
        tmdbId,
        seasonNumber,
        episodeNumber,
        episodeEntry,
        existingMedia: localMedia ?? undefined,
        showData: showData ?? undefined,
      });
      setLocalMedia(updated);

      // Update original snapshot so isDirty becomes false
      const epData = updated.seasons?.[seasonKey]?.episodes?.[episodeKeyShort];
      setOriginalEpisode({
        status: epData?.status ?? "unwatched",
        rating: epData?.rating ?? 0,
        watched_on: epData?.watched_on ?? "",
        review_notes: epData?.review_notes ?? "",
      });

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

      // Delete only this specific episode's tracking record, prune the
      // season if it's now empty, and recalculate the parent status
      // (an emptied show drops to "unwatched" — no ghost umbrella status).
      const updated = await deleteEpisodeRecord({
        userId,
        seasonNumber,
        episodeNumber,
        existingMedia: currentMedia,
        showData: showData ?? undefined,
      });
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
        <ErrorBanner message={error} onRetry={() => { clearError(); setRetryCount(c => c + 1); }} />
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
            <X size={16} />
            Untrack this Episode
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
