"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type {
  Media,
  MediaCollection,
  MediaTypeFilter,
  DiscoverGenreKey,
  DiscoverEra,
} from "@/types/media";
import { DISCOVER_GENRE_IDS, DISCOVER_ERA_DATES } from "@/types/media";
import MediaGrid from "@/components/media/MediaGrid";
import MediaCard from "@/components/media/MediaCard";
import { Chip } from "@/components/common/Chip";
import { FilterLabel } from "@/components/media/shared/FilterLabel";
import { MobileFilterBar } from "@/components/media/shared/MobileFilterBar";
import { FilterSidebar } from "@/components/media/shared/FilterSidebar";

// ── Local filter types ──

type StatusFilter = "all" | "unwatched" | "watching" | "watched";
type LocalRatingFilter =
  | "all"
  | "unrated"
  | "1star"
  | "2star"
  | "3star"
  | "4star"
  | "5star";
type LocalSort =
  | "status"
  | "date_added"
  | "title_asc"
  | "rating_desc"
  | "release_date_desc"
  | "random";

interface LocalFilters {
  type: MediaTypeFilter;
  sortBy: LocalSort;
  genre: DiscoverGenreKey[];
  era: DiscoverEra;
  rating: LocalRatingFilter;
  reviewed: boolean;
}

const DEFAULT_LOCAL_FILTERS: LocalFilters = {
  type: "all",
  sortBy: "status",
  genre: [],
  era: "all",
  rating: "all",
  reviewed: false,
};

// ── Option definitions ──

const TYPE_OPTIONS: { value: MediaTypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "movie", label: "Movies Only" },
  { value: "tv", label: "TV Only" },
];

const SORT_OPTIONS: { value: LocalSort; label: string }[] = [
  { value: "status", label: "Default" },
  { value: "date_added", label: "Date Added" },
  { value: "release_date_desc", label: "Release Date" },
  { value: "rating_desc", label: "Highest Rated" },
  { value: "title_asc", label: "A–Z" },
  { value: "random", label: "Random" },
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

const RATING_OPTIONS: { value: LocalRatingFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unrated", label: "Unrated" },
  { value: "1star", label: "1★" },
  { value: "2star", label: "2★" },
  { value: "3star", label: "3★" },
  { value: "4star", label: "4★" },
  { value: "5star", label: "5★" },
];

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unwatched", label: "Not Watched" },
  { value: "watching", label: "Watching" },
  { value: "watched", label: "Watched" },
];

type MobileDropdown =
  | "type"
  | "sort"
  | "genre"
  | "era"
  | "rating"
  | "reviewed"
  | null;

// ── Helpers ──

/** Pseudo-random but stable sort — hashes the ID so order doesn't thrash on re-render. */
function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function filterCount(filters: LocalFilters, statusFilter: StatusFilter): number {
  let count = 0;
  if (filters.type !== "all") count++;
  if (filters.sortBy !== "status") count++;


  if (filters.genre.length > 0) count++;
  if (filters.era !== "all") count++;
  if (filters.rating !== "all") count++;
  if (filters.reviewed) count++;
  if (statusFilter !== "all") count++;
  return count;
}

// ── Props ──

interface DefaultViewProps {
  mediaItems: Media[];
  collections: MediaCollection[];
  onStatusChange: (id: string, status: Media["status"]) => void;
  onRatingChange: (id: string, rating: number) => void;
}

// ── Main component ──

