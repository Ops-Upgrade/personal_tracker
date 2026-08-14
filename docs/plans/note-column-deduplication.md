# Note for Planner Agent — Column Definition Deduplication

> Status: **IMPLEMENTED** (2026-08-15). This file is kept as the record of the
> refactor's rationale, inventory, and decisions.

## Implementation log (what actually landed)

- `src/components/common/columns.tsx` — `colPriority` / `colFiles` / `colRichtext` /
  `colDate` factories, generic over `<T, C extends string>` for sort-column safety;
  every result is spreadable via an `overrides` partial.
- Domain configs export atoms composed from the factories: `TASK_PRIORITY`,
  `TASK_DUE_DATE`, `TASK_DESCRIPTION`; `EDU_PRIORITY` (with legacy "—" fallback
  render), `EDU_DUE_DATE`, `EDU_DESCRIPTION`, `EDU_FILES`; `EXPENSE_DATE`,
  `EXPENSE_REASON`, `EXPENSE_FILES`; `MEDICAL_DATE`, `MEDICAL_DIAGNOSIS`,
  `MEDICAL_FILES`.
- `lib/format.ts` `formatShortDate` is now the ONLY date formatter — handles both
  ISO timestamps and date-only strings (local-midnight parse, no timezone shift)
  and returns "—" for null. All local `formatDate`/`formatShortDate` copies deleted
  (incl. `MedicalTable.tsx`, which the planner plan missed); the `formatShortDate`
  re-exports in `taskmanager/helpers.ts` / `education/helpers.ts` were re-exports,
  not duplicates — removed and consumers re-pointed to `@/lib/format`.
- `taskmanager/completed/page.tsx`: `monthsViewColumns = completionColumns`
  (same reference — sorting is inert in the months view since GenericDataGrid
  renders plain headers without `sortState`/`onSortChange`);
  `priorityViewColumns = completionColumns.filter((c) => c.key !== "priority")`.
- `TASK_MODE` atom from the plan was DROPPED: the mode column's styling
  deliberately differs per site (plain vs `text-xs capitalize`), so it stays
  per-site. Only the 4 concepts were centralized.
- NotesBox + notes page migrated via factories; the notes PAGE files column
  remains a local flex column (variable-length document labels) — as planned.
- `lib/utils.ts`'s dead `stripHtml` (naive regex, zero importers, name-collides
  with the display helper) deleted.
- Verified: `tsc --noEmit` ✓, `npm run lint` ✓, `npm run build` (webpack, 37
  routes) ✓, grep sweeps ✓ (only `columns.tsx` + form-field schemas declare
  `key: "priority"`; only `columns.tsx` + the notes-page exception declare
  `key: "files"`; only `lib/format.ts` defines a date formatter).

## Problem

Column **rendering** is fully centralized (GenericDataGrid + subgrid tracks + stripHtml +
PriorityBadge), but column **definitions** (`ColumnDef` objects) are copy-pasted across
widgets and pages. Every behavioral tweak must be applied in ~8–11 places:

- Align fix (priority dot centering, 2026-08-15) → edited 6 files.
- HTML tag-stripping restore in richtext cells → edited 9 files + 2 duplicates.
- Any future change (e.g. badge style, file icon color, ellipsis behavior) has the same cost.

## Current-state inventory (branch `new-mobile-fix-residual`, 2026-08-15)

