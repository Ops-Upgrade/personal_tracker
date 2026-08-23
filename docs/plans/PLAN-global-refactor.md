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

## Stage 6: Generic Modal Shell (Schema-Driven)

**Goal:** Create a unified, fully schema-driven `GenericDomainModal` shell to completely eliminate all individual domain modal files (`TaskModal`, `ExpenseModal`, `EducationModal`, `MedicalModal`, Vault modals, and Store modals).

**Architecture:**
- **Two-Pane Layout:** A flexible flex container split into a Left Pane and a Right Pane. If a domain opts out of the Right Pane, the Left Pane expands/centers (e.g., `max-w-lg`).
- **100% Schema-Driven Forms:** The generic modal no longer accepts React `children`. Instead, it accepts a `fields` schema (e.g., `[{ key: 'name', type: 'text', label: 'Record Name' }]`) and `initialData`. 
- **Centralized State Management:** The generic shell completely owns the form state (`formData`), dirty checking (comparing `formData` against `initialData`), and complex file management state (`newFiles`, `markedForDeletion`, `isSaving`, `error`). 
- **Mode Switcher:** Driven by a fundamental `mode` prop.

**Implementation Details by Mode:**

1. **`mode="record"`**
   - **Left Side (Record View):** The Generic Modal dynamically renders standard inputs, rich text editors, and date pickers based on the `fields` schema prop.
   - **Right Side (File View):** Controlled by an `allowFiles={true}` flag.
     - If true, mounts the multi-file uploader and handles complex file states.
     - If false, the right side disappears.
   - **The Hand-off:** On "Save", the Generic Modal packages file changes and passes them to the domain's `onSave` along with the live `formData` object.

2. **`mode="standalone_file"`**
   - **Right Side (Only One File):** Locks the file uploader to a single file limit.
   - **Left Side (Link / Create):** Automatically renders the standardized dropdown to "Select Existing Record" and an "Or Create New" toggle.
   - **The Hand-off:** On "Save", hands the domain 1 file and the ID of the record to link (or the data for the new record to create).

**Domain Opt-In Matrix (Passed directly from Views):**
- **Task Manager:** `mode="record"`, opts out of files.
- **Task Manager Notes:** `mode="record"`, opts into files.
- **Expense / Medical:** `mode="record"`, opts into files.
- **Education:** `mode="record"`, opts into files.
- **Store Modals (Education/Vault):** `mode="standalone_file"`. Single file on the right, linking/creation on the left.
- **Vault Passwords / Banks:** `mode="record"`, opts out of files.
- **Vault Personal Record:** `mode="record"`, opts into files.
- **Completed Views:** Use `GenericCompletedModal` directly.
- **Media:** No global modal usage.

**Strict Enforcement & Clean-up:**
- **Delete Modals:** You must explicitly DELETE all standalone modal files (`TaskModal.tsx`, `NoteModal.tsx`, `ExpenseModal.tsx`, `EducationModal.tsx`, `MedicalModal.tsx`, `RecordModal.tsx`, `PasswordModal.tsx`, `BankModal.tsx`, `BankPinModal.tsx`, `StoreDocumentModal.tsx`). **Do not leave them as wrappers.**
- **Update Views:** Update all Domain Views (e.g., `TaskView.tsx`, `MedicalView.tsx`) to directly render `<GenericDomainModal fields={schema} initialData={record} onSave={...} />`.
- **State Cleanups:** `src/hooks/useModalBaseState.ts`, `src/lib/useModalDocumentState.ts` (Their logic merges completely into the generic shell, delete them).
- **Delete:** `src/components/common/GlobalActionModal.tsx` (fully replaced by `GenericDomainModal.tsx`).

---

## Stage 7: The "Inside-Out" Architecture Fix (Strict Opt-In)

> **Current focus.**

### The Core Problem
The current "Generic" architecture in Stage 4 and Stage 6 was implemented inside-out. The generic components were built as dumb outer wrappers (`<BoxContainer>`, flex grids) while the domains were forced to retain all the complex structural logic.

- `GenericViewPage` expects the domain to pre-calculate `availableYears`, `availableMonths`, apply filters, and manage `useTableSort` and `useSelection` locally.
- `GenericStorePage` expects the domain to pass 10 different complex CRUD handler functions and manually declare modal closures.
- `GenericDomainPage` uses `renderBody={() => ...}` to offload the entire dashboard layout (and month grids) back to the domain.
- **The Result:** The 4 domains copy-paste ~2,000 lines of identical logic across their `/all`, `/completed`, `/store`, and dashboard pages. 

Domain-Specific Violations (These MUST be deleted):
1. **TaskManager & Education:** Hardcode their own redundant `MonthTile` logic in their View pages (bypassing `GenericMonthRow` limits).
2. **Expense & Medical:** Pass `!!e.date` and `!!m.date` hardcoded guardrails into their CRUD hooks, which should be handled generically by the schema validation inside `GenericDomainModal`.
3. **All Domains:** Forcefully dictate their own modal visibility state (`useState`), `useRouter` query-param wiring, and manual `createSaveAdapter` wiring inside their wrappers, rather than letting the generic modal handle it.

### Ideal State Definition Matrix

To achieve the ideal "opt-in" architecture, the Generic Components must absorb all structural logic. Domains must only define the following parameters:

#### 1. GenericViewPage (Lists & Aggregations)
**What it must own internally (No Domain Code Allowed):**
- **Year dropdown** — always visible, always-present core feature. Derived from `data` + `getDateKey`. All displayed data (flat list, month groups, priority groups) is strictly filtered to the selected year. This dropdown must never disappear regardless of which `supportedViews` are active.
- Derivation of `availableMonths` and `priorityGroups` (scoped to `selectedYear`).
- Filtering logic (`itemsForYear`, `itemsForMonth`).
- `useTableSort` state and handlers.
- **Selection checkboxes** — always present as an inherent feature. Behavior matches `GenericStorePage` exactly: hidden by default on desktop (`md:opacity-0 md:group-hover:opacity-100`), permanently visible on mobile (`opacity-100`). When rows are selected, a bulk action bar appears showing only a Delete button. Checkboxes are never gated by a prop — they exist on every `GenericViewPage`. The bulk delete action itself is opt-in via `onBulkDelete`.
- URL query param synchronization for year/month.

**What domains opt-in / configure:**
- `data: T[]` (Raw un-filtered data)
- `columns: ColumnDef<T>[]` (Strict declarative styling schema—no `render` functions. Generic page also natively strips 'priority' column when in priority view)
- `cacheKeyPrefix: string` (e.g., "taskmanager_completed" for route-specific secure caching)
- `defaultSort: { column: string, direction: "asc" | "desc" }`
- `supportedViews: ("all" | "months" | "priority")[]`
- `getDateKey: (item: T) => string | null` (For internal month/year grouping and year dropdown derivation)
- `getPriorityKey?: (item: T) => string` (For internal priority grouping)
- `onRowClick?: (item: T) => void` (To trigger domain-specific edit modals)
- `rowClassName?: string | ((item: T) => string)` (e.g., for priority-colored row borders)
- `itemNamePlural?: string` (Generic page builds complex empty state messages natively, e.g., "expenses")
- `metrics?: { label: string, value: string | number, format?: string }[]` (Generic page renders the stats UI)
- `onBulkDelete?: (ids: string[], clearFn: () => void) => void` (When provided, the bulk Delete button is shown in the action bar when rows are selected. When absent, the action bar never appears even though checkboxes are present.)

