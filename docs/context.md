# Personal Tracker — Project Context

> Handover file for agents and developers. Update after each major change.

---

## Overview

Personal tracker app for 1–3 trusted users to track expenses, tasks, and more.
No public signup — users are pre-created in Supabase dashboard.
Target deployment: Vercel with custom domain `ops-upgrade.com` and subdomains.

---

## Stack & Versions (as of 2026-07-08)

| Tool               | Version  | Notes                                        |
|--------------------|----------|----------------------------------------------|
| Next.js            | 16.2.10  | App Router, `src/` directory                 |
| React              | 19.2.3   |                                              |
| TypeScript         | ^5       | Strict mode                                  |
| Tailwind CSS       | ^4       | Via `@tailwindcss/postcss`                   |
| @supabase/ssr      | ^0.8.0   | Replaces deprecated `auth-helpers`           |
| @supabase/supabase-js | ^2.95.3 |                                           |
| @tiptap/react      | ^3.27.3  | Headless rich-text editor core               |
| @tiptap/starter-kit| ^3.27.3  | Basic rich-text formatting extensions        |
| hash-wasm          | ^4.12.0  | Argon2id WASM (~11 KB). Used only in `primitives.ts` |
| @wrksz/themes      | ^0.9.7   | Theme provider (light/dark/system). Fixes React 19 hydration issues present in `next-themes`. |
| @aws-sdk/client-s3 | ^3.1085.0 | AWS S3 SDK for Cloudflare R2-compatible object storage |
| @aws-sdk/s3-request-presigner | ^3.1079.0 | Presigned URL generation for R2 direct upload/download |
| lucide-react       | ^1.23.0  | Icon library (Sun/Moon for theme toggle, etc.) |
| Node.js            | 22+      | Required by Next.js 16                       |
| clsx               | ^2.1.1   | Class name utility                           |

---

## Project Structure

