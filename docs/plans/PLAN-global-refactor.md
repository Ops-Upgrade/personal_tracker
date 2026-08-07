# Global Architecture Refactor Roadmap

This document tracks the architectural refactoring of the application to eliminate duplicated page structure
and standardize all list-based, store, media, and domain views into composable opt-in generic pages.

There are **4 distinct generic page types** — each solving a different class of duplication.
They do not share a base; they share only the philosophy of opt-in composability.

---

## The 4 Generic Page Architecture

| Generic | What It Absorbs | Key Opt-ins |
|---|---|---|
| `GenericViewPage` | Year/month-scoped sortable list pages | Views (Completion / Month / Priority), Year dropdown, Month dropdown |
| `GenericStorePage` | Auth wrapper + chrome for doc/record stores | Type: `doc` (file tiles) or `record` (text tiles with secrets) |
| `GenericMediaPage` | TMDB tracking chrome, hero, status, review, sticky bar | Episode matrix (TV only), Watched-on date (movies only) |
| `GenericDomainPage` | Auth bootstrap, page header, back button, error banner, query-modal state | Domain-specific box components as slot children |

---

## Stage 1: GenericViewPage — "View All" Standardization

> **Complete.**

### What GenericViewPage replaces

Every "View All" page currently manually implements:
- A `PageShell` (title, back button, description, error banner)
- A `BoxContainer` with a scrollable inner border
- A 12-column CSS grid header with `SortableHeader` per sortable column
- View toggle state and the hardcoded JSX for each view layout
- Year/month filter state and the corresponding dropdown UI
- Empty state messages

All of this is duplicated across completed tasks, notes, completed education, and will be duplicated again for expense/medical month views without this generic.

### Opt-in features (centrally defined, domain chooses which to enable)

| Opt-in | Prop | Used By |
|---|---|---|
| Year dropdown | `yearFilter` | Completed Tasks, Completed Education, Expense/Medical "All" |
| Month dropdown | `monthFilter` | Expense "Month View All", Medical "Month View All" |
| Completion / Date-Added view | `views={["completion"]}` | All domains (named differently per domain) |
| Month-grouped view | `views={["months"]}` | Tasks, Education, Expense, Medical |
| Priority-grouped view | `views={["priority"]}` | Tasks, Education only (Medical omits this) |
| Sortable column headers | `sortColumn` on `ColumnDef` | Per column, per domain |
| Row click → edit modal | `onRowClick` | All domains |
| Priority-colored row borders | `rowClassName` callback | Tasks only |

### Column definitions (domain responsibility)

Each domain defines its own `ColumnDef<T>[]` array specifying the columns specific to that data type.
The generic page knows nothing about expense dates or task priorities — domains inject that via `render`.

### Phase 1A — Core Component & Initial Adopters ✅

**Status: Implemented.**

**What was done:**
- `src/components/common/GenericViewPage.tsx` — Created
- `/taskmanager/completed/page.tsx` — Uses `GenericViewPage`
- `/taskmanager/notes/page.tsx` — Uses `GenericViewPage`
- `/education/completed/page.tsx` — Uses `GenericViewPage`

**What got deleted:**
- Hardcoded Priority-section JSX in `taskmanager/completed/page.tsx`
- Hardcoded Month-tile JSX in `taskmanager/completed/page.tsx`
- Local `VIEW_OPTIONS` constant in `taskmanager/completed/page.tsx`
- `src/components/common/GenericDataList.tsx` — replaced by `GenericViewPage.tsx`

#### Step-by-Step Plan (Phase 1A)

