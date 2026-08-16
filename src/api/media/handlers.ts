import {
  createMedia,
  updateMedia,
  findDuplicate,
  listMedia,
  computeShowStatusFromSeasons,
  pruneEmptySeasons,
  formatSeasonKey,
  formatEpisodeKeyShort,
} from "./media";
import type {
  EpisodeTracking,
  Media,
  MediaPlaintext,
  SeasonTracking,
  TmdbDetails,
} from "@/types/media";

/**
 * Media tracking handlers — the mutation logic extracted from the TV/media
 * pages so the status-bubbling and override invariants are testable without
 * a React tree.
 *
 * Split into two layers:
 * - Pure state transformations (no I/O) — the exact math previously inlined
 *   in `TvSeriesPageWrapper` / `EpisodePage` / `GenericMediaPage`.
 * - Thin orchestrators that persist via the media API layer.
 *
 * The pages remain the callers; they keep all UI concerns (toasts, dirty
 * snapshots, dialogs) and only delegate the transformations + persistence.
 */

// ── Pure: show status recomputation ──

/**
 * Recompute the parent show status from the nested seasons map, falling back
 * to "unwatched" when nothing is tracked so an emptied show can't retain a
 * ghost umbrella status.
 */
export function recomputeShowStatus(
  seasons: Record<string, SeasonTracking>,
  totalSeasons: number,
  seasonEpisodeCounts: Record<string, number>,
): MediaPlaintext["status"] {
  return (
    computeShowStatusFromSeasons(seasons, totalSeasons, seasonEpisodeCounts) ??
    "unwatched"
  );
}

// ── Pure: new-season detection ──

/**
 * Classify the relationship between the season count tracked on a "watched"
 * show and TMDB's current count. Shared by the show page's `handleTmdbReady`
 * (which acts on the verdict) and the grid-level `useNewSeasonChecks` badge
 * hook (which only reads it) so both can never disagree.
 *
 * - "backfill": the show was marked watched before `tracked_season_count`
 *   existed — the page silently records TMDB's count as the baseline.
 *   No badge, no downgrade.
 * - "new":      TMDB now lists more seasons than the tracked baseline.
 * - "none":     counts match, TMDB lists fewer seasons than tracked
 *   (upstream removal — nothing to flag), or TMDB reports no seasons.
 */
export function checkNewSeason(
  trackedCount: number | undefined,
  tmdbCount: number,
): "backfill" | "new" | "none" {
  if (tmdbCount <= 0) return "none";
  if (trackedCount === undefined) return "backfill";
  return tmdbCount > trackedCount ? "new" : "none";
}

// ── Pure: episode save bubbling ──

/**
 * INVARIANT (season-level): an explicit episode save that contradicts the
 * season's override breaks it. "unwatched" overrides survive only unwatched
 * episode saves; "watched" overrides survive only watched episode saves.
 * Returns the override to persist (undefined clears it).
 */
export function resolveSeasonOverrideAfterEpisodeSave(
  seasonStatus: EpisodeTracking["status"] | undefined,
  episodeStatus: EpisodeTracking["status"],
): EpisodeTracking["status"] | undefined {
  if (seasonStatus === "unwatched" && episodeStatus !== "unwatched") {
    return undefined;
  }
  if (seasonStatus === "watched" && episodeStatus !== "watched") {
    return undefined;
  }
  return seasonStatus;
}

/**
 * Build the updated seasons map for an episode save: writes the episode
 * entry into its season and applies the override-breaking invariant.
 */
export function computeSeasonsAfterEpisodeSave(
  media: MediaPlaintext,
  seasonKey: string,
  episodeKeyShort: string,
  episodeEntry: EpisodeTracking,
): Record<string, SeasonTracking> {
  const existingSeason = media.seasons?.[seasonKey];
  const status = resolveSeasonOverrideAfterEpisodeSave(
    existingSeason?.status,
    episodeEntry.status,
  );
  const updatedSeason: SeasonTracking = {
    ...existingSeason,
    status,
    episodes: {
      ...(existingSeason?.episodes ?? {}),
      [episodeKeyShort]: episodeEntry,
    },
  };
  return { ...(media.seasons ?? {}), [seasonKey]: updatedSeason };
}

/**
 * Compute the parent show status after an episode save.
 *
 * Rules (preserving the original EpisodePage behavior exactly):
 * - Bubble a "unwatched" parent up to "watching" on any non-unwatched save
 *   (or a rating / review note on an untracked episode).
 * - Otherwise derive from the seasons map.
 * - INVARIANT (show-level): a "watched" parent keeps its umbrella unless the
 *   saved episode is explicitly non-watched — that downgrades it to
 *   "watching" rather than the computed value.
 * Returns undefined when the parent status must not be touched in the patch.
 */
