"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/routes/paths";
import { Film, Tv, Star, MessageSquare } from "lucide-react";
import type { Media, MediaCollection, TmdbSearchResult } from "@/types/media";
import { tmdbPosterUrl } from "@/components/media/constants";
import StatusBadge from "@/components/media/shared/StatusBadge";

// ── Types ──

interface MediaCardProps {
  /** The media item (tracked or search result). */
  media: TmdbSearchResult | Media;

  // ── Legacy props (backward-compatible) ──
  collections?: MediaCollection[];
  /** @deprecated Reserved for future status chip interaction. */
  onStatusChange?: (id: string, status: Media["status"]) => void;
  /** @deprecated Reserved for future inline rating. */
  onRatingChange?: (id: string, rating: number) => void;

  // ── Visibility toggles (all default to true when relevant data exists) ──
  /** Show the type badge (Movie / TV) in the top-right corner. Default true. */
  showType?: boolean;
  /** Show the status badge in the top-left corner. Default true. */
  showStatus?: boolean;
  /** Show rating & review badges in the info footer. Default true. */
  showBadges?: boolean;

  // ── Discover-view extras ──
  /** External tracking record for discover cards (looked up by tmdb_id). */
  trackingData?: Media;
  /** Show a "Tracking" chip when trackingData is present. */
  showTrackingChip?: boolean;
  /** Show the TMDB overview snippet (only available on search results). */
  showOverview?: boolean;

  // ── Generic ──
  priority?: boolean;
  /** Override the default click handler (which navigates to the detail page). */
  onClick?: () => void;
  className?: string;
}

// ── Helpers ──

function hasStatus(
  media: TmdbSearchResult | Media,
  trackingData?: Media,
): Media["status"] | undefined {
  if (trackingData) return trackingData.status;
  if ("status" in media) return (media as Media).status;
  return undefined;
}

function hasRating(
  media: TmdbSearchResult | Media,
  trackingData?: Media,
): number | undefined {
  if (trackingData) return trackingData.rating;
  if ("rating" in media) return (media as Media).rating;
  return undefined;
}

function hasReviewNotes(
  media: TmdbSearchResult | Media,
  trackingData?: Media,
): string | undefined {
  if (trackingData) return trackingData.review_notes;
  if ("review_notes" in media) return (media as Media).review_notes;
  return undefined;
}

function hasOverview(media: TmdbSearchResult | Media): string | undefined {
  if ("overview" in media) return (media as TmdbSearchResult).overview;
  return undefined;
}

// ── Component ──

export default function MediaCard({
  media,
  collections,
  showType = true,
  showStatus = true,
  showBadges = true,
  trackingData,
  showTrackingChip,
  showOverview,
  priority = false,
  onClick,
  className = "",
}: MediaCardProps) {
  const router = useRouter();

  const posterUrl = media.poster_path
    ? tmdbPosterUrl(media.poster_path, "w342")
    : null;

  const year = media.release_date
    ? new Date(media.release_date).getFullYear()
    : undefined;

  const status = hasStatus(media, trackingData);
  const rating = hasRating(media, trackingData);
  const reviewNotes = hasReviewNotes(media, trackingData);
  const overview = showOverview ? hasOverview(media) : undefined;

  const isTracked = !!(trackingData || hasStatus(media));

  const collectionName =
    collections && "collection_id" in media && media.collection_id
      ? collections.find((c) => c.id === media.collection_id)?.name
      : undefined;

  const defaultOnClick = () => {
    const tmdbId = "tmdb_id" in media ? media.tmdb_id : undefined;
    if (tmdbId) {
      router.push(ROUTES.MEDIA_DETAIL(tmdbId, media.type));
    }
  };

  const handleClick = onClick ?? defaultOnClick;

  return (
    <div
      onClick={handleClick}
      className={`group rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden cursor-pointer ${className}`}
    >
      {/* ── Poster ── */}
      <div className="relative aspect-[2/3] bg-zinc-100 dark:bg-zinc-800">
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={"title" in media ? String(media.title) : ""}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-cover"
            priority={priority}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-400 dark:text-zinc-600">
            {media.type === "movie" ? (
              <Film size={40} />
            ) : (
              <Tv size={40} />
            )}
          </div>
        )}

        {/* Type badge (top-right) */}
        {showType && (
          <span className="absolute top-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white uppercase">
            {media.type === "movie" ? "Movie" : "TV"}
          </span>
        )}

        {/* Status badge (top-left) */}
        {showStatus && status && (
          <StatusBadge status={status} className="absolute top-2 left-2" />
        )}
      </div>

      {/* ── Info ── */}
      <div className="p-3">
        <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
          {media.title}
        </h4>

        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 m-0">
            {[year, collectionName].filter(Boolean).join(" • ") || "—"}
          </p>
          {showTrackingChip && isTracked && (
            <span className="rounded bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider">
              Tracking
            </span>
          )}
        </div>

        {/* Rating & review badges */}
        {showBadges && (rating || reviewNotes) && (
          <div className="flex items-center gap-2 mt-2">
            {rating && (
              <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-500 text-[10px] font-bold px-1.5 py-0.5 rounded">
                <Star size={10} className="fill-current" /> {rating}
              </span>
            )}
            {reviewNotes && (
              <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 text-[10px] font-bold px-1.5 py-0.5 rounded">
                <MessageSquare size={10} /> 1
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
}
