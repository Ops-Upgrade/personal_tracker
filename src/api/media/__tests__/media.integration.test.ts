import { describe, it, expect } from "vitest";
import { getTestSession } from "@/test/testSession";
import { fetchFreshMedia } from "@/test/integration-helpers";
import {
  createMedia,
  updateMedia,
  countShowOverrideConflicts,
  computeShowOverrideSeasons,
  countSeasonOverrideConflicts,
  applySeasonOverride,
  clearSeasonOverride,
  computeSeasonOverrideSeasons,
  removeSeason,
  recomputeShowStatus,
  computeSeasonStatus,
  buildMediaPatch,
  saveEpisode,
  deleteEpisodeRecord,
} from "@/api/media";
import type {
  Media,
  MediaPlaintext,
  SeasonTracking,
  EpisodeTracking,
  TmdbDetails,
} from "@/types/media";

/**
 * Tier 2 — the Exhaustive Scenario Matrix (Tables A/B/C) walked mechanically
 * against the REAL database, through the extracted production handlers
 * (docs/plans/PLAN-mediamanager.md "Exhaustive Scenario Matrix").
 *
 * Every row seeds a row for the dummy test user, runs the exact composition
 * the pages now perform (override counting → clearing → patch building →
 * updateMedia, or the saveEpisode / deleteEpisodeRecord orchestrators), and
 * asserts a FRESH DB read (media cache dropped) so the stored blob is what
 * gets verified — not the cached hydration.
 *
 * Doc-vs-code deviations are pinned in comments: Table A rows claiming
 * `tracked_season_count` is written by the override flow, Table A row 2 /
 * Table C row 2 claiming ALL nested records are cleared, and Table B row 9
 * claiming the emptied show keeps its umbrella status. The tests assert the
 * CODE's behavior so any future change to either is a deliberate diff.
 */

const SHOW: Pick<TmdbDetails, "seasons" | "number_of_seasons" | "name"> = {
  name: "Matrix Test Show",
  number_of_seasons: 3,
  seasons: [
    { season_number: 1, episode_count: 3 },
    { season_number: 2, episode_count: 3 },
    { season_number: 3, episode_count: 3 },
  ],
};
const EPISODE_COUNTS: Record<string, number> = { S01: 3, S02: 3, S03: 3 };

const ep = (status: EpisodeTracking["status"]): EpisodeTracking => ({ status });

/** The exact extraPatchFields TvSeriesPageWrapper passes on save. */
function tvExtraPatchFields(
  seasons: Record<string, SeasonTracking>,
): Partial<MediaPlaintext> {
  return {
    seasons: Object.keys(seasons).length > 0 ? seasons : undefined,
    episodes: undefined, // Clears the legacy flat map (Stage 2 finding)
  };
}

/** Show-override flow as composed in TvSeriesPageWrapper + GenericMediaPage. */
async function persistShowOverride(
  userId: string,
  media: Media,
  targetStatus: MediaPlaintext["status"],
  seasons: Record<string, SeasonTracking>,
): Promise<Media> {
  const patch = buildMediaPatch({
    status: targetStatus,
    isTracked: true,
    mediaType: "tv",
    totalSeasons: SHOW.number_of_seasons ?? 0,
    extraPatchFields: tvExtraPatchFields(seasons),
  });
  return updateMedia(userId, media.id, patch);
}

/**
 * Season-state flow as composed in TvSeriesPageWrapper: after any season
 * override change, the parent form status is recomputed from the seasons map
 * (pushShowStatusFromSeasons) and the save persists that recomputed status.
 */
async function persistSeasons(
  userId: string,
  media: Media,
  seasons: Record<string, SeasonTracking>,
): Promise<Media> {
  const parentStatus = recomputeShowStatus(
    seasons,
    SHOW.number_of_seasons ?? 0,
    EPISODE_COUNTS,
  );
  const patch = buildMediaPatch({
    status: parentStatus,
    isTracked: true,
    mediaType: "tv",
    totalSeasons: SHOW.number_of_seasons ?? 0,
    extraPatchFields: tvExtraPatchFields(seasons),
  });
  return updateMedia(userId, media.id, patch);
}

