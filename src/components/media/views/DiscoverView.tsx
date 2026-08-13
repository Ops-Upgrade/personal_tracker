"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/routes/paths";
import { searchMedia, getDiscoverMedia } from "@/api/media";
import { useTmdbRetry } from "@/hooks/useTmdbRetry";
import type {
  TmdbSearchResult,
  DiscoverFilters,
  DiscoverGenreKey,
  DiscoverRegionKey,
  DiscoverAnimation,
  DiscoverSort,
  DiscoverEra,
  Media,
} from "@/types/media";
import { DEFAULT_DISCOVER_FILTERS, GENRE_OPTIONS } from "@/types/media";
import { Chip } from "@/components/common/Chip";
import SearchBar from "@/components/common/SearchBar";
import { FilterLabel } from "@/components/media/shared/FilterLabel";
import { MobileFilterBar } from "@/components/media/shared/MobileFilterBar";
import { FilterSidebar } from "@/components/media/shared/FilterSidebar";
import MediaCard from "@/components/media/MediaCard";
const DEBOUNCE_MS = 400;
const TMDB_PAGE_SIZE = 20;
const TMDB_MAX_PAGE = 500;

// ── Module-level cache: survives SPA navigation so back-button restores state ──

const discoverCache = {
  query: "",
  filters: DEFAULT_DISCOVER_FILTERS,
  results: [] as TmdbSearchResult[],
  page: 1,
};

export function clearDiscoverCache() {
  discoverCache.query = "";
  discoverCache.filters = DEFAULT_DISCOVER_FILTERS;
  discoverCache.results = [];
  discoverCache.page = 1;
}

// ── Option definitions ──

const TYPE_OPTIONS: { value: DiscoverFilters["type"]; label: string }[] = [
  { value: "all", label: "All" },
  { value: "movie", label: "Movies Only" },
  { value: "tv", label: "TV Only" },
];

const SORT_OPTIONS: { value: DiscoverSort; label: string }[] = [
  { value: "trending", label: "Trending This Week" },
  { value: "popularity", label: "Most Popular" },
  { value: "rating", label: "Highest Rated" },
  { value: "newest", label: "Newest First" },
  { value: "random", label: "Surprise Me" },
];

const ERA_OPTIONS: { value: DiscoverEra; label: string }[] = [
  { value: "all", label: "All Time" },
  { value: "2020s", label: "2020s" },
  { value: "2010s", label: "2010s" },
  { value: "2000s", label: "2000s" },
  { value: "1990s", label: "1990s" },
  { value: "classics", label: "Pre-1990" },
];

const REGION_OPTIONS: { value: DiscoverRegionKey; label: string }[] = [
  { value: "hollywood", label: "Hollywood" },
  { value: "bollywood", label: "Bollywood" },
  { value: "korean", label: "Korean" },
  { value: "japanese", label: "Japanese" },
];

const ANIMATION_OPTIONS: { value: DiscoverAnimation; label: string }[] = [
  { value: "include", label: "Include" },
  { value: "exclude", label: "Exclude" },
  { value: "only", label: "Only Animation" },
];

type MobileDropdown = "type" | "sort" | "era" | "genre" | "region" | "animation" | "library" | null;

// ── Helpers ──

function filterCount(filters: DiscoverFilters): number {
  let count = 0;
  if (filters.type !== "all") count++;
  if (filters.sortBy !== "popularity") count++;
  if (filters.era !== "all") count++;
  count += filters.genre.length;
  count += filters.region.length;
  if (filters.animation !== "include") count++;
  if (filters.hideTracked) count++;
  return count;
}

// ── Main component ──