```
1. Create src/components/common/GenericViewPage.tsx, replacing GenericDataList.tsx.
   - Accept `views` prop as a subset of ["completion", "months", "priority"].
   - Internally manage view toggle state and render the correct layout strategy
     based on active view: flat GenericDataList for completion, MonthTile-grouped
     for months, Priority-section-grouped for priority.
   - Accept `yearFilter` and `monthFilter` as optional prop objects
     ({ selectedYear, availableYears, onChange }) — render YearDropdown /
     MonthDropdown in the header bar only when provided.
   - Retain the ColumnDef<T> API, getItemKey, onRowClick, rowClassName as-is.

2. Refactor taskmanager/completed/page.tsx to use GenericViewPage.
   - Remove hardcoded Priority and Months view JSX.
   - Pass views={["completion", "months", "priority"]}.
   - Pass yearFilter={{ selectedYear, availableYears, onChange: setSelectedYear }}.
   - Remove local VIEW_OPTIONS constant.

3. Refactor education/completed/page.tsx to use GenericViewPage.
   - Add year-filtering logic (same pattern as taskmanager completed).
   - Pass views={["completion", "months", "priority"]}.
   - Pass yearFilter prop.

4. Refactor taskmanager/notes/page.tsx to use GenericViewPage.
   - Notes have no priority, so pass views={["completion", "months"]}.
   - No year filter needed for notes (notes are not date-scoped by year).

5. Delete src/components/common/GenericDataList.tsx.
```

**Human Actions Required:**
- None.

**Out of Scope:**
- CRUD consolidation across domains (deferred to Stage 4).
- Expense and Medical month views (Phase 1C).

---

### Phase 1B — Cleanups (View Options Standardization) ✅

**Status: Implemented.**

**Tasks:**
1. **Centralize View Options:** Define standard view options (like `VIEW_ALL_MONTHS_PRIORITY`, `VIEW_ALL_MONTHS`, `VIEW_ALL_ONLY`) as exported constants in `GenericViewPage.tsx` so domains can import them instead of typing `{ value, label }` arrays repeatedly.
2. **Rename "completion" value to "all":** The internal value for the flat list view should be `"all"` instead of `"completion"`. 
   - `GenericViewPage.tsx` needs to check for `currentView === "all"`.
   - The label should remain domain-specific where needed (e.g., "Completion" for tasks, "All" for notes).

#### Step-by-Step Plan (Phase 1B)

```
1. In `src/components/common/GenericViewPage.tsx`:
   - Export a `STANDARD_VIEWS` constant object with pre-built arrays:
     - `COMPLETION_MONTHS_PRIORITY`: [{ value: "all", label: "Completion" }, { value: "months", label: "Months" }, { value: "priority", label: "Priority" }]
     - `ALL_ONLY`: [{ value: "all", label: "All" }]
   - Update `currentView === "completion"` fallback and render checks to `currentView === "all"`.
2. In `src/app/(protected)/taskmanager/completed/page.tsx`:
   - Delete local `VIEW_OPTIONS`.
   - Import `STANDARD_VIEWS` and pass `views={STANDARD_VIEWS.COMPLETION_MONTHS_PRIORITY}`.
   - Change `useLocalStorage` default from `"completion"` to `"all"`.
3. In `src/app/(protected)/taskmanager/notes/page.tsx`:
   - Delete local `VIEW_OPTIONS`.
   - Import `STANDARD_VIEWS` and pass `views={STANDARD_VIEWS.ALL_ONLY}`.
   - Change `useLocalStorage` default from `"completion"` to `"all"`.
4. In `src/app/(protected)/education/completed/page.tsx`:
   - Ensure it imports `STANDARD_VIEWS.COMPLETION_MONTHS_PRIORITY` and uses `"all"` as the default active view.
```

**Human Actions Required:**
- None.

**Out of Scope:**
- Any functional changes to existing views.

---

### Phase 1C — Expense & Medical "View All" ✅

**Status: Implemented.**

**Two new routes, both using GenericViewPage.**

**Expense `/expense/all`:**
- Opt-in: `views={["completion", "months"]}` (expenses have no priority)
- Opt-in: `yearFilter` + `monthFilter` (year + month dropdown in header)
- Columns: Date, Description, Category, Amount, Receipt icon
- Row click → open `ExpenseModal`
- No priority view (expenses are not prioritized)

**Medical `/medical/all`:**
- Opt-in: `views={["completion", "months"]}` (no priority in medical)
- Opt-in: `yearFilter` + `monthFilter`
- Columns: Date, Description, Provider, Cost, Receipt icon
- Row click → open `MedicalModal`