```
src/
├── app/                        # Next.js App Router pages
│   ├── (auth)/login/           # Public login page
│   ├── (protected)/            # Auth-guarded pages
│   │   ├── layout.tsx          # Session check + Navbar + CryptoProvider
│   │   ├── dashboard/          # Landing page after login
│   │   ├── taskmanager/        # Task manager feature page
│   │   ├── expense/            # Expense tracker feature page
│   │   ├── education/          # Education manager feature page
│   │   ├── medical/            # Medical records feature page
│   │   │   └── store/          # Medical Document Store sub-page
│   │   ├── vault/              # Vault feature pages
│   │   │   ├── records/        # Personal Records
│   │   │   ├── passwords/      # Password Manager
│   │   │   ├── banks/          # Bank Manager (Layer 1 + dynamic detail)
│   │   │   └── documents/      # Document Vault store
│   │   └── settings/
│   │       └── change-password/ # Change password page
│   ├── api/auth/callback/      # Supabase auth callback endpoint
│   └── api/storage/            # R2 storage API routes (presigned URLs + delete)
│       ├── _helpers/auth.ts    # Shared auth check for storage routes
│       ├── upload/             # POST — presigned PUT URL
│       ├── download/           # POST — presigned GET URL
│       └── delete/             # POST — server-side delete
├── api/                        # Service layer (wraps Supabase SDK calls)
│   ├── auth/
│   │   ├── auth.ts             # login, logout, changePassword, getSession
│   │   ├── keys.ts             # fetchUserKeys, upsertUserKeys
│   │   └── index.ts            # auth sub-barrel
│   ├── common/                 # Global API utilities
│   │   ├── documents.ts        # encrypted CRUD for global documents table
│   │   └── documentStorage.ts  # encrypted file upload/download for documents
│   ├── taskmanager/
│   │   ├── tasks.ts            # encrypted CRUD for tasks table
│   │   ├── notes.ts            # encrypted CRUD for notes table
│   │   └── index.ts            # taskmanager sub-barrel
│   ├── expense/
│   │   ├── expenses.ts         # encrypted CRUD for expenses table
│   │   ├── invoiceStorage.ts   # encrypted file upload/download for expenses bucket
│   │   └── index.ts            # expense sub-barrel
│   ├── education/
│   │   ├── educations.ts       # encrypted CRUD for educations table
│   │   └── index.ts            # education sub-barrel
│   ├── medical/
│   │   ├── records.ts          # encrypted CRUD for medical_records table
│   │   └── index.ts            # medical sub-barrel
│   ├── media/
│   │   ├── media.ts            # encrypted CRUD for media table
│   │   ├── collections.ts      # encrypted CRUD for media_collections table
│   │   ├── tmdb.ts             # client wrappers for TMDB proxy routes
│   │   └── index.ts            # media sub-barrel
│   ├── vault/
│   │   ├── vaultPin.ts         # Server Actions: verify/set/reset vault PIN
│   │   ├── vaultEntries.ts     # encrypted CRUD for vault_entries table
│   │   ├── vaultDocumentStorage.ts  # encrypted file upload/download for vault docs
│   │   └── index.ts            # vault sub-barrel
│   ├── serverDate.ts           # getServerDateIST() — IST date from Supabase RPC
│   └── index.ts                # Barrel export
├── components/                 # Reusable UI
│   ├── auth/                   # LoginForm, ChangePasswordForm
│   ├── layout/                 # Navbar, ThemeProvider
│   ├── common/                 # Shared primitives
│   │   ├── Button.tsx          # Variant-based button (primary/secondary/danger/ghost)
│   │   ├── BoxContainer.tsx    # Standardized scrollable box wrapper
│   │   ├── ThemeSwitcher.tsx   # Light/Dark/System theme toggle
│   │   ├── MonthTile.tsx       # Month tile with current-month highlight support
│   │   ├── DocPreviewPanel.tsx # Encrypted file preview panel (PDF/image)
│   │   ├── TileView.tsx        # Tile grid view for generic document store
│   │   ├── ViewToggle.tsx      # Toggle between list/tile views
│   │   ├── RichTextEditor.tsx  # Tiptap-powered global rich text area
│   │   └── store/              # Global Document Store components
│   │       ├── GlobalStoreView.tsx
│   │       └── StoreDocumentModal.tsx
│   ├── taskmanager/            # Task manager feature components + helpers
│   ├── expense/                # Expense tracker feature components
│   ├── education/              # Education manager feature components
│   │   ├── EducationView.tsx   # Main controller for education page
│   │   ├── ActiveEducationsBox.tsx
│   │   ├── CompletedEducationsBox.tsx
│   │   ├── CompletedEducationsModal.tsx
│   │   ├── EducationModal.tsx  # Create/edit education + document attachment
│   │   └── helpers.ts
│   ├── medical/                # Medical Records feature components
│   │   ├── MedicalView.tsx     # Main controller for medical records
│   │   └── MedicalModal.tsx    # Create/edit medical record + document attachment
│   ├── vault/                  # Vault feature components
│   │   ├── VaultProvider.tsx    # Context + state machine + grace timer
│   │   ├── VaultLockScreen.tsx  # Numpad PIN entry
│   │   ├── VaultPinSetup.tsx    # First-time PIN setup
│   │   ├── VaultPinReset.tsx    # Forgot PIN → reset via password
│   │   ├── VaultHeader.tsx      # Lock button + grace countdown
│   │   ├── VaultHome.tsx        # 2×2 section tile grid
│   │   ├── SecretField.tsx      # Masked value with reveal toggle + copy
│   │   ├── records/             # Personal Records section
│   │   ├── passwords/           # Password Manager section
│   │   ├── banks/               # Bank Manager section
│   │   └── documents/           # Document Vault section
│   └── media/                  # Media Tracker feature components
│       ├── MediaView.tsx       # Main orchestrator (tabs, data, CRUD)
│       ├── CollectionFilterBar.tsx # Filter bar for DefaultView
│       ├── CollectionModal.tsx # Create/rename/delete collection + color picker
│       ├── MediaStatusSection.tsx # One BoxContainer per status group
│       ├── MediaGrid.tsx       # CSS grid for media posters
│       ├── MediaCard.tsx       # Poster, title, quick status/rating controls
│       ├── TmdbAttribution.tsx # TMDB ToS attribution footer
│       ├── views/
│       │   ├── DefaultView.tsx # Tracked library (Watching/Not Watched/Watched)
│       │   ├── CollectionView.tsx # Grid of color-coded collections
│       │   └── DiscoverView.tsx # Untracked TMDB search/trending browser
│       └── pages/
│           ├── MoviePage.tsx   # Movie details, form, collections, remove
│           ├── TvSeriesPage.tsx # TV details, season selector, episode matrix
│           ├── EpisodePage.tsx  # Single episode details, form, comments
│           └── CollectionDetailPage.tsx # Views all media for a collection
├── lib/                        # Core utilities
│   ├── crypto/                 # Client-side encryption (see below)
│   │   ├── primitives.ts       # Web Crypto + Argon2id wrappers
│   │   ├── store.ts            # IndexedDB DEK persistence
│   │   ├── manager.ts          # High-level orchestrator
│   │   ├── CryptoProvider.tsx  # React context — DEK readiness gate
│   │   └── index.ts            # Barrel export
│   ├── r2/                     # Cloudflare R2 client (S3-compatible)
│   │   ├── client.ts           # S3Client singleton + R2_BUCKET constant
│   │   └── index.ts            # Barrel export
│   ├── supabase/               # 3 client factories: client.ts, server.ts, proxy.ts
│   └── useLocalStorage.ts      # Generic hook: state synced with localStorage
├── routes/                     # Centralized route paths + config
├── types/                      # Shared TypeScript types
│   ├── education.ts            # Education + Certificate types
│   └── ...                     # Other feature types
└── proxy.ts                    # Next.js proxy (auth guard + session refresh)
```

