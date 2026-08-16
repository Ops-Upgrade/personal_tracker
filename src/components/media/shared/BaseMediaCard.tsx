"use client";

import { forwardRef, type ReactNode, type CSSProperties } from "react";
import Image from "next/image";
import { Film, Tv, Star, MessageSquare } from "lucide-react";
import { tmdbPosterUrl } from "@/components/media/constants";

// ---------- types ----------

export interface BaseMediaCardProps {
  // ── Visual data ──
  posterPath: string | null;
  title: string;
  type: "movie" | "tv";
  year?: number;
  rating?: number;
  hasReviewNotes: boolean;
  overview?: string;
  collectionName?: string;
  showTrackingChip?: boolean;
  isTracked?: boolean;
  /**
   * Show the "New Season" chip (TV shows where TMDB lists a season added
   * since the last "watched" save). Computed by the grid-level
   * `useNewSeasonChecks` hook — this tile stays passive.
   */
  hasNewSeason?: boolean;
  /** Priority loading for the poster Image. */
  priority?: boolean;

  // ── Overlay slots (rendered inside the poster area) ──
  topLeftSlot?: ReactNode;
  topRightSlot?: ReactNode;
  bottomRightSlot?: ReactNode;

  // ── Standard HTML / interaction props ──
  className?: string;
  style?: CSSProperties;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

// ---------- component ----------

/**
 * Pure visual tile for a media item — poster, badges, info footer.
 *
 * Contains no routing logic, no drag-and-drop, and no data fetching.
 * Used by both the static {@link MediaCard} (discover view) and the
 * sortable {@link SortableTileItem} (collection view).
 *
 * Wrapped in `forwardRef` so dnd-kit can attach `setNodeRef`.
 */
const BaseMediaCard = forwardRef<HTMLDivElement, BaseMediaCardProps>(
  (
    {
      posterPath,
      title,
      type,
      year,
      rating,
      hasReviewNotes,
      overview,
      collectionName,
      showTrackingChip,
      isTracked,
      hasNewSeason = false,
      priority = false,
      topLeftSlot,
      topRightSlot,
      bottomRightSlot,
      className = "",
      style,
      onClick,
      ...rest
    },
    ref,
  ) => {
    const posterUrl = posterPath ? tmdbPosterUrl(posterPath, "w342") : null;

    const yearLine = [year, collectionName].filter(Boolean).join(" • ") || "—";

    return (
      <div
        ref={ref}
        style={style}
        onClick={onClick}
        className={`group rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden cursor-pointer ${className}`.trim()}
        {...rest}
      >
        {/* ── Poster ── */}
        <div className="relative aspect-[2/3] bg-zinc-100 dark:bg-zinc-800">
          {posterUrl ? (
            <Image
              src={posterUrl}
              alt={title}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
              className="object-cover"
              priority={priority}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-zinc-400 dark:text-zinc-600">
              {type === "movie" ? <Film size={40} /> : <Tv size={40} />}
            </div>
          )}

          {topLeftSlot}
          {topRightSlot}
          {bottomRightSlot}
        </div>

        {/* ── Info ── */}
        <div className="p-3">
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
            {title}
          </h4>

          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 m-0">
              {yearLine}
            </p>
            {showTrackingChip && isTracked && (
              <span className="rounded bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider">
                Tracking
              </span>
            )}
            {hasNewSeason && (
              <span className="rounded bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider">
                New Season
              </span>
            )}
          </div>

          {/* Rating & review badges */}
          {(rating || hasReviewNotes) && (
            <div className="flex items-center gap-2 mt-2">
              {rating && (
                <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-500 text-[10px] font-bold px-1.5 py-0.5 rounded">
                  <Star size={10} className="fill-current" /> {rating}
                </span>
              )}
              {hasReviewNotes && (
                <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 text-[10px] font-bold px-1.5 py-0.5 rounded">
                  <MessageSquare size={10} />
                </span>
              )}
            </div>
          )}

          {/* Overview snippet (discover view) */}
          {overview && (
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500 line-clamp-2">
              {overview}
            </p>
          )}
        </div>
      </div>
    );
  },
);

BaseMediaCard.displayName = "BaseMediaCard";

export default BaseMediaCard;
