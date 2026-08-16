import { describe, expect, it, vi } from "vitest";
import {
  computeSeasonStatus,
  computeShowStatusFromSeasons,
  getEffectiveEpisodeStatus,
  pruneEmptySeasons,
} from "@/api/media/media";
import { checkNewSeason } from "@/api/media/handlers";
import type { EpisodeTracking, SeasonTracking } from "@/types/media";

/**
 * Tier 1 — Pure function unit tests (media status bubbling / override invariants).
 *
 * The functions under test are pure; the two infrastructure modules they sit
 * next to (Supabase client + crypto KMS) are mocked so this suite never loads
 * a browser SDK, WASM, or IndexedDB. Case enumeration follows Stage 11 of
 * docs/plans/PLAN-mediamanager.md exactly.
 */

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/crypto", () => ({
  encryptField: vi.fn(),
  decryptField: vi.fn(),
}));

// ── Builders ──

/** Build a zero-padded episode map ("E01"…"E{count}") all sharing one status. */
function makeEpisodes(
  count: number,
  status: EpisodeTracking["status"],
): Record<string, EpisodeTracking> {
  const out: Record<string, EpisodeTracking> = {};
  for (let i = 1; i <= count; i++) {
    out[`E${String(i).padStart(2, "0")}`] = { status };
  }
  return out;
}

// ── computeSeasonStatus ──

describe("computeSeasonStatus", () => {
  it("returns null when no episodes are tracked, regardless of total", () => {
    expect(computeSeasonStatus({}, 10)).toBeNull();
  });

  it("returns null when episodes is undefined (signature contract)", () => {
    expect(computeSeasonStatus(undefined, 10)).toBeNull();
  });

  it("returns 'watching' for a single 'watching' episode out of 10", () => {
    expect(computeSeasonStatus({ E01: { status: "watching" } }, 10)).toBe("watching");
  });

  it("returns 'watching' for a single 'watched' episode out of 10 (not enough to complete)", () => {
    expect(computeSeasonStatus({ E01: { status: "watched" } }, 10)).toBe("watching");
  });

  it("returns 'watched' when all 10 of 10 episodes are explicitly watched", () => {
    expect(computeSeasonStatus(makeEpisodes(10, "watched"), 10)).toBe("watched");
  });

  it("returns 'unwatched' when all 10 of 10 episodes are explicitly unwatched", () => {
    expect(computeSeasonStatus(makeEpisodes(10, "unwatched"), 10)).toBe("unwatched");
  });

  it("returns 'watching' for a mix of 9 watched + 1 unwatched out of 10", () => {
    const mixed = { ...makeEpisodes(9, "watched"), E10: { status: "unwatched" as const } };
    expect(computeSeasonStatus(mixed, 10)).toBe("watching");
  });

  it("returns 'watching' when every tracked episode is watched but count < total (8 of 10)", () => {
    expect(computeSeasonStatus(makeEpisodes(8, "watched"), 10)).toBe("watching");
  });

  it("does not crash or report 'watched' when totalEpsInSeason is 0", () => {
    expect(computeSeasonStatus({ E01: { status: "watched" } }, 0)).toBe("watching");
  });
});

// ── computeShowStatusFromSeasons ──

describe("computeShowStatusFromSeasons", () => {
  it("returns null when no seasons are tracked", () => {
    expect(computeShowStatusFromSeasons({}, 3, {})).toBeNull();
  });

  it("returns 'watching' when 1 season is watched but the show has 3 seasons", () => {
    const seasons: Record<string, SeasonTracking> = { S01: { status: "watched" } };
    expect(computeShowStatusFromSeasons(seasons, 3, {})).toBe("watching");
  });

  it("returns 'watched' when all seasons are effectively watched and count equals total (computed from episodes)", () => {
    const seasons: Record<string, SeasonTracking> = {
      S01: { episodes: makeEpisodes(2, "watched") },
      S02: { episodes: makeEpisodes(2, "watched") },
    };
    const counts = { S01: 2, S02: 2 };
    expect(computeShowStatusFromSeasons(seasons, 2, counts)).toBe("watched");
  });

  it("returns 'watched' when all seasons carry an explicit 'watched' override and count equals total", () => {
    const seasons: Record<string, SeasonTracking> = {
      S01: { status: "watched" },
      S02: { status: "watched" },
    };
    expect(computeShowStatusFromSeasons(seasons, 2, {})).toBe("watched");
  });

  it("returns 'unwatched' when all seasons are effectively unwatched", () => {
    const seasons: Record<string, SeasonTracking> = {
      S01: { episodes: makeEpisodes(2, "unwatched") },
      S02: { episodes: makeEpisodes(2, "unwatched") },
    };
    const counts = { S01: 2, S02: 2 };
    expect(computeShowStatusFromSeasons(seasons, 3, counts)).toBe("unwatched");
  });

  it("returns 'watching' for mixed season statuses", () => {
    const seasons: Record<string, SeasonTracking> = {
      S01: { status: "watched" },
      S02: { episodes: makeEpisodes(2, "unwatched") },
    };
    const counts = { S01: 0, S02: 2 };
    expect(computeShowStatusFromSeasons(seasons, 2, counts)).toBe("watching");
  });

  it("treats a season with an explicit 'watched' override but 0 episodes as watched at this layer", () => {
    const seasons: Record<string, SeasonTracking> = {
      S01: { status: "watched", episodes: {} },
    };
    expect(computeShowStatusFromSeasons(seasons, 1, {})).toBe("watched");
  });
});

