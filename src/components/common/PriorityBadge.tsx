"use client";

import type { Priority } from "@/types/common";
import { getPriorityColor } from "@/lib/priorityColors";

interface PriorityBadgeProps {
  priority: Priority;
  /** When true, the text label stays visible on mobile (used for section headers). */
  showTextOnMobile?: boolean;
}

/**
 * Reusable priority badge: coloured dot + label.
 * Replaces the duplicated `prettyPriority()` text-only renders.
 */
export default function PriorityBadge({ priority, showTextOnMobile }: PriorityBadgeProps) {
  const colors = getPriorityColor(priority);
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span
        className={`inline-block h-2 w-2 rounded-full ${colors.dot}`}
        aria-hidden="true"
      />
      <span
        className={`text-xs font-semibold ${colors.text} ${showTextOnMobile ? "" : "hidden md:inline"}`}
      >
        {priority[0].toUpperCase() + priority.slice(1)}
      </span>
    </span>
  );
}