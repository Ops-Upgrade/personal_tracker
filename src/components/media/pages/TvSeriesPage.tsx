"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Tv, X, Star, MessageSquare } from "lucide-react";
import { ROUTES } from "@/routes/paths";
import BackButton from "@/components/common/BackButton";
import ErrorBanner from "@/components/common/ErrorBanner";
import ViewToggle from "@/components/common/ViewToggle";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { useLocalStorage } from "@/lib/useLocalStorage";
import {
  getSeasonDetails,
  formatEpisodeKey,
  getEffectiveEpisodeStatus,
} from "@/api/media";
import type {
  TmdbSeasonDetails,
  Media,
  MediaCollection,
  MediaPlaintext,
  EpisodeTracking,
} from "@/types/media";
import { useNavigationGuard } from "@/hooks/useNavigationGuard";
import { useMediaTracking } from "@/hooks/useMediaTracking";
import MediaHeroSection from "@/components/media/shared/MediaHeroSection";
import StatusChipGroup from "@/components/media/shared/StatusChipGroup";
import CollectionPicker from "@/components/media/shared/CollectionPicker";
import ReviewSection from "@/components/media/shared/ReviewSection";
import StickyActionBar from "@/components/media/shared/StickyActionBar";
import UntrackConfirmation from "@/components/media/shared/UntrackConfirmation";
import Toast from "@/components/common/Toast";
import { tmdbStillUrl } from "@/components/media/constants";
import StatusBadge from "@/components/media/shared/StatusBadge";

interface TvSeriesPageProps {
  tmdbId: number;
  userId: string;
  userName?: string;
  userAvatarUrl?: string;
  collections: MediaCollection[];
  onRefresh?: () => void;
}

