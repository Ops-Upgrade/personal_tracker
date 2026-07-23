import type { ReactNode } from "react";

interface BaseMediaGridProps {
  children: ReactNode;
  /** Additional Tailwind grid classes (e.g. column counts at breakpoints). */
  className?: string;
}

/**
 * Thin wrapper around a responsive CSS grid used by both the static
 * discover-view MediaGrid and the sortable collection-view grid.
 */
export default function BaseMediaGrid({ children, className = "" }: BaseMediaGridProps) {
  return (
    <div className={`grid gap-3 ${className}`.trim()}>
      {children}
    </div>
  );
}
