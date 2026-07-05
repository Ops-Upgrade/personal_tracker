# Plan: Global Quality of Life (QoL) Improvements

**Date**: 2026-07-06
**Status**: Draft

## Goal
Combine global button migrations, follow-up button fixes, and responsive BoxContainer extraction into a single unified Quality of Life plan.
1. Create a global `Button` component and replace all raw `<button>` elements.
2. Fix button alignment, visibility of ghost variants, and Link component sizing.
3. Extract `BoxContainer` for uniform styling and apply flexible min/max responsive heights to scrollable areas.

## Reusable Inventory
| Element | Path | How it's reused |
|---------|------|-----------------|
| `clsx` | `package.json` | Used for conditional class merging in `Button`. |
| Task Manager styles | `src/components/taskmanager/*.tsx` | Abstracted into `BoxContainer`. |
| `MonthRow` | `src/components/expense/MonthRow.tsx` | Wrapped inside `BoxContainer`. |

## Phases & Tasks

### Phase 1 — Global Button Component & Fixes
#### Task 1.1 — Create and Refine `Button.tsx`
- **What**: Create a reusable `Button` component with variants (`primary`, `success`, `danger`, `secondary`, `ghost`) and sizes (`sm`, `md`, `lg`).
- Add `border border-transparent` to `ghost` variant to fix 2px layout shift.
- Improve `ghost` visibility (`text-blue-600 font-semibold hover:bg-blue-50`).
- Export `getButtonClasses(variant, size, className)` for use in `<Link>` components.
- **Where**: `src/components/common/Button.tsx`

### Phase 2 — Refactor TaskManager Module
#### Task 2.1 — Update Task Manager Buttons
- **What**: Replace actions in `ActiveTasksBox.tsx`, `CompletedTasksBox.tsx`, and `NotesBox.tsx`.
- Restore grid classes for inline actions (e.g., `<Button className="col-span-2 text-right">`).
- **Where**: `src/components/taskmanager/*.tsx`

### Phase 3 — Refactor Expense Module
#### Task 3.1 — Update Expense Buttons
- **What**: Replace raw `<button>` elements across `ExpenseView.tsx`, `ExpenseModal.tsx`, `MonthRow.tsx`, `FullMonthModal.tsx`.
- **Where**: `src/components/expense/*.tsx`

### Phase 4 — Fix Navbar Button Sizes
#### Task 4.1 — Equalize Settings and Sign Out
- **What**: Use `getButtonClasses({ variant: "secondary", size: "sm" })` for the `<Link>` tags in Navbar.
- **Where**: `src/components/layout/Navbar.tsx`

### Phase 5 — Create Reusable BoxContainer
#### Task 5.1 — Implement `BoxContainer`
- **What**: Standardize outer wrapper styling and optionally provide a standard inner scrollable area (`flex-1 min-h-[15rem] max-h-[80vh] overflow-y-auto`).
- **Where**: `src/components/common/BoxContainer.tsx`

#### Task 5.2 — Apply `BoxContainer` to Views
- **What**: Replace `article` tags and hardcoded heights in `ActiveTasksBox.tsx`, `CompletedTasksBox.tsx`, `NotesBox.tsx`, and `ExpenseView.tsx`.
- **Where**: `src/components/taskmanager/*.tsx`, `src/components/expense/ExpenseView.tsx`

## Verification Plan
- [ ] Verify `Button` component renders correctly without 2px layout shift on hover.
- [ ] Verify Navbar `Link` buttons match `<Button>` styles precisely.
- [ ] Verify `BoxContainer` limits scrollable height and responds dynamically on smaller screens.
