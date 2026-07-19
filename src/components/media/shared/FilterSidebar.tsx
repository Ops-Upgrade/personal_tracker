"use client";

import { useState, useEffect, useRef } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

interface FilterSidebarProps {
  children: React.ReactNode;
}

export function FilterSidebar({ children }: FilterSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isStuck, setIsStuck] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Use IntersectionObserver instead of a continuous scroll listener.
  // This completely eliminates layout thrashing!
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // If the sentinel (placed right above the sidebar) scrolls out of
        // the top of the viewport, the sidebar has reached its sticky position.
        setIsStuck(
          !entry.isIntersecting && entry.boundingClientRect.top <= 0,
        );
      },
      { threshold: 0 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  // CSS min() flawlessly guarantees the sidebar never exceeds the viewport
  // AND never exceeds the main content!
  const dynamicMaxHeight = isStuck
    ? "min(100%, calc(100vh - 2rem))"
    : "min(100%, calc(100vh - 14rem))";

  return (
    <div
      className={`hidden md:block shrink-0 relative ${isCollapsed ? "w-12" : "w-72"}`}
    >
      {/* Sentinel placed just above the sticky element to trigger the observer */}
      <div
        ref={sentinelRef}
        className="absolute -top-4 w-full h-px pointer-events-none"
      />

      {isCollapsed ? (
        <aside
          style={{ maxHeight: dynamicMaxHeight }}
          className="flex flex-col items-center w-12 shrink-0 sticky top-4 self-start rounded-xl border border-zinc-200 bg-white py-4 dark:border-zinc-800 dark:bg-zinc-900 transition-[max-height] duration-300 ease-in-out"
        >
          <button
            onClick={() => setIsCollapsed(false)}
            className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition-colors mb-6"
            title="Expand filters"
          >
            <PanelLeftOpen className="w-5 h-5" />
          </button>
          <div className="text-xs font-semibold tracking-widest text-zinc-500 dark:text-zinc-400 [writing-mode:vertical-rl] rotate-180">
            FILTERS
          </div>
        </aside>
      ) : (
        <aside
          style={{ maxHeight: dynamicMaxHeight }}
          className="w-72 shrink-0 sticky top-4 self-start overflow-y-auto rounded-xl border border-zinc-200 bg-white p-4 pb-6 dark:border-zinc-800 dark:bg-zinc-900 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-600 [&::-webkit-scrollbar-track]:bg-transparent transition-[max-height] duration-300 ease-in-out"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
              Filters
            </h3>
            <button
              onClick={() => setIsCollapsed(true)}
              className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Collapse filters"
            >
              <PanelLeftClose className="w-5 h-5" />
            </button>
          </div>
          <div className="space-y-5">{children}</div>
        </aside>
      )}
    </div>
  );
}
