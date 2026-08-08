# Global Architecture Refactor Roadmap

This document tracks the architectural refactoring of the application to eliminate duplicated page structure
and standardize all list-based, store, media, and domain views into composable opt-in generic pages.

There are **4 distinct generic page types** â€” each solving a different class of duplication.
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

## Stage 1: GenericViewPage â€” "View All" Standardization

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
| Row click â†’ edit modal | `onRowClick` | All domains |
| Priority-colored row borders | `rowClassName` callback | Tasks only |

### Column definitions (domain responsibility)

Each domain defines its own `ColumnDef<T>[]` array specifying the columns specific to that data type.
The generic page knows nothing about expense dates or task priorities â€” domains inject that via `render`.

### Phase 1A â€” Core Component & Initial Adopters âœ…

**Status: Implemented.**

**What was done:**
- `src/components/common/GenericViewPage.tsx` â€” Created
- `/taskmanager/completed/page.tsx` â€” Uses `GenericViewPage`
- `/taskmanager/notes/page.tsx` â€” Uses `GenericViewPage`
- `/education/completed/page.tsx` â€” Uses `GenericViewPage`

**What got deleted:**
- Hardcoded Priority-section JSX in `taskmanager/completed/page.tsx`
- Hardcoded Month-tile JSX in `taskmanager/completed/page.tsx`
- Local `VIEW_OPTIONS` constant in `taskmanager/completed/page.tsx`
- `src/components/common/GenericDataList.tsx` â€” replaced by `GenericViewPage.tsx`

#### Step-by-Step Plan (Phase 1A)