export function computeParentStatusAfterEpisodeSave(
  media: MediaPlaintext,
  updatedSeasons: Record<string, SeasonTracking>,
  episodeEntry: EpisodeTracking,
  totalSeasons: number,
  seasonEpisodeCounts: Record<string, number>,
): MediaPlaintext["status"] | undefined {
  let status: MediaPlaintext["status"] | undefined;

  // Bubble up to "watching" if parent is unwatched
  if (
    media.status === "unwatched" &&
    (episodeEntry.status !== "unwatched" ||
      episodeEntry.rating ||
      episodeEntry.review_notes)
  ) {
    status = "watching";
  }

  const computed = recomputeShowStatus(
    updatedSeasons,
    totalSeasons,
    seasonEpisodeCounts,
  );
  const isDowngradeFromWatched =
    media.status === "watched" && computed !== "watched";
  if (isDowngradeFromWatched) {
    // INVARIANT: only an explicit non-watched status breaks the umbrella.
    if (episodeEntry.status && episodeEntry.status !== "watched") {
      status = "watching";
    }
    // A "watched" save under a forced-watched parent leaves status untouched.
  } else {
    status = computed;
  }

  return status;
}

// ── Pure: episode delete ──

/**
 * Delete one episode record and prune seasons left with neither an explicit
 * status nor any episode records.
 */
export function computeSeasonsAfterEpisodeDelete(
  media: MediaPlaintext,
  seasonKey: string,
  episodeKeyShort: string,
): Record<string, SeasonTracking> {
  const updatedSeasons = { ...(media.seasons ?? {}) };

  if (updatedSeasons[seasonKey]?.episodes) {
    const updatedEpisodes = { ...updatedSeasons[seasonKey].episodes };
    delete updatedEpisodes[episodeKeyShort];
    updatedSeasons[seasonKey] = {
      ...updatedSeasons[seasonKey],
      episodes: updatedEpisodes,
    };
  }

  pruneEmptySeasons(updatedSeasons);
  return updatedSeasons;
}

// ── Pure: show-level status override (Table A) ──

/**
 * Count nested records that contradict a forced parent status:
 * - "watched"    → any season override / episode record that isn't "watched"
 * - "unwatched"  → any season override / episode record that isn't "unwatched"
 * - "watching"   → any "watched" season override or "watched" episode record
 *   (mixed states are otherwise legal under the "watching" umbrella)
 */
export function countShowOverrideConflicts(
  seasons: Record<string, SeasonTracking>,
  targetStatus: MediaPlaintext["status"],
): number {
  let conflictCount = 0;

  if (targetStatus === "watched" || targetStatus === "unwatched") {
    for (const season of Object.values(seasons)) {
      if (season.status && season.status !== targetStatus) conflictCount += 1;
      for (const ep of Object.values(season.episodes ?? {})) {
        if (ep.status && ep.status !== targetStatus) conflictCount += 1;
      }
    }
  } else if (targetStatus === "watching") {
    for (const season of Object.values(seasons)) {
      if (season.status === "watched") conflictCount += 1;
      for (const ep of Object.values(season.episodes ?? {})) {
        if (ep.status === "watched") conflictCount += 1;
      }
    }
  }

  return conflictCount;
}

/**
 * Atomically clear every nested record that contradicts the forced parent
 * status (same rule as {@link countShowOverrideConflicts}), then prune the
 * seasons left empty. This is the confirmed-override transform.
 */
export function computeShowOverrideSeasons(
  seasons: Record<string, SeasonTracking>,
  targetStatus: MediaPlaintext["status"],
): Record<string, SeasonTracking> {
  const next: Record<string, SeasonTracking> = {};
  for (const [seasonKey, season] of Object.entries(seasons)) {
    const nextEpisodes = { ...(season.episodes ?? {}) };
    for (const epKey of Object.keys(nextEpisodes)) {
      const epStatus = nextEpisodes[epKey].status;
      if (!epStatus) continue;
      const conflicts =
        targetStatus === "watching"
          ? epStatus === "watched"
          : epStatus !== targetStatus;
      if (conflicts) delete nextEpisodes[epKey];
    }

    const nextSeason: SeasonTracking = {
      ...season,
      episodes: nextEpisodes,
    };
    if (season.status) {
      const conflicts =
        targetStatus === "watching"
          ? season.status === "watched"
          : season.status !== targetStatus;
      if (conflicts) delete nextSeason.status;
    }
    next[seasonKey] = nextSeason;
  }
  pruneEmptySeasons(next);
  return next;
}

// ── Pure: season-level status override (Table C) ──