**Key conventions:**
- Components import from `@/api/` — never call Supabase directly.
- Route paths are constants in `@/routes/paths.ts` — no hardcoded strings.
- `proxy.ts` (not `middleware.ts`) — Next.js 16 renamed the convention.
- Auth session refresh uses `getClaims()` (not `getUser()` or `getSession()`).
- Env var is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (not legacy `ANON_KEY`).
- Database schema and RLS are documented in [`schema.md`](./schema.md).
- Crypto implementation plan and progress tracked in [`plans/PLAN-crypto.md`](./plans/PLAN-crypto.md).
- Task Manager feature plan and progress tracked in [`plans/PLAN-taskmanager.md`](./plans/PLAN-taskmanager.md).
- Expense Tracker feature plan and progress tracked in [`plans/PLAN-expense.md`](./plans/PLAN-expense.md).
- Education feature plan tracked in [`plans/PLAN-education.md`](./plans/PLAN-education.md).
- Medical Records + Global Document Store plan tracked in [`plans/PLAN-medical-records.md`](./plans/PLAN-medical-records.md).
- Global QoL (buttons, boxcontainer, date) plan in [`plans/PLAN-qol-global.md`](./plans/PLAN-qol-global.md).
- **All pages must be responsive** (laptop + mobile). Use Tailwind breakpoints (`sm`, `md`, `lg`) — no fixed-width layouts.
- UI preferences (view modes, sort state) are persisted via `useLocalStorage` hook — no server-side changes needed.

---

## Auth Architecture

- **Login only, no signup.** Users created manually in Supabase dashboard.
- **Cookie-based sessions** via `@supabase/ssr` (not localStorage).
- **Persistent login** — cookies survive browser close/reopen.
- **Multi-device** — independent refresh tokens per device.
- **Cross-subdomain ready** — `NEXT_PUBLIC_COOKIE_DOMAIN` env var controls cookie domain. Set to `localhost` for dev, `.ops-upgrade.com` for production.
- **Proxy** refreshes session + redirects unauthed users to `/login`.
- **Protected layout** validates session server-side as defense-in-depth.

---

## Client-Side Encryption (Crypto KMS)