```
1. Create src/components/common/GenericViewPage.tsx, replacing GenericDataList.tsx.
   - Accept `views` prop as a subset of ["completion", "months", "priority"].
   - Internally manage view toggle state and render the correct layout strategy
     based on active view: flat GenericDataList for completion, MonthTile-grouped
     for months, Priority-section-grouped for priority.
   - Accept `yearFilter` and `monthFilter` as optional prop objects
     ({ selectedYear, availableYears, onChange }) â€” render YearDropdown /
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

### Phase 1B â€” Cleanups (View Options Standardization) âœ…

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

### Phase 1C â€” Expense & Medical "View All" âœ…

**Status: Implemented.**

**Two new routes, both using GenericViewPage.**

**Expense `/expense/all`:**
- Opt-in: `views={["completion", "months"]}` (expenses have no priority)
- Opt-in: `yearFilter` + `monthFilter` (year + month dropdown in header)
- Columns: Date, Description, Category, Amount, Receipt icon
- Row click â†’ open `ExpenseModal`
- No priority view (expenses are not prioritized)

**Medical `/medical/all`:**
- Opt-in: `views={["completion", "months"]}` (no priority in medical)
- Opt-in: `yearFilter` + `monthFilter`
- Columns: Date, Description, Provider, Cost, Receipt icon
- Row click â†’ open `MedicalModal`

**Changes to existing components:**
- `MonthRow.tsx` â€” Replace `showAll` inline toggle with `router.push(ROUTES.EXPENSE_ALL + '?year=X&month=Y')`
- `MedicalMonthRow.tsx` â€” Same, replace `showAll` toggle with route navigation

**What got deleted:**
- `showAll` state and inline expansion logic in `MonthRow.tsx`
- `showAll` state and inline expansion logic in `MedicalMonthRow.tsx`
- `src/components/expense/FullMonthModal.tsx` â€” pre-built but unused, superseded by the new route

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

## Stage 2: GenericStorePage â€” Store Standardization

> **Complete.**

**The problem:** Every domain store page (`taskmanager/store`, `expense/store`, `education/store`, `medical/store`) and `VaultDocumentsView` independently implements identical boilerplate: `getSession` auth init, two `useEffect` hooks for data loading, a `refreshAll` `useCallback`, a `refreshTrigger` `useState`, and `parentRecords` derivation. `GlobalStoreView` is only a display component â€” it has no data-fetching responsibility. This boilerplate is copy-pasted verbatim across 5 files.

**The fix:** Create `GenericStorePage` as a data-fetching + auth wrapper that resolves `userId`, fetches domain data and documents together, manages the refresh cycle, derives parent records, and then delegates display entirely to `GlobalStoreView`. Each domain page is reduced to passing its domain-specific fetch callbacks and its modal slot.

### Opt-in features (centrally defined, domain chooses)

| Opt-in | Prop | Used By |
|---|---|---|
| Store type | `storeType: "doc" \| "record"` | All adopters (required) |
| Domain for document scoping | `domain: string` | Doc stores (passed to `GlobalStoreView`) |
| Parent records for linking | `fetchParentRecords` callback | taskmanager, expense, education, medical, vault/documents |
| Inline modal for linked doc click | `onLinkedRecordClick` callback | taskmanager (NoteModal), expense (ExpenseModal) |
| Standalone upload â†’ create parent | `onStandaloneUpload` callback | taskmanager only |
| Title, description, back link | `title`, `description`, `backHref` | All adopters |

### Phase 2A â€” Core GenericStorePage Component âœ…

**Status: Implemented.**

**What changes:**
- Create `src/components/common/store/GenericStorePage.tsx`.
  - Absorbs: `getSession` auth bootstrap, `useEffect` data loading, `refreshAll` pattern, `refreshTrigger` state, `parentRecords` derivation.
  - Accepts a `fetchData` callback `(userId: string) => Promise<{ domainRows: T[], documents: Document[] }>` so domains provide their own fetching logic.
  - Accepts a `deriveParentRecords` callback `(rows: T[]) => { id: string; name: string }[]`.
  - When `storeType === "doc"`: renders `GlobalStoreView` with all resolved props.
  - When `storeType === "record"`: renders `VaultRecordView` (future Phase 2B).

**What gets deleted:**
- The auth + data loading boilerplate block (lines 30â€“86) duplicated across all 4 domain store page files.
- `VaultDocumentsView.tsx` â€” fully absorbed into the generic with `storeType="doc"` + `domain="vault"`.

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
- Vault record stores (Banks, Passwords, Records) â€” Phase 2B.

---

### Phase 2B â€” Vault Record Stores âš ï¸

**Status: Incorrectly implemented.**

**What was intended:** `GenericStorePage` absorbs all boilerplate from the 3 vault record view files. `VaultRecordView` and `GlobalStoreView` were to be deleted â€” they are middle-layer display components that should not exist. Every adopter renders `<GenericStorePage>` directly, and `GenericStorePage` owns 100% of the UI.

**What was actually done:** The boilerplate (`useVaultSection`, `useSelection`, `useDeleteConfirm`) was moved into `GenericStorePage`, but `VaultRecordView` (305 lines) and `GlobalStoreView` (698 lines) were **kept alive** as separate display layers that `GenericStorePage` delegates to. `BankDetailView` was explicitly scoped out and still bypasses `GenericStorePage` entirely, calling `VaultRecordView` directly. This violates the architecture.

**Correct target state** (to be completed in Phase 2C):
- `GenericStorePage` is the **only** store UI component â€” it owns tiles, search, list/tile toggle, bulk bar, header, theming, and all modals internally.
- `GlobalStoreView.tsx` â€” **deleted**
- `VaultRecordView.tsx` â€” **deleted**
- `BankDetailView.tsx` â€” **deleted**, replaced by a thin `<GenericStorePage storeType="record">` wrapper with `headerActions` (Delete Bank button) and PIN-level `onActionClick` as opt-ins.

---

### Phase 2C â€” Collapse Display Layers into GenericStorePage â¬œ

**Status: Not started.**

**The problem:** `GenericStorePage` currently delegates rendering to two separate display components (`GlobalStoreView` for doc stores, `VaultRecordView` for record stores), both of which own their own UI logic (tiles, search bar, tile/list toggle, bulk bars, modals). This defeats the entire point: the UI is still fragmented across 3 components instead of 1.

**The fix:** Absorb all UI logic from both `GlobalStoreView` and `VaultRecordView` directly into `GenericStorePage`. The `storeType` prop switches the rendering mode internally. All opt-in UI elements (bulk rename, bulk link, headerActions, tileLayout, domain theming) become props on `GenericStorePage` directly.

**What gets deleted:**
- `src/components/common/store/GlobalStoreView.tsx` â€” fully absorbed into `GenericStorePage`
- `src/components/vault/VaultRecordView.tsx` â€” fully absorbed into `GenericStorePage`
- `src/components/vault/banks/BankDetailView.tsx` â€” replaced by a thin `<GenericStorePage>` wrapper

**Current adopters that call `GenericStorePage` (all correct after 2C):**
- `taskmanager/store/page.tsx` â€” `storeType="doc"`
- `expense/store/page.tsx` â€” `storeType="doc"`
- `education/store/page.tsx` â€” `storeType="doc"`
- `medical/store/page.tsx` â€” `storeType="doc"`
- `vault/documents/page.tsx` â€” `storeType="doc"`
- `vault/passwords/PasswordView.tsx` â€” `storeType="record"`
- `vault/records/RecordsView.tsx` â€” `storeType="record"`
- `vault/banks/BankListView.tsx` â€” `storeType="record"` + `onActionClick â†’ router.push(VAULT_BANK_DETAIL)`
- `vault/banks/[id]/page.tsx` (new, replaces BankDetailView) â€” `storeType="record"` + `headerActions={<Delete Bank>}` + `onActionClick â†’ open BankPinModal`

**Opt-in features all domains choose from (all centrally defined in GenericStorePage):**

| Opt-in | Prop | storeType |
|---|---|---|
| Domain theming (colors) | `domain` | `doc` only |
| File tile grid | `storeType="doc"` | â€” |
| Record tile grid / list toggle | `storeType="record"` | â€” |
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
- Any changes to `StoreDocumentModal`, `BulkLinkModal`, `TileView`, `DataListView` â€” these remain as sub-components used internally by `GenericStorePage`.

---

## Stage 3: GenericMediaPage â€” Media Detail Standardization

> **Current focus.** Do not start until Stage 2 commit is verified.

### What GenericMediaPage replaces

Both `MoviePage.tsx` (368 lines) and `TvSeriesPage.tsx` (764 lines) independently implement the following identical structure:

**Shared state (copy-pasted verbatim):**
- `useMediaTracking({ tmdbId, userId, type, onRefresh })` â€” data fetch hook
- `status`, `rating`, `reviewNotes`, `collectionIds` â€” form state
- `originalMedia` snapshot for `isDirty` diffing
- `showRemove` + `collectionToRemove` â€” untrack/collection-remove flow
- `handleRemove` â€” calls `removeMedia`, resets all state
- `isTracked`, `title`, `year` â€” derived display values
- `useEffect` load + hydrate pattern
- `isDirty` `useMemo` â€” deep comparison vs `originalMedia`
- `doCancel` â€” resets form state to original
- `useNavigationGuard` â€” dirty-state nav interception
- `handleStatusClick` / `handleRatingChange` / `handleToggleCollection` / `handleRemoveCollectionClick` / `handleConfirmRemoveCollection`
- `handleSave` â€” builds patch + extraCreateFields, calls `save`, updates `originalMedia`

**Shared JSX structure (copy-pasted):**
- Loading guard â†’ spinner
- Error guard â†’ `BackButton + ErrorBanner`
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
- `hydrateFromExisting` â€” also hydrates `episodeState`
- `isDirty` includes episode state comparison
- `doCancel` also resets `episodeState`
- `handleParentStatusClick` â€” conflict detection before setting status
- `handleConfirmOverride` / `handleCancelOverride`
- `handleSave` patch also includes `episodes`
- Tab bar JSX (`tracking` | `episodes` tabs)
- Full episode matrix JSX (season selector sidebar + episode grid)
- Episode override `ConfirmDialog`

**Movie-only state and JSX (absorbed into `GenericMediaPage`, gated by `showWatchedOn` prop):**
- `watchedOn` state + `setWatchedOn` â€” declared inside `GenericMediaPage`, only active when `showWatchedOn=true`
- `handleStatusClick` auto-sets `watchedOn` to today when status â†’ "watched" (only when `showWatchedOn=true`)
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

### Phase 3A â€” Core GenericMediaPage Component â¬œ

**Status: Not started.**

**What changes:**
- Create `src/components/media/pages/GenericMediaPage.tsx`.
  - Absorbs: all shared state, all shared handlers, all shared JSX listed above.
  - Accepts `mediaType`, `tmdbId`, `userId`, `userName`, `userAvatarUrl`, `collections`, `onRefresh`.
  - Accepts `showWatchedOn?: boolean` â€” if true, passes `watchedOn` state to `StatusChipGroup`.
  - Accepts `episodeSlot?: ReactNode` â€” rendered as a second tab "Episodes" only when provided. The tab bar itself is internal to `GenericMediaPage` (rendered only when `episodeSlot` is provided).
  - Accepts `extraDirty?: boolean` â€” ORed with internal `isDirty`.
  - Accepts `onExtraCancel?: () => void` â€” called inside `doCancel` after resetting form state.
  - Accepts `extraPatchFields?: Partial<MediaPlaintext>` â€” merged into the save patch.
  - Accepts `extraCreateFields?: Partial<MediaPlaintext>` â€” merged into the save create fields.

**What gets deleted:**
- `src/components/media/pages/MoviePage.tsx` â€” fully absorbed into `GenericMediaPage`. No wrapper needed.
- `src/components/media/pages/TvSeriesPage.tsx` â€” all shared logic absorbed; TV-only episode state remains in a thin wrapper.

**New thin wrapper (TV only):**
- `src/components/media/pages/TvSeriesPageWrapper.tsx` â€” owns TV-only state (`episodeState`, `selectedSeason`, `seasonData`, `viewMode`, `overrideConfig`), TV-only handlers (`handleParentStatusClick` with conflict detection, `handleConfirmOverride`, `hydrateFromExisting`), and passes `episodeSlot={<EpisodeMatrix .../>}`, `extraDirty`, `onExtraCancel`, `extraPatchFields`, `extraCreateFields` into `<GenericMediaPage mediaType="tv">`.
- **No `MoviePageWrapper` is created** â€” `watchedOn` state is owned by `GenericMediaPage` internally and gated by `showWatchedOn`. The route page renders `GenericMediaPage` directly.

**Route pages updated:**
- `src/app/(protected)/media/movie/[tmdb_id]/page.tsx` â€” change import from `MoviePage` â†’ `GenericMediaPage` directly, with `showWatchedOn` prop.
- `src/app/(protected)/media/tv/[tmdb_id]/page.tsx` â€” change import from `TvSeriesPage` â†’ `TvSeriesPageWrapper`.

#### Step-by-Step Plan (Phase 3A)

```
1. Create src/components/media/pages/GenericMediaPage.tsx.
   - Move all shared state and handlers from MoviePage into this component.
   - Add showWatchedOn?: boolean prop.
     - If true: declare watchedOn state internally, pass to StatusChipGroup.
     - handleStatusClick auto-sets watchedOn to today when status â†’ "watched".
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
   - Own: hydrateFromExisting â€” hydrates episodeState from loaded media.
   - Own: handleParentStatusClick â€” checks for episode conflicts before setting status;
     shows overrideConfig dialog if conflicts exist.
   - Own: handleConfirmOverride, handleCancelOverride â€” resolve the conflict dialog.
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
   - Change import from MoviePage â†’ GenericMediaPage.
   - Pass showWatchedOn, fallbackIcon={<Film size={48}/>}, typeLabel="Movie".
   - No wrapper file is created for Movie.