export default function DiscoverView({ mediaItems }: { mediaItems: Media[] }) {
  const router = useRouter();
  const [query, setQuery] = useState(() => discoverCache.query);
  const [results, setResults] = useState<TmdbSearchResult[]>(() => discoverCache.results);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filters, setFilters] = useState<DiscoverFilters>(() => discoverCache.filters);
  const [hasMore, setHasMore] = useState(() => discoverCache.results.length > 0);
  const [mobileDropdown, setMobileDropdown] = useState<MobileDropdown>(null);

  const {
    loading,
    error,
    execute: retryExecute,
    clearError,
    cancel: cancelRetry,
  } = useTmdbRetry();

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadDone = useRef(discoverCache.results.length > 0);
  const pageRef = useRef(discoverCache.page);
  const totalPagesRef = useRef(1);
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Fingerprint of the cache that produced the restored results — used to skip
  // the initial fetch iff query + filters haven't changed since the cache was written.
  const restoreFingerprintRef = useRef(
    discoverCache.results.length > 0
      ? `${discoverCache.query}|${JSON.stringify(discoverCache.filters)}`
      : null,
  );

  const activeFilterCount = filterCount(filters);

  // ── Sync state → module-level cache so it survives SPA navigation ──
  useEffect(() => {
    discoverCache.query = query;
    discoverCache.filters = filters;
    discoverCache.results = results;
    discoverCache.page = pageRef.current;
  }, [query, filters, results]);

  // ── Fetch a page of results ──

  const fetchPage = useCallback(
    async (page: number, append: boolean, signal: AbortSignal) => {
      loadingRef.current = true;

      if (append) {
        setLoadingMore(true);
      }

      try {
        const trimmed = query.trim();

        if (trimmed.length > 0) {
          const data = await searchMedia(trimmed, "multi", page, signal);

          if (append) {
            setResults((prev) => {
              const seen = new Set(prev.map((r) => `${r.type}-${r.tmdb_id}`));
              const fresh = data.filter(
                (r) => !seen.has(`${r.type}-${r.tmdb_id}`),
              );
              return [...prev, ...fresh];
            });
          } else {
            setResults(data);
          }

          setHasMore(data.length >= TMDB_PAGE_SIZE);
          totalPagesRef.current = TMDB_MAX_PAGE;
        } else {
          const { results: data, total_pages } = await getDiscoverMedia(
            filters,
            page,
            signal,
          );

          totalPagesRef.current = total_pages;

          if (append) {
            setResults((prev) => {
              const seen = new Set(prev.map((r) => `${r.type}-${r.tmdb_id}`));
              const fresh = data.filter(
                (r) => !seen.has(`${r.type}-${r.tmdb_id}`),
              );
              return [...prev, ...fresh];
            });
          } else {
            setResults(data);
          }

          setHasMore(page < total_pages && page < TMDB_MAX_PAGE);
        }
      } finally {
        if (append) {
          setLoadingMore(false);
        }
        if (!signal.aborted) {
          loadingRef.current = false;
        }
      }
    },
    [query, filters],
  );

  // ── IntersectionObserver for infinite scroll ──

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loading || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingRef.current) {
          // Hard stop: exhausted results or hit TMDB absolute limit
          if (
            pageRef.current >= totalPagesRef.current ||
            pageRef.current >= TMDB_MAX_PAGE
          ) {
            setHasMore(false);
            return;
          }
          pageRef.current += 1;
          fetchPage(pageRef.current, true, new AbortController().signal);
        }
      },
      { rootMargin: "300px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, fetchPage]);

  // ── Main effect: watch query and filters, reset pagination ──

  useEffect(() => {
    // Skip fetch on remount if results were restored from cache and the
    // query + filters haven't changed since they were written.
    const currentFingerprint = `${query}|${JSON.stringify(filters)}`;
    if (
      restoreFingerprintRef.current &&
      restoreFingerprintRef.current === currentFingerprint
    ) {
      restoreFingerprintRef.current = null; // one-shot guard
      initialLoadDone.current = true;
      return;
    }
    restoreFingerprintRef.current = null;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    cancelRetry();

    pageRef.current = 1;
    totalPagesRef.current = 1;
    setHasMore(true);

    const trimmed = query.trim();

    if (trimmed.length > 0) {
      debounceRef.current = setTimeout(() => {
        retryExecute((signal) => fetchPage(1, false, signal));
      }, DEBOUNCE_MS);
    } else {
      if (!initialLoadDone.current) {
        initialLoadDone.current = true;
        retryExecute((signal) => fetchPage(1, false, signal));
        return;
      }

      debounceRef.current = setTimeout(() => {
        retryExecute((signal) => fetchPage(1, false, signal));
      }, DEBOUNCE_MS);
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filters]);

  // ── Clear search handler ──

  const handleQueryChange = useCallback(
    (value: string) => {
      if (value.trim().length === 0 && query.trim().length > 0) {
        initialLoadDone.current = false;
      }
      setQuery(value);
    },
    [query],
  );

  // ── Filter updaters ──

  const setType = useCallback(
    (type: DiscoverFilters["type"]) =>
      setFilters((p) => (p.type === type ? p : { ...p, type })),
    [],
  );
  const setSort = useCallback(
    (sortBy: DiscoverSort) =>
      setFilters((p) => (p.sortBy === sortBy ? p : { ...p, sortBy })),
    [],
  );
  const setEra = useCallback(
    (era: DiscoverEra) =>
      setFilters((p) => (p.era === era ? p : { ...p, era })),
    [],
  );
  const setAnimation = useCallback(
    (animation: DiscoverAnimation) =>
      setFilters((p) => (p.animation === animation ? p : { ...p, animation })),
    [],
  );

  const toggleGenre = useCallback((key: DiscoverGenreKey) => {
    setFilters((prev) => {
      const next = prev.genre.includes(key)
        ? prev.genre.filter((g) => g !== key)
        : [...prev.genre, key];
      return { ...prev, genre: next };
    });
  }, []);

  const toggleRegion = useCallback((key: DiscoverRegionKey) => {
    setFilters((prev) => {
      const next = prev.region.includes(key)
        ? prev.region.filter((r) => r !== key)
        : [...prev.region, key];
      return { ...prev, region: next };
    });
  }, []);

  // ── Navigation ──

  const handleCardClick = (item: TmdbSearchResult) => {
    // ?from=discover lets the detail page's Back button return to Discover
    router.push(`${ROUTES.MEDIA_DETAIL(item.tmdb_id, item.type)}?from=discover`);
  };

  const isSearching = query.trim().length > 0;

  // ══════════════════════════════════════════════════════
  //  Shared render helpers
  // ══════════════════════════════════════════════════════

  const typeChips = (
    <div className="flex flex-wrap gap-2">
      {TYPE_OPTIONS.map((o) => (
        <Chip key={o.value} active={filters.type === o.value} onClick={() => setType(o.value)}>
          {o.label}
        </Chip>
      ))}
    </div>
  );

  const sortChips = (
    <div className="flex flex-wrap gap-2">
      {SORT_OPTIONS.map((o) => (
        <Chip key={o.value} active={filters.sortBy === o.value} onClick={() => setSort(o.value)}>
          {o.label}
        </Chip>
      ))}
    </div>
  );

  const eraChips = (
    <div className="flex flex-wrap gap-2">
      {ERA_OPTIONS.map((o) => (
        <Chip key={o.value} active={filters.era === o.value} onClick={() => setEra(o.value)}>
          {o.label}
        </Chip>
      ))}
    </div>
  );

  const animationChips = (
    <div className="flex flex-wrap gap-2">
      {ANIMATION_OPTIONS.map((o) => (
        <Chip
          key={o.value}
          active={filters.animation === o.value}
          onClick={() => setAnimation(o.value)}
        >
          {o.label}
        </Chip>
      ))}
    </div>
  );

  const libraryChips = (
    <div className="flex flex-wrap gap-2">
      <Chip
        active={!!filters.hideTracked}
        onClick={() => setFilters((p) => ({ ...p, hideTracked: !p.hideTracked }))}
      >
        Hide Tracked Content
      </Chip>
    </div>
  );

  const genreCheckboxes = (
    <div className="grid grid-cols-2 gap-2">
      <label className="col-span-2 flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-default select-none opacity-70">
        <input
          type="checkbox"
          checked={filters.genre.length === 0}
          disabled
          readOnly
          className="h-3.5 w-3.5 rounded border-zinc-300 text-violet-600 disabled:opacity-70 dark:border-zinc-600"
        />
        All Genres
      </label>
      {GENRE_OPTIONS.map((o) => (
        <label
          key={o.value}
          className="col-span-1 flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer select-none"
        >
          <input
            type="checkbox"
            checked={filters.genre.includes(o.value)}
            onChange={() => toggleGenre(o.value)}
            className="h-3.5 w-3.5 rounded border-zinc-300 text-violet-600 focus:ring-violet-500 dark:border-zinc-600"
          />
          {o.label}
        </label>
      ))}
    </div>
  );

  const regionCheckboxes = (
    <div className="grid grid-cols-2 gap-2">
      <label className="col-span-2 flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-default select-none opacity-70">
        <input
          type="checkbox"
          checked={filters.region.length === 0}
          disabled
          readOnly
          className="h-3.5 w-3.5 rounded border-zinc-300 text-violet-600 disabled:opacity-70 dark:border-zinc-600"
        />
        All Regions
      </label>
      {REGION_OPTIONS.map((o) => (
        <label
          key={o.value}
          className="col-span-1 flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer select-none"
        >
          <input
            type="checkbox"
            checked={filters.region.includes(o.value)}
            onChange={() => toggleRegion(o.value)}
            className="h-3.5 w-3.5 rounded border-zinc-300 text-violet-600 focus:ring-violet-500 dark:border-zinc-600"
          />
          {o.label}
        </label>
      ))}
    </div>
  );

  // ══════════════════════════════════════════════════════
  //  Mobile tab bar + inline dropdowns
  // ══════════════════════════════════════════════════════

  const mobileTabDefs = [
    { id: "type", label: "Type" },
    { id: "sort", label: "Sort" },
    { id: "library", label: "Library" },
    { id: "genre", label: "Genre" },
    { id: "era", label: "Era" },
    { id: "region", label: "Region" },
    { id: "animation", label: "Animation" },
  ] as const;

  // ══════════════════════════════════════════════════════
  //  Results grid + sentinel
  // ══════════════════════════════════════════════════════

  const visibleResults = results.filter((item) => {
    if (!filters.hideTracked) return true;
    return !mediaItems.some((m) => m.tmdb_id === item.tmdb_id && m.type === item.type);
  });

  const resultsSection = (
    <>
      {loading && (
        <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Loading…
        </p>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400 flex items-center justify-between gap-3">
          <span className="flex-1 min-w-0">{error}</span>
          <button
            type="button"
            onClick={() => {
              clearError();
              retryExecute((signal) => fetchPage(pageRef.current, false, signal));
            }}
            className="shrink-0 rounded-md bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-400 dark:hover:bg-red-900/60 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && visibleResults.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {visibleResults.map((item, index) => {
              const localMedia = mediaItems.find(
                (m) => m.tmdb_id === item.tmdb_id && m.type === item.type
              );

              return (
                <MediaCard
                  key={`${item.type}-${item.tmdb_id}`}
                  media={item}
                  showStatus
                  showBadges
                  showTrackingChip
                  showOverview
                  trackingData={localMedia}
                  priority={index < 10}
                  onClick={() => handleCardClick(item)}
                />
              );
            })}
          </div>

          <div ref={sentinelRef} className="py-4">
            {loadingMore && (
              <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
                Loading more…
              </p>
            )}
            {!hasMore && results.length > 0 && (
              <p className="text-center text-xs text-zinc-400 dark:text-zinc-500">
                — End of results —
              </p>
            )}
          </div>
        </>
      )}

      {!loading && !error && visibleResults.length === 0 && results.length > 0 && (
        <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          All results on this page are already tracked.{" "}
          <button
            type="button"
            onClick={() => setFilters((p) => ({ ...p, hideTracked: false }))}
            className="text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 underline font-medium"
          >
            Show all
          </button>
        </p>
      )}

      {!loading && !error && results.length === 0 && query.trim().length > 0 && (
        <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          No results found for &ldquo;{query}&rdquo;.
        </p>
      )}
    </>
  );

  // ══════════════════════════════════════════════════════
  //  Desktop sidebar
  // ══════════════════════════════════════════════════════

  const sidebar = (
    <FilterSidebar>
      <div>
        <FilterLabel label="Type" isActive={filters.type !== "all"} onClear={() => setType("all")} />
        <div className="mt-1.5">{typeChips}</div>
      </div>

      <div>
        <FilterLabel label="Sort By" isActive={filters.sortBy !== "popularity"} onClear={() => setSort("popularity")} />
        <div className="mt-1.5">{sortChips}</div>
      </div>

      <div>
        <FilterLabel label="Library" isActive={filters.hideTracked} onClear={() => setFilters((p) => ({ ...p, hideTracked: false }))} />
        <div className="mt-1.5">{libraryChips}</div>
      </div>

      <div>
        <FilterLabel label="Genre" isActive={filters.genre.length > 0} onClear={() => setFilters((p) => ({ ...p, genre: [] }))} />
        <div className="mt-1.5">{genreCheckboxes}</div>
      </div>

      <div>
        <FilterLabel label="Era" isActive={filters.era !== "all"} onClear={() => setEra("all")} />
        <div className="mt-1.5">{eraChips}</div>
      </div>

      <div>
        <FilterLabel label="Region" isActive={filters.region.length > 0} onClear={() => setFilters((p) => ({ ...p, region: [] }))} />
        <div className="mt-1.5">{regionCheckboxes}</div>
      </div>

      <div>
        <FilterLabel label="Animation" isActive={filters.animation !== "include"} onClear={() => setAnimation("include")} />
        <div className="mt-1.5">{animationChips}</div>
      </div>
    </FilterSidebar>
  );

  // ══════════════════════════════════════════════════════
  //  Render
  // ══════════════════════════════════════════════════════

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* Desktop sidebar */}
      {!isSearching && sidebar}

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-4">
        <SearchBar
          value={query}
          onChange={handleQueryChange}
          placeholder="Search TMDB for Movies, TV, or People..."
        />

        {/* Mobile filter bar */}
        {!isSearching && (
          <MobileFilterBar
            tabs={[...mobileTabDefs]}
            activeTab={mobileDropdown}
            onTabChange={(id) => setMobileDropdown(mobileDropdown === id ? null : id as MobileDropdown)}
            onClose={() => setMobileDropdown(null)}
          >
            {mobileDropdown === "type" && typeChips}
            {mobileDropdown === "sort" && sortChips}
            {mobileDropdown === "library" && libraryChips}
            {mobileDropdown === "genre" && genreCheckboxes}
            {mobileDropdown === "era" && eraChips}
            {mobileDropdown === "region" && regionCheckboxes}
            {mobileDropdown === "animation" && animationChips}
          </MobileFilterBar>
        )}

        {/* Active filter count & Global Clear */}
        {!isSearching && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {activeFilterCount > 0
                ? `${activeFilterCount} filter${activeFilterCount !== 1 ? "s" : ""} active`
                : "No filters active"}
            </span>
            {activeFilterCount > 0 && (
              <button
                onClick={() => setFilters(DEFAULT_DISCOVER_FILTERS)}
                className="text-xs font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 transition-colors"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}

        {resultsSection}
      </div>
    </div>
  );
}