- **Envelope encryption:** each user has a Data Encryption Key (DEK) wrapped by a password-derived Key Encryption Key (KEK).
- **KEK derivation:** Argon2id (19 MiB, 2 iterations, 1 parallelism) via `hash-wasm`.
- **DEK storage:** non-extractable CryptoKey persisted in IndexedDB (`personal-tracker-keys` / `dek-store`).
- **Supabase table:** `public.user_keys` holds salt + IV + wrapped DEK (ciphertext only — server never sees plaintext key).
- **Login flow:** Supabase auth → `bootstrapCrypto(userId, password)` → DEK available in IndexedDB.
- **Logout flow:** `clearDEK(userId)` → IndexedDB wiped → `signOut()`.
- **Session persistence:** `CryptoProvider` in protected layout checks DEK on mount; redirects to `/login` if missing.
- **Change password:** `rewrapDEK` re-wraps DEK with new KEK, then `updateUser` changes Supabase auth password, with best-effort rollback (`new -> old`) if auth update fails.
- **Data encryption (Phase 7):** complete and in production code paths. Task and notes writes call `encryptField(userId, plaintext)`, reads call `decryptField(userId, iv, ciphertext)`.

---

## Security Headers

Applied via `next.config.ts` `headers()` on all routes:

| Header | Value |
|--------|-------|
| Content-Security-Policy | `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co https://*.r2.cloudflarestorage.com; img-src 'self' blob: data:; frame-ancestors 'none'` |
| X-Content-Type-Options | `nosniff` |
| X-Frame-Options | `DENY` |
| Referrer-Policy | `strict-origin-when-cross-origin` |
| Strict-Transport-Security | `max-age=63072000; includeSubDomains` |
| Permissions-Policy | `camera=(), microphone=(), geolocation=()` |

`'wasm-unsafe-eval'` is required for `hash-wasm` Argon2id WASM. Does not enable JS `eval()`.

---

## Environment Variables

| Variable                              | Purpose                       | Dev value       |
|---------------------------------------|-------------------------------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL`            | Supabase project URL          | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`| Supabase publishable API key  | `sb_publishable_...` |
| `NEXT_PUBLIC_COOKIE_DOMAIN`           | Cookie domain scope           | `localhost`     |
| `R2_ACCOUNT_ID`                       | Cloudflare account ID (server-only) | —               |
| `R2_ACCESS_KEY_ID`                    | R2 API token access key (server-only) | —               |
| `R2_SECRET_ACCESS_KEY`                | R2 API token secret key (server-only) | —               |
| `R2_BUCKET_NAME`                      | R2 bucket name (server-only, default: `personal-tracker`) | —               |

---

## Milestones

