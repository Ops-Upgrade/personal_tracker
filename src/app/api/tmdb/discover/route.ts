import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/app/api/storage/_helpers/auth";
import { TMDB_HEADERS } from "../_helpers/headers";
import type { DiscoverFilters } from "@/types/media";
import {
  DISCOVER_GENRE_IDS,
  DISCOVER_ERA_DATES,
  DISCOVER_REGION_LANGUAGES,
} from "@/types/media";

const TMDB_BASE = "https://api.themoviedb.org/3";
const MAX_PAGE = 500;

interface TmdbRawItem {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  popularity?: number;
  vote_average?: number;
  vote_count?: number;
  media_type?: string;
}

interface TmdbPageResponse {
  results: TmdbRawItem[];
  total_pages: number;
}

// ── Build TMDB discover params from filter state ──

function buildDiscoverParams(
  filters: DiscoverFilters,
  mediaType: "movie" | "tv",
  page: number,
): URLSearchParams {
  const params = new URLSearchParams({
    language: "en-US",
    page: String(page),
  });

  // ── Sort ──
  switch (filters.sortBy) {
    case "rating":
      params.set("sort_by", "vote_average.desc");
      params.set("vote_count.gte", "300");
      break;
    case "newest":
      params.set(
        "sort_by",
        mediaType === "movie"
          ? "primary_release_date.desc"
          : "first_air_date.desc",
      );
      break;
    case "trending":
      // Handled in the caller — returned early via trending endpoint
      break;
    case "random":
      // Handled in the caller — page is already randomized
      params.set("sort_by", "popularity.desc");
      break;
    case "popularity":
    default:
      params.set("sort_by", "popularity.desc");
      break;
  }

  // ── Era ──
  const eraDates = DISCOVER_ERA_DATES[filters.era as keyof typeof DISCOVER_ERA_DATES];
  if (eraDates) {
    const dateField =
      mediaType === "movie" ? "primary_release_date" : "first_air_date";
    if (eraDates.gte) params.set(`${dateField}.gte`, eraDates.gte);
    if (eraDates.lte) params.set(`${dateField}.lte`, eraDates.lte);
  }

  // ── Genre (multi-select, OR via | separator) ──
  if (filters.genre.length > 0) {
    const ids = filters.genre.flatMap(
      (key) => DISCOVER_GENRE_IDS[key]?.[mediaType] ?? [],
    );
    if (ids.length > 0) {
      params.set("with_genres", ids.join("|"));
    }
  }

  // ── Region (multi-select, OR via | separator) ──
  if (filters.region.length > 0) {
    const langs = filters.region.map(
      (key) => DISCOVER_REGION_LANGUAGES[key],
    );
    params.set("with_original_language", langs.join("|"));
  }

  // ── Animation ──
  switch (filters.animation) {
    case "exclude":
      params.set("without_genres", "16");
      break;
    case "only":
      params.set("with_genres", "16");
      break;
    // "include" — no filter, default
  }

  return params;
}

// ── Fetch from TMDB, returning results + total_pages ──

async function fetchFromTmdb(
  endpoint: string,
  params: URLSearchParams,
  apiKey: string,
  mediaType: "movie" | "tv",
  signal?: AbortSignal,
): Promise<TmdbPageResponse> {
  const res = await fetch(`${endpoint}?${params}`, {
    headers: {
      ...TMDB_HEADERS,
      Authorization: `Bearer ${apiKey}`,
    },
    signal,
  });

  if (!res.ok) {
    console.error(
      `TMDB discover/${mediaType} error: ${res.status}`,
      await res.text().catch(() => ""),
    );
    return { results: [], total_pages: 0 };
  }

  const data = await res.json();
  const raw = (data.results ?? []) as TmdbRawItem[];
  return {
    results: raw.map((item) => ({ ...item, media_type: mediaType })),
    total_pages: Math.min(data.total_pages ?? 1, MAX_PAGE),
  };
}

// ── Map raw TMDB item to frontend shape ──

