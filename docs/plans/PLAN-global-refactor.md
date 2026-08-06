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

## Stage 1: GenericViewPage — "View All" Standardization ✅

> **Complete.**

### What was built

- `src/components/common/GenericViewPage.tsx` — The core generic component. Manages view toggle, year/month filter dropdowns, and all three layout strategies (flat list, month-grouped tiles, priority-grouped sections) internally. Domains pass data and column definitions; the generic handles all rendering.
- `STANDARD_VIEWS` exported constant — Pre-packaged view option arrays (`COMPLETION_MONTHS_PRIORITY`, `ALL_ONLY`, `ALL_MONTHS`) so domain pages never manually define their own view arrays.
- `src/components/common/MonthDropdown.tsx` — New month dropdown component used by the Expense and Medical "View All" pages.

### Phases completed

| Phase | Description | Status |
|---|---|---|
| 1A | Core component + taskmanager/completed, taskmanager/notes, education/completed adopters | ✅ |
| 1B | Standardize to `STANDARD_VIEWS`, rename internal view value from `"completion"` to `"all"` | ✅ |
| 1C | New `/expense/all` and `/medical/all` routes. Restored 5-item preview + `footerActions` "View All" button in `MonthRow`/`MedicalMonthRow`. Deleted `FullMonthModal.tsx`. | ✅ |

### What was deleted
- `src/components/common/GenericDataList.tsx` — Replaced by `GenericViewPage.tsx`
- `src/components/expense/FullMonthModal.tsx` — Dead file, superseded by `/expense/all` route
- Hardcoded view-layout JSX (Priority sections, Month tile loops) from `taskmanager/completed/page.tsx`
- Hardcoded local `VIEW_OPTIONS` arrays from all adopting page files
- `showAll` inline expansion state from `MonthRow.tsx` and `MedicalMonthRow.tsx`

### Opt-in features available in GenericViewPage

| Opt-in | Prop | Used By |
|---|---|---|
| Year dropdown | `yearFilter` | Completed Tasks, Completed Education, Expense/Medical "All" |
| Month dropdown | `monthFilter` | Expense "All", Medical "All" |
| Flat / "All" view | `STANDARD_VIEWS.*` includes `{ value: "all" }` | All adopters |
| Month-grouped view | `STANDARD_VIEWS.*` includes `{ value: "months" }` | Tasks, Education, Expense, Medical |
| Priority-grouped view | `STANDARD_VIEWS.COMPLETION_MONTHS_PRIORITY` | Tasks, Education only |
| Sortable column headers | `sortColumn` on `ColumnDef` | Per column, per domain |
| Row click → edit modal | `onRowClick` | All adopters |
| Priority-colored row borders | `rowClassName` callback | Tasks only |

---

## Stage 2: GenericStorePage — Store Standardization

> **Current focus.** Do not start until Stage 1 is reviewed and merged.

### What GenericStorePage replaces

Every domain store page (`taskmanager/store`, `expense/store`, `education/store`, `medical/store`) and `VaultDocumentsView` independently implements the same boilerplate:

```
getSession() → setUserId
useEffect [userId] → fetchDomainData + fetchDocuments → setState
refreshAll useCallback → re-fetch + setRefreshTrigger(prev + 1)
parentRecords derivation (map domain rows to { id, name })
linkedRecord state + linked modal open/close
```

This exact pattern is copy-pasted into each of the 5 files. `GlobalStoreView` only handles the display layer — it knows nothing about auth or data fetching.

Additionally, the 3 Vault record sections (Banks, Passwords, Records) each build their own `useVaultSection` hook wrapper + selection + delete confirm + modal state before passing to `VaultRecordView`. `VaultRecordView` is also display-only.

### Two subtypes

| Subtype | Existing display component | Current adopters |
|---|---|---|
| `doc` | `GlobalStoreView` | taskmanager/store, expense/store, education/store, medical/store, vault/documents |
| `record` | `VaultRecordView` | vault/banks, vault/passwords, vault/records |

### Opt-in features (centrally defined, domain chooses)

