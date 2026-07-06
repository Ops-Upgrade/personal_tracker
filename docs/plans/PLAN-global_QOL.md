# Plan: Global Quality of Life (QOL) Improvements

**Date**: 2026-07-06
**Status**: Draft

## Goal
Implement global quality of life improvements across the application, specifically:
1. Add a light/dark theme switch to the top navigation bar (`Navbar.tsx`) using a dedicated theme provider.
2. Persist user UI preferences (e.g., active view in Task Manager, sorting column in Expense View) across browser sessions on the *same device* using local storage (zero server-side changes).

## Reusable Inventory (from existing codebase)
| Element | Path | How it's reused |
|---------|------|-----------------|
| `Navbar` | `src/components/layout/Navbar.tsx` | Embed the new theme switch component in the right-side actions area. |
| `Button` | `src/components/common/Button.tsx` | Can be used as the base for the theme toggle button. |
| React Hooks | React | Create a reusable `useLocalStorage` hook to simplify component state syncing. |

## Package Decisions
| Package | Version | Decision | Reason |
|---------|---------|----------|--------|
| `@wrksz/themes` | `latest` | Use | Standard `next-themes` has known bugs with React 19 / Next.js 16 (hydration errors). `@wrksz/themes` fixes these issues. |
| `lucide-react` | `latest` | Use | Modern, clean icon library for the Sun/Moon icons needed for the toggle switch. |

## ⚠️ Flagged Observations
- **Theme Switcher**: The project is using Tailwind CSS v4 and Next.js 16 (with React 19). Tailwind v4 natively supports `dark:` utility classes but expects manual dark mode configuration for toggles. We will need to slightly update `globals.css` from `@media (prefers-color-scheme: dark)` to `.dark` class selector.
- **Local Only Persistence**: Since we dropped the database persistence for UI prefs, if you log in on a new device or a different browser, it will use the default UI views until set on that device.
- **SSR Hydration**: Next.js Server Components and hydration mean we need to be careful with `localStorage`. We will implement a pattern where the hook initializes gracefully to avoid hydration mismatches.

## Phases & Tasks

### Phase 1 — State Management & Theme Setup
#### Task 1.1 — Install Theme Packages
- **What**: Install `@wrksz/themes` and `lucide-react`.
- **Where**: `package.json`
- **Why**: Dependencies for state management of themes and icons.

#### Task 1.2 — Create `useLocalStorage` hook
- **What**: Create a generic React hook that mimics `useState` but automatically reads/writes to `localStorage`.
- **Where**: `src/lib/useLocalStorage.ts`
- **Why**: Keeps the component logic clean and reusable for any future UI preference.

#### Task 1.3 — Create Theme Provider Component
- **What**: Create a client component wrapper for the theme provider to avoid hydration mismatch.
- **Where**: `src/components/layout/ThemeProvider.tsx` (NEW)
- **Why**: Next.js App Router requires client components for context providers that use state (like theme).

#### Task 1.4 — Wrap App & Update CSS
- **What**: Wrap the root layout's children with the new `ThemeProvider`. Add `suppressHydrationWarning` to the `<html>` tag. Update the dark mode CSS variables to use `.dark` class.
- **Where**: `src/app/layout.tsx`, `src/app/globals.css`
- **Why**: Allows the theme context to be accessed globally and updates CSS variables to use the `.dark` class.

### Phase 2 — Component Integration
#### Task 2.1 — Create Theme Switcher Component
- **What**: Create a dropdown or toggle button component that switches between Light, Dark, and System themes using `useTheme` hook.
- **Where**: `src/components/common/ThemeSwitcher.tsx` (NEW)

#### Task 2.2 — Add Theme Switcher to Navbar
- **What**: Add the `ThemeSwitcher` to the right side of the `Navbar`.
- **Where**: `src/components/layout/Navbar.tsx`

#### Task 2.3 — Update UI Components with LocalStorage
- **What**: Replace the `useState` calls for `activeView` and `completedView` in `TaskManagerView`, and `sortState` in `ExpenseTable` with the new `useLocalStorage` hook.
- **Where**: `src/components/taskmanager/TaskManagerView.tsx`, `src/components/expense/ExpenseTable.tsx`
- **Keys**: `"taskManagerActiveView"`, `"taskManagerCompletedView"`, `"expenseTableSortState"`

## New Reusable Components Introduced
| Component | Path | Purpose | Reusable for |
|-----------|------|---------|--------------|
| `ThemeProvider` | `src/components/layout/ThemeProvider.tsx` | Wraps app to provide theme context | Entire application |
| `ThemeSwitcher` | `src/components/common/ThemeSwitcher.tsx` | UI toggle for theme switching | Any layout, settings page, or mobile menu |
| `useLocalStorage` | `src/lib/useLocalStorage.ts` | State synced with localStorage | Any future UI preference |

## Verification Plan
- [ ] Verify `<html>` tag receives `class="dark"` or `class="light"` based on selection, without page reload.
- [ ] Verify there is no "flash of unstyled content" (FOUC) on page refresh in dark mode.
- [ ] Verify switching to "System" correctly inherits the OS preference.
- [ ] Toggle active/completed views in TaskManager -> Refresh the page -> View should be preserved instantly.
- [ ] Change sort in ExpenseTable -> Close the browser tab and reopen -> Sort should be preserved instantly.
- [ ] Confirm the Next.js dev server shows no hydration mismatch errors in the console.
