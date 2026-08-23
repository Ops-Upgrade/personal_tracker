// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/tmdb/search/route";

/**
 * Tier 1-A — the TMDB search route.
 * Server-side merge of a person's cast + director credits into the search
 * results, with id+media_type dedup and the transient/fatal error split that
 * drives client-side retry UX.
 */

const { authMock, fetchTmdbMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  fetchTmdbMock: vi.fn(),
}));

vi.mock("@/app/api/storage/_helpers/auth", () => ({
  getAuthenticatedUserId: authMock,
}));
vi.mock("@/lib/tmdb/fetchTmdb", () => ({
  fetchTmdb: fetchTmdbMock,
}));
vi.mock("@/app/api/tmdb/_helpers/headers", () => ({
  TMDB_HEADERS: { Accept: "application/json" },
}));

function req(body: Record<string, unknown>) {
  return new NextRequest("https://app.test/api/tmdb/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue("user-1");
  vi.stubEnv("TMDB_API_KEY", "tmdb-key");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("auth and configuration", () => {
  it("returns 401 without a session", async () => {
    authMock.mockResolvedValue(null);

    const res = await POST(req({ query: "x", type: "multi" }));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns 500 when the TMDB key is not configured", async () => {
    vi.stubEnv("TMDB_API_KEY", undefined);

    const res = await POST(req({ query: "x", type: "multi" }));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "TMDB API key not configured" });
    expect(fetchTmdbMock).not.toHaveBeenCalled();
  });

  it("returns an empty list for a blank query without calling TMDB", async () => {
    const res = await POST(req({ query: "   ", type: "multi" }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual([]);
    expect(fetchTmdbMock).not.toHaveBeenCalled();
  });
});

describe("person credit merge and dedup", () => {
  it("merges search results with the top person's cast + director credits", async () => {
    fetchTmdbMock
      .mockResolvedValueOnce({
        kind: "ok",
        data: {
          results: [
            { id: 1, media_type: "person", name: "Actor" },
            {
              id: 100,
              media_type: "movie",
              title: "Movie A",
              poster_path: "/a.jpg",
              overview: "ov-a",
              release_date: "2020-01-01",
              popularity: 5,
            },
            { id: 200, media_type: "tv", name: "Show B", first_air_date: "2021-02-02" },
          ],
        },
      })
      .mockResolvedValueOnce({
        kind: "ok",
        data: {
          cast: [
            // Duplicate of a search result — must not appear twice.
            { id: 100, media_type: "movie", title: "Movie A" },
            {
              id: 300,
              media_type: "tv",
              name: "Show C",
              first_air_date: "2019-03-03",
              popularity: 9,
            },
          ],
          crew: [
            { id: 400, media_type: "movie", job: "Director", title: "Movie D", popularity: 8 },
            // Producer credits are filtered out.
            { id: 500, media_type: "movie", job: "Producer", title: "Movie E", popularity: 7 },
          ],
        },
      });

    const res = await POST(req({ query: "actor", type: "multi", page: 1 }));

    expect(res.status).toBe(200);
    const body = await res.json();

    // Person excluded, duplicates dropped, credits sorted by popularity.
    expect(body.map((r: { tmdb_id: number }) => r.tmdb_id)).toEqual([100, 200, 300, 400]);
    expect(body[0]).toEqual({
      tmdb_id: 100,
      type: "movie",
      title: "Movie A",
      poster_path: "/a.jpg",
      overview: "ov-a",
      release_date: "2020-01-01",
    });
    expect(body[1].release_date).toBe("2021-02-02"); // first_air_date fallback for tv
    expect(fetchTmdbMock).toHaveBeenCalledTimes(2);
  });

  it("skips the credits call on pages after the first", async () => {
    fetchTmdbMock.mockResolvedValueOnce({
      kind: "ok",
      data: { results: [{ id: 1, media_type: "person", name: "Actor" }] },
    });

    const res = await POST(req({ query: "actor", type: "multi", page: 2 }));

    await expect(res.json()).resolves.toEqual([]);
    expect(fetchTmdbMock).toHaveBeenCalledTimes(1);
  });
});

describe("TMDB errors", () => {
  it("propagates fatal errors with their status", async () => {
    fetchTmdbMock.mockResolvedValueOnce({
      kind: "fatal",
      error: "TMDB API error: 401",
      status: 401,
    });

    const res = await POST(req({ query: "x", type: "movie" }));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      error: "TMDB API error: 401",
      transient: false,
    });
  });

  it("marks transient errors 500 with transient: true", async () => {
    fetchTmdbMock.mockResolvedValueOnce({
      kind: "transient",
      error: "Request timed out — network may be unstable.",
    });

    const res = await POST(req({ query: "x", type: "movie" }));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: "Request timed out — network may be unstable.",
      transient: true,
    });
  });

  it("routes non-multi types to the typed search endpoint with the bearer key", async () => {
    fetchTmdbMock.mockResolvedValueOnce({ kind: "ok", data: { results: [] } });

    await POST(req({ query: "x", type: "tv" }));

    expect(fetchTmdbMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchTmdbMock.mock.calls[0];
    expect(url).toContain("/search/tv");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer tmdb-key",
    );
  });
});
