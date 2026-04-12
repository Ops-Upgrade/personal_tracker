# Personal Tracker — Project Context

> Handover file for agents and developers. Update after each major change.

---

## Overview

Personal tracker app for 1–3 trusted users to track expenses, tasks, and more.
No public signup — users are pre-created in Supabase dashboard.
Target deployment: Vercel with custom domain `ops-upgrade.com` and subdomains.

---

## Stack & Versions (as of 2026-04-12)

| Tool               | Version  | Notes                                        |
|--------------------|----------|----------------------------------------------|
| Next.js            | 16.1.6   | App Router, `src/` directory                 |
| React              | 19.2.3   |                                              |
| TypeScript         | ^5       | Strict mode                                  |
| Tailwind CSS       | ^4       | Via `@tailwindcss/postcss`                   |
| @supabase/ssr      | ^0.8.0   | Replaces deprecated `auth-helpers`           |
| @supabase/supabase-js | ^2.95.3 |                                           |
| hash-wasm          | ^4.12.0  | Argon2id WASM (~11 KB). Used only in `primitives.ts` |
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
│   │   └── settings/
│   │       └── change-password/ # Change password page
│   └── api/auth/callback/      # Supabase auth callback endpoint
├── api/                        # Service layer (wraps Supabase SDK calls)
│   ├── auth/
│   │   ├── auth.ts             # login, logout, changePassword, getSession
│   │   ├── keys.ts             # fetchUserKeys, upsertUserKeys
│   │   └── index.ts            # auth sub-barrel
│   ├── taskmanager/
│   │   ├── tasks.ts            # encrypted CRUD for tasks table
│   │   ├── notes.ts            # encrypted CRUD for notes table
│   │   └── index.ts            # taskmanager sub-barrel
│   └── index.ts                # Barrel export
├── components/                 # Reusable UI
│   ├── auth/                   # LoginForm, ChangePasswordForm
│   ├── layout/                 # Navbar
│   └── taskmanager/            # Task manager feature components + helpers
├── lib/                        # Core utilities
│   ├── crypto/                 # Client-side encryption (see below)
│   │   ├── primitives.ts       # Web Crypto + Argon2id wrappers
│   │   ├── store.ts            # IndexedDB DEK persistence
│   │   ├── manager.ts          # High-level orchestrator
│   │   ├── CryptoProvider.tsx  # React context — DEK readiness gate
│   │   └── index.ts            # Barrel export
│   └── supabase/               # 3 client factories: client.ts, server.ts, proxy.ts
├── routes/                     # Centralized route paths + config
├── types/                      # Shared TypeScript types
└── proxy.ts                    # Next.js proxy (auth guard + session refresh)
```

**Key conventions:**
- Components import from `@/api/` — never call Supabase directly.
- Route paths are constants in `@/routes/paths.ts` — no hardcoded strings.
- `proxy.ts` (not `middleware.ts`) — Next.js 16 renamed the convention.
- Auth session refresh uses `getClaims()` (not `getUser()` or `getSession()`).
- Env var is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (not legacy `ANON_KEY`).
- Database schema and RLS are documented in [`schema.md`](./schema.md).
- Crypto implementation plan and progress tracked in [`PLAN-crypto.md`](./PLAN-crypto.md).
- Task Manager feature plan and progress tracked in [`docs/PLAN-taskmanager.md`](./docs/PLAN-taskmanager.md).
- **All pages must be responsive** (laptop + mobile). Use Tailwind breakpoints (`sm`, `md`, `lg`) — no fixed-width layouts.

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
| Content-Security-Policy | `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co; img-src 'self' blob: data:; frame-ancestors 'none'` |
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

---

## Milestones

| Date       | What                                                        |
|------------|-------------------------------------------------------------|
| 2026-02-08 | Project scaffolded. Login + dashboard pages built. Auth flow complete (proxy, session refresh, persistent cookies). |
| 2026-04-11 | Crypto KMS: Phases 1–6, 8–9 complete. `user_keys` table + RLS, full crypto module (`src/lib/crypto/`), login/logout integration, CryptoProvider, change password flow, security headers. Phase 7 (data encryption wrappers) deferred until first feature table. Phase 10 (manual testing) pending. |
| 2026-04-12 | Crypto Phase 7 completed and verified via Task Manager feature integration (encrypted `tasks` + `notes` tables). API layer refactored into feature subdirectories (`src/api/auth/*`, `src/api/taskmanager/*`). |
| 2026-04-12 | Task Manager feature F1.1–F1.10 completed: `/taskmanager` route, modular UI components, active/completed dual views, hash-modals, task/note CRUD, dashboard-tile entry integration, responsive + loading/error polish. |
| 2026-04-12 | Password change flow hardened with best-effort key rollback if Supabase auth update fails after DEK re-wrap. |

---

## What's Not Built Yet

- Expense tracking (UI + DB schema + encryption wiring)
- Cross-subdomain deployment (config-only change when ready)
- Analytics page
- Phase 10: manual testing of crypto flows

---

## Production Deployment Checklist

- [ ] Set env vars on Vercel (`PUBLISHABLE_KEY`, `COOKIE_DOMAIN=.ops-upgrade.com`)
- [ ] Add redirect URLs in Supabase Auth settings for each subdomain
- [ ] Add custom domain(s) in Vercel project settings
- [ ] Create user accounts in Supabase dashboard (no signup flow)
- [ ] Run Phase 10 testing checklist (see [`PLAN-crypto.md`](./PLAN-crypto.md))
