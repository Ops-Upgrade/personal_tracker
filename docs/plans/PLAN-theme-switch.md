# Plan: Add Light/Dark Theme Switch on Top Bar

**Date**: 2026-07-06
**Status**: Draft

## Goal
Add a light/dark theme switch to the top navigation bar (`Navbar.tsx`). This allows users to manually toggle between light mode, dark mode, or system preference. We will use a dedicated theme provider package and a new reusable `ThemeSwitcher` component.

## Reusable Inventory (from existing codebase)
| Element | Path | How it's reused |
|---------|------|-----------------|
| `Navbar` | `src/components/layout/Navbar.tsx` | We will embed the new theme switch component in the right-side actions area of the top bar. |
| `Button` | `src/components/common/Button.tsx` | Can be used as the base for the theme toggle button (specifically the icon variant if supported, or styled similarly). |

## Package Decisions
| Package | Version | Decision | Reason |
|---------|---------|----------|--------|
| `@wrksz/themes` | `latest` | Use | Standard `next-themes` has known bugs with React 19 / Next.js 16 (hydration errors, script warnings). `@wrksz/themes` is a drop-in replacement that fixes these issues and works seamlessly with React 19. |
| `lucide-react` | `latest` | Use | Modern, clean icon library for the Sun/Moon icons needed for the toggle switch. The package is actively maintained (only specific brand icons were deprecated, which we won't use). |

## ⚠️ Flagged Observations
- The project is using Tailwind CSS v4 and Next.js 16 (with React 19). Tailwind v4 natively supports `dark:` utility classes but expects manual dark mode configuration for toggles. We will need to slightly update `globals.css` from `@media (prefers-color-scheme: dark)` to `.dark` class selector so the manual toggle overrides system defaults appropriately.

## Phases & Tasks

### Phase 1 — Setup Theme Provider
#### Task 1.1 — Install Packages
- **What**: Install `@wrksz/themes` and `lucide-react`.
- **Where**: `package.json`
- **Why**: Dependencies for state management of themes and icons.

#### Task 1.2 — Create Theme Provider Component
- **What**: Create a client component wrapper for the theme provider to avoid hydration mismatch.
- **Where**: `src/components/layout/ThemeProvider.tsx` (NEW)
- **Why**: Next.js App Router requires client components for context providers that use state (like theme).
- **New Artifacts**: `ThemeProvider.tsx` - Highly reusable across the app.

#### Task 1.3 — Wrap App with Theme Provider
- **What**: Wrap the root layout's children with the new `ThemeProvider`. Add `suppressHydrationWarning` to the `<html>` tag.
- **Where**: `src/app/layout.tsx`
- **Why**: Allows the theme context to be accessed globally and ensures the script injects correctly before render to prevent flickering.

#### Task 1.4 — Update Global CSS for Class Strategy
- **What**: Update the dark mode CSS variables to use `.dark` class instead of just the media query.
- **Where**: `src/app/globals.css`
- **Why**: For `next-themes` (or `@wrksz/themes`) to work, we need a CSS class (`.dark`) that applies the dark variables.

### Phase 2 — Build Theme Switcher & Integrate
#### Task 2.1 — Create Theme Switcher Component
- **What**: Create a dropdown or toggle button component that switches between Light, Dark, and System themes using `useTheme` hook.
- **Where**: `src/components/common/ThemeSwitcher.tsx` (NEW)
- **Why**: Modularize the theme switching logic so it can be reused anywhere (e.g., settings page, mobile menu).
- **Reuse**: May reuse `Button` or similar styling patterns.
- **New Artifacts**: `ThemeSwitcher.tsx` - Reusable UI component.

#### Task 2.2 — Add to Navbar
- **What**: Add the `ThemeSwitcher` to the right side of the `Navbar`, next to the user settings/logout buttons.
- **Where**: `src/components/layout/Navbar.tsx`
- **Why**: Meets the user's specific request to have it on the top bar.
- **Depends on**: Task 2.1

## New Reusable Components Introduced
| Component | Path | Purpose | Reusable for |
|-----------|------|---------|--------------|
| `ThemeProvider` | `src/components/layout/ThemeProvider.tsx` | Wraps app to provide theme context | Entire application |
| `ThemeSwitcher` | `src/components/common/ThemeSwitcher.tsx` | UI toggle for theme switching | Any layout, settings page, or mobile menu |

## Verification Plan
- [ ] Verify `<html>` tag receives `class="dark"` or `class="light"` based on selection.
- [ ] Verify page background and text colors change immediately without page reload.
- [ ] Verify there is no "flash of unstyled content" (FOUC) on page refresh in dark mode.
- [ ] Verify the icon inside the top bar updates correctly (Sun for light, Moon for dark).
- [ ] Verify switching to "System" correctly inherits the OS preference.
