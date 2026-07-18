export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

export const tmdbPosterUrl = (
  path: string,
  size: "w92" | "w300" | "w342" | "w500" | "w780" | "original" = "w342",
): string => {
  if (!path) return "";
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
};

/** Episode stills use the same TMDB image base but different recommended sizes. */
export const tmdbStillUrl = (
  path: string,
  size: "w300" | "w780" | "original" = "w300",
): string => {
  if (!path) return "";
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
};

export type MediaStatus = "unwatched" | "watching" | "watched";

/** Human-readable labels for each status. */
export const statusLabels: Record<MediaStatus, string> = {
  unwatched: "Not Watched",
  watching: "Watching",
  watched: "Watched",
};

/** Compact badge variant — colored background with white text (used on cards/posters). */
export const statusColors: Record<MediaStatus, string> = {
  unwatched: "bg-red-500/90 text-white",
  watching: "bg-yellow-500/90 text-white",
  watched: "bg-green-600/90 text-white",
};

/** Chip / border variant — light background with colored text + border (used on form chips). */
export const statusColorClasses: Record<MediaStatus, string> = {
  unwatched:
    "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700",
  watching:
    "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-700",
  watched:
    "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700",
};

/**
 * Returns the chip CSS classes for a given status.
 * @param active  When true, applies the active (filled) variant; otherwise the inactive outline variant.
 * @param status  The status key.
 */
export function chipClasses(active: boolean, status: MediaStatus): string {
  return [
    "px-3 py-1 text-xs font-medium rounded-full border transition-colors",
    active
      ? statusColorClasses[status]
      : "border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 cursor-pointer",
  ].join(" ");
}
