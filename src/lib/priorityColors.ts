import type { Priority } from "@/types/taskmanager";

export interface PriorityColorSet {
  text: string;
  bg: string;
  border: string;
  dot: string;
}

const PRIORITY_COLORS: Record<Priority, PriorityColorSet> = {
  critical: {
    text: "text-red-700 dark:text-red-300",
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-300 dark:border-red-800",
    dot: "bg-red-500",
  },
  high: {
    text: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-300 dark:border-amber-800",
    dot: "bg-amber-500",
  },
  medium: {
    text: "text-blue-700 dark:text-blue-300",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-300 dark:border-blue-800",
    dot: "bg-blue-500",
  },
  low: {
    text: "text-zinc-600 dark:text-zinc-400",
    bg: "bg-zinc-50 dark:bg-zinc-800/30",
    border: "border-zinc-300 dark:border-zinc-700",
    dot: "bg-zinc-400",
  },
};

export function getPriorityColor(priority: Priority): PriorityColorSet {
  return PRIORITY_COLORS[priority];
}