| Concept | Definition sites | Actual differences |
|---|---|---|
| **Priority column** (PriorityBadge, `fixed`, align center) | `taskmanager/config.tsx`, `ActiveTasksBox.tsx`, `CompletedTasksBox.tsx`, `taskmanager/completed/page.tsx` (**×2**: completionColumns + monthsViewColumns), `education/config.tsx`, `ActiveEducationsBox.tsx`, `CompletedEducationsBox.tsx`, `education/completed/page.tsx` | Only: sortColumn presence; education allows nullable priority ("—" fallback) |
| **Files column** (PaperClipIcon + `(count)`, `fixed`) | education: config, completed page, both boxes; expense: config + ExpenseView; medical: config + MedicalView; notes: page + NotesBox | Only: icon color class (amber/emerald/rose/sky), count source (`document_ids` vs `docCountsByEdu` map vs `attachedDocs`), align (right in some, left in others) |
| **Richtext column** (stripHtml render) — description/reason/diagnosis/note | task config + ActiveTasksBox (description); education config + completed page + ActiveEducationsBox (description); expense config + ExpenseView (reason); medical config + MedicalView (diagnosis); NotesBox + notes page (note) | Only: key, header, accessor, weight |
| **Date formatter** (M/D/YY) | `lib/format.ts` `formatShortDate`, `taskmanager/helpers.ts` `formatShortDate`, `taskmanager/config.tsx` `formatDate`, `education/config.tsx` `formatDate`, `expense/config.tsx` `formatDate` + local `formatShortDate` in `ExpenseView.tsx`, `medical/config.tsx` `formatDate` + local `formatShortDate` in `MedicalView.tsx`, local `formatDate` in `education/completed/page.tsx` | Pure duplicates |

## Already centralized — do NOT re-plan these

- `GenericDataGrid` (rendering, subgrid alignment, `minmax` track formula via `buildGridTemplate`)
- `GenericViewPage` / `GenericActiveBox` / `GenericCompletedBox` / `GenericMonthRow` / `GenericPriorityList` / `GenericMonthsList`
- `stripHtml` (lib/viewHelpers), `PriorityBadge`, `ColumnDef` interface

## Design options

**A. Cross-domain factories in `src/components/common/columns.ts`** — e.g.
`priorityColumn<T extends { priority: Priority }>()`, `filesColumn<T>({ count, color })`,
`richtextColumn<T>({ key, header, accessor, weight })`, `dateColumn<T>({ key, header, accessor, sortColumn? })`.
Single source for sizing/align/render semantics.

**B. Domain atom exports** in each `config.tsx` (`TASK_PRIORITY_COLUMN`, …) composing the
common factories — widgets/pages import atoms and assemble their per-view arrays.

**C. Complete per-view column-set presets** — REJECTED: the completed pages need a custom
actions column, dashboard boxes need subsets, active boxes conditionally drop priority.
Full sets don't compose; atomic columns do.

**Recommendation: A + B.** Generic factories carry the semantics; domain configs export
composed atoms; call sites keep only composition logic (order, per-view conditionals).

## Guidelines and gotchas for the plan

1. **Keep the factory count small (≤4).** A factory needing >2–3 options should be inlined
   instead — the goal is removing drift, not inventing a DSL.
2. **Type bounds over domain types**: `T extends { priority: Priority }` etc. Keep factories
   generic; do not import domain types into `common/`.
3. **Allow per-site overrides.** Factory results must be spreadable (`{ ...filesColumn(...),
   align: "right" }`). Notable exceptions that must stay site-specific:
   - Notes **page** files column is `flex` (renders variable-length document labels) — NOT
     the shared fixed files-count column.
   - Merged priority view on `/all` pages: badge rendered inline in the name cell (weight 3).
   - Reopen actions column on `taskmanager/completed`.
   - Per-view conditional columns in ActiveTasksBox/ActiveEducationsBox (priority dropped in
     priority view) — keep the conditional at the call site.
4. **Consolidate date formatters to ONE home** (`lib/format.ts` is the natural candidate;
   decide and delete the rest, including local copies inside ExpenseView/MedicalView).
5. **De-duplicate the ×2 within `taskmanager/completed/page.tsx`** (completionColumns vs
   monthsViewColumns are identical).
6. Education's nullable priority ("—" fallback) must be preserved.

## Success criteria

- [ ] "Change the priority column alignment" = exactly ONE edit.
- [ ] "Change richtext tag-stripping behavior" = exactly ONE edit.
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run build` (webpack) all green.
- [ ] Visual parity at mobile (~360px) / intermediate / desktop across: dashboard widgets
      (tasks + educations), `/taskmanager/all|completed|notes`, `/education/all|completed`,
      `/expense`, `/medical`.
- [ ] No behavior change — this is a pure refactor.

## Out of scope

Routing/data fetching, `GenericStorePage`/vault, media views (own grid markup),
any visual redesign.
