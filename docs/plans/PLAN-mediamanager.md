# Plan: Media Domain (Movies & TV Series) Implementation

**Date**: 2026-07-13
**Status**: Final Draft — consolidates PLAN-media.md rev.2 + rev.3 (Reconciled MVP + Roadmap) into one buildable spec

## Goal
Build a "Movies & TV Series" domain where users search TMDB, save a movie/show with personal tracking data (status, collection, rating, review), and browse it in a poster grid grouped by **Watching / Unwatched / Watched**. Metadata is encrypted client-side before storage, matching every other domain in the app. No files are uploaded — the poster is a hotlinked TMDB CDN URL, not something stored ourselves. This plan ships the MVP (Phases 1–5) against the shared architecture already established by Task Manager / Expense / Education / the global bug-fix pass, and defers everything requiring new infrastructure (caching, cron, notifications) to a named roadmap.

## Reusable Inventory (from existing codebase — nothing below is duplicated)
| Element | Path | How it's reused |
|---------|------|-----------------|
| `encryptField` / `decryptField` | `src/lib/crypto/index.ts` | Encrypt/decrypt each `media` and `media_collections` row's JSON blob — identical convention to every other table. |
| `getAuthenticatedUserId()` | `src/app/api/storage/_helpers/auth.ts` | Reused (not duplicated) by the new TMDB proxy routes to enforce a valid session before calling TMDB. |
| `BoxContainer` | `src/components/common/BoxContainer.tsx` | Wraps each of the three status sections (Watching/Unwatched/Watched). |
| `Button` | `src/components/common/Button.tsx` | All buttons (collection actions, route navigation). |
| `useLocalStorage` | `src/lib/useLocalStorage.ts` | Persists selected collection filter and tile/list view preference. |
| `useHashModal` | `src/lib/useHashModal.ts` | Drives `#collection-[id]` and `#collection-new` deep-linkable modals. |
| `useAuthBootstrap` | `src/lib/useAuthBootstrap.ts` | Session + loading state for `MediaView`. |
| `ErrorBanner` | `src/components/common/ErrorBanner.tsx` | Standard error surface for fetch/TMDB failures. |
| `ConfirmDialog` | `src/components/taskmanager/ConfirmDialog.tsx` | "Remove from Tracker" confirmation (no 'X', backdrop = cancel). |
| `BackButton` | `src/components/common/BackButton.tsx` | Used on `/media/collection/[id]` "view all" route. |
| `viewHelpers.ts` helpers | `src/lib/viewHelpers.ts` | Reuses existing text/sort helpers. **Note:** A new `groupByStatus` helper will be added here, as no generic grouping helper exists. |

## Package Decisions
| Package | Version | Decision | Reason |
|---------|---------|----------|--------|
| — | — | No new package for TMDB | Native `fetch()` against `https://api.themoviedb.org/3` from a server route is enough for two endpoints (search, details). |
| `lucide-react` | existing | `Star`, `Film`, `Tv`, `Clapperboard` icons | Already installed; no new dependency. |

