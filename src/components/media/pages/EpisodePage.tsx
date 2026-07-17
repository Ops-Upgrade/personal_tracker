"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { User, Trash2, Bold, Italic, Underline, List } from "lucide-react";
import BackButton from "@/components/common/BackButton";
import StarRating from "@/components/common/StarRating";
import ConfirmDialog from "@/components/taskmanager/ConfirmDialog";
import {
  getMediaDetails,
  getSeasonDetails,
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

const TMDB_STILL_BASE = "https://image.tmdb.org/t/p/w780";

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
  const [allMedia, setAllMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showRemove, setShowRemove] = useState(false);

  const episodeKey = formatEpisodeKey(seasonNumber, episodeNumber);
  const episode = seasonData?.episodes?.find(
    (e) => e.episode_number === episodeNumber
  );

  // Local form state
  const [status, setStatus] = useState<EpisodeTracking["status"]>("unwatched");
  const [rating, setRating] = useState(0);
  const [watchedOn, setWatchedOn] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");

  // Refs for auto-save engine — stay in sync so async calls never read stale values
  const localMediaRef = useRef(localMedia);
  useEffect(() => { localMediaRef.current = localMedia; }, [localMedia]);
  const statusRef = useRef(status);
  useEffect(() => { statusRef.current = status; }, [status]);
  const ratingRef = useRef(rating);
  useEffect(() => { ratingRef.current = rating; }, [rating]);
  const watchedOnRef = useRef(watchedOn);
  useEffect(() => { watchedOnRef.current = watchedOn; }, [watchedOn]);
  const reviewNotesRef = useRef(reviewNotes);
  useEffect(() => { reviewNotesRef.current = reviewNotes; }, [reviewNotes]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [show, season, mediaList] = await Promise.all([
        getMediaDetails(tmdbId, "tv"),
        getSeasonDetails(tmdbId, seasonNumber),
        listMedia(userId),
      ]);
      setShowData(show);
      setSeasonData(season);
      setAllMedia(mediaList);

      const existing = mediaList.find(
        (m) => m.tmdb_id === tmdbId && m.type === "tv"
      );
      if (existing) {
        setLocalMedia(existing);
        const epData = existing.episodes?.[episodeKey];
        if (epData) {
          setStatus(epData.status ?? "unwatched");
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

  const [showToast, setShowToast] = useState(false);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  const saveEpisodeInteraction = useCallback(
    (patch: Partial<EpisodeTracking>) => {
      if (!userId) return;
      setSaving(true);

      saveQueue.current = saveQueue.current.then(async () => {
        try {
          const episodeEntry: EpisodeTracking = {
            status: patch.status ?? statusRef.current,
            rating: (patch.rating !== undefined ? patch.rating : ratingRef.current) || undefined,
            watched_on: (patch.watched_on !== undefined ? patch.watched_on : watchedOnRef.current) || undefined,
            review_notes: (patch.review_notes !== undefined ? patch.review_notes : reviewNotesRef.current) || undefined,
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
            // Auto-create parent
            const dup = findDuplicate(tmdbId, "tv", allMedia);
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

          setShowToast(true);
          setTimeout(() => setShowToast(false), 2000);
          onRefresh?.();
        } catch (err) {
          console.error("Auto-save failed:", err);
        }
      }).finally(() => {
        setSaving(false);
      });
    },
    [userId, tmdbId, episodeKey, showData, allMedia, onRefresh],
  );

  // ── Interaction handlers ──

  function handleStatusClick(newStatus: EpisodeTracking["status"]) {
    setStatus(newStatus);
    const patch: Partial<EpisodeTracking> = { status: newStatus };
    if (newStatus === "watched" && !watchedOnRef.current) {
      const today = new Date().toISOString().split("T")[0];
      setWatchedOn(today);
      patch.watched_on = today;
    }
    saveEpisodeInteraction(patch);
  }

  function handleRatingChange(newRating: number) {
    setRating(newRating);
    const patch: Partial<EpisodeTracking> = { rating: newRating || undefined };
    if (statusRef.current === "unwatched" && newRating > 0) {
      setStatus("watched");
      patch.status = "watched";
      if (!watchedOnRef.current) {
        const today = new Date().toISOString().split("T")[0];
        setWatchedOn(today);
        patch.watched_on = today;
      }
    }
    saveEpisodeInteraction(patch);
  }

  function handleNotesBlur() {
    const patch: Partial<EpisodeTracking> = { review_notes: reviewNotesRef.current || undefined };
    if (statusRef.current === "unwatched" && reviewNotesRef.current) {
      setStatus("watched");
      patch.status = "watched";
      if (!watchedOnRef.current) {
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
      setStatus("unwatched");
      setRating(0);
      setWatchedOn("");
      setReviewNotes("");

      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
      onRefresh?.();
    } catch (err) {
      console.error("Failed to delete episode record:", err);
    } finally {
      setSaving(false);
      setShowRemove(false);
    }
  }

  const statusColorClasses: Record<EpisodeTracking["status"], string> = {
    unwatched: "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700",
    watching: "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-700",
    watched: "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700",
  };

  const chipClasses = (chipStatus: EpisodeTracking["status"]) =>
    [
      "px-3 py-1 text-xs font-medium rounded-full border transition-colors",
      isTracked && status === chipStatus
        ? statusColorClasses[chipStatus]
        : "border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 cursor-pointer",
    ].join(" ");

  const isTracked = !!localMedia?.episodes?.[episodeKey];

  const stillUrl = episode?.still_path
    ? `${TMDB_STILL_BASE}${episode.still_path}`
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
      <BackButton onClick={() => router.back()} />

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

      {/* Success toast */}
      {showToast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-full bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg">
          ✓ Progress saved
        </div>
      )}

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

        {/* Status Row */}
        <div className="mb-8">
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">
            STATUS
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => handleStatusClick("unwatched")} className={chipClasses("unwatched")}>
              Not Watched
            </button>
            <button type="button" onClick={() => handleStatusClick("watching")} className={chipClasses("watching")}>
              Watching
            </button>
            <button type="button" onClick={() => handleStatusClick("watched")} className={chipClasses("watched")}>
              Watched
            </button>
            {status === "watched" && (
              <>
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 ml-2">
                  Watched on
                </label>
                <input
                  type="date"
                  value={watchedOn}
                  onChange={(e) => {
                    setWatchedOn(e.target.value);
                    saveEpisodeInteraction({ watched_on: e.target.value || undefined });
                  }}
                  className="rounded-lg border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </>
            )}
          </div>
        </div>

        {/* Rating and Comments Row */}
        <div>
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">
            RATING AND COMMENTS
          </h3>
          <div className="flex flex-col md:flex-row items-start gap-6">
            <div className="shrink-0 space-y-3">
              <div className="flex items-center gap-3">
                {userAvatarUrl ? (
                  <Image src={userAvatarUrl} alt={userName ?? ""} width={40} height={40} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-700">
                    <User size={20} />
                  </span>
                )}
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {userName ?? "You"}:
                </span>
              </div>
              <StarRating value={rating} onChange={handleRatingChange} size={22} />
            </div>
            <div className="flex-1 min-w-0 w-full">
              {/* Formatting toolbar */}
              <div className="flex items-center gap-0.5 mb-2">
                <button
                  type="button"
                  onClick={() => setReviewNotes((prev) => prev + "**bold**")}
                  className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 transition-colors"
                  title="Bold"
                >
                  <Bold size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setReviewNotes((prev) => prev + "*italic*")}
                  className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 transition-colors"
                  title="Italic"
                >
                  <Italic size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setReviewNotes((prev) => prev + "<u>underline</u>")}
                  className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 transition-colors"
                  title="Underline"
                >
                  <Underline size={15} />
                </button>
                <span className="w-px h-4 bg-zinc-300 dark:bg-zinc-600 mx-0.5" />
                <button
                  type="button"
                  onClick={() => setReviewNotes((prev) => prev + "\n- ")}
                  className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 transition-colors"
                  title="Bullet list"
                >
                  <List size={15} />
                </button>
              </div>

              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                onBlur={handleNotesBlur}
                rows={5}
                placeholder="Your thoughts on this episode..."
                className="w-full min-h-[120px] rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 resize-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      {showRemove && (
        <ConfirmDialog
          title="Delete Episode Record"
          description="This will permanently remove your progress, rating, and comments for this specific episode. Your tracking for the rest of the TV series will remain unchanged."
          confirmLabel="Delete Record"
          onConfirm={handleDeleteEpisode}
          onCancel={() => setShowRemove(false)}
        />
      )}
    </div>
  );
}