**Changes to existing components:**
- `MonthRow.tsx` — Replace `showAll` inline toggle with `router.push(ROUTES.EXPENSE_ALL + '?year=X&month=Y')`
- `MedicalMonthRow.tsx` — Same, replace `showAll` toggle with route navigation

**What got deleted:**
- `showAll` state and inline expansion logic in `MonthRow.tsx`
- `showAll` state and inline expansion logic in `MedicalMonthRow.tsx`
- `src/components/expense/FullMonthModal.tsx` — pre-built but unused, superseded by the new route

#### Step-by-Step Plan (Phase 1C)

```
1. Update Generic Components:
   - Create src/components/common/MonthDropdown.tsx.
   - In GenericViewPage.tsx, add ALL_MONTHS to STANDARD_VIEWS.
   - In GenericViewPage.tsx, accept monthFilter prop and render MonthDropdown in the header.

2. Add Routes:
   - Add EXPENSE_ALL and MEDICAL_ALL to src/routes/paths.ts.

3. Build Expense View All:
   - Create src/app/(protected)/expense/all/page.tsx using GenericViewPage.
   - Pass STANDARD_VIEWS.ALL_MONTHS.

4. Build Medical View All:
   - Create src/app/(protected)/medical/all/page.tsx using GenericViewPage.
   - Pass STANDARD_VIEWS.ALL_MONTHS.

5. Clean up Inline Rows:
   - In MonthRow.tsx (Expense), remove inline expansion table. Change click to route navigation, but preserve 5-item preview.
   - In MedicalMonthRow.tsx (Medical), remove inline expansion table. Change click to route navigation, but preserve 5-item preview.

6. Delete Dead Code:
   - Delete src/components/expense/FullMonthModal.tsx.
```

**Human Actions Required:**
- None.

**Out of Scope:**
- Routing query-param synchronization with the parent domain view's selected year (deferred).

---

## Stage 2: GenericStorePage — Store Standardization

> **Complete.**

**The problem:** Every domain store page (`taskmanager/store`, `expense/store`, `education/store`, `medical/store`) and `VaultDocumentsView` independently implements identical boilerplate: `getSession` auth init, two `useEffect` hooks for data loading, a `refreshAll` `useCallback`, a `refreshTrigger` `useState`, and `parentRecords` derivation. `GlobalStoreView` is only a display component — it has no data-fetching responsibility. This boilerplate is copy-pasted verbatim across 5 files.

**The fix:** Create `GenericStorePage` as a data-fetching + auth wrapper that resolves `userId`, fetches domain data and documents together, manages the refresh cycle, derives parent records, and then delegates display entirely to `GlobalStoreView`. Each domain page is reduced to passing its domain-specific fetch callbacks and its modal slot.

### Opt-in features (centrally defined, domain chooses)

| Opt-in | Prop | Used By |
|---|---|---|
| Store type | `storeType: "doc" \| "record"` | All adopters (required) |
| Domain for document scoping | `domain: string` | Doc stores (passed to `GlobalStoreView`) |
| Parent records for linking | `fetchParentRecords` callback | taskmanager, expense, education, medical, vault/documents |
| Inline modal for linked doc click | `onLinkedRecordClick` callback | taskmanager (NoteModal), expense (ExpenseModal) |
| Standalone upload → create parent | `onStandaloneUpload` callback | taskmanager only |
| Title, description, back link | `title`, `description`, `backHref` | All adopters |

### Phase 2A — Core GenericStorePage Component ✅

**Status: Implemented.**

**What changes:**
- Create `src/components/common/store/GenericStorePage.tsx`.
  - Absorbs: `getSession` auth bootstrap, `useEffect` data loading, `refreshAll` pattern, `refreshTrigger` state, `parentRecords` derivation.
  - Accepts a `fetchData` callback `(userId: string) => Promise<{ domainRows: T[], documents: Document[] }>` so domains provide their own fetching logic.
  - Accepts a `deriveParentRecords` callback `(rows: T[]) => { id: string; name: string }[]`.
  - When `storeType === "doc"`: renders `GlobalStoreView` with all resolved props.
  - When `storeType === "record"`: renders `VaultRecordView` (future Phase 2B).