4. Update src/app/(protected)/media/tv/[tmdb_id]/page.tsx.
   - Change import from TvSeriesPage â†’ TvSeriesPageWrapper.

5. Delete src/components/media/pages/MoviePage.tsx.
6. Delete src/components/media/pages/TvSeriesPage.tsx.
```

**Human Actions Required:**
- None.

**Out of Scope:**
- `CollectionDetailPage.tsx`, `EpisodePage.tsx`, `NewCollectionPage.tsx` â€” not duplicated, not touched.
- `MediaHeroSection`, `StatusChipGroup`, `CollectionPicker`, `ReviewSection`, `StickyActionBar`, `UntrackConfirmation` â€” these remain as sub-components used internally by `GenericMediaPage`.

---

---

## Stage 4: GenericDomainPage â€” Main Domain Shell Standardization

> **Future.** Do not start until Stage 3 is reviewed and merged.

### What the code actually looks like today

After reading all 4 domain views in full, the real duplication map is:

**Shared across all 4 (TaskManagerView, EducationView, ExpenseView, MedicalView):**
- `useAuthBootstrap` + `Promise.all([...])` data loading
- `BackButton` + `<h1>` + description paragraph â€” page header
- `<LoadingSpinner />` loading guard
- `<ErrorBanner />` error guard
- A domain modal rendered conditionally (query-param-driven)
- `useLocalStorage` for view mode state

**Shared by Expense + Medical only (not Task/Education):**
- `YearDropdown` + `selectedYear` state
- `expensesByMonth` / `recordsByMonth` derivation (grouped by month for selected year)
- `availableYears` derivation (distinct years from data + current year)
- `auto-scroll to current month tile` `useEffect`
- `BoxContainer` wrapping the month grid

**Shared by Task + Education only (not Expense/Medical):**
- `GenericActiveBox` with months/priority view toggle
- `ActiveTasksBox` / `ActiveEducationsBox` â€” left 3-col panel
- `CompletedTasksBox` / `CompletedEducationsBox` â€” right panel
- `useQueryModal` (Education uses it; TaskManager uses its own equivalent that will be replaced)

**Currently separate `MonthRow` patterns:**
- `MonthRow.tsx` (expense) â†’ `MonthTile` â†’ 5-cap preview + "View All" button â†’ `ROUTES.EXPENSE_ALL?year=X&month=Y`
- `MedicalMonthRow.tsx` (medical) â†’ `MonthTile` â†’ 5-cap preview + "View All" button â†’ `ROUTES.MEDICAL_ALL?year=X&month=Y`
- `GenericActiveBox` months view (task/education) â†’ `MonthTile` directly â†’ **no cap, no "View All"** â€” this is what we're standardizing

---

### Phase 4A â€” GenericMonthRow âœ…

**New file:** `src/components/common/GenericMonthRow.tsx`

**What it replaces:** `MonthRow.tsx` (expense) and `MedicalMonthRow.tsx` (medical), and the `MonthTile` usage inside `GenericActiveBox`'s months view.

**Props:**
```ts
interface GenericMonthRowProps<T> {
  monthName: string;
  monthIndex: number;        // 0-based
  year: number;
  items: T[];
  isCurrentMonth?: boolean;
  getSubtitle: (items: T[]) => ReactNode;   // e.g. "â‚¹ 3,200 Â· 4 items" or "3 records"
  renderTable: (items: T[]) => ReactNode;   // domain-specific table (ExpenseTable, MedicalTable, task list)
  viewAllHref: string;                      // route to navigate to for "View All"
  viewAllLabel?: string;                    // e.g. "View All January (8)" â€” auto-generated if omitted
}
```

**Behavior:**
- Shows latest 5 items (sorted by date desc) via `renderTable`
- Shows `footerActions` "View All {monthName} ({count})" button **only when `items.length > 5`**
- `isCurrentMonth` drives `defaultExpanded`, `highlight`, and the DOM `id="current-month-tile"` for auto-scroll
- Fully replaces `MonthRow` and `MedicalMonthRow`

**`GenericActiveBox` update (`src/components/common/GenericActiveBox.tsx`):**
- In the `view === "months"` branch, replace direct `<MonthTile>` with `<GenericMonthRow>` so Task/Education months view gets the 5-cap + "View All" button
- Requires passing `nowYear`, `getSubtitle`, `renderTable`, `viewAllHref` through from domain callers (`ActiveTasksBox`, `ActiveEducationsBox`)

**Files changed in Phase 4A:**
- `src/components/common/GenericMonthRow.tsx` â€” **NEW**
- `src/components/common/GenericActiveBox.tsx` â€” add `getSubtitle`, `renderTable`, `viewAllHref` props; use `GenericMonthRow` in months view
- `src/components/taskmanager/ActiveTasksBox.tsx` â€” pass new props to `GenericActiveBox`
- `src/components/education/ActiveEducationsBox.tsx` â€” pass new props to `GenericActiveBox`
- `src/components/expense/MonthRow.tsx` â€” **DELETE** (replaced by `GenericMonthRow`)
- `src/components/medical/MedicalMonthRow.tsx` â€” **DELETE** (replaced by `GenericMonthRow`)
- `src/components/expense/ExpenseView.tsx` â€” replace `<MonthRow>` with `<GenericMonthRow>`
- `src/components/medical/MedicalView.tsx` â€” replace `<MedicalMonthRow>` with `<GenericMonthRow>`
- `src/routes/paths.ts` â€” add `TASK_MANAGER_ALL` and `EDUCATION_ALL` routes
- `src/app/(protected)/taskmanager/all/page.tsx` â€” **NEW** route page; accepts `?year=X&month=Y` query params; mirrors `/expense/all` and `/medical/all` in structure
- `src/app/(protected)/education/all/page.tsx` â€” **NEW** route page; accepts `?year=X&month=Y` query params; mirrors same pattern

---

### Phase 4B â€” GenericDomainPage âœ…

**New file:** `src/components/common/GenericDomainPage.tsx`

#### Opt-in feature table

| Opt-in | Prop | Used by |
|---|---|---|
| Page title | `title: string` | All (required) |
| Page description | `description: string` | All (required) |
| Back href | `backHref: string` | All (required) |
| Data loader | `loadData: (uid: string) => Promise<void>` | All (required) |
| Main content body | `renderBody: (ctx) => ReactNode` | All (required) |
| Domain modal | `modalSlot?: ReactNode` | All |
| Header stat line | `headerStat?: ReactNode` | Expense (yearly total), Medical (record count) |
| Store button | `storeHref?: string; storeLabel?: string; storeIcon?: ReactNode` | All 4 |
| Completed items slot | `completedSlot?: ReactNode` | Task, Education |
| Misc slot | `miscSlot?: ReactNode` | Task Manager only (notes box) |

`renderBody` receives a context object `{ userId, istDate, nowYear, nowMonth, isLoading }` so the domain can render its specific content (month grid, priority view, etc.) using the auth data managed inside the generic page.

#### Layout rules (no visual change from current)

```
If completedSlot provided (Task, Education):
  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
  â”‚ renderBody()     â”‚ completedSlot      â”‚
  â”‚ (left, 2/3)      â”‚ + miscSlot         â”‚
  â”‚                  â”‚ (right, 1/3)       â”‚
  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜

