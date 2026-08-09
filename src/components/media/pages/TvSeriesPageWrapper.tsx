"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Tv, Star, MessageSquare } from "lucide-react";
import ViewToggle from "@/components/common/ViewToggle";
import ErrorBanner from "@/components/common/ErrorBanner";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { useLocalStorage } from "@/lib/useLocalStorage";
import {
  getSeasonDetails,
  formatEpisodeKey,
  getEffectiveEpisodeStatus,
} from "@/api/media";
import type {
  TmdbDetails,
  TmdbSeasonDetails,
  Media,
  MediaCollection,
  MediaPlaintext,
  EpisodeTracking,
} from "@/types/media";
import { useTmdbRetry } from "@/hooks/useTmdbRetry";
import { tmdbStillUrl } from "@/components/media/constants";
import StatusBadge from "@/components/media/shared/StatusBadge";
import GenericMediaPage from "@/components/media/pages/GenericMediaPage";

interface TvSeriesPageWrapperProps {
  tmdbId: number;
  userId: string;
  userName?: string;
  userAvatarUrl?: string;
  collections: MediaCollection[];
  onRefresh?: () => void;
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
}: TvSeriesPageWrapperProps) {
  const router = useRouter();

  // ── TV-specific state ──
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [seasonData, setSeasonData] = useState<TmdbSeasonDetails | null>(null);
  const [viewMode, setViewMode] = useLocalStorage<"detail" | "tile">(
    "mediaEpisodeLayout",
    "detail",
  );
  const [episodeState, setEpisodeState] = useState<
    Record<string, EpisodeTracking>
  >({});

  // Snapshot of original episode state (for dirty check + cancel)
  const [originalEpisodes, setOriginalEpisodes] = useState<
    Record<string, EpisodeTracking>
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
      if (existingMedia) {
        const eps = existingMedia.episodes ?? {};
        setEpisodeState(eps);
        setOriginalEpisodes(eps);
      } else {
        setEpisodeState({});
        setOriginalEpisodes({});
      }
    },
    [],
  );

  const handleTmdbReady = useCallback((data: TmdbDetails) => {
    setSeasonCount(data.number_of_seasons ?? 10);
  }, []);

  // ── Episodes dirty check ──
  const episodesDirty = useMemo(
    () =>
      JSON.stringify(episodeState) !== JSON.stringify(originalEpisodes),
    [episodeState, originalEpisodes],
  );

  // ── Extra cancel: reset episode state ──
  const handleExtraCancel = useCallback(() => {
    setEpisodeState({ ...originalEpisodes });
  }, [originalEpisodes]);

  // ── Extra patch / create fields ──
  const extraPatchFields = useMemo<Partial<MediaPlaintext>>(
    () => ({
      episodes:
        Object.keys(episodeState).length > 0 ? episodeState : undefined,
    }),
    [episodeState],
  );

  const extraCreateFields = useMemo<Partial<MediaPlaintext>>(
    () => ({
      episodes:
        Object.keys(episodeState).length > 0 ? episodeState : ({} as Record<string, EpisodeTracking>),
    }),
    [episodeState],
  );

  // ── Status change interceptor (conflict detection) ──
  const handleStatusChange = useCallback(
    (newStatus: MediaPlaintext["status"], apply: () => void) => {
      if (!newStatus) return;

      // If the user is forcing the parent to "Watched" / "Unwatched",
      // find any explicitly tracked episodes that contradict it.
      let conflictCount = 0;
      if (newStatus === "watched") {
        conflictCount = Object.values(episodeState).filter(
          (ep) => ep.status && ep.status !== "watched",
        ).length;
      } else if (newStatus === "unwatched") {
        conflictCount = Object.values(episodeState).filter(
          (ep) => ep.status && ep.status !== "unwatched",
        ).length;
      }
      // Note: Transitioning the parent to "watching" inherently allows mixed
      // episode states, so no conflict check is necessary.

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
    [episodeState],
  );

  function handleConfirmOverride() {
    const targetStatus = overrideConfig.targetStatus;
    if (!targetStatus) return;

    // Atomically: clear conflicting episode records, then apply parent status
    setEpisodeState((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (next[key].status && next[key].status !== targetStatus) {
          delete next[key];
        }
      }
      return next;
    });

    pendingApplyRef.current?.();
    pendingApplyRef.current = null;
    setOverrideConfig({ show: false, targetStatus: null, conflictCount: 0 });
  }

  function handleCancelOverride() {
    pendingApplyRef.current = null;
    setOverrideConfig({ show: false, targetStatus: null, conflictCount: 0 });
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
    (parentStatus: MediaPlaintext["status"] | undefined) => (
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
              const key = formatEpisodeKey(selectedSeason, ep.episode_number);
              const rawLocal = episodeState[key];
              const { status, isVirtual } = getEffectiveEpisodeStatus(
                parentStatus,
                rawLocal?.status,
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
                  key={key}
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
                      <div className="opacity-0 pointer-events-none flex flex-col border border-transparent">
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
        )}
      </div>
    </div>
    ),
    [seasonCount, selectedSeason, viewMode, setViewMode, seasonLoading, seasonError, seasonData, episodeState, navigateToEpisode, clearSeasonError],
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
    </>
  );
}