export default function DefaultView({
  mediaItems,
  collections,
  onStatusChange,
  onRatingChange,
}: DefaultViewProps) {
  const [filters, setFilters] = useState<LocalFilters>(DEFAULT_LOCAL_FILTERS);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [mobileDropdown, setMobileDropdown] = useState<MobileDropdown>(null);

  const activeFilterCount = filterCount(filters, statusFilter);

  // ── Filter updaters ──

  const setType = (type: MediaTypeFilter) =>
    setFilters((p) => (p.type === type ? p : { ...p, type }));

  const setSort = (sortBy: LocalSort) =>
    setFilters((p) => (p.sortBy === sortBy ? p : { ...p, sortBy }));

  const setEra = (era: DiscoverEra) =>
    setFilters((p) => (p.era === era ? p : { ...p, era }));

  const setRating = (rating: LocalRatingFilter) =>
    setFilters((p) => (p.rating === rating ? p : { ...p, rating }));

  const toggleGenre = (key: DiscoverGenreKey) => {
    setFilters((prev) => {
      const next = prev.genre.includes(key)
        ? prev.genre.filter((g) => g !== key)
        : [...prev.genre, key];
      return { ...prev, genre: next };
    });
  };

  // ── Filtering + sorting ──

  const filtered = useMemo(() => {
    let result = [...mediaItems];

    // 1. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((m) => m.title.toLowerCase().includes(q));
    }

    // 2. Type filter
    if (filters.type !== "all") {
      result = result.filter((m) => m.type === filters.type);
    }

    // 3. Status tab filter
    if (statusFilter !== "all") {
      result = result.filter((m) => m.status === statusFilter);
    }

    // 4. Genre (match against media item's genre_ids)
    if (filters.genre.length > 0) {
      result = result.filter((m) => {
        if (!m.genre_ids || m.genre_ids.length === 0) return false;
        return filters.genre.some((gKey) => {
          const allowedIds = DISCOVER_GENRE_IDS[gKey][m.type];
          return allowedIds.some((id) => m.genre_ids!.includes(id));
        });
      });
    }

    // 5. Era
    if (filters.era !== "all") {
      const dates = DISCOVER_ERA_DATES[filters.era];
      result = result.filter((m) => {
        if (!m.release_date) return false;
        if (dates.gte && m.release_date < dates.gte) return false;
        if (dates.lte && m.release_date > dates.lte) return false;
        return true;
      });
    }

    // 6. Personal rating
    if (filters.rating !== "all") {
      result = result.filter((m) => {
        const r = m.rating || 0;
        switch (filters.rating) {
          case "unrated":
            return r === 0;
          case "1star":
            return r > 0 && r <= 1;
          case "2star":
            return r > 1 && r <= 2;
          case "3star":
            return r > 2 && r <= 3;
          case "4star":
            return r > 3 && r <= 4;
          case "5star":
            return r > 4 && r <= 5;
          default:
            return true;
        }
      });
    }

    // 7. Reviewed
    if (filters.reviewed) {
      result = result.filter(
        (m) => !!m.review_notes && m.review_notes.trim().length > 0,
      );
    }

    // 8. Sorting
    switch (filters.sortBy) {
      case "status": {
        const statusOrder: Record<string, number> = {
          unwatched: 0,
          watching: 1,
          watched: 2,
        };
        result.sort(
          (a, b) =>
            (statusOrder[a.status] ?? 0) - (statusOrder[b.status] ?? 0),
        );
        break;
      }
      case "title_asc":
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "rating_desc":
        result.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
        break;
      case "release_date_desc":
        result.sort(
          (a, b) =>
            new Date(b.release_date ?? 0).getTime() -
            new Date(a.release_date ?? 0).getTime(),
        );
        break;
      case "random":
        result.sort((a, b) => hashId(a.id) - hashId(b.id));
        break;
      case "date_added":
        result.sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime(),
        );
        break;
    }

    return result;
  }, [mediaItems, searchQuery, filters, statusFilter]);

  // ══════════════════════════════════════════════════════
  //  Shared render helpers (reused by sidebar + mobile)
  // ══════════════════════════════════════════════════════

  const typeChips = (
    <div className="flex flex-wrap gap-2">
      {TYPE_OPTIONS.map((o) => (
        <Chip
          key={o.value}
          active={filters.type === o.value}
          onClick={() => setType(o.value)}
        >
          {o.label}
        </Chip>
      ))}
    </div>
  );

  const sortChips = (
    <div className="flex flex-wrap gap-2">
      {SORT_OPTIONS.map((o) => (
        <Chip
          key={o.value}
          active={filters.sortBy === o.value}
          onClick={() => setSort(o.value)}
        >
          {o.label}
        </Chip>
      ))}
    </div>
  );

  const eraChips = (
    <div className="flex flex-wrap gap-2">
      {ERA_OPTIONS.map((o) => (
        <Chip
          key={o.value}
          active={filters.era === o.value}
          onClick={() => setEra(o.value)}
        >
          {o.label}
        </Chip>
      ))}
    </div>
  );

  const ratingChips = (
    <div className="flex flex-wrap gap-2">
      {RATING_OPTIONS.map((o) => (
        <Chip
          key={o.value}
          active={filters.rating === o.value}
          onClick={() => setRating(o.value)}
        >
          {o.label}
        </Chip>
      ))}
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

  const reviewedChip = (
    <div className="flex flex-wrap gap-2">
      <Chip
        active={filters.reviewed}
        onClick={() =>
          setFilters((p) => ({ ...p, reviewed: !p.reviewed }))
        }
      >
        Has Review
      </Chip>
    </div>
  );

  // ══════════════════════════════════════════════════════
  //  Mobile filter bar (matches DiscoverView pattern)
  // ══════════════════════════════════════════════════════

  const mobileTabDefs = [
    { id: "type", label: "Type" },
    { id: "sort", label: "Sort" },
    { id: "genre", label: "Genre" },
    { id: "era", label: "Era" },
    { id: "rating", label: "Rating" },
    { id: "reviewed", label: "Reviewed" },
  ] as const;

  // ══════════════════════════════════════════════════════
  //  Desktop sidebar
  // ══════════════════════════════════════════════════════

  const sidebar = (
    <FilterSidebar className="max-h-[calc(100vh-20rem)]">
      <div>
        <FilterLabel label="Type" isActive={filters.type !== "all"} onClear={() => setType("all")} />
        <div className="mt-1.5">{typeChips}</div>
      </div>

      <div>
        <FilterLabel label="Sort By" isActive={filters.sortBy !== "status"} onClear={() => setSort("status")} />
        <div className="mt-1.5">{sortChips}</div>
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
        <FilterLabel label="Rating" isActive={filters.rating !== "all"} onClear={() => setRating("all")} />
        <div className="mt-1.5">{ratingChips}</div>
      </div>

      <div>
        <FilterLabel label="Reviewed" isActive={filters.reviewed} onClear={() => setFilters((p) => ({ ...p, reviewed: false }))} />
        <div className="mt-1.5">{reviewedChip}</div>
      </div>
    </FilterSidebar>
  );

  // ══════════════════════════════════════════════════════
  //  Render
  // ══════════════════════════════════════════════════════

  return (
    <div className="flex flex-col md:flex-row items-start gap-6">
      {/* Desktop sidebar */}
      {sidebar}

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Search + Status tabs — stacked on mobile, side-by-side on desktop */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          {/* Status tabs — full width row on mobile */}
          <div className="flex gap-2 flex-wrap">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatusFilter(tab.value)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  statusFilter === tab.value
                    ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search input — full width on mobile, expands on focus, fixed to right on desktop */}
          <div
            className={`relative shrink-0 transition-all duration-300 w-full md:w-72 md:ml-auto ${
              searchFocused ? "md:flex-1 md:min-w-0" : "md:w-96"
            }`}
          >
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search your library..."
              className="w-full rounded-xl border border-zinc-300 bg-white py-2.5 pl-10 pr-4 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
        </div>

        {/* Mobile filter bar */}
        <MobileFilterBar
          tabs={[...mobileTabDefs]}
          activeTab={mobileDropdown}
          onTabChange={(id) => setMobileDropdown(mobileDropdown === id ? null : id as MobileDropdown)}
          onClose={() => setMobileDropdown(null)}
        >
          {mobileDropdown === "type" && typeChips}
          {mobileDropdown === "sort" && sortChips}
          {mobileDropdown === "genre" && genreCheckboxes}
          {mobileDropdown === "era" && eraChips}
          {mobileDropdown === "rating" && ratingChips}
          {mobileDropdown === "reviewed" && reviewedChip}
        </MobileFilterBar>

        {/* Active filter count & Global Clear */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {activeFilterCount > 0
              ? `${activeFilterCount} filter${activeFilterCount !== 1 ? "s" : ""} active`
              : "No filters active"}
          </span>
          {activeFilterCount > 0 && (
            <button
              onClick={() => {
                setFilters(DEFAULT_LOCAL_FILTERS);
                setSearchQuery("");
                setStatusFilter("all");
              }}
              className="text-xs font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 transition-colors"
            >
              Clear all filters
            </button>
          )}
        </div>

        {/* Results */}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No media match your filters.
          </p>
        )}

        {filtered.length > 0 && (
          <MediaGrid>
            {filtered.map((media, index) => (
              <MediaCard
                key={media.id}
                media={media}
                collections={collections}
                priority={index < 10}
                onStatusChange={onStatusChange}
                onRatingChange={onRatingChange}
              />
            ))}
          </MediaGrid>
        )}
      </div>
    </div>
  );
}
