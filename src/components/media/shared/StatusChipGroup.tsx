"use client";

import type { MediaPlaintext } from "@/types/media";
import { chipClasses } from "@/components/media/constants";

interface StatusChipGroupProps {
  status: MediaPlaintext["status"];
  onStatusChange: (newStatus: MediaPlaintext["status"]) => void;
  /** When true, greys out all chips — used when the record doesn't exist yet in the DB. */
  isUntracked?: boolean;
  /** When true, shows a "Watched on" date input next to the chips (movie-only) */
  showWatchedOn?: boolean;
  watchedOn?: string;
  onWatchedOnChange?: (date: string) => void;
}

/**
 * Status toggle chip group: "Not Watched / Watching / Watched".
 *
 * Optionally shows a watched date input when the status is "watched"
 * and `showWatchedOn` is true (used on the Movie page).
 *
 * Extracted from MoviePage and TvSeriesPage.
 */
export default function StatusChipGroup({
  status,
  onStatusChange,
  isUntracked = false,
  showWatchedOn = false,
  watchedOn = "",
  onWatchedOnChange,
}: StatusChipGroupProps) {
  const active = (s: MediaPlaintext["status"]) => !isUntracked && status === s;

  return (
    <div>
      <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">
        STATUS
      </h3>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onStatusChange("unwatched")}
          className={chipClasses(active("unwatched"), "unwatched")}
        >
          Not Watched
        </button>
        <button
          type="button"
          onClick={() => onStatusChange("watching")}
          className={chipClasses(active("watching"), "watching")}
        >
          Watching
        </button>
        <button
          type="button"
          onClick={() => onStatusChange("watched")}
          className={chipClasses(active("watched"), "watched")}
        >
          Watched
        </button>
        {showWatchedOn && status === "watched" && (
          <>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 ml-1">
              Watched on
            </label>
            <input
              type="date"
              value={watchedOn}
              onChange={(e) => onWatchedOnChange?.(e.target.value)}
              className="rounded-lg border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </>
        )}
      </div>
    </div>
  );
}
