import { describe, it, expect } from "vitest";
import { getTestSession } from "@/test/testSession";
import { fetchFreshMedia } from "@/test/integration-helpers";
import {
  createMedia,
  updateMedia,
  buildMediaPatch,
  saveEpisode,
  countShowOverrideConflicts,
  computeShowOverrideSeasons,
  listCollections,
  createCollection,
  updateCollection,
  deleteCollection,
} from "@/api/media";
import type {
  Media,
  MediaPlaintext,
  SeasonTracking,
  EpisodeTracking,
  TmdbDetails,
} from "@/types/media";

/**
 * Tier 3 — collections independence. Proves the two subsystems never bleed
 * into each other through the real DB:
 *
 * - Tracking mutations (episode save, show override with nested-record
 *   clearing) must NOT touch `collection_id` / `collection_ids`.
 * - Collection mutations (create, update, delete-with-unlink) must NOT touch
 *   `status` / `seasons` / episode records.
 * - A media row that is both tracked AND collection-linked behaves exactly
 *   like an unlinked twin for every tracking rule — membership is metadata,
 *   never an input to status computation.
 */

const SHOW: Pick<TmdbDetails, "seasons" | "number_of_seasons" | "name"> = {
  name: "Collections Independence Show",
  number_of_seasons: 3,
  seasons: [
    { season_number: 1, episode_count: 3 },
    { season_number: 2, episode_count: 3 },
    { season_number: 3, episode_count: 3 },
  ],
};

const ep = (status: EpisodeTracking["status"]): EpisodeTracking => ({ status });

function tvExtraPatchFields(
  seasons: Record<string, SeasonTracking>,
): Partial<MediaPlaintext> {
  return {
    seasons: Object.keys(seasons).length > 0 ? seasons : undefined,
    episodes: undefined,
  };
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

describe("Tier 3 — tracking status vs collection membership independence", () => {
  it("T3.1: episode save preserves collection membership while updating tracking state", async () => {
    const { userId } = await getTestSession();
    const col = await createCollection(userId, { name: "T3.1 Collection" });
    const media = await seed(userId, 9_102_001, {
      status: "unwatched",
      seasons: { S01: { status: "unwatched" } },
    });
    await updateMedia(userId, media.id, { collection_ids: [col.id] });

    await saveEpisode({
      userId,
      tmdbId: 9_102_001,
      seasonNumber: 1,
      episodeNumber: 1,
      episodeEntry: ep("watched"),
      existingMedia: media,
      showData: SHOW,
    });

    const fresh = await fetchFreshMedia(userId, 9_102_001, "tv");
    // Tracking updated…
    expect(fresh?.status).toBe("watching");
    expect(fresh?.seasons?.S01?.status).toBeUndefined();
    expect(fresh?.seasons?.S01?.episodes?.E01?.status).toBe("watched");
    // …and membership untouched.
    expect(fresh?.collection_ids).toEqual([col.id]);
  });

  it("T3.2: show override (with nested-record clearing) rides one patch with the collection link — both land", async () => {
    const { userId } = await getTestSession();
    const col = await createCollection(userId, { name: "T3.2 Collection" });
    const media = await seed(userId, 9_102_002, {
      status: "watching",
      seasons: { S01: { episodes: { E01: ep("unwatched") } } },
    });
    await updateMedia(userId, media.id, { collection_ids: [col.id] });

    // The full GenericMediaPage handleSave composition: conflict dialog
    // confirmed, patch carries status + collection_ids + cleared seasons.
    expect(countShowOverrideConflicts(media.seasons ?? {}, "watched")).toBe(1);
    const cleared = computeShowOverrideSeasons(media.seasons ?? {}, "watched");
    const patch = buildMediaPatch({
      status: "watched",
      isTracked: true,
      mediaType: "tv",
      totalSeasons: SHOW.number_of_seasons ?? 0,
      collectionIds: [col.id],
      extraPatchFields: tvExtraPatchFields(cleared),
    });
    await updateMedia(userId, media.id, patch);

    const fresh = await fetchFreshMedia(userId, 9_102_002, "tv");
    expect(fresh?.status).toBe("watched");
    expect(fresh?.seasons).toBeUndefined(); // conflicting record cleared, pruned
    expect(fresh?.collection_ids).toEqual([col.id]); // link survived the wipe of nested records
  });

  it("T3.3: deleting a collection unlinks its media but preserves their tracking state", async () => {
    const { userId } = await getTestSession();
    const col = await createCollection(userId, { name: "T3.3 Collection" });
    const media = await seed(userId, 9_102_003, {
      status: "watching",
      seasons: { S01: { episodes: { E01: ep("watched") } } },
    });
    await updateMedia(userId, media.id, { collection_ids: [col.id] });

    await deleteCollection(userId, col.id);

    const fresh = await fetchFreshMedia(userId, 9_102_003, "tv");
    expect(fresh?.collection_ids).toBeUndefined(); // unlinked
    // Tracking state untouched by the unlink + collection delete.
    expect(fresh?.status).toBe("watching");
    expect(fresh?.seasons?.S01?.episodes?.E01?.status).toBe("watched");
    expect(fresh?.seasons?.S01?.status).toBeUndefined();

    const collections = await listCollections(userId);
    expect(collections.find((c) => c.id === col.id)).toBeUndefined();
  });

  it("T3.4: collection create/update never touches media tracking state", async () => {
    const { userId } = await getTestSession();
    await seed(userId, 9_102_004, {
      status: "watching",
      seasons: { S01: { episodes: { E01: ep("watched") } } },
    });

    const col = await createCollection(userId, { name: "T3.4 Collection" });
    await updateCollection(userId, col.id, { description: "updated" });

    const fresh = await fetchFreshMedia(userId, 9_102_004, "tv");
    expect(fresh?.status).toBe("watching");
    expect(fresh?.seasons?.S01?.episodes?.E01?.status).toBe("watched");
    expect(fresh?.collection_ids).toBeUndefined(); // never linked — unchanged
  });

  it("T3.5: a linked show and an unlinked twin behave identically for every tracking rule", async () => {
    const { userId } = await getTestSession();
    const col = await createCollection(userId, { name: "T3.5 Collection" });

    const linked = await seed(userId, 9_102_005, {
      status: "watched",
      seasons: { S01: { status: "watched" } },
    });
    await updateMedia(userId, linked.id, { collection_ids: [col.id] });
    const unlinked = await seed(userId, 9_102_006, {
      status: "watched",
      seasons: { S01: { status: "watched" } },
    });

    // The umbrella-breaking rule must produce the same outcome on both.
    await saveEpisode({
      userId,
      tmdbId: 9_102_005,
      seasonNumber: 1,
      episodeNumber: 1,
      episodeEntry: ep("unwatched"),
      existingMedia: linked,
      showData: SHOW,
    });
    await saveEpisode({
      userId,
      tmdbId: 9_102_006,
      seasonNumber: 1,
      episodeNumber: 1,
      episodeEntry: ep("unwatched"),
      existingMedia: unlinked,
      showData: SHOW,
    });

    const freshLinked = await fetchFreshMedia(userId, 9_102_005, "tv");
    const freshUnlinked = await fetchFreshMedia(userId, 9_102_006, "tv");

    expect(freshLinked?.status).toBe("watching");
    expect(freshLinked?.status).toBe(freshUnlinked?.status);
    expect(freshLinked?.seasons).toEqual(freshUnlinked?.seasons);
    // The ONLY difference between the twins is the membership itself.
    expect(freshLinked?.collection_ids).toEqual([col.id]);
    expect(freshUnlinked?.collection_ids).toBeUndefined();
  });
});
