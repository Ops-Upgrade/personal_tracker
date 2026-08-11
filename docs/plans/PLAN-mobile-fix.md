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
**1. Lazy implementation of the `/all` routes (Hidden toggles vs Removed Code)**
In `/medical/all`, `/expense/all`, `/taskmanager/all`, and `/education/all`, the dev agent passed a `disableMonthToggle` prop to `GenericViewPage` instead of properly refactoring the pages to use a flat list. As a result, the page is still actively grouping data into months (`monthGroups={monthGroups}`) and running unneeded filters in the background, but the UI button to switch to it is just hidden. 
**Fix:** We will properly strip the Month views out of all the `/all` route files and enforce `STANDARD_VIEWS.ALL_ONLY` to clean up the dead code.

**2. Education Quick Complete Button opening a Modal**
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

## 5. Mobile Hover Interaction Fixes

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

---

## 6. Generic Modal Mobile Scroll & Preview Fix

**Problem 1: File Preview Button Unclickable and Overlapping on Mobile**
In all domains that use `GenericDomainModal` with file attachments (including the Store view), the "Click to load preview" button overlaps other UI elements on mobile and is completely unclickable.
**Root Cause:** The modal enforces a strict `max-h-[85vh]` with a `flex-col` layout on mobile. The left form panel and right file panel both use `flex-1 min-h-0`, forcing them to split the modal height 50/50. The top nav and bottom upload zone in the file panel consume all of this tiny 50% height, squishing the `DocPreviewPanel` in the middle down to 0 pixels. This causes the fixed-size preview button to overflow its container and lose its clickable hit area due to flexbox constraints.
**Fix:** Keep the vertical flow on mobile but allow the *entire modal body* to scroll natively instead of splitting the screen 50/50.
- **Modal Body Wrapper:** Update to `overflow-y-auto sm:overflow-visible sm:overflow-y-auto` so the user can scroll the entire modal continuously on mobile.
- **Left Form Panel:** Allow it to expand to its natural height (`shrink-0 sm:shrink sm:flex-1`) and disable its internal scrollbar on mobile (`sm:overflow-y-auto`).
- **Right File Panel:** Allow it to take up its natural height on mobile (`shrink-0 sm:shrink sm:flex-1 sm:min-h-0`).
- **Preview Container Height:** Guarantee a minimum height for the `DocPreviewPanel` on mobile (e.g., `min-h-[300px] sm:min-h-0 sm:flex-1`). This ensures the preview button and document iframe always have enough breathing room to be fully visible and clickable without being crushed.

---

## 7. 2-Column Month View Mobile Reflow Fix

**Problem:** 
When navigating to the Month View on `ExpenseView` and `MedicalView` (or the `CollectionView` in media), the desktop layout is split into two columns. If the browser window is resized to emulate a mobile view, the layout stays stuck in a 2-column configuration or completely hides the second column, losing half the data.

**Root Cause:**
In `ExpenseView.tsx` and `MedicalView.tsx`, the `multi` view mode splits the array into two separate `div` elements (left and right columns) using `i % 2 === 0`. The right column is hidden on mobile using `hidden md:flex`. Because the left column's odd/even filter remains active regardless of screen size, hiding the right column causes half the months to disappear on mobile screens. In `CollectionView.tsx`, it uses `sm:grid-cols-2`, which may not collapse at the exact desired mobile breakpoint if the emulated width is slightly larger than 640px.

**Fix:**
We will abandon the Javascript odd/even array splitting and the `hidden md:flex` second column. Instead, we will use native CSS columns to handle the masonry layout responsively:
1. In `ExpenseView.tsx` and `MedicalView.tsx`, map over the `expensesByMonth`/`medicalByMonth` array exactly **once**.
2. Apply `columns-1 md:columns-2 gap-4 space-y-4` to the parent container when `viewMode === "multi"`.
3. Wrap each `GenericMonthRow` child in a `break-inside-avoid inline-block w-full mb-4` container to prevent the CSS columns from slicing a month tile in half.
4. This ensures that on mobile, the layout natively collapses into a single chronological column containing all items, and automatically splits into two columns on desktop.

---

## 8. Column Header Vertical Alignment Discrepancy

**Problem:** 
In all "View All" pages (and wherever `GenericDataGrid` is used), sortable column headers (like NAME, CLINIC, DATE) and non-sortable column headers (like DIAGNOSIS, FILES) are not vertically aligned at the same height. Sortable headers appear slightly higher than non-sortable ones.

**Root Cause:**
In `GenericDataGrid.tsx`, sortable headers use the `SortableHeader` component, which renders as an `inline-flex items-center` block. However, non-sortable headers are rendered as simple block `div` elements. This difference in display properties (`inline-flex` vs `block`) creates a baseline alignment discrepancy, compounded by the SVG icons in the sortable headers.

**Fix:**
We will standardize the HTML structure and CSS classes for both header types in `GenericDataGrid.tsx`.
1. The non-sortable header will be wrapped in the same outer container `<div className={getColSpanClass(col.colSpan)}>` as the sortable header.
2. Inside that container, the non-sortable text will be placed in a `<div className="inline-flex items-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">`.
3. This ensures both headers use identical flexbox vertical centering and baseline rendering. (We will also apply the truncation logic defined in the reusable architecture to prevent mobile overflow).