> [!IMPORTANT]
> **Stage 7 Special Considerations (QoL Safeguards)**
> - **Selection Checkboxes & Bulk Delete**: Checkboxes are an inherent, always-present feature of every `GenericViewPage` — identical behavior to `GenericStorePage`: hidden on desktop until row hover (`md:opacity-0 md:group-hover:opacity-100`), permanently visible on mobile (`opacity-100`). The only bulk action is Delete, driven by the `onBulkDelete` prop. If `onBulkDelete` is not provided, the bulk action bar never appears (checkboxes are present but selecting rows does nothing visually). Injections of raw JSX for action bars are strictly banned.
> - **Year Dropdown is Non-Optional**: The year dropdown is a core, always-present UI element. It must be rendered in every `GenericViewPage` regardless of which `supportedViews` are active. All data — flat lists, month groups, and priority groups — must be filtered to the selected year before display. No view or configuration may bypass this filter.
> - **Breaking API Change from Current Implementation**: The current `GenericViewPage` accepts pre-filtered `items`, `yearFilter`, and `monthFilter` as external props — the domain owns the year state. This is the exact violation being fixed. The new `GenericViewPage` must:
>   1. Accept `data: T[]` (raw, unfiltered) instead of `items`.
>   2. Own `selectedYear` state internally — derived from `data` via `getDateKey`, defaulting to current year.
>   3. Remove `yearFilter`, `monthFilter`, `monthGroups`, `priorityGroups` from its props entirely. These are derived internally.
>   4. Every adopting route stops pre-filtering data and stops computing `availableYears`, `tasksForYear`, `priorityGroups` etc. — those ~50 lines per route are deleted, which is the source of the line-count reduction to ~40 lines.
>   5. `getDateKey` is required (non-optional) for all routes that have date-based data. For `/taskmanager/notes`, `getDateKey={(n) => n.created_at}` enables year filtering even though there is no months view — notes from past years are correctly hidden.
> - **Declarative Column Styling (No JSX Injections)**: The `ColumnDef` schema must be expanded to accept semantic design tokens (`weight`, `color`, `trueLabel`, `falseColor`) instead of inline `render` functions. The generic engine will parse these tokens to construct the DOM and Tailwind classes internally, ensuring domains cannot dictate UI layout or inject arbitrary JSX into table cells.
> - **View & Sort Caching (Route-Specific)**: Different pages under the same domain have different view toggles. The generic component MUST use the provided `cacheKeyPrefix` to generate secure cache keys per-route so that preferences on one page don't corrupt another. It must also enforce the provided `defaultSort` when no sort is cached.
> - **3-State Sort Cycle**: The generic wrapper must internalize the custom `asc -> desc -> none` loop and apply it transparently to the grid.
> - **Safe Metrics Layout**: The generic component must ensure that the `metrics` configuration securely lays out standard stat blocks above the grids without interfering with internal view toggles or search bars.
> - **Strict Record Grids**: Domains like `/taskmanager/notes` must NOT render mixed grids (combining db records with standalone files). Standalone files belong exclusively in the Store. The notes view must only display proper note records.
> 
> **Pre-Existing Working Tree State (Continuation Notes — Read Before Implementing)**
> - **`GenericViewPage` Already Has Old-Style External Selection Props**: The working tree already contains `selectionKeys`, `onToggleSelection`, `onSelectAll`, `onClearSelection`, `bulkActionBar` as external props on `GenericViewPage`. These are the old domain-managed selection pattern **being replaced** by this plan. Do not extend them — remove them and replace with the internal checkbox model + `onBulkDelete`.
> - **`useSelection` and `useTableSort` Already Modified**: Both hooks have uncommitted additions. Their call sites in domain route files (`/taskmanager/all`, `/taskmanager/completed`, etc.) will be **deleted** as part of this plan — these hooks move inside `GenericViewPage`. Do not add new external call sites.
> - **`MonthFilterValue = "unscheduled"` Already Added**: The type `MonthFilterValue = number | "all" | "unscheduled"` already exists in the working tree. Preserve it and wire the `"unscheduled"` value into the internal `MONTHS.map` Unscheduled bucket logic.
> - **`viewHelpers.ts` Contains Grouping Helpers Already in Use**: `viewHelpers.ts` has ~49 lines of uncommitted additions containing `byPriority`, `completedByMonths`, or similar grouping utilities currently called from route files. After this refactor, these move **inside** `GenericViewPage` — delete the route-level call sites, do not re-import them in routes.
> 
> **Mobile Considerations (Must Preserve)**
> - **Subgrid Architecture (No Stacked Cards)**: Enforces a rigid CSS subgrid with a horizontal scroll wrapper (`overflow-x-auto`). Flex columns (`minmax(6rem, weightFr)`) never squish below 6rem. Fixed columns (`minmax(max-content, 0fr)`) lock tightly to content on mobile. Declarative Styling tokens must compile into this exact math.
> - **Mobile Bulk Action Wrapping**: The bulk action bar forces itself onto a new row by taking full width and shifting flex order (`order-2 w-full`) on mobile, while aligning horizontally on desktop (`sm:w-auto sm:order-3`). The `bulkActions` array configuration must be rendered natively to obey these breakpoints.
> - **Double-Header Flex Wrapping**: The top header uses `flex flex-wrap justify-between`. On narrow screens, the Year/Month filters wrap neatly beneath the left-aligned ViewToggle. Any injected metrics must mount securely without breaking this flow.
> - **Touch Target Protections**: `GenericDataGrid` rows have a generous touch area (`py-1.5 px-2`). To prevent accidental row clicks on small screens, they use strict `e.stopPropagation()` and `e.target.closest("button...")` checks. Declarative toggles/buttons inside columns must maintain these bubbling stops.
> - **Touch-Target Visibility (No Hover)**: Any inline row actions and selection checkboxes must be permanently visible on mobile (`opacity-100`). Since mobile devices do not have a hover state, they cannot rely on the desktop-style hover-to-reveal behavior (`md:opacity-0 md:group-hover:opacity-100`).

**Exhaustive List of Adopting Routes:**
Out of the 29 route pages in the app, these 7 routes are lists/aggregations and must opt into `GenericViewPage`, dropping all internal structural logic and reducing to ~40 lines each:

1. **`/taskmanager/all` & `/taskmanager/completed`**
   - `supportedViews={["all", "months", "priority"]}`
   - `getDateKey={(t) => t.due_date}`
   - `getPriorityKey={(t) => t.priority}`

2. **`/taskmanager/notes`**
   - `supportedViews={["all"]}` *(flat list only — no months view, no priority concept)*
   - `getDateKey={(n) => n.created_at}` *(Required for year filtering — notes from past years must not appear. No months view, but year dropdown still controls which notes are shown.)*
   - `getPriorityKey={undefined}`

3. **`/education/all` & `/education/completed`**
   - `supportedViews={["all", "months", "priority"]}`
   - `getDateKey={(e) => e.due_date}`
   - `getPriorityKey={(e) => e.priority}`

4. **`/expense/all`**
   - `supportedViews={["all", "months"]}` *(no priority concept)*
   - `getDateKey={(e) => e.date}`
   - `getPriorityKey={undefined}`

5. **`/medical/all`**
   - `supportedViews={["all", "months"]}` *(no priority concept)*
   - `getDateKey={(m) => m.date}`
   - `getPriorityKey={undefined}`

> [!NOTE]
> **Stage 7 Pass 1 status — IMPLEMENTED (2026-08-22).** `GenericViewPage` now accepts raw `data` + `cacheKeyPrefix` and internally owns: year dropdown (always visible, derived from `data`+`getDateKey`, URL-synced via `year`/`month` query params — back/forward navigation works), month filtering, the `useTableSort` 3-state cycle with per-route localStorage cache, selection checkboxes (hover-reveal on desktop, always visible on mobile) with the `onBulkDelete` Delete action bar, and the `metrics` stat blocks. `ColumnDef` now takes declarative `ColumnToken` cells (`text`/`date`/`richtext`/`badge`/`files`/`boolean` with `weight`, `color`, `capitalize`, `size`, `prefix`, `localeFormat`, `trueLabel`/`falseColor`); routes pass no `render` JSX. All 7 adopting routes are gutted to ~40-line configs; route-level `useSelection`/`useTableSort`/grouping call sites deleted.
>
> Deviations from this spec (deliberate):
> - Completed routes (`/taskmanager/completed`, `/education/completed`) use `getDateKey={(t) => t.completed_at}` + the new `monthsMode="completed"` prop instead of the literal `due_date` above — pre-existing behavior grouped and year-filtered completed pages by completion date (the `due_date` line here was judged a copy-paste artifact of the active-route config).
> - `Metric.value` may also be `(visibleItems: T[]) => string | number` so `/expense/all`'s "Total spent" totals the year+month-filtered items, not the whole dataset.
> - Bulk delete is wired for real on all 7 routes (spec only mandated checkboxes; the old pages had skeleton-only action bars).
> - `ColumnDef.token` is optional — the legacy `render` escape hatch remains for unmigrated widget cells (box name cells, NotesBox branching cell, the Reopen action button); GenericViewPage routes use tokens only.

