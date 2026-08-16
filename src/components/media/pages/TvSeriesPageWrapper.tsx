"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Tv, Star, MessageSquare, X } from "lucide-react";
import ViewToggle from "@/components/common/ViewToggle";
import ErrorBanner from "@/components/common/ErrorBanner";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { useLocalStorage } from "@/lib/useLocalStorage";
import {
  getSeasonDetails,
  updateMedia,
  formatSeasonKey,
  formatEpisodeKeyShort,
  getEffectiveEpisodeStatus,
  computeSeasonStatus,
  recomputeShowStatus,
  checkNewSeason,
  countShowOverrideConflicts,
  computeShowOverrideSeasons,
  countSeasonOverrideConflicts,
  applySeasonOverride,
  clearSeasonOverride,
  computeSeasonOverrideSeasons,
  removeSeason,
} from "@/api/media";
import type {
  TmdbDetails,
  TmdbSeasonDetails,
  Media,
  MediaCollection,
  MediaPlaintext,
  SeasonTracking,
  EpisodeTracking,
} from "@/types/media";
import { useTmdbRetry } from "@/hooks/useTmdbRetry";
import { tmdbStillUrl, chipClasses } from "@/components/media/constants";
import StatusBadge from "@/components/media/shared/StatusBadge";
import UntrackConfirmation from "@/components/media/shared/UntrackConfirmation";
import GenericMediaPage from "@/components/media/pages/GenericMediaPage";

interface TvSeriesPageWrapperProps {
  tmdbId: number;
  userId: string;
  userName?: string;
  userAvatarUrl?: string;
  collections: MediaCollection[];
  onRefresh?: () => void;
  /** Called after new-season detection auto-downgrades a "watched" show. */
  onNewSeasonDetected?: (updatedMedia: Media) => void;
}

/**
 * TV Series page wrapper — owns all TV-specific state and logic:
 * episode tracking, season selector, season data loading, conflict
 * detection for parent status override, and the full EpisodeMatrix.
 *
 * Renders {@link GenericMediaPage} for all shared tracking UI and
 * passes the EpisodeMatrix into the `episodeSlot` prop.
 */
