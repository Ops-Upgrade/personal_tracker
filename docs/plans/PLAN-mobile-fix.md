# Mobile Fix Plan

> [!NOTE]
> **Scope of Changes:** Most fixes outlined in this document (e.g., text truncation strategies, layout adjustments, and disabling hover interactions) are specifically scoped to **mobile views** (`< md` breakpoint in Tailwind). Desktop views should remain largely unaffected, retaining their existing layouts and hover aesthetics. 
> 
> The only exceptions are **Column Additions/Modifications** (e.g., adding the Due Date column, replacing text Priority with a dot) and the **Code Issues to Fix** (e.g., removing unused Month views, implementing direct database completion, and fixing header alignments), which apply globally to all screen sizes.

> [!IMPORTANT]
> **Architectural Regroup (The "Reusable" Way):**
> Previously, the dev agent implemented the truncation rules by bloating individual domain configs (`taskmanager/config.tsx`, `education/config.tsx`, etc.) with manual Tailwind overrides (`min-w-0`, `shrink-0`, custom `render` HTML). This broke the beautiful reusable structure of the repo, caused bugs (skewed dots, overlapping headers), and created massive code duplication.
> 
> **NEW REUSABLE APPROACH:** We will NOT bloat domain configs. Instead, we will extend the `ColumnDef` interface in `GenericViewPage.tsx` to natively support mobile layout behaviors (e.g. `mobileBehavior?: "truncate" | "fixed" | "hide"`). The `GenericDataGrid.tsx` component will centrally read these flags and apply the correct `min-w-0 truncate` or `shrink-0` wrappers automatically to both the headers and the cells. This guarantees flawless alignment, zero domain bloat, and perfect reusability.

## ✅ 1. Task Manager Pages
**`/taskmanager` (Active Tasks)**
- **Views**: Months, Priority
- **Month View Columns**: Name, Priority, Mode, Description, Actions (Complete)
  - **Truncate**: Name, Mode, Description.
  - **Do Not Truncate**: Actions (Quick Complete).
  - **Modifications**: Priority will show *only* the colored dot. Due Date will be added and **not** truncated.
- **Priority View Columns**: Name, Due Date, Mode, Description, Actions (Complete)
  - **Truncate**: Name, Mode, Description.
  - **Do Not Truncate**: Due Date, Actions (Quick Complete).

**`/taskmanager` (Completed Tasks Widget)**
- **Columns**: Name, Mode, Priority, Date, Actions
  - **Truncate**: Name, Mode.
  - **Do Not Truncate**: Date, Actions.
  - **Modifications**: Priority will show *only* the colored dot.

**`/taskmanager` (Notes Widget)**
- **Columns**: Name, Note Content, Date Added, Files
  - **Truncate**: Name, Note Content.
  - **Do Not Truncate**: Date Added, Files.

**`/taskmanager/all`**
- **Views**: All
- **All View Columns**: Name, Priority, Due Date, Mode, Description, Status
  - **Truncate**: Name, Mode, Description, Status.
  - **Do Not Truncate**: Due Date.
  - **Modifications**: Priority will show *only* the colored dot.

**`/taskmanager/completed`**
- **Views**: All (Completion), Months, Priority
- **All & Months View Columns**: Name, Priority, Mode, Date, Actions (Reopen)
  - **Truncate**: Name, Mode.
  - **Do Not Truncate**: Date, Actions (Reopen).
  - **Modifications**: Priority will show *only* the colored dot.
- **Priority View Columns**: Name, Mode, Date, Actions (Reopen)
  - **Truncate**: Name, Mode.
  - **Do Not Truncate**: Date, Actions (Reopen).

**`/taskmanager/notes`**
- **Views**: All
- **All View Columns**: Name, Note Content, Date Added, Files (Paperclip)
  - **Truncate**: Name, Note Content.
  - **Do Not Truncate**: Date Added, Files.

---

## ✅ 2. Expense Pages
**`/expense`**
- **Views**: Single (Months)
- **Single View Columns**: Item, Seller, Cost, Date, Reason, Files
  - **Truncate**: Item, Seller, Reason.
  - **Do Not Truncate**: Cost, Date, Files.

**`/expense/all`**
- **Views**: All
- **All View Columns**: Item, Seller, Cost, Date, Reason, Files
  - **Truncate**: Item, Seller, Reason.
  - **Do Not Truncate**: Cost, Date, Files.

---

