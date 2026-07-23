"use client";

import { useRouter } from "next/navigation";
import { ROUTES } from "@/routes/paths";
import type { Media, MediaCollection, TmdbSearchResult } from "@/types/media";
import StatusBadge from "@/components/media/shared/StatusBadge";
import BaseMediaCard from "@/components/media/shared/BaseMediaCard";

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

  const year = media.release_date
    ? new Date(media.release_date).getFullYear()
    : undefined;

  const status = hasStatus(media, trackingData);
  const rating = showBadges ? hasRating(media, trackingData) : undefined;
  const reviewNotes = showBadges ? hasReviewNotes(media, trackingData) : undefined;
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
    <BaseMediaCard
      posterPath={media.poster_path ?? null}
      title={media.title ?? ""}
      type={media.type}
      year={year}
      rating={rating}
      hasReviewNotes={!!reviewNotes}
      overview={overview}
      collectionName={collectionName}
      showTrackingChip={showTrackingChip}
      isTracked={isTracked}
      priority={priority}
      className={className}
      topLeftSlot={
        showStatus && status ? (
          <StatusBadge status={status} className="absolute top-2 left-2" />
        ) : undefined
      }
      topRightSlot={
        showType ? (
          <span className="absolute top-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white uppercase">
            {media.type === "movie" ? "Movie" : "TV"}
          </span>
        ) : undefined
      }
      onClick={handleClick}
    />
  );
}
