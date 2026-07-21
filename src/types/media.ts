// ── TMDB types (returned by proxy routes, never stored in DB) ──

export interface TmdbSearchResult {
  tmdb_id: number;
  type: "movie" | "tv";
  title: string;
  poster_path?: string;
  overview?: string;
  release_date?: string;
}

export interface TmdbDetails {
  title?: string;
  name?: string;
  poster_path?: string;
  release_date?: string;
  number_of_episodes?: number;
  number_of_seasons?: number;
  overview: string;
  genres: { id: number; name: string }[];
  runtime?: number;
  episode_run_time?: number[]; // TV only: typical episode runtimes in minutes
  content_rating?: string;
  watch_providers?: {
    flatrate?: { provider_id: number; provider_name: string; logo_path: string }[];
  };
}

export interface TmdbSeasonDetails {
  season_number: number;
  name: string;
  overview: string;
  poster_path?: string;
  air_date?: string;
  episodes: TmdbEpisode[];
}

export interface TmdbEpisode {
  episode_number: number;
  name: string;
  overview: string;
  still_path?: string;
  air_date?: string;
  runtime?: number;
  vote_average?: number;
}

// ── Episode tracking (nested inside the media blob) ──

export interface EpisodeTracking {
  status: "watching" | "unwatched" | "watched";
  rating?: number;
  review_notes?: string;
  watched_on?: string;
}

// ── Plaintext shapes (what lives inside the encrypted blob) ──

export interface MediaPlaintext {
  tmdb_id?: number;
  type: "movie" | "tv";
  title: string;
  poster_path?: string;
  release_date?: string;
  genre_ids?: number[];
  collection_id?: string; // legacy single-collection FK
  collection_ids?: string[]; // multi-collection UUIDs (preferred)
  status: "watching" | "unwatched" | "watched";
  rating?: number; // 0.5–5
  review_notes?: string;
  watched_on?: string;
  runtime?: number; // Total runtime in minutes (for progress bar calculation)
  episodes?: Record<string, EpisodeTracking>; // "S01E01" → episode data
}

export interface MediaCollectionPlaintext {
  name: string;
  description?: string;
  color?: string; // hex code for visual tags
  ordered_media_ids?: string[]; // For manual drag-and-drop ordering
}

// ── Hydrated types (decrypted plaintext + row metadata) ──

export interface Media extends MediaPlaintext {
  id: string;
  created_at: string;
}

export interface MediaCollection extends MediaCollectionPlaintext {
  id: string;
  created_at: string;
}

// ── Search / discover helpers ──

export type SearchType = "movie" | "tv" | "multi";

// ── Discover filter types ──

export type DiscoverSort = "popularity" | "rating" | "newest" | "random" | "trending";
export type DiscoverEra = "all" | "2020s" | "2010s" | "2000s" | "1990s" | "classics";
export type DiscoverAnimation = "include" | "exclude" | "only";

/** Genre keys for the multi-select genre filter. */
export type DiscoverGenreKey =
  | "action"
  | "comedy"
  | "crime"
  | "documentary"
  | "drama"
  | "fantasy"
  | "horror"
  | "music"
  | "mystery"
  | "romance"
  | "scifi"
  | "thriller"
  | "war";

/** Region keys for the multi-select region filter. */
export type DiscoverRegionKey = "hollywood" | "bollywood" | "korean" | "japanese";

export interface DiscoverFilters {
  type: MediaTypeFilter;
  sortBy: DiscoverSort;
  era: DiscoverEra;
  genre: DiscoverGenreKey[];
  region: DiscoverRegionKey[];
  animation: DiscoverAnimation;
  hideTracked: boolean;
}

export const DEFAULT_DISCOVER_FILTERS: DiscoverFilters = {
  type: "all",
  sortBy: "popularity",
  era: "all",
  genre: [],
  region: [],
  animation: "include",
  hideTracked: false,
};

/** Response wrapper — backend returns total_pages so the frontend can hard-stop infinite scroll. */
export interface DiscoverResponse {
  results: TmdbSearchResult[];
  total_pages: number;
}

// ── Genre ID mappings (TMDB uses different IDs for movie vs TV) ──

export const DISCOVER_GENRE_IDS: Record<
  DiscoverGenreKey,
  { movie: number[]; tv: number[] }
> = {
  action: { movie: [28], tv: [10759] },
  comedy: { movie: [35], tv: [35] },
  crime: { movie: [80], tv: [80] },
  documentary: { movie: [99], tv: [99] },
  drama: { movie: [18], tv: [18] },
  fantasy: { movie: [14], tv: [10765] },
  horror: { movie: [27], tv: [] },
  music: { movie: [10402], tv: [] },
  mystery: { movie: [9648], tv: [9648] },
  romance: { movie: [10749], tv: [18] },
  scifi: { movie: [878], tv: [10765] },
  thriller: { movie: [53], tv: [9648, 80] },
  war: { movie: [10752], tv: [10768] },
};

// ── Era date range mappings ──

export const DISCOVER_ERA_DATES: Record<
  Exclude<DiscoverEra, "all">,
  { gte?: string; lte?: string }
> = {
  "2020s": { gte: "2020-01-01" },
  "2010s": { gte: "2010-01-01", lte: "2019-12-31" },
  "2000s": { gte: "2000-01-01", lte: "2009-12-31" },
  "1990s": { gte: "1990-01-01", lte: "1999-12-31" },
  classics: { lte: "1989-12-31" },
};

// ── Region → language code mappings ──

export const DISCOVER_REGION_LANGUAGES: Record<DiscoverRegionKey, string> = {
  hollywood: "en",
  bollywood: "hi",
  korean: "ko",
  japanese: "ja",
};

// ── Sort / filter helpers ──

export type MediaSort = "date_added" | "title_asc" | "rating_desc" | "release_date_desc";

export type MediaTypeFilter = "all" | "movie" | "tv";

/**
 * Shared genre dropdown options used by both Discover and My Media filters.
 * Kept in the types module so the UI stays in sync across views.
 */
export const GENRE_OPTIONS: { value: DiscoverGenreKey; label: string }[] = [
  { value: "action", label: "Action" },
  { value: "comedy", label: "Comedy" },
  { value: "crime", label: "Crime" },
  { value: "documentary", label: "Documentary" },
  { value: "drama", label: "Drama" },
  { value: "fantasy", label: "Fantasy" },
  { value: "horror", label: "Horror" },
  { value: "music", label: "Music" },
  { value: "mystery", label: "Mystery" },
  { value: "romance", label: "Romance" },
  { value: "scifi", label: "Sci-Fi" },
  { value: "thriller", label: "Thriller" },
  { value: "war", label: "War" },
];
