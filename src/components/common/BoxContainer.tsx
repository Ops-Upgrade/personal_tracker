import type { ReactNode } from "react";

/** Standard responsive scrollable class for inner content areas */
export const SCROLLABLE_CLASSES =
  "flex-1 min-h-[15rem] max-h-[70vh] overflow-y-auto";

interface BoxContainerProps {
  children: ReactNode;
  className?: string;
}

/**
 * Reusable container with unified dark/light box styling.
 * Extracted from Task Manager boxes to be used app-wide.
 */
export default function BoxContainer({
  children,
  className = "",
}: BoxContainerProps) {
  return (
    <article
      className={`rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${className}`}
    >
      {children}
    </article>
  );
}