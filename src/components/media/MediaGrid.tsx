"use client";

import type { ReactNode } from "react";
import BaseMediaGrid from "./shared/BaseMediaGrid";

interface MediaGridProps {
  children: ReactNode;
}

/**
 * Responsive CSS grid for media posters in the discover view.
 * Mobile: 2-across, tablet: 3-across, desktop: 4/5-across.
 */
export default function MediaGrid({ children }: MediaGridProps) {
  return (
    <BaseMediaGrid className="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {children}
    </BaseMediaGrid>
  );
}