| Date       | What                                                        |
|------------|-------------------------------------------------------------|
| 2026-02-08 | Project scaffolded. Login + dashboard pages built. Auth flow complete (proxy, session refresh, persistent cookies). |
| 2026-04-11 | Crypto KMS: Phases 1–6, 8–9 complete. `user_keys` table + RLS, full crypto module (`src/lib/crypto/`), login/logout integration, CryptoProvider, change password flow, security headers. Phase 7 (data encryption wrappers) deferred until first feature table. Phase 10 (manual testing) pending. |
| 2026-04-12 | Crypto Phase 7 completed and verified via Task Manager feature integration (encrypted `tasks` + `notes` tables). API layer refactored into feature subdirectories (`src/api/auth/*`, `src/api/taskmanager/*`). |
| 2026-04-12 | Task Manager feature F1.1–F1.10 completed: `/taskmanager` route, modular UI components, active/completed dual views, hash-modals, task/note CRUD, dashboard-tile entry integration, responsive + loading/error polish. |
| 2026-04-12 | Password change flow hardened with best-effort key rollback if Supabase auth update fails after DEK re-wrap. |
| 2026-06-22 | Expense Tracker plan drafted (`plans/PLAN-expense.md`). Minor navbar/layout visual polish. |
| 2026-06-23 | Expense Tracker feature F2.1–F2.10 completed: `/expense` route, `expenses` table + RLS, encrypted CRUD API layer (`src/api/expense/`), 6 UI components (`ExpenseView`, `MonthRow`, `ExpenseTable`, `ExpenseModal`, `FullMonthModal`, `YearDropdown`), year-grouped calendar view with 12 month rows, inline expand/retract with 5-item preview, hash-based full-month modal, create/edit/delete with `ConfirmDialog`, ₹ formatting, dashboard tile integration, responsive layout, loading/error states. |
| 2026-07-01 | Expense Tracker: month rows layout changed from vertical stack to 2-column grid (`lg:grid-cols-2`). Task Manager bug fix: fixed past-year tasks showing in current year section + server-side year fetching. |
| 2026-07-02 | Expense Tracker invoice file upload completed: Added client-side encrypted file uploads for expense attachments, storage bucket RLS, and inline previews. |
| 2026-07-06 | Global QoL improvements: Global `Button` component + variants, `BoxContainer` for uniform scrollable areas, `useLocalStorage` hook for persisting UI prefs (view modes, sort state). Expense Table columns now have sort indicators. |
| 2026-07-06 | Light/Dark/System theme switch added: `@wrksz/themes` + `lucide-react` installed, `ThemeProvider` + `ThemeSwitcher` components, Navbar integration, CSS updated to `.dark` class selector. |
| 2026-07-06 | IST date integration: `serverDate.ts` (`getServerDateIST`) replacing `serverYear.ts`, Navbar displays current IST date, current month highlighted in Task Manager + Expense views, modals pre-fill today's date. |
| 2026-07-07 | Education feature plan drafted (`plans/PLAN-education.md`). `educations` + `certificates` tables + RLS + `certificates` storage bucket created in Supabase. |
| 2026-07-08 | Education Manager feature completed: `/education` route (3-box layout: Active, Completed, Certificate Store), `/education/store` sub-page (tile view), encrypted CRUD for educations + certificates, multi-file certificate upload/download with `DocPreviewPanel` and `TileView`, full modal flows for Education + Certificate + Certificate Store. Dashboard tile integration. |
| 2026-07-12 | Migrated file storage from Supabase Storage to Cloudflare R2. Added `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`, R2 client singleton (`src/lib/r2/`), presigned-URL API routes (`src/app/api/storage/`), rewrote `encryptedFileStorage.ts` to use R2 via API routes. Removed all `supabase.storage` SDK calls. Updated CSP, docs, and UI text. |
| 2026-07-13 | Medical Records, Global Document Store & Rich Text Editor completed: Extracted Store out of Education into reusable `documents` table + global components. Tiptap Rich Text Editor integrated into Task, Expense, Education, and new Medical domains. Built `/medical` feature route with `MedicalModal` and `MedicalView`. |
| 2026-07-15 | Media Tracker feature completed: `/media` route, `media` + `media_collections` tables (HLD documented in schema.md), 4 TMDB proxy routes (`/api/tmdb/*`), encrypted CRUD API layer (`src/api/media/`), 12 UI components (MediaView orchestrator, DefaultView with Watching/Unwatched/Watched lanes, CollectionView, DiscoverView with TMDB search, MoviePage, TvSeriesPage with episode matrix, EpisodePage, CollectionDetailPage, MediaCard with inline status/rating, CollectionModal with color picker, CollectionFilterBar, TmdbAttribution), dashboard tile integration (violet), `next.config.ts` TMDB image domain + CSP update, StarRating common component. |
| 2026-07-24 | Vault feature completed: `/vault` route with PIN-protected access, server-side Argon2id PIN hashing with brute-force protection (10 attempts / 10-min sliding window, permanent DB-persisted lockout), 4 sub-sections (Personal Records, Password Manager, Bank Manager, Document Vault), `vault_entries` encrypted table + RLS, vault storage bucket folder, 2×2 gray-themed dashboard tile replacing Analytics placeholder, 30-second navigation-away grace period. |

---

## What's Not Built Yet

- Cross-subdomain deployment (config-only change when ready)
- Phase 10: manual testing of crypto flows

---

## Production Deployment Checklist

- [ ] Set env vars on Vercel (`PUBLISHABLE_KEY`, `COOKIE_DOMAIN=.ops-upgrade.com`)
- [ ] Add redirect URLs in Supabase Auth settings for each subdomain
- [ ] Add custom domain(s) in Vercel project settings
- [ ] Create user accounts in Supabase dashboard (no signup flow)
- [ ] Run Phase 10 testing checklist (see [`PLAN-crypto.md`](./PLAN-crypto.md))