## ✅ 3. Education Pages
**`/education` (Active Educations)**
- **Views**: Months, Priority (Active Box)
- **Active Month/Priority View Columns**: Program Name, Provider, Priority / Due Date, Description, Files, Actions (Complete)
  - **Truncate**: Program Name, Provider, Description.
  - **Do Not Truncate**: Files, Actions (Complete).
  - **Modifications**: Due Date will be added to the Month view and **not** truncated. Priority will show *only* the colored dot.

**`/education` (Completed Table Widget)**
- **Columns**: Program Name, Provider, Priority, Date, Files
  - **Truncate**: Program Name, Provider.
  - **Do Not Truncate**: Date, Files.
  - **Modifications**: Priority will show *only* the colored dot.

**`/education/all`**
- **Views**: All
- **All View Columns**: Program Name, Provider, Priority, Due Date, Description, Files
  - **Truncate**: Program Name, Provider, Description.
  - **Do Not Truncate**: Due Date, Files.
  - **Modifications**: Priority will show *only* the colored dot.

**`/education/completed`**
- **Views**: All (Completion), Months, Priority
- **All & Months View Columns**: Program Name, Provider, Priority, Due Date, Completed Date, Files
  - **Truncate**: Program Name, Provider, Description.
  - **Do Not Truncate**: Due Date, Files.
  - **Modifications**: The "Completed Date" column will be completely removed and replaced by "Description". Priority will show *only* the colored dot.

---

## ✅ 4. Medical Pages
**`/medical`**
- **Views**: All (Table), Single (Months)
- **Single (Months) View Columns**: Name, Clinic, Date, Diagnosis, Files
  - **Truncate**: Name, Clinic, Diagnosis.
  - **Do Not Truncate**: Date, Files.
- **All (Table) View Columns**: Name, Clinic, Date, Files
  - **Truncate**: Name, Clinic, Diagnosis.
  - **Do Not Truncate**: Date, Files.
  - **Modifications**: "Diagnosis" is missing from the table; it will be added. 

**`/medical/all`**
- **Views**: All
- **All View Columns**: Name, Clinic, Date, Diagnosis, Files
  - **Truncate**: Name, Clinic, Diagnosis.
  - **Do Not Truncate**: Date, Files

---

## Code Issues to Fix
**✅ 1. Lazy implementation of the `/all` routes (Hidden toggles vs Removed Code)**
In `/medical/all`, `/expense/all`, `/taskmanager/all`, and `/education/all`, the dev agent passed a `disableMonthToggle` prop to `GenericViewPage` instead of properly refactoring the pages to use a flat list. As a result, the page is still actively grouping data into months (`monthGroups={monthGroups}`) and running unneeded filters in the background, but the UI button to switch to it is just hidden. 
**Fix:** (Completed) We opted to *re-enable* the Month/Priority toggles on mobile for `/taskmanager/all` and `/education/all` to give users access to these views, resolving the inconsistency.

**✅ 2. Education Quick Complete Button opening a Modal**
In `EducationView.tsx`, the `handleQuickComplete` function populates the modal state instead of directly updating the database:
```typescript
function handleQuickComplete(education: Education) {
  setQuickCompleteTarget({ ...education, is_completed: true });
}
```
This forces the Edit modal to pop open with the checkbox ticked.
**Fix:** We will replace this with a direct database call using `handleToggleComplete(edu, true)` (similar to Task Manager) so it completes instantly and silently without opening the modal.

**✅ 3. Task Manager Completed Actions Column Alignment**
In the `/taskmanager/completed` views, the "Actions" column header and the "Reopen" button are visually misaligned (the button is offset to the right relative to the header). 
**Fix:** We will ensure the header alignment and the column cell alignment match (e.g., applying `text-center` or `text-right` consistently to both the header definition and the row render function) to fix the visual offset.

---

## ✅ 5. Mobile Hover Interaction Fixes

**Problem 1: Store Page Action Buttons Hidden on Mobile**
In the Document Store (both tile and detail views), the selection checkbox, quick delete, rename, and download buttons are hidden using `opacity-0` and only appear on `group-hover`. Since hover doesn't exist on mobile, they are invisible until accidentally tapped.
**Fix:** Apply a mobile-first Tailwind approach (e.g., `opacity-100 md:opacity-0 md:group-hover:opacity-100`) so these action buttons and checkboxes are permanently visible natively on mobile devices, while preserving the clean hover-to-reveal aesthetic for desktop users.

**Problem 2: Vault Records Action Buttons Hidden on Mobile**
In the Vault Records view (both tile and detail views), the selection checkboxes, quick delete trash icon, and the Copy/Reveal buttons inside `InlineSecretValue` are hidden behind hover states. When a user tries to tap the selectable text to copy it manually on mobile, they often miss the integrated buttons.
**Fix:** Apply the exact same mobile-first CSS (`opacity-100 md:opacity-0 md:group-hover:opacity-100` and `focus-within:opacity-100`) to the checkboxes, Trash icon, and the Copy/Reveal buttons inside `InlineSecretValue` so they are fully visible by default on mobile.

