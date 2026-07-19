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

    const { tmdb_id, type } = (await request.json()) as {
      tmdb_id: number;
      type: "movie" | "tv";
    };

    if (!tmdb_id || !type) {
      return NextResponse.json(
        { error: "tmdb_id and type are required" },
        { status: 400 }
      );
    }

    const endpoint = `${TMDB_BASE}/${type}/${tmdb_id}`;
    const params = new URLSearchParams({
      language: "en-US",
      append_to_response: "watch/providers,release_dates,content_ratings",
    });

    const tmdbResult = await fetchTmdb<Record<string, unknown>>(`${endpoint}?${params}`, {
      headers: {
        ...TMDB_HEADERS,
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (tmdbResult.kind !== "ok") {
      console.error("TMDB details error:", tmdbResult.error);
      return NextResponse.json(
        {
          error: tmdbResult.error,
          transient: tmdbResult.kind === "transient",
        },
        { status: tmdbResult.kind === "transient" ? 500 : (tmdbResult.status ?? 500) },
      );
    }

    const data = tmdbResult.data;
    // Cast for nested property access — TMDB response shape is validated by runtime
    // inline type assertions below.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = data as Record<string, any>;

    // TMDB API response shapes
    interface TmdbReleaseDateResult {
      iso_3166_1: string;
      release_dates?: Array<{ certification: string }>;
    }
    interface TmdbContentRatingResult {
      iso_3166_1: string;
      rating?: string;
    }
    interface TmdbWatchProviderResult {
      link?: string;
      flatrate?: Array<{ provider_name: string; logo_path: string }>;
    }

    // Extract US content rating (movies use release_dates, TV uses content_ratings)
    let contentRating = "";
    if (type === "movie") {
      const usRelease = (d.release_dates?.results as TmdbReleaseDateResult[] | undefined)?.find(
        (r) => r.iso_3166_1 === "US" || r.iso_3166_1 === "IN",
      );
      contentRating = usRelease?.release_dates?.[0]?.certification || "";
    } else {
      const usRating = (d.content_ratings?.results as TmdbContentRatingResult[] | undefined)?.find(
        (r) => r.iso_3166_1 === "US" || r.iso_3166_1 === "IN",
      );
      contentRating = usRating?.rating || "";
    }

    const details = {
      title: d.title as string | undefined,
      name: d.name as string | undefined,
      poster_path: d.poster_path as string | undefined,
      release_date: (type === "movie"
        ? d.release_date
        : d.first_air_date) as string | undefined,
      number_of_episodes: type === "tv"
        ? (d.number_of_episodes as number | undefined)
        : undefined,
      number_of_seasons: type === "tv"
        ? (d.number_of_seasons as number | undefined)
        : undefined,
      overview: (d.overview as string) ?? "",
      genres: (d.genres as Array<{ id: number; name: string }>) ?? [],
      runtime: type === "movie" ? (d.runtime as number | undefined) : undefined,
      episode_run_time: type === "tv"
        ? (d.episode_run_time as number[] | undefined)
        : undefined,
      content_rating: contentRating,
      watch_providers: (d["watch/providers"]?.results?.IN as TmdbWatchProviderResult | undefined) ?? undefined,
    };

    return NextResponse.json(details);
  } catch (err) {
    console.error("TMDB details proxy error:", err);
    return NextResponse.json(
      { error: "Internal server error", transient: false },
      { status: 500 },
    );
  }
}
