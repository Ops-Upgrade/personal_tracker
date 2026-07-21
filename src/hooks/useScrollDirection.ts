"use client";

import { useState, useEffect, useRef } from "react";

/**
 * Tracks the window scroll direction.
 *
 * Returns `"up"` when the user scrolls up, `"down"` when they scroll down.
 * Uses a minimum delta threshold to avoid jitter on small scroll movements.
 * Always returns `"up"` when at the very top of the page.
 */
export function useScrollDirection(): "up" | "down" {
  const [direction, setDirection] = useState<"up" | "down">("up");
  const lastScrollY = useRef(0);

  useEffect(() => {
    const THRESHOLD = 20;
    const TOP_OFFSET = 64;

    function handleScroll() {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollY.current;

      // Never hide when within the navbar's own height from the top
      if (currentY <= TOP_OFFSET) {
        lastScrollY.current = currentY;
        setDirection("up");
        return;
      }

      // Only update if the scroll delta exceeds the threshold
      if (Math.abs(delta) < THRESHOLD) return;

      setDirection(delta > 0 ? "down" : "up");
      lastScrollY.current = currentY;
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return direction;
}