**Problem 3: Media Episode Matrix Tile View Overlay Overlaps Grid**
In the Episode Matrix tile view (`TvSeriesPageWrapper.tsx`), the episode description is hidden inside a CSS grid transition (`grid-rows-[0fr]`). The card uses an `absolute` positioning overlay on top of an invisible ghost wrapper. When hovered, the absolute card expands downward, overlapping the tiles in the row below it. If we forcefully show the description on mobile, the absolute card permanently overlaps the grid below it.
**Fix:** Disable the `absolute` positioning overlay entirely on mobile devices. 
- On mobile (`< md`), the episode tile will be a standard, statically-positioned card (`relative md:absolute`). The description will be rendered natively inside it (not hidden in a collapsed grid row), so the tile naturally pushes the grid row height down to accommodate the text.
- On desktop (`md:`), it will revert to the current behavior: using the absolute overlay and zero-height grid trick to keep all rows uniform until hovered.

**Problem 4: Media Collection Sortable Tiles Action Buttons Hidden on Mobile**
In the Media Collections (tiles representing individual media items), the Trash icon and the drag-handle icon are hidden behind `opacity-0` and only appear on hover (`group-hover`). On mobile, these icons are completely invisible and impossible to use.
**Fix:** Apply the exact same mobile-first CSS (`opacity-100 md:opacity-0 md:group-hover:opacity-100`) to both icons in `SortableMediaItem.tsx` so they are permanently visible on mobile devices.

---

## ✅ 6. Generic Modal Mobile Scroll & Preview Fix

**Problem 1: File Preview Button Unclickable and Overlapping on Mobile**
In all domains that use `GenericDomainModal` with file attachments (including the Store view), the "Click to load preview" button overlaps other UI elements on mobile and is completely unclickable.
**Root Cause:** The modal enforces a strict `max-h-[85vh]` with a `flex-col` layout on mobile. The left form panel and right file panel both use `flex-1 min-h-0`, forcing them to split the modal height 50/50. The top nav and bottom upload zone in the file panel consume all of this tiny 50% height, squishing the `DocPreviewPanel` in the middle down to 0 pixels. This causes the fixed-size preview button to overflow its container and lose its clickable hit area due to flexbox constraints.
**Fix:** Keep the vertical flow on mobile but allow the *entire modal body* to scroll natively instead of splitting the screen 50/50.
- **Modal Body Wrapper:** Update to `overflow-y-auto sm:overflow-visible sm:overflow-y-auto` so the user can scroll the entire modal continuously on mobile.
- **Left Form Panel:** Allow it to expand to its natural height (`shrink-0 sm:shrink sm:flex-1`) and disable its internal scrollbar on mobile (`sm:overflow-y-auto`).
- **Right File Panel:** Allow it to take up its natural height on mobile (`shrink-0 sm:shrink sm:flex-1 sm:min-h-0`).
- **Preview Container Height:** Guarantee a minimum height for the `DocPreviewPanel` on mobile (e.g., `min-h-[300px] sm:min-h-0 sm:flex-1`). This ensures the preview button and document iframe always have enough breathing room to be fully visible and clickable without being crushed.

---

## ✅ 7. 2-Column Month View Mobile Reflow Fix

**Problem:** 
When navigating to the Month View on `ExpenseView` and `MedicalView` (or the `CollectionView` in media), the desktop layout is split into two columns. If the browser window is resized to emulate a mobile view, the layout stays stuck in a 2-column configuration or completely hides the second column, losing half the data.

**Root Cause (original):**
In `ExpenseView.tsx` and `MedicalView.tsx`, the `multi` view mode splits the array into two separate `div` elements (left and right columns) using `i % 2 === 0`. The right column is hidden on mobile using `hidden md:flex`. Because the left column's odd/even filter remains active regardless of screen size, hiding the right column causes half the months to disappear on mobile screens. In `CollectionView.tsx`, it uses `sm:grid-cols-2`, which may not collapse at the exact desired mobile breakpoint if the emulated width is slightly larger than 640px.

**Fix (phase 1, done):**
We abandoned the Javascript odd/even array splitting and the `hidden md:flex` second column, replacing it with native CSS columns for the masonry layout:
1. In `ExpenseView.tsx` and `MedicalView.tsx`, the `expensesByMonth`/`medicalByMonth` array is now mapped exactly **once**.
2. `columns-1 md:columns-2 gap-4 space-y-4` was applied to the parent container when `viewMode === "multi"`.
3. Each `GenericMonthRow` child is wrapped in a `break-inside-avoid inline-block w-full mb-4` container to prevent the CSS columns from slicing a month tile in half.