If completedSlot NOT provided (Expense, Medical):
  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
  â”‚ BackButton    title   [storeBtn top-rt] â”‚
  â”‚ description   headerStat               â”‚
  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€ renderBody() full width â”€â”€â”€â”€â”€â”€â”€â”€â”
  â”‚ BoxContainer with month/table view      â”‚
  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

#### What each domain view's adoption looks like

**TaskManagerView after Stage 4:**
```tsx
<GenericDomainPage
  title="Task Manager"
  description="Track active tasks, completed tasks, and notes."
  backHref={ROUTES.DASHBOARD}
  loadData={loadAllData}
  storeHref={ROUTES.TASK_MANAGER_STORE}
  storeLabel="Notes Store"
  storeIcon={<FolderIcon />}
  completedSlot={<CompletedTasksBox ... />}
  miscSlot={<NotesBox ... />}
  modalSlot={taskModalTarget && <TaskModal ... />}
  renderBody={({ userId, istDate, nowYear, nowMonth, isLoading }) => (
    <ActiveTasksBox ... />
  )}
/>
```

**ExpenseView after Stage 4:**
```tsx
<GenericDomainPage
  title="Expenses"
  description="Track and manage your spending."
  backHref={ROUTES.DASHBOARD}
  loadData={loadData}
  storeHref={ROUTES.EXPENSE_STORE}
  storeLabel="Receipt Store"
  storeIcon={<FolderIcon />}
  headerStat={<p>Total for {selectedYear}: â‚¹ {yearlyTotal.toLocaleString("en-IN")}</p>}
  modalSlot={modalTarget && <ExpenseModal ... />}
  renderBody={({ isLoading }) => (
    /* BoxContainer + ViewToggle + YearDropdown + month grid of GenericMonthRow */
  )}
/>
```

