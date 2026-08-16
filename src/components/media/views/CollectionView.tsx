"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { List, LayoutGrid, ArrowUp, ArrowDown } from "lucide-react";
import Button from "@/components/common/Button";
import SearchBar from "@/components/common/SearchBar";
import { Chip } from "@/components/common/Chip";
import { useLocalStorage } from "@/lib/useLocalStorage";
import type { Media, MediaCollection } from "@/types/media";
import { getThemeStyles } from "@/lib/collectionThemes";
import { tmdbPosterUrl } from "@/components/media/constants";
import { computeProgress, getCollectionItems } from "@/components/media/utils";

// ── Module-level cache: survives SPA navigation so back-button restores state ──

const collectionViewCache = {
  collectionSearch: "",
  hideCompleted: false,
};

export function clearCollectionViewCache() {
  collectionViewCache.collectionSearch = "";
  collectionViewCache.hideCompleted = false;
}

interface CollectionViewProps {
  collections: MediaCollection[];
  mediaItems: Media[];
  onCreateCollection: () => void;
}

/** Get ordered poster list for a collection, capped at `limit`. */
function getPosterItems(
  collection: MediaCollection,
  allMedia: Media[],
  limit: number = 10,
): Media[] {
  const collectionMedia = allMedia.filter(
    (m) =>
      m.collection_ids?.includes(collection.id) ||
      m.collection_id === collection.id,
  );

  const ordered = collection.ordered_media_ids;
  if (ordered && ordered.length > 0) {
    const indexed = new Map(collectionMedia.map((m) => [m.id, m]));
    const sorted: Media[] = [];
    for (const id of ordered) {
      const item = indexed.get(id);
      if (item) {
        sorted.push(item);
        indexed.delete(id);
      }
    }
    for (const [, item] of indexed) {
      sorted.push(item);
    }
    return sorted.slice(0, limit);
  }

  return [...collectionMedia]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, limit);
}

