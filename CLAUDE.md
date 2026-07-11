# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick reference

- **Dev server:** `npm run dev` (uses `--webpack` for Next.js 16 Webpack fallback)
- **Build:** `npm run build`
- **Lint:** `npm run lint` (ESLint 9 with `eslint-config-next`)
- **No test suite** yet — verify changes manually by driving the UI (`npm run dev`).

## Essential docs (read first)

- **[`docs/context.md`](docs/context.md)** — stack, architecture, auth flow, crypto KMS, milestones, conventions, deployment checklist. **Always read this before planning work.**
- **[`docs/schema.md`](docs/schema.md)** — Supabase tables, columns, DDL, RLS policies, storage buckets. **Always read this before touching DB/DAL code.**
- **[`docs/plans/`](docs/plans/)** — feature-specific plans (`PLAN-crypto.md`, `PLAN-taskmanager.md`, `PLAN-expense.md`, `PLAN-education.md`, `PLAN-global_QOL.md`). Read the relevant plan before working on a feature.

**Keep these files current** — update them after any significant change (new tables, columns, endpoints, architecture changes, completed milestones).

## Architecture patterns you won't see from a single file

### Encrypted blob convention

Every feature table (`tasks`, `notes`, `expenses`, `educations`, `certificates`) has the same shape: `id`, `user_id`, `iv`, `data`, `created_at`. The `iv` + `data` columns hold the AES-GCM-encrypted JSON payload. **No plaintext business columns.** The API layer (`src/api/<feature>/`) encrypts on write and decrypts on read via `encryptField`/`decryptField` from `src/lib/crypto/`. Components never call Supabase directly — they go through the API layer.

### Auth & session flow

1. `proxy.ts` (NOT `middleware.ts` — Next.js 16 renamed the convention) runs on every request.
2. `getClaims()` validates JWT signature against Supabase public keys. Never use `getUser()` or `getSession()` for auth decisions.
3. `(protected)/layout.tsx` does a second server-side session check as defense-in-depth.
4. `CryptoProvider` (React context in protected layout) verifies the DEK exists in IndexedDB; redirects to `/login` if missing.
5. Login uses `bootstrapCrypto(userId, password)` to derive KEK → unwrap DEK → persist in IndexedDB.

### Route convention

All route paths are constants in `@/routes/paths.ts` (`ROUTES.LOGIN`, `ROUTES.DASHBOARD`, etc.). Never hardcode path strings in links or `router.push()` calls.

### Feature structure pattern

Every feature follows the same layered pattern:
```
src/api/<feature>/      # Service layer (wraps Supabase SDK, handles encryption)
src/components/<feature>/ # UI components + helpers.ts
src/app/(protected)/<feature>/  # Page route(s)
```

### Client-side encryption (crypto KMS)

- **Envelope encryption:** DEK (AES-GCM key) wrapped by password-derived KEK (Argon2id, 19 MiB, 2 iterations).
- **DEK storage:** non-extractable `CryptoKey` in IndexedDB (`personal-tracker-keys` / `dek-store`).
- **Login flow:** `bootstrapCrypto(userId, password)` → DEK ready in IndexedDB.
- **Logout flow:** `clearDEK(userId)` → `signOut()`.
- **Change password:** `rewrapDEK` wraps DEK with new KEK → `updateUser` changes auth password, with best-effort rollback if auth update fails.
- **Module:** `src/lib/crypto/` — `primitives.ts` (Web Crypto + Argon2id), `store.ts` (IndexedDB), `manager.ts` (orchestrator), `CryptoProvider.tsx` (React context gate).

### Storage bucket pattern

File uploads (expense invoices, certificates) are client-side encrypted with DEK before upload. Buckets are private with RLS. Files stored as `application/octet-stream` with `.enc` extension. Metadata (filename, MIME, IV) is stored inside the parent record's encrypted `data` blob.

### UI conventions

- `Button` component (`src/components/common/Button.tsx`) with variants: `primary`, `secondary`, `danger`, `ghost`. Use it instead of raw `<button>`.
- `BoxContainer` (`src/components/common/BoxContainer.tsx`) for standardized scrollable boxes.
- `useLocalStorage` hook for persisting UI preferences (view modes, sort state).
- All pages must be responsive — use Tailwind breakpoints (`sm`, `md`, `lg`), no fixed-width layouts.
- Theme: `@wrksz/themes` with `.dark` class selector; `ThemeSwitcher` in Navbar.

### Date handling

Use `getServerDateIST()` from `src/api/serverDate.ts` to get current IST date from a Supabase RPC. Don't use `new Date()` directly for "today" in feature logic — the server may be in a different timezone than the user.

### CSP considerations

`'wasm-unsafe-eval'` is required in the script-src directive for `hash-wasm` Argon2id. This does NOT enable JS `eval()`. Do not remove it.

### Key env vars

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable API key (note: NOT `ANON_KEY`) |
| `NEXT_PUBLIC_COOKIE_DOMAIN` | `localhost` in dev, `.ops-upgrade.com` in prod |

## Common tasks

### Adding a new feature table

1. Create the table in Supabase with the standard encrypted-blob shape (`id UUID PK`, `user_id UUID FK → auth.users`, `iv TEXT`, `data TEXT`, `created_at TIMESTAMPTZ`).
2. Add RLS policy: `FOR ALL USING (auth.uid() = user_id)`.
3. Create `src/api/<feature>/<feature>.ts` with encrypted CRUD functions.
4. Create `src/api/<feature>/index.ts` barrel export.
5. Update `docs/schema.md` with DDL and RLS.
6. Update `docs/context.md` project structure and milestones.

### Linking a storage bucket to a feature

1. Create the bucket in Supabase (private, RLS enforced).
2. Add RLS policies on `storage.objects` for INSERT/SELECT/DELETE/UPDATE.
3. Create `src/api/<feature>/<feature>Storage.ts` with encrypted upload/download.
4. Include file metadata (filename, IV, MIME) inside the parent record's encrypted `data` blob.
5. Update `docs/schema.md` with bucket config and RLS.
