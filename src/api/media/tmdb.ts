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
  retries = 1,
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
      // Silently retry on server errors or connection drops
      if (res.status >= 500 && retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        return tmdbPost<T>(path, body, retries - 1, signal);
      }
      let detail = "";
      try {
        const err = await res.json();
        detail = err.error ?? "";
      } catch {
        /* ignore parse failures */
      }
      throw new Error(detail || `TMDB proxy error (${res.status})`);
    }

    return res.json() as Promise<T>;
  } catch (err) {
    // Don't retry aborted requests — the caller deliberately cancelled
    if (err instanceof DOMException && err.name === "AbortError") throw err;

    // Hard network crash (ECONNRESET, etc.) — retry once silently
    if (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return tmdbPost<T>(path, body, retries - 1, signal);
    }

    // Both attempts failed — show a friendly message
    throw new Error(
      "Unable to connect to the movie database right now. Please try again in a moment."
    );
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
  // Never retry search — heavy queries (combined_credits) time out under concurrency;
  // cancellation + caching on the backend prevent the 504s organically.
  return tmdbPost<TmdbSearchResult[]>("/search", { query, type, page }, 0, signal);
}

/**
 * Fetch discover media using the advanced filter engine.
 */
export async function getDiscoverMedia(
  filters: DiscoverFilters,
  page?: number,
  signal?: AbortSignal,
): Promise<DiscoverResponse> {
  return tmdbPost<DiscoverResponse>("/discover", { filters, page }, 1, signal);
}

/**
 * Fetch detailed metadata for a specific movie or TV show.
 */
export async function getMediaDetails(
  tmdbId: number,
  type: "movie" | "tv",
  signal?: AbortSignal,
): Promise<TmdbDetails> {
  return tmdbPost<TmdbDetails>("/details", { tmdb_id: tmdbId, type }, 1, signal);
}

/**
 * Fetch season details (episode list) for a TV show season.
 */
export async function getSeasonDetails(
  tmdbId: number,
  seasonNumber: number,
  signal?: AbortSignal,
): Promise<TmdbSeasonDetails> {
  return tmdbPost<TmdbSeasonDetails>("/season", {
    tmdb_id: tmdbId,
    season_number: seasonNumber,
  }, 1, signal);
}