#### 2. GenericStorePage (File & Record Stores)

**What it must own internally (No Domain Code Allowed):**
- All `useEffect` data loading and `refreshAll` logic.
- All CRUD handlers for linking/unlinking/deleting documents (it will internally map the `domain` prop to the correct API adapter).
- The `GenericDomainModal` instantiation for editing linked parent records or standalone vault records.
- Standalone file upload handling and inline parent-creation forms.
- **Search bar** — always present, owned internally. `searchPlaceholder` is an optional cosmetic override.
- **Tiles/List view toggle** — always present, persisted per-domain via internal `useLocalStorage`.

**What domains opt-in / configure:**
- `storeType: "doc" | "record"`
- `domain: "taskmanager" | "expense" | "education" | "medical" | "vault" | "vault_banks" | "vault_bank_details" | "vault_passwords" | "vault_records"`
- `modalFields: FieldDef[]` (To feed the internally-managed modal)
- `allowAdd?: boolean` *(default: `false`) — opt-in to show the Add button and enable file/record creation from the store. Routes that do not pass `allowAdd={true}` get no Add button and no creation modal entry point. Expense and Medical stores intentionally omit this.*
- `title`, `description`, `backHref`
- `tileLayout?: "standard" | "body-only"` (Vault passwords require body-only)
- `headerActions?: { label: string, variant: string, requireConfirm?: boolean, onAction: () => void }[]` (Declarative config for header-level actions like "Delete Bank" — rendered and confirmed natively by the generic page)

