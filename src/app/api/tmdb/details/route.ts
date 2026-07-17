import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/app/api/storage/_helpers/auth";
import { TMDB_HEADERS } from "../_helpers/headers";

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

    const tmdbRes = await fetch(`${endpoint}?${params}`, {
      headers: {
        ...TMDB_HEADERS,
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!tmdbRes.ok) {
      const errText = await tmdbRes.text();
      console.error("TMDB details error:", tmdbRes.status, errText);
      return NextResponse.json(
        { error: `TMDB API error: ${tmdbRes.status}` },
        { status: tmdbRes.status }
      );
    }

    const data = await tmdbRes.json();

    // Extract US content rating (movies use release_dates, TV uses content_ratings)
    let contentRating = "";
    if (type === "movie") {
      const usRelease = (data.release_dates?.results as any[])?.find(
        (r: any) => r.iso_3166_1 === "US" || r.iso_3166_1 === "IN",
      );
      contentRating = usRelease?.release_dates?.[0]?.certification || "";
    } else {
      const usRating = (data.content_ratings?.results as any[])?.find(
        (r: any) => r.iso_3166_1 === "US" || r.iso_3166_1 === "IN",
      );
      contentRating = usRating?.rating || "";
    }

    const details = {
      title: data.title as string | undefined,
      name: data.name as string | undefined,
      poster_path: data.poster_path as string | undefined,
      release_date: (type === "movie"
        ? data.release_date
        : data.first_air_date) as string | undefined,
      number_of_episodes: type === "tv"
        ? (data.number_of_episodes as number | undefined)
        : undefined,
      number_of_seasons: type === "tv"
        ? (data.number_of_seasons as number | undefined)
        : undefined,
      overview: (data.overview as string) ?? "",
      genres: (data.genres as Array<{ id: number; name: string }>) ?? [],
      runtime: type === "movie" ? (data.runtime as number | undefined) : undefined,
      episode_run_time: type === "tv"
        ? (data.episode_run_time as number[] | undefined)
        : undefined,
      content_rating: contentRating,
      watch_providers: (data["watch/providers"]?.results?.IN as any) ?? undefined,
    };

    return NextResponse.json(details);
  } catch (err) {
    console.error("TMDB details proxy error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
