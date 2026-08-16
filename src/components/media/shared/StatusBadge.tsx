import { statusColors, statusLabels } from "@/components/media/constants";
import type { MediaStatus } from "@/components/media/constants";

interface StatusBadgeProps {
  status: MediaStatus | string;
  /** Extra classes — use for positioning (e.g. "absolute top-2 left-2"). */
  className?: string;
  /**
   * When true, renders the badge as outlined/muted (border, transparent
   * background) instead of solid, signalling a virtual/projected status
   * inherited from the parent umbrella rather than an explicit DB record.
   */
  isVirtual?: boolean;
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
export default function StatusBadge({ status, className = "", isVirtual = false }: StatusBadgeProps) {
  if (!status) return null;

  if (isVirtual) {
    // Outlined/muted — signals a virtual projection inherited from the parent umbrella
    const virtualColors: Record<string, string> = {
      unwatched:
        "border-red-300 text-red-600 dark:border-red-700 dark:text-red-400",
      watching:
        "border-yellow-300 text-yellow-600 dark:border-yellow-700 dark:text-yellow-400",
      watched:
        "border-green-300 text-green-600 dark:border-green-700 dark:text-green-400",
    };
    return (
      <span
        className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-bold uppercase border bg-transparent ${virtualColors[status as MediaStatus] || ""} ${className}`}
      >
        {statusLabels[status as MediaStatus] || status}
      </span>
    );
  }

  return (
    <span
      className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-bold uppercase shadow-sm ${statusColors[status as MediaStatus] || ""} ${className}`}
    >
      {statusLabels[status as MediaStatus] || status}
    </span>
  );
}