Note: `selectedYear`, `viewMode`, `yearlyTotal`, `expensesByMonth` derivations â€” these **remain in ExpenseView**, passed into `renderBody` closure. `GenericDomainPage` does not own year/view state; it only owns auth, loading, error, header, and layout shell.

#### What gets deleted from each view

| View | Lines deleted |
|---|---|
| `TaskManagerView.tsx` | `useAuthBootstrap` block, `useRouter`/`useSearchParams` modal wiring, `setModalParam`/`clearModalParam`, header JSX, `ErrorBanner`, loading guard |
| `EducationView.tsx` | Same shell boilerplate |
| `ExpenseView.tsx` | Same shell boilerplate |
| `MedicalView.tsx` | Same shell boilerplate |

**TaskManager modal wiring** (`setModalParam`, `clearModalParam`, manual `useMemo` for `taskModalTarget`/`noteModalTarget`) gets replaced by two calls to `useQueryModal` â€” one for tasks, one for notes â€” since `useQueryModal` supports any prefix string. These calls live inside `TaskManagerView` before it passes `modalSlot` to `GenericDomainPage`.

**Files changed in Phase 4B:**
- `src/components/common/GenericDomainPage.tsx` â€” **NEW**
- `src/components/taskmanager/TaskManagerView.tsx` â€” adopt `GenericDomainPage`; replace manual modal wiring with `useQueryModal` Ã— 2
- `src/components/education/EducationView.tsx` â€” adopt `GenericDomainPage`
- `src/components/expense/ExpenseView.tsx` â€” adopt `GenericDomainPage`
- `src/components/medical/MedicalView.tsx` â€” adopt `GenericDomainPage`