**Follow-up (phase 2, done):** When the window is manually shrunk below the breakpoint, the wide data tables have a minimum intrinsic width, so CSS Multi-Column (`columns-1`) and Grid (`sm:grid-cols-2`) push anonymous columns off-screen and force a horizontal scrollbar instead of collapsing. We now force a native single-column flex layout on mobile and restore the multi-column/grid layout only on desktop:
1. `ExpenseView.tsx` / `MedicalView.tsx`: the `multi` container is now `flex flex-col md:block md:columns-2 gap-4 md:gap-4 space-y-4 md:space-y-4`.
2. `CollectionView.tsx`: the `multi` container is now `flex flex-col gap-4 sm:grid sm:grid-cols-2`.

---

## ✅ 8. Column Header Vertical Alignment Discrepancy

**Problem:** 
In all "View All" pages (and wherever `GenericDataGrid` is used), sortable column headers (like NAME, CLINIC, DATE) and non-sortable column headers (like DIAGNOSIS, FILES) are not vertically aligned at the same height. Sortable headers appear slightly higher than non-sortable ones.

**Root Cause:**
In `GenericDataGrid.tsx`, sortable headers use the `SortableHeader` component, which renders as an `inline-flex items-center` block. However, non-sortable headers are rendered as simple block `div` elements. This difference in display properties (`inline-flex` vs `block`) creates a baseline alignment discrepancy, compounded by the SVG icons in the sortable headers.

**Fix:**
We will standardize the HTML structure and CSS classes for both header types in `GenericDataGrid.tsx`.
1. The non-sortable header will be wrapped in the same outer container `<div className={getColSpanClass(col.colSpan)}>` as the sortable header.
2. Inside that container, the non-sortable text will be placed in a `<div className="inline-flex items-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">`.
3. This ensures both headers use identical flexbox vertical centering and baseline rendering. (We will also apply the truncation logic defined in the reusable architecture to prevent mobile overflow).

---

## ✅ 9. Store & Vault Mobile Layout Fixes

**Problem 1: Add Button Full-Width Below Search on Mobile**
In all store views on mobile, the Add button becomes full-width and is placed below the search bar, rather than retaining a small width above the search.
**Fix:** Restructured the `DataListView` header (component lives inside `GenericStorePage.tsx`) to use `flex flex-wrap items-center justify-between` with CSS `order` utilities: ViewToggle `order-1`, Add button `order-2 sm:order-3`, Search `order-3 sm:order-2 w-full sm:w-auto mt-3 sm:mt-0 sm:ml-auto` (the `sm:ml-auto` keeps the desktop right-grouping of search+add unchanged).

**Problem 2: `/vault/records` List View Horizontal Cramping**
The record name and value stayed horizontally aligned on mobile, causing cramped layouts.
**Fix:** `renderListRow` in `GenericRecordStore` now uses `flex-col sm:flex-row items-start sm:items-center`; the checkbox+name are grouped in a `w-full sm:w-1/3` column, the divider is `hidden sm:block`, and the values stack below the name on mobile.

**Problem 3: Password/Bank Tile Values Overlapping Action Icons**
In `/vault/password` and `/vault/bank` tile views, values did not truncate and overlapped the copy/trash icons on narrow widths.
**Fix:** `InlineSecretValue` text span now uses `truncate flex-1 min-w-0` (with a `title` tooltip) instead of `overflow-x-auto`, the action-button group got `shrink-0`, and parent value containers in the tile/list renderers got `min-w-0`.

**Problem 4: Password/Bank Modals — Empty Right Space + Missing Copy/Reveal**
Form fields looked like a compressed 2-column grid with empty space on the right (resembling a missing file section), and inputs lacked inline Copy and Reveal (eye) buttons.
**Fix:** `InputField` in `FormField.tsx` now supports `isCopyable` and password reveal natively (absolutely-positioned eye/copy buttons inside the input wrapper, `pr-10`/`pr-16` input padding). `GenericDomainModal`'s `FieldDef` gained `isCopyable?: boolean` and passes it through to `InputField`. `PasswordView` passes an explicit single-column `layout`. The Bank modal in `BankListView` only has `bank_name` (the plan's `account_number`/`ifsc_code`/`card_number` fields do not exist in this codebase) — the bank's PIN modal on the detail page got the explicit layout + copyable PIN instead.