> [!IMPORTANT]
> **Stage 7 Special Considerations (QoL Safeguards - Outside-In Opt-In Model)**
> - **Hash-Driven Modal Routing (Legacy)**: Legacy stores (like TaskManager) still use `#new-document` hash listeners instead of the modern query-driven routing (`?new=1`) used by Media. Stage 7 must carefully handle this outlier by either porting it to the standard query routing or preserving the hash listener.
> - **Action Visibility via Handler Opt-In**: The generic store must strictly control bulk action UI (Rename, Link, Unlink, Delete) based entirely on which handler functions the domain passes down (e.g., if `onUnlinkFromParent` is not provided, the UI drops the unlink button; if it's a Record store, it naturally scales down to Delete-only). Domains must never inject custom UI components for this.
> - **Inline Secrets & Copyables via Schema**: Secret values (eyes/copy buttons) are strictly opted-in via the `isSecret` or `isCopyable` flags in the `mapRecordToItem` and `FieldDef` schemas. Stage 7 must guarantee the generic grid and modal schemas natively support rendering these flags, completely preventing domains from injecting custom JSX for secrets.
> - **Strict Modal Boundary (Banning Inline Forms)**: Domains currently inject an inline creation form (`renderNewRecordForm`) directly into the Store UI, forcing the Store to orchestrate form state. This must be strictly banned. The Store Page is purely a list viewer and must have zero knowledge of form rendering. If a user creates a new record from the Store, it simply triggers the `GenericDomainModal` in "Create mode", which intrinsically knows how to render the form via `modalFields`.
> - **The Modal Instantiation Leak (`modalSlot`)**: Currently, all 9 routes inject the entire `<GenericDomainModal>` component as a raw JSX render prop (`modalSlot`). This is banned. Domains must only pass `modalFields`, and the `GenericStorePage` must mount the `GenericDomainModal` internally.
> - **The File Operations Leak (Manual Iteration)**: Inside the injected modals, domains are currently receiving a raw `fileActions` object and manually writing `for` loops to execute file mutations. `GenericDomainModal` must internalize this completely via its internal `createSaveAdapter(domain)`, executing file ops automatically before/after saving the parent record.
> - **Header Actions Injection (Banning JSX)**: The `vault/banks/[bankId]` page injects raw JSX for a "Delete Bank" button via `headerActions` and manually manages an external `<ConfirmDialog>`. `headerActions` must be changed to a declarative config array (e.g. `headerActions={[{ label: "Delete Bank", variant: "danger", requireConfirm: true }]}`). The generic page will render the button and handle confirmation natively.
> - **Manual Data-Fetching & Mapping Glue**: All 9 routes are currently manually writing and injecting `fetchData`, `deriveParentRecords`, `onLinkedRecordClick`, and `handleDocumentSaved` callbacks. The generic store must inherently resolve these functions internally based purely on the `domain` prop.
> 
> **Pre-Existing Working Tree State (Continuation Notes — Read Before Implementing)**
> - **`DataListView.tsx` Already Extracted**: The `src/components/common/DataListView.tsx` component already exists as an untracked file in the working tree and is already imported by both `GenericStorePage` and `GenericViewPage`. Do **not** recreate or overwrite it — read it first and continue building on top of it. The `DataListView` inline function previously embedded in `GenericStorePage` has already been removed (158 lines deleted from `GenericStorePage` in the working tree).
> 
> **Mobile Considerations (Must Preserve)**
> - **The Add Button & Search Bar `order` Flip**: On mobile, the Add button jumps to `order-2` (sitting next to the View Toggle) and pushes the Search Bar to a new full-width row (`order-3 w-full mt-3`). On desktop, they reverse: Search Bar goes to `sm:order-2` (pushed right) and Add Button is `sm:order-3` (far right). This ensures the primary CTA isn't pushed off-screen on phones.
> - **List Row Title/Body Stacking**: In list views (e.g., Vault Records), the row content uses `flex-col` on mobile to stack the title above its values. On desktop, it switches to `sm:flex-row` with a physical vertical divider (`w-px hidden sm:block`). The declarative schema must natively handle this flex switch.
> - **Touch-Target Visibility (No Hover)**: All tile/row inline actions (Rename, Trash, Download, Copy, Reveal Password) are strictly hardcoded to `opacity-100` on mobile because phones lack a hover state. They only switch to hover-to-reveal on desktop (`md:opacity-0 md:group-hover:opacity-100`).
> - **Swipeable Title Tracks (`body-only` mode)**: Long titles (like Vault URLs) in `body-only` tiles use a custom horizontal scroll container (`overflow-x-auto whitespace-nowrap [&::-webkit-scrollbar]:hidden`). This allows horizontal swiping on mobile without breaking the overall CSS grid width.

**Exhaustive List of Adopting Routes:**
Out of the 29 route pages in the app, these 9 routes are File or Record Stores and must opt into `GenericStorePage`, dropping all internal CRUD handlers, modal wrappers, and data-fetching boilerplate. They will shrink from ~300 lines down to ~25 lines each:

**Files to Delete / Gut (as part of this migration):**
- `src/components/taskmanager/TaskManagerStorePage` internal `NoteStoreModal` function — deleted; replaced by GenericStorePage's internally managed modal.
- `src/components/vault/banks/BankListView.tsx` — gutted; becomes a thin ~25-line GenericStorePage wrapper.
- `src/components/vault/passwords/PasswordView.tsx` — gutted entirely; file becomes the slim modal wrapper (see GenericDomainModal §12).
- `src/components/vault/records/RecordsView.tsx` — gutted; file is renamed/replaced to become the slim modal wrapper (see GenericDomainModal §10). The store behavior moves to a direct GenericStorePage opt-in.
- All `renderNewRecordForm`, `extractNewRecordData`, `modalSlot`, `fetchData`, `deriveParentRecords`, `onLinkedRecordClick`, and `handleDocumentSaved` props are deleted from every route file — these callbacks are strictly banned.

**File Stores (Documents linked to Domain Parent Records)**
1. **`/taskmanager/store`** (Links to Notes)
   - `storeType="doc"`
   - `domain="taskmanager"`
   - `modalFields={NOTE_FIELDS}`
   - Opts into: add button, standalone upload, link/unlink, delete.

2. **`/education/store`** (Links to Education Records)
   - `storeType="doc"`
   - `domain="education"`
   - `modalFields={EDUCATION_FIELDS}`
   - Opts into: add button, standalone upload, link/unlink, delete.

3. **`/expense/store`** (Links to Expense Records — Read-Only Store)
   - `storeType="doc"`
   - `domain="expense"`
   - Does **not** opt into `allowNewUpload` — no add button, no standalone upload modal.
   - Does **not** opt into unlink — only delete is available on existing linked files.
   - Files reach this store exclusively by being attached to an expense record via `/expense`. This store is a viewer only.

4. **`/medical/store`** (Links to Medical Records — Read-Only Store)
   - `storeType="doc"`
   - `domain="medical"`
   - Does **not** opt into `allowNewUpload` — no add button, no standalone upload modal.
   - Does **not** opt into unlink — only delete is available on existing linked files.
   - Files reach this store exclusively by being attached to a medical record via `/medical`. This store is a viewer only.

5. **`/vault/documents`** (Links to Vault Personal Records)
   - `storeType="doc"`
   - `domain="vault"` *(Kept as `"vault"` — this is the existing DB document domain string. Renaming would require a data migration and is deferred.)*
   - `modalFields={VAULT_RECORD_FIELDS}`
   - Opts into: add button, standalone upload, link/unlink, delete.

**Record Stores (Standalone items managed directly in the grid)**
6. **`/vault/passwords`**
   - `storeType="record"`
   - `domain="vault_passwords"`
   - `modalFields={PASSWORD_FIELDS}`

7. **`/vault/records`**
   - `storeType="record"`
   - `domain="vault_records"`
   - *(The existing `RecordsView.tsx` is gutted and repurposed as the GenericDomainModal wrapper — see §10. The store route opts in directly to GenericStorePage.)*

8. **`/vault/banks`** (Bank Accounts root dashboard)
   - `storeType="record"`
   - `domain="vault_banks"`
   - *(The existing `BankListView.tsx` is gutted into a ~25-line GenericStorePage wrapper.)*

9. **`/vault/banks/[bankId]`** (Pins/Cards mapped to a Bank)
   - `storeType="record"`
   - `domain="vault_bank_details"`

> [!NOTE]
> **Stage 7 Pass 2 status — IMPLEMENTED (2026-08-22).** `GenericStorePage` is now a fully self-contained smart component. All domain logic lives in `src/components/common/store/storeAdapters.ts` (`getStoreAdapter(domain, scope)` returns a `DocStoreAdapter<T>` or `RecordStoreAdapter<T>`), and the page owns: data loading + `refreshAll`, document link/unlink/delete CRUD, the internally mounted `GenericDomainModal` (linked-record edit + standalone-file modes), inline parent-creation forms (via `modalFields`, mounted in the standalone modal — `renderNewRecordForm`/`extractNewRecordData` are deleted everywhere), the search bar (always present, per-domain `searchPlaceholder` default + prop override), and the tiles/list toggle (per-domain `useLocalStorage` key). Capability gates drive UI: `canUnlink`/`canBulkLink`/`canCascadeDelete`/`canCreateParent` from handler presence; secrets via `isSecret`/`isCopyable` schema flags. The legacy `#new-document` / `#edit-document-{id}` hash routing is preserved. `headerActions` is declarative (`{ label, variant, requireConfirm, confirmTitle, confirmDescription, confirmLabel, onAction }`) and confirmed natively — `vault/banks/[bankId]`'s external ConfirmDialog is gone. All mobile CSS preserved verbatim (Add `order-2` / Search `order-3 w-full mt-3` flip, list-row `flex-col`→`sm:flex-row` + `w-px hidden sm:block` divider, `opacity-100` mobile / `md:opacity-0 md:group-hover:opacity-100` desktop actions, `body-only` swipeable title tracks). The 9 adopting routes are gutted to ~25-line declarative configs; `vault/passwords`, `vault/records`, `vault/banks` keep their thin view wrappers (per the spec's "slim wrapper" model).
>
> Deviations from this spec (deliberate):
> - **Passwords keep standard `tileLayout`.** The spec line "Vault passwords require body-only" is judged a copy-paste slip from `vault/banks/[bankId]` (PINs); `PasswordView` never used body-only tiles, and password tiles display a single secret value that must stay on the standard layout.
> - **Vault record modals receive `standaloneDocuments` = unlinked vault docs.** Old `RecordsView` passed `[]`; passing the unlinked set enables the modal's "link existing file" pane, which the records flow supports.
> - **The delete-cascade checkbox renders only when `deleteParent` exists.** Doc-store cascade confirmation (taskmanager/education) shows the "delete parent + files" checkbox; vault records have no parent so their confirm is plain.
> - **Medical loses unlink/bulk-link UI.** Old `medical/store` passed `hideParentRecordsList` and `disableAdd`; the adapter omits `unlinkFromParent`/`bulkLinkToParent` so the buttons are capability-gated away (files are permanently attached to their medical record). Same for expense.
> - **`hideParentRecordsList` dropped.** The unlink button is resurrected on taskmanager/education (correct — the parent list must stay visible to select a document's linked note), while unlink/bulk-link are properly hidden only where handlers are absent.
> - **Unlink/bulk-link now fix a pre-existing bug:** `unlinkFromParent` and `bulkLinkToParent` correctly clear/set `document.linked_id` (old handlers only synced the parent's `document_ids` list).
> - **Education inline-create honors the `is_completed` checkbox** (sets `completed_at=nowIso` when checked; old inline form always saved `false`).
> - **Record-store view-mode keys are per-domain** (`store_view_<domain>`) — the spec's per-domain persistence mandate applies to record stores too, not just doc stores.
> - **Post-unlink hash redirect (`#edit-document-{unlinkedId}`) now also applies to vault**, matching taskmanager's legacy flow.
> - **Per-domain doc-store `emptyMessage`/`searchPlaceholder`** live in the adapters (taskmanager/education/vault); expense/medical keep the generic defaults.
> - **`vault/banks/[bankId]` bank-not-found renders via `ErrorBanner`** (adapter `fetchData` throws `"Bank not found."`; the page's `title=""` keeps the h1 hidden until the adapter's `pageTitle=bank.bank_name` loads, matching the old blank-until-loaded behavior).
> - **`RecordsView` dead rename loop dropped** (the old view had a rename handler that no-op'd on vault records).
> - **`onDownloadDocument` omitted everywhere** — the modal's internal R2 download path is identical to the old per-route overrides.
> - **Vault record bulk-delete now cascades attached files** (old flow orphaned them).
> - **Plaintext hygiene:** adapters build explicit clean plaintexts on save — no `id`/`created_at` pollution from spreading hydrated rows (old routes leaked these into the encrypted blobs).
> - **Implementation detail:** the `GenericDocStore`/`GenericRecordStore` dispatch boundary casts the adapter union to `Adapter<{ id: string }>` (the stores only touch row `.id` and pass rows back through the adapter), and the shared `updateRow` helper params return `Promise<unknown>` so API-layer functions returning the saved row satisfy them.

#### 3. GenericDomainModal (The Unified Modal)

**Exhaustive List:**
The 10 current wrapper modals will be strictly deleted: `TaskModal.tsx`, `NoteModal.tsx`, `EducationModal.tsx`, `ExpenseModal.tsx`, `MedicalModal.tsx`, `PasswordModal.tsx`, `RecordModal.tsx`, `BankModal.tsx`, `BankPinModal.tsx`, `StoreDocumentModal.tsx`.

**Code Summary:**
**What it must own internally (No Domain Code Allowed):**
- Form state management and dirty-checking (`formData !== initialData`).
- A generic `createSaveAdapter(domain)` that automatically routes the save action to the correct API hook based on the `domain` prop.
- Complex file staging (handling the upload/delete queue strictly before saving the parent record).
- Its own visibility toggle and cleanup logic.

**The New Opt-In API Contract:**
**What domains opt-in / configure:**
- `domain: string`
- `mode: "record" | "standalone_file"`
- `allowFiles: boolean`
- `fields: FieldDef[]`
- `layout?: string[][]`
- `initialData?: Record<string, any>` (For edit mode)
- `isOpen: boolean`
- `onClose: () => void`
- `title?: string` (Optional override for the modal title)
- `onSave?: (data) => Promise<void>` (Optional override for custom save logic)
- `onDelete?: () => Promise<void>` (For deleting standard records)
- `onDeleteWithCascade?: (cascadeMode: boolean) => Promise<void>` (For deleting records with attached files)
- `deleteLabel?: string` (To customize the delete button text)
- `onDownloadDocument?: (doc: Document) => void` (Required for downloading attached files)
- `maxWidthClassName?: string` (To explicitly set modal width, e.g., "max-w-lg")

> [!IMPORTANT]
> **Stage 7 Special Considerations (QoL Safeguards)**
> - **The Date Cross-Mark**: The `type: "date"` schema must map to the custom `DatePicker.tsx` component to preserve the undocumented "clear date" logic added in the `old_domains_fixes` branch.
> - **Strict Mode Resolution**: 
>   - `record` mode: Auto-generates the form from `fields`. The right pane is a multi-file uploader strictly toggled by `allowFiles`.
>   - `standalone_file` mode: Replaces the standard form header with a "Link to Parent" dropdown (`parentRecords`). Critically, it must natively render a `-- OR --` divider below the dropdown, followed by the exact same auto-generated form (using the `fields` schema) so users can create a new parent record inline without raw JSX injections. The right pane locks to a single file preview.
> - **File Section Behaviors**: Must preserve file name deduplication (`(1)`, `(2)` suffixing), auto-selecting the first file on open/save, and the distinction between "Unlink" vs "Delete".
> - **Deep Dirty Checking**: Must normalize rich text and deeply compare `formData` to `initialData` to trigger the "Unsaved changes" warning safely.
> - **Strict Modal Boundary (Banning Boilerplate Glue)**: Domains currently pass `attachedDocuments` filtering loops and manual CRUD hooks (`onSave`, `onDelete`). This is banned. The generic engine must natively own data fetching and its internal `createSaveAdapter(domain)`, automatically routing based on the `domain` prop.
> - **Banning Manual State Initialization**: Domains must no longer manually construct `initialData` (e.g., `name: target.name ?? ""`). The modal must dynamically derive default empty states from the `fields` schema and automatically map the values from a `target` payload.
> - **Centralizing Feature Flags**: `allowFiles`, `allowLinking`, and `mode` should not be passed arbitrarily by domains. These are strict domain rules and must be inferred natively from a central domain config based on the `domain` prop.
> - **Banning Modal Store Wrappers**: Store Pages currently inject custom wrappers (e.g. `NoteStoreModal`) via `modalSlot` to hack `mode="record"` and override `onSave` redirects. This is banned. The modal must expose a declarative `target={{ type: "document" | "record", id }}` API and natively handle layout switching and redirects. Store pages must only pass the `target` state.
> - **Banning React Key Re-mounting**: Domains must stop passing `key={target.id}` to force re-mounts. The modal must natively reset its internal form state when the `target` payload changes.
> 
> **Mobile Considerations (Must Preserve)**
> - **The 3-Block Grid-to-Stack Translation**: The DOM order is strictly `[Form Pane] -> [Files Pane] -> [Footer Action Buttons]`. On mobile, CSS `flex-col` natively stacks them in this exact order so the save button is pinned beneath the content. On desktop, `sm:grid` explicitly repositions the Files pane to the right. The generic refactor must natively apply this wrapper without injecting the footer inside the left pane.
> - **Auto-Collapsing Form Layout Rows**: The schema `layout` config (which places fields side-by-side using `sm:grid-cols-X`) automatically drops the `sm:` prefix on mobile. This means *all* fields natively collapse into a strict 1-column vertical stack (`grid-cols-1`). Domains cannot inject custom flex-wraps that break this column constraint.
> - **Touch-Target Dropdowns (Standalone Linking)**: The "Link to Parent" dropdown must use mobile-friendly touch targets (`px-3 py-1.5`) and must not rely on desktop hover states to reveal linking options.
> - **Viewport Clamping (The 85vh Rule)**: The modal container relies on `min-h-[65vh] max-h-[85vh] overflow-y-auto`. By keeping scrolling confined to the modal instead of the body, users can scroll down to the Save buttons even when the mobile virtual keyboard consumes screen height. This CSS clamp must be preserved.

**How the Routes Will Opt-In (Exhaustive Directives):**
To prevent duplication across sub-domains, the `GenericDomainModal` will be mounted inside shared View components, which are then imported by the individual routes. Here is the explicit directive for every route mentioned:

**Task Manager Routes**
- `/taskmanager`: Uses `TaskView` (opts into form only, no files) for add/edit/view task. Uses `NoteView` (opts into both form and files) for add/view notes.
- `/taskmanager/all`: Uses `TaskView` (opts into form only, no files) for edit task.
- `/taskmanager/completed`: Uses `TaskView` (opts into form only, no files) for edit task.
- `/taskmanager/notes`: Uses `NoteView` (opts into both form and files) for edit notes.
- `/taskmanager/store`: Mounts `<GenericDomainModal>` directly. Record mode (opts into both form and files) for linked files. Standalone mode (opts into both form and files) for unlinked files.

**Education Routes**
- `/education`: Uses `EducationView` (opts into both form and files) for add/edit/view.
- `/education/all`: Uses `EducationView` (opts into both form and files) for edits.
- `/education/completed`: Uses `EducationView` (opts into both form and files) for edits.
- `/education/store`: Mounts `<GenericDomainModal>` directly. Record mode for linked, Standalone mode for unlinked (opts into both form and files).

**Expense Routes**
- `/expense`: Uses `ExpenseView` (opts into both form and files) for add/edit/view.
- `/expense/all`: Uses `ExpenseView` (opts into both form and files) for edits.
- `/expense/store`: Mounts `<GenericDomainModal>` directly in Record mode only (opts into both form and files).

**Medical Routes**
- `/medical`: Uses `MedicalView` (opts into both form and files) for add/edit/view.
- `/medical/all`: Uses `MedicalView` (opts into both form and files) for edits.
- `/medical/store`: Mounts `<GenericDomainModal>` directly in Record mode only (opts into both form and files).

**Vault Routes**
- `/vault/records`: Uses `RecordView` (opts into both form and files) for add/edit/view.
- `/vault/documents`: Mounts `<GenericDomainModal>` directly. Record mode for linked, Standalone mode for unlinked (opts into both form and files).
- `/vault/passwords`: Uses `PasswordView` (opts into form only, no files) for add/edit/view.
- `/vault/banks`: Uses `BankView` (opts into form only, no files) for add/edit/view.
- `/vault/banks/[bankId]`: Uses `BankPinView` (opts into form only, no files) for add/edit/view.

**Shared View Code Implementations:**

**1. TaskManager - Task View** *(Shared by `/taskmanager`, `/taskmanager/all`, `/taskmanager/completed`)*
*File: `src/components/taskmanager/TaskView.tsx`*
```tsx
<GenericDomainModal 
  domain="taskmanager"
  mode="record"
  allowFiles={false} // Only form section, no file section
  fields={TASK_FIELDS}
  layout={TASK_LAYOUT}
  initialData={selectedTask}
  isOpen={isOpen}
  onClose={close}
/>
```

**2. TaskManager - Note View** *(Shared by `/taskmanager/notes`)*
*File: `src/components/taskmanager/NoteView.tsx`*
```tsx
<GenericDomainModal 
  domain="taskmanager_notes"
  mode="record"
  allowFiles={true} // Both form and file section
  fields={NOTE_FIELDS}
  initialData={selectedNote}
  isOpen={isOpen}
  onClose={close}
/>
```

**3. TaskManager - Store** *(Shared by `/taskmanager/store`)*
*File: `src/app/(protected)/taskmanager/store/page.tsx`*
```tsx
{/* Renders in Record Mode for Linked Uploads */}
<GenericDomainModal domain="taskmanager" mode="record" allowFiles={true} fields={NOTE_FIELDS} />

{/* Renders in Standalone Mode for Unlinked Uploads */}
<GenericDomainModal domain="taskmanager" mode="standalone_file" allowFiles={true} fields={NOTE_FIELDS} />
```

**4. Education - View** *(Shared by `/education`, `/education/all`, `/education/completed`)*
*File: `src/components/education/EducationView.tsx`*
```tsx
<GenericDomainModal 
  domain="education"
  mode="record"
  allowFiles={true}
  fields={EDUCATION_FIELDS}
  initialData={selectedEdu}
  isOpen={isOpen}
  onClose={close}
/>
```

**5. Education - Store** *(Shared by `/education/store`)*
*File: `src/app/(protected)/education/store/page.tsx`*
```tsx
{/* Record Mode for Linked Uploads */}
<GenericDomainModal domain="education" mode="record" allowFiles={true} fields={EDUCATION_FIELDS} />

{/* Standalone Mode for Unlinked Uploads */}
<GenericDomainModal domain="education" mode="standalone_file" allowFiles={true} fields={EDUCATION_FIELDS} />
```

**6. Expense - View** *(Shared by `/expense`, `/expense/all`)*
*File: `src/components/expense/ExpenseView.tsx`*
```tsx
<GenericDomainModal 
  domain="expense"
  mode="record"
  allowFiles={true}
  fields={EXPENSE_FIELDS}
  layout={EXPENSE_LAYOUT}
  initialData={selectedExpense}
  isOpen={isOpen}
  onClose={close}
/>
```

**7. Expense - Store** *(Shared by `/expense/store`)*
*File: `src/app/(protected)/expense/store/page.tsx`*
```tsx
{/* Record Mode Only (No Standalone) */}
<GenericDomainModal domain="expense" mode="record" allowFiles={true} fields={EXPENSE_FIELDS} />
```

**8. Medical - View** *(Shared by `/medical`, `/medical/all`)*
*File: `src/components/medical/MedicalView.tsx`*
```tsx
<GenericDomainModal 
  domain="medical"
  mode="record"
  allowFiles={true}
  fields={MEDICAL_FIELDS}
  initialData={selectedMedical}
  isOpen={isOpen}
  onClose={close}
/>
```

**9. Medical - Store** *(Shared by `/medical/store`)*
*File: `src/app/(protected)/medical/store/page.tsx`*
```tsx
{/* Record Mode Only (No Standalone) */}
<GenericDomainModal domain="medical" mode="record" allowFiles={true} fields={MEDICAL_FIELDS} />
```

**10. Vault - Records View** *(Shared by `/vault/records`)*
*File: `src/components/vault/records/RecordsView.tsx` — existing file is gutted and repurposed as this modal wrapper. The store behavior for `/vault/records` moves to a direct GenericStorePage opt-in in the route file.*
```tsx
<GenericDomainModal 
  domain="vault_records"
  mode="record"
  allowFiles={true}
  fields={VAULT_RECORD_FIELDS}
  initialData={selectedRecord}
  isOpen={isOpen}
  onClose={close}
/>
```

**11. Vault - Documents Store** *(Shared by `/vault/documents`)*
*File: `src/app/(protected)/vault/documents/page.tsx`*
```tsx
{/* Record Mode for Linked Uploads */}
<GenericDomainModal domain="vault_documents" mode="record" allowFiles={true} fields={VAULT_RECORD_FIELDS} />

{/* Standalone Mode for Unlinked Uploads */}
<GenericDomainModal domain="vault_documents" mode="standalone_file" allowFiles={true} fields={VAULT_RECORD_FIELDS} />
```

**12. Vault - Passwords View** *(Shared by `/vault/passwords`)*
*File: `src/components/vault/passwords/PasswordView.tsx`*
```tsx
<GenericDomainModal 
  domain="vault_passwords"
  mode="record"
  allowFiles={false} // No Files
  fields={PASSWORD_FIELDS}
  initialData={selectedPassword}
  isOpen={isOpen}
  onClose={close}
/>
```

**13. Vault - Banks View** *(Shared by `/vault/banks`)*
*File: `src/components/vault/banks/BankView.tsx`*
```tsx
<GenericDomainModal 
  domain="vault_banks"
  mode="record"
  allowFiles={false} // No Files
  fields={BANK_FIELDS}
  initialData={selectedBank}
  isOpen={isOpen}
  onClose={close}
/>
```

**14. Vault - Bank Pins View** *(Shared by `/vault/banks/[bankId]`)*
*File: `src/components/vault/banks/BankPinView.tsx`*
```tsx
<GenericDomainModal 
  domain="vault_bank_details"
  mode="record"
  allowFiles={false} // No Files
  fields={PIN_FIELDS}
  initialData={selectedPin}
  isOpen={isOpen}
  onClose={close}
/>
```

> [!NOTE]
> **Stage 7 Pass 3 status — IMPLEMENTED (2026-08-23).** `GenericDomainModal` is now a self-contained engine: it owns form state, deep dirty checking (richtext normalization + deep `formData` vs baseline compare powering the "Unsaved changes" guard), the file staging queues (new-file uploads, links, unlinks, deletes — always processed strictly before the parent record save), and save routing resolved automatically from the `domain` prop via the new `src/components/common/modalDomainConfig.ts` registry (`getModalDomainConfig(domain, scope)` — the spec's `createSaveAdapter(domain)` realized as a central config registry rather than a hook factory; the modal itself contains no per-domain logic). The 10 legacy wrapper modals (`TaskModal`, `NoteModal`, `EducationModal`, `ExpenseModal`, `MedicalModal`, `PasswordModal`, `RecordModal`, `BankModal`, `BankPinModal`, `StoreDocumentModal`) are deleted and verified gone by grep sweep. All adopting views/routes mount the modal directly with declarative `fields` schemas and the `target={{ type: "document" | "record", id, data? }}` API: `taskmanager/all`, `taskmanager/completed`, `taskmanager/notes`, `education/all`, `education/completed`, `expense/all`, `medical/all`, the vault records/passwords/banks/bank-pin views, and all four modal mounts in `GenericStorePage` (add, edit, linked-record, record-store). The five CRUD hooks (`useTaskActions`, `useNoteActions`, `useEducationActions`, `useExpenseActions`, `useMedicalActions`) are slimmed to page-owned operations only (row deletes/toggles/downloads); `useActionForm.ts` is deleted. QoL safeguards verified in code: `type: "date"` maps to `DatePicker.tsx` (clear-date logic preserved), `record` mode auto-generates the form from `fields`, the right pane is strictly gated by the config's `allowFiles`, standalone mode renders the "Link to Parent" dropdown + `-- OR --` divider + the same auto-generated inline parent form with a single-file right pane, file-name dedup `(1)`/`(2)`, first-file auto-select, Unlink vs Delete distinction, internal state reset when the `target` payload changes (no `key=` re-mounts), and the mobile constraints (3-block grid-to-stack DOM order, `sm:grid-cols-X` → 1-column collapse, `px-3 py-1.5` touch dropdown, `min-h-[65vh] max-h-[85vh] overflow-y-auto` clamp) all live inside the modal.
>
> Deviations from this spec (deliberate):
> - `GenericStorePage` keeps its own `handleTileDelete` for tile-level delete confirmations — those are page-owned flows (like bulk delete), not modal glue; the strict modal boundary bans modal-side manual CRUD only, and the modal's own delete is driven entirely by the domain config.
> - The modal's form-init effect wraps its synchronous open-time state reset in an `eslint-disable react-hooks/set-state-in-effect` block (repo precedent: `VaultProvider`, `DocPreviewPanel`, `ThemeSwitcher`), and the file/parent-dropdown state was re-declared above the effect to satisfy `react-hooks/immutability` (no behavior change).
> - The form-init effect re-runs **once per target identity** — deps are `[targetKey, resetFileState]`; raw `target`/`fields`/`initialData` are read through a per-render `initInputsRef` snapshot (`useLayoutEffect`), not listed as deps. Parents build those objects inline and `initialData` defaults to a fresh `{}` every render, so raw refs in the deps either loop the effect (crash: "Maximum update depth exceeded") or, if gated by a ref guard alone, let the effect's own re-render trigger its cleanup and cancel the in-flight `createDefaults()` await, silently dropping the `due_date`/`date` defaults (StrictMode double-invoke makes this deterministic in dev). The snapshot keeps ESLint natively satisfied (no stringify keys, no `exhaustive-deps` suppress) and honors "reset when the target payload changes" without `key=` re-mounts.
> - `saveStoreDocument`/`deleteStoreDocument` in `modalDomainConfig.ts` are generic over `T extends { id: string }` — `DocStoreAdapter<T>` is not assignable to `DocStoreAdapter<{ id: string }>` because of `modalTitle` parameter variance (TS2345).
> - `BankPinData` is imported from `storeAdapters.ts` (its actual home), not `@/types/vault`.
> - Standalone saves in `GenericStorePage` now drive a fresh refetch + hash navigation (`#edit-document-{id}`) from `onSaved`, replacing the old `handleStoreSave` double-fetch; post-unlink redirects are preserved.
> - Modal mounts live inside the existing shared view components (`ExpenseView`, `MedicalView`, `ActiveTasksBox`, etc.) rather than the new `TaskView.tsx`/`NoteView.tsx`/`EducationView.tsx` wrapper files the spec's code samples assumed — same boundary, no new wrapper files.

#### 4. GenericDomainPage (Dashboard Engine)

**Exhaustive List:**
The 4 main domain dashboard wrappers will be completely gutted of their structural logic: `TaskManagerView.tsx`, `EducationView.tsx`, `ExpenseView.tsx`, `MedicalView.tsx`. 

**Code Summary:**
**What it must own internally (No Domain Code Allowed):**
- **Year dropdown** — always visible, always-present core feature of every domain dashboard. Derived from `data` + `getDateKey`. All data displayed in any view (month rows, priority columns, all-items list) is strictly filtered to the selected year. This is non-negotiable and cannot be bypassed by any domain configuration.
- The `MONTHS.map` iteration (including deriving the items per month and the permanent Unscheduled bucket).
- The rendering of `<GenericMonthRow>` grids (for "months", "single", "multi", "all" views).
- The rendering of `<GenericPriorityList>` columns (for the "priority" view).
- The `viewMode` toggle state and UI (`ViewToggle` component) — driven by `supportedViews`.
- Auth bootstrap, error boundaries, and Loading states.

**The New Opt-In API Contract:**
**What domains opt-in / configure:**
- `data: T[]` (Raw un-filtered data)
- `columns: ColumnDef<T>[]`
- `domain: "taskmanager" | "expense" | "education" | "medical"`
- `getDateKey: (item: T) => string | null` (For internal month/year grouping)
- `supportedViews: string[]` (The allowed layout toggles for this domain dashboard)
- `priorities?: readonly string[]` (If opting into priority view)
- `getPriorityColor?: (priority: string) => { border: string; bg: string }`
- `renderPriorityBadge?: (priority: string) => ReactNode`
- `headerStat?: ReactNode` (e.g., Total expenses for the year)
- `completedSlot?: ReactNode` (For Task/Edu right pane)
- `miscSlot?: ReactNode` (For Task Manager notes box)
- `modalSlot?: ReactNode` (Crucial for mounting the GenericDomainModal at the layout level)
- `emptyMessage?: string`
- `onRowClick?: (item: T) => void` (Passed down to internal grids to trigger modals)
- `rowClassName?: string | ((item: T) => string)` (Passed down to internal grids)
- `title`, `description`, `storeHref`, `storeLabel`, `storeIcon` (For the header)

> [!IMPORTANT]
> **Stage 7 Special Considerations (QoL Safeguards)**
> - **Breaking API Change — Data Must Be Raw, Year Filtering Is Internal**: Currently, all 4 domain views own `selectedYear` state and pre-filter their data before passing it to `GenericDomainPage` via `renderBody`. This is the violation being fixed. The new `GenericDomainPage` must:
>   1. Accept `data: T[]` (raw, unfiltered) from the domain.
>   2. Own `selectedYear` state internally and render the `YearDropdown` natively in its header.
>   3. Filter all data to `selectedYear` before passing to `GenericMonthRow`, `GenericPriorityList`, and any other internal grid renderers.
>   4. **Fixes the TaskManager and Education dashboard gap**: Currently, `/taskmanager` and `/education` show active items from ALL years (no year filter on the dashboard). After this refactor, `GenericDomainPage` filters `data` by `selectedYear` before the dashboard renders — only this year's active tasks/courses appear.
> 
> **Pre-Existing Working Tree State (Continuation Notes — Read Before Implementing)**
> - **`viewHelpers.ts` Grouping Helpers**: `viewHelpers.ts` has uncommitted additions containing grouping utilities (e.g., `byPriority`, month-bucketing). After this refactor, these consolidate **inside** `GenericDomainPage` — route files and domain views must not retain call sites for these helpers.
> - **The "Unscheduled" Bucket**: The internal `MONTHS.map` iteration must safely collect items without dates into the permanent Unscheduled bucket without breaking the grid flow.
> - **Current-Month Auto-Scrolling**: Domains currently run a `useEffect` to auto-scroll to `id="current-month-tile"`. The generic engine MUST internalize this, otherwise dashboards will load at the top of the year by default.
> - **Layout Slot Injections**: The generic layout must safely mount the domain's right-pane modules (`completedSlot`, `miscSlot`) without conflicting with the internal month grids.
> - **Strict Record Widgets**: Domain dashboard widgets (e.g., the Notes widget on `/taskmanager`) must only display database records. Standalone files must not be mixed into widget lists; they belong exclusively in the Store.
> - **Banning The "Empty Shell" Leak**: Currently, `GenericDomainPage` forces domains to provide a massive `renderBody` closure, manually wiring their own `<YearDropdown>`, `<ViewToggle>`, and `<BoxContainer>`. This is banned. The generic engine must own its own header controls based on a `supportedViews` prop.
> - **Banning Duplicated Month Grouping**: Domains (Expense, Medical) manually iterate over `MONTHS` and filter by year/month. The generic engine must own this time-bucketing natively via a `getDate` prop.
> - **Banning GenericActiveBox Strictness**: We will completely delete `GenericActiveBox` along with `ActiveTasksBox` and `ActiveEducationsBox`. `GenericDomainPage` will natively handle both "Priority Mode" and "Month Mode" dynamically, so domains without priority (Expenses/Medical) don't have to redefine UI loops.
> - **Banning Layout Boilerplate**: Domains currently write raw masonry grid CSS hacks (e.g. `md:columns-2`). `GenericDomainPage` must natively support `viewMode="multi"` vs `viewMode="single"` grids internally.
> 
> **Mobile Considerations (Must Preserve)**
> - **The 2/3 + 1/3 Grid Collapse (Disabled Dual Columns)**: Mobile explicitly disables 2-column views wherever they are present. The desktop dual-column layout (`lg:grid-cols-3` where the `ActiveBox` spans 2 columns) drops the `lg:` prefix and natively collapses into a strict 1-column stack. Because the DOM order is `[ActiveBox] -> [StoreLink + CompletedBox]`, the sidebars natively stack *below* the main content on mobile.
> - **Full-Width Action Targets**: In full-width layouts, the Store Link button drops its fixed desktop width and stretches to `w-full`, stacking vertically underneath the title and subtitle to become a massive, tappable block button.
> - **Isolated Scroll Containers (`SCROLLABLE_CLASSES`)**: The ActiveBox list is wrapped in an internal `overflow-y-auto` container with a max height. On phones, this prevents a long list of items from stretching the page endlessly and pushing the sidebars below the fold into oblivion.
> - **The Current-Month Auto-Scroll Hook**: When switching to "months" view, a `useEffect` actively fires `scrollIntoView` for `#current-month-tile`. Because of the isolated scroll container, this hook is critical on mobile so users don't have to manually swipe past 11 empty months to find the current one.

**How the Routes Will Opt-In (Explicit Directives):**
The 4 main dashboard routes will completely drop their internal layout definitions, toggles, and grid logic. They will simply pass their raw data and configurations:

**Files to Delete (as part of this migration):**
- `src/components/common/GenericActiveBox.tsx` — deleted entirely. `GenericDomainPage` natively handles both month and priority views, making this component redundant.
- `src/components/taskmanager/ActiveTasksBox.tsx` — deleted entirely. Its functionality is absorbed into `GenericDomainPage`'s internal grid rendering.
- `src/components/education/ActiveEducationsBox.tsx` — deleted entirely. Same reason.
- `src/components/taskmanager/TaskManagerView.tsx` — gutted. The `renderBody` closure, manual `MONTHS.map`, `YearDropdown`, `ViewToggle`, and priority grouping logic are all deleted. What remains is ~30 lines of opt-in config props passed to `GenericDomainPage`.
- `src/components/education/EducationView.tsx` — gutted. Same as above.
- `src/components/expense/ExpenseView.tsx` — gutted. Manual `MONTHS.map`, `YearDropdown`, `BoxContainer` loops, and month-bucketing all deleted.
- `src/components/medical/MedicalView.tsx` — gutted. Same as above.

1. **`/taskmanager` (`TaskManagerView`)**
   - **Views**: Opts into `["months", "priority"]`. (Passes priority configs: `TASK_PRIORITIES`, `getTaskPriorityColor`, `<TaskPriorityBadge>`).
   - **Layout/Widgets**: Opts into `completedSlot` (passes `<CompletedTasksBox>`) and `miscSlot` (passes a flex wrapper containing the "Notes Store" `<Link>` button stacked above the `<NotesBox>`). *Result: The store button is sandwiched directly between the completed and notes widgets.*

2. **`/education` (`EducationView`)**
   - **Views**: Opts into `["months", "priority"]`. (Passes priority configs: `EDUCATION_PRIORITIES`, `getEducationPriorityColor`, `<EducationPriorityBadge>`).
   - **Layout/Widgets**: Opts into `storeHref` (Places the Certificate Store button in the header above the list). Opts into `completedSlot` (passes `<CompletedEducationsBox>`).

3. **`/expense` (`ExpenseView`)**
   - **Views**: Opts into `["single", "multi"]` (Single column and double column month views).
   - **Layout/Widgets**: Opts into `storeHref` (Places the Expense Store button in the header above the list). Passes `<p>Total for {selectedYear}...</p>` into `headerStat`. Does *not* opt into `completedSlot` or `miscSlot`.

4. **`/medical` (`MedicalView`)**
   - **Views**: Opts into `["all", "single", "multi"]` (All view, Single column, and double column month views).
   - **Layout/Widgets**: Opts into `storeHref` (Places the Medical Store button in the header above the list). Passes `<p>{filteredRecords.length} records</p>` into `headerStat`. Does *not* opt into `completedSlot` or `miscSlot`.

*(Note: `GenericMediaPage` is perfectly compliant. It successfully encapsulates 100% of the UI logic and requires only raw TMDB IDs and Collections as props.)*

> [!NOTE]
> **Stage 7 Pass 4 status — IMPLEMENTED (2026-08-23).** `GenericDomainPage` is now the dashboard engine. It accepts raw `data` + declarative config and internally owns: the year dropdown (always visible, always present — `YearDropdown` natively rendered in the engine header), strict `selectedYear` filtering applied to raw `data` before ANY rendering (month rows, priority columns, and the flat "all" list — this fixes the Task Manager/Education gap where dashboards previously showed active items from ALL years), the `MONTHS.map` iteration with the permanent Unscheduled bucket (`monthIndex=-1`, `?month=unscheduled` hrefs), the `GenericMonthRow` grids for months/single/multi views, the `GenericPriorityList` for the priority view (priority column auto-dropped from `columns` via `col.key !== "priority"`, GenericViewPage precedent), the `ViewToggle` state + UI driven by `supportedViews` (persisted per-domain via `viewCacheKey`), the single-vs-multi masonry CSS (`md:columns-2` + `break-inside-avoid inline-block w-full mb-4` wrappers vs `flex flex-col gap-4`), the `#current-month-tile` auto-scroll `useEffect`, and the mobile constraints (2/3+1/3 grid drops `lg:` to stack `[ActiveBox]→[StoreLink+CompletedBox]`, full-width store link stretches to `w-full`, `SCROLLABLE_CLASSES` isolated scroll container). `GenericActiveBox`, `ActiveTasksBox`, and `ActiveEducationsBox` are deleted entirely (verified gone by grep sweep). The 4 dashboards are gutted to opt-in config — Task Manager: `["months","priority"]` + completedSlot + miscSlot (Notes Store link stacked above NotesBox); Education: `["months","priority"]` + storeHref + completedSlot; Expense: `["single","multi"]` + storeHref + headerStat (yearly total); Medical: `["all","single","multi"]` + storeHref + headerStat (record count). All grouping logic (month bucketing, priority grouping, flat date-desc sort) is consolidated inside `GenericDomainPage.tsx`; the `viewHelpers.ts` grouping helpers (`byPriority`, `activeByMonths`, `completedByMonths`, `byMonth`, `byDueMonth` and their orphaned interfaces/constants) are deleted, and the taskmanager/education helpers' dead re-exports/wrappers removed — zero call sites remain (grep-verified).
>
> Deviations from this spec (deliberate):
> - `headerStat` is a render-prop `(info: { selectedYear: number; itemsForYear: T[] }) => ReactNode` rather than a static `ReactNode` — the spec's own expense example interpolates `{selectedYear}` and totals, which cannot be computed outside the engine now that the year state is engine-internal.
> - The spec's opt-in list omits several props the existing dashboards already render with, so these were added to `GenericDomainPageProps`: `onAdd` ("+ Add" header button), `getItemKey` (row keys), `getPriorityKey` (priority extraction for grouping), `rowAction` (Complete buttons in the rows), `getSubtitle` (per-month subtitles like "Total Expense: ₹ X · N items"), `viewAllBaseHref` ("View All" month-row navigation), `viewCacheKey` (preserves the existing localStorage keys `taskManagerActiveView`/`educationActiveView`/`expenseViewMode`/`medicalViewMode` — no stored-preference break), `isLoading`/`error`/`onRetry`, and `nowYear`/`nowMonth` (IST clock). Engine behavior otherwise unchanged.
> - Auth bootstrap stays in the domain data hooks (`useTaskData`/`useEducationData`/`useExpenseData`/`useMedicalData` — they also supply `userId` for the `modalSlot` mounts); the engine receives `isLoading`/`error`/`onRetry` and owns all loading/error *presentation* (LoadingSpinner, ErrorBanner, loading text, content gating). Same boundary as Pass 3, split by data ownership.
> - The ViewToggle is now visible on mobile for all domains (`hideContainerOnMobile={false}`): Expense previously hid its toggle entirely on mobile, and Medical's "multi" option previously used `hideOnMobile` — dropped because `md:columns-2` already natively collapses to a single column on mobile, per this spec's own Mobile Considerations. Expense gains a usable mobile toggle.
> - Medical's "all" view renders the shared `GenericDataGrid` with `MEDICAL_COLUMNS` (newest-first) instead of the old `MedicalTable`; the dashboard grid has no column sorting (the old table had it) — full sorting remains on `/medical/all` via `GenericViewPage`.
> - The Unscheduled bucket now surfaces date-less Expense/Medical rows on the dashboards (the old loops silently dropped them); Task Manager/Education already handled them.
> - `MedicalTable.tsx` was left in place with zero call sites — it was not in this spec's deletion list and is out of Pass 4 scope; awaiting user decision on disposal.
> - `groupByStatus` was left in `viewHelpers.ts` (zero call sites, media-scoped — out of Pass 4 scope).
> - The 3 deleted files carried uncommitted Pass 1-3 working-tree modifications, so `git rm -f` was used per the spec's "deleted entirely" mandate (working-tree state intentionally discarded).
>
> Verification: `npm run lint` clean, `npm run build` (--webpack) passes (all 37 routes emitted), `npm test` 35/35 passed, and the banned-pattern grep sweep is clean (`renderBody`, `GenericActiveBox`, `ActiveTasksBox`, `ActiveEducationsBox`, legacy grouping helpers — only historical doc comments remain in GenericDomainPage/GenericViewPage).