---

### Step-by-Step Plan

```
Phase 4A:
1. âœ… Add TASK_MANAGER_ALL = "/taskmanager/all" and EDUCATION_ALL = "/education/all"
   to src/routes/paths.ts.
   Create src/app/(protected)/taskmanager/all/page.tsx â€” mirrors /expense/all and
   /medical/all in structure: accepts ?year=X&month=Y, fetches tasks for that
   period, renders them in a full table view using the existing GenericViewPage.

   Create src/app/(protected)/education/all/page.tsx â€” same pattern for educations.

2. âœ… Create src/components/common/GenericMonthRow.tsx.
   - Generic MonthTile wrapper accepting items: T[], getSubtitle, renderTable, viewAllHref.
   - Shows 5 latest items (sorted by date desc).
   - Shows footerActions "View All" button only when items.length > 5.

3. âœ… Update src/components/common/GenericActiveBox.tsx.
   - Add getSubtitle, renderTable, viewAllHref props.
   - Replace <MonthTile> in months view with <GenericMonthRow>.
   - Pass nowYear into GenericMonthRow for the viewAllHref construction.

4. âœ… Update src/components/taskmanager/ActiveTasksBox.tsx.
   - Pass getSubtitle, renderTable, viewAllHref to GenericActiveBox.

5. âœ… Update src/components/education/ActiveEducationsBox.tsx.
   - Pass getSubtitle, renderTable, viewAllHref to GenericActiveBox.

6. âœ… Update src/components/expense/ExpenseView.tsx.
   - Replace <MonthRow> with <GenericMonthRow>.

7. âœ… Update src/components/medical/MedicalView.tsx.
   - Replace <MedicalMonthRow> with <GenericMonthRow>.

8. âœ… Delete src/components/expense/MonthRow.tsx.
9. âœ… Delete src/components/medical/MedicalMonthRow.tsx.

Phase 4B:
10. âœ… Create src/components/common/GenericDomainPage.tsx.
    - Owns: page header, LoadingSpinner, ErrorBanner, layout shell.
    - Accepts all opt-in props as described above.
    - Implements dual-column layout when completedSlot provided; full-width otherwise.

11. âœ… Update src/components/taskmanager/TaskManagerView.tsx.
    - Replace manual modal wiring with useQueryModal Ã— 2 (tasks + notes).
    - Adopt GenericDomainPage.

12. âœ… Update src/components/education/EducationView.tsx.
    - Adopt GenericDomainPage.

13. âœ… Update src/components/expense/ExpenseView.tsx.
    - Adopt GenericDomainPage (build on top of Phase 4A changes).

14. âœ… Update src/components/medical/MedicalView.tsx.
    - Adopt GenericDomainPage (build on top of Phase 4A changes).
```