export default function CollectionView({
  collections,
  mediaItems,
  onCreateCollection,
}: CollectionViewProps) {
  const router = useRouter();
  const [viewMode, setViewMode] = useLocalStorage<"single" | "grid">("mediaCollectionLayout", "single");
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Measure container width for poster sizing
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Sort state — persisted via localStorage (like viewMode) so it survives
  // hard refreshes, unlike the module-level cache below.
  const [sortBy, setSortBy] = useLocalStorage<"date_added" | "name" | "progress">(
    "mediaCollectionSortBy",
    "date_added",
  );
  const [sortOrder, setSortOrder] = useLocalStorage<"asc" | "desc">(
    "mediaCollectionSortOrder",
    "desc",
  );
  const [hideCompleted, setHideCompleted] = useState(() => collectionViewCache.hideCompleted);
  const [collectionSearch, setCollectionSearch] = useState(() => collectionViewCache.collectionSearch);

  // ── Sync state → module-level cache so it survives SPA navigation ──
  useEffect(() => {
    collectionViewCache.collectionSearch = collectionSearch;
    collectionViewCache.hideCompleted = hideCompleted;
  }, [collectionSearch, hideCompleted]);

  // Sort & filter collections
  const sortedCollections = useMemo(() => {
    let result = [...collections];

    // Search by name
    if (collectionSearch.trim()) {
      const q = collectionSearch.toLowerCase();
      result = result.filter((c) => c.name.toLowerCase().includes(q));
    }

    // Hide completed (100% progress)
    if (hideCompleted) {
      result = result.filter((c) => computeProgress(getCollectionItems(c.id, mediaItems)).percent < 100);
    }

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "date_added":
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "progress": {
          const pA = computeProgress(getCollectionItems(a.id, mediaItems)).percent;
          const pB = computeProgress(getCollectionItems(b.id, mediaItems)).percent;
          cmp = pA - pB;
          break;
        }
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });
    return result;
  }, [collections, mediaItems, sortBy, sortOrder, hideCompleted, collectionSearch]);

  // Compute poster dimensions once per render (shared by all cards in this view)
  const posterSize = (() => {
    if (containerWidth === 0) return { width: 32, height: 48 }; // default before measurement
    const cardPadding = 40; // p-5 = 20px × 2
    const gridGap = viewMode === "single" ? 0 : 16; // gap-4
    const cols = viewMode === "single" ? 1 : 2;
    const cardWidth = (containerWidth - gridGap * (cols - 1)) / cols;
    const available = cardWidth - cardPadding;
    const posterLimit = viewMode === "single" ? 20 : 10;
    const w = Math.max(24, Math.min(Math.floor(available / posterLimit), 48));
    return { width: w, height: Math.round(w * 1.5) };
  })();

  return (
    <div className="space-y-4">
      {/* ── Header: View toggle + Sort + New Collection ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {/* View toggle — hidden on mobile (single column only) */}
          <div className="hidden md:flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setViewMode("single")}
              className={`p-1.5 rounded-md transition-colors ${viewMode === "single"
                  ? "bg-white dark:bg-zinc-700 shadow-sm text-violet-600 dark:text-violet-400"
                  : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
                }`}
              aria-label="Single column view"
            >
              <List size={16} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-colors ${viewMode === "grid"
                  ? "bg-white dark:bg-zinc-700 shadow-sm text-violet-600 dark:text-violet-400"
                  : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
                }`}
              aria-label="Grid view"
            >
              <LayoutGrid size={16} />
            </button>
          </div>

          {/* Sort controls */}
          {collections.length > 0 && (
            <>
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Sort by</span>
              <div className="flex gap-1">
                {(
                  [
                    { value: "date_added" as const, label: "Date Added" },
                    { value: "name" as const, label: "A–Z" },
                    { value: "progress" as const, label: "Progress" },
                  ]
                ).map((opt) => (
                  <Chip
                    key={opt.value}
                    active={sortBy === opt.value}
                    onClick={() => setSortBy(opt.value)}
                    className="whitespace-nowrap"
                  >
                    {opt.label}
                  </Chip>
                ))}
              </div>
              <div className="flex rounded-full bg-zinc-100 dark:bg-zinc-800 p-0.5">
                <button
                  type="button"
                  onClick={() => setSortOrder("asc")}
                  className={`p-1 rounded-full transition-colors ${sortOrder === "asc"
                      ? "bg-white dark:bg-zinc-700 shadow-sm text-violet-600 dark:text-violet-400"
                      : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                    }`}
                  aria-label="Sort ascending"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setSortOrder("desc")}
                  className={`p-1 rounded-full transition-colors ${sortOrder === "desc"
                      ? "bg-white dark:bg-zinc-700 shadow-sm text-violet-600 dark:text-violet-400"
                      : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                    }`}
                  aria-label="Sort descending"
                >
                  <ArrowDown size={14} />
                </button>
              </div>
              <span className="text-zinc-300 dark:text-zinc-700 mx-1 shrink-0">|</span>
              <label className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 cursor-pointer select-none shrink-0">
                <input
                  type="checkbox"
                  checked={hideCompleted}
                  onChange={(e) => setHideCompleted(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-zinc-300 text-violet-600 focus:ring-violet-500 dark:border-zinc-600"
                />
                Hide completed
              </label>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Collection search */}
          <SearchBar
            value={collectionSearch}
            onChange={setCollectionSearch}
            placeholder="Search collections…"
            className="flex-1 md:flex-none md:w-48"
            inputClassName="text-xs py-2 pl-8 pr-8"
          />

          {/* New Collection button */}
          <Button variant="primary" size="md" onClick={onCreateCollection}>
            ＋ New Collection
          </Button>
        </div>
      </div>

      {/* ── Empty state ── */}
      {collections.length === 0 && (
        <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          No collections yet. Create one to organize your media.
        </p>
      )}

      {/* ── Collection cards ── */}
      <div
        ref={containerRef}
        className={
          viewMode === "single"
            ? "flex flex-col gap-4"
            : "flex flex-col gap-4 sm:grid sm:grid-cols-2"
        }
      >
        {sortedCollections.map((c) => {
          const colorValue = c.color ?? "#8B5CF6";
          const theme = getThemeStyles(colorValue);
          const posterLimit = viewMode === "single" ? 20 : 10;
          const posterItems = getPosterItems(c, mediaItems, posterLimit);
          const { percent, totalMins, watchedMins } = computeProgress(getCollectionItems(c.id, mediaItems));

          // Total items in collection (before poster cap)
          const collectionMedia = getCollectionItems(c.id, mediaItems);
          const totalItemCount = collectionMedia.length;

          return (
            <div
              key={c.id}
              className={`flex flex-col overflow-hidden relative transition-transform hover:scale-[1.02] cursor-pointer p-5 rounded-xl ${theme.cardClass}`}
              style={theme.cardStyle}
              onClick={() => router.push(`/media/collection/${c.id}`)}
            >
              {/* ── Top Row: Name + Progress Block ── */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3
                    className={`text-xl font-bold truncate ${theme.titleClass}`}
                    style={theme.titleStyle}
                  >
                    {c.name}
                  </h3>

                  {/* Description (one line, truncated) */}
                  {c.description && (
                    <p
                      className={`mt-0.5 text-xs truncate ${theme.subtitleClass}`}
                      style={theme.subtitleStyle}
                    >
                      {c.description}
                    </p>
                  )}


                </div>

                {/* Progress block (right side): bar + % + hours */}
                <div className="shrink-0 flex flex-col items-end gap-0.5 w-28">
                  <div className="flex items-center gap-1.5 w-full">
                    <div
                      className={`h-1.5 flex-1 min-w-0 overflow-hidden rounded-full ${theme.progressTrackClass}`}
                      style={theme.progressTrackStyle}
                    >
                      <div
                        className={`h-full rounded-full ${theme.progressFillClass}`}
                        style={{
                          width: `${percent}%`,
                          ...theme.progressFillStyle,
                        }}
                      />
                    </div>
                    <span
                      className={`text-xs font-bold w-7 text-right ${theme.subtitleClass}`}
                      style={theme.subtitleStyle}
                    >
                      {percent}%
                    </span>
                  </div>
                  {totalMins > 0 && (
                    <p
                      className={`text-[10px] ${theme.subtitleClass}`}
                      style={theme.subtitleStyle}
                    >
                      {Math.round(watchedMins / 60)}h / {Math.round(totalMins / 60)}h
                    </p>
                  )}
                </div>
              </div>

              {/* ── Poster Strip ── */}
              <div className="mt-4">
                {posterItems.length > 0 ? (
                  <div className="flex items-center">
                    <div className="flex -space-x-2">
                      {posterItems.map((m, i) => (
                        <div
                          key={m.id}
                          className="relative shrink-0 rounded-md overflow-hidden border-2 border-white/90 dark:border-zinc-800/90 shadow-sm"
                          style={{
                            width: posterSize.width,
                            height: posterSize.height,
                            zIndex: posterItems.length - i,
                          }}
                        >
                          {m.poster_path ? (
                            <Image
                              src={tmdbPosterUrl(m.poster_path!, "w92")}
                              alt={m.title}
                              fill
                              sizes={`${posterSize.width}px`}
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center bg-zinc-200 dark:bg-zinc-700 text-[8px] text-zinc-400">
                              N/A
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {totalItemCount > posterLimit && (
                      <div className="ml-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                        +{totalItemCount - posterLimit} more
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
                    No media added yet
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
