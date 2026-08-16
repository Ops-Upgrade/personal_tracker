"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  Library,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { searchMedia } from "@/api/media";
import type { Media, TmdbSearchResult } from "@/types/media";
import { useTmdbRetry } from "@/hooks/useTmdbRetry";
import MediaCard from "@/components/media/MediaCard";
import { useNewSeasonChecks } from "@/hooks/useNewSeasonChecks";
import SearchBar from "@/components/common/SearchBar";
const DEBOUNCE_MS = 400;

// ── Module-level cache keyed by collectionId: survives the parent's
//    key-based remount so the discover search query + results persist across
//    modal close/reopen, scoped per page so searches never leak between
//    collections. Pages clear their entry on save/unmount. ──

const addMediaModalCache = new Map<
  string,
  { query: string; results: TmdbSearchResult[] }
>();

function getModalCache(collectionId: string) {
  if (!addMediaModalCache.has(collectionId)) {
    addMediaModalCache.set(collectionId, { query: "", results: [] });
  }
  return addMediaModalCache.get(collectionId)!;
}

export function clearAddMediaModalCache(collectionId: string) {
  addMediaModalCache.delete(collectionId);
}

type Mode = "select_source" | "tracked" | "discover";

interface AddMediaModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (item: TmdbSearchResult) => void;
  allMedia: Media[];
  collectionId: string;
}

export default function AddMediaModal({
  open,
  onClose,
  onAdd,
  allMedia,
  collectionId,
}: AddMediaModalProps) {
  const [mode, setMode] = useState<Mode>("select_source");
  const [searchQuery, setSearchQuery] = useState(
    () => getModalCache(collectionId).query,
  );
  const [discoverResults, setDiscoverResults] = useState<TmdbSearchResult[]>(
    () => getModalCache(collectionId).results,
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Sync state → module-level cache so it survives modal remounts ──
  useEffect(() => {
    const entry = getModalCache(collectionId);
    entry.query = searchQuery;
    entry.results = discoverResults;
  }, [collectionId, searchQuery, discoverResults]);

  const { loading: searching, execute: retryExecute, cancel: cancelRetry } = useTmdbRetry();

  // New-season badges for the tracked-media grid (watched TV only) — the
  // modal's cards stay passive; the hook owns all TMDB fetching.
  const newSeasonMap = useNewSeasonChecks(allMedia);

  // Esc key to close
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (mode !== "select_source") {
          setMode("select_source");
          setSearchQuery("");
          setDiscoverResults([]);
        } else {
          onClose();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, mode, onClose]);

  // Focus input when switching to tracked/discover
  useEffect(() => {
    if (mode === "tracked" || mode === "discover") {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [mode]);

  // ── Discover search with debounce ──

  const doDiscoverSearch = useCallback(
    (query: string) => {
      if (query.trim().length < 2) {
        setDiscoverResults([]);
        cancelRetry();
        return;
      }
      retryExecute(async (signal) => {
        const results = await searchMedia(query.trim(), "multi", 1, signal);
        if (!signal.aborted) {
          setDiscoverResults(results);
        }
      });
    },
    [retryExecute, cancelRetry],
  );

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    if (mode === "tracked") return; // local filter, no debounce needed

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doDiscoverSearch(value), DEBOUNCE_MS);
  }

  // ── Filter trackable media ──

  const filteredTracked = searchQuery.trim()
    ? allMedia.filter((m) =>
        m.title.toLowerCase().includes(searchQuery.trim().toLowerCase()),
      )
    : allMedia;

  // ── Add handlers ──

  function handleSelectTracked(media: Media) {
    onAdd({
      tmdb_id: media.tmdb_id ?? 0,
      type: media.type,
      title: media.title,
      poster_path: media.poster_path,
      release_date: media.release_date,
    });
    onClose();
  }

  function handleSelectDiscovered(item: TmdbSearchResult) {
    onAdd(item);
    onClose();
  }

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) {
      if (mode !== "select_source") {
        setMode("select_source");
        setSearchQuery("");
        setDiscoverResults([]);
      } else {
        onClose();
      }
    }
  }

  // ── Render ──

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-5xl rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="shrink-0 flex items-center gap-3 px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          {mode !== "select_source" && (
            <button
              type="button"
              onClick={() => {
                setMode("select_source");
                setSearchQuery("");
                setDiscoverResults([]);
              }}
              className="p-1 rounded-md text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors"
              aria-label="Back to source selection"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {mode === "select_source" && "Add Media"}
            {mode === "tracked" && "Add from Tracked Media"}
            {mode === "discover" && "Discover New Media"}
          </h2>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* ── Select Source ── */}
          {mode === "select_source" && (
            <div className="flex flex-col items-center justify-center gap-4 py-12">
              <button
                type="button"
                onClick={() => setMode("tracked")}
                className="w-full max-w-sm flex items-center gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-5 text-left transition hover:border-violet-400 hover:bg-violet-50 dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:border-violet-500 dark:hover:bg-violet-950/30"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400">
                  <Library size={24} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Add from tracked media
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Browse your existing library to add to this collection
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode("discover")}
                className="w-full max-w-sm flex items-center gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-5 text-left transition hover:border-violet-400 hover:bg-violet-50 dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:border-violet-500 dark:hover:bg-violet-950/30"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400">
                  <Search size={24} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Discover new media
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Search TMDB for movies & TV shows to add
                  </p>
                </div>
              </button>
            </div>
          )}

          {/* ── Tracked & Discover modes ── */}
          {(mode === "tracked" || mode === "discover") && (
            <>
              {/* Search input */}
              <div className="mb-5">
                <SearchBar
                  value={searchQuery}
                  onChange={(val) => {
                    handleSearchChange(val);
                    if (!val.trim()) setDiscoverResults([]);
                  }}
                  placeholder={
                    mode === "tracked"
                      ? "Filter tracked media…"
                      : "Search movies & TV shows…"
                  }
                  inputClassName="rounded-lg bg-zinc-50 dark:bg-zinc-800"
                />
              </div>

              {/* ── Tracked media grid ── */}
              {mode === "tracked" && (
                <>
                  {filteredTracked.length === 0 ? (
                    <p className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
                      {allMedia.length === 0
                        ? "No tracked media in your library yet."
                        : "No tracked media matches your search."}
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {filteredTracked.map((media) => (
                        <MediaCard
                          key={media.id}
                          media={media}
                          showStatus
                          showBadges
                          hasNewSeason={
                            media.tmdb_id ? !!newSeasonMap[media.tmdb_id] : false
                          }
                          onClick={() => handleSelectTracked(media)}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* ── Discover results grid ── */}
              {mode === "discover" && (
                <>
                  {searching && (
                    <div className="flex items-center justify-center gap-2 py-12 text-sm text-zinc-500 dark:text-zinc-400">
                      <Loader2 size={16} className="animate-spin" />
                      Searching…
                    </div>
                  )}

                  {!searching && searchQuery.trim().length < 2 && (
                    <p className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
                      Search for movies & TV shows to add.
                    </p>
                  )}

                  {!searching &&
                    searchQuery.trim().length >= 2 &&
                    discoverResults.length === 0 && (
                      <p className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
                        No results found.
                      </p>
                    )}

                  {!searching && discoverResults.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {discoverResults.map((item) => (
                        <MediaCard
                          key={`${item.type}-${item.tmdb_id}`}
                          media={item}
                          showStatus={false}
                          showBadges={false}
                          onClick={() => handleSelectDiscovered(item)}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