/**
 * Count episode records inside one season that contradict a forced season
 * status (same per-status rule as the show-level override).
 */
export function countSeasonOverrideConflicts(
  season: SeasonTracking | undefined,
  targetStatus: EpisodeTracking["status"],
): number {
  const episodes = season?.episodes ?? {};
  let conflictCount = 0;
  for (const ep of Object.values(episodes)) {
    if (!ep.status) continue;
    const conflicts =
      targetStatus === "watching"
        ? ep.status === "watched"
        : ep.status !== targetStatus;
    if (conflicts) conflictCount += 1;
  }
  return conflictCount;
}

/**
 * Set a season override directly (no conflict — callers check conflicts
 * first). Episode records are preserved.
 */
export function applySeasonOverride(
  seasons: Record<string, SeasonTracking>,
  seasonKey: string,
  targetStatus: EpisodeTracking["status"],
): Record<string, SeasonTracking> {
  const next = { ...seasons };
  const current = next[seasonKey];
  next[seasonKey] = {
    ...current,
    episodes: { ...(current?.episodes ?? {}) },
    status: targetStatus,
  };
  return next;
}

/**
 * Clear a season override entirely (re-clicking the active chip), pruning
 * the season if nothing is left in it.
 */
export function clearSeasonOverride(
  seasons: Record<string, SeasonTracking>,
  seasonKey: string,
): Record<string, SeasonTracking> {
  const next = { ...seasons };
  const current = next[seasonKey];
  if (current) {
    const updated: SeasonTracking = {
      ...current,
      episodes: { ...(current.episodes ?? {}) },
    };
    delete updated.status;
    next[seasonKey] = updated;
    pruneEmptySeasons(next);
  }
  return next;
}

/**
 * Confirmed season override: clear the conflicting episode records inside
 * the season, then apply the override.
 */
export function computeSeasonOverrideSeasons(
  seasons: Record<string, SeasonTracking>,
  seasonKey: string,
  targetStatus: EpisodeTracking["status"],
): Record<string, SeasonTracking> {
  const next = { ...seasons };
  const current = next[seasonKey];
  if (current) {
    const nextEpisodes = { ...(current.episodes ?? {}) };
    for (const epKey of Object.keys(nextEpisodes)) {
      const epStatus = nextEpisodes[epKey].status;
      if (!epStatus) continue;
      const conflicts =
        targetStatus === "watching"
          ? epStatus === "watched"
          : epStatus !== targetStatus;
      if (conflicts) delete nextEpisodes[epKey];
    }
    next[seasonKey] = {
      ...current,
      episodes: nextEpisodes,
      status: targetStatus,
    };
  }
  return next;
}

/**
 * Remove an entire season entry ("Untrack this Season").
 */
export function removeSeason(
  seasons: Record<string, SeasonTracking>,
  seasonKey: string,
): Record<string, SeasonTracking> {
  const next = { ...seasons };
  delete next[seasonKey];
  return next;
}

// ── Pure: media form patch building ──

export interface BuildMediaPatchArgs {
  /**
   * Form status. Untracked saves default to "unwatched" so the create path
   * always stores a concrete status; tracked saves leave undefined untouched
   * (legacy records without a stored status are preserved by the merge).
   */
  status?: MediaPlaintext["status"];
  isTracked: boolean;
  rating?: number;
  reviewNotes?: string;
  collectionIds?: string[];
  watchedOn?: string;
  /** When true, the patch carries the "watched on" date (movies). */
  showWatchedOn?: boolean;
  /** TV: persist the current TMDB season count for season-aware progress. */
  totalSeasons?: number;
  mediaType: "movie" | "tv";
  /** TV wrapper extras (e.g. seasons map, episodes: undefined legacy clear). */
  extraPatchFields?: Partial<MediaPlaintext>;
}

/**
 * Build the patch object for the page save (status, rating, notes,
 * collections, TV extras). Extracted from GenericMediaPage.handleSave so
 * integration tests persist through the same patch-building code.
 */
export function buildMediaPatch(args: BuildMediaPatchArgs): Partial<MediaPlaintext> {
  const effectiveStatus =
    args.status ?? (!args.isTracked ? "unwatched" : undefined);

  const patch: Partial<MediaPlaintext> = {
    status: effectiveStatus,
    rating: args.rating || undefined,
    review_notes: args.reviewNotes || undefined,
    collection_ids:
      args.collectionIds && args.collectionIds.length > 0
        ? args.collectionIds
        : undefined,
  };

  if (args.showWatchedOn) {
    patch.watched_on = args.watchedOn || undefined;
  }

  if (args.mediaType === "tv") {
    patch.total_seasons = args.totalSeasons ?? 0;
  }

  if (args.extraPatchFields) {
    Object.assign(patch, args.extraPatchFields);
  }

  return patch;
}

