"use client";

import ConfirmDialog from "@/components/common/ConfirmDialog";

type UntrackTarget = "movie" | "tv" | "episode" | "season";

interface UntrackConfirmationProps {
  open: boolean;
  mediaType: UntrackTarget;
  onConfirm: () => void;
  onCancel: () => void;
}

const DESCRIPTIONS: Record<UntrackTarget, string> = {
  movie:
    "This will permanently delete all ratings, comments, and tracking data for this movie.",
  tv: "This will permanently remove all episode progress, ratings, and comments for this show.",
  episode:
    "This will permanently remove your progress, rating, and comments for this specific episode. Your tracking for the rest of the TV series will remain unchanged.",
  season:
    "This will permanently remove your progress, rating, and comments for every episode in this season.",
};

const TITLES: Record<UntrackTarget, string> = {
  movie: "Remove from Tracker",
  tv: "Remove from Tracker",
  episode: "Untrack this Episode",
  season: "Delete Season Records",
};

const LABELS: Record<UntrackTarget, string> = {
  movie: "Remove",
  tv: "Remove",
  episode: "Untrack",
  season: "Delete Records",
};

/**
 * Confirmation dialog shown when the user clicks "Untrack this Movie" / "Untrack this TV Series",
 * deletes an episode record, or deletes all records for a season.
 *
 * Extracted from MoviePage, TvSeriesPage, and EpisodePage where it was duplicated.
 */
export default function UntrackConfirmation({
  open,
  mediaType,
  onConfirm,
  onCancel,
}: UntrackConfirmationProps) {
  if (!open) return null;

  return (
    <ConfirmDialog
      title={TITLES[mediaType]}
      description={DESCRIPTIONS[mediaType]}
      confirmLabel={LABELS[mediaType]}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