## ⚠️ Flagged Observations
- **No Persistent Storage for Discover Data.** Discover, trending, and search results are NEVER stored in the database. They exist only in frontend state (or a short-lived cache) to prevent DB bloat. Only items the user explicitly "Tracks" are saved as encrypted DB rows.
- **Tracking Updates (Lazy Updates).** To keep "Returning Series" updated with new episodes, the MVP uses a "Lazy Update" approach—fetching fresh TMDB data on-the-fly when the user views the item. Background cron jobs for proactive syncing are deferred to the roadmap.
- **TMDB API key must be server-only.** `TMDB_API_KEY` (no `NEXT_PUBLIC_` prefix) must contain the TMDB API Read Access Token (JWT). It is proxied through `src/app/api/tmdb/*` using `Authorization: Bearer` headers and gated by `getAuthenticatedUserId()` — the browser never talks to `api.themoviedb.org` directly.
- **TMDB attribution is a ToS requirement, not polish.** A small `TmdbAttribution.tsx` footer in `MediaView` is mandatory, flagged so it isn't missed at launch.
- **`next.config.ts` + CSP both need updates before Phase 5 is "done".** `images.remotePatterns` needs `image.tmdb.org`; CSP `img-src` needs `https://image.tmdb.org`. Blocking config change, not a DB migration.
- **Duplicate prevention has no DB-level enforcement.** Rows are encrypted blobs, so there is no plaintext column to uniquely index on. Dedupe (`tmdb_id` + `type`) must run client-side against the already-decrypted in-memory list before insert.
- **Collection deletion is non-destructive.** Deleting a `media_collections` row must batch-update affected `media` rows to `collection_id: null` rather than cascade-deleting them — mirrors the "unlink, don't cascade" precedent from Education/Certificates.
- **Three-state grouping is Media-specific.** `GenericActiveBox`/`GenericCompletedBox` assume a binary split; forcing a third state into them risks regressing Task/Expense/Education. Media owns a thin `MediaStatusSection` that groups `watching | unwatched | watched` and hands each group to a custom `MediaGrid` component.
- **Two-Layer Data Merge Strategy:** Dedicated pages (`/media/movie/[tmdb_id]`) pull untracked metadata directly from TMDB proxies. The page then decrypts the local database and searches for a match by `tmdb_id`. If found, tracking data (status, rating, notes) is overlaid on the TMDB data. This enables browsing untracked TMDB media on dedicated pages without storing them in the DB.
- **Rating/status changes must not require the full detail page.** Quick-select status dropdown + star control directly on the card (mirrors Task Manager's "quick-complete" pattern).
- **Debounce TMDB search input (~400ms)** — TMDB free tier has request-rate limits. Handled in `DiscoverView`.
- **Poster/overview fallback** — some TMDB entries lack a poster or overview; render a placeholder background and hide the overview line.

## Database Schema (Supabase)
Follows the existing encrypted-blob convention exactly: `id`, `user_id`, `iv`, `data`, `created_at` — no plaintext columns, RLS via `auth.uid() = user_id`. No SQL migration is needed for any roadmap phase below — new fields are just optional keys added to the TypeScript type, since the row is a single JSON blob.

### TMDB Types [NEW]
```typescript
interface TmdbSearchResult {
  tmdb_id: number;
  type: 'movie' | 'tv';
  title: string;
  poster_path?: string;
  overview?: string;
  release_date?: string;
}

interface TmdbDetails {
  overview: string;
  genres: { id: number; name: string }[];
  runtime?: number;
}
```

### `public.media_collections`
Encrypted JSON in `data`:
```typescript
{
  name: string,
  description?: string,
  color?: string              // hex code for visual tags
}
```

### `public.media`
Encrypted JSON in `data`:
```typescript
{
  tmdb_id?: number,
  type: 'movie' | 'tv',
  title: string,
  poster_path?: string,       // TMDB relative path, e.g. "/abc123.jpg" — full URL built client-side
  release_date?: string,
  genre_ids?: number[],       // captured free at add-time from TMDB details response
  collection_id?: string,     // UUID, optional — FK-by-convention, not enforced in SQL (matches certificate_id/education_id precedent)
  status: 'watching' | 'unwatched' | 'watched',
  rating?: number,            // 1-5
  review_notes?: string,
  watched_on?: string,        // ISO date string
  episodes?: Record<string, { // Map of "S{season}E{episode}" -> individual episode tracking
    status: 'watching' | 'unwatched' | 'watched',
    rating?: number,
    review_notes?: string,
    watched_on?: string
  }>
}
```
Storing `poster_path` (relative) rather than a full URL keeps the blob smaller and lets the base image URL (`https://image.tmdb.org/t/p/w500`) live as a single constant.

## Service & API Layer (every function named — nothing implicit)

### `src/app/api/tmdb/search/route.ts` [NEW]
| Function | Signature | Behavior |
|---|---|---|
| `POST` | `{ query: string, type: 'movie' \| 'tv' \| 'multi' }` → `TmdbSearchResult[]` | Calls `getAuthenticatedUserId()` first. Proxies to TMDB `/search/multi` (or specific). Frontend debounces input (~400ms) to ensure only 1 API call per completed word. Returns trimmed fields: `tmdb_id, title, poster_path, overview, release_date, type`. |

### `src/app/api/tmdb/discover/route.ts` [NEW]
| Function | Signature | Behavior |
|---|---|---|
| `POST` | `{ type: 'trending' \| 'popular', genre_id?: number }` → `TmdbSearchResult[]` | Same auth gate. Proxies to TMDB `/trending/all/day`, `/movie/popular`, or `/discover/movie?with_genres`. Used to populate the Discover View's default state and category filters without storing data. |

### `src/app/api/tmdb/details/route.ts` [NEW]
| Function | Signature | Behavior |
|---|---|---|
| `POST` | `{ tmdb_id: number, type: 'movie' \| 'tv' }` → `TmdbDetails` | Same auth gate. Returns `overview, genres, runtime` for the detail/add modal. |

### `src/app/api/tmdb/season/route.ts` [NEW]
| Function | Signature | Behavior |
|---|---|---|
| `POST` | `{ tmdb_id: number, season_number: number }` → `TmdbSeasonDetails` | Same auth gate. Returns episode list for a TV show season to populate the episode tracker. |

### `src/api/media/tmdb.ts` [NEW] — thin client wrappers (components never build TMDB requests themselves)
| Function | Signature | Purpose |
|---|---|---|
| `searchMedia` | `(query: string, type: SearchType) => Promise<TmdbSearchResult[]>` | Calls `/api/tmdb/search`. |
| `getDiscoverMedia`| `(type: 'trending' \| 'popular', genreId?: number) => Promise<TmdbSearchResult[]>` | Calls `/api/tmdb/discover`. |
| `getMediaDetails` | `(tmdbId: number, type: 'movie' \| 'tv') => Promise<TmdbDetails>` | Calls `/api/tmdb/details`. |
| `getSeasonDetails` | `(tmdbId: number, seasonNumber: number) => Promise<TmdbSeasonDetails>` | Calls `/api/tmdb/season` for episode tracking. |

### `src/api/media/media.ts` [NEW] — encrypted CRUD for `media`
| Function | Signature | Purpose |
|---|---|---|
| `listMedia` | `(userId: string) => Promise<Media[]>` | Fetch + decrypt all rows for the user. |
| `createMedia` | `(userId: string, input: MediaPlaintext) => Promise<Media>` | Encrypt + insert one row. |
| `updateMedia` | `(userId: string, id: string, patch: Partial<MediaPlaintext>) => Promise<Media>` | Re-encrypt full blob (decrypt → merge → re-encrypt → update), same pattern as `educations.ts`. |
| `deleteMedia` | `(userId: string, id: string) => Promise<void>` | Hard delete one row. Called by both "Remove from Tracker" UI actions and the auto-untrack cascade. |
| `findDuplicate` | `(tmdbId: number, type: 'movie' \| 'tv', existing: Media[]) => Media \| undefined` | Pure helper, no network call — used before `createMedia`. |
| `unlinkFromCollection` | `(userId: string, collectionId: string, existing: Media[]) => Promise<void>` | Batch-update all rows where `collection_id === collectionId` to `null`; called by collection delete, never by media delete. |
| `formatEpisodeKey` | `(season: number, episode: number) => string` | Pure helper. Returns zero-padded key: `S01E01`. **Must be used at every write site** to prevent key format drift in the `episodes` map. |
| `computeShowStatus` | `(episodes: Record<string, EpisodeTracking>, totalEpisodeCount: number) => 'watching' \| 'unwatched' \| 'watched' \| null` | Pure helper. Returns `null` if no episodes are tracked (signals auto-untrack), `'watched'` only when every episode in the season is explicitly marked watched, `'unwatched'` when all explicitly-touched episodes are unwatched and none are watched, otherwise `'watching'`. Called after every episode save to cascade the parent show status. |

### `src/api/media/collections.ts` [NEW] — encrypted CRUD for `media_collections`
| Function | Signature | Purpose |
|---|---|---|
| `listCollections` | `(userId: string) => Promise<MediaCollection[]>` | Fetch + decrypt. |
| `createCollection` | `(userId: string, input: { name: string; description?: string }) => Promise<MediaCollection>` | Encrypt + insert. |
| `renameCollection` | `(userId: string, id: string, name: string) => Promise<MediaCollection>` | Encrypt + update. |
| `deleteCollection` | `(userId: string, id: string) => Promise<void>` | Deletes the collection row **and** calls `unlinkFromCollection` from `media.ts` in the same action. |

## Routing
| Route | Type | Purpose |
|---|---|---|
| `/media` | Page | Main tracker — fetches collections + media, decrypts, renders `MediaView`. (Contains Default, Collections, and Discover tabs). |
| `/media/collection/[id]` | Page | Dedicated "view all" route for one collection, uses `BackButton` + same hash-modal convention. |
| `/api/tmdb/search` | API route | Server-only TMDB search proxy. |
| `/api/tmdb/details` | API route | Server-only TMDB details proxy. |
| `/api/tmdb/discover` | API route | Server-only TMDB discover proxy (trending/popular). |
| `/api/tmdb/season` | API route | Server-only TMDB season proxy (episodes). |
| `#collection-[id]` | Hash modal | `CollectionModal` (create/rename/delete). |
| `/media/movie/[tmdb_id]` | Page | Dedicated page for a Movie. Fetches TMDB data + merges local tracking data. |
| `/media/tv/[tmdb_id]` | Page | Dedicated page for a TV Series (contains episode matrix). Fetches TMDB data + merges local tracking data. |
| `/media/tv/[tmdb_id]/episode/[season]/[episode]` | Page | Dedicated page for a single TV episode. |

`routes/paths.ts` gets `MEDIA` and `MEDIA_COLLECTION` entries; a dashboard tile is added matching the Task/Expense/Education pattern (using `violet` color scheme).

## UI Layout & Components
```
src/components/media/
├── MediaView.tsx              # Main orchestrator: owns tab state, fetches data, handles loading/errors
├── views/                     # The 3 core tabs of the Media Manager
│   ├── DefaultView.tsx        # Tracked Library (Watching/Not Watched/Watched lanes)
│   ├── CollectionView.tsx     # Grid of color-coded collections
│   └── DiscoverView.tsx       # Untracked TMDB search/trending browser
├── pages/                     # Dedicated detail pages
│   ├── MoviePage.tsx          # Movie details, form, collections, remove button
│   ├── TvSeriesPage.tsx       # TV details, season selector, episode matrix
│   ├── EpisodePage.tsx        # Single episode details, form, comments
│   └── CollectionDetailPage.tsx # Views all media for a specific collection ID
├── CollectionFilterBar.tsx    # Filter bar for DefaultView
├── CollectionModal.tsx        # Create / rename / delete a collection + color palette
├── MediaStatusSection.tsx     # One BoxContainer per status; groups + hands rows to a custom MediaGrid
├── MediaGrid.tsx              # CSS grid for media posters (does NOT reuse TileView)
├── MediaCard.tsx              # Media poster, title, quick status/rating controls only — no delete action on the card
└── TmdbAttribution.tsx         # Required TMDB ToS attribution footer

src/components/common/
└── StarRating.tsx              # New shared primitive (controlled: value, onChange, 1-5 range)
```
No new box, modal-shell, or auth-bootstrap component is written — everything above either renders through or wraps an existing shared component.

## Config Changes (blocking, not database-related)
| File | Change |
|---|---|
| `next.config.ts` | Add `image.tmdb.org` to `images.remotePatterns` |
| CSP header (`next.config.ts` `headers()`) | Add `https://image.tmdb.org` to `img-src` |
| `.env.local` / Vercel env | Add server-only `TMDB_API_KEY` (no `NEXT_PUBLIC_` prefix) |

## Edge Cases & How Each Is Tackled
| Edge case | Handling |
|---|---|
| Same title added twice | `findDuplicate()` checked client-side against decrypted in-memory list before `createMedia`; surfaces "Already in your tracker" instead of inserting. |
| Collection deleted while media still linked | `deleteCollection()` always calls `unlinkFromCollection()` in the same action — rows become uncategorized, never destroyed. |
| TMDB entry missing poster or overview | `MediaCard` and Dedicated Pages render a placeholder background and omit the overview line rather than showing a broken image. |
| Rapid keystrokes while searching TMDB | Search input debounced ~400ms in `DiscoverView` before calling `searchMedia`. |
| TMDB rate-limit / fetch failure | Proxy route returns a normal error status; client shows `ErrorBanner`, no silent failure. |
| User has zero collections | `CollectionFilterBar` shows only "All" + "＋ New Collection"; no group-by-collection UI is forced. |
| Status changed without opening full detail page | `MediaCard` exposes an inline status dropdown + `StarRating` calling `updateMedia` directly, bypassing the dedicated page. |
| Genre data needed later (roadmap) | `genre_ids` captured at add-time from the details call the app is already making — zero extra TMDB calls, no migration when roadmap phases consume it. |
| Tracking individual episodes | Stored as a nested map (`episodes`) inside the main `media` blob so it shares the same RLS row and avoids a complex relational schema. |
| Removing a tracked item from the library grid | **Not available on the card.** The "Remove from Tracker" action is intentionally absent from `MediaCard` — the user must navigate to the dedicated `MoviePage` or `TvSeriesPage` to untrack. This is a deliberate UX constraint to prevent accidental deletions from the grid. |
| Removing a tracked item from a dedicated page | `MoviePage` and `TvSeriesPage` expose a `[ Remove from Tracker ]` button in the tracking form panel, gated by `ConfirmDialog` (no 'X', backdrop = cancel). This is the **only** entry point for the delete action. Both call the same `deleteMedia` function. |
| Removing a TV show that has episode data | Deleting the parent `media` row deletes the entire encrypted blob including the nested `episodes` map — no orphaned rows possible (single-row design). Warning copy in `ConfirmDialog` must explicitly state that all episode progress is also permanently deleted. |
| Navigating to a dedicated page for an untracked item | The Two-Layer Merge finds no match in the local DB. The tracking panel renders in an "untracked" state: fields are blank/disabled, and the primary action is `[ + Start Tracking ]` instead of `[ Save Changes ]`. |

## TV Show Tracking — Episode Cascade State Machine

This section is mandatory reading for any agent implementing `TvSeriesPage`, `EpisodePage`, or `updateMedia`. It defines the auto-tracking and auto-untracking rules that keep the parent TV show's `status` consistent with the user's actual episode-level actions.

### Principle
A TV show row exists in the database **if and only if** the user has explicitly interacted with either (a) the show as a whole or (b) at least one of its episodes. Episode data is stored in the `episodes: Record<string, EpisodeTracking>` map inside the single parent `media` blob.

### Auto-Track: When Episode Interaction Creates the Parent Row
| Trigger | Action |
|---|---|
| User sets any episode status (`watching` / `unwatched` / `watched`) for the first time | If no parent `media` row exists, `createMedia` is called first with `status: 'watching'`, then the episode entry is written into the new row's `episodes` map. |
| User saves a rating or comment on an episode | Same as above — any write to an episode that has no parent row auto-creates the parent. |

### Parent Status Cascade Rules (runs after every episode update)
After every episode save, `computeShowStatus(episodes, totalEpisodeCount)` is called client-side and `updateMedia` is called to sync the parent's `status` field:

| Episode state | Computed parent `status` |
|---|---|
| Zero episodes tracked (no entries in map) | Parent row should not exist — if found, it is a stale row. |
| ≥1 episode marked `watched` or `watching`, rest untracked/`unwatched` | `watching` |
| All known episodes marked `watched` | `watched` |
| All known episodes marked `unwatched` (explicitly set, none yet `watched`) | `unwatched` |

> **Note:** "Total episode count" comes from the TMDB season data (`getSeasonDetails`), not from the local `episodes` map, which only contains episodes the user has explicitly touched. This prevents half-watched seasons from incorrectly computing as `watched`.

### Auto-Untrack: When Removing All Episode Data
| Trigger | Action |
|---|---|
| User removes status from the last tracked episode (sets back to untracked / never-touched state) | `deleteMedia` is called on the parent row — the show disappears from the library entirely. No confirmation dialog is needed for this automatic cleanup (it is purely state-driven, not a user-initiated delete). |
| User explicitly clicks "Remove from Tracker" on the parent show page | `deleteMedia` deletes the entire row including all `episodes` data. `ConfirmDialog` must warn: "This will permanently remove all episode progress, ratings, and comments for this show." |

### Edge Cases
| Edge case | Handling |
|---|---|
| User sets episode status on show that already has a parent row with `status: watched` | Episode update runs, then `computeShowStatus` re-evaluates and may downgrade parent to `watching` if not all episodes are done. |
| Returning series: TMDB adds new episodes after user marked show as `watched` | On next view of the TV page, TMDB season data is fetched live. New episodes are not in the local `episodes` map, so `computeShowStatus` sees them as untracked and will recalculate parent to `watching`. |
| User manually changes parent show `status` to `watched` without touching episodes | Allowed — the parent status dropdown on `TvSeriesPage` is always editable. Episode statuses are NOT auto-updated to match. The two can diverge; the parent `status` is the canonical library-view status. |
| User rates/comments on a specific episode without setting its status | This still triggers auto-create of the parent row (if missing) with `status: 'watching'`. A rating alone constitutes interaction. |
| User tries to access `EpisodePage` for a show not yet in their tracker | The page loads fine — it is TMDB-data-driven. The tracking form is in blank/unset state. On first save of any field, the parent row is auto-created first. |
| `episodes` map key format collision | Keys are always `S{season}E{episode}` zero-padded to 2 digits: `S01E01`. This is enforced at write time by a `formatEpisodeKey(season, episode)` pure helper to prevent format drift. |

## Phases & Tasks

### Phase 1 — Types, Schema, TMDB Proxy
- **1.1** Define `Media`, `MediaCollection` types + Plaintext counterparts in `src/types/media.ts`
- **1.2** Build `/api/tmdb/search` and `/api/tmdb/details` routes using `getAuthenticatedUserId()`
- **1.3** Build `src/api/media/media.ts`, `collections.ts` encrypted CRUD, and `tmdb.ts` client wrappers

### Phase 2 — Collections
- **2.1** `CollectionFilterBar` + `CollectionModal` (create/rename/delete with non-destructive unlink, includes color tag picker)

### Phase 3 — Core Tracker UI & Views
- **3.1** `StarRating` (common)
- **3.2** `MediaGrid` and `MediaCard` implementation (custom grid, does not reuse TileView)
- **3.3** `MediaView` (Orchestrator), `DefaultView` (Watching/Not Watched/Watched lanes with `MediaStatusSection` grouping) + Top Search Bar + Sort/Filter controls (A-Z, Recently Added, Rating, Types)
- **3.4** `CollectionView` (Grid of collections)
- **3.5** `DiscoverView` (TMDB trending/search layout)
- **3.6** `TmdbAttribution` footer

### Phase 4 — Dedicated Detail Pages & Routing
- **4.1** `MoviePage` (Details, TMDB description, rating, comments, watched_on, collection indicators & assignment, remove button)
- **4.2** `TvSeriesPage` (Details, season selector, episode matrix/thumbnails, collection indicators & assignment, remove button)
- **4.3** `EpisodePage` (Dedicated page per episode: thumbnail, name, description, rating, comments, watched_on)
- **4.4** Next.js routing: `/media` (with 3 view tabs), `/media/collection/[id]`, `/media/movie/[tmdb_id]`, `/media/tv/[tmdb_id]`, `/media/tv/[tmdb_id]/episode/[season]/[episode]`
- **4.5** `routes/paths.ts` entries + dashboard tile

### Phase 5 — Config & Polish
- **5.1** `next.config.ts` `remotePatterns` + CSP `img-src` update
- **5.2** Debounced search, duplicate-add guard, poster/overview fallback states
- **5.3** Loading/error states via `ErrorBanner`, responsive pass (mobile 2-across, desktop 4/5-across)
- **5.4** Fix hardcoded TMDB image URL in `MediaHeroSection` by utilizing `tmdbPosterUrl`.
- **5.5** Extend `StatusChipGroup` with an `isUntracked` prop and use it in `EpisodePage` to eliminate duplicate form logic.
- **5.6** Extend `UntrackConfirmation` to support `"episode"` media type and replace the inline `ConfirmDialog` in `EpisodePage`.

## Roadmap (named, deferred — each names the new infrastructure it needs)
| Phase | Feature | New infra required | Recommendation |
|---|---|---|---|
| 6 | Movies/TV split pages + filters/sort | None — client-side filter/sort over already-decrypted data | Build anytime after MVP |
| 7 | Favorites, rewatch count | None | Build anytime after MVP |
| 8 | Smart search (actors/directors) | One more proxy route (`/api/tmdb/search-person`), same auth pattern | Cheap, no blockers |
| 9 | Genre-affinity recommendations | New `/api/tmdb/discover` proxy, cached per `(genre_id, page)` via Next.js `revalidate` (~12h) | Genre-tally algorithm is client-side; no per-user cache needed |
| 10 | Statistics | Client-side `O(n)` reduce over already-decrypted list; needs `runtime`, `director`, `watched_at` fields (captured free via `append_to_response=credits` on the existing details call) | Compute lazily, only when Statistics view opens |
| 11 | Calendar / release notifications | Requires a cron job + notification delivery (email/push) — neither exists in the app yet | Defer indefinitely, or descope to a notification-free "upcoming releases" list (zero new infra) |

## UI Wireframes (ASCII)

### 1. Route: `/media` (Tab: Default View)
```text
+-----------------------------------------------------------------------------+
| MEDIA TRACKER                             [ Search local library... 🔍 ]    |
|                                                                             |
| [ Default View ]  [ Collections ]  [ Discover ]                             |
+-----------------------------------------------------------------------------+
| Filters: [ All Collections ▼ ]  [ Movies & TV ▼ ]   Sort: [ Date Added ▼ ]  |
+-----------------------------------------------------------------------------+
| WATCHING (2)                                                                |
| +-----------------+  +-----------------+                                    |
| |  🔴 Favorites   |  |  🔵 Sci-Fi      |                                    |
| |     [POSTER]    |  |     [POSTER]    |                                    |
| |  Breaking Bad   |  |  Dune: Part 2   |                                    |
| |  2008 • TV      |  |  2024 • Movie   |                                    |
| +-----------------+  +-----------------+                                    |
|  [Watching ▼] ★★★☆☆   [Watching ▼] ★★★★★                                    |
+-----------------------------------------------------------------------------+
| NOT WATCHED (3)                                                             |
| +-----------------+  +-----------------+  +-----------------+               |
| |     [POSTER]    |  |     [POSTER]    |  |     [POSTER]    |               |
| |  Deadpool & W   |  |  LOTR           |  |  Inception      |               |
| |  2024 • Movie   |  |  2001 • Movie   |  |  2010 • Movie   |               |
| +-----------------+  +-----------------+  +-----------------+               |
|  [Not Watched ▼]      [Not Watched ▼]      [Not Watched ▼]                  |
+-----------------------------------------------------------------------------+
```

### 2. Route: `/media` (Tab: Collections)
```text
+-----------------------------------------------------------------------------+
| MEDIA TRACKER                             [ Search local library... 🔍 ]    |
|                                                                             |
| [ Default View ]  [ Collections ]  [ Discover ]                             |
+-----------------------------------------------------------------------------+
|                                                      [ + New Collection ]   |
|                                                                             |
| +--------------------------+  +--------------------------+                  |
| | 🔴 Favorites             |  | 🔵 Sci-Fi                |                  |
| | 12 Items                 |  | 5 Items                  |                  |
| | "My all-time top picks"  |  | "Space and time travel"  |                  |
| +--------------------------+  +--------------------------+                  |
+-----------------------------------------------------------------------------+
```

### 3. Route: `/media/discover` (Tab: Discover)
```text
+-----------------------------------------------------------------------------+
| MEDIA TRACKER                             [ Search local library... 🔍 ]    |
|                                                                             |
| [ Default View ]  [ Collections ]  [ Discover ]                             |
+-----------------------------------------------------------------------------+
| [ Search TMDB for Movies, TV, or People...                           🔍 ]   |
|                                                                             |
| Categories: [ Action ] [ Comedy ] [ Drama ] [ Sci-Fi ]                      |
|                                                                             |
| Trending / Popular                                                          |
+-----------------------------------------------------------------------------+
| +-----------------+  +-----------------+  +-----------------+               |
| |     [POSTER]    |  |     [POSTER]    |  |     [POSTER]    |               |
| |  Inside Out 2   |  |  Fallout        |  |  Shogun         |               |
| |  2024           |  |  2024           |  |  2024           |               |
| |  "Teen Riley..."|  |  "In a future.."|  |  "When a..."    |               |
| +-----------------+  +-----------------+  +-----------------+               |
|   [+ Track Movie ]     [ + Track TV ]       [ + Track TV ]                  |
+-----------------------------------------------------------------------------+
*(Note: Clicking '+ Track' immediately navigates to the dedicated page for the item where the user can pick Status, Rating, and Collection).*
```

### 4. Route: `/media/movie/[tmdb_id]` (Dedicated Movie Page)
```text
+-----------------------------------------------------------------------------+
| < Back to Library                                                           |
+-----------------------------------------------------------------------------+
| +---------------+  DUNE: PART TWO (2024)                                    |
| |               |  Action, Adventure, Sci-Fi  |  Runtime: 166m              |
| |               |                                                           |
| |   [POSTER]    |  "Explore the mythic journey of Paul Atreides as he..."   |
| |               |                                                           |
| |               |  +------------------------------------------------------+ |
| |               |  | STATUS:     [ Watched ▼ ]                            | |
| +---------------+  | RATING:     [ ★★★★★ ]                                | |
|                    | WATCHED ON: [ 📅 May 14, 2026 ]                      | |
|                    | COLLECTION: [ 🔵 Sci-Fi ▼ ]                          | |
|                    | COMMENTS:   [ Best movie of the year...            ] | |
|                    |                                                      | |
|                    |                      [ Save ] [ Remove from Tracker] | |
|                    +------------------------------------------------------+ |
+-----------------------------------------------------------------------------+
```

### 5. Route: `/media/tv/[id]` (Dedicated TV Series Page)
```text
+-----------------------------------------------------------------------------+
| < Back to Library                                                           |
+-----------------------------------------------------------------------------+
| +---------------+  BREAKING BAD (2008 - 2013)                               |
| |               |  Crime, Drama  |  Status: Ended                           |
| |   [POSTER]    |                                                           |
| |               |  +------------------------------------------------------+ |
| |               |  | OVERALL STATUS: [ Watching ▼ ]                       | |
| +---------------+  | COLLECTION:     [ 🔴 Favorites ▼ ]                   | |
|                    |                            [ Remove from Tracker ]   | |
|                    +------------------------------------------------------+ |
+-----------------------------------------------------------------------------+
| EPISODES MATRIX                                    [ Season 1 ▼ ]           |
+-----------------------------------------------------------------------------+
| +---------------+  1. Pilot                                                 |
| |  [THUMBNAIL]  |  Aired: Jan 20, 2008                                      |
| +---------------+  Status: [ Watched ▼ ]  Rating: [★★★★☆]  Date: [📅]       |
|                    Comments: [ "Great start to the series..."           ]   |
|                    [ View Full Episode Page ↗ ]                             |
+-----------------------------------------------------------------------------+
| +---------------+  2. Cat's in the Bag...                                   |
| |  [THUMBNAIL]  |  Aired: Jan 27, 2008                                      |
| +---------------+  Status: [ Not Watched ▼ ]  Rating: [☆☆☆☆☆]  Date: [📅]   |
|                    Comments: [ "Click to add comment"                   ]   |
|                    [ View Full Episode Page ↗ ]                             |
+-----------------------------------------------------------------------------+
```

### 6. Route: `/media/tv/[tmdb_id]/episode/[season]/[episode]` (Episode Page)
```text
+-----------------------------------------------------------------------------+
| < Back to Breaking Bad (Season 1)                                           |
+-----------------------------------------------------------------------------+
| +-------------------------------------------------------------------------+ |
| |                                                                         | |
| |                               [LARGE WIDESCREEN EPISODE THUMBNAIL]      | |
| |                                                                         | |
| +-------------------------------------------------------------------------+ |
|                                                                             |
|  SEASON 1, EPISODE 1                                                        |
|  PILOT                                                                      |
|  Aired: Jan 20, 2008                                                        |
|                                                                             |
|  "When an unassuming high school chemistry teacher discovers he has..."     |
|                                                                             |
|  +------------------------------------------------------------------------+ |
|  | STATUS:     [ Watched ▼ ]                                              | |
|  | RATING:     [ ★★★★☆ ]                                                  | |
|  | WATCHED ON: [ 📅 Jan 21, 2008 ]                                        | |
|  | COMMENTS:   [ "The pants flying in the air was iconic..."            ] | |
|  |                                                                        | |
|  |                                                        [ Save Changes ]| |
|  +------------------------------------------------------------------------+ |
+-----------------------------------------------------------------------------+
```

## Verification Plan
- [ ] Searching TMDB never exposes an API key in the browser network tab (request goes to `/api/tmdb/search`, not `api.themoviedb.org`).
- [ ] Adding the same title twice surfaces "already in your tracker" instead of creating a duplicate row.
- [ ] Deleting a collection unlinks (not deletes) its media; those items show as uncategorized.
- [ ] Moving a card between Watching/Unwatched/Watched updates instantly without opening the full detail page.
- [ ] Star rating is editable inline from the card and from the dedicated page.
- [ ] TMDB attribution notice is visible on the page.
- [ ] Posters load via `next/image` without CSP or remote-pattern console errors.
- [ ] `/media/collection/[id]` loads independently and Back returns to `/media`.
- [ ] Collection modals are deep-linkable via hash and survive a page refresh.
- [ ] Missing poster/overview renders a graceful fallback, not a broken image.
- [ ] Mobile layout collapses the grid responsively with no horizontal scroll.
- [ ] MediaHeroSection uses `tmdbPosterUrl` instead of a hardcoded string.
- [ ] EpisodePage uses `StatusChipGroup` instead of inline buttons.
- [ ] EpisodePage uses `UntrackConfirmation` instead of inline `ConfirmDialog`.


## Implementation Report & Solved Complexities

During the implementation phase (culminating in the current stable MVP), several complex architectural and UX challenges were encountered and successfully resolved:

### 1. Advanced State Management in Discover View
- **Stale Query Prevention:** Implemented `AbortController` to gracefully cancel in-flight TMDB API requests when the user rapidly changes filters or types in the search bar. This prevents race conditions where an older, slower query resolves after a newer query and overwrites the UI.
- **Debouncing:** Integrated a robust 400ms debounce on the search input using `setTimeout` and `useRef` to prevent hammering the TMDB API and to respect rate limits.
- **Infinite Scrolling Reliability:** Built a resilient `IntersectionObserver` for infinite scrolling that carefully tracks `pageRef`, `loadingRef`, and `totalPagesRef`. It explicitly respects TMDB's hard limit (`TMDB_MAX_PAGE` = 500) and prevents duplicate fetches when intersecting multiple times quickly.

### 2. TMDB Proxy & Networking Architecture
- **Secure Token Gating:** Ensured the `TMDB_API_KEY` (JWT) is strictly kept server-side. All TMDB calls are routed through our internal proxies (`/api/tmdb/*`), which first enforce session validity via `getAuthenticatedUserId()`.
- **Timeout & CORS Mitigation:** By offloading the actual TMDB fetch to the Next.js server route, we bypassed browser-level CORS issues and client-side network timeouts, providing a more stable fetching environment.

### 3. "Two-Layer Merge" Strategy
- **On-the-fly Hydration:** We successfully implemented the pattern where dedicated media pages (`MoviePage`, `TvSeriesPage`) fetch lightweight tracking data from our encrypted DB and merge it over the heavy metadata fetched live from TMDB. This keeps our database extremely lean, as we only store what is strictly necessary (status, rating, notes, episodes).

### 4. Responsive UI & Fallbacks
- **Mobile Filter Bar:** To handle the complex array of filters (Type, Sort, Genre, Era, Region, Animation) on small screens, a horizontally scrollable tab-bar was implemented with absolute-positioned dropdown popovers, solving screen clutter without sacrificing functionality.
- **Graceful Fallbacks:** Built robust checks into `MediaCard` and Detail pages to render styled placeholders when TMDB returns null for `poster_path` or `overview`, completely eliminating broken image links.

---

## Impromptu Changes & Additions
During implementation, several impromptu enhancements were made to the media pages, deviating from the original plan for a better UX:
- **Collection Detail Page as an Inline Editor**: Instead of a separate modal for editing collections, `CollectionDetailPage.tsx` acts as both a viewer and an inline editor. Users can change the collection name, description, and theme, and reorder media without leaving the page. Staging (pending adds and removes) is used before a final "Save".
- **Drag-and-Drop Sorting**: Implemented manual reordering of media items within a collection using `@dnd-kit/core` and `@dnd-kit/sortable`.
- **In-Page "Add Media" Modal**: A modal search (`AddMediaModal` with `AddMediaTile`) allows users to search TMDB and add media directly from within the collection page.
- **High-Fidelity Theme System**: Replaced simple color tags with 20 curated themes via `ThemePicker`. 

## Theme System (Overhaul)
The application includes a comprehensive high-fidelity theme system with 20 distinct themes:

### Asset-Backed Organic Themes
- **theme:galaxy**: Background image with a subtle inset shadow for text readability.
- **theme:magma**: Background image, keeping the progress bar glowing orange/red.
- **theme:velvet**: Background image, zero borders, heavy external drop-shadow to emphasize fabric texture.
- **theme:abyss**: Background image, bright cyan/blue typography and progress bar.
- **theme:ember**: Background image, harsh orange progress fill against dark embers.

### Pure Advanced CSS Themes
Meticulously engineered using pure CSS math and gradients.
- **theme:glass**: True physical glassmorphism (`backdropFilter: blur`, `rgba` background).
- **theme:cyberpunk**: Thick neon pink/cyan borders, sharp geometric drop-shadows, linear-grid background.
- **theme:matrix**: Falling digital rain keyframe animation over a black background.
- **theme:gold**, **theme:silver**, **theme:bronze**, **theme:rose-gold**: Multi-stop linear gradients with inset top shadows.
- **theme:obsidian**: Diagonal dark gradient with a harsh 1px solid white inset shadow on top.
- **theme:sunset**: Giant radial glow anchored to the bottom edge.
- **theme:blood-moon**: Harsh red radial circle off-center against pitch black.
- **theme:amethyst**, **theme:ruby**: Conic-gradients simulating faceted 3D cuts.
- **theme:first-crush**: Overlapping, off-center pastel radial gradients.
- **theme:inferno**: Sharp, high-speed diagonal slashes in bright orange and deep red.
- **theme:iridescent**: Smooth, pastel multi-stop linear gradient shifting colors.

---

# Human Actions: Media Manager Domain

**Paired with**: `docs/plans/mediamanager.md`
**Date**: 2026-07-15

This document outlines the exact, granular manual steps you (the human) must take to prepare the environment so the AI agent can successfully implement the Media Manager plan.

> [!IMPORTANT]
> **ALL steps below must be completed BEFORE the agent begins Phase 1 of the implementation plan.** The agent cannot proceed without the database tables existing and the TMDB API key being active.

---

## HA-01: Create Supabase Tables and Security Policies
* **When**: Before starting Phase 1.
* **Where**: Supabase Dashboard -> SQL Editor
* **Why**: The agent does not have access to your Supabase dashboard or the ability to run raw SQL migrations.

**Steps:**
1. Open your [Supabase Dashboard](https://supabase.com/dashboard) and select your project.
2. Navigate to the **SQL Editor** on the left sidebar.
3. Click **New Query**.
4. Copy the following SQL block exactly as written:

```sql
-- 1. Create Media Collections Table
CREATE TABLE public.media_collections (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    iv text NOT NULL,
    data text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 2. Create Media Table
CREATE TABLE public.media (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    iv text NOT NULL,
    data text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.media_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies (Users can only access their own data)
CREATE POLICY "Users can manage their own media_collections" ON public.media_collections
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own media" ON public.media
    FOR ALL USING (auth.uid() = user_id);
```

5. Click the **Run** button (or press `Cmd/Ctrl + Enter`).
6. Verify the query executed successfully with no errors.

---

## HA-02: Register for a TMDB API Key
* **When**: Before starting Phase 1.
* **Where**: [The Movie Database (TMDB) Website](https://www.themoviedb.org/)
* **Why**: The agent needs to call TMDB to search for movies/TV shows, and this requires a personal developer API key.

**Granular Steps:**
1. Go to [https://www.themoviedb.org/signup](https://www.themoviedb.org/signup) and create a free account.
2. Verify your email address by clicking the link TMDB sends you.
3. Log into TMDB.
4. Click on your **Profile icon** (top right) and select **Settings** from the dropdown menu.
5. In the left sidebar of your Settings page, click on **API**.
6. Under the "Request an API Key" section, click the **Create** or **Click Here** link.
7. Select **Developer** as your key type.
8. Scroll through and accept the API Terms of Use.
9. **Fill out the application form.** TMDB requires some basic info. You can use these examples:
   - **Application Name**: `Personal Tracker App`
   - **Application URL**: `http://localhost:3000` (or your actual Vercel domain if you have one)
   - **Application Summary**: `A personal, self-hosted web app to privately track my own movie and TV show watching habits. Not for public commercial use.`
   - Fill in your standard contact information for the remaining fields.
10. Click **Submit**.
11. You will be redirected back to the API settings page. Under the **API Keys** section, locate the **API Key (v3 auth)**. It is a long string of letters and numbers. **Copy this key.**

---

## HA-03: Configure Environment Variables
* **When**: Immediately after completing HA-02, before Phase 1.
* **Where**: Local codebase (`.env.local`) and Production (Vercel)
* **Why**: The Next.js API routes need this key injected securely.

**Steps for Local Development:**
1. Open the file `e:\Projects\personal_tracker\.env.local` in your editor.
2. Add the following line at the bottom of the file (replace `YOUR_COPIED_KEY_HERE` with the actual key from Step 11 above):

```env
TMDB_API_KEY=YOUR_COPIED_KEY_HERE
```
*(Note: Do **NOT** prefix this with `NEXT_PUBLIC_`. It must remain secret on the server.)*
3. Save the file.
4. If your local Next.js development server is currently running, restart it (`Ctrl+C` then `npm run dev`) so it picks up the new variable.

**Steps for Production (Vercel):**
1. Go to your Vercel Dashboard and select this project.
2. Navigate to **Settings** > **Environment Variables**.
3. Create a new variable:
   - **Key**: `TMDB_API_KEY`
   - **Value**: `YOUR_COPIED_KEY_HERE`
4. Click **Save**.
5. *Note: For the production change to take effect, you will need to trigger a new Vercel deployment after the agent finishes its code changes.*

---

# Phase 6 — Season Tracker, TV State Machine Hardening & New-Season UX

**Date**: 2026-08-16  
**Status**: Approved — Awaiting Implementation  
**Scope**: Strictly scoped to media tracking logic. Nothing outside `/media` is touched.

---

## Overview

Three interlocked problems are solved in a single coordinated refactor:

1. **TV Show State Control** — Enforce strict bidirectional consistency between the parent show's status and its episode records. Introduce clear rules for what happens when the user forces any top-level status.
2. **Season Tracker** — Add a `seasons` tracking layer between show and episodes. Season status is displayed in the sidebar, settable independently, and affects how the parent show's status is computed.
3. **New-Season UX** — When a currently-"watched" show gains a new season on TMDB, automatically downgrade the show to "watching" on page load and surface a "New Season" badge.

### Non-Goals (explicitly out of scope)
- No changes to Movies, Collections, Discover, Vault, any other domain
- No new DB tables or Supabase migrations (blob field additions only)
- No changes to: `MediaView`, `DefaultView`, `CollectionView`, `MediaCard`, `MediaGrid`, `useMediaTracking`, `GenericMediaPage`, `MediaHeroSection`, `StatusChipGroup`, `CollectionPicker`, `ReviewSection`, `StickyActionBar`, `useNavigationGuard`, `useTmdbRetry`, any auth/crypto/storage code

> **Phase 6 boundary amendment (2026-08-16)**: the grid-level "New Season" badge intentionally crosses the original boundary — it touches `MediaCard`, `BaseMediaCard`, `SortableMediaItem`, `SortableMediaGrid`, `DefaultView`, `DiscoverView`, `CollectionDetailPage`, `NewCollectionPage`, and `AddMediaModal` (see Stage 11 progress). The spirit of the boundary holds: the cards stay passive and synchronous — all fetching is hoisted into the grid-level `useNewSeasonChecks` hook.

---

## Architectural Decision: Data Model (Option B — Nested Seasons)

The existing flat `episodes: Record<"S01E01", EpisodeTracking>` map inside `MediaPlaintext` is replaced with a nested structure:

```typescript
seasons?: Record<string, SeasonTracking>   // "S01", "S02" …
```

Where:

```typescript
interface SeasonTracking {
  status?: "watching" | "unwatched" | "watched"; // explicit per-season override
  episodes?: Record<string, EpisodeTracking>;     // "E01", "E02" … (episode-only key)
}
```

The old `EpisodeTracking` type is unchanged:

```typescript
interface EpisodeTracking {
  status: "watching" | "unwatched" | "watched";
  rating?: number;
  review_notes?: string;
  watched_on?: string;
}
```

Two new fields added to `MediaPlaintext`:

```typescript
tracked_season_count?: number;   // The number_of_seasons stored when show was last saved as "watched". Used for new-season detection.
total_seasons?: number;           // Total seasons per TMDB at last tracking save. Used by computeProgress for TV.
```

The old `episodes` field is kept as a **deprecated optional field** in the TypeScript type solely to allow the read-time migration to detect it. It is never written after Phase 6.

### Client-Side Migration (Read Path Only)

In `listMedia` and `getMediaByTmdbId`, after decrypting each row, if `raw.episodes` is present and `raw.seasons` is absent, the data is migrated in-memory before being returned:

```typescript
function migrateEpisodeData(
  oldEpisodes: Record<string, EpisodeTracking>
): Record<string, SeasonTracking> {
  const seasons: Record<string, SeasonTracking> = {};
  for (const key of Object.keys(oldEpisodes)) {
    const match = key.match(/^S(\d+)E(\d+)$/);
    if (!match) continue;
    const seasonKey = `S${match[1]}`;
    const episodeKey = `E${match[2]}`;
    if (!seasons[seasonKey]) seasons[seasonKey] = {};
    if (!seasons[seasonKey].episodes) seasons[seasonKey].episodes = {};
    seasons[seasonKey].episodes![episodeKey] = oldEpisodes[key];
  }
  return seasons;
}
```

This migration is **read-only** — it does not auto-save. The old `episodes` field in the DB remains until the user next saves something, at which point `updateMedia` will serialize the new `seasons` field (and omit the old `episodes` field entirely). This is safe because the migration runs consistently on every read until the save happens.

### New Key Format Helpers

```typescript
// "S01" — used for seasons map key
export function formatSeasonKey(season: number): string {
  return `S${String(season).padStart(2, "0")}`;
}

// "E01" — used for episodes key INSIDE a season
export function formatEpisodeKeyShort(episode: number): string {
  return `E${String(episode).padStart(2, "0")}`;
}

// formatEpisodeKey(season, episode) is KEPT for backward compatibility
// in EpisodePage and anywhere that still constructs the old "S01E01" format.
// It internally now means: use formatSeasonKey + formatEpisodeKeyShort together.
```

---

## Exhaustive Scenario Matrix

### A. Show-Level Status Overrides (Top-Down)

When the user clicks a status chip on the "Media Tracker" tab of the TV series page and confirms via the conflict dialog:

| User Action | Condition | Behavior |
|---|---|---|
| Force show → `"watched"` | No episode/season records | Parent saved as "watched". All episodes/seasons are virtual-watched. `tracked_season_count` updated to current TMDB `number_of_seasons`. |
| Force show → `"watched"` | Has episode records (any status) | **Conflict dialog**: "This will clear X tracked episode records." On confirm: all `seasons` map entries deleted, parent saved as "watched". `tracked_season_count` set. All episodes/seasons become virtual-watched. |
| Force show → `"unwatched"` | No episode/season records | Parent saved as "unwatched". All episodes/seasons are virtual-unwatched. |
| Force show → `"unwatched"` | Has episode records (any status) | **Conflict dialog** shown. On confirm: all `seasons` map entries deleted, parent saved as "unwatched". All episodes/seasons become virtual-unwatched. |
| Force show → `"watching"` | No episode/season records | No conflict. Parent saved as "watching". S01E01 shows virtual-watching, all others virtual-unwatched. |
| Force show → `"watching"` | Has "unwatched" or "watching" records only | No conflict (no "watched" records contradict). Parent saved as "watching". |
| Force show → `"watching"` | Has "watched" episode/season records | **Conflict dialog**: "This will clear X watched episode records." On confirm: any explicitly `"watched"` episode records deleted, any `"watched"` season overrides deleted, parent saved as "watching". |

### B. Episode-Level Actions (Bottom-Up Cascade)

When the user saves an episode in `EpisodePage`:

| Episode Action | Parent State | Result |
|---|---|---|
| Save episode (any status) | Show not yet in DB | Auto-create parent with `status: "watching"`. Episode written to `seasons.S{n}.episodes.E{n}`. |
| Save episode → `"watched"` | Season or Show "unwatched" | Season and Show auto-bubble to `"watching"`. |
| Save episode → `"watched"`, it's the last untracked episode in season | Season "watching" | Season auto-promotes to `"watched"`. Check Show promotion. |
| Save episode → `"watched"`, it's the last untracked episode in show | Show "watching" | Show auto-promotes to `"watched"`. `tracked_season_count` is set. |
| Save episode → `"watching"` | Season or Show "unwatched" | Season and Show auto-bubble to `"watching"`. |
| Save episode → `"watching"` | Season or Show "watched" | **Breaks the umbrella invariant**. Season and Show downgraded to `"watching"`. |
| Save episode → `"unwatched"` | Season or Show "watched" | **Breaks the umbrella invariant**. Season and Show downgraded to `"watching"`. |
| Delete episode record (last in season) | Varies | Season status recalculated. If 0 episodes remain in that season, season entry removed via `pruneEmptySeasons`. Show status recalculated from remaining seasons. |
| Delete episode record (last in entire show) | Anything | `computeShowStatusFromSeasons` returns `null`. Per existing design: parent status is NOT auto-changed (show preserves its umbrella). |

### C. Season-Level Overrides (Mid-Tier)

When the user clicks a status on a season in the sidebar:

| Season Action | Condition | Result |
|---|---|---|
| Force season → `"watched"` | No episode records | Season `status` set to `"watched"`. All episodes in that season become virtual-watched. Show status recalculated. |
| Force season → `"watched"` | Has conflicting episode records | **Season-scoped conflict dialog**. On confirm: `seasons.S{n}.episodes` cleared, `seasons.S{n}.status = "watched"`. Show status recalculated. |
| Force season → `"unwatched"` | No episode records | No conflict. Season `status` set to `"unwatched"`. All episodes in season become virtual-unwatched. Show status recalculated. |
| Force season → `"unwatched"` | Has episode records | **Season-scoped conflict dialog**. On confirm: `seasons.S{n}.episodes` cleared, `seasons.S{n}.status = "unwatched"`. Show status recalculated. |
| Force season → `"watching"` | No records | Season `status = "watching"`. Show becomes at least "watching". |
| Force season → `"watching"` | Has "unwatched" or "watching" records only | No conflict (no "watched" records contradict). Season `status = "watching"`. Show status recalculated. |
| Force season → `"watching"` | Has "watched" episode records | **Conflict dialog** for that season. On confirm: watched episode records deleted, season `status = "watching"`. |

### D. Show Status Computation from Seasons (Bottom-Up)

```
computeShowStatusFromSeasons(seasons, totalSeasonCount, seasonEpisodeCounts):
  entries = Object.values(seasons)
  if entries.length === 0: return null  (no interaction at all)
  
  effectiveStatuses = Object.keys(seasons).map(seasonKey => {
    return effectiveSeasonStatus(seasons[seasonKey], seasonEpisodeCounts[seasonKey] ?? 0)
  })
  
  if ALL effective statuses === "watched" AND entries.length >= totalSeasonCount: return "watched"
  if ALL effective statuses === "unwatched": return "unwatched"
  return "watching"
```

```
effectiveSeasonStatus(season, totalEpsInSeason):
  if season.status is set explicitly: return season.status
  computed = computeSeasonStatus(season.episodes, totalEpsInSeason)
  return computed ?? "unwatched"
```

```
computeSeasonStatus(episodes, totalEpsInSeason):
  entries = Object.values(episodes ?? {})
  if entries.length === 0: return null
  if entries.length >= totalEpsInSeason AND totalEpsInSeason > 0 AND all === "watched": return "watched"
  if all === "unwatched" AND none === "watched": return "unwatched"
  return "watching"
```

### E. Virtual Episode Status (Three-Layer Inheritance)

```
getEffectiveEpisodeStatus(parentStatus, seasonStatus, epStatus, isFirstEpisodeOfShow):
  if epStatus is defined: return { status: epStatus, isVirtual: false }
  
  // Explicit season override takes priority over parent
  if seasonStatus === "watched": return { status: "watched", isVirtual: true }
  if seasonStatus === "unwatched": return { status: "unwatched", isVirtual: true }
  
  // Fall back to parent show status
  if parentStatus === "watched": return { status: "watched", isVirtual: true }
  if parentStatus === "watching" AND isFirstEpisodeOfShow:
    return { status: "watching", isVirtual: true }
  
  return { status: "unwatched", isVirtual: true }
```

> **Note on S01E01 virtual-watching**: The `isFirstEpisodeOfShow` flag is `true` only for S01E01 (i.e., `seasonNumber === 1 && episodeNumber === 1`) when the parent is "watching" and no explicit records exist. This is passed from the episode matrix render in `TvSeriesPageWrapper`. It signals to the user: "you're currently on episode 1 — this is where you are." If the user has ANY explicit episode record, this flag has no effect (the explicit record wins).

### F. New Season Detection (With Backfill)

When `TvSeriesPageWrapper.handleTmdbReady()` fires with fresh TMDB data:

```
if (localMedia exists AND localMedia.status === "watched"):
  tmdbCount = tmdbData.number_of_seasons
  localCount = localMedia.tracked_season_count
  
  if (localCount === undefined):
    // BACKFILL: Pre-existing watched show prior to this feature.
    // Set the baseline silently. No badge, no downgrade.
    await updateMedia(..., { tracked_season_count: tmdbCount })
    
  else if (tmdbCount > localCount):
    // TRUE NEW SEASON: Auto-downgrade.
    await updateMedia(userId, localMedia.id, {
      status: "watching",
      tracked_season_count: tmdbCount,
    });
    // Update local state to reflect downgrade
    setLocalStatus("watching");
    // Mark new seasons (numbers > old tracked_season_count) with a "NEW" badge in UI
```

This fires **once per page load** if conditions are met and saves immediately and silently (no user action required). The badge stays on new season numbers in the sidebar for the duration of the session.

### G. Season-Aware Collection Progress

`computeProgress(items: Media[])` in `utils.ts` is updated for TV shows:

For each `item` in the collection:
- If `item.type === "movie"` OR `item.seasons` is absent: existing logic (status-based, unchanged)
- If `item.type === "tv"` AND `item.seasons` is present AND `item.total_seasons > 0`:
  - Per-season runtime estimate: `runtimePerSeason = (item.runtime ?? 0) / item.total_seasons`
  - Count `watchedSeasons` where effective season status = "watched"
  - Count `watchingSeasons` where effective season status = "watching"
  - `watchedMins += watchedSeasons * runtimePerSeason`
  - `watchedMins += watchingSeasons * runtimePerSeason * 0.5`
  - `totalMins += item.runtime ?? 0`
- `total_seasons` is stored in the blob when `createMedia` or `updateMedia` is called from `GenericMediaPage.handleSave` for TV type (sourced from `tmdbData.number_of_seasons`).

---

## Files to Change

| File | Change Type | What Changes |
|---|---|---|
| `src/types/media.ts` | **MODIFY** | Add `SeasonTracking` interface. Update `MediaPlaintext`: add `seasons`, `tracked_season_count`, `total_seasons`. Update `TmdbDetails`: add `seasons: { season_number: number; episode_count: number }[]`. |
| `src/app/api/tmdb/details/route.ts` | **MODIFY** | Extract `seasons` array from TMDB response and map `{ season_number, episode_count }` into the returned proxy payload. |
| `src/api/media/media.ts` | **MODIFY** | Add `migrateEpisodeData()`, `formatSeasonKey()`, `formatEpisodeKeyShort()`, `computeSeasonStatus()`, `computeShowStatusFromSeasons()`, and `pruneEmptySeasons()`. Update `getEffectiveEpisodeStatus` (new params: `seasonStatus`, `isFirstEpisodeOfShow`). Update `listMedia` and `getMediaByTmdbId` read paths to run migration. |
| `src/api/media/index.ts` | **MODIFY** | Export new helpers. |
| `src/components/media/pages/EpisodePage.tsx` | **MODIFY** | Update episode reads to nested `seasons`. Build `seasons` patches. Replace `computeShowStatus` with `computeShowStatusFromSeasons` (building `seasonEpisodeCounts` from `showData.seasons`). Add season-level status bubbling and umbrella-breaking invariant. |
| `src/components/media/pages/TvSeriesPageWrapper.tsx` | **MODIFY** | Use nested `seasons` patches. Add season status controls and conflict dialogs. Scan for and delete explicitly `"watched"` episode records when clearing conflicts for `"watching"`. Add new-season detection + backfill logic in `handleTmdbReady`. |
| `src/components/media/utils.ts` | **MODIFY** | Update `computeProgress` to be season-aware. |
| `src/components/media/pages/GenericMediaPage.tsx` | **MODIFY** | In `handleSave`, add `total_seasons` to `patch` and `finalCreateFields`. |

> **Strictly no changes to**: `MediaView.tsx`, `DefaultView.tsx`, `CollectionView.tsx`, `MediaCard.tsx`, `MediaGrid.tsx`, `DiscoverView.tsx`, `CollectionDetailPage.tsx`, `useMediaTracking.ts`, `useNavigationGuard.ts`, `useTmdbRetry.ts`, any shared component outside `/media`, any other domain.

---

## Packages / Dependencies

None. All changes are pure TypeScript/React using existing utilities.

---

## Step-by-Step Implementation Plan

### Step 1 — Types (`src/types/media.ts`) ✅ Stage 1 done
- Add `SeasonTracking` interface above `EpisodeTracking`.
- Update `MediaPlaintext`:
  - Add `seasons?: Record<string, SeasonTracking>`
  - Add `tracked_season_count?: number`
  - Add `total_seasons?: number`
  - Mark `episodes?: Record<string, EpisodeTracking>` as `/** @deprecated — read-time migration converts to seasons */`
- Update `TmdbDetails`:
  - Add `seasons?: { season_number: number; episode_count: number }[]`

### Step 2 — API Layer (`src/app/api/tmdb/details/route.ts` & `src/api/media/media.ts`) ✅ Stage 1 done
- In `route.ts`, map the TMDB response's `seasons` array (omitting specials if desired, or mapping directly) into the proxy response.
- In `media.ts`, add `migrateEpisodeData(oldEpisodes)`, `formatSeasonKey(season)`, `formatEpisodeKeyShort(episode)`.
- Add `computeSeasonStatus(episodes, totalEpsInSeason)`.
- Add `computeShowStatusFromSeasons(seasons, totalSeasonCount, seasonEpisodeCounts: Record<string, number>)`.
- Add `pruneEmptySeasons(seasons: Record<string, SeasonTracking>)`: Helper that deletes any season key where `Object.keys(episodes ?? {}).length === 0` and `status` is undefined.
- Update `getEffectiveEpisodeStatus(parentStatus, seasonStatus, epStatus, isFirstEpisodeOfShow)`.
- Update `listMedia` and `getMediaByTmdbId` read paths: after `JSON.parse(plaintext)`, call `migrateEpisodeData` if `raw.episodes` and `!raw.seasons`.
- Keep `computeShowStatus` (old flat version) but mark as deprecated.

### Step 3 — API Barrel (`src/api/media/index.ts`) ✅ Stage 1 done
- Add exports: `migrateEpisodeData`, `formatSeasonKey`, `formatEpisodeKeyShort`, `computeSeasonStatus`, `computeShowStatusFromSeasons`, `pruneEmptySeasons`.

> **Stage 1 interim note — RESOLVED in Stage 3:** the two `getEffectiveEpisodeStatus`
> call sites that temporarily passed `undefined` as `seasonStatus` are now both
> rewired (EpisodePage in Step 4 ✅, TvSeriesPageWrapper in Step 5 ✅).
>
> **Stage 2 finding — RESOLVED in Stage 3:** `extraPatchFields` now includes
> `episodes: undefined`, so every save from the TV page clears the legacy flat
> map (`updateMedia` merges `{...existing, ...patch}` and `JSON.stringify`
> drops undefined keys). Saves from EpisodePage alone still leave a stale flat
> copy behind, but the migration gate (`seasons` present → `episodes` ignored)
> keeps reads correct and the flat key is wiped on the next save from the TV
> page.

### Step 4 — EpisodePage (`src/components/media/pages/EpisodePage.tsx`) ✅ Stage 2 done
- In the load effect: change `existing.episodes?.[episodeKey]` to `existing.seasons?.[seasonKey]?.episodes?.[episodeKey]` where `seasonKey = formatSeasonKey(seasonNumber)` and episodeKey is `formatEpisodeKeyShort(episodeNumber)`.
- In `handleSave` → build `seasons` patch instead of `episodes`.
  - Add logic to bubble up "watching" to season level if an episode is non-unwatched.
  - If episode is non-"watched" (e.g. "unwatched" or "watching") but parent season/show is "watched", downgrade them to "watching" (breaking the invariant).
- Replace `computeShowStatus` calls with `computeShowStatusFromSeasons`. Use `showData.seasons` to build `seasonEpisodeCounts: Record<string, number>` dynamically.
- In `handleDeleteEpisode`: build updated `seasons` with that episode key removed. Call `pruneEmptySeasons(seasons)` to ensure the season object itself is deleted if it's now empty. Recalculate season and show status.

### Step 5 — TvSeriesPageWrapper (`src/components/media/pages/TvSeriesPageWrapper.tsx`) ✅ Stage 3 done
- Rename `episodeState` → `seasonState: Record<string, SeasonTracking>`.
- Rename `originalEpisodes` → `originalSeasonState`.
- Update `handleStatusChange` (conflict detection):
  - For "watching": count explicitly `"watched"` episode records across all seasons AND explicitly `"watched"` season overrides.
- Update `handleConfirmOverride`:
  - If `targetStatus === "watching"`, iterate through `seasonState` and delete `"watched"` episode entries and `"watched"` season status overrides. Then call `pruneEmptySeasons(seasonState)` to clean up any resulting orphaned seasons.
- Add new-season detection + backfill logic in `handleTmdbReady`:
  - If `tracked_season_count` is undefined and `status === "watched"`, backfill it to `tmdbSeasonCount` via `updateMedia` (no UI change).
  - Else if `tmdbSeasonCount > tracked_season_count`, auto-downgrade to "watching" via `updateMedia` and set "NEW" badge state.
  - Wire `onNewSeasonDetected(updated)` callback to `GenericMediaPage`.
- Update `renderEpisodeSlot`:
  - Read from `seasonState[seasonKey]?.episodes?.[episodeKeyShort]`.
  - Pass season status to `getEffectiveEpisodeStatus`.
- Add season status controls to the season sidebar. Clicking triggers season-level conflict detection and updates `seasonState[seasonKey].status`. Recalculates show status.

> **Stage 3 notes — RESOLVED in Stage 4:**
> - `computeShowStatusFromSeasons` is now imported and used: every season-level
>   mutation (override applied / unset / conflict-confirmed) recomputes the
>   parent show status and pushes it into `GenericMediaPage`'s form via the
>   `onRegisterStatusSync` channel (see Step 6). This satisfies the Step 5
>   bullet "Recalculates show status".
> - `onNewSeasonDetected` remains declared + called by the wrapper; the form
>   re-sync itself is done through the same `onRegisterStatusSync` channel
>   (a page-level `onNewSeasonDetected` has no reach into `GenericMediaPage`'s
>   internal state — see Step 6 note).
> - Season override cycle: unset → watching → watched → unwatched → unset.
>   The sidebar badge shows the override (muted virtual "unwatched" when
>   unset) so the control stays discoverable. Season-scoped conflict scans
>   episode records only, mirroring the parent-level rules
>   (watched → non-watched records; unwatched → non-unwatched records;
>   watching → watched records).
> - `extraPatchFields` also carries `episodes: undefined` (resolves the
>   Stage 2 finding above).

### Step 6 — GenericMediaPage (`src/components/media/pages/GenericMediaPage.tsx`) ✅ Stage 4 done
- In `handleSave`, add `total_seasons: tmdbData?.number_of_seasons ?? 0` to `patch` (which is merged unconditionally) and `baseCreateFields` (which merges into `finalCreateFields`). Added only for `mediaType === "tv"`.
- Add `onNewSeasonDetected` prop to wire the auto-downgrade notification from `TvSeriesPageWrapper`. This simply calls `setStatus(updated.status)` and `setOriginalMedia(...)` to re-sync form state.

> **Step 6 note (deviation from the literal plan):** the plan's wiring snippet
> (`onNewSeasonDetected={(updatedMedia) => { setStatus(...); setOriginalMedia(...); }}`)
> was written as if `GenericMediaPage` rendered the wrapper, but the tree is
> page → `TvSeriesPageWrapper` → `GenericMediaPage` — the wrapper cannot reach
> `GenericMediaPage`'s setters. Instead `GenericMediaPage` exposes
> `onRegisterStatusSync(sync)`: the wrapper registers a function that pushes a
> parent status into the form (`setStatus` + `setOriginalMedia` baseline update,
> so `isDirty` stays false for background writes). The wrapper uses it for
> (a) the auto-downgrade `.then()` (same effect as the plan snippet) and
> (b) season-level recalculations from Step 5. `onNewSeasonDetected` remains an
> optional page-level hook for anything outside the form.

### Step 7 — Utils (`src/components/media/utils.ts`) ✅ Stage 4 done
- Update `computeProgress`:
  - For TV items with `seasons` and `total_seasons`, iterate `Object.values(item.seasons)`.
  - Use effective season status to count `watchedMins += watchedSeasons * rtPerSeason` and `watchingSeasons * rtPerSeason * 0.5`.
- Implemented per plan: season override status wins; a season with tracked
  episodes but no override counts as "watching" (can't prove "watched" without
  per-season TMDB episode totals); movies / legacy TV fall back to top-level
  status.

### Step 8 — Plan Document Update
- Done.

### Step 9 — Post-Phase-6 QA bug fixes ✅ Stage 5 done (revised)
1. **Repeated "Discard Changes" dialog after save** — `GenericMediaPage` now
   accepts `onSaveSuccess?: () => void` (called in `handleSave`'s success
   block); `TvSeriesPageWrapper` passes
   `onSaveSuccess={() => setOriginalSeasonState({ ...seasonState })}` so its
   `extraDirty` snapshot refreshes and the navigation guard stops firing after
   every save.
2. **Toast hidden behind mobile bottom nav** — `Toast.tsx` offset changed from
   `bottom-6` to `bottom-24 md:bottom-6`.
3. **Virtual season badge fallback** — the sidebar badge is now a **passive**
   indicator and derives its fallback from the centralized
   `computeSeasonStatus(episodes, episodeCount)` helper instead of hardcoding
   "unwatched": explicit override wins; a "watched" parent projects "watched";
   otherwise the helper derives watched/watching/unwatched from episode
   density against the TMDB per-season episode count (null → "unwatched").
4. **Season override UX (undiscoverable click-to-cycle)** — replaced with an
   explicit chip group ("Not Watched / Watching / Watched") next to the
   "Season N" header, built with the shared `chipClasses` helper, plus a red
   "Clear Override" text button shown only when an explicit override exists.
   `handleSeasonStatusClick` now takes an explicit
   `(seasonNumber, targetStatus | undefined)` instead of cycling;
   the season-scoped conflict dialog, clearing, and `pruneEmptySeasons` logic
   are unchanged. The sidebar badge keeps its `isVirtual` styling.

### Step 10 — Final CSS polish ✅ Stage 6 done
1. **Sidebar badge text wrapping** — `StatusBadge` now renders
   `whitespace-nowrap` in both the virtual and solid branches so flex
   containers can't squeeze "NOT WATCHED" onto two lines.
2. **Toast under `StickyActionBar`** — `Toast.tsx` elevated from `z-50` to
   `z-[100]` and its offset raised from `bottom-24 md:bottom-6` to
   `bottom-32 md:bottom-8` so it always floats above the sticky bar and
   mobile browser chrome.

### Step 11 — UI Cleanup & "Untrack Season" Action ✅ Stage 7 done
1. **`"season"` support in `UntrackConfirmation`** — `mediaType` union now
   includes `"season"` (extracted to a shared `UntrackTarget` type used by all
   three Records): title "Delete Season Records", label "Delete Records",
   description "This will permanently remove your progress, rating, and
   comments for every episode in this season."
2. **UI clutter removed** — the "Clear Override" text button is deleted from
   the season header entirely (the "(Inherited)" span had already been removed
   per user request). The stale comment on `handleSeasonStatusClick` was
   updated to describe toggle-to-clear instead.
3. **Toggle-to-clear** — each of the three header chips now passes `undefined`
   when clicked while its status matches the explicit `headerSeasonOverride`
   (e.g. `headerSeasonOverride === "unwatched" ? undefined : "unwatched"`),
   which unsets the override, prunes empty seasons, and recalculates the show
   status via the existing `undefined` branch in `handleSeasonStatusClick`.
4. **"Untrack Season" flow** — a subtle `Trash2` icon button renders next to
   the chips only when `seasonState[selectedSeasonKey]` exists. It opens a new
   `showUntrackSeason` state, and confirming runs `handleDeleteSeason()`:
   deletes the season key from a shallow copy of `seasonState`, updates state,
   calls `pushShowStatusFromSeasons(next)` to recalculate the parent show
   status, and closes the dialog. `UntrackConfirmation` renders at the bottom
   of the component with `mediaType="season"`.

### Step 12 — Untrack Season UI parity ✅ Stage 8 done
1. **Relocation** — the `Trash2` icon-only button was removed from the chip
   group and re-added at the right edge of the Season header, inside a new
   `<div className="flex items-center gap-4">` wrapper immediately before the
   `ViewToggle` (still rendered only when `seasonState[selectedSeasonKey]`
   exists, and the dialog trigger still opens via `setShowUntrackSeason(true)`).
2. **Standard untrack styling** — the button now uses the exact class string
   shared by the Movie/Show untrack button in `GenericMediaPage` and the
   "Delete Episode Record" button in `EpisodePage`
   (`inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white
   px-4 py-2 rounded-lg font-medium shadow-sm border-none transition-colors
   text-sm`) with `<X size={16} />` and the visible "Untrack this
   Season" label (the icon-only `title` attribute was dropped). Follow-up
   parity fixes: the season button icon was changed from `Trash2` to `X` to
   match the "Untrack this Movie / TV Series" buttons in `GenericMediaPage`,
   and `EpisodePage`'s episode-delete button was likewise changed from
   `Trash2` + "Delete Episode Record" to `X` + "Untrack this Episode" (with
   `UntrackConfirmation`'s episode title/label updated to "Untrack this
   Episode" / "Untrack" so the dialog matches the trigger).
   The confirmation flow (`showUntrackSeason` → `UntrackConfirmation
   mediaType="season"` → `handleDeleteSeason`) is unchanged.

### Step 13 — Untrack hierarchy fix ✅ Stage 9 done
1. **Unconditional parent-status writes (4 sites)** — every call to
   `computeShowStatusFromSeasons` now applies its result with a
   `?? "unwatched"` fallback instead of skipping on null, so deleting the
   last tracked episode drops the show to "unwatched" instead of leaving a
   ghost "watching"/"watched" umbrella in the DB:
   - `EpisodePage.tsx` `handleSave`: both branches (existing parent +
     duplicate-found) removed their `if (computedParentStatus)` wrappers and
     execute the downgrade/invariant logic unconditionally.
   - `EpisodePage.tsx` `handleDeleteEpisode`: unconditionally sets
     `parentPatch.status = computedParentStatus`; the stale DESIGN comment
     describing the old intentional-skip was rewritten.
   - `TvSeriesPageWrapper.tsx` `pushShowStatusFromSeasons`: unconditionally
     syncs the computed status (fallback "unwatched") into GenericMediaPage's
     form.
2. **Season 1 virtual badge parity** — both the sidebar per-season
   `displayStatus` fallback and the header `headerDisplayStatus` fallback now
   project `"watching"` onto untracked Season 1 when the parent show is
   "watching", mirroring `getEffectiveEpisodeStatus`' first-episode
   guardrail. `getEffectiveEpisodeStatus` itself is unchanged (out of scope).

### Step 14 — Season override invariant in handleSave ✅ Stage 10 done
1. **Season-level invariant (2 branches)** — both the existing-parent branch
   and the duplicate-found branch of `EpisodePage.handleSave` now extract
   `existingSeason` first and clear a contradicting explicit override before
   building `updatedSeason`:
   - override `"unwatched"` + episode saved as anything else → override
     cleared, so `computeSeasonStatus` derives the season status from its
     episodes and the bubble-up can happen;
   - override `"watched"` + episode saved as non-"watched" → override
     cleared (same "breaks the umbrella" rule as the show level).
   The cleared `status: undefined` is dropped by `JSON.stringify` when the
   seasons map replaces itself in the patch, so the stored blob loses the
   override key. `computeShowStatusFromSeasons`/`getEffectiveEpisodeStatus`
   untouched (out of scope).

### Stage 5 — UI & UX Bug Fixes (Post-Phase 6 QA)
1. **Fix "Discard Changes" Save Loop**:
   - In `GenericMediaPage.tsx`, add `onSaveSuccess?: () => void;` to `GenericMediaPageProps`.
   - In `handleSave` inside `GenericMediaPage`, call `onSaveSuccess?.()` immediately after a successful `save()` (inside the `if (result)` block where `setOriginalMedia` is called).
   - In `TvSeriesPageWrapper.tsx`, pass `onSaveSuccess={() => setOriginalSeasonState({ ...seasonState })}` into the `<GenericMediaPage>` component.
2. **Fix Toast appearing behind bottom nav on mobile**:
   - In `Toast.tsx`, change `bottom-6` to `bottom-24 md:bottom-6`.
3. **Fix virtual season status ignoring parent "watched" state (Sidebar Badge)**:
   - In `TvSeriesPageWrapper.tsx` inside `renderEpisodeSlot`, calculate the effective display status for the season using the existing `computeSeasonStatus` helper instead of a naive inline fallback:
     ```typescript
     let displayStatus = sStatus;
     if (!displayStatus) {
       if (parentStatus === "watched") displayStatus = "watched";
       else {
         const computed = computeSeasonStatus(seasonState[sKey]?.episodes, tmdbSeasonRef.current.episodeCounts[sKey] ?? 0);
         displayStatus = computed ?? "unwatched";
       }
     }
     ```
   - Make the sidebar badge a **passive indicator**: remove its wrapping `<button>` and the `onClick` handler entirely. It should just render `<StatusBadge status={displayStatus} isVirtual={!sStatus} />`.

### Stage 9 — Untrack Hierarchy Fix
1. **Fix EpisodePage Status Downgrade (Three locations)**:
   - In `EpisodePage.tsx`, `computeShowStatusFromSeasons` is called in three places (twice in `handleSave` around lines 279 and 332, and once in `handleDeleteEpisode` around line 424).
   - In ALL THREE locations, replace the falsy skip check:
     ```typescript
     // REMOVE THIS PATTERN:
     if (computedParentStatus) {
       // ... status assignments
     }
     ```
   - With a nullish-coalescing fallback so the DB correctly drops to `"unwatched"` when empty:
     ```typescript
     // APPLY THIS EXACTLY:
     const computedParentStatus = computeShowStatusFromSeasons(
       updatedSeasons,
       totalSeasons,
       seasonEpisodeCounts,
     ) ?? "unwatched";
     
     const isDowngradeFromWatched = localMedia.status === "watched" && computedParentStatus !== "watched";
     // (keep the rest of the existing assignment logic inside what used to be the if block, but execute it unconditionally using the new fallback)
     // For handleDeleteEpisode, this just means unconditionally setting parentPatch.status = computedParentStatus;
     ```
2. **Fix TvSeriesPageWrapper Status Downgrade**:
   - In `TvSeriesPageWrapper.tsx`, locate `pushShowStatusFromSeasons` (around line 149).
   - Apply the exact same fallback so it syncs `"unwatched"` back to the GenericMediaPage form instead of skipping:
     ```typescript
     const computed = computeShowStatusFromSeasons(
       seasons,
       totalSeasons,
       episodeCounts,
     ) ?? "unwatched";
     statusSyncRef.current?.(computed);
     ```
3. **Fix Season 1 Virtual Badge Parity**:
   - In `TvSeriesPageWrapper.tsx`'s `renderEpisodeSlot`, update the `displayStatus` fallback for the sidebar seasons so it perfectly matches `getEffectiveEpisodeStatus` (which gives Season 1 a virtual "watching" state if the show is watching):
     ```typescript
     if (parentStatus === "watched") displayStatus = "watched";
     else if (parentStatus === "watching" && s === 1) displayStatus = "watching";
     else { ... }
     ```
   - Apply the exact same logic to `headerDisplayStatus` further down in the same function:
     ```typescript
     if (parentStatus === "watched") headerDisplayStatus = "watched";
     else if (parentStatus === "watching" && selectedSeason === 1) headerDisplayStatus = "watching";
     else { ... }
     ```
4. **Replace Season Status UI with Explicit Header Controls**:
   - Next to the `<h3>Season {selectedSeason}</h3>` header above the episode matrix, implement an explicit inline chip group using the `chipClasses` helper imported from `@/components/media/constants`.
   - Render the three standard buttons (Not Watched, Watching, Watched). The active chip should reflect the *effective* `displayStatus` calculated in step 3.
   - **Virtual vs Explicit distinction**: 
     - If the season has an explicit override (`sStatus` exists), render a small "Clear Override" button (or an "X" icon) next to the chips. Clicking it unsets the override (deletes the status key and prunes).
     - If the season has no explicit override (it is virtual), render a small muted text label next to the chips: *(Inherited)*.
   - **Refactor `handleSeasonStatusClick`**: Update the function signature to accept a specific target status (`handleSeasonStatusClick(seasonNumber: number, targetStatus: string)`) instead of cycling blindly, and wire the three chips to pass their respective explicit statuses.

### Stage 8 — Untrack Season UI Parity
1. **Move and style the Untrack Season button**:
   - In `TvSeriesPageWrapper.tsx`, locate the `Trash2` icon button that triggers `setShowUntrackSeason(true)`.
   - Remove it from next to the season chips.
   - Move it to the right side of the flex container, immediately to the left of the `<ViewToggle>` component.
   - Wrap the button and `<ViewToggle>` in a `<div className="flex items-center gap-4">`.
   - Style the button to match the Episode/Show untrack buttons exactly, and add the text label:
     ```typescript
     <button
       type="button"
       onClick={() => setShowUntrackSeason(true)}
       className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm border-none transition-colors text-sm"
     >
       <Trash2 size={16} />
       Untrack this Season
     </button>
     ```

### Stage 6 — Final CSS Polish
1. **Fix sidebar badge text wrapping**:
   - In `StatusBadge.tsx`, add `whitespace-nowrap` to the class string in both the virtual and non-virtual return branches.
2. **Elevate Toast over StickyActionBar**:
   - In `Toast.tsx`, change `z-50` to `z-[100]` and `bottom-24 md:bottom-6` to `bottom-32 md:bottom-8` to ensure it clears the bottom navigation bar on all screen sizes.

### Stage 7 — UI Cleanup & "Untrack Season" Action
1. **Support `"season"` in UntrackConfirmation**:
   - In `UntrackConfirmation.tsx`, add `"season"` to the `mediaType` union.
   - Add appropriate entries to `TITLES`, `DESCRIPTIONS`, and `LABELS` (e.g. Title: "Delete Season Records", Label: "Delete Records").
2. **Remove UI Clutter**:
   - In `TvSeriesPageWrapper.tsx`'s `renderEpisodeSlot`, delete the conditional rendering blocks for both the `"Clear Override"` button and the `(Inherited)` span in the season header.
3. **Implement Toggle-to-Clear**:
   - Update the `onClick` handlers for the three season status chips. If the clicked status matches `headerSeasonOverride`, pass `undefined` to `handleSeasonStatusClick` to unset the override (toggle off). Otherwise, pass the clicked status.
4. **Add "Untrack Season" Button**:
   - Add state: `const [showUntrackSeason, setShowUntrackSeason] = useState(false);`
   - Add a handler: `handleDeleteSeason` that deletes the entire `seasonState[formatSeasonKey(selectedSeason)]` object, updates state, and calls `pushShowStatusFromSeasons`.
   - Render a small `Trash2` icon button next to the season chips (only if the season has data in `seasonState`) that sets `showUntrackSeason(true)`.
   - Render the `<UntrackConfirmation mediaType="season" ... />` component.

### Verification step, dev agent should concrete all their changes by testing it themselves and catching any bugs
- **Smoke test on a TV show with existing episode data**: navigate to a TV series page that had episodes tracked under the old `"S01E01"` flat format. Verify the migration transparently loads them under the new structure. Then save any field and verify the DB row no longer contains the old `episodes` key.
- **Smoke test new-season detection**: if any tracked "watched" TV show has had a new season added on TMDB since the last save, verify it auto-downgrades on page load. Verify existing "watched" shows backfill silently.
- **Smoke test collection progress**: verify a collection containing a tracked TV show shows an updated progress % that reflects season-level completion rather than just top-level status.
- **Smoke test Movies**: verify nothing changed for movies (no episodes, no seasons, progress unchanged).

### Stage 10 — Season Override Invariant Fix
1. **Fix EpisodePage handleSave Season Invariant (Two locations)**:
   - In `EpisodePage.tsx`, locate `handleSave`. There are two branches where an existing parent is updated: the `if (localMedia)` branch and the `if (dup)` branch.
   - In both branches, immediately before `const updatedSeason = { ... }` is built, implement the season-level invariant to clear a contradicting explicit override:
     ```typescript
     const existingSeason = localMedia.seasons?.[seasonKey]; // or dup.seasons?.[seasonKey] in the dup branch
     let seasonStatusOverride = existingSeason?.status;

     // INVARIANT (season-level, mirrors the existing show-level one):
     // An explicit episode save that contradicts the season's override breaks it.
     if (seasonStatusOverride === "unwatched" && episodeEntry.status !== "unwatched") {
       seasonStatusOverride = undefined; // let computeSeasonStatus derive it from episodes
     } else if (seasonStatusOverride === "watched" && episodeEntry.status !== "watched") {
       seasonStatusOverride = undefined; // downgrade path — same "breaks the umbrella" rule as show level
     }

     const updatedSeason = {
       ...existingSeason,
       status: seasonStatusOverride,
       episodes: {
         ...(existingSeason?.episodes ?? {}),
         [episodeKeyShort]: episodeEntry,
       },
     };
     ```
   - *Note: This prevents a season explicitly marked "unwatched" from silently blocking the bubble-up when a user tracks an episode underneath it.*

### Stage 11 — Automated Test Coverage (Media Manager)

We are introducing real automated testing (Jest/Vitest) structured in three tiers. There is currently no testing framework installed in `package.json`, so one must be set up.

**Tier 1 — Pure Function Unit Tests (Fast & Exhaustive)**
These functions (`computeSeasonStatus`, `computeShowStatusFromSeasons`, `getEffectiveEpisodeStatus`, `pruneEmptySeasons`) are pure, so test them directly by enumerating their input space exactly as outlined in the human's specifications.

**Progress:**
- [x] Tier 1 done (2026-08-16) ✅ Stage 11.1 done — vitest 4.1.10 installed (`npm test` / `test:watch` scripts, `vitest.config.mts` with the `@/` alias), 29 unit tests in `src/api/media/__tests__/media.test.ts`. The suite is hermetic: `@/lib/supabase/client` and `@/lib/crypto` are `vi.mock`ed so no browser SDK, WASM, or IndexedDB loads.
- [x] Tier 2 done (2026-08-16) ✅ Stage 11.2 done — approved infrastructure implemented and verified:
  - **DB target:** dummy test user in the production Supabase project (RLS-isolated scratch rows, test runs authenticate as the dummy user via password sign-in — never the real user, never a service-role key). Credentials live ONLY in the gitignored `.env.test.local`.
  - **Handler access:** logic extracted to `src/api/media/handlers.ts` as pure state transformations + thin persistence orchestrators (`saveEpisode`, `deleteEpisodeRecord`); `EpisodePage`, `TvSeriesPageWrapper`, and `GenericMediaPage` now call them (behavior-preserving — 29/29 Tier 1 tests and lint stayed green).
  - **Safety design:** separate `vitest.integration.config.mts` + `*.integration.test.ts` glob (excluded from default `npm test`); the suite fails fast when the test env vars are absent; per-test teardown deletes exactly the rows each test created; `fileParallelism: false`. Run with `npm run test:integration`.
  - **Coverage:** 29 tests in `src/api/media/__tests__/media.integration.test.ts` walking Tables A/B/C mechanically, plus the two known regressions pinned as named tests ("Original Repro": explicit season "unwatched" + watched episode save → override cleared + bubble; "Downgrade Twin": explicit season "watched" + non-watched save → override cleared + downgrade) and the forced-"watched" umbrella invariant. A harness smoke test (`smoke.integration.test.ts`) pins sign-in → DEK bootstrap → encrypted round-trip. Every assertion re-reads the row fresh from the DB (media cache dropped).
- [x] Tier 3 done (2026-08-16) ✅ Stage 11.3 done — 5 tests in `src/api/media/__tests__/collections.integration.test.ts` prove tracking and collection membership are fully independent (tracking mutations preserve membership; collection create/update/delete-with-unlink preserve tracking state; linked vs unlinked twins behave identically).
- [x] Grid-level "New Season" badges done (2026-08-16) ✅ — watched TV shows with a TMDB season added since their last "watched" save now show a green "New Season" chip directly on grid views (library, collections, discover, add-media modal). `MediaCard`/`BaseMediaCard` stay passive and synchronous (`hasNewSeason?: boolean` prop); all fetching lives in `src/hooks/useNewSeasonChecks.ts` (concurrency cap 6, module-level Map TTL cache, `AbortController` cleanup on unmount, silent failures, read-only — never calls `updateMedia`). The verdict comes from the shared pure `checkNewSeason()` in `handlers.ts` (unit-tested; `handleTmdbReady` refactored onto it so page load and grid can never disagree), and `/api/tmdb/details` now opts the upstream TMDB fetch into Next's Data Cache (`next: { revalidate: 43200 }` = 12h) so grid fan-out can't DoS the proxy or TMDB's rate limits. **Accepted cache staleness:** the badge may persist up to 12h after visiting the show page and triggering the real downgrade; the client cache does not currently invalidate on navigation.

**Doc-vs-code deviations found while walking the matrix** (tests pin the CODE's behavior — see inline `DEVIATION` comments in `media.integration.test.ts`; the matrix rows themselves have NOT been rewritten yet, pending a human decision):
1. **Table A rows 1–2 / Table B row 4 — `tracked_season_count`:** the matrix says override saves and completion saves write it, but the only writer is `TvSeriesPageWrapper.handleTmdbReady` (page-load backfill + new-season auto-downgrade). The tests assert the field is NOT written by these paths.
2. **Table A row 2 / Table C row 2 — "all records cleared":** the code clears only the CONFLICTING nested records and keeps matching ones (e.g. forcing "watched" keeps already-"watched" episode records). The matrix wording says everything is deleted.
3. **Table B row 9 — emptied show keeps its umbrella:** the code (Stage 9 "Untrack hierarchy fix") actively sets the parent to "unwatched" when no seasons remain — an emptied show must not retain a ghost umbrella status.

**Tier 2 — Integration Tests (Handlers)**
*Prerequisite*: Before writing tests for `handleSave`, `handleDeleteEpisode`, `handleDeleteSeason`, and `handleConfirmOverride`, **STOP** and determine if there is a safe test Supabase project/user to write scratch rows against. If not, propose a cheap option.
Once answered, mechanically walk the exhaustive scenario matrix (Tables A, B, and C), focusing heavily on deletion/override-clearing paths and ensuring the two known regressions are permanently pinned as named tests.

**Tier 3 — Collections Independence**
Confirm that tracking status logic and collection membership are fully independent, testing that adding/removing tracked shows from collections (or adding untracked shows) does not mutate their media tracking status.

---

## Human Actions Required

### Before Deploying/Shipping to Prod
- **CRITICAL SAFETY STEP**: Take a raw SQL export/backup of the `media` table before pushing Phase 6 to production. Because every row is a single JSON blob per user, any unpredicted migration edge case on a user's data is completely unrecoverable without a snapshot to restore from. Do this via Supabase dashboard or CLI (RLS does not block service-role backups).
- None for the code itself — all changes are client-side TypeScript/React + Next.js route API. No Supabase schema migrations, no new env vars, no TMDB API changes.

### After Implementation (Verification)
- **Smoke test on a TV show with existing episode data**: navigate to a TV series page that had episodes tracked under the old `"S01E01"` flat format. Verify the migration transparently loads them under the new structure. Then save any field and verify the DB row no longer contains the old `episodes` key.
- **Stage 10 Testing flag (Original Repro)**: set a season to explicit "unwatched" via the header chips, then save one episode inside it as "watched" — season and show should both correctly auto-bubble to "watching".
- **Stage 10 Testing flag (Downgrade Twin)**: set a season to explicit "watched", then save one episode inside it as "unwatched" (or any non-watched status). Visually confirm the season correctly breaks its umbrella and downgrades to "watching" (not "unwatched").

### Before Deploying/Shipping to Prod
- **CRITICAL SAFETY STEP**: Take a raw SQL export/backup of the `media` table before pushing Phase 6 to production. Because every row is a single JSON blob per user, any unpredicted migration edge case on a user's data is completely unrecoverable without a snapshot to restore from. Do this via Supabase dashboard or CLI (RLS does not block service-role backups).
- None for the code itself — all changes are client-side TypeScript/React + Next.js route API. No Supabase schema migrations, no new env vars, no TMDB API changes.

### After Implementation (Verification)
- **Smoke test on a TV show with existing episode data**: navigate to a TV series page that had episodes tracked under the old `"S01E01"` flat format. Verify the migration transparently loads them under the new structure. Then save any field and verify the DB row no longer contains the old `episodes` key.
- **Stage 10 Testing flag (Original Repro)**: set a season to explicit "unwatched" via the header chips, then save one episode inside it as "watched" — season and show should both correctly auto-bubble to "watching".
- **Stage 10 Testing flag (Downgrade Twin)**: set a season to explicit "watched", then save one episode inside it as "unwatched" (or any non-watched status). Visually confirm the season correctly breaks its umbrella and downgrades to "watching" (not "unwatched").
- **Smoke test new-season detection**: if any tracked "watched" TV show has had a new season added on TMDB since the last save, verify it auto-downgrades on page load. Verify existing "watched" shows backfill silently.
- **Smoke test collection progress**: verify a collection containing a tracked TV show shows an updated progress % that reflects season-level completion rather than just top-level status.
- **Smoke test Movies**: verify nothing changed for movies (no episodes, no seasons, progress unchanged).

- Per-season runtime granularity from TMDB (we estimate as `total_runtime / total_seasons` — acceptable approximation)
- Inline episode status editing from within the episode matrix in `TvSeriesPageWrapper` (remains "navigate to EpisodePage to edit")
- "Mark all episodes in season as watched" bulk action (could be added later as a Season action)
- Any new API routes, DB tables, or environment variables
- Any changes to other domains (Task Manager, Expense, Education, Medical, Vault)
