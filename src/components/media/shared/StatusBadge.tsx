import { statusColors, statusLabels } from "@/components/media/constants";
import type { MediaStatus } from "@/components/media/constants";

interface StatusBadgeProps {
  status: MediaStatus | string;
  /** Extra classes — use for positioning (e.g. "absolute top-2 left-2"). */
  className?: string;
}

/**
 * Tiny status badge pill.
 *
 * Renders "Not Watched" / "Watching" / "Watched" with the appropriate colour.
 * No built-in positioning so it works inline, in a badge stack, or as a poster
 * overlay depending on the `className` passed in.
 *
 * Extracted from 7 duplicated locations across the media module.
 */
export default function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  if (!status) return null;

  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase shadow-sm ${statusColors[status as MediaStatus] || ""} ${className}`}
    >
      {statusLabels[status as MediaStatus] || status}
    </span>
  );
}
