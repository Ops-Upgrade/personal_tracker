"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { Search, X, Film, Tv } from "lucide-react";
import { searchMedia } from "@/api/media";
import type { TmdbSearchResult } from "@/types/media";

const TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w92";

interface QuickSearchProps {
  onSelect: (item: TmdbSearchResult) => void;
  placeholder?: string;
}

export default function QuickSearch({
  onSelect,
  placeholder = "Search movies & TV shows…",
}: QuickSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TmdbSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await searchMedia(q.trim(), "multi");
      setResults(res.slice(0, 8));
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  function handleInputChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  }

  function handleSelect(item: TmdbSearchResult) {
    onSelect(item);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className="flex items-center gap-1.5 rounded-lg border border-dashed border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:border-violet-400 hover:text-violet-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-violet-500 dark:hover:text-violet-400 transition-colors"
      >
        <Search size={13} />
        Add Title
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 w-80 rounded-xl border border-zinc-200 bg-white shadow-xl z-50 py-2 dark:border-zinc-700 dark:bg-zinc-900">
          {/* Search input */}
          <div className="px-3 pb-2">
            <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 dark:border-zinc-700 dark:bg-zinc-800">
              <Search size={14} className="text-zinc-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder={placeholder}
                className="flex-1 bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Results */}
          <div className="max-h-64 overflow-y-auto">
            {searching && (
              <p className="px-3 py-4 text-center text-xs text-zinc-400">
                Searching…
              </p>
            )}
            {!searching && query.length > 0 && results.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-zinc-400">
                No results found.
              </p>
            )}
            {!searching &&
              results.map((item) => (
                <button
                  key={`${item.type}-${item.tmdb_id}`}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  <div className="relative w-9 h-[54px] shrink-0 rounded overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                    {item.poster_path ? (
                      <Image
                        src={`${TMDB_POSTER_BASE}${item.poster_path}`}
                        alt={item.title}
                        fill
                        sizes="36px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-zinc-400">
                        {item.type === "movie" ? (
                          <Film size={14} />
                        ) : (
                          <Tv size={14} />
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {item.type === "movie" ? "Movie" : "TV"}
                      {item.release_date &&
                        ` • ${new Date(item.release_date).getFullYear()}`}
                    </p>
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
