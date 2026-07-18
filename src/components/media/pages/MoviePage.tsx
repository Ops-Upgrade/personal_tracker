"use client";

import { useState, useEffect, useMemo } from "react";
import { Film, X } from "lucide-react";
import { ROUTES } from "@/routes/paths";
import BackButton from "@/components/common/BackButton";
import ErrorBanner from "@/components/common/ErrorBanner";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import type { MediaCollection, MediaPlaintext } from "@/types/media";
import { useNavigationGuard } from "@/hooks/useNavigationGuard";
import { useMediaTracking } from "@/hooks/useMediaTracking";
import MediaHeroSection from "@/components/media/shared/MediaHeroSection";
import StatusChipGroup from "@/components/media/shared/StatusChipGroup";
import CollectionPicker from "@/components/media/shared/CollectionPicker";
import ReviewSection from "@/components/media/shared/ReviewSection";
import StickyActionBar from "@/components/media/shared/StickyActionBar";
import UntrackConfirmation from "@/components/media/shared/UntrackConfirmation";
import Toast from "@/components/media/shared/Toast";

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
  // ── Data fetching via shared hook ──
  const {
    tmdbData,
    localMedia,
    loading,
    error,
    saving,
    toastConfig,
    load,
    save,
    removeMedia,
    setLocalMedia,
    setAllMedia,
  } = useMediaTracking({ tmdbId, userId, type: "movie", onRefresh });

  // ── Local form state ──
  const [status, setStatus] = useState<MediaPlaintext["status"]>("unwatched");
  const [rating, setRating] = useState(0);
  const [watchedOn, setWatchedOn] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [collectionIds, setCollectionIds] = useState<string[]>([]);

  // ── Original snapshot for isDirty ──
  const [originalMedia, setOriginalMedia] = useState<MediaPlaintext | null>(null);

  // ── Remove flows ──
  const [showRemove, setShowRemove] = useState(false);
  const [collectionToRemove, setCollectionToRemove] = useState<string | null>(null);

  const handleRemove = () => {
    setShowRemove(false);
    removeMedia(() => {
      setOriginalMedia(null);
      setStatus("unwatched");
      setRating(0);
      setWatchedOn("");
      setReviewNotes("");
      setCollectionIds([]);
    });
  };

  const isTracked = localMedia !== null;
  const title = localMedia?.title ?? tmdbData?.title ?? "Movie";
  const year = tmdbData?.release_date
    ? new Date(tmdbData.release_date).getFullYear()
    : "";

  // ── Load & hydrate ──
  useEffect(() => {
    load().then((result) => {
      if (!result) return;
      const existing = result.existingMedia;
      if (existing) {
        setStatus(existing.status ?? "unwatched");
        setRating(existing.rating ?? 0);
        setWatchedOn(existing.watched_on ?? "");
        setReviewNotes(existing.review_notes ?? "");
        const ids =
          existing.collection_ids ??
          (existing.collection_id ? [existing.collection_id] : []);
        setCollectionIds(ids);
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
    });
  }, [load, tmdbId]);

  // ── isDirty ──
  const isDirty = useMemo(() => {
    if (!isTracked) {
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

  // ── Navigation guard ──
  function doCancel() {
    if (!isTracked) {
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

  // ── Handlers ──

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

  // ── Save ──

  async function handleSave() {
    const patch: Partial<MediaPlaintext> = {
      status,
      rating: rating || undefined,
      watched_on: watchedOn || undefined,
      review_notes: reviewNotes || undefined,
      collection_ids: collectionIds.length > 0 ? collectionIds : undefined,
    };

    const genreIds = tmdbData?.genres?.map((g) => g.id) ?? [];
    const extraCreateFields: Partial<MediaPlaintext> = {
      title,
      poster_path: tmdbData?.poster_path,
      release_date: tmdbData?.release_date,
      genre_ids: genreIds,
      status: status || "watched",
      runtime: tmdbData?.runtime || 0,
    };

    const result = await save(patch, extraCreateFields);
    if (result) {
      setOriginalMedia({
        status: result.status ?? "unwatched",
        rating: result.rating ?? 0,
        watched_on: result.watched_on ?? "",
        review_notes: result.review_notes ?? "",
        collection_ids:
          (result.collection_ids ?? result.collection_id
            ? [result.collection_id!]
            : []) as string[],
      } as MediaPlaintext);
    }
  }

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
        <ErrorBanner message={error} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BackButton onClick={handleBackClick} />

      <Toast isVisible={toastConfig.isVisible} message={toastConfig.message} type={toastConfig.type} />

      {/* ── Hero Section ── */}
      <MediaHeroSection
        posterPath={tmdbData?.poster_path}
        typeLabel="Movie"
        title={title}
        year={year}
        genres={tmdbData?.genres ?? []}
        overview={tmdbData?.overview}
        contentRating={tmdbData?.content_rating}
        runtime={tmdbData?.runtime}
        watchProviders={tmdbData?.watch_providers}
        fallbackIcon={<Film size={48} />}
      />

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
          <StatusChipGroup
            status={status}
            onStatusChange={handleStatusClick}
            showWatchedOn
            watchedOn={watchedOn}
            onWatchedOnChange={setWatchedOn}
          />

          {/* Collections */}
          <div>
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">
              COLLECTIONS
            </h3>
            <div className="flex flex-wrap gap-2">
              <CollectionPicker
                collections={collections}
                selectedIds={collectionIds}
                onToggle={handleToggleCollection}
                onRemoveClick={handleRemoveCollectionClick}
                newCollectionHref={`/media/collection/new?add_tmdb_id=${tmdbId}&add_type=movie`}
              />
            </div>
          </div>
        </div>

        {/* Rating and comments */}
        <ReviewSection
          rating={rating}
          onRatingChange={handleRatingChange}
          reviewNotes={reviewNotes}
          onReviewNotesChange={setReviewNotes}
          userName={userName}
          userAvatarUrl={userAvatarUrl}
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
        mediaType="movie"
        onConfirm={handleRemove}
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