**Problem 5: `/vault/records` Modal — No Copy Button**
**Fix:** `RECORD_FIELDS.value` now has `isCopyable: true`.

**Problem 6: View Toggle State Not Persisted**
**Fix:** Both `GenericDocStore` and `GenericRecordStore` now use `useLocalStorage` with a dynamic key `"store_view_" + (domain || storeType)` instead of `useState("tiles")`.

**Files changed:** `GenericStorePage.tsx`, `FormField.tsx`, `GenericDomainModal.tsx`, `PasswordView.tsx`, `BankListView.tsx`, `RecordsView.tsx`, `vault/banks/[bankId]/page.tsx`.

**Verification:** `npm run lint` and `npx tsc --noEmit` both pass. Visual verification via `npm run dev` on a mobile viewport.

---

## ✅ 10. Store & Vault Mobile Layout Fixes (Follow-up)

**Problem 1: Record-mode list rows broken on mobile**
The list row kept checkbox/title/values/trash in one horizontal line on mobile; the title+values group overflowed and the trash button pushed the row taller.
**Fix:** `renderListRow` restructured — outer row is `flex items-center gap-4 px-4 py-4 min-h-[72px]`; checkbox `shrink-0`; title+values wrapper `flex flex-col sm:flex-row flex-1 min-w-0 items-start sm:items-center gap-4`; title column `w-full sm:w-1/3 sm:min-w-[120px]`; divider `w-px hidden sm:block bg-zinc-200 dark:bg-zinc-700 self-stretch min-h-[1.5rem]`; values column `flex-1 w-full flex flex-col gap-1 min-w-0`; trash button fixed `h-8 w-8 shrink-0` (visible on mobile, hover-revealed on desktop: `opacity-100 md:opacity-0 md:group-hover:opacity-100`).

**Problem 2: InlineSecretValue not vertically aligned with adjacent labels**
**Fix:** each value row is `flex items-center gap-2 min-w-0` with the label `w-24 shrink-0` and the secret value wrapped in `flex-1 min-w-0` — label and value now share one baseline and truncation keeps the row height stable.

**Problems 3–5: Password / Bank / Bank-PIN modals have empty right space on mobile**
Inputs did not stretch full width, leaving an awkward empty area on the right.
**Fix:** `GenericDomainModal` body wrapper is now `flex flex-1 min-h-0 w-full` + `flex-col` (only becomes `sm:flex-row` when the right panel is actually shown); the left form panel is `shrink-0 flex-col sm:shrink sm:flex-1 min-w-0 sm:min-h-0 flex w-full` so it fills the full width on mobile.

**Problem 6: `/vault/banks` missing selection checkboxes + bulk select**
**Fix:** removed the `disableSelection` prop from `BankListView`'s `GenericStorePage` — checkboxes and the `BulkActionBar` (Select All / Delete) now appear like the other record stores.

**Problem 7: Bank PIN tiles render names in the tile header**
**Fix:** added `tileLayout="body-only"` to the `GenericStorePage` on `/vault/banks/[bankId]` so PIN tiles render like `/vault/records` (name inside the body, not the header).

**Problem 8: "Unsaved changes" warning right after a successful save**
**Fix:** `handleSaved` in `GenericRecordStore` now syncs `modalRecord` to the saved entry, refreshing the modal's `initialData` and clearing the dirty check in edit mode. **Deviation from plan:** in add mode the freshly-created record has no editable stale state left, so the modal now closes on save instead — otherwise the add modal would still show the spurious warning because its `initialData` stays empty while `formData` holds the saved values.

**Problem 9: Vault Back button misaligned with the floating lock button**
**Fix:** `VaultHeader` container changed from `absolute top-6 right-4` to `absolute top-0 right-0 sm:right-4` so the badge/lock cluster aligns vertically with the Back button on mobile.

**Implementation note:** the first `handleSaved` draft referenced `setModalRecord` before the `modalRecord` useState declaration, which the React Compiler flags (`react-hooks/immutability` "accessed before it is declared") and which cascaded into two `preserve-manual-memoization` errors. Fixed by moving `handleSaved` below the `modalRecord` declaration — no dependency-array changes needed (state setters are stable).

**Files changed:** `GenericStorePage.tsx`, `GenericDomainModal.tsx`, `BankListView.tsx`, `vault/banks/[bankId]/page.tsx`, `VaultHeader.tsx`.

**Verification:** `npm run lint` and `npx tsc --noEmit` both pass. Visual verification via `npm run dev` on a mobile viewport.

---

## ✅ 11. Vault Record File Indicators + Modal Footer Placement