**What gets deleted:**
- The auth + data loading boilerplate block (lines 30–86) duplicated across all 4 domain store page files.
- `VaultDocumentsView.tsx` — fully absorbed into the generic with `storeType="doc"` + `domain="vault"`.

#### Step-by-Step Plan (Phase 2A)

```
1. Create src/components/common/store/GenericStorePage.tsx.
   - Props: storeType, domain, title, description, backHref,
     fetchData, deriveParentRecords, onLinkedRecordClick?,
     onStandaloneUpload?, children? (for domain-specific modal slot).
   - Internally: getSession auth init, useEffect data load,
     refreshAll useCallback, refreshTrigger state.
   - When storeType === "doc": render <GlobalStoreView /> with
     resolved userId, domain, title, description, backHref,
     parentRecords, allDocuments, refreshTrigger, onActionClick,
     onStandaloneUpload.

2. Refactor src/app/(protected)/taskmanager/store/page.tsx.
   - Delete auth/data/refresh/parentRecords boilerplate.
   - Use <GenericStorePage storeType="doc" domain="taskmanager" ... />
   - Pass fetchData, deriveParentRecords, onLinkedRecordClick (opens NoteModal).
   - Keep NoteModal in the page's modal slot.

3. Refactor src/app/(protected)/expense/store/page.tsx.
   - Same pattern. onLinkedRecordClick opens ExpenseModal.

4. Refactor src/app/(protected)/education/store/page.tsx.
   - Same pattern. onLinkedRecordClick opens EducationModal.

5. Refactor src/app/(protected)/medical/store/page.tsx.
   - Same pattern. Medical has no linked-record modal (receipts only).

6. Refactor src/components/vault/documents/VaultDocumentsView.tsx.
   - Replace with thin wrapper using <GenericStorePage storeType="doc"
     domain="vault" fetchData={fetchVaultDocuments} ... />.
   - Delete VaultDocumentsView.tsx after adopter is verified.
```

**Human Actions Required:**
- None.

**Out of Scope:**
- Vault record stores (Banks, Passwords, Records) — Phase 2B.

---

### Phase 2B — Vault Record Stores ⚠️

**Status: Incorrectly implemented.**

**What was intended:** `GenericStorePage` absorbs all boilerplate from the 3 vault record view files. `VaultRecordView` and `GlobalStoreView` were to be deleted — they are middle-layer display components that should not exist. Every adopter renders `<GenericStorePage>` directly, and `GenericStorePage` owns 100% of the UI.

**What was actually done:** The boilerplate (`useVaultSection`, `useSelection`, `useDeleteConfirm`) was moved into `GenericStorePage`, but `VaultRecordView` (305 lines) and `GlobalStoreView` (698 lines) were **kept alive** as separate display layers that `GenericStorePage` delegates to. `BankDetailView` was explicitly scoped out and still bypasses `GenericStorePage` entirely, calling `VaultRecordView` directly. This violates the architecture.

**Correct target state** (to be completed in Phase 2C):
- `GenericStorePage` is the **only** store UI component — it owns tiles, search, list/tile toggle, bulk bar, header, theming, and all modals internally.
- `GlobalStoreView.tsx` — **deleted**
- `VaultRecordView.tsx` — **deleted**
- `BankDetailView.tsx` — **deleted**, replaced by a thin `<GenericStorePage storeType="record">` wrapper with `headerActions` (Delete Bank button) and PIN-level `onActionClick` as opt-ins.

---

### Phase 2C — Collapse Display Layers into GenericStorePage ⬜

**Status: Not started.**

**The problem:** `GenericStorePage` currently delegates rendering to two separate display components (`GlobalStoreView` for doc stores, `VaultRecordView` for record stores), both of which own their own UI logic (tiles, search bar, tile/list toggle, bulk bars, modals). This defeats the entire point: the UI is still fragmented across 3 components instead of 1.

