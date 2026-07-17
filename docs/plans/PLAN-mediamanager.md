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