**Problem 1: `/vault/records` tiles/list rows don't indicate attached files**
The document store shows a link/attachment badge, but record tiles and list rows showed nothing when a record had linked files.
**Fix:** Added `hasFiles?: boolean` to `VaultRecordItem` (`src/types/vault.ts`); `RecordsView.mapRecordToItem` sets it via `docs.some((d) => d.linked_id === r.id && d.domain === "vault")`. In `GenericStorePage.tsx`, `renderListRow` renders an inline `PaperClipIcon` (`h-4 w-4 shrink-0 ${theme.icon}`) next to the title text (both `body-only` and `standard` title variants), and `renderGridTile` renders the floating bottom-right pill (`absolute bottom-2 right-2 rounded-full bg-white/90 p-1.5 shadow-sm backdrop-blur-sm dark:bg-zinc-900/90 z-10`), matching the `renderDocGridTile` link-overlay styling. The docs list refreshes on every `fetchData`, so the badge appears/disappears after file attach/unlink saves.

**Problem 2: Modal footer between form and files panel on mobile**
The Save/Cancel/Delete footer was nested inside the Left Panel, so on mobile it rendered between the form inputs and the attached-files panel instead of at the bottom of the scrollable content.
**Fix:** `GenericDomainModal` body flattened to direct siblings — Form Area, Files Panel, Footer:
1. Body wrapper: `w-full flex-1 min-h-0` + `flex flex-col sm:grid sm:grid-cols-[minmax(0,1fr)_420px] sm:grid-rows-[minmax(0,1fr)_auto]` when the right panel shows, else `flex flex-col`.
2. Left (form) panel: `flex flex-col min-w-0 flex-1 min-h-0` + `sm:col-start-1 sm:row-start-1`.
3. Footer moved out of the Left Panel to a direct body child, **placed after the Files panel in the DOM** so mobile stacks Form → Files → Footer; `sm:col-start-1 sm:row-start-2` pins it bottom-left on desktop grid, `mt-auto` when there is no right panel.
4. Right (files) panel: `sm:col-start-2 sm:row-start-1 sm:row-span-2` (full-height right column; the old `sm:w-[420px]` was dropped — the grid column defines the width now).