async function seed(
  userId: string,
  tmdbId: number,
  plaintext: Partial<MediaPlaintext> & { status: MediaPlaintext["status"] },
): Promise<Media> {
  return createMedia(userId, {
    tmdb_id: tmdbId,
    type: "tv",
    title: SHOW.name,
    ...plaintext,
  } as MediaPlaintext);
}

describe("Table A — show-level status overrides (top-down)", () => {
  it("A1: force 'watched' with no nested records → parent 'watched', no conflict", async () => {
    const { userId } = await getTestSession();
    const media = await seed(userId, 9_101_101, { status: "unwatched" });

    const conflicts = countShowOverrideConflicts(media.seasons ?? {}, "watched");
    expect(conflicts).toBe(0);

    await persistShowOverride(
      userId,
      media,
      "watched",
      computeShowOverrideSeasons(media.seasons ?? {}, "watched"),
    );

    const fresh = await fetchFreshMedia(userId, 9_101_101, "tv");
    expect(fresh?.status).toBe("watched");
    expect(fresh?.total_seasons).toBe(3);
    // DEVIATION vs Table A row 1: the override save does NOT write
    // tracked_season_count — only TvSeriesPageWrapper.handleTmdbReady (page
    // load backfill / new-season detection) writes that field.
    expect(fresh?.tracked_season_count).toBeUndefined();
  });

  it("A2: force 'watched' with conflicting records → conflicting records cleared, matching records kept", async () => {
    const { userId } = await getTestSession();
    const media = await seed(userId, 9_101_102, {
      status: "watching",
      seasons: { S01: { episodes: { E01: ep("watched"), E02: ep("unwatched") } } },
    });

    const conflicts = countShowOverrideConflicts(media.seasons ?? {}, "watched");
    expect(conflicts).toBe(1); // E02 contradicts the "watched" umbrella

    await persistShowOverride(
      userId,
      media,
      "watched",
      computeShowOverrideSeasons(media.seasons ?? {}, "watched"),
    );

    const fresh = await fetchFreshMedia(userId, 9_101_102, "tv");
    expect(fresh?.status).toBe("watched");
    // DEVIATION vs Table A row 2 ("all seasons map entries deleted"): the
    // code clears only the CONFLICTING records — the matching "watched"
    // record survives.
    expect(fresh?.seasons?.S01?.episodes?.E01?.status).toBe("watched");
    expect(fresh?.seasons?.S01?.episodes?.E02).toBeUndefined();
  });

  it("A3: force 'unwatched' with no nested records → parent 'unwatched'", async () => {
    const { userId } = await getTestSession();
    const media = await seed(userId, 9_101_103, { status: "watching" });

    expect(countShowOverrideConflicts(media.seasons ?? {}, "unwatched")).toBe(0);

    await persistShowOverride(
      userId,
      media,
      "unwatched",
      computeShowOverrideSeasons(media.seasons ?? {}, "unwatched"),
    );

    const fresh = await fetchFreshMedia(userId, 9_101_103, "tv");
    expect(fresh?.status).toBe("unwatched");
  });

  it("A4: force 'unwatched' with records → records cleared, parent 'unwatched'", async () => {
    const { userId } = await getTestSession();
    const media = await seed(userId, 9_101_104, {
      status: "watching",
      seasons: { S01: { episodes: { E01: ep("watched") } } },
    });

    expect(countShowOverrideConflicts(media.seasons ?? {}, "unwatched")).toBe(1);

    await persistShowOverride(
      userId,
      media,
      "unwatched",
      computeShowOverrideSeasons(media.seasons ?? {}, "unwatched"),
    );

    const fresh = await fetchFreshMedia(userId, 9_101_104, "tv");
    expect(fresh?.status).toBe("unwatched");
    expect(fresh?.seasons).toBeUndefined(); // S01 cleared, then pruned
  });

  it("A5: force 'watching' with no nested records → no conflict, parent 'watching'", async () => {
    const { userId } = await getTestSession();
    const media = await seed(userId, 9_101_105, { status: "unwatched" });

    expect(countShowOverrideConflicts(media.seasons ?? {}, "watching")).toBe(0);

    await persistShowOverride(
      userId,
      media,
      "watching",
      computeShowOverrideSeasons(media.seasons ?? {}, "watching"),
    );

    const fresh = await fetchFreshMedia(userId, 9_101_105, "tv");
    expect(fresh?.status).toBe("watching");
  });

  it("A6: force 'watching' with only unwatched records → no conflict, records kept", async () => {
    const { userId } = await getTestSession();
    const media = await seed(userId, 9_101_106, {
      status: "unwatched",
      seasons: { S01: { episodes: { E01: ep("unwatched") } } },
    });

    // Mixed (non-watched) states are legal under the "watching" umbrella.
    expect(countShowOverrideConflicts(media.seasons ?? {}, "watching")).toBe(0);

    await persistShowOverride(
      userId,
      media,
      "watching",
      computeShowOverrideSeasons(media.seasons ?? {}, "watching"),
    );

    const fresh = await fetchFreshMedia(userId, 9_101_106, "tv");
    expect(fresh?.status).toBe("watching");
    expect(fresh?.seasons?.S01?.episodes?.E01?.status).toBe("unwatched");
  });

  it("A7: force 'watching' with 'watched' records → only 'watched' records cleared", async () => {
    const { userId } = await getTestSession();
    const media = await seed(userId, 9_101_107, {
      status: "watched",
      seasons: {
        S01: { episodes: { E01: ep("watched") } },
        S02: { status: "watched" },
      },
    });

    expect(countShowOverrideConflicts(media.seasons ?? {}, "watching")).toBe(2);

    await persistShowOverride(
      userId,
      media,
      "watching",
      computeShowOverrideSeasons(media.seasons ?? {}, "watching"),
    );

    const fresh = await fetchFreshMedia(userId, 9_101_107, "tv");
    expect(fresh?.status).toBe("watching");
    // E01 deleted, S01 pruned; S02's "watched" override deleted, S02 pruned.
    expect(fresh?.seasons).toBeUndefined();
  });
});

