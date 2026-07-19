import type {
  TmdbSearchResult,
  TmdbDetails,
  TmdbSeasonDetails,
  SearchType,
  DiscoverFilters,
  DiscoverResponse,
} from "@/types/media";

const API_BASE = "/api/tmdb";

async function tmdbPost<T>(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      let detail = "";
      let transient = false;
      try {
        const err = await res.json();
        detail = err.error ?? "";
        transient = !!err.transient;
      } catch {
        /* ignore parse failures */
      }
      const error = new Error(detail || `TMDB proxy error (${res.status})`) as Error & {
        transient: boolean;
      };
      error.transient = transient;
      throw error;
    }

    return res.json() as Promise<T>;
  } catch (err) {
    // Don't wrap aborted requests — the caller deliberately cancelled
    if (err instanceof DOMException && err.name === "AbortError") throw err;

    // If the error already has a transient flag (from the !res.ok branch above),
    // re-throw it as-is so the retry hook can act on it.
    if (
      err instanceof Error &&
      "transient" in (err as Error & { transient?: boolean })
    ) {
      throw err;
    }

    // Hard network crash (ECONNRESET, etc.) before the server could respond —
    // these are inherently transient.
    const networkError = new Error(
      "Unable to connect to the movie database right now. Please try again in a moment.",
    ) as Error & { transient: boolean };
    networkError.transient = true;
    throw networkError;
  }
}

/**
 * Search TMDB for movies, TV shows, or both.
 */
export async function searchMedia(
  query: string,
  type: SearchType,
  page?: number,
  signal?: AbortSignal,
): Promise<TmdbSearchResult[]> {
  return tmdbPost<TmdbSearchResult[]>("/search", { query, type, page }, signal);
}

/**
 * Fetch discover media using the advanced filter engine.
 */
export async function getDiscoverMedia(
  filters: DiscoverFilters,
  page?: number,
  signal?: AbortSignal,
): Promise<DiscoverResponse> {
  return tmdbPost<DiscoverResponse>("/discover", { filters, page }, signal);
}

/**
 * Fetch detailed metadata for a specific movie or TV show.
 */
export async function getMediaDetails(
  tmdbId: number,
  type: "movie" | "tv",
  signal?: AbortSignal,
): Promise<TmdbDetails> {
  return tmdbPost<TmdbDetails>("/details", { tmdb_id: tmdbId, type }, signal);
}

/**
 * Fetch season details (episode list) for a TV show season.
 */
export async function getSeasonDetails(
  tmdbId: number,
  seasonNumber: number,
  signal?: AbortSignal,
): Promise<TmdbSeasonDetails> {
  return tmdbPost<TmdbSeasonDetails>(
    "/season",
    { tmdb_id: tmdbId, season_number: seasonNumber },
    signal,
  );
}