**Deviations from plan:**
- `RecordsView.mapRecordToItem` needed `docs` added to its `useCallback` dependency array (plan didn't mention it) — required for the badge to update when documents load, and enforced by the React Compiler lint rule.
- Plan step 2.3 didn't specify the footer's position among the siblings; placing it after the Files panel was required to satisfy the problem statement's "Form → Files → Footer" mobile order (desktop position is grid-controlled regardless of DOM order).
- The inline list-row paperclip was also added to the `standard` title branch (not only `body-only`) for consistency; only RecordsView sets `hasFiles` today, so it is inert elsewhere.

**Files changed:** `src/types/vault.ts`, `RecordsView.tsx`, `GenericStorePage.tsx`, `GenericDomainModal.tsx`.

**Verification:** `npm run lint` and `npx tsc --noEmit` both pass. Visual verification via `npm run dev` on a mobile viewport.

---

## ✅ 12. Modal Mobile Layout, Paperclip Placement, Vault Session Persistence

**Problem 1: Modals without a file panel show no Save/Cancel/Delete buttons on mobile**
The left (form) panel used `flex-1 min-h-0` on mobile, collapsing the form to 0 height inside the `flex-col` body and pushing the footer out of view.
**Fix:** Left panel is now `shrink-0 sm:flex-1 sm:min-h-0` — natural height on mobile, flexible on desktop. The inner form scroller is `sm:flex-1 sm:overflow-y-auto` (no `flex-1`/overflow on mobile — the outer card scrolls).

**Problem 2: Modals slide behind the sticky top navbar on mobile**
The backdrop used `items-center justify-center p-4` while the Navbar is `sticky top-0 z-50` and the modal backdrop defaults to `z-40` — tall modals extended under the navbar.
**Fix:** Backdrop is now `items-start sm:items-center ... p-4 pt-16 sm:pt-4` — the modal starts below the navbar on mobile and stays centered on desktop.

**Problem 3: File panels overlap form fields on mobile**
Same root cause as Problem 1 — the `flex-1 min-h-0` collapse let the files panel render on top of the form in the `flex-col` stack.
**Fix:** Same `shrink-0` change; Form → Files → Footer now stack naturally and the outer card (`overflow-y-auto` at all sizes — `sm:overflow-visible` removed) scrolls the whole stack.

**Problem 4: Paperclip indicator inside the title area (clashing with copy icons)**
**Fix:** Removed the paperclip from the title text wrappers and the absolute bottom-right pill. It is now a non-interactive `span` next to the Trash button: in `renderListRow` (`h-8 w-8`, hover-revealed on desktop like the trash), and in the `renderGridTile` header between the title and trash (`h-7 w-7`).

**Problem 5: Vault unlock lost on refresh + grace timer misfiring**
**Fix:** `VaultProvider` now persists the unlock in `sessionStorage` — set on `unlock()` success, removed on `lock()` and on grace-timeout lock. `init()` restores `"unlocked"` when the PIN is set AND the current route is a vault route. The grace-timer effect reads state via a `stateRef` (synced in a separate effect) with deps `[pathname, isVaultRoute, userId]` — `state` removed so timers never restart on unrelated state transitions. The timeout handler now also locks only if still away from the vault (pathnameRef check).

**Deviations from plan:**
- The sessionStorage key is **user-scoped** (`vault_session_<userId>`), not a bare `"vault_session"` — a bare flag would let a different account logging in on the same tab inherit an unlocked vault.
- The restore in `init()` is **gated on being on a vault route** — otherwise a refresh on a non-vault page would restore `"unlocked"` with no grace timer ever arming (the effect no longer re-runs on state changes), silently keeping the vault unlocked while away from it.
- The grace-timeout handler also **removes the sessionStorage flag** — without that, refreshing after a grace-timeout lock would re-unlock the vault.
- The footer keeps `mt-auto` (plan step 6 floated `mt-0`) — `mt-auto` pins the buttons to the bottom edge of the `min-h-[65vh]` card for short forms, which is the "buttons at the bottom" look the fix is meant to restore.
- Trade-off of removing `sm:overflow-visible`: dropdowns inside the card (parent-record picker, file selector) can now be clipped by the card's scroll container on desktop if they open near the card edge. Accepted per plan; watch for it in visual verification.

**Files changed:** `GenericDomainModal.tsx`, `GenericStorePage.tsx`, `VaultProvider.tsx`.

**Verification:** `npm run lint` and `npx tsc --noEmit` both pass. (A stray untracked UTF-16 backup file `original_modal.tsx` at the repo root — not created by this work — was breaking both checks; deleted with the user's confirmation.)

---

## ✅ 13. File Auto-Select After Save, Education Date Column, Tile Paperclip Position

**Problem 1: File panel reverts to the list instead of previewing a freshly saved upload**
`resetFileState()` set `selectedFileId` back to `null` on save, but `hasAutoSelectedRef.current` stayed `true`, so the auto-select effect never re-fired when the refreshed `attachedDocuments` arrived.
**Fix:** `resetFileState()` now also sets `hasAutoSelectedRef.current = false`, re-arming the auto-select effect for the next `files` refresh — the first file (including a just-uploaded one) is selected and its preview shown. Implementation note: `hasAutoSelectedRef` was declared *after* `resetFileState`, so the declaration was moved above it (the React Compiler rejects access-before-declaration, same as the Section 10 `setModalRecord` case).

**Problem 2: Education month view — Due Date overflows into Description**
`due_date` had `colSpan: 2` with `mobileBehavior: "fixed"` (`min-w-max whitespace-nowrap`), too narrow for `8/12/26`-style dates after the mobile tile-width refactor.
**Fix:** `ActiveEducationsBox.tsx`: `due_date` colSpan 2 → 3, `description` colSpan 2 → 1. Grid total stays 12 in both views.

**Problem 3: Tile paperclip centered in the header instead of flush to the trash's left**
The header's `justify-between` distributed three children (title div, paperclip span, trash button) evenly.
**Fix:** Paperclip span and trash button are wrapped in a single `<div className="flex items-center gap-1 shrink-0">` — `justify-between` now sees two groups, so the paperclip sits immediately left of the trash at the same Y level. `renderListRow` unchanged, as planned.

**Deviations from plan:**
- `colSpan: isPriorityView ? 3 : 3` written as plain `colSpan: 3` (identical semantics).
- Side effect of the re-arm fix (inherent to the mechanism): after *any* save that keeps files, the panel now auto-selects and previews the first file — not only after uploads. This matches the modal-open behavior; flag it if a different post-save view is wanted.

**Files changed:** `GenericDomainModal.tsx`, `ActiveEducationsBox.tsx`, `GenericStorePage.tsx`.

**Verification:** `npm run lint` and `npx tsc --noEmit` both pass. Visual verification via `npm run dev`.

## ✅ 14. Upload Jumps to Preview Before Save (Auto-Select Ref Split)

**Problem:** The Section 13 fix made `hasAutoSelectedRef` serve two intents (initial-load auto-select and post-save auto-select). After a save re-armed the ref, uploading another file called `setSelectedFileId(null)` — and with the ref `false`, `selectedFileId` `null`, and the staged upload already in `files`, the single-branch effect fired on the staged file and the modal immediately jumped to the file preview. The intended UX is that the file list stays visible until the user saves. (The same jump also existed for a first upload in a no-files modal, where the ref was never consumed.)

**Fix (per plan):**
1. `resetFileState()` no longer touches `hasAutoSelectedRef` — restored to only clearing state values.
2. New `pendingAutoSelectAfterSaveRef = useRef(false)` declared next to `hasAutoSelectedRef`.
3. Auto-select effect split into two branches: initial-load (consumes `hasAutoSelectedRef`) and post-save (consumes `pendingAutoSelectAfterSaveRef`).
4. `handleSave` sets `pendingAutoSelectAfterSaveRef.current = true` right after `resetFileState()`.

**Deviations from plan:**
- Both effect branches additionally require `newFiles.length === 0` (`newFiles` added to the effect deps). Without this guard, the literal two-branch design still violates the stated intent in two paths: (a) a first upload in a no-files modal — the initial-load branch fires on the staged file since `hasAutoSelectedRef` was never consumed; (b) an upload staged during the post-save reload window — the post-save branch consumes the pending flag on the staged file. Guarding on `newFiles.length === 0` restricts auto-select to refreshes of persisted `attachedDocuments`, never user-staged uploads. In a zero-files-before-save modal, the pending flag simply stays armed until the server refresh lands (`files.length > 0` fails on the stale list, the effect re-runs on refresh).
- Side effect carried over from Section 13: the post-save branch fires after *any* save that keeps files, not only uploads (selects the first file, matching modal-open behavior).

**Files changed:** `GenericDomainModal.tsx`.

**Verification:** `npm run lint` and `npx tsc --noEmit` both pass. Visual verification via `npm run dev`.

## ✅ 15. List Row Icon Spacing & Trash/Paperclip Order

**Problem 1: Large gap between paperclip and trash in list rows**
The paperclip `<span>` and trash `<button>` were separate direct children of the outer `flex gap-4` row, so the full 16px gap applied between them. The grid tile already wrapped them in `gap-1`; the list row was missing that wrapper.

**Problem 2: Paperclip hover-only on desktop in list rows**
The list-row paperclip had `md:opacity-0 md:group-hover:opacity-100`, hiding it on desktop until hover. The grid tile's paperclip had no opacity classes.

**Problem 3: Icon order**
Both views rendered [paperclip] [trash]; the wanted order is [trash] [paperclip].

**Fix:**
- `renderListRow`: paperclip and trash wrapped together in `<div className="flex items-center gap-1 shrink-0">` (matching the grid tile), trash first, hover-opacity classes removed from the paperclip.
- `renderGridTile`: inside the existing `gap-1` wrapper, trash and paperclip swapped so trash comes first.

**Deviations from plan:** None.

**Note:** This supersedes the "hover-revealed on desktop" paperclip expectation from Section 12 checklist item 17 — the paperclip is now always visible in both views; only the trash button remains hover-revealed on desktop.

**Files changed:** `GenericStorePage.tsx`.

**Verification:** `npm run lint` and `npx tsc --noEmit` both pass. Visual verification via `npm run dev`.

## ✅ 16. Vault Back Button Vertical Alignment on /vault and /vault/documents

**Problem:** On `/vault` and `/vault/documents`, the Back button sat 24px lower than the floating lock/vault badge from `VaultHeader` (`absolute top-0 right-0`). On `/vault/records`, `/vault/passwords`, and `/vault/banks` the alignment was already correct because `GenericStorePage`'s Back button starts at `top: 0` with no wrapper padding.

**Root cause:** `VaultHomeGrid` wrapped content in `space-y-6 px-4 py-6` and `vault/documents/page.tsx` wrapped `GenericStorePage` in `px-4 py-6` — the `pt-6` pushed the Back button 24px below `top: 0`.

**Fix:**
1. `VaultHomeGrid.tsx`: `py-6` → `pb-6` (keeps bottom + horizontal spacing).
2. `vault/documents/page.tsx`: `py-6` → `pb-6` (same).

**Deviations from plan:** None.

**Note:** `VaultHomeGrid` is also rendered as the dimmed background skeleton behind the vault lock screen (`VaultLockScreen`, `interactive={false}`). The top-padding removal shifts that skeleton's Back button up 24px as well — behind the PIN modal, cosmetic only, no functional impact.

**Files changed:** `VaultHomeGrid.tsx`, `vault/documents/page.tsx`.

**Verification:** `npm run lint` and `npx tsc --noEmit` both pass. Visual verification via `npm run dev`.
