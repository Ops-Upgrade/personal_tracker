# Plan: Global Quality of Life (QOL) Improvements

**Date**: 2026-07-06
**Status**: Implemented

## Goal
Implement global quality of life improvements across the application, combining multiple QOL efforts into a unified update:
1. Add a light/dark theme switch to the top navigation bar (`Navbar.tsx`) using a dedicated theme provider.
2. Persist user UI preferences (e.g., active view in Task Manager, sorting column in Expense View) across browser sessions on the *same device* using local storage.
3. Create a global `Button` component and replace all raw `<button>` elements.
4. Fix button alignment, visibility of ghost variants, and Link component sizing.
5. Extract `BoxContainer` for uniform styling and apply flexible min/max responsive heights to scrollable areas.
6. Current Date IST Integration: Refactor server year to date, display in Navbar, highlight current month, and pre-fill default modal dates.

## Reusable Inventory
| Element | Path | How it's reused |
|---------|------|-----------------|
| `Navbar` | `src/components/layout/Navbar.tsx` | Embed the new theme switch component and IST Date display. |
| `Button` | `src/components/common/Button.tsx` | Base for theme toggle button and global replacement for raw buttons. |
| React Hooks | `src/lib/useLocalStorage.ts` | Generic hook to simplify component state syncing. |
| `clsx` | `package.json` | Used for conditional class merging in `Button`. |
| Task Manager styles | `src/components/taskmanager/*.tsx` | Abstracted into `BoxContainer`. |
| `MonthRow` | `src/components/expense/MonthRow.tsx` | Wrapped inside `BoxContainer`. |
| `getServerDateIST` | `src/api/serverDate.ts` | Refactored from `getServerYear` for shared date fetching. |
| `MonthTile` | `src/components/common/MonthTile.tsx` | Accepts a highlighting style for the current month. |

## Package Decisions
| Package | Version | Decision | Reason |
|---------|---------|----------|--------|
| `@wrksz/themes` | `latest` | Use | Standard `next-themes` has known bugs with React 19 / Next.js 16 (hydration errors). `@wrksz/themes` fixes these issues. |
| `lucide-react` | `latest` | Use | Modern, clean icon library for the Sun/Moon icons needed for the toggle switch. |

## Phases & Tasks (Completed)

### Phase 1 — State Management & Theme Setup
- **Installed Theme Packages**: `@wrksz/themes` and `lucide-react`.
- **Created `useLocalStorage` hook**: Keeps component logic clean for UI preferences.
- **Created `ThemeProvider` Component**: Wraps app to provide theme context without hydration mismatches.
- **Wrapped App & Updated CSS**: Applied theme context globally and updated Tailwind CSS variables.

### Phase 2 — Component Integration (Theme & Persistance)
- **Created `ThemeSwitcher` Component**: UI toggle for Light/Dark/System themes.
- **Added Theme Switcher to Navbar**.
- **Updated UI Components**: `TaskManagerView` and `ExpenseTable` now use `useLocalStorage`.

### Phase 3 — Global Button Component & Fixes
- **Created `Button.tsx`**: Reusable component with variants and sizes, fixed alignment and layout shifts.
- **Refactored TaskManager & Expense Modules**: Replaced raw buttons with the global `<Button>`.
- **Fixed Navbar Button Sizes**: Standardized `<Link>` tags matching button sizes.

### Phase 4 — Reusable BoxContainer
- **Implemented `BoxContainer`**: Standardized outer wrapper styling with flexible scrollable areas.
- **Applied to Views**: Replaced `<article>` tags in Task Manager and Expense views.

### Phase 5 — Current Date IST Integration
- **Refactored Server Date**: Renamed `getServerYear` to `getServerDateIST`.
- **Displayed Date**: Added IST date to `Navbar`.
- **Month Highlighting**: Added current month highlight in `MonthTile` and related views.
- **Default Dates**: Set modals to pre-fill with today's date in IST.

## Verification Plan
- [x] Verify `<html>` tag receives `class="dark"` or `class="light"` based on selection.
- [x] Verify switching to "System" correctly inherits the OS preference.
- [x] Toggle active/completed views or sort states -> refresh -> preserves state instantly.
- [x] Verify `Button` component renders correctly without 2px layout shift on hover.
- [x] Verify Navbar `Link` buttons match `<Button>` styles precisely.
- [x] Verify `BoxContainer` limits scrollable height and responds dynamically.
- [x] Verify `getServerDateIST` correctly returns the date in IST.
- [x] Verify current month in Task Manager and Expense Tracker is highlighted (yellow tint).
- [x] Verify Create Task and Create Expense modals automatically populate today's date in IST.