// ── Orchestrators ──

export interface SaveEpisodeArgs {
  userId: string;
  tmdbId: number;
  seasonNumber: number;
  episodeNumber: number;
  episodeEntry: EpisodeTracking;
  /** The hydrated show record; undefined when the show is untracked. */
  existingMedia?: Media;
  /** TMDB show metadata used for season counts (passed by the page). */
  showData?: Pick<TmdbDetails, "seasons" | "number_of_seasons" | "name">;
}

/**
 * Persist an episode save (EpisodePage.handleSave flow):
 * - Untracked show → auto-create the parent with status "watching"
 *   (after a duplicate check against the media cache).
 * - Tracked show → merge the episode into the seasons map, apply the
 *   override-breaking invariant, bubble / recompute the parent status,
 *   and update the row.
 * Returns the persisted Media record.
 */
export async function saveEpisode(args: SaveEpisodeArgs): Promise<Media> {
  const {
    userId,
    tmdbId,
    seasonNumber,
    episodeNumber,
    episodeEntry,
    existingMedia,
    showData,
  } = args;
  const seasonKey = formatSeasonKey(seasonNumber);
  const episodeKeyShort = formatEpisodeKeyShort(episodeNumber);

  // Season episode counts for computeShowStatusFromSeasons (sourced from TMDB)
  const seasonEpisodeCounts: Record<string, number> = {};
  for (const s of showData?.seasons ?? []) {
    seasonEpisodeCounts[formatSeasonKey(s.season_number)] = s.episode_count;
  }
  const totalSeasons = showData?.number_of_seasons ?? 0;

  // Prefer the hydrated record; fall back to the cache lookup so a parent
  // created in a race (or outside this page) is still updated, never duplicated.
  const parent =
    existingMedia ?? findDuplicate(tmdbId, "tv", await listMedia(userId));

  if (parent) {
    const updatedSeasons = computeSeasonsAfterEpisodeSave(
      parent,
      seasonKey,
      episodeKeyShort,
      episodeEntry,
    );
    const parentPatch: Partial<MediaPlaintext> = { seasons: updatedSeasons };

    const parentStatus = computeParentStatusAfterEpisodeSave(
      parent,
      updatedSeasons,
      episodeEntry,
      totalSeasons,
      seasonEpisodeCounts,
    );
    if (parentStatus) {
      parentPatch.status = parentStatus;
    }

    return updateMedia(userId, parent.id, parentPatch);
  }

  // Brand-new parent show
  return createMedia(userId, {
    tmdb_id: tmdbId,
    type: "tv",
    title: showData?.name ?? "TV Series",
    status: "watching",
    seasons: { [seasonKey]: { episodes: { [episodeKeyShort]: episodeEntry } } },
  });
}

export interface DeleteEpisodeArgs {
  userId: string;
  seasonNumber: number;
  episodeNumber: number;
  /** The hydrated show record. */
  existingMedia: Media;
  /** TMDB show metadata used for season counts (passed by the page). */
  showData?: Pick<TmdbDetails, "seasons" | "number_of_seasons">;
}

/**
 * Persist an episode-record delete (EpisodePage.handleDeleteEpisode flow):
 * remove the episode, prune empty seasons, and recompute the parent status
 * ("unwatched" when nothing remains tracked). Returns the persisted record.
 */
export async function deleteEpisodeRecord(
  args: DeleteEpisodeArgs,
): Promise<Media> {
  const { userId, seasonNumber, episodeNumber, existingMedia, showData } = args;
  const seasonKey = formatSeasonKey(seasonNumber);
  const episodeKeyShort = formatEpisodeKeyShort(episodeNumber);

  const updatedSeasons = computeSeasonsAfterEpisodeDelete(
    existingMedia,
    seasonKey,
    episodeKeyShort,
  );

  const seasonEpisodeCounts: Record<string, number> = {};
  for (const s of showData?.seasons ?? []) {
    seasonEpisodeCounts[formatSeasonKey(s.season_number)] = s.episode_count;
  }
  const totalSeasons = showData?.number_of_seasons ?? 0;

  const parentPatch: Partial<MediaPlaintext> = {
    // Match the wrapper save convention: an emptied seasons map is omitted
    // from the patch (undefined) rather than persisted as `{}` — one
    // representation of "empty" in the DB.
    seasons:
      Object.keys(updatedSeasons).length > 0 ? updatedSeasons : undefined,
    status: recomputeShowStatus(updatedSeasons, totalSeasons, seasonEpisodeCounts),
  };

  return updateMedia(userId, existingMedia.id, parentPatch);
}