describe("Table B — episode-level actions (bottom-up cascade)", () => {
  it("B1: save episode on an untracked show → auto-creates parent as 'watching' (any status)", async () => {
    const { userId } = await getTestSession();

    const saved = await saveEpisode({
      userId,
      tmdbId: 9_101_201,
      seasonNumber: 1,
      episodeNumber: 1,
      episodeEntry: ep("unwatched"),
      showData: SHOW,
    });

    expect(saved.id).toBeTruthy();
    const fresh = await fetchFreshMedia(userId, 9_101_201, "tv");
    expect(fresh?.title).toBe(SHOW.name);
    expect(fresh?.status).toBe("watching");
    expect(fresh?.seasons?.S01?.episodes?.E01?.status).toBe("unwatched");
  });

  it("B2: 'watched' save under explicit 'unwatched' season/show → override cleared, bubbles to 'watching'", async () => {
    const { userId } = await getTestSession();
    const media = await seed(userId, 9_101_202, {
      status: "unwatched",
      seasons: { S01: { status: "unwatched" } },
    });

    await saveEpisode({
      userId,
      tmdbId: 9_101_202,
      seasonNumber: 1,
      episodeNumber: 1,
      episodeEntry: ep("watched"),
      existingMedia: media,
      showData: SHOW,
    });

    const fresh = await fetchFreshMedia(userId, 9_101_202, "tv");
    expect(fresh?.status).toBe("watching");
    expect(fresh?.seasons?.S01?.status).toBeUndefined(); // override broken
    expect(fresh?.seasons?.S01?.episodes?.E01?.status).toBe("watched");
  });

  it("B3: 'watched' save completing the season → season derives 'watched', show stays 'watching'", async () => {
    const { userId } = await getTestSession();
    const media = await seed(userId, 9_101_203, {
      status: "watching",
      seasons: { S01: { episodes: { E01: ep("watched"), E02: ep("watched") } } },
    });

    await saveEpisode({
      userId,
      tmdbId: 9_101_203,
      seasonNumber: 1,
      episodeNumber: 3,
      episodeEntry: ep("watched"),
      existingMedia: media,
      showData: SHOW,
    });

    const fresh = await fetchFreshMedia(userId, 9_101_203, "tv");
    // The season has no explicit override — "watched" is derived at read time.
    expect(fresh?.seasons?.S01?.status).toBeUndefined();
    expect(
      computeSeasonStatus(fresh?.seasons?.S01?.episodes, 3),
    ).toBe("watched");
    // Show does NOT promote: only 1 of 3 seasons is tracked.
    expect(fresh?.status).toBe("watching");
  });

  it("B4: 'watched' save completing the last season → show auto-promotes to 'watched'", async () => {
    const { userId } = await getTestSession();
    const media = await seed(userId, 9_101_204, {
      status: "watching",
      seasons: {
        S01: { episodes: { E01: ep("watched"), E02: ep("watched"), E03: ep("watched") } },
        S02: { episodes: { E01: ep("watched"), E02: ep("watched"), E03: ep("watched") } },
        S03: { episodes: { E01: ep("watched"), E02: ep("watched") } },
      },
    });

    await saveEpisode({
      userId,
      tmdbId: 9_101_204,
      seasonNumber: 3,
      episodeNumber: 3,
      episodeEntry: ep("watched"),
      existingMedia: media,
      showData: SHOW,
    });

    const fresh = await fetchFreshMedia(userId, 9_101_204, "tv");
    expect(fresh?.status).toBe("watched");
    // DEVIATION vs Table B row 4: this path does NOT set
    // tracked_season_count — only handleTmdbReady writes that field.
    expect(fresh?.tracked_season_count).toBeUndefined();
  });

  it("B5: 'watching' save under explicit 'unwatched' season/show → override cleared, bubbles to 'watching'", async () => {
    const { userId } = await getTestSession();
    const media = await seed(userId, 9_101_205, {
      status: "unwatched",
      seasons: { S01: { status: "unwatched" } },
    });

    await saveEpisode({
      userId,
      tmdbId: 9_101_205,
      seasonNumber: 1,
      episodeNumber: 1,
      episodeEntry: ep("watching"),
      existingMedia: media,
      showData: SHOW,
    });

    const fresh = await fetchFreshMedia(userId, 9_101_205, "tv");
    expect(fresh?.status).toBe("watching");
    expect(fresh?.seasons?.S01?.status).toBeUndefined();
  });

  it("B6: 'watching' save under explicit 'watched' season/show → breaks umbrella, downgrades to 'watching'", async () => {
    const { userId } = await getTestSession();
    const media = await seed(userId, 9_101_206, {
      status: "watched",
      seasons: { S01: { status: "watched" } },
    });

    await saveEpisode({
      userId,
      tmdbId: 9_101_206,
      seasonNumber: 1,
      episodeNumber: 1,
      episodeEntry: ep("watching"),
      existingMedia: media,
      showData: SHOW,
    });

    const fresh = await fetchFreshMedia(userId, 9_101_206, "tv");
    expect(fresh?.status).toBe("watching"); // umbrella broken
    expect(fresh?.seasons?.S01?.status).toBeUndefined(); // override broken
  });

  it("B7: 'unwatched' save under explicit 'watched' season/show → breaks umbrella, downgrades to 'watching'", async () => {
    const { userId } = await getTestSession();
    const media = await seed(userId, 9_101_207, {
      status: "watched",
      seasons: { S01: { status: "watched" } },
    });

    await saveEpisode({
      userId,
      tmdbId: 9_101_207,
      seasonNumber: 1,
      episodeNumber: 1,
      episodeEntry: ep("unwatched"),
      existingMedia: media,
      showData: SHOW,
    });

    const fresh = await fetchFreshMedia(userId, 9_101_207, "tv");
    expect(fresh?.status).toBe("watching");
    expect(fresh?.seasons?.S01?.status).toBeUndefined();
    expect(fresh?.seasons?.S01?.episodes?.E01?.status).toBe("unwatched");
  });

  it("B8: delete last episode record in a season → season pruned, show recalculated", async () => {
    const { userId } = await getTestSession();
    const media = await seed(userId, 9_101_208, {
      status: "watching",
      seasons: {
        S01: { episodes: { E01: ep("watched") } },
        S02: { episodes: { E01: ep("unwatched") } },
      },
    });

    await deleteEpisodeRecord({
      userId,
      seasonNumber: 1,
      episodeNumber: 1,
      existingMedia: media,
      showData: SHOW,
    });

    const fresh = await fetchFreshMedia(userId, 9_101_208, "tv");
    expect(fresh?.seasons?.S01).toBeUndefined(); // pruned — no status, no episodes
    expect(fresh?.seasons?.S02?.episodes?.E01?.status).toBe("unwatched");
    expect(fresh?.status).toBe("unwatched"); // recomputed from remaining seasons
  });

  it("B9: delete the last episode record in the whole show → show drops to 'unwatched'", async () => {
    const { userId } = await getTestSession();
    const media = await seed(userId, 9_101_209, {
      status: "watching",
      seasons: { S01: { episodes: { E01: ep("watched") } } },
    });

    await deleteEpisodeRecord({
      userId,
      seasonNumber: 1,
      episodeNumber: 1,
      existingMedia: media,
      showData: SHOW,
    });

    const fresh = await fetchFreshMedia(userId, 9_101_209, "tv");
    // DEVIATION vs Table B row 9 ("parent status is NOT auto-changed"): the
    // Stage 9 "Untrack hierarchy fix" made the code actively set "unwatched"
    // when no seasons remain — an emptied show must not keep a ghost
    // umbrella status. This test pins the CODE's behavior. (The emptied
    // seasons map is omitted from the patch, matching the wrapper save
    // convention — one representation of "empty" in the DB.)
    expect(fresh?.status).toBe("unwatched");
    expect(fresh?.seasons).toBeUndefined();
  });

  it("INVARIANT: 'watched' save under a forced-'watched' show leaves the umbrella untouched", async () => {
    const { userId } = await getTestSession();
    const media = await seed(userId, 9_101_210, { status: "watched" });

    await saveEpisode({
      userId,
      tmdbId: 9_101_210,
      seasonNumber: 1,
      episodeNumber: 1,
      episodeEntry: ep("watched"),
      existingMedia: media,
      showData: SHOW,
    });

    const fresh = await fetchFreshMedia(userId, 9_101_210, "tv");
    // The computed status would be "watching" (1 of 3 seasons, 1 of 3
    // episodes) but only a non-"watched" episode save may break the umbrella.
    expect(fresh?.status).toBe("watched");
    expect(fresh?.seasons?.S01?.episodes?.E01?.status).toBe("watched");
  });
});

