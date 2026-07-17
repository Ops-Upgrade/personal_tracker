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

    const { tmdb_id, season_number } = (await request.json()) as {
      tmdb_id: number;
      season_number: number;
    };

    if (!tmdb_id || season_number === undefined) {
      return NextResponse.json(
        { error: "tmdb_id and season_number are required" },
        { status: 400 }
      );
    }

    const endpoint = `${TMDB_BASE}/tv/${tmdb_id}/season/${season_number}`;
    const params = new URLSearchParams({ language: "en-US" });

    const tmdbRes = await fetch(`${endpoint}?${params}`, {
      headers: {
        ...TMDB_HEADERS,
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!tmdbRes.ok) {
      const errText = await tmdbRes.text();
      console.error("TMDB season error:", tmdbRes.status, errText);
      return NextResponse.json(
        { error: `TMDB API error: ${tmdbRes.status}` },
        { status: tmdbRes.status }
      );
    }

    const data = await tmdbRes.json();

    const seasonDetails = {
      season_number: data.season_number as number,
      name: (data.name as string) ?? `Season ${season_number}`,
      overview: (data.overview as string) ?? "",
      poster_path: data.poster_path as string | undefined,
      air_date: data.air_date as string | undefined,
      episodes: ((data.episodes ?? []) as Array<Record<string, unknown>>).map(
        (ep) => ({
          episode_number: ep.episode_number as number,
          name: (ep.name as string) ?? `Episode ${ep.episode_number}`,
          overview: (ep.overview as string) ?? "",
          still_path: ep.still_path as string | undefined,
          air_date: ep.air_date as string | undefined,
          runtime: ep.runtime as number | undefined,
          vote_average: ep.vote_average as number | undefined,
        })
      ),
    };

    return NextResponse.json(seasonDetails);
  } catch (err) {
    console.error("TMDB season proxy error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
