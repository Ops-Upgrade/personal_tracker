import { describe, it, expect } from "vitest";
import { getTestSession } from "@/test/testSession";
import { createMedia, getMediaByTmdbId, clearMediaCache } from "@/api/media";

/**
 * Harness smoke test — pins that the integration boundary itself works:
 * dummy-user sign-in → DEK bootstrap → encrypted media round-trip against
 * the real Supabase project. If this fails, every other integration test
 * fails for the same root cause (credentials / network / crypto).
 */
describe("integration harness smoke test", () => {
  it("signs in as the dummy user, boots crypto, and round-trips an encrypted media row", async () => {
    const { userId } = await getTestSession();

    const created = await createMedia(userId, {
      tmdb_id: 9_100_001,
      type: "tv",
      title: "Harness Smoke Test",
      status: "watching",
      seasons: { S01: { episodes: { E01: { status: "watched" } } } },
    });
    expect(created.id).toBeTruthy();

    // Fresh read from the DB (cache dropped) — the blob must decrypt.
    clearMediaCache();
    const fresh = await getMediaByTmdbId(userId, 9_100_001, "tv");
    expect(fresh).toBeDefined();
    expect(fresh?.status).toBe("watching");
    expect(fresh?.seasons?.S01?.episodes?.E01?.status).toBe("watched");
  });
});