export default function TvSeriesPageWrapper({
  tmdbId,
  userId,
  userName,
  userAvatarUrl,
  collections,
  onRefresh,
  onNewSeasonDetected,
}: TvSeriesPageWrapperProps) {
  const router = useRouter();

  // ── TV-specific state ──
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [seasonData, setSeasonData] = useState<TmdbSeasonDetails | null>(null);
  const [viewMode, setViewMode] = useLocalStorage<"detail" | "tile">(
    "mediaEpisodeLayout",
    "detail",
  );
  const [seasonState, setSeasonState] = useState<
    Record<string, SeasonTracking>
  >({});

  // Snapshot of original season state (for dirty check + cancel)
  const [originalSeasonState, setOriginalSeasonState] = useState<
    Record<string, SeasonTracking>
  >({});

  // Conflict dialog — shown when manually overriding parent status would
  // wipe individually-tracked episode records
  const [overrideConfig, setOverrideConfig] = useState<{
    show: boolean;
    targetStatus: string | null;
    conflictCount: number;
  }>({ show: false, targetStatus: null, conflictCount: 0 });

  // Ref to store the pending "apply" callback from GenericMediaPage's
  // handleStatusClick, so we can call it after the user confirms the override.
  const pendingApplyRef = useRef<(() => void) | null>(null);

  // ── Season loading with retry ──
  const {
    execute: executeSeason,
    loading: seasonLoading,
    error: seasonError,
    clearError: clearSeasonError,
  } = useTmdbRetry();
  const [seasonRetryCount, setSeasonRetryCount] = useState(0);

  // We need tmdbData to know seasonCount. Since GenericMediaPage owns the
  // data loading, we read seasonCount from a small local cache set via
  // onHydrate / the TMDB data. Actually, we can just fetch season details
  // optimistically — if the TMDB ID is valid, season 1 always exists.
  // For the season list, we need number_of_seasons. Let's store it locally.
  const [seasonCount, setSeasonCount] = useState(10);

  // Latest localMedia — GenericMediaPage owns the state, so we mirror it via
  // handleHydrate to power new-season detection in handleTmdbReady.
  const localMediaRef = useRef<Media | null>(null);

  // Season numbers added by TMDB since the last "watched" save (sidebar NEW badge)
  const [newSeasons, setNewSeasons] = useState<number[]>([]);

  // TMDB season metadata captured from handleTmdbReady — used to recompute
  // the parent show status when season-level overrides change.
  const tmdbSeasonRef = useRef<{
    totalSeasons: number;
    episodeCounts: Record<string, number>;
  }>({ totalSeasons: 0, episodeCounts: {} });

  // Channel into GenericMediaPage's form state (registered via
  // onRegisterStatusSync) — lets us push parent-status updates after
  // background detection or season-level recalculation.
  const statusSyncRef = useRef<
    ((status: MediaPlaintext["status"]) => void) | null
  >(null);

  const handleRegisterStatusSync = useCallback(
    (sync: (status: MediaPlaintext["status"]) => void) => {
      statusSyncRef.current = sync;
    },
    [],
  );

  // Recompute the parent show status from the nested seasons map and push it
  // into GenericMediaPage's form. Falls back to "unwatched" when no seasons
  // remain tracked so an emptied show can't retain a ghost umbrella status
  // (resolves the Stage 3 deviation: recomputeShowStatus is used here).
  const pushShowStatusFromSeasons = useCallback(
    (seasons: Record<string, SeasonTracking>) => {
      const { totalSeasons, episodeCounts } = tmdbSeasonRef.current;
      const computed = recomputeShowStatus(seasons, totalSeasons, episodeCounts);
      statusSyncRef.current?.(computed);
    },
    [],
  );

  // Load season data
  useEffect(() => {
    executeSeason(async (signal) => {
      const data = await getSeasonDetails(tmdbId, selectedSeason, signal);
      setSeasonData(data);
    }).catch(() => {
      /* executeSeason already surfaces the error via its own state */
    });
  }, [executeSeason, tmdbId, selectedSeason, seasonRetryCount]);

  // ── Hydration / TMDB callbacks ──
  const handleHydrate = useCallback(
    (existingMedia: Media | undefined) => {
      localMediaRef.current = existingMedia ?? null;
      if (existingMedia) {
        const seasons = existingMedia.seasons ?? {};
        setSeasonState(seasons);
        setOriginalSeasonState(seasons);
      } else {
        setSeasonState({});
        setOriginalSeasonState({});
      }
    },
    [],
  );

  const handleTmdbReady = useCallback(
    (data: TmdbDetails) => {
      setSeasonCount(data.number_of_seasons ?? 10);

      const tmdbSeasonCount = data.number_of_seasons ?? 0;

      // Cache TMDB season metadata for show-status recalculation
      const episodeCounts: Record<string, number> = {};
      for (const s of data.seasons ?? []) {
        episodeCounts[formatSeasonKey(s.season_number)] = s.episode_count;
      }
      tmdbSeasonRef.current = { totalSeasons: tmdbSeasonCount, episodeCounts };

      const currentMedia = localMediaRef.current;
      if (currentMedia?.status === "watched") {
        // Shared with the grid-level badge hook (useNewSeasonChecks) so the
        // page-load verdict and the grid badge can never disagree.
        const verdict = checkNewSeason(
          currentMedia.tracked_season_count,
          tmdbSeasonCount,
        );
        if (verdict === "backfill") {
          // BACKFILL: pre-existing watched show tracked before this feature.
          // Set the baseline silently — no badge, no downgrade.
          updateMedia(userId, currentMedia.id, {
            tracked_season_count: tmdbSeasonCount,
          })
            .then((updated) => {
              localMediaRef.current = updated;
            })
            .catch(() => {
              /* non-fatal — retries on the next page load */
            });
        } else if (verdict === "new") {
          // TRUE NEW SEASON: auto-downgrade to "watching"
          updateMedia(userId, currentMedia.id, {
            status: "watching",
            tracked_season_count: tmdbSeasonCount,
          })
            .then((updated) => {
              localMediaRef.current = updated;
              onNewSeasonDetected?.(updated); // external hook for parents
              // Sync GenericMediaPage's form so the pill flips and the next
              // save doesn't overwrite the downgrade with a stale status.
              statusSyncRef.current?.(updated.status);
            })
            .catch(() => {
              /* non-fatal — retries on the next page load */
            });
          setNewSeasons(
            Array.from(
              { length: tmdbSeasonCount - currentMedia.tracked_season_count! },
              (_, i) => currentMedia.tracked_season_count! + i + 1,
            ),
          );
        }
      }
    },
    [userId, onNewSeasonDetected],
  );

  // ── Episodes dirty check ──
  const episodesDirty = useMemo(
    () =>
      JSON.stringify(seasonState) !== JSON.stringify(originalSeasonState),
    [seasonState, originalSeasonState],
  );

  // ── Extra cancel: reset episode state ──
  const handleExtraCancel = useCallback(() => {
    setSeasonState({ ...originalSeasonState });
  }, [originalSeasonState]);

  // ── Extra patch / create fields ──
  const extraPatchFields = useMemo<Partial<MediaPlaintext>>(
    () => ({
      seasons:
        Object.keys(seasonState).length > 0 ? seasonState : undefined,
      episodes: undefined, // Clears the legacy flat map (Stage 2 finding)
    }),
    [seasonState],
  );

  const extraCreateFields = useMemo<Partial<MediaPlaintext>>(
    () => ({
      seasons:
        Object.keys(seasonState).length > 0
          ? seasonState
          : ({} as Record<string, SeasonTracking>),
    }),
    [seasonState],
  );

  // ── Status change interceptor (conflict detection) ──
  const handleStatusChange = useCallback(
    (newStatus: MediaPlaintext["status"], apply: () => void) => {
      if (!newStatus) return;

      // If the user is forcing the parent to a status that contradicts
      // individual nested tracking, count the conflicting records
      // ("watched"/"unwatched": any non-matching record; "watching": only
      // "watched" records — mixed states are legal under that umbrella).
      const conflictCount = countShowOverrideConflicts(seasonState, newStatus);

      if (conflictCount > 0) {
        pendingApplyRef.current = apply;
        setOverrideConfig({
          show: true,
          targetStatus: newStatus,
          conflictCount,
        });
        return;
      }

      // No conflicts — apply immediately
      apply();
    },
    [seasonState],
  );

  function handleConfirmOverride() {
    const targetStatus = overrideConfig.targetStatus;
    if (!targetStatus) return;

    // Atomically: clear conflicting nested records, then apply parent status.
    setSeasonState((prev) =>
      computeShowOverrideSeasons(prev, targetStatus as MediaPlaintext["status"]),
    );

    pendingApplyRef.current?.();
    pendingApplyRef.current = null;
    setOverrideConfig({ show: false, targetStatus: null, conflictCount: 0 });
  }

  function handleCancelOverride() {
    pendingApplyRef.current = null;
    setOverrideConfig({ show: false, targetStatus: null, conflictCount: 0 });
  }

  // ── Season-level status override (sidebar controls) ──
  const [seasonConflictDialog, setSeasonConflictDialog] = useState<{
    show: boolean;
    seasonNumber: number;
    targetStatus: EpisodeTracking["status"];
    conflictCount: number;
  } | null>(null);

  // Untrack season confirmation dialog
  const [showUntrackSeason, setShowUntrackSeason] = useState(false);

  const applySeasonStatusDirect = useCallback(
    (seasonNumber: number, targetStatus: EpisodeTracking["status"]) => {
      const seasonKey = formatSeasonKey(seasonNumber);
      const next = applySeasonOverride(seasonState, seasonKey, targetStatus);
      setSeasonState(next);
      pushShowStatusFromSeasons(next);
    },
    [seasonState, pushShowStatusFromSeasons],
  );

  // Explicit season override control: the header chips call this with a
  // concrete target status, and pass undefined to toggle the override off
  // when the user re-clicks the currently active chip.
  const handleSeasonStatusClick = useCallback(
    (
      seasonNumber: number,
      targetStatus: EpisodeTracking["status"] | undefined,
    ) => {
      const seasonKey = formatSeasonKey(seasonNumber);
      const currentStatus = seasonState[seasonKey]?.status;

      // No-op when re-selecting the current override
      if (currentStatus === targetStatus) return;

      if (!targetStatus) {
        // Clear the override entirely
        if (seasonState[seasonKey]) {
          const next = clearSeasonOverride(seasonState, seasonKey);
          setSeasonState(next);
          pushShowStatusFromSeasons(next);
        }
        return;
      }

      // Season-scoped conflict detection:
      //   watched   → any episode record that isn't "watched"
      //   unwatched → any episode record that isn't "unwatched"
      //   watching  → any "watched" episode record
      const conflictCount = countSeasonOverrideConflicts(
        seasonState[seasonKey],
        targetStatus,
      );

      if (conflictCount > 0) {
        setSeasonConflictDialog({
          show: true,
          seasonNumber,
          targetStatus,
          conflictCount,
        });
        return;
      }

      applySeasonStatusDirect(seasonNumber, targetStatus);
    },
    [seasonState, applySeasonStatusDirect, pushShowStatusFromSeasons],
  );

  function handleConfirmSeasonOverride() {
    if (!seasonConflictDialog) return;
    const { seasonNumber, targetStatus } = seasonConflictDialog;
    const seasonKey = formatSeasonKey(seasonNumber);

    // Atomically: clear conflicting episode records in the season, then
    // apply the season override. Same clearing rule as handleConfirmOverride.
    if (seasonState[seasonKey]) {
      const next = computeSeasonOverrideSeasons(
        seasonState,
        seasonKey,
        targetStatus,
      );
      setSeasonState(next);
      pushShowStatusFromSeasons(next);
    }

    setSeasonConflictDialog(null);
  }

  function handleCancelSeasonOverride() {
    setSeasonConflictDialog(null);
  }

  // ── Untrack season (delete all records for the selected season) ──
  function handleDeleteSeason() {
    const seasonKey = formatSeasonKey(selectedSeason);
    const next = removeSeason(seasonState, seasonKey);
    setSeasonState(next);
    pushShowStatusFromSeasons(next);
    setShowUntrackSeason(false);
  }

  // ── Episode card navigation ──
  const navigateToEpisode = useCallback(
    (season: number, episode: number) => {
      router.push(
        `/media/tv/${tmdbId}/episode/${season}/${episode}`,
      );
    },
    [router, tmdbId],
  );

  // ── EpisodeMatrix (rendered inside GenericMediaPage's episodes tab) ──

  const renderEpisodeSlot = useCallback(
    (parentStatus: MediaPlaintext["status"] | undefined) => {
    const selectedSeasonKey = formatSeasonKey(selectedSeason);

    // Effective status of the selected season — same fallback chain as the
    // sidebar badges (explicit override → parent umbrella → episode density).
    const headerSeasonOverride = seasonState[selectedSeasonKey]?.status;
    let headerDisplayStatus = headerSeasonOverride;
    if (!headerDisplayStatus) {
      if (parentStatus === "watched") headerDisplayStatus = "watched";
      else if (parentStatus === "watching" && selectedSeason === 1)
        headerDisplayStatus = "watching";
      else {
        const computed = computeSeasonStatus(
          seasonState[selectedSeasonKey]?.episodes,
          tmdbSeasonRef.current.episodeCounts[selectedSeasonKey] ?? 0,
        );
        headerDisplayStatus = computed ?? "unwatched";
      }
    }

    return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* Sidebar: Seasons */}
      <aside className="w-full md:w-48 shrink-0 md:border-r border-zinc-200 dark:border-zinc-800 md:pr-4">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">
          Seasons
        </h3>
        <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
          {Array.from({ length: seasonCount }, (_, i) => i + 1).map((s) => {
            const sKey = formatSeasonKey(s);
            const sStatus = seasonState[sKey]?.status;
            const isNew = newSeasons.includes(s);
            // Virtual fallback respects the parent umbrella and episode
            // density: a "watched" show projects "watched" onto untracked
            // seasons, and a "watching" show projects "watching" onto Season 1
            // (parity with getEffectiveEpisodeStatus' first-episode
            // guardrail); otherwise the centralized computeSeasonStatus
            // helper derives the status from tracked episodes
            // (null → "unwatched").
            let displayStatus = sStatus;
            if (!displayStatus) {
              if (parentStatus === "watched") displayStatus = "watched";
              else if (parentStatus === "watching" && s === 1)
                displayStatus = "watching";
              else {
                const computed = computeSeasonStatus(
                  seasonState[sKey]?.episodes,
                  tmdbSeasonRef.current.episodeCounts[sKey] ?? 0,
                );
                displayStatus = computed ?? "unwatched";
              }
            }
            return (
              <div
                key={s}
                className={`flex items-center rounded-lg transition-colors ${
                  selectedSeason === s
                    ? "bg-violet-100 dark:bg-violet-900/40"
                    : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedSeason(s)}
                  className={`flex-1 whitespace-nowrap text-left px-3 py-2 text-sm font-medium ${
                    selectedSeason === s
                      ? "text-violet-700 dark:text-violet-300"
                      : "text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  Season {s}
                  {isNew && (
                    <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-green-700 dark:bg-green-900/40 dark:text-green-400">
                      New
                    </span>
                  )}
                </button>
                <div className="pr-3">
                  <StatusBadge
                    status={displayStatus}
                    isVirtual={!sStatus}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Season {selectedSeason}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() =>
                  handleSeasonStatusClick(
                    selectedSeason,
                    headerSeasonOverride === "unwatched"
                      ? undefined
                      : "unwatched",
                  )
                }
                className={chipClasses(
                  headerDisplayStatus === "unwatched",
                  "unwatched",
                )}
              >
                Not Watched
              </button>
              <button
                type="button"
                onClick={() =>
                  handleSeasonStatusClick(
                    selectedSeason,
                    headerSeasonOverride === "watching"
                      ? undefined
                      : "watching",
                  )
                }
                className={chipClasses(
                  headerDisplayStatus === "watching",
                  "watching",
                )}
              >
                Watching
              </button>
              <button
                type="button"
                onClick={() =>
                  handleSeasonStatusClick(
                    selectedSeason,
                    headerSeasonOverride === "watched"
                      ? undefined
                      : "watched",
                  )
                }
                className={chipClasses(
                  headerDisplayStatus === "watched",
                  "watched",
                )}
              >
                Watched
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {seasonState[selectedSeasonKey] && (
              <button
                type="button"
                onClick={() => setShowUntrackSeason(true)}
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm border-none transition-colors text-sm"
              >
                <X size={16} />
                Untrack this Season
              </button>
            )}
            <ViewToggle value={viewMode} onChange={setViewMode} variant="media" />
          </div>
        </div>

        {seasonLoading && (
          <p className="py-8 text-center text-sm text-zinc-500">
            Loading episodes…
          </p>
        )}

        {seasonError && (
          <ErrorBanner
            message={seasonError}
            onRetry={() => {
              clearSeasonError();
              setSeasonRetryCount((c) => c + 1);
            }}
          />
        )}

        {/* Episode cards */}
        {!seasonLoading && !seasonError && (
          <div
            className={
              viewMode === "detail"
                ? "flex flex-col gap-4"
                : "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
            }
          >
            {seasonData?.episodes?.map((ep) => {
              const episodeKeyShort = formatEpisodeKeyShort(ep.episode_number);
              const rawLocal =
                seasonState[selectedSeasonKey]?.episodes?.[episodeKeyShort];
              const { status, isVirtual } = getEffectiveEpisodeStatus(
                parentStatus,
                seasonState[selectedSeasonKey]?.status,
                rawLocal?.status,
                selectedSeason === 1 && ep.episode_number === 1,
              );
              const local = {
                ...rawLocal,
                status,
              };
              const stillUrl = ep.still_path
                ? tmdbStillUrl(ep.still_path, "w300")
                : null;

              return (
                <div
                  key={episodeKeyShort}
                  onClick={() =>
                    navigateToEpisode(selectedSeason, ep.episode_number)
                  }
                  className={
                    viewMode === "detail"
                      ? "group cursor-pointer rounded-xl border border-zinc-200 bg-white transition-all hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/50 hover:border-violet-300 dark:hover:border-violet-700 overflow-hidden flex flex-col sm:flex-row gap-4 p-3"
                      : "relative group cursor-pointer h-full z-0 hover:z-20"
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
                            {ep.air_date
                              ? `Aired: ${((d) => `${d[2]}-${d[1]}-${d[0]}`)(ep.air_date.split("-"))}`
                              : ""}
                            {ep.air_date && ep.runtime ? " • " : ""}
                            {ep.runtime
                              ? ep.runtime >= 60
                                ? `${Math.floor(ep.runtime / 60)}h ${ep.runtime % 60}m`
                                : `${ep.runtime}m`
                              : ""}
                          </p>
                        )}
                        {ep.overview && (
                          <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300 line-clamp-2 leading-relaxed">
                            {ep.overview}
                          </p>
                        )}
                        <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
                          {local.status && (
                            <StatusBadge status={local.status} isVirtual={isVirtual} />
                          )}
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
                      <div className="hidden md:block opacity-0 pointer-events-none border border-transparent">
                        <div className="w-full aspect-video shrink-0" />
                        <div className="p-3 pb-2">
                          <h4 className="text-sm font-semibold truncate">
                            {ep.episode_number}. {ep.name}
                          </h4>
                          {(ep.air_date || ep.runtime) && (
                            <p className="text-xs mt-0.5">
                              {ep.air_date
                                ? `Aired: ${((d) => `${d[2]}-${d[1]}-${d[0]}`)(ep.air_date.split("-"))}`
                                : ""}
                              {ep.air_date && ep.runtime ? " • " : ""}
                              {ep.runtime
                                ? ep.runtime >= 60
                                  ? `${Math.floor(ep.runtime / 60)}h ${ep.runtime % 60}m`
                                  : `${ep.runtime}m`
                                : ""}
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
                      <div className="relative md:absolute top-0 left-0 right-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-all duration-300 group-hover:shadow-xl group-hover:border-violet-300 dark:group-hover:border-violet-700 overflow-hidden flex flex-col">
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
                            <StatusBadge
                              status={local.status}
                              isVirtual={isVirtual}
                              className="absolute top-2 right-2"
                            />
                          )}
                        </div>
                        <div className="p-3 pb-2">
                          <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                            {ep.episode_number}. {ep.name}
                          </h4>
                          {(ep.air_date || ep.runtime) && (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                              {ep.air_date
                                ? `Aired: ${((d) => `${d[2]}-${d[1]}-${d[0]}`)(ep.air_date.split("-"))}`
                                : ""}
                              {ep.air_date && ep.runtime ? " • " : ""}
                              {ep.runtime
                                ? ep.runtime >= 60
                                  ? `${Math.floor(ep.runtime / 60)}h ${ep.runtime % 60}m`
                                  : `${ep.runtime}m`
                                : ""}
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
                          <div className="grid transition-all duration-300 grid-rows-[1fr] md:grid-rows-[0fr] md:group-hover:grid-rows-[1fr]">
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
        )}
      </div>
    </div>
    );
    },
    [seasonCount, selectedSeason, viewMode, setViewMode, seasonLoading, seasonError, seasonData, seasonState, navigateToEpisode, clearSeasonError, newSeasons, handleSeasonStatusClick],
  );

  return (
    <>
      <GenericMediaPage
        tmdbId={tmdbId}
        userId={userId}
        userName={userName}
        userAvatarUrl={userAvatarUrl}
        collections={collections}
        onRefresh={onRefresh}
        mediaType="tv"
        fallbackIcon={<Tv size={48} />}
        typeLabel="TV Series"
        episodeSlot={renderEpisodeSlot}
        extraDirty={episodesDirty}
        onExtraCancel={handleExtraCancel}
        extraPatchFields={extraPatchFields}
        extraCreateFields={extraCreateFields}
        onStatusChange={handleStatusChange}
        onHydrate={handleHydrate}
        onTmdbReady={handleTmdbReady}
        onRegisterStatusSync={handleRegisterStatusSync}
        onSaveSuccess={() => setOriginalSeasonState({ ...seasonState })}
      />

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

      {/* Season status override conflict dialog */}
      {seasonConflictDialog?.show && (
        <ConfirmDialog
          title="Override Season Progress?"
          description={`This will clear tracked progress on ${seasonConflictDialog.conflictCount} episode${seasonConflictDialog.conflictCount !== 1 ? "s" : ""} in Season ${seasonConflictDialog.seasonNumber} you've tracked individually. Continue?`}
          confirmLabel="Override"
          cancelLabel="Cancel"
          onConfirm={handleConfirmSeasonOverride}
          onCancel={handleCancelSeasonOverride}
        />
      )}

      {/* Untrack season confirmation */}
      <UntrackConfirmation
        open={showUntrackSeason}
        mediaType="season"
        onConfirm={handleDeleteSeason}
        onCancel={() => setShowUntrackSeason(false)}
      />
    </>
  );
}
