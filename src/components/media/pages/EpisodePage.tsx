"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Trash2 } from "lucide-react";
import { ROUTES } from "@/routes/paths";
import BackButton from "@/components/common/BackButton";
import ReviewSection from "@/components/media/shared/ReviewSection";
import Toast from "@/components/media/shared/Toast";
import type { ToastType } from "@/components/media/shared/Toast";
import { tmdbStillUrl } from "@/components/media/constants";
import StatusChipGroup from "@/components/media/shared/StatusChipGroup";
import UntrackConfirmation from "@/components/media/shared/UntrackConfirmation";
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
  const router = useRouter();
  const [seasonData, setSeasonData] = useState<TmdbSeasonDetails | null>(null);
  const [showData, setShowData] = useState<TmdbDetails | null>(null);
  const [localMedia, setLocalMedia] = useState<Media | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [saving, setSaving] = useState(false);
  const [showRemove, setShowRemove] = useState(false);

  const episodeKey = formatEpisodeKey(seasonNumber, episodeNumber);
  const episode = seasonData?.episodes?.find(
    (e) => e.episode_number === episodeNumber
  );

  // Local form state
  const [status, setStatus] = useState<EpisodeTracking["status"] | undefined>(undefined);
  const [rating, setRating] = useState(0);
  const [watchedOn, setWatchedOn] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");

  // Refs for auto-save engine — stay in sync so async calls never read stale values
  const localMediaRef = useRef(localMedia);
  useEffect(() => { localMediaRef.current = localMedia; }, [localMedia]);
  const formStateRef = useRef({ status, rating, reviewNotes, watchedOn });
  useEffect(() => {
    formStateRef.current = { status, rating, reviewNotes, watchedOn };
  }, [status, rating, reviewNotes, watchedOn]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch show details + season data + targeted media lookup in parallel.
      // getMediaByTmdbId warms the in-memory cache on first call;
      // subsequent navigations between detail pages return instantly.
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
        if (epData) {
          setStatus(epData.status);
          setRating(epData.rating ?? 0);
          setWatchedOn(epData.watched_on ?? "");
          setReviewNotes(epData.review_notes ?? "");
        }
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
    // Force refresh when returning to this tab
    const handleFocus = () => load();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [load]);

  // ── Auto-save engine (queued — prevents duplicate creates on rapid clicks) ──

  const [toastConfig, setToastConfig] = useState<{
    isVisible: boolean;
    message: string;
    type: ToastType;
  }>({ isVisible: false, message: "", type: "success" });
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  const triggerToast = useCallback((message: string, type: ToastType = "success") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastConfig({ isVisible: true, message, type });
    toastTimerRef.current = setTimeout(() => {
      setToastConfig((prev) => ({ ...prev, isVisible: false }));
    }, 2000);
  }, []);

  const saveEpisodeInteraction = useCallback(
    (patch: Partial<EpisodeTracking>) => {
      if (!userId) return;
      setSaving(true);

      saveQueue.current = saveQueue.current.then(async () => {
        try {
          const episodeEntry: EpisodeTracking = {
            status: patch.status ?? formStateRef.current.status ?? "unwatched",
            rating: (patch.rating !== undefined ? patch.rating : formStateRef.current.rating) || undefined,
            watched_on: (patch.watched_on !== undefined ? patch.watched_on : formStateRef.current.watchedOn) || undefined,
            review_notes: (patch.review_notes !== undefined ? patch.review_notes : formStateRef.current.reviewNotes) || undefined,
          };
          const currentMedia = localMediaRef.current;

          if (currentMedia) {
            const updatedEpisodes = {
              ...(currentMedia.episodes ?? {}),
              [episodeKey]: episodeEntry,
            };
            const parentPatch: Partial<MediaPlaintext> = { episodes: updatedEpisodes };
            // Bubble up to "watching" if parent is unwatched
            if (currentMedia.status === "unwatched" && (episodeEntry.status !== "unwatched" || episodeEntry.rating || episodeEntry.review_notes)) {
              parentPatch.status = "watching";
            }
            // Check if this interaction completes the show
            const totalEpisodes = showData?.number_of_episodes ?? 0;
            const computedParentStatus = computeShowStatus(updatedEpisodes, totalEpisodes);
            if (computedParentStatus) {
              parentPatch.status = computedParentStatus;
            }
            const updated = await updateMedia(userId, currentMedia.id, parentPatch);
            localMediaRef.current = updated;
            setLocalMedia(updated);
          } else {
            // Auto-create parent — read from cache (instant, no network)
            const mediaList = await listMedia(userId);
            const dup = findDuplicate(tmdbId, "tv", mediaList);
            if (dup) {
              const updatedEpisodes = { ...(dup.episodes ?? {}), [episodeKey]: episodeEntry };
              const parentPatch: Partial<MediaPlaintext> = { episodes: updatedEpisodes };
              if (dup.status === "unwatched" && (episodeEntry.status !== "unwatched" || episodeEntry.rating || episodeEntry.review_notes)) {
                parentPatch.status = "watching";
              }
              const totalEpisodes = showData?.number_of_episodes ?? 0;
              const computedParentStatus = computeShowStatus(updatedEpisodes, totalEpisodes);
              if (computedParentStatus) parentPatch.status = computedParentStatus;
              const updated = await updateMedia(userId, dup.id, parentPatch);
              localMediaRef.current = updated;
              setLocalMedia(updated);
            } else {
              const newMedia = await createMedia(userId, {
                tmdb_id: tmdbId,
                type: "tv",
                title: showData?.name ?? "TV Series",
                status: "watching",
                episodes: { [episodeKey]: episodeEntry },
              });
              localMediaRef.current = newMedia;
              setLocalMedia(newMedia);
            }
          }

          triggerToast("✓ Progress saved", "success");
          onRefresh?.();
        } catch {
          triggerToast("Auto-save failed. Please try again.", "error");
        }
      }).finally(() => {
        setSaving(false);
      });
    },
    [userId, tmdbId, episodeKey, showData, onRefresh, triggerToast],
  );

  // ── Interaction handlers ──

  function handleStatusClick(newStatus: EpisodeTracking["status"]) {
    setStatus(newStatus);
    const patch: Partial<EpisodeTracking> = { status: newStatus };
    if (newStatus === "watched" && !formStateRef.current.watchedOn) {
      const today = new Date().toISOString().split("T")[0];
      setWatchedOn(today);
      patch.watched_on = today;
    }
    saveEpisodeInteraction(patch);
  }

  function handleRatingChange(newRating: number) {
    setRating(newRating);
    const patch: Partial<EpisodeTracking> = { rating: newRating || undefined };
    if ((formStateRef.current.status ?? "unwatched") === "unwatched" && newRating > 0) {
      setStatus("watched");
      patch.status = "watched";
      if (!formStateRef.current.watchedOn) {
        const today = new Date().toISOString().split("T")[0];
        setWatchedOn(today);
        patch.watched_on = today;
      }
    }
    saveEpisodeInteraction(patch);
  }

  function handleNotesBlur() {
    const patch: Partial<EpisodeTracking> = { review_notes: formStateRef.current.reviewNotes || undefined };
    if ((formStateRef.current.status ?? "unwatched") === "unwatched" && formStateRef.current.reviewNotes) {
      setStatus("watched");
      patch.status = "watched";
      if (!formStateRef.current.watchedOn) {
        const today = new Date().toISOString().split("T")[0];
        setWatchedOn(today);
        patch.watched_on = today;
      }
    }
    saveEpisodeInteraction(patch);
  }

  // ── Delete episode record ──

  async function handleDeleteEpisode() {
    if (!userId || !localMediaRef.current) return;
    setSaving(true);
    try {
      const currentMedia = localMediaRef.current;
      const updatedEpisodes = { ...(currentMedia.episodes ?? {}) };

      // Delete only this specific episode's tracking record
      delete updatedEpisodes[episodeKey];

      const parentPatch: Partial<MediaPlaintext> = { episodes: updatedEpisodes };

      // Recalculate parent status in case removing this episode changes completion
      const totalEpisodes = showData?.number_of_episodes ?? 0;
      const computedParentStatus = computeShowStatus(updatedEpisodes, totalEpisodes);
      if (computedParentStatus) {
        parentPatch.status = computedParentStatus;
      }

      const updated = await updateMedia(userId, currentMedia.id, parentPatch);
      localMediaRef.current = updated;
      setLocalMedia(updated);

      // Reset the local UI state back to default
      setStatus(undefined);
      setRating(0);
      setWatchedOn("");
      setReviewNotes("");

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
      <BackButton
        onClick={() => {
          if (window.history.length > 2) {
            router.back();
          } else {
            router.push(`${ROUTES.MEDIA}?tab=manager`);
          }
        }}
      />

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
            {episode?.air_date && (
              <p className="mt-3 text-base font-medium text-zinc-500 dark:text-zinc-400">
                Aired: {episode.air_date
                    ? (([y, m, d]) => `${d}-${m}-${y}`)(episode.air_date.split("-"))
                    : ""}
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

      {/* Tracking Form (Parity Layout) */}
      <div className="relative w-full rounded-2xl border border-zinc-200 bg-zinc-50 p-6 md:p-8 dark:border-zinc-800 dark:bg-zinc-900/50">

        {/* Only show trash if this episode actually exists in the DB */}
        {localMedia?.episodes?.[episodeKey] && (
          <button
            type="button"
            onClick={() => setShowRemove(true)}
            className="absolute top-6 right-6 p-2 text-zinc-400 hover:text-red-600 transition-colors"
            title="Delete Episode Record"
          >
            <Trash2 size={18} />
          </button>
        )}

        <StatusChipGroup
          status={status}
          onStatusChange={handleStatusClick}
          showWatchedOn
          watchedOn={watchedOn}
          onWatchedOnChange={(date) => {
            setWatchedOn(date);
            saveEpisodeInteraction({ watched_on: date || undefined });
          }}
        />

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

      <UntrackConfirmation
        open={showRemove}
        mediaType="episode"
        onConfirm={handleDeleteEpisode}
        onCancel={() => setShowRemove(false)}
      />
    </div>
  );
}
