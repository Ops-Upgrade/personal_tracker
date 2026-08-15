import type { ReactNode, HTMLAttributes } from "react";

/** Standard responsive scrollable class for inner content areas */
export const SCROLLABLE_CLASSES =
  "flex-1 min-h-[15rem] max-h-[70vh] min-w-0 overflow-y-auto overflow-x-auto";

interface BoxContainerProps extends HTMLAttributes<HTMLElement> {
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
  ...rest
}: BoxContainerProps) {
  return (
    <article
      className={`min-w-0 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${className}`}
      {...rest}
    >
      {children}
    </article>
  );
}