// ── getEffectiveEpisodeStatus ──

describe("getEffectiveEpisodeStatus", () => {
  it.each(["watched", "watching", "unwatched"] as const)(
    "returns the explicit episode status %s as real, overriding every other signal",
    (epStatus) => {
      const result = getEffectiveEpisodeStatus("watched", "unwatched", epStatus, false);
      expect(result).toEqual({ status: epStatus, isVirtual: false });
    },
  );

  it("inherits 'watched' from the season when the episode is untracked", () => {
    expect(getEffectiveEpisodeStatus(undefined, "watched", undefined)).toEqual({
      status: "watched",
      isVirtual: true,
    });
  });

  it("inherits 'unwatched' from the season when the episode is untracked", () => {
    expect(getEffectiveEpisodeStatus(undefined, "unwatched", undefined)).toEqual({
      status: "unwatched",
      isVirtual: true,
    });
  });

  it("inherits 'watched' from a watched parent when neither season nor episode has a status", () => {
    expect(getEffectiveEpisodeStatus("watched", undefined, undefined)).toEqual({
      status: "watched",
      isVirtual: true,
    });
  });

  it("projects 'watching' onto the first episode of a watching show with no season/episode status", () => {
    expect(getEffectiveEpisodeStatus("watching", undefined, undefined, true)).toEqual({
      status: "watching",
      isVirtual: true,
    });
  });

  it("projects 'unwatched' onto non-first episodes of a watching show with no season/episode status", () => {
    expect(getEffectiveEpisodeStatus("watching", undefined, undefined, false)).toEqual({
      status: "unwatched",
      isVirtual: true,
    });
  });

  it("projects 'unwatched' from an unwatched parent with no season/episode status", () => {
    expect(getEffectiveEpisodeStatus("unwatched", undefined, undefined)).toEqual({
      status: "unwatched",
      isVirtual: true,
    });
  });
});

// ── pruneEmptySeasons ──

describe("pruneEmptySeasons", () => {
  it("removes a season with no episodes and no explicit status", () => {
    const seasons: Record<string, SeasonTracking> = { S01: {} };
    pruneEmptySeasons(seasons);
    expect(seasons).toEqual({});
  });

  it("keeps a season with no episodes but an explicit status override", () => {
    const seasons: Record<string, SeasonTracking> = { S01: { status: "watched" } };
    pruneEmptySeasons(seasons);
    expect(seasons).toEqual({ S01: { status: "watched" } });
  });

  it("keeps a season with at least one tracked episode regardless of status", () => {
    const seasons: Record<string, SeasonTracking> = {
      S01: { episodes: { E01: { status: "watched" } } },
    };
    pruneEmptySeasons(seasons);
    expect(seasons).toEqual({ S01: { episodes: { E01: { status: "watched" } } } });
  });

  it("removes only empty status-less seasons from a mixed map", () => {
    const seasons: Record<string, SeasonTracking> = {
      S01: {},
      S02: { status: "watched" },
      S03: { episodes: { E01: { status: "unwatched" } } },
    };
    pruneEmptySeasons(seasons);
    expect(Object.keys(seasons).sort()).toEqual(["S02", "S03"]);
  });
});

// ── checkNewSeason ──

describe("checkNewSeason", () => {
  it("returns 'backfill' when no tracked baseline exists yet", () => {
    expect(checkNewSeason(undefined, 5)).toBe("backfill");
  });

  it("returns 'new' when TMDB lists more seasons than tracked", () => {
    expect(checkNewSeason(5, 6)).toBe("new");
  });

  it("returns 'none' when the counts match", () => {
    expect(checkNewSeason(5, 5)).toBe("none");
  });

  it("returns 'none' when TMDB lists fewer seasons than tracked (upstream removal)", () => {
    expect(checkNewSeason(5, 4)).toBe("none");
  });

  it("returns 'none' when TMDB reports no seasons with an undefined baseline", () => {
    expect(checkNewSeason(undefined, 0)).toBe("none");
  });

  it("returns 'none' when TMDB reports no seasons with a tracked baseline", () => {
    expect(checkNewSeason(3, 0)).toBe("none");
  });
});
