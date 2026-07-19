"use client";

import { Plus } from "lucide-react";

interface AddMediaTileProps {
  viewMode: "detail" | "tile";
  onClick: () => void;
}

export default function AddMediaTile({ viewMode, onClick }: AddMediaTileProps) {
  if (viewMode === "detail") {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-3 rounded-xl border-2 border-dashed border-zinc-300 p-3 cursor-pointer hover:border-violet-400 dark:border-zinc-700 dark:hover:border-violet-500 transition-colors"
        aria-label="Add media"
      >
        <div className="relative w-10 h-[60px] shrink-0 rounded-md overflow-hidden bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center">
          <Plus size={18} className="text-zinc-400 dark:text-zinc-500" />
        </div>
        <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Add Media
        </span>
      </button>
    );
  }

  // Tile variant
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-full w-full rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 cursor-pointer hover:border-violet-400 dark:hover:border-violet-500 transition-colors relative flex flex-col overflow-hidden"
      aria-label="Add media"
    >
      {/* Absolute centered content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <Plus size={32} className="text-zinc-400 dark:text-zinc-500" />
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 text-center px-2">
          Add Media
        </span>
      </div>

      {/* Invisible structure to maintain exact minimum height of a media tile */}
      <div className="invisible pointer-events-none w-full flex flex-col">
        {/* Matches poster aspect ratio */}
        <div className="w-full aspect-[2/3]"></div>
        {/* Matches text area padding and line heights */}
        <div className="p-3 w-full text-left">
          <h4 className="text-sm font-semibold truncate">&nbsp;</h4>
          <div className="mt-0.5">
            <p className="text-xs m-0">&nbsp;</p>
          </div>
        </div>
      </div>
    </button>
  );
}

