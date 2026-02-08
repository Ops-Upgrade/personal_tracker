# Personal Tracker — Project Context

> Handover file for agents and developers. Update after each major change.

---

## Overview

Personal tracker app for 1–3 trusted users to track expenses, tasks, and more.
No public signup — users are pre-created in Supabase dashboard.
Target deployment: Vercel with custom domain `ops-upgrade.com` and subdomains.

---

## Stack & Versions (as of 2026-02-08)

| Tool               | Version  | Notes                                        |
|--------------------|----------|----------------------------------------------|
| Next.js            | 16.1.6   | App Router, `src/` directory                 |
| React              | 19.2.3   |                                              |
| TypeScript         | ^5       | Strict mode                                  |
| Tailwind CSS       | ^4       | Via `@tailwindcss/postcss`                   |
| @supabase/ssr      | ^0.8.0   | Replaces deprecated `auth-helpers`           |
| @supabase/supabase-js | ^2.95.3 |                                           |
| Node.js            | 22+      | Required by Next.js 16                       |
| clsx               | ^2.1.1   | Class name utility                           |

---

## Project Structure

```
src/
├── app/                        # Next.js App Router pages
│   ├── (auth)/login/           # Public login page
│   ├── (protected)/            # Auth-guarded pages
│   │   ├── layout.tsx          # Session check + Navbar shell
│   │   └── dashboard/          # Landing page after login
│   └── api/auth/callback/      # Supabase auth callback endpoint
├── api/                        # Service layer (wraps Supabase SDK calls)
├── components/                 # Reusable UI (auth/, layout/, ui/)
├── lib/                        # Core utilities
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
| 2026-02-08 | Project scaffolded. Login + dashboard pages built. Auth flow complete (proxy, session refresh, persistent cookies). No DB schema yet. |

---

## What's Not Built Yet

- Expense tracking (UI + DB schema)
- Task tracking (UI + DB schema)
- Supabase database tables / RLS policies
- Cross-subdomain deployment (config-only change when ready)
- Analytics page

---

## Production Deployment Checklist

- [ ] Set env vars on Vercel (`PUBLISHABLE_KEY`, `COOKIE_DOMAIN=.ops-upgrade.com`)
- [ ] Add redirect URLs in Supabase Auth settings for each subdomain
- [ ] Add custom domain(s) in Vercel project settings
- [ ] Create user accounts in Supabase dashboard (no signup flow)
