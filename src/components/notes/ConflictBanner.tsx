"use client";

import React from "react";
import { AlertTriangle, RefreshCw, CheckCircle2 } from "lucide-react";

interface ConflictBannerProps {
  onReload: () => void;
  onKeepMine: () => void;
}

/**
 * Banner displayed when a compare-and-swap conflict is detected on a page.
 * Provides two explicit choices: Reload remote content or Keep local changes.
 */
export default function ConflictBanner({
  onReload,
  onKeepMine,
}: ConflictBannerProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <span>
          <strong>Conflict detected:</strong> This page was modified on another tab or device.
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onReload}
          className="flex items-center gap-1 rounded bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 shadow-sm border border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
        >
          <RefreshCw className="h-3 w-3" />
          Reload (discard mine)
        </button>
        <button
          type="button"
          onClick={onKeepMine}
          className="flex items-center gap-1 rounded bg-amber-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm hover:bg-amber-500 dark:bg-amber-600 dark:hover:bg-amber-500"
        >
          <CheckCircle2 className="h-3 w-3" />
          Keep mine (overwrite remote)
        </button>
      </div>
    </div>
  );
}