**The fix:** Absorb all UI logic from both `GlobalStoreView` and `VaultRecordView` directly into `GenericStorePage`. The `storeType` prop switches the rendering mode internally. All opt-in UI elements (bulk rename, bulk link, headerActions, tileLayout, domain theming) become props on `GenericStorePage` directly.

**What gets deleted:**
- `src/components/common/store/GlobalStoreView.tsx` — fully absorbed into `GenericStorePage`
- `src/components/vault/VaultRecordView.tsx` — fully absorbed into `GenericStorePage`
- `src/components/vault/banks/BankDetailView.tsx` — replaced by a thin `<GenericStorePage>` wrapper

**Current adopters that call `GenericStorePage` (all correct after 2C):**
- `taskmanager/store/page.tsx` — `storeType="doc"`
- `expense/store/page.tsx` — `storeType="doc"`
- `education/store/page.tsx` — `storeType="doc"`
- `medical/store/page.tsx` — `storeType="doc"`
- `vault/documents/page.tsx` — `storeType="doc"`
- `vault/passwords/PasswordView.tsx` — `storeType="record"`
- `vault/records/RecordsView.tsx` — `storeType="record"`
- `vault/banks/BankListView.tsx` — `storeType="record"` + `onActionClick → router.push(VAULT_BANK_DETAIL)`
- `vault/banks/[id]/page.tsx` (new, replaces BankDetailView) — `storeType="record"` + `headerActions={<Delete Bank>}` + `onActionClick → open BankPinModal`

**Opt-in features all domains choose from (all centrally defined in GenericStorePage):**