### Human Actions Required

- None. Creating `/taskmanager/all` and `/education/all` routes is part of Phase 4A step 1 above.

### Out of Scope for Stage 4
- `TaskModal`, `NoteModal`, `ExpenseModal`, `MedicalModal`, `EducationModal` â€” not touched
- CRUD handler logic inside domain views â€” stays domain-owned, unchanged
- `GenericStorePage`, `GenericMediaPage` â€” already complete from Stages 2 and 3


## Stage 5: Structural Loop Deduplication

> **Complete.**

### What Stage 5 replaces

Both `GenericActiveBox` and `GenericViewPage` manually iterated over priority groups and month groups with nearly identical JSX: the `<section>` wrapper for priorities, the `<MonthTile>` wrapper for months, the "View All" button logic, and the empty-state handling. `GenericMonthRow` still implemented its own raw grid-cols-12 column mapping (missed during Phase 4A's grid consolidation).

### Components created

| Component | What it absorbs |
|---|---|
| `GenericPriorityList` | Priority-group mapping loop + section wrapper + "View All" button |
| `GenericMonthsList` | Month-group mapping loop + MonthTile/GenericMonthRow switching |
| `GenericMonthRow` (upgraded) | Now uses `GenericDataGrid` internally; accepts `previewCount` for capped previews |

### Phase 5A — GenericMonthRow Upgrade

**File:** `src/components/common/GenericMonthRow.tsx`

- Replaced manual `gridSpan`/`HEADER_CLASSES`/row-mapping JSX with a single `<GenericDataGrid>` call.
- Added `previewCount?: number` prop — when set, caps displayed items and shows the "View All" button; when omitted, shows all items without a "View All" link.
- Added `getItemKey` prop (required by `GenericDataGrid`).
- Removed the `gridSpan` helper — all column spanning is now handled by Tailwind `col-span-N` via `GenericDataGrid`.

### Phase 5B — GenericPriorityList

**File:** `src/components/common/GenericPriorityList.tsx` (NEW)

- Accepts `priorities`, `getItems(priority) => T[]`, `getColors(priority) => { border, bg }`, `renderBadge(priority) => ReactNode`.
- Uses callback props (`getItems`, `getColors`, `renderBadge`) so both callers can adapt their own data shapes: `GenericActiveBox` uses `Record<string, T[]>` from `byPriority()`, while `GenericViewPage` uses `PriorityGroup<T>[]`.
- Maps over priorities -> renders `<section>` with priority-specific border/bg colours -> delegates item rendering to `<GenericDataGrid>`.
- `previewCount?: number` — when set, slices items and shows "View All ({count})" button; when omitted, shows all items with no "View All" link.
- `hideEmpty?: boolean` — when true, skips empty priority groups entirely (used by `GenericViewPage` full view); when false, shows "None" placeholder (used by `GenericActiveBox`).

### Phase 5C — GenericMonthsList

**File:** `src/components/common/GenericMonthsList.tsx` (NEW)

- Two rendering modes controlled by `previewCount`:
  - **Preview mode** (`previewCount` set): renders `<GenericMonthRow>` for each standard month, with capped items and a "View All" button. Falls back to `<MonthTile>` + `<GenericDataGrid>` for non-standard months (e.g. "Past Years", "Unscheduled").
  - **Full mode** (`previewCount` omitted): renders `<MonthTile>` + `<GenericDataGrid>` for each month group, with `isCurrentMonth` highlighting via `selectedYear` prop and `defaultExpanded` on the first tile.
- Accepts `getSubtitle`, `getDate`, `viewAllBaseHref` for preview mode; `hideHeaderOnMobile`, `rowClassName` for full mode.

### Phase 5D — Caller Refactoring

**GenericActiveBox** (`src/components/common/GenericActiveBox.tsx`):
- Priority view -> `<GenericPriorityList previewCount={5} .../>`
- Months view -> `<GenericMonthsList previewCount={5} .../>`
- Removed direct imports of `MonthTile`, `GenericMonthRow`, `GenericDataGrid`, `useRouter`.
- Added optional `getItemKey` prop (defaults to `(item) => item.id`).

**GenericViewPage** (`src/components/common/GenericViewPage.tsx`):
- Priority view -> `<GenericPriorityList hideEmpty .../>`
- Months view -> `<GenericMonthsList .../>`
- Removed direct imports of `MonthTile`, `MONTH_NAMES`.

**ExpenseView / MedicalView:**
- Added `getItemKey` and `previewCount={5}` props to their direct `<GenericMonthRow>` calls (these views use `GenericMonthRow` directly, not through `GenericMonthsList`, because they have a custom multi-column layout).

### Files changed in Stage 5

| File | Action |
|---|---|
| `src/components/common/GenericMonthRow.tsx` | MODIFY — use GenericDataGrid, add previewCount/getItemKey |
| `src/components/common/GenericPriorityList.tsx` | NEW |
| `src/components/common/GenericMonthsList.tsx` | NEW |
| `src/components/common/GenericActiveBox.tsx` | MODIFY — delegate to GenericPriorityList/GenericMonthsList |
| `src/components/common/GenericViewPage.tsx` | MODIFY — delegate to GenericPriorityList/GenericMonthsList |
| `src/components/expense/ExpenseView.tsx` | MODIFY — add getItemKey + previewCount to GenericMonthRow |
| `src/components/medical/MedicalView.tsx` | MODIFY — add getItemKey + previewCount to GenericMonthRow |

### Out of Scope for Stage 5

- Stage 6 (Generic Modal Shell) — deferred.
- Any changes to domain modals, CRUD hooks, or query hooks.
- `GenericStorePage` display-layer collapse (Phase 2C).

---

## Stage 6: Generic Modal Shell

**Goal:** Create a unified `GenericDomainModal` shell to eliminate the exact structural duplication across `TaskModal`, `ExpenseModal`, `EducationModal`, and `MedicalModal`.

**Implementation:**
- Extract the common Dialog overlay, Title header, standard padding, and responsive constraints.
- Centralize the Action footer (Save/Delete/Cancel buttons) and their loading states.
- Centralize the Document attachment UI (Paperclip, file list, upload logic).
- Make it an opt-in wrapper where domains only need to provide their specific inner `<form>` fields as `children`.
