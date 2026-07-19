"use client";

import ConfirmDialog from "@/components/common/ConfirmDialog";

interface UntrackConfirmationProps {
  open: boolean;
  mediaType: "movie" | "tv" | "episode";
  onConfirm: () => void;
  onCancel: () => void;
}

const DESCRIPTIONS: Record<"movie" | "tv" | "episode", string> = {
  movie:
    "This will permanently delete all ratings, comments, and tracking data for this movie.",
  tv: "This will permanently remove all episode progress, ratings, and comments for this show.",
  episode:
    "This will permanently remove your progress, rating, and comments for this specific episode. Your tracking for the rest of the TV series will remain unchanged.",
};

const TITLES: Record<"movie" | "tv" | "episode", string> = {
  movie: "Remove from Tracker",
  tv: "Remove from Tracker",
  episode: "Delete Episode Record",
};

const LABELS: Record<"movie" | "tv" | "episode", string> = {
  movie: "Remove",
  tv: "Remove",
  episode: "Delete Record",
};

/**
 * Confirmation dialog shown when the user clicks "Untrack this Movie" / "Untrack this TV Series"
 * or deletes an episode record.
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