| Opt-in | Prop | storeType |
|---|---|---|
| Domain theming (colors) | `domain` | `doc` only |
| File tile grid | `storeType="doc"` | — |
| Record tile grid / list toggle | `storeType="record"` | — |
| Tile layout mode | `tileLayout: "standard" \| "body-only"` | `record` only |
| Bulk rename | internal to doc mode | `doc` only |
| Bulk link to parent | internal to doc mode | `doc` only |
| Bulk delete | internal to both modes | both |
| Header action slot | `headerActions?: ReactNode` | both |
| Add button | `onAdd` or `disableAdd` | both |
| Linked record click override | `onActionClick` | both |
| Domain modal slot (edit/create) | `modalSlot` / `recordModalSlot` | both |
| Search bar | internal | `record` only (doc uses TileView's own search) |
| Empty state message | `emptyMessage` | both |

#### Step-by-Step Plan (Phase 2C)

```
1. Absorb GlobalStoreView into GenericStorePage (doc mode).
   - Move: DOMAIN_THEMES, TileView, BulkActionBar, BulkLinkModal,
     StoreDocumentModal, bulk-rename modal, bulk-delete confirm,
     hash-driven modal state, fetchDocuments data load.
   - GenericStorePage storeType="doc" renders this entire UI.
   - Delete GlobalStoreView.tsx.

2. Absorb VaultRecordView into GenericStorePage (record mode).
   - Move: DataListView (tile/list toggle + search), InlineSecretValue,
     selection rendering, headerActions slot, tile/list row rendering.
   - GenericStorePage storeType="record" renders this entire UI.
   - Delete VaultRecordView.tsx.

3. Add headerActions?: ReactNode to GenericRecordStoreProps.
   - Pass through to the record mode header row.

4. Replace BankDetailView.tsx with a thin page wrapper.
   - Create vault/banks/[id]/page.tsx (if not existing) using GenericStorePage.
   - storeType="record", vaultSection="banks", fetch single bank's pins.
   - Pass headerActions={<Delete Bank button>}.
   - Pass onActionClick={open BankPinModal}.
   - Pass recordModalSlot={BankPinModal}.
   - Delete BankDetailView.tsx.
```

**Human Actions Required:**
- None.

**Out of Scope:**
- Any changes to `StoreDocumentModal`, `BulkLinkModal`, `TileView`, `DataListView` — these remain as sub-components used internally by `GenericStorePage`.

---

## Stage 3: GenericMediaPage — Media Detail Standardization

> **Current focus.** Do not start until Stage 2 commit is verified.

### What GenericMediaPage replaces

Both `MoviePage.tsx` (368 lines) and `TvSeriesPage.tsx` (764 lines) independently implement the following identical structure:

**Shared state (copy-pasted verbatim):**
- `useMediaTracking({ tmdbId, userId, type, onRefresh })` — data fetch hook
- `status`, `rating`, `reviewNotes`, `collectionIds` — form state
- `originalMedia` snapshot for `isDirty` diffing
- `showRemove` + `collectionToRemove` — untrack/collection-remove flow
- `handleRemove` — calls `removeMedia`, resets all state
- `isTracked`, `title`, `year` — derived display values
- `useEffect` load + hydrate pattern
- `isDirty` `useMemo` — deep comparison vs `originalMedia`
- `doCancel` — resets form state to original
- `useNavigationGuard` — dirty-state nav interception
- `handleStatusClick` / `handleRatingChange` / `handleToggleCollection` / `handleRemoveCollectionClick` / `handleConfirmRemoveCollection`
- `handleSave` — builds patch + extraCreateFields, calls `save`, updates `originalMedia`

**Shared JSX structure (copy-pasted):**
- Loading guard → spinner
- Error guard → `BackButton + ErrorBanner`
- `BackButton`
- `Toast`
- `MediaHeroSection` (posterPath, typeLabel, title, year, genres, overview, contentRating, watchProviders, fallbackIcon)
- "Untrack this [X]" button (only shown when `isTracked`)
- Tracking form card: `StatusChipGroup`, `CollectionPicker`, `ReviewSection`
- `StickyActionBar` (onSave, onCancel, saving, isDirty)
- `UntrackConfirmation` dialog
- "Unsaved Changes" `ConfirmDialog`
- "Remove from Collection" `ConfirmDialog`

**TV-only state and JSX (stays in TV wrapper):**
- `searchParams` tab switcher (`tracking` vs `episodes`)
- `selectedSeason`, `seasonData`, `viewMode`, `episodeState`
- Episode override conflict dialog (`overrideConfig`)
- `useTmdbRetry` for season loading
- `hydrateFromExisting` — also hydrates `episodeState`
- `isDirty` includes episode state comparison
- `doCancel` also resets `episodeState`
- `handleParentStatusClick` — conflict detection before setting status
- `handleConfirmOverride` / `handleCancelOverride`
- `handleSave` patch also includes `episodes`
- Tab bar JSX (`tracking` | `episodes` tabs)
- Full episode matrix JSX (season selector sidebar + episode grid)
- Episode override `ConfirmDialog`

**Movie-only state and JSX (absorbed into `GenericMediaPage`, gated by `showWatchedOn` prop):**
- `watchedOn` state + `setWatchedOn` — declared inside `GenericMediaPage`, only active when `showWatchedOn=true`
- `handleStatusClick` auto-sets `watchedOn` to today when status → "watched" (only when `showWatchedOn=true`)
- `handleRatingChange` auto-sets `watchedOn` to today when rating > 0 (only when `showWatchedOn=true`)
- `handleSave` spreads `watched_on` into patch only when `showWatchedOn=true`
- `StatusChipGroup` receives `showWatchedOn`, `watchedOn`, `onWatchedOnChange` only when `showWatchedOn=true`

### Opt-in features (centrally defined, domain chooses)

| Opt-in | Prop | Used By |
|---|---|---|
| Media type | `mediaType: "movie" \| "tv"` | Both (required) |
| Watched-on date field | `showWatchedOn?: boolean` | Movie only |
| Episode matrix slot | `episodeSlot?: ReactNode` | TV only |
| Episode dirty tracking | `extraDirty?: boolean` | TV only (caller computes, passes result) |
| Episode cancel callback | `onExtraCancel?: () => void` | TV only (caller resets episode state) |
| Episode save data | `extraPatchFields?: Partial<MediaPlaintext>` | TV only (caller passes `{ episodes }`) |
| Episode create fields | `extraCreateFields?: Partial<MediaPlaintext>` | TV only (caller passes `{ episodes, runtime }`) |
| Fallback icon | `fallbackIcon: ReactNode` | Both |
| Type label | `typeLabel: string` | Both |

### Phase 3A — Core GenericMediaPage Component ⬜

**Status: Not started.**

**What changes:**
- Create `src/components/media/pages/GenericMediaPage.tsx`.
  - Absorbs: all shared state, all shared handlers, all shared JSX listed above.
  - Accepts `mediaType`, `tmdbId`, `userId`, `userName`, `userAvatarUrl`, `collections`, `onRefresh`.
  - Accepts `showWatchedOn?: boolean` — if true, passes `watchedOn` state to `StatusChipGroup`.
  - Accepts `episodeSlot?: ReactNode` — rendered as a second tab "Episodes" only when provided. The tab bar itself is internal to `GenericMediaPage` (rendered only when `episodeSlot` is provided).
  - Accepts `extraDirty?: boolean` — ORed with internal `isDirty`.
  - Accepts `onExtraCancel?: () => void` — called inside `doCancel` after resetting form state.
  - Accepts `extraPatchFields?: Partial<MediaPlaintext>` — merged into the save patch.
  - Accepts `extraCreateFields?: Partial<MediaPlaintext>` — merged into the save create fields.

**What gets deleted:**
- `src/components/media/pages/MoviePage.tsx` — fully absorbed into `GenericMediaPage`. No wrapper needed.
- `src/components/media/pages/TvSeriesPage.tsx` — all shared logic absorbed; TV-only episode state remains in a thin wrapper.

**New thin wrapper (TV only):**
- `src/components/media/pages/TvSeriesPageWrapper.tsx` — owns TV-only state (`episodeState`, `selectedSeason`, `seasonData`, `viewMode`, `overrideConfig`), TV-only handlers (`handleParentStatusClick` with conflict detection, `handleConfirmOverride`, `hydrateFromExisting`), and passes `episodeSlot={<EpisodeMatrix .../>}`, `extraDirty`, `onExtraCancel`, `extraPatchFields`, `extraCreateFields` into `<GenericMediaPage mediaType="tv">`.
- **No `MoviePageWrapper` is created** — `watchedOn` state is owned by `GenericMediaPage` internally and gated by `showWatchedOn`. The route page renders `GenericMediaPage` directly.

**Route pages updated:**
- `src/app/(protected)/media/movie/[tmdb_id]/page.tsx` — change import from `MoviePage` → `GenericMediaPage` directly, with `showWatchedOn` prop.
- `src/app/(protected)/media/tv/[tmdb_id]/page.tsx` — change import from `TvSeriesPage` → `TvSeriesPageWrapper`.

#### Step-by-Step Plan (Phase 3A)

```
1. Create src/components/media/pages/GenericMediaPage.tsx.
   - Move all shared state and handlers from MoviePage into this component.
   - Add showWatchedOn?: boolean prop.
     - If true: declare watchedOn state internally, pass to StatusChipGroup.
     - handleStatusClick auto-sets watchedOn to today when status → "watched".
     - handleRatingChange auto-sets watchedOn to today when rating > 0.
     - handleSave spreads { watched_on: watchedOn || undefined } into patch.
   - Add episodeSlot?: ReactNode prop: if provided, render tab bar (tracking | episodes)
     and render episodeSlot inside the episodes tab pane. Tab bar is NOT rendered
     when episodeSlot is absent.
   - Add extraDirty?: boolean prop: OR with internal isDirty in the useMemo.
   - Add onExtraCancel?: () => void prop: called at the end of doCancel.
   - Add extraPatchFields?: Partial<MediaPlaintext> prop: spread into patch in handleSave.
   - Add extraCreateFields?: Partial<MediaPlaintext> prop: spread into extraCreateFields in handleSave.
   - Add onStatusChange?: (status) => void prop: if provided, replaces the internal
     handleStatusClick (TV uses this for conflict-detection interception).
   - Keep fallbackIcon and typeLabel as required props.

2. Create src/components/media/pages/TvSeriesPageWrapper.tsx.
   - Own: episodeState, selectedSeason, seasonData, viewMode, overrideConfig.
   - Own: hydrateFromExisting — hydrates episodeState from loaded media.
   - Own: handleParentStatusClick — checks for episode conflicts before setting status;
     shows overrideConfig dialog if conflicts exist.
   - Own: handleConfirmOverride, handleCancelOverride — resolve the conflict dialog.
   - Own: episode override ConfirmDialog JSX (rendered in this wrapper, not in GenericMediaPage).
   - Compute: extraDirty = (JSON.stringify(episodeState) !== JSON.stringify(originalEpisodes)).
   - Render <GenericMediaPage
       mediaType="tv"
       episodeSlot={<EpisodeMatrix .../>}
       extraDirty={extraDirty}
       onExtraCancel={() => resetEpisodeState()}
       extraPatchFields={{ episodes: episodeState }}
       extraCreateFields={{ episodes: episodeState, runtime: totalRuntime }}
       onStatusChange={handleParentStatusClick}
       fallbackIcon={<Tv size={48}/>}
       typeLabel="TV Series"
       {...rest}
     />.
   - Pass EpisodeMatrix (full season selector + episode grid JSX from TvSeriesPage) as episodeSlot.

3. Update src/app/(protected)/media/movie/[tmdb_id]/page.tsx.
   - Change import from MoviePage → GenericMediaPage.
   - Pass showWatchedOn, fallbackIcon={<Film size={48}/>}, typeLabel="Movie".
   - No wrapper file is created for Movie.

4. Update src/app/(protected)/media/tv/[tmdb_id]/page.tsx.
   - Change import from TvSeriesPage → TvSeriesPageWrapper.

5. Delete src/components/media/pages/MoviePage.tsx.
6. Delete src/components/media/pages/TvSeriesPage.tsx.
```

**Human Actions Required:**
- None.

**Out of Scope:**
- `CollectionDetailPage.tsx`, `EpisodePage.tsx`, `NewCollectionPage.tsx` — not duplicated, not touched.
- `MediaHeroSection`, `StatusChipGroup`, `CollectionPicker`, `ReviewSection`, `StickyActionBar`, `UntrackConfirmation` — these remain as sub-components used internally by `GenericMediaPage`.

---

---

## Stage 4: GenericDomainPage — Main Domain Shell Standardization

> **Future.** Do not start until Stage 3 is reviewed and merged.

**The problem:** `TaskManagerView`, `EducationView`, `ExpenseView`, and `MedicalView` each independently implement:
- `useAuthBootstrap` + `Promise.all([fetchRows...])` data loading
- `useLocalStorage` for active view mode
- `useQueryModal` for query-param-driven modal state
- Page header with title, description, and back button
- `ErrorBanner` + loading guard

Additionally, `ExpenseView` and `MedicalView` use their own `MonthRow`/`MedicalMonthRow` components instead of the shared `GenericActiveBox` that Task and Education already use. Migration to `GenericActiveBox` happens here.

**The fix:** A `GenericDomainPage` absorbs the shell. It accepts:
- `loadData` callback (domain-specific fetch logic)
- `title`, `description`, `backHref`
- `activeView` / `onViewChange` (delegates to `useLocalStorage`)
- `children` / slot props for domain-specific box components (`ActiveTasksBox`, `MonthRow`, etc.)
- Modal rendering as a slot (domain provides the specific modal component)

**What gets deleted:**
- Duplicated shell code (auth bootstrap, page header, error banner, query-modal wiring) from each of the 4 domain view files
- `MedicalMonthRow.tsx` and `MonthRow.tsx` — replaced by `GenericActiveBox` opt-in for all 4 domains
- `TaskManagerView.tsx`, `EducationView.tsx`, `ExpenseView.tsx`, `MedicalView.tsx` shrink from ~300 lines each to ~80 lines of domain-specific slot configuration
