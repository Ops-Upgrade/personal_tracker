"use client";

import BoxContainer from "@/components/common/BoxContainer";
import type { Media, MediaCollection } from "@/types/media";
import MediaGrid from "./MediaGrid";
import MediaCard from "./MediaCard";

interface MediaStatusSectionProps {
  label: string;
  status: string;
  items: Media[];
  collections: MediaCollection[];
  onStatusChange: (id: string, status: Media["status"]) => void;
  onRatingChange: (id: string, rating: number) => void;
}

/**
 * One BoxContainer per status (Watching / Not Watched / Watched).
 * Groups media rows and renders them in a MediaGrid.
 */
export default function MediaStatusSection({
  label,
  items,
  collections,
  onStatusChange,
  onRatingChange,
}: MediaStatusSectionProps) {
  if (items.length === 0) return null;

  return (
    <BoxContainer>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label} ({items.length})
      </h3>
      <MediaGrid>
        {items.map((media) => (
          <MediaCard
            key={media.id}
            media={media}
            collections={collections}
            onStatusChange={onStatusChange}
            onRatingChange={onRatingChange}
          />
        ))}
      </MediaGrid>
    </BoxContainer>
  );
}
