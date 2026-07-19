import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/app/api/storage/_helpers/auth";
import { TMDB_HEADERS } from "../_helpers/headers";
import { fetchTmdb } from "@/lib/tmdb/fetchTmdb";

const TMDB_BASE = "https://api.themoviedb.org/3";

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "TMDB API key not configured" },
        { status: 500 }
      );
    }

    const { query, type, page = 1 } = (await request.json()) as {
      query: string;
      type: "movie" | "tv" | "multi";
      page?: number;
    };

    if (!query || query.trim().length === 0) {
      return NextResponse.json([], { status: 200 });
    }

    // Map 'multi' to TMDB's /search/multi, others to /search/{type}
    const endpoint =
      type === "multi"
        ? `${TMDB_BASE}/search/multi`
        : `${TMDB_BASE}/search/${type}`;

    const params = new URLSearchParams({
      query: query.trim(),
      language: "en-US",
      page: String(page),
    });

    const searchResult = await fetchTmdb<{ results?: Array<Record<string, unknown>> }>(
      `${endpoint}?${params}`,
      {
        headers: {
          ...TMDB_HEADERS,
          Authorization: `Bearer ${apiKey}`,
        },
        signal: request.signal,
      },
    );

    if (searchResult.kind !== "ok") {
      console.error("TMDB search error:", searchResult.error);
      return NextResponse.json(
        {
          error: searchResult.error,
          transient: searchResult.kind === "transient",
        },
        { status: searchResult.kind === "transient" ? 500 : (searchResult.status ?? 500) },
      );
    }

    const data = searchResult.data;
    const rawResults = (data.results ?? []) as Array<Record<string, unknown>>;

    // 1. Find the top person match in the search results (page 1 only)
    const topPerson = page === 1 ? rawResults.find((r) => r.media_type === "person") : undefined;
    let actorCredits: Array<Record<string, unknown>> = [];

    // 2. If a person was found on page 1, fetch their full filmography
    if (topPerson) {
      const creditsResult = await fetchTmdb<{
        cast?: Array<Record<string, unknown>>;
        crew?: Array<Record<string, unknown>>;
      }>(
        `${TMDB_BASE}/person/${topPerson.id}/combined_credits?language=en-US`,
        {
          headers: {
            ...TMDB_HEADERS,
            Authorization: `Bearer ${apiKey}`,
          },
        },
      );

      if (creditsResult.kind === "ok") {
        const creditsData = creditsResult.data;

        // 1. Get all acting credits
        const castCredits = (creditsData.cast ?? []) as Array<Record<string, unknown>>;

        // 2. Get directing credits (crew filtered to "Director" only)
        const crewCredits = (creditsData.crew ?? []) as Array<Record<string, unknown>>;
        const directorCredits = crewCredits.filter((c) => c.job === "Director");

        // 3. Merge and sort by popularity
        actorCredits = [...castCredits, ...directorCredits]
          .filter(
            (c) => c.media_type === "movie" || c.media_type === "tv"
          )
          .sort(
            (a, b) =>
              ((b.popularity as number) || 0) - ((a.popularity as number) || 0)
          );
      }
    }

    // 3. Combine both arrays
    const allResults = [...rawResults, ...actorCredits];

    // 4. Deduplicate by both id AND media_type (movie id 123 ≠ tv id 123)
    const mergedResults: Array<Record<string, unknown>> = [];

    for (const item of allResults) {
      if (item.media_type === "movie" || item.media_type === "tv") {
        const isDuplicate = mergedResults.some(
          (r) => r.id === item.id && r.media_type === item.media_type
        );
        if (!isDuplicate) {
          mergedResults.push(item);
        }
      }
    }

    // 5. Map everything safely for the frontend
    const results = mergedResults.map((item) => ({
      tmdb_id: item.id as number,
      type: (item.media_type as "movie" | "tv") ?? type,
      title:
        ((item.title ?? item.name ?? "Unknown") as string) || "Unknown",
      poster_path: item.poster_path as string | undefined,
      overview: item.overview as string | undefined,
      release_date:
        (item.release_date ?? item.first_air_date ?? undefined) as
          | string
          | undefined,
    }));

    return NextResponse.json(results);
  } catch (err) {
    console.error("TMDB search proxy error:", err);
    return NextResponse.json(
      { error: "Internal server error", transient: false },
      { status: 500 },
    );
  }
}
