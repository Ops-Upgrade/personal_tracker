"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Film, Tv, Search, Star, MessageSquare } from "lucide-react";
import { searchMedia, getDiscoverMedia } from "@/api/media";
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
import { DEFAULT_DISCOVER_FILTERS } from "@/types/media";

const TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w342";
const DEBOUNCE_MS = 400;
const TMDB_PAGE_SIZE = 20;
const TMDB_MAX_PAGE = 500;

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

const GENRE_OPTIONS: { value: DiscoverGenreKey; label: string }[] = [
  { value: "action", label: "Action" },
  { value: "comedy", label: "Comedy" },
  { value: "drama", label: "Drama" },
  { value: "thriller", label: "Thriller" },
  { value: "romance", label: "Romance" },
  { value: "scifi", label: "Sci-Fi" },
  { value: "fantasy", label: "Fantasy" },
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

// ── Chip sub-component ──

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
      }`}
    >
      {children}
    </button>
  );
}

// ── Section label ──

function FilterLabel({
    children,
    isActive,
    onClear
  }: {
    children: React.ReactNode;
    isActive?: boolean;
    onClear?: () => void;
  }) {
    return (
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {children}
        </span>
        {isActive && onClear && (
          <button
            onClick={onClear}
            className="text-[10px] font-bold uppercase tracking-wide text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 transition-colors"
          >
            Clear
          </button>
        )}
      </div>
    );
  }

// ── Main component ──

export default function DiscoverView({ mediaItems }: { mediaItems: Media[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TmdbSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<DiscoverFilters>(DEFAULT_DISCOVER_FILTERS);
  const [hasMore, setHasMore] = useState(true);
  const [mobileDropdown, setMobileDropdown] = useState<MobileDropdown>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadDone = useRef(false);
  const pageRef = useRef(1);
  const totalPagesRef = useRef(1);
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const activeFilterCount = filterCount(filters);

  // ── Fetch a page of results ──

  const fetchPage = useCallback(
    async (page: number, append: boolean) => {
      // Cancel any in-flight request so stale queries don't pile up
      abortControllerRef.current?.abort();
      loadingRef.current = false; // reset immediately so the new fetch can proceed

      const controller = new AbortController();
      abortControllerRef.current = controller;
      const { signal } = controller;

      loadingRef.current = true;

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

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
      } catch (err) {
        // Silently ignore aborted requests — a newer fetch has taken over
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load media.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
        // Only clear the ref if *our* signal wasn't aborted — prevents a
        // just-cancelled fetch's finally from clearing a newer fetch's flag.
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
          fetchPage(pageRef.current, true);
        }
      },
      { rootMargin: "300px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, fetchPage]);

  // ── Main effect: watch query and filters, reset pagination ──

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    pageRef.current = 1;
    totalPagesRef.current = 1;
    setHasMore(true);

    const trimmed = query.trim();

    if (trimmed.length > 0) {
      debounceRef.current = setTimeout(() => {
        fetchPage(1, false);
      }, DEBOUNCE_MS);
    } else {
      if (!initialLoadDone.current) {
        initialLoadDone.current = true;
        fetchPage(1, false);
        return;
      }

      debounceRef.current = setTimeout(() => {
        fetchPage(1, false);
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
    const prefix = item.type === "movie" ? "movie" : "tv";
    router.push(`/media/${prefix}/${item.tmdb_id}`);
  };

  const isSearching = query.trim().length > 0;

  const statusColors = {
    unwatched: "bg-red-500/90 text-white",
    watching: "bg-yellow-500/90 text-white",
    watched: "bg-green-600/90 text-white",
  };

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
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={filters.genre.length === 0}
          onChange={() => setFilters((prev) => ({ ...prev, genre: [] }))}
          className="h-3.5 w-3.5 rounded border-zinc-300 text-violet-600 focus:ring-violet-500 dark:border-zinc-600"
        />
        All Genres
      </label>
      {GENRE_OPTIONS.map((o) => (
        <label
          key={o.value}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer select-none"
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
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={filters.region.length === 0}
          onChange={() => setFilters((prev) => ({ ...prev, region: [] }))}
          className="h-3.5 w-3.5 rounded border-zinc-300 text-violet-600 focus:ring-violet-500 dark:border-zinc-600"
        />
        All Regions
      </label>
      {REGION_OPTIONS.map((o) => (
        <label
          key={o.value}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer select-none"
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
    { key: "type", label: "Type" },
    { key: "sort", label: "Sort" },
    { key: "library", label: "Library" },
    { key: "genre", label: "Genre" },
    { key: "era", label: "Era" },
    { key: "region", label: "Region" },
    { key: "animation", label: "Animation" },
  ] as const;

  const mobileFilterBar = (
    <div className="md:hidden relative">
      {/* Scrollable tab row */}
      <div className="w-full overflow-x-auto scrollbar-hide pb-2">
        <div className="flex gap-2 min-w-max">
          {mobileTabDefs.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() =>
                setMobileDropdown(mobileDropdown === key ? null : key)
              }
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                mobileDropdown === key
                  ? "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-300"
                  : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-750"
              }`}
            >
              {label}
              <span className="text-[10px]">
                {mobileDropdown === key ? "⌃" : "⌄"}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Dropdown popover (outside scroll container, avoids clipping) */}
      {mobileDropdown && (
        <>
          {/* Backdrop to catch outside clicks */}
          <div
            className="fixed inset-0 z-30"
            onClick={() => setMobileDropdown(null)}
          />
          <div className="absolute top-full left-0 right-0 z-40 mt-1 rounded-xl border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
            {mobileDropdown === "type" && typeChips}
            {mobileDropdown === "sort" && sortChips}
            {mobileDropdown === "library" && libraryChips}
            {mobileDropdown === "genre" && genreCheckboxes}
            {mobileDropdown === "era" && eraChips}
            {mobileDropdown === "region" && regionCheckboxes}
            {mobileDropdown === "animation" && animationChips}
          </div>
        </>
      )}
    </div>
  );

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
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      {!loading && !error && visibleResults.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {visibleResults.map((item, index) => {
              const posterUrl = item.poster_path
                ? `${TMDB_POSTER_BASE}${item.poster_path}`
                : null;
              const year = item.release_date
                ? new Date(item.release_date).getFullYear()
                : undefined;
              const localMedia = mediaItems.find(
                (m) => m.tmdb_id === item.tmdb_id && m.type === item.type
              );

              return (
                <div
                  key={`${item.type}-${item.tmdb_id}`}
                  onClick={() => handleCardClick(item)}
                  className="group rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden cursor-pointer"
                >
                  <div className="relative aspect-[2/3] bg-zinc-100 dark:bg-zinc-800">
                    {posterUrl ? (
                      <Image
                        src={posterUrl}
                        alt={item.title}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                        className="object-cover"
                        priority={index < 10}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-zinc-400 dark:text-zinc-600">
                        {item.type === "movie" ? <Film size={40} /> : <Tv size={40} />}
                      </div>
                    )}
                    <span className="absolute top-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white uppercase">
                      {item.type === "movie" ? "Movie" : "TV"}
                    </span>
                    {localMedia && localMedia.status && (
                      <span className={`absolute top-2 left-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase shadow-sm ${statusColors[localMedia.status]}`}>
                        {localMedia.status === "unwatched" ? "Not Watched" : localMedia.status}
                      </span>
                    )}
                  </div>

                  <div className="p-3">
                    <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {item.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 m-0">
                        {year ?? "—"}
                      </p>
                      {localMedia && (
                        <span className="rounded bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider">
                          Tracking
                        </span>
                      )}
                    </div>
                    {localMedia && (localMedia.rating || localMedia.review_notes) && (
                      <div className="flex items-center gap-2 mt-2">
                        {localMedia.rating ? (
                          <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-500 text-[10px] font-bold px-1.5 py-0.5 rounded">
                            <Star size={10} className="fill-current" /> {localMedia.rating}
                          </span>
                        ) : null}
                        {localMedia.review_notes ? (
                          <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 text-[10px] font-bold px-1.5 py-0.5 rounded">
                            <MessageSquare size={10} /> 1
                          </span>
                        ) : null}
                      </div>
                    )}
                    {item.overview && (
                      <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500 line-clamp-2">
                        {item.overview}
                      </p>
                    )}
                  </div>
                </div>
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
    <aside className="hidden md:block w-72 shrink-0 space-y-5 sticky top-4 self-start max-h-[calc(100vh-14rem)] overflow-y-auto rounded-xl border border-zinc-200 bg-white p-4 pb-6 dark:border-zinc-800 dark:bg-zinc-900 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-600 [&::-webkit-scrollbar-track]:bg-transparent">
      <div>
        <FilterLabel isActive={filters.type !== "all"} onClear={() => setType("all")}>Type</FilterLabel>
        <div className="mt-1.5">{typeChips}</div>
      </div>

      <div>
        <FilterLabel isActive={filters.sortBy !== "popularity"} onClear={() => setSort("popularity")}>Sort By</FilterLabel>
        <div className="mt-1.5">{sortChips}</div>
      </div>

      <div>
        <FilterLabel isActive={filters.hideTracked} onClear={() => setFilters((p) => ({ ...p, hideTracked: false }))}>Library</FilterLabel>
        <div className="mt-1.5">{libraryChips}</div>
      </div>

      <div>
        <FilterLabel isActive={filters.genre.length > 0} onClear={() => setFilters((p) => ({ ...p, genre: [] }))}>Genre</FilterLabel>
        <div className="mt-1.5">{genreCheckboxes}</div>
      </div>

      <div>
        <FilterLabel isActive={filters.era !== "all"} onClear={() => setEra("all")}>Era</FilterLabel>
        <div className="mt-1.5">{eraChips}</div>
      </div>

      <div>
        <FilterLabel isActive={filters.region.length > 0} onClear={() => setFilters((p) => ({ ...p, region: [] }))}>Region</FilterLabel>
        <div className="mt-1.5">{regionCheckboxes}</div>
      </div>

      <div>
        <FilterLabel isActive={filters.animation !== "include"} onClear={() => setAnimation("include")}>Animation</FilterLabel>
        <div className="mt-1.5">{animationChips}</div>
      </div>
    </aside>
  );

  // ══════════════════════════════════════════════════════
  //  Render
  // ══════════════════════════════════════════════════════

  return (
    <div className="flex flex-col md:flex-row items-start gap-6">
      {/* Desktop sidebar */}
      {!isSearching && sidebar}

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Search input */}
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search TMDB for Movies, TV, or People..."
            className="w-full rounded-xl border border-zinc-300 bg-white py-2.5 pl-10 pr-4 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>

        {/* Mobile filter bar */}
        {!isSearching && mobileFilterBar}

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