| Opt-in | Prop | Used By |
|---|---|---|
| Store type | `storeType: "doc" \| "record"` | All adopters (required) |
| Domain for document scoping | `domain: string` | Doc stores (passed to `GlobalStoreView`) |
| Parent records for linking | `fetchParentRecords` callback | taskmanager, expense, education, medical, vault/documents |
| Inline modal for linked doc click | `onLinkedRecordClick` callback | taskmanager (NoteModal), expense (ExpenseModal) |
| Standalone upload → create parent | `onStandaloneUpload` callback | taskmanager only |
| Title, description, back link | `title`, `description`, `backHref` | All adopters |
| Selection + bulk delete | `selectionEnabled` | Vault record stores |

### Phase 2A — Core GenericStorePage Component ⬜

**What changes:**
- Create `src/components/common/store/GenericStorePage.tsx`.
  - Absorbs: `getSession` auth bootstrap, `useEffect` data loading, `refreshAll` pattern, `refreshTrigger` state, `parentRecords` derivation.
  - Accepts a `fetchData` callback `(userId: string) => Promise<{ domainRows: T[], documents: Document[] }>` so domains provide their own fetching logic.
  - Accepts a `deriveParentRecords` callback `(rows: T[]) => { id: string; name: string }[]`.
  - When `storeType === "doc"`: renders `GlobalStoreView` with all resolved props.
  - When `storeType === "record"`: renders `VaultRecordView` (future Phase 2B).

**What gets deleted:**
- The auth + data loading boilerplate block (lines 30–86) duplicated across all 4 domain store page files
- `VaultDocumentsView.tsx` — fully absorbed into the generic with `storeType="doc"` + `domain="vault"`

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

### Phase 2B — Vault Record Stores ⬜

**What changes:**
- Extend `GenericStorePage` to handle `storeType="record"`.
  - When `storeType === "record"`: renders `VaultRecordView` with selection, bulk delete, and modal state managed generically.
  - Accept `useSection` hook adapter so vault domains can still use their `useVaultSection` pattern.

**Current adopters of `VaultRecordView`:**
- `vault/banks/BankListView.tsx` — 103 lines, uses `useVaultSection`, `useSelection`, `useDeleteConfirm`, passes items to `VaultRecordView`
- `vault/passwords/PasswordView.tsx` — same structure
- `vault/records/RecordsView.tsx` — same structure

All three replicate identical selection, delete-confirm, and modal wiring before passing to `VaultRecordView`.

**What gets deleted:**
- Duplicated `useSelection` + `useDeleteConfirm` + modal wiring in each of the 3 vault view files
- `BankListView.tsx`, `PasswordView.tsx`, `RecordsView.tsx` shrink from ~100 lines each to thin domain-config wrappers

**Human Actions Required:**
- None.

**Out of Scope:**
- Bank detail view (`BankDetailView.tsx`) — this is a sub-page, not a list store. Remains unchanged.

---

## Stage 3: GenericMediaPage — Media Detail Standardization

> **Future.** Do not start until Stage 2 is reviewed and merged.

**The problem:** `MoviePage.tsx` (368 lines) and `TvSeriesPage.tsx` (764 lines) share identical structure: `useMediaTracking`, `MediaHeroSection`, `StatusChipGroup`, `CollectionPicker`, `ReviewSection`, `StickyActionBar`, navigation guard, dirty state tracking, remove/untrack flow. The extra ~400 lines in TV is entirely the episode matrix (season selector, episode grid, `EpisodePage` sub-view).

**The fix:** A `GenericMediaPage` absorbs all shared structure. It accepts:
- `mediaType: "movie" | "tv"`
- `episodeMatrix?: ReactNode` — opt-in slot for TV episode tracking (only TV passes this)
- `watchedOnField?: boolean` — opt-in for the Movie-specific "Watched On" date field

**What gets deleted:**
- `MoviePage.tsx` — replaced by a thin wrapper passing `mediaType="movie"`
- `TvSeriesPage.tsx` — replaced by a thin wrapper passing `mediaType="tv"` + episode matrix slot

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
