"use client";

import type { Priority } from "@/types/taskmanager";
import { getPriorityColor } from "./helpers";

interface PriorityBadgeProps {
  priority: Priority;
}

/**
 * Reusable priority badge: coloured dot + label.
 * Replaces the duplicated `prettyPriority()` text-only renders.
 */
export default function PriorityBadge({ priority }: PriorityBadgeProps) {
  const colors = getPriorityColor(priority);
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span
        className={`inline-block h-2 w-2 rounded-full ${colors.dot}`}
        aria-hidden="true"
      />
      <span className={`text-xs font-semibold ${colors.text}`}>
        {priority[0].toUpperCase() + priority.slice(1)}
      </span>
    </span>
  );
}