export default function TvSeriesPage({
  tmdbId,
  userId,
  userName,
  userAvatarUrl,
  collections,
  onRefresh,
}: TvSeriesPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setLocalMedia,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setAllMedia,
  } = useMediaTracking({ tmdbId, userId, type: "tv", onRefresh });

  // ── Local form state ──
  const [parentStatus, setParentStatus] =
    useState<MediaPlaintext["status"] | undefined>(undefined);
  const [rating, setRating] = useState(0);
  const [reviewNotes, setReviewNotes] = useState("");
  const [collectionIds, setCollectionIds] = useState<string[]>([]);

  // Snapshot for isDirty
  const [originalMedia, setOriginalMedia] = useState<MediaPlaintext | null>(null);

  // Remove / collection flows
  const [showRemove, setShowRemove] = useState(false);
  const [collectionToRemove, setCollectionToRemove] = useState<string | null>(null);

  const handleRemove = () => {
    setShowRemove(false);
    removeMedia(() => {
      setOriginalMedia(null);
      setParentStatus(undefined);
      setRating(0);
      setReviewNotes("");
      setCollectionIds([]);
      setEpisodeState({});
    });
  };

  // Tab switcher
  const activeTab =
    searchParams.get("tab") === "episodes" ? "episodes" : "tracking";
  const setActiveTab = useCallback(
    (tab: "tracking" | "episodes") => {
      router.replace(`?tab=${tab}`, { scroll: false });
    },
    [router],
  );

  // Season + episode state
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [seasonData, setSeasonData] = useState<TmdbSeasonDetails | null>(null);
  const [viewMode, setViewMode] = useLocalStorage<"detail" | "tile">(
    "mediaEpisodeLayout",
    "detail",
  );
  const [episodeState, setEpisodeState] = useState<
    Record<string, EpisodeTracking>
  >({});

  // Conflict dialog — shown when manually overriding parent status would
  // wipe individually-tracked episode records
  const [overrideConfig, setOverrideConfig] = useState<{
    show: boolean;
    targetStatus: string | null;
    conflictCount: number;
  }>({ show: false, targetStatus: null, conflictCount: 0 });

  const seasonCount = tmdbData?.number_of_seasons ?? 10;
  const isTracked = localMedia !== null;
  const title = localMedia?.title ?? tmdbData?.name ?? "TV Series";
  const year = tmdbData?.release_date
    ? new Date(tmdbData.release_date).getFullYear()
    : "";

  // ── Load & hydrate ──
  const hydrateFromExisting = useCallback((existing: Media | undefined) => {
    if (existing) {
      setParentStatus(existing.status);
      setRating(existing.rating ?? 0);
      setReviewNotes(existing.review_notes ?? "");
      const ids =
        existing.collection_ids ??
        (existing.collection_id ? [existing.collection_id] : []);
      setCollectionIds(ids);
      setEpisodeState(existing.episodes ?? {});
      setOriginalMedia({
        status: existing.status,
        rating: existing.rating ?? 0,
        review_notes: existing.review_notes ?? "",
        collection_ids: ids.length > 0 ? [...ids].sort() : undefined,
        episodes: existing.episodes ?? {},
      } as MediaPlaintext);
    }
  }, [setParentStatus, setRating, setReviewNotes, setCollectionIds, setEpisodeState, setOriginalMedia]);

  useEffect(() => {
    load().then((result) => {
      if (!result) return;
      if (result.existingMedia) {
        hydrateFromExisting(result.existingMedia);
      } else {
        setOriginalMedia(null);
      }
    });
  }, [load, tmdbId, hydrateFromExisting]);

  // Load season data
  useEffect(() => {
    let cancelled = false;
    async function loadSeason() {
      try {
        const data = await getSeasonDetails(tmdbId, selectedSeason);
        if (!cancelled) setSeasonData(data);
      } catch {
        /* non-fatal */
      }
    }
    loadSeason();
    return () => {
      cancelled = true;
    };
  }, [tmdbId, selectedSeason]);

  // ── isDirty ──
  const isDirty = useMemo(() => {
    if (!isTracked) {
      return (
        parentStatus !== undefined ||
        rating !== 0 ||
        reviewNotes !== "" ||
        collectionIds.length > 0 ||
        Object.keys(episodeState).length > 0
      );
    }
    if (!originalMedia) return false;
    const sortedCurrentIds = [...collectionIds].sort();
    const sortedOrigIds = [...(originalMedia.collection_ids ?? [])].sort();
    const metadataChanged =
      parentStatus !== originalMedia.status ||
      rating !== (originalMedia.rating ?? 0) ||
      reviewNotes !== (originalMedia.review_notes ?? "") ||
      sortedCurrentIds.length !== sortedOrigIds.length ||
      sortedCurrentIds.some((id, i) => id !== sortedOrigIds[i]);
    const episodesChanged =
      JSON.stringify(episodeState) !==
      JSON.stringify(
        (originalMedia as unknown as Record<string, unknown>).episodes ?? {},
      );
    return metadataChanged || episodesChanged;
  }, [isTracked, originalMedia, parentStatus, rating, reviewNotes, collectionIds, episodeState]);

  // ── Navigation guard ──
  function doCancel() {
    if (!isTracked) {
      setParentStatus(undefined);
      setRating(0);
      setReviewNotes("");
      setCollectionIds([]);
      setEpisodeState({});
    } else if (originalMedia) {
      setParentStatus(originalMedia.status);
      setRating(originalMedia.rating ?? 0);
      setReviewNotes(originalMedia.review_notes ?? "");
      setCollectionIds(originalMedia.collection_ids ?? []);
      setEpisodeState(
        (originalMedia as unknown as Record<string, unknown>)
          .episodes as Record<string, EpisodeTracking> ?? {},
      );
    }
  }

  const {
    showUnsavedDialog,
    handleCancel,
    handleBackClick,
    handleDiscardAndNavigate,
    closeUnsavedDialog,
    navigateTo,
  } = useNavigationGuard({
    isDirty,
    doCancel,
    fallbackRoute: `${ROUTES.MEDIA}?tab=manager`,
  });

  // ── Parent-level handlers ──

  function handleParentStatusClick(newStatus: MediaPlaintext["status"]) {
    if (!newStatus) return;

    // If the user is forcing the parent to "Watched", find any explicitly tracked
    // episodes that contradict it.
    let conflictCount = 0;
    if (newStatus === "watched") {
      conflictCount = Object.values(episodeState).filter(ep => ep.status && ep.status !== "watched").length;
    } else if (newStatus === "unwatched") {
      conflictCount = Object.values(episodeState).filter(ep => ep.status && ep.status !== "unwatched").length;
    }
    // Note: Transitioning the parent to "watching" inherently allows mixed episode
    // states, so no conflict check is necessary.

    if (conflictCount > 0) {
      // Show confirmation dialog — user must explicitly approve clearing episode records
      setOverrideConfig({
        show: true,
        targetStatus: newStatus,
        conflictCount,
      });
      return;
    }

    // No conflicts — apply parent status atomically (same synchronous block
    // so that a single handleSave call patches both changes in one DB write)
    setParentStatus(newStatus);
  }

  function handleConfirmOverride() {
    const targetStatus = overrideConfig.targetStatus;
    if (!targetStatus) return;

    // Atomically: set parent status AND clear conflicting episode records
    setParentStatus(targetStatus as MediaPlaintext["status"]);
    setEpisodeState((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (next[key].status && next[key].status !== targetStatus) {
          delete next[key];
        }
      }
      return next;
    });
    setOverrideConfig({ show: false, targetStatus: null, conflictCount: 0 });
  }

  function handleCancelOverride() {
    setOverrideConfig({ show: false, targetStatus: null, conflictCount: 0 });
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

  function handleParentRatingChange(newRating: number) {
    setRating(newRating);
    if (!isTracked && newRating > 0) {
      setParentStatus("watched");
    }
  }

  // ── Save ──

  async function handleSave() {
    const patch: Partial<MediaPlaintext> = {
      status: parentStatus,
      rating: rating || undefined,
      review_notes: reviewNotes || undefined,
      collection_ids: collectionIds.length > 0 ? collectionIds : undefined,
      episodes: Object.keys(episodeState).length > 0 ? episodeState : undefined,
    };

    const genreIds = tmdbData?.genres?.map((g) => g.id) ?? [];
    const avgEpisodeLength = tmdbData?.episode_run_time?.[0] || 45;
    const totalRuntime =
      (tmdbData?.number_of_episodes || 1) * avgEpisodeLength;

    const extraCreateFields: Partial<MediaPlaintext> = {
      title,
      poster_path: tmdbData?.poster_path,
      release_date: tmdbData?.release_date,
      genre_ids: genreIds,
      status: parentStatus,
      episodes: patch.episodes ?? {},
      runtime: totalRuntime,
    };

    const result = await save(patch, extraCreateFields);
    if (result) {
      setParentStatus(result.status ?? "unwatched");
      setEpisodeState(result.episodes ?? {});
      setOriginalMedia({
        status: result.status ?? "unwatched",
        rating: result.rating ?? 0,
        review_notes: result.review_notes ?? "",
        collection_ids: result.collection_ids ?? (result.collection_id ? [result.collection_id] : []),
        episodes: result.episodes ?? {},
      } as MediaPlaintext);
    }
  }

  // ── Render ──

  if (loading) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        Loading TV series details…
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
        typeLabel="TV Series"
        title={title}
        year={year}
        genres={tmdbData?.genres ?? []}
        overview={tmdbData?.overview}
        contentRating={tmdbData?.content_rating}
        watchProviders={tmdbData?.watch_providers}
        fallbackIcon={<Tv size={48} />}
      />

      {/* ── Untrack button ── */}
      <div className="flex justify-end mb-2">
        {isTracked && (
          <button
            type="button"
            onClick={() => setShowRemove(true)}
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm border-none transition-colors text-sm"
          >
            <X size={16} />
            Untrack this TV Series
          </button>
        )}
      </div>

      {/* ── Tabbed Tracking Card ── */}
      <div className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 p-6 md:p-8 dark:border-zinc-800 dark:bg-zinc-900/50">
        {/* Tab bar */}
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

        {/* ── Tab: Show Details ── */}
        {activeTab === "tracking" && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
              <StatusChipGroup
                status={parentStatus}
                onStatusChange={handleParentStatusClick}
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
                    newCollectionHref={`/media/collection/new_collection?add_tmdb_id=${tmdbId}&add_type=tv`}
                  />
                </div>
              </div>
            </div>

            <ReviewSection
              rating={rating}
              onRatingChange={handleParentRatingChange}
              reviewNotes={reviewNotes}
              onReviewNotesChange={setReviewNotes}
              userName={userName}
              userAvatarUrl={userAvatarUrl}
            />
          </>
        )}

        {/* ── Tab: Episodes ── */}
        {activeTab === "episodes" && (
          <div className="flex flex-col md:flex-row gap-6">
            {/* Sidebar: Seasons */}
            <aside className="w-full md:w-48 shrink-0 md:border-r border-zinc-200 dark:border-zinc-800 md:pr-4">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">
                Seasons
              </h3>
              <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
                {Array.from({ length: seasonCount }, (_, i) => i + 1).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSelectedSeason(s)}
                    className={`whitespace-nowrap text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedSeason === s
                        ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
                        : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    }`}
                  >
                    Season {s}
                  </button>
                ))}
              </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Season {selectedSeason}
                </h3>
                <ViewToggle value={viewMode} onChange={setViewMode} variant="media" />
              </div>

              {/* Episode cards */}
              <div
                className={
                  viewMode === "detail"
                    ? "flex flex-col gap-4"
                    : "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
                }
              >
                {seasonData?.episodes?.map((ep) => {
                  const key = formatEpisodeKey(selectedSeason, ep.episode_number);
                  const rawLocal = episodeState[key];
                  const { status, isVirtual } = getEffectiveEpisodeStatus(parentStatus, rawLocal?.status);
                  const local = {
                    ...rawLocal,
                    status,
                  };
                  const stillUrl = ep.still_path
                    ? tmdbStillUrl(ep.still_path, "w300")
                    : null;

                  return (
                    <div
                      key={key}
                      onClick={() =>
                        navigateTo(
                          `/media/tv/${tmdbId}/episode/${selectedSeason}/${ep.episode_number}`,
                        )
                      }
                      className={
                        viewMode === "detail"
                          ? "group cursor-pointer rounded-xl border border-zinc-200 bg-white transition-all hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/50 hover:border-violet-300 dark:hover:border-violet-700 overflow-hidden flex flex-col sm:flex-row gap-4 p-3"
                          : "relative group cursor-pointer h-full z-0 hover:z-[60]"
                      }
                    >
                      {viewMode === "detail" ? (
                        <>
                          <div className="shrink-0 bg-zinc-100 dark:bg-zinc-800 relative w-full sm:w-48 aspect-video rounded-lg overflow-hidden">
                            {stillUrl ? (
                              <Image
                                src={stillUrl}
                                alt={ep.name}
                                fill
                                sizes="192px"
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-zinc-400 text-xs">
                                No Still
                              </div>
                            )}
                          </div>
                          <div className="flex-1 w-full flex flex-col justify-center min-w-0 relative pr-16 py-1">
                            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                              {ep.episode_number}. {ep.name}
                            </h4>
                            {(ep.air_date || ep.runtime) && (
                              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                {ep.air_date ? `Aired: ${((d) => `${d[2]}-${d[1]}-${d[0]}`)(ep.air_date.split("-"))}` : ""}
                                {ep.air_date && ep.runtime ? " • " : ""}
                                {ep.runtime ? (ep.runtime >= 60 ? `${Math.floor(ep.runtime / 60)}h ${ep.runtime % 60}m` : `${ep.runtime}m`) : ""}
                              </p>
                            )}
                            {ep.overview && (
                              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300 line-clamp-2 leading-relaxed">
                                {ep.overview}
                              </p>
                            )}
                            <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
                              {local.status && <StatusBadge status={local.status} isVirtual={isVirtual} />}
                              {local?.rating ? (
                                <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-500 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                  <Star size={10} className="fill-current" />{" "}
                                  {local.rating}
                                </span>
                              ) : null}
                              {local?.review_notes ? (
                                <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                  <MessageSquare size={10} /> 1
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="opacity-0 pointer-events-none flex flex-col border border-transparent">
                            <div className="w-full aspect-video shrink-0" />
                            <div className="p-3 pb-2">
                              <h4 className="text-sm font-semibold truncate">
                                {ep.episode_number}. {ep.name}
                              </h4>
                              {(ep.air_date || ep.runtime) && (
                                <p className="text-xs mt-0.5">
                                  {ep.air_date ? `Aired: ${((d) => `${d[2]}-${d[1]}-${d[0]}`)(ep.air_date.split("-"))}` : ""}
                                  {ep.air_date && ep.runtime ? " • " : ""}
                                  {ep.runtime ? (ep.runtime >= 60 ? `${Math.floor(ep.runtime / 60)}h ${ep.runtime % 60}m` : `${ep.runtime}m`) : ""}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-2 min-h-[22px]">
                                {local?.rating ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                    <Star size={10} /> {local.rating}
                                  </span>
                                ) : null}
                                {local?.review_notes ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                    <MessageSquare size={10} /> 1
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                          <div className="absolute top-0 left-0 right-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-all duration-300 group-hover:shadow-xl group-hover:border-violet-300 dark:group-hover:border-violet-700 overflow-hidden flex flex-col">
                            <div className="w-full aspect-video relative shrink-0 bg-zinc-100 dark:bg-zinc-800">
                              {stillUrl ? (
                                <Image
                                  src={stillUrl}
                                  alt={ep.name}
                                  fill
                                  sizes="192px"
                                  className="object-cover"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center text-zinc-400 text-xs">
                                  No Still
                                </div>
                              )}
                              {local.status && (
                                <StatusBadge status={local.status} isVirtual={isVirtual} className="absolute top-2 right-2" />
                              )}
                            </div>
                            <div className="p-3 pb-2">
                              <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                                {ep.episode_number}. {ep.name}
                              </h4>
                              {(ep.air_date || ep.runtime) && (
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                  {ep.air_date ? `Aired: ${((d) => `${d[2]}-${d[1]}-${d[0]}`)(ep.air_date.split("-"))}` : ""}
                                  {ep.air_date && ep.runtime ? " • " : ""}
                                  {ep.runtime ? (ep.runtime >= 60 ? `${Math.floor(ep.runtime / 60)}h ${ep.runtime % 60}m` : `${ep.runtime}m`) : ""}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-2 min-h-[22px]">
                                {local?.rating ? (
                                  <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-500 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                    <Star size={10} className="fill-current" />{" "}
                                    {local.rating}
                                  </span>
                                ) : null}
                                {local?.review_notes ? (
                                  <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                    <MessageSquare size={10} /> 1
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            {ep.overview && (
                              <div className="grid transition-all duration-300 grid-rows-[0fr] group-hover:grid-rows-[1fr]">
                                <div className="overflow-hidden">
                                  <p className="px-3 pb-3 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed max-h-[120px] overflow-y-auto overscroll-contain">
                                    {ep.overview}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
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
        mediaType="tv"
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

      {/* Parent status override conflict dialog */}
      {overrideConfig.show && (
        <ConfirmDialog
          title="Override Episode Progress?"
          description={`This will clear tracked progress on ${overrideConfig.conflictCount} episode${overrideConfig.conflictCount !== 1 ? "s" : ""} you've tracked individually. Continue?`}
          confirmLabel="Override"
          cancelLabel="Cancel"
          onConfirm={handleConfirmOverride}
          onCancel={handleCancelOverride}
        />
      )}
    </div>
  );
}