function mapItem(item: TmdbRawItem) {
  return {
    tmdb_id: item.id,
    type: item.media_type as "movie" | "tv",
    title: (item.title ?? item.name ?? "Unknown") as string,
    poster_path: item.poster_path as string | undefined,
    overview: item.overview as string | undefined,
    release_date: (item.release_date ??
      item.first_air_date ??
      undefined) as string | undefined,
  };
}

// ── POST handler ──

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
        { status: 500 },
      );
    }

    const { filters, page = 1 } = (await request.json()) as {
      filters: DiscoverFilters;
      page?: number;
    };

    // ── Safety: TMDB hard cap ──
    if (page > MAX_PAGE) {
      return NextResponse.json({ results: [], total_pages: MAX_PAGE });
    }

    // ── Trending override — ignore all other filters ──
    if (filters.sortBy === "trending") {
      const params = new URLSearchParams({
        language: "en-US",
        page: String(page),
      });

      const trendingRes = await fetch(
        `${TMDB_BASE}/trending/all/week?${params}`,
        {
          headers: {
            ...TMDB_HEADERS,
            Authorization: `Bearer ${apiKey}`,
          },
          signal: request.signal,
        },
      );

      if (!trendingRes.ok) {
        return NextResponse.json({ results: [], total_pages: 1 });
      }

      const trendingData = await trendingRes.json();
      const results = (
        (trendingData.results ?? []) as TmdbRawItem[]
      ).map(mapItem);

      return NextResponse.json({
        results,
        total_pages: Math.min(trendingData.total_pages ?? 1, MAX_PAGE),
      });
    }

    // ── Random sort: pick a random page ──
    const effectivePage =
      filters.sortBy === "random"
        ? Math.floor(Math.random() * 100) + 1
        : page;

    const fetchMovie = filters.type !== "tv";
    const fetchTv = filters.type !== "movie";

    const movieParams = fetchMovie
      ? buildDiscoverParams(filters, "movie", effectivePage)
      : null;
    const tvParams = fetchTv
      ? buildDiscoverParams(filters, "tv", effectivePage)
      : null;

    // ── Fetch in parallel ──
    const [movieData, tvData] = await Promise.all([
      fetchMovie
        ? fetchFromTmdb(
            `${TMDB_BASE}/discover/movie`,
            movieParams!,
            apiKey,
            "movie",
            request.signal,
          )
        : Promise.resolve({ results: [], total_pages: 0 } as TmdbPageResponse),
      fetchTv
        ? fetchFromTmdb(
            `${TMDB_BASE}/discover/tv`,
            tvParams!,
            apiKey,
            "tv",
            request.signal,
          )
        : Promise.resolve({ results: [], total_pages: 0 } as TmdbPageResponse),
    ]);

    // ── Deduplicate by ID + type, then merge ──
    const seen = new Set<string>();
    const merged: TmdbRawItem[] = [];

    for (const item of [...movieData.results, ...tvData.results]) {
      const key = `${item.media_type}-${item.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(item);
      }
    }

    // ── Re-sort merged results ──
    if (filters.sortBy === "rating") {
      merged.sort((a, b) => {
        const aVotes = a.vote_count ?? 0;
        const bVotes = b.vote_count ?? 0;
        const aAvg = a.vote_average ?? 0;
        const bAvg = b.vote_average ?? 0;
        const aScore = aVotes >= 300 ? aAvg : aAvg * (aVotes / 300);
        const bScore = bVotes >= 300 ? bAvg : bAvg * (bVotes / 300);
        return bScore - aScore;
      });
    } else if (filters.sortBy === "newest") {
      merged.sort((a, b) => {
        const aDate =
          a.release_date ?? a.first_air_date ?? "";
        const bDate =
          b.release_date ?? b.first_air_date ?? "";
        return bDate.localeCompare(aDate);
      });
    } else {
      merged.sort(
        (a, b) => (b.popularity ?? 0) - (a.popularity ?? 0),
      );
    }

    const totalPages = Math.max(
      movieData.total_pages,
      tvData.total_pages,
    );

    return NextResponse.json({
      results: merged.map(mapItem),
      total_pages: totalPages,
    });
  } catch (err) {
    console.error("TMDB discover proxy error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