describe("Table B — named regressions (override-clearing paths)", () => {
  it("REGRESSION #1 (Original Repro): explicit season 'unwatched' + one 'watched' episode save → override cleared, show bubbles to 'watching'", async () => {
    const { userId } = await getTestSession();
    const media = await seed(userId, 9_101_301, {
      status: "unwatched",
      seasons: { S01: { status: "unwatched" } },
    });

    await saveEpisode({
      userId,
      tmdbId: 9_101_301,
      seasonNumber: 1,
      episodeNumber: 1,
      episodeEntry: ep("watched"),
      existingMedia: media,
      showData: SHOW,
    });

    const fresh = await fetchFreshMedia(userId, 9_101_301, "tv");
    expect(fresh?.seasons?.S01?.status).toBeUndefined(); // the regression: stale "unwatched" override
    expect(fresh?.status).toBe("watching");
  });

  it("REGRESSION #2 (Downgrade Twin): explicit season 'watched' + one 'unwatched' episode save → override cleared, show downgrades to 'watching'", async () => {
    const { userId } = await getTestSession();
    const media = await seed(userId, 9_101_302, {
      status: "watched",
      seasons: { S01: { status: "watched" } },
    });

    await saveEpisode({
      userId,
      tmdbId: 9_101_302,
      seasonNumber: 1,
      episodeNumber: 1,
      episodeEntry: ep("unwatched"),
      existingMedia: media,
      showData: SHOW,
    });

    const fresh = await fetchFreshMedia(userId, 9_101_302, "tv");
    expect(fresh?.seasons?.S01?.status).toBeUndefined(); // the regression: stale "watched" override
    expect(fresh?.status).toBe("watching");
  });
});

