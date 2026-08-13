"use client";

import { useState, useEffect, useMemo, useCallback, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { ROUTES } from "@/routes/paths";
import BackButton from "@/components/common/BackButton";
import ErrorBanner from "@/components/common/ErrorBanner";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import type { Media, MediaCollection, MediaPlaintext, TmdbDetails } from "@/types/media";
import { useNavigationGuard } from "@/hooks/useNavigationGuard";
import { useMediaTracking } from "@/hooks/useMediaTracking";
import MediaHeroSection from "@/components/media/shared/MediaHeroSection";
import StatusChipGroup from "@/components/media/shared/StatusChipGroup";
import CollectionPicker from "@/components/media/shared/CollectionPicker";
import ReviewSection from "@/components/media/shared/ReviewSection";
import StickyActionBar from "@/components/media/shared/StickyActionBar";
import UntrackConfirmation from "@/components/media/shared/UntrackConfirmation";
import Toast from "@/components/common/Toast";

interface GenericMediaPageProps {
  tmdbId: number;
  userId: string;
  userName?: string;
  userAvatarUrl?: string;
  collections: MediaCollection[];
  onRefresh?: () => void;

  /** "movie" | "tv" — drives runtime calculation and TMDB lookups */
  mediaType: "movie" | "tv";

  /** Icon shown in the hero when no poster is available */
  fallbackIcon: ReactNode;
  /** Label shown in the hero badge (e.g. "Movie", "TV Series") */
  typeLabel: string;

  // ── Movie-specific ──

  /** When true, manages `watchedOn` state internally and shows the date input */
  showWatchedOn?: boolean;

  // ── TV-specific slots ──

  /**
   * When provided, renders a "Media Tracker" / "Episodes" tab bar.
   * Can be a ReactNode or a render function that receives the current
   * parent status (so episode cards can compute virtual status correctly).
   */
  episodeSlot?:
    | ReactNode
    | ((status: MediaPlaintext["status"] | undefined) => ReactNode);

  // ── TV-specific overrides ──

  /** OR'd with internal `isDirty` — set by TV wrapper when episodes changed */
  extraDirty?: boolean;
  /** Called inside `doCancel` so the TV wrapper can reset episode state */
  onExtraCancel?: () => void;
  /** Merged into the patch object sent to `save()` */
  extraPatchFields?: Partial<MediaPlaintext>;
  /** Merged into `extraCreateFields` when creating a new media record */
  extraCreateFields?: Partial<MediaPlaintext>;
  /**
   * Intercepts status-chip clicks. The wrapper can show a conflict dialog
   * and only call `apply()` when the user confirms (or immediately if no
   * conflicts). When not provided, the status is set directly.
   */
  onStatusChange?: (
    newStatus: MediaPlaintext["status"],
    apply: () => void,
  ) => void;

  // ── Hydration / TMDB callbacks ──

  /** Called after `load()` completes so the TV wrapper can hydrate episode state */
  onHydrate?: (existingMedia: Media | undefined) => void;
  /** Called when TMDB data is available so the TV wrapper can read season count */
  onTmdbReady?: (data: TmdbDetails) => void;
}

/**
 * Generic media tracking page shared by Movie and TV Series detail views.
 *
 * Absorbs all shared state: status, rating, review notes, collection picker,
 * navigation guard, save/remove orchestration, and shared UI (hero, action bar,
 * dialogs). The remaining differences between movie and TV are handled via
 * optional props:
 *   - `showWatchedOn` → movie-only "watched on" date field
 *   - `episodeSlot` + TV override props → TV-only episode tracking matrix
 */
export default function GenericMediaPage({
  tmdbId,
  userId,
  userName,
  userAvatarUrl,
  collections,
  onRefresh,
  mediaType,
  fallbackIcon,
  typeLabel,
  showWatchedOn = false,
  episodeSlot,
  extraDirty = false,
  onExtraCancel,
  extraPatchFields,
  extraCreateFields: extraCreateFieldsProp,
  onStatusChange,
  onHydrate,
  onTmdbReady,
}: GenericMediaPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── Context-aware back navigation ──
  // The originating view passes ?from=collection&colId=… (or ?from=discover)
  // so Back returns to that context instead of always landing on My Media.
  const from = searchParams.get("from");
  const colId = searchParams.get("colId");
  const fallbackRoute =
    from === "collection" && colId
      ? ROUTES.MEDIA_COLLECTION(colId)
      : from === "discover"
        ? `${ROUTES.MEDIA}?tab=discover`
        : `${ROUTES.MEDIA}?tab=manager`;

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
    clearError,
  } = useMediaTracking({ tmdbId, userId, type: mediaType, onRefresh });

  // ── Local form state ──
  const [status, setStatus] = useState<MediaPlaintext["status"] | undefined>(
    undefined,
  );
  const [rating, setRating] = useState(0);
  const [watchedOn, setWatchedOn] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [collectionIds, setCollectionIds] = useState<string[]>([]);

  // ── Original snapshot for isDirty ──
  const [originalMedia, setOriginalMedia] = useState<MediaPlaintext | null>(
    null,
  );

  // ── Remove flows ──
  const [showRemove, setShowRemove] = useState(false);
  const [collectionToRemove, setCollectionToRemove] = useState<string | null>(
    null,
  );

  const handleRemove = () => {
    setShowRemove(false);
    removeMedia(() => {
      setOriginalMedia(null);
      setStatus(undefined);
      setRating(0);
      setWatchedOn("");
      setReviewNotes("");
      setCollectionIds([]);
      onExtraCancel?.();
    });
  };

  const isTracked = localMedia !== null;
  const title =
    localMedia?.title ??
    tmdbData?.title ??
    tmdbData?.name ??
    (mediaType === "movie" ? "Movie" : "TV Series");
  const year = tmdbData?.release_date
    ? new Date(tmdbData.release_date).getFullYear()
    : "";

  // ── Tab state (only used when episodeSlot is provided) ──
  const activeTab =
    searchParams.get("tab") === "episodes" ? "episodes" : "tracking";
  const setActiveTab = useCallback(
    (tab: "tracking" | "episodes") => {
      const params = new URLSearchParams();
      params.set("tab", tab);
      // Preserve navigation-context params so Back still returns to the
      // originating collection / discover view after switching tabs.
      if (from) params.set("from", from);
      if (colId) params.set("colId", colId);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, from, colId],
  );

  // ── Load & hydrate ──
  useEffect(() => {
    load().then((result) => {
      if (!result) return;
      const existing = result.existingMedia;
      if (existing) {
        setStatus(existing.status);
        setRating(existing.rating ?? 0);
        setWatchedOn(existing.watched_on ?? "");
        setReviewNotes(existing.review_notes ?? "");
        const ids =
          existing.collection_ids ??
          (existing.collection_id ? [existing.collection_id] : []);
        setCollectionIds(ids);
        setOriginalMedia({
          status: existing.status,
          rating: existing.rating ?? 0,
          watched_on: existing.watched_on ?? "",
          review_notes: existing.review_notes ?? "",
          collection_ids: ids.length > 0 ? [...ids].sort() : undefined,
        } as MediaPlaintext);
      } else {
        setOriginalMedia(null);
      }
      // Let the TV wrapper hydrate episode state + read TMDB data
      onHydrate?.(existing);
      onTmdbReady?.(result.details);
    });
  }, [load, tmdbId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── isDirty ──
  const isDirty = useMemo(() => {
    const baseDirty = (() => {
      if (!isTracked) {
        return (
          status !== undefined ||
          rating !== 0 ||
          (showWatchedOn && watchedOn !== "") ||
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
        (showWatchedOn &&
          watchedOn !== (originalMedia.watched_on ?? "")) ||
        reviewNotes !== (originalMedia.review_notes ?? "") ||
        sortedCurrentIds.length !== sortedOrigIds.length ||
        sortedCurrentIds.some((id, i) => id !== sortedOrigIds[i])
      );
    })();
    return baseDirty || extraDirty;
  }, [
    isTracked,
    originalMedia,
    status,
    rating,
    watchedOn,
    reviewNotes,
    collectionIds,
    showWatchedOn,
    extraDirty,
  ]);

  // ── Navigation guard ──
  function doCancel() {
    if (!isTracked) {
      setStatus(undefined);
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
    onExtraCancel?.();
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
    fallbackRoute,
  });

  // ── Handlers ──

  function handleStatusClick(newStatus: MediaPlaintext["status"]) {
    const apply = () => {
      setStatus(newStatus);
      if (showWatchedOn && newStatus === "watched" && !watchedOn) {
        const today = new Date().toISOString().split("T")[0];
        setWatchedOn(today);
      }
    };

    if (onStatusChange) {
      onStatusChange(newStatus, apply);
      return;
    }

    apply();
  }

  function handleRatingChange(newRating: number) {
    setRating(newRating);
    if (!isTracked && newRating > 0) {
      setStatus("watched");
      if (showWatchedOn && !watchedOn) {
        const today = new Date().toISOString().split("T")[0];
        setWatchedOn(today);
      }
    }
  }

  function handleToggleCollection(colId: string) {
    setCollectionIds((prev) =>
      prev.includes(colId)
        ? prev.filter((id) => id !== colId)
        : [...prev, colId],
    );
  }

  function handleRemoveCollectionClick(colId: string) {
    setCollectionToRemove(colId);
  }

  function handleConfirmRemoveCollection() {
    if (collectionToRemove) {
      setCollectionIds((prev) =>
        prev.filter((id) => id !== collectionToRemove),
      );
    }
    setCollectionToRemove(null);
  }

  // ── Save ──

  async function handleSave() {
    // Default untracked saves to "unwatched" so the create path always stores
    // a concrete status (a bare undefined would override the "watched" create
    // default and JSON.stringify would drop the field from the blob entirely).
    // For tracked media the hydrated status is always used; undefined only
    // occurs for legacy records that have no stored status, which we leave
    // untouched so the updateMedia merge preserves the record as-is.
    const effectiveStatus = status ?? (!isTracked ? "unwatched" : undefined);

    const patch: Partial<MediaPlaintext> = {
      status: effectiveStatus,
      rating: rating || undefined,
      review_notes: reviewNotes || undefined,
      collection_ids: collectionIds.length > 0 ? collectionIds : undefined,
    };

    if (showWatchedOn) {
      patch.watched_on = watchedOn || undefined;
    }

    // Merge TV-specific patch fields (e.g. episodes)
    if (extraPatchFields) {
      Object.assign(patch, extraPatchFields);
    }

    const genreIds = tmdbData?.genres?.map((g) => g.id) ?? [];

    // Compute runtime based on media type
    let runtime = 0;
    if (mediaType === "movie") {
      runtime = tmdbData?.runtime || 0;
    } else {
      const avgEpisodeLength = tmdbData?.episode_run_time?.[0] || 45;
      runtime =
        (tmdbData?.number_of_episodes || 1) * avgEpisodeLength;
    }

    const baseCreateFields: Partial<MediaPlaintext> = {
      title,
      poster_path: tmdbData?.poster_path,
      release_date: tmdbData?.release_date,
      genre_ids: genreIds,
      status: status || "watched",
      runtime,
    };

    // Merge TV-specific create fields (e.g. episodes)
    const finalCreateFields: Partial<MediaPlaintext> = {
      ...baseCreateFields,
      ...extraCreateFieldsProp,
    };

    const result = await save(patch, finalCreateFields);
    if (result) {
      const savedStatus = result.status ?? effectiveStatus ?? "unwatched";
      setStatus(savedStatus);
      setOriginalMedia({
        status: savedStatus,
        rating: result.rating ?? 0,
        watched_on: result.watched_on ?? "",
        review_notes: result.review_notes ?? "",
        // Snapshot the local collectionIds state, not the API response — the
        // response may not echo collection_ids back (e.g. legacy records with
        // only collection_id), which would desync the snapshot from local
        // state and trigger a false "Unsaved Changes" warning after a save.
        collection_ids:
          collectionIds.length > 0 ? [...collectionIds].sort() : undefined,
      } as MediaPlaintext);
    }
  }

  // ── Render ──

  if (loading) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        Loading {typeLabel.toLowerCase()} details…
      </p>
    );
  }

  if (error && !tmdbData) {
    return (
      <div className="space-y-4">
        <BackButton onClick={handleBackClick} />
        <ErrorBanner
          message={error}
          onRetry={() => {
            clearError();
            load();
          }}
        />
      </div>
    );
  }

  const untrackLabel =
    mediaType === "movie" ? "Untrack this Movie" : "Untrack this TV Series";

  const hasEpisodes = Boolean(episodeSlot);

  return (
    <div className="space-y-4">
      <BackButton onClick={handleBackClick} />

      <Toast
        isVisible={toastConfig.isVisible}
        message={toastConfig.message}
        type={toastConfig.type}
      />

      {/* ── Hero Section ── */}
      <MediaHeroSection
        posterPath={tmdbData?.poster_path}
        typeLabel={typeLabel}
        title={title}
        year={year}
        genres={tmdbData?.genres ?? []}
        overview={tmdbData?.overview}
        contentRating={tmdbData?.content_rating}
        runtime={mediaType === "movie" ? tmdbData?.runtime : undefined}
        watchProviders={tmdbData?.watch_providers}
        fallbackIcon={fallbackIcon}
      />

      {/* ── Row 2: Untrack button ── */}
      <div className="flex justify-end mb-2">
        {isTracked && (
          <button
            type="button"
            onClick={() => setShowRemove(true)}
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm border-none transition-colors text-sm"
          >
            <X size={16} />
            {untrackLabel}
          </button>
        )}
      </div>

      {/* ── Tracking Card (with optional episode tabs) ── */}
      <div className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 p-6 md:p-8 dark:border-zinc-800 dark:bg-zinc-900/50 mb-48">
        {/* Tab bar — only shown when episodeSlot is provided (TV) */}
        {hasEpisodes && (
          <div className="flex gap-6 border-b border-zinc-200 dark:border-zinc-800 mb-6">
            <button
              type="button"
              onClick={() => setActiveTab("tracking")}
              className={`pb-3 text-sm font-semibold transition-colors ${
                activeTab === "tracking"
                  ? "border-b-2 border-violet-600 text-violet-600 dark:border-violet-400 dark:text-violet-400"
                  : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
              }`}
            >
              Media Tracker
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("episodes")}
              className={`pb-3 text-sm font-semibold transition-colors ${
                activeTab === "episodes"
                  ? "border-b-2 border-violet-600 text-violet-600 dark:border-violet-400 dark:text-violet-400"
                  : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
              }`}
            >
              Episodes
            </button>
          </div>
        )}

        {/* ── Tracking Pane ── */}
        {(!hasEpisodes || activeTab === "tracking") && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
              <StatusChipGroup
                status={status}
                onStatusChange={handleStatusClick}
                showWatchedOn={showWatchedOn}
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
                    newCollectionHref={`/media/collection/new_collection?add_tmdb_id=${tmdbId}&add_type=${mediaType}`}
                  />
                </div>
              </div>
            </div>

            <ReviewSection
              rating={rating}
              onRatingChange={handleRatingChange}
              reviewNotes={reviewNotes}
              onReviewNotesChange={setReviewNotes}
              userName={userName}
              userAvatarUrl={userAvatarUrl}
            />
          </>
        )}

        {/* ── Episodes Pane ── */}
        {hasEpisodes &&
          activeTab === "episodes" &&
          (typeof episodeSlot === "function"
            ? episodeSlot(status)
            : episodeSlot)}
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
        mediaType={mediaType}
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
