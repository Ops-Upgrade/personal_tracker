"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Film, X, User, Bold, Italic, Underline, List } from "lucide-react";
import { ROUTES } from "@/routes/paths";
import BackButton from "@/components/common/BackButton";
import Button from "@/components/common/Button";
import StarRating from "@/components/common/StarRating";
import ConfirmDialog from "@/components/taskmanager/ConfirmDialog";
import { getMediaDetails } from "@/api/media";
import {
  listMedia,
  createMedia,
  updateMedia,
  deleteMedia,
  findDuplicate,
} from "@/api/media";
import type {
  TmdbDetails,
  Media,
  MediaCollection,
  MediaPlaintext,
} from "@/types/media";
import { getThemeStyles } from "@/lib/collectionThemes";

const TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w500";

interface MoviePageProps {
  tmdbId: number;
  userId: string;
  userName?: string;
  userAvatarUrl?: string;
  collections: MediaCollection[];
  onRefresh?: () => void;
}

export default function MoviePage({
  tmdbId,
  userId,
  userName,
  userAvatarUrl,
  collections,
  onRefresh,
}: MoviePageProps) {
  const router = useRouter();
  const [tmdbData, setTmdbData] = useState<TmdbDetails | null>(null);
  const [localMedia, setLocalMedia] = useState<Media | null>(null);
  const [allMedia, setAllMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRemove, setShowRemove] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);
  const [collectionSearch, setCollectionSearch] = useState("");
  const collectionPickerRef = useRef<HTMLDivElement>(null);

  // Close collection picker on outside click
  useEffect(() => {
    if (!showCollectionPicker) return;
    function handleClick(e: MouseEvent) {
      if (
        collectionPickerRef.current &&
        !collectionPickerRef.current.contains(e.target as Node)
      ) {
        setShowCollectionPicker(false);
        setCollectionSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showCollectionPicker]);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [collectionToRemove, setCollectionToRemove] = useState<string | null>(null);

  // Tracking form state (local staging)
  const [status, setStatus] = useState<MediaPlaintext["status"]>("unwatched");
  const [rating, setRating] = useState(0);
  const [watchedOn, setWatchedOn] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [collectionIds, setCollectionIds] = useState<string[]>([]);

  // Snapshot of the DB record at load time (for isDirty comparison)
  const [originalMedia, setOriginalMedia] = useState<MediaPlaintext | null>(null);

  const isTracked = localMedia !== null;
  const title = localMedia?.title ?? tmdbData?.title ?? "Movie";
  const year = tmdbData?.release_date
    ? new Date(tmdbData.release_date).getFullYear()
    : "";

  // ── Load ──

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [details, mediaList] = await Promise.all([
        getMediaDetails(tmdbId, "movie"),
        listMedia(userId),
      ]);
      setTmdbData(details);
      setAllMedia(mediaList);

      const existing = mediaList.find(
        (m) => m.tmdb_id === tmdbId && m.type === "movie",
      );
      if (existing) {
        setLocalMedia(existing);
        setStatus(existing.status ?? "unwatched");
        setRating(existing.rating ?? 0);
        setWatchedOn(existing.watched_on ?? "");
        setReviewNotes(existing.review_notes ?? "");
        const ids =
          existing.collection_ids ??
          (existing.collection_id ? [existing.collection_id] : []);
        setCollectionIds(ids);
        // Snapshot original for isDirty
        setOriginalMedia({
          status: existing.status ?? "unwatched",
          rating: existing.rating ?? 0,
          watched_on: existing.watched_on ?? "",
          review_notes: existing.review_notes ?? "",
          collection_ids: ids.length > 0 ? [...ids].sort() : undefined,
        } as MediaPlaintext);
      } else {
        setOriginalMedia(null);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load movie details.",
      );
    } finally {
      setLoading(false);
    }
  }, [tmdbId, userId]);

  useEffect(() => {
    load();
  }, [load]);

  // ── isDirty ──

  const isDirty = useMemo(() => {
    if (!isTracked) {
      // New (not yet created) — dirty if user has changed anything
      return (
        status !== "unwatched" ||
        rating !== 0 ||
        watchedOn !== "" ||
        reviewNotes !== "" ||
        collectionIds.length > 0
      );
    }
    if (!originalMedia) return false;
    const sortedCurrentIds = [...collectionIds].sort();
    const sortedOrigIds = [...(originalMedia.collection_ids ?? [])].sort();
    return (
      status !== originalMedia.status ||
      rating !== (originalMedia.rating ?? 0) ||
      watchedOn !== (originalMedia.watched_on ?? "") ||
      reviewNotes !== (originalMedia.review_notes ?? "") ||
      sortedCurrentIds.length !== sortedOrigIds.length ||
      sortedCurrentIds.some((id, i) => id !== sortedOrigIds[i])
    );
  }, [isTracked, originalMedia, status, rating, watchedOn, reviewNotes, collectionIds]);

  // ── Handlers (local staging only — no auto-save) ──

  function handleStatusClick(newStatus: MediaPlaintext["status"]) {
    setStatus(newStatus);
    if (newStatus === "watched" && !watchedOn) {
      const today = new Date().toISOString().split("T")[0];
      setWatchedOn(today);
    }
  }

  function handleRatingChange(newRating: number) {
    setRating(newRating);
    if (!isTracked && newRating > 0) {
      setStatus("watched");
      if (!watchedOn) {
        const today = new Date().toISOString().split("T")[0];
        setWatchedOn(today);
      }
    }
  }

  function handleToggleCollection(colId: string) {
    setCollectionIds((prev) =>
      prev.includes(colId) ? prev.filter((id) => id !== colId) : [...prev, colId],
    );
  }

  function handleRemoveCollectionClick(colId: string) {
    setCollectionToRemove(colId);
  }

  function handleConfirmRemoveCollection() {
    if (collectionToRemove) {
      setCollectionIds((prev) => prev.filter((id) => id !== collectionToRemove));
    }
    setCollectionToRemove(null);
  }

  // ── Save (bundles all local changes into a single API call) ──

  async function handleSave() {
    if (!userId) return;
    setSaving(true);
    try {
      const patch: Partial<MediaPlaintext> = {
        status,
        rating: rating || undefined,
        watched_on: watchedOn || undefined,
        review_notes: reviewNotes || undefined,
        collection_ids: collectionIds.length > 0 ? collectionIds : undefined,
      };

      if (isTracked) {
        const updated = await updateMedia(userId, localMedia!.id, patch);
        setLocalMedia(updated);
        // Update original snapshot
        setOriginalMedia({
          status: updated.status ?? "unwatched",
          rating: updated.rating ?? 0,
          watched_on: updated.watched_on ?? "",
          review_notes: updated.review_notes ?? "",
          collection_ids:
            (updated.collection_ids ?? updated.collection_id
              ? [updated.collection_id!]
              : []) as string[],
        } as MediaPlaintext);
      } else {
        const dup = findDuplicate(tmdbId, "movie", allMedia);
        if (dup) {
          const updated = await updateMedia(userId, dup.id, patch);
          setLocalMedia(updated);
          setOriginalMedia({
            status: updated.status ?? "unwatched",
            rating: updated.rating ?? 0,
            watched_on: updated.watched_on ?? "",
            review_notes: updated.review_notes ?? "",
            collection_ids:
              (updated.collection_ids ?? updated.collection_id
                ? [updated.collection_id!]
                : []) as string[],
          } as MediaPlaintext);
        } else {
          const genreIds = tmdbData?.genres?.map((g) => g.id) ?? [];
          const newMedia = await createMedia(userId, {
            tmdb_id: tmdbId,
            type: "movie",
            title,
            poster_path: tmdbData?.poster_path,
            release_date: tmdbData?.release_date,
            genre_ids: genreIds,
            status: status || "watched",
            rating: patch.rating,
            watched_on: patch.watched_on,
            review_notes: patch.review_notes,
            collection_ids: patch.collection_ids,
            runtime: tmdbData?.runtime || 0,
          });
          setLocalMedia(newMedia);
          setOriginalMedia({
            status: newMedia.status,
            rating: newMedia.rating ?? 0,
            watched_on: newMedia.watched_on ?? "",
            review_notes: newMedia.review_notes ?? "",
            collection_ids: newMedia.collection_ids ?? [],
          } as MediaPlaintext);
          setShowToast(true);
          setTimeout(() => setShowToast(false), 2000);
          onRefresh?.();
        }
      }
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  }

  // ── Navigation guards ──

  function handleCancel() {
    if (isDirty) {
      setShowUnsavedDialog(true);
      return;
    }
    doCancel();
  }

  function doCancel() {
    if (!isTracked) {
      // New tracking — revert to defaults
      setStatus("unwatched");
      setRating(0);
      setWatchedOn("");
      setReviewNotes("");
      setCollectionIds([]);
    } else if (originalMedia) {
      setStatus(originalMedia.status);
      setRating(originalMedia.rating ?? 0);
      setWatchedOn(originalMedia.watched_on ?? "");
      setReviewNotes(originalMedia.review_notes ?? "");
      setCollectionIds(originalMedia.collection_ids ?? []);
    }
  }

  function handleBackClick() {
    if (isDirty) {
      setShowUnsavedDialog(true);
      return;
    }
    router.back();
  }

  function handleDiscardAndNavigate() {
    doCancel();
    setShowUnsavedDialog(false);
    router.back();
  }

  async function handleRemove() {
    if (!localMedia) return;
    try {
      await deleteMedia(localMedia.id);
      setLocalMedia(null);
      setOriginalMedia(null);
      setAllMedia((prev) => prev.filter((m) => m.id !== localMedia.id));
      setStatus("unwatched");
      setRating(0);
      setWatchedOn("");
      setReviewNotes("");
      setCollectionIds([]);
      onRefresh?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove.");
    }
  }

  // ── Chip classes ──

  const statusColorClasses: Record<MediaPlaintext["status"], string> = {
    unwatched:
      "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700",
    watching:
      "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-700",
    watched:
      "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700",
  };

  const chipClasses = (chipStatus: MediaPlaintext["status"]) =>
    [
      "px-3 py-1 text-xs font-medium rounded-full border transition-colors",
      status === chipStatus
        ? statusColorClasses[chipStatus]
        : "border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 cursor-pointer",
    ].join(" ");

  // ── Derived ──

  const selectedCollections = collectionIds
    .map((id) => collections.find((c) => c.id === id))
    .filter(Boolean) as MediaCollection[];

  const unselectedCollections = collections.filter(
    (c) => !collectionIds.includes(c.id),
  );

  const filteredUnselected = useMemo(
    () =>
      unselectedCollections.filter((c) =>
        c.name.toLowerCase().includes(collectionSearch.toLowerCase()),
      ),
    [unselectedCollections, collectionSearch],
  );

  // ── Render ──

  if (loading) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        Loading movie details…
      </p>
    );
  }

  if (error && !tmdbData) {
    return (
      <div className="space-y-4">
        <BackButton onClick={handleBackClick} />
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BackButton onClick={handleBackClick} />

      {/* Success toast */}
      {showToast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-full bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg">
          ✓ You are now tracking this
        </div>
      )}

      {/* ── Row 1: Poster + Text ── */}
      <div className="flex flex-col md:flex-row gap-8 mb-10">
        {/* Poster */}
        <div className="w-48 md:w-64 lg:w-72 shrink-0">
          <div className="aspect-[2/3] bg-zinc-100 dark:bg-zinc-800 rounded-xl overflow-hidden relative w-full">
            {tmdbData?.poster_path ? (
              <Image
                src={`${TMDB_POSTER_BASE}${tmdbData.poster_path}`}
                alt={title}
                fill
                sizes="(max-width: 768px) 192px, (max-width: 1024px) 256px, 288px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-zinc-400 dark:text-zinc-600">
                <Film size={48} />
              </div>
            )}
          </div>
        </div>

        {/* Text */}
        <div className="flex-1 flex flex-col justify-center space-y-6">

          <div>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 mb-2">
              Movie
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
              {title} {year ? `(${year})` : ""}
            </h1>
            {tmdbData && (
              <div className="mt-3 flex items-center flex-wrap gap-2 text-base lg:text-lg font-medium text-zinc-500 dark:text-zinc-400">
                {tmdbData.content_rating && (
                  <span className="px-1.5 py-0.5 rounded border border-zinc-400 dark:border-zinc-500 text-xs font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-300">
                    {tmdbData.content_rating}
                  </span>
                )}
                <span>{tmdbData.genres.map((g) => g.name).join(", ")}</span>
                {tmdbData.runtime ? <span>• {tmdbData.runtime}m</span> : null}
              </div>
            )}
          </div>

          {tmdbData?.overview && (
            <p className="text-base lg:text-lg text-zinc-600 dark:text-zinc-300 leading-relaxed max-w-4xl">
              {tmdbData.overview}
            </p>
          )}

          {tmdbData?.watch_providers && (
            <div className="mt-6">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Streaming On</h3>
              {tmdbData.watch_providers.flatrate && tmdbData.watch_providers.flatrate.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {tmdbData.watch_providers.flatrate.map((provider) => (
                    <div key={provider.provider_id} className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1.5 pr-3 shadow-sm border border-zinc-200 dark:border-zinc-700">
                      <Image
                        src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`}
                        alt={provider.provider_name}
                        width={32} height={32}
                        className="rounded-md"
                      />
                      <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{provider.provider_name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                  Not available in India
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 2: Tracking Form ── */}
      <div className="flex justify-end mb-2">
        {isTracked && (
          <button
            type="button"
            onClick={() => setShowRemove(true)}
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm border-none transition-colors text-sm"
          >
            <X size={16} />
            Untrack this Movie
          </button>
        )}
      </div>

      <div className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 p-6 md:p-8 dark:border-zinc-800 dark:bg-zinc-900/50">
        {/* Status + Collections side-by-side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
          {/* Left: Status */}
          <div>
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">
              STATUS
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleStatusClick("unwatched")}
                className={chipClasses("unwatched")}
              >
                Not Watched
              </button>
              <button
                type="button"
                onClick={() => handleStatusClick("watching")}
                className={chipClasses("watching")}
              >
                Watching
              </button>
              <button
                type="button"
                onClick={() => handleStatusClick("watched")}
                className={chipClasses("watched")}
              >
                Watched
              </button>
              {status === "watched" && (
                <>
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 ml-1">
                    Watched on
                  </label>
                  <input
                    type="date"
                    value={watchedOn}
                    onChange={(e) => setWatchedOn(e.target.value)}
                    className="rounded-lg border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </>
              )}
            </div>
          </div>

          {/* Right: Collections */}
          <div>
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">
              COLLECTIONS
            </h3>
            <div className="flex flex-wrap gap-2">
              <div className="relative" ref={collectionPickerRef}>
                <button
                  type="button"
                  onClick={() => {
                    setShowCollectionPicker(!showCollectionPicker);
                    setCollectionSearch("");
                  }}
                  className="px-3 py-1 text-xs font-medium rounded-full border-2 border-dashed border-zinc-300 text-zinc-500 hover:border-zinc-400 hover:text-zinc-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-300 transition-colors"
                >
                  + Collection
                </button>
                {showCollectionPicker && (
                  <div className="absolute top-full left-0 mt-1 w-56 rounded-lg border border-zinc-200 bg-white shadow-lg z-10 dark:border-zinc-700 dark:bg-zinc-800 overflow-hidden">
                    {/* Fixed top section */}
                    <div className="sticky top-0 bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 p-2 space-y-2">
                      <div className="relative">
                        <input
                          type="text"
                          value={collectionSearch}
                          onChange={(e) => setCollectionSearch(e.target.value)}
                          placeholder="Search collections…"
                          className="w-full rounded-lg border border-zinc-300 bg-zinc-50 py-1.5 pl-2.5 pr-7 text-xs dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
                          autoFocus
                        />
                        {collectionSearch && (
                          <button
                            type="button"
                            onClick={() => setCollectionSearch("")}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                          >
                            ×
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCollectionPicker(false);
                          router.push(`/media/collection/new?add_tmdb_id=${tmdbId}&add_type=movie`);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/30 rounded-lg transition-colors"
                      >
                        ＋ New Collection
                      </button>
                    </div>
                    {/* Filtered list */}
                    <div className="max-h-48 overflow-y-auto py-1">
                      {filteredUnselected.length > 0 ? (
                        filteredUnselected.map((c) => (
                          (() => {
                            const t = getThemeStyles(c.color ?? "#8B5CF6");
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  handleToggleCollection(c.id);
                                  setShowCollectionPicker(false);
                                  setCollectionSearch("");
                                }}
                                className="w-full text-left px-3 py-1.5"
                              >
                                <span
                                  className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded-full border transition-opacity hover:opacity-80 ${t.titleClass}`}
                                  style={{
                                    background:
                                      (t.cardStyle.background as string) ??
                                      (t.cardStyle.backgroundColor as string) ??
                                      `${t.solidColor}20`,
                                    borderColor:
                                      (t.cardStyle.borderColor as string) ?? t.solidColor,
                                    ...t.titleStyle,
                                    ...(t.cardStyle.boxShadow
                                      ? { boxShadow: t.cardStyle.boxShadow as string }
                                      : {}),
                                  }}
                                >
                                  {c.name}
                                </span>
                              </button>
                            );
                          })()
                        ))
                      ) : (
                        <p className="px-3 py-2 text-xs text-zinc-400 dark:text-zinc-500">
                          No collections match
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {selectedCollections.map((c) => {
                const t = getThemeStyles(c.color ?? "#8B5CF6");
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => router.push(ROUTES.MEDIA_COLLECTION(c.id))}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded-full border cursor-pointer transition-opacity hover:opacity-80 ${t.titleClass}`}
                    style={{
                      background: (t.cardStyle.background as string) ?? (t.cardStyle.backgroundColor as string) ?? `${t.solidColor}20`,
                      borderColor: (t.cardStyle.borderColor as string) ?? t.solidColor,
                      ...t.titleStyle,
                      ...(t.cardStyle.boxShadow ? { boxShadow: t.cardStyle.boxShadow } : {}),
                    }}
                  >
                    {c.name}
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveCollectionClick(c.id);
                      }}
                      className="hover:text-red-500 transition-colors"
                      role="button"
                      aria-label={`Remove ${c.name}`}
                    >
                      ×
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* RATING AND COMMENTS */}
        <div>
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">
            RATING AND COMMENTS
          </h3>
          <div className="flex flex-col md:flex-row items-center gap-6">
            {/* Left: Avatar + name + rating */}
            <div className="shrink-0 space-y-3">
              <div className="flex items-center gap-3">
                {userAvatarUrl ? (
                  <Image
                    src={userAvatarUrl}
                    alt={userName ?? ""}
                    width={40}
                    height={40}
                    className="w-10 h-10 rounded-full object-cover"
                  />
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

            {/* Right: Textarea with formatting toolbar */}
            <div className="flex-1 min-w-0">
              {/* Formatting toolbar */}
              <div className="flex items-center gap-0.5 mb-2">
                <button
                  type="button"
                  onClick={() => {
                    setReviewNotes((prev) => prev + "**bold**");
                  }}
                  className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 transition-colors"
                  title="Bold"
                >
                  <Bold size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReviewNotes((prev) => prev + "*italic*");
                  }}
                  className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 transition-colors"
                  title="Italic"
                >
                  <Italic size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReviewNotes((prev) => prev + "<u>underline</u>");
                  }}
                  className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 transition-colors"
                  title="Underline"
                >
                  <Underline size={15} />
                </button>
                <span className="w-px h-4 bg-zinc-300 dark:bg-zinc-600 mx-0.5" />
                <button
                  type="button"
                  onClick={() => {
                    setReviewNotes((prev) => prev + "\n- ");
                  }}
                  className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 transition-colors"
                  title="Bullet list"
                >
                  <List size={15} />
                </button>
              </div>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={5}
                placeholder="Your thoughts on this movie..."
                className="w-full min-h-[120px] rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 resize-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Action Bar ── */}
      <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-sm border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-2">
        <Button
          variant="secondary"
          size="md"
          onClick={handleCancel}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={handleSave}
          disabled={saving || !isDirty}
        >
          {saving ? "Saving…" : isDirty ? "Save *" : "Save"}
        </Button>
      </div>

      {/* Remove confirmation */}
      {showRemove && (
        <ConfirmDialog
          title="Remove from Tracker"
          description="This will permanently delete all ratings, comments, and tracking data for this movie."
          confirmLabel="Remove"
          onConfirm={() => {
            setShowRemove(false);
            handleRemove();
          }}
          onCancel={() => setShowRemove(false)}
        />
      )}

      {/* Unsaved changes guard */}
      {showUnsavedDialog && (
        <ConfirmDialog
          title="Unsaved Changes"
          description="You have unsaved tracking data. Discard changes?"
          confirmLabel="Discard"
          cancelLabel="Keep Editing"
          onConfirm={handleDiscardAndNavigate}
          onCancel={() => setShowUnsavedDialog(false)}
        />
      )}

      {/* Collection removal warning */}
      {collectionToRemove && (
        <ConfirmDialog
          title="Remove from Collection"
          description="Are you sure you want to remove this title from the collection?"
          confirmLabel="Remove"
          cancelLabel="Cancel"
          onConfirm={handleConfirmRemoveCollection}
          onCancel={() => setCollectionToRemove(null)}
        />
      )}
    </div>
  );
}