describe("Table C — season-level overrides (mid-tier)", () => {
  it("C1: force season 'watched' with no episode records → override set, show recalculated", async () => {
    const { userId } = await getTestSession();
    const media = await seed(userId, 9_101_401, { status: "unwatched" });

    expect(countSeasonOverrideConflicts(media.seasons?.S01, "watched")).toBe(0);

    await persistSeasons(
      userId,
      media,
      applySeasonOverride(media.seasons ?? {}, "S01", "watched"),
    );

    const fresh = await fetchFreshMedia(userId, 9_101_401, "tv");
    expect(fresh?.seasons?.S01?.status).toBe("watched");
    expect(fresh?.seasons?.S01?.episodes).toEqual({});
    expect(fresh?.status).toBe("watching"); // 1 of 3 seasons forced
  });

  it("C2: force season 'watched' with conflicting records → conflicting episodes cleared, override set", async () => {
    const { userId } = await getTestSession();
    const media = await seed(userId, 9_101_402, {
      status: "watching",
      seasons: { S01: { episodes: { E01: ep("watched"), E02: ep("unwatched") } } },
    });

    expect(countSeasonOverrideConflicts(media.seasons?.S01, "watched")).toBe(1);

    await persistSeasons(
      userId,
      media,
      computeSeasonOverrideSeasons(media.seasons ?? {}, "S01", "watched"),
    );

    const fresh = await fetchFreshMedia(userId, 9_101_402, "tv");
    expect(fresh?.seasons?.S01?.status).toBe("watched");
    // DEVIATION vs Table C row 2 ("episodes cleared"): the code clears only
    // the CONFLICTING episodes — the matching "watched" record survives.
    expect(fresh?.seasons?.S01?.episodes?.E01?.status).toBe("watched");
    expect(fresh?.seasons?.S01?.episodes?.E02).toBeUndefined();
    expect(fresh?.status).toBe("watching");
  });

  it("C3: force season 'unwatched' with no episode records → override set, show recalculated", async () => {
    const { userId } = await getTestSession();
    const media = await seed(userId, 9_101_403, { status: "watching" });

    expect(countSeasonOverrideConflicts(media.seasons?.S01, "unwatched")).toBe(0);

    await persistSeasons(
      userId,
      media,
      applySeasonOverride(media.seasons ?? {}, "S01", "unwatched"),
    );

    const fresh = await fetchFreshMedia(userId, 9_101_403, "tv");
    expect(fresh?.seasons?.S01?.status).toBe("unwatched");
    expect(fresh?.status).toBe("unwatched"); // only tracked season is "unwatched"
  });

  it("C4: force season 'unwatched' with records → episodes cleared, override set", async () => {
    const { userId } = await getTestSession();
    const media = await seed(userId, 9_101_404, {
      status: "watching",
      seasons: { S01: { episodes: { E01: ep("watched") } } },
    });

    expect(countSeasonOverrideConflicts(media.seasons?.S01, "unwatched")).toBe(1);

    await persistSeasons(
      userId,
      media,
      computeSeasonOverrideSeasons(media.seasons ?? {}, "S01", "unwatched"),
    );

    const fresh = await fetchFreshMedia(userId, 9_101_404, "tv");
    expect(fresh?.seasons?.S01?.status).toBe("unwatched");
    expect(fresh?.seasons?.S01?.episodes).toEqual({});
    expect(fresh?.status).toBe("unwatched");
  });

  it("C5: force season 'watching' with no records → override set, show becomes at least 'watching'", async () => {
    const { userId } = await getTestSession();
    const media = await seed(userId, 9_101_405, { status: "unwatched" });

    expect(countSeasonOverrideConflicts(media.seasons?.S01, "watching")).toBe(0);

    await persistSeasons(
      userId,
      media,
      applySeasonOverride(media.seasons ?? {}, "S01", "watching"),
    );

    const fresh = await fetchFreshMedia(userId, 9_101_405, "tv");
    expect(fresh?.seasons?.S01?.status).toBe("watching");
    expect(fresh?.status).toBe("watching");
  });

  it("C6: force season 'watching' with only non-'watched' records → no conflict, records kept", async () => {
    const { userId } = await getTestSession();
    const media = await seed(userId, 9_101_406, {
      status: "watching",
      seasons: { S01: { episodes: { E01: ep("unwatched") } } },
    });

    expect(countSeasonOverrideConflicts(media.seasons?.S01, "watching")).toBe(0);

    await persistSeasons(
      userId,
      media,
      applySeasonOverride(media.seasons ?? {}, "S01", "watching"),
    );

    const fresh = await fetchFreshMedia(userId, 9_101_406, "tv");
    expect(fresh?.seasons?.S01?.status).toBe("watching");
    expect(fresh?.seasons?.S01?.episodes?.E01?.status).toBe("unwatched");
    expect(fresh?.status).toBe("watching");
  });

  it("C7: force season 'watching' with 'watched' records → only 'watched' episodes cleared", async () => {
    const { userId } = await getTestSession();
    const media = await seed(userId, 9_101_407, {
      status: "watching",
      seasons: { S01: { episodes: { E01: ep("watched"), E02: ep("unwatched") } } },
    });

    expect(countSeasonOverrideConflicts(media.seasons?.S01, "watching")).toBe(1);

    await persistSeasons(
      userId,
      media,
      computeSeasonOverrideSeasons(media.seasons ?? {}, "S01", "watching"),
    );

    const fresh = await fetchFreshMedia(userId, 9_101_407, "tv");
    expect(fresh?.seasons?.S01?.status).toBe("watching");
    expect(fresh?.seasons?.S01?.episodes?.E01).toBeUndefined();
    expect(fresh?.seasons?.S01?.episodes?.E02?.status).toBe("unwatched");
    expect(fresh?.status).toBe("watching");
  });

  it("C8: toggle off a season override with no episodes → season pruned entirely", async () => {
    const { userId } = await getTestSession();
    const media = await seed(userId, 9_101_408, {
      status: "watching",
      seasons: { S01: { status: "unwatched" } },
    });

    await persistSeasons(
      userId,
      media,
      clearSeasonOverride(media.seasons ?? {}, "S01"),
    );

    const fresh = await fetchFreshMedia(userId, 9_101_408, "tv");
    expect(fresh?.seasons?.S01).toBeUndefined(); // status cleared + no episodes → pruned
    expect(fresh?.status).toBe("unwatched");
  });

  it("C9: toggle off a season override with remaining episodes → override cleared, episodes kept", async () => {
    const { userId } = await getTestSession();
    const media = await seed(userId, 9_101_409, {
      status: "watching",
      seasons: { S01: { status: "watched", episodes: { E01: ep("unwatched") } } },
    });

    await persistSeasons(
      userId,
      media,
      clearSeasonOverride(media.seasons ?? {}, "S01"),
    );

    const fresh = await fetchFreshMedia(userId, 9_101_409, "tv");
    expect(fresh?.seasons?.S01?.status).toBeUndefined();
    expect(fresh?.seasons?.S01?.episodes?.E01?.status).toBe("unwatched");
    expect(fresh?.status).toBe("unwatched"); // derived from the remaining episode
  });

  it("C10: untrack season (delete all records for a season) → season removed, show recalculated", async () => {
    const { userId } = await getTestSession();
    const media = await seed(userId, 9_101_410, {
      status: "watching",
      seasons: {
        S01: { episodes: { E01: ep("watched") } },
        S02: { status: "unwatched" },
      },
    });

    await persistSeasons(
      userId,
      media,
      removeSeason(media.seasons ?? {}, "S01"),
    );

    const fresh = await fetchFreshMedia(userId, 9_101_410, "tv");
    expect(fresh?.seasons?.S01).toBeUndefined();
    expect(fresh?.seasons?.S02?.status).toBe("unwatched");
    expect(fresh?.status).toBe("unwatched");
  });
});
