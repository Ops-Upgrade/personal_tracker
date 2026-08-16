# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick reference

- **Dev server:** `npm run dev` (uses `--webpack` for Next.js 16 Webpack fallback)
- **Build:** `npm run build` (also `--webpack` — Next 16 Turbopack dev mode does not emit Tailwind variant rules, so the Webpack fallback is mandatory for both)
- **Lint:** `npm run lint` (ESLint 9 with `eslint-config-next`)
- **Tests:** `npm test` (vitest, config `vitest.config.mts`) — Tier 1 pure-function unit tests (hermetic, `vi.mock`ed Supabase/crypto). `npm run test:integration` (config `vitest.integration.config.mts`) — media Tier 2/3 suites against the REAL Supabase project as the dummy test user (credentials in gitignored `.env.test.local`; fails fast if absent; excluded from `npm test`; per-test teardown wipes only the dummy user's rows). See `docs/plans/PLAN-mediamanager.md` Stage 11. No component tests yet — still verify UI changes manually by driving the UI (`npm run dev`).

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

File uploads (expense invoices, certificates) are client-side encrypted with DEK before upload. Files are stored in Cloudflare R2 (`personal-tracker` bucket) under folder-prefixed paths (`expenses/{userId}/...`, `certificates/{userId}/...`). The client gets presigned URLs from Next.js API routes (`/api/storage/upload`, `/api/storage/download`, `/api/storage/delete`), then uploads/downloads directly to/from R2. Server-side delete uses `DeleteObjectCommand` directly. Files stored as `application/octet-stream` with `.enc` extension. Metadata (filename, MIME, IV) is stored inside the parent record's encrypted `data` blob.

### UI conventions

- `Button` component (`src/components/common/Button.tsx`) with variants: `primary`, `secondary`, `danger`, `ghost`. Use it instead of raw `<button>`.
- `BoxContainer` (`src/components/common/BoxContainer.tsx`) for standardized scrollable boxes.
- `useLocalStorage` hook for persisting UI preferences (view modes, sort state).
- All pages must be responsive — use Tailwind breakpoints (`sm`, `md`, `lg`), no fixed-width layouts.
- Theme: `@wrksz/themes` with `.dark` class selector; `ThemeSwitcher` in Navbar.
- Data tables: `GenericDataGrid` renders all domain tables. Column widths come from `ColumnDef.sizing` — `"fixed"` gets `minmax(max-content, var(--fixed-expand))` (content-fit on mobile; expands by one `fr` share from the `md` breakpoint up so leftover space spreads evenly between every column) and `"flex"` gets `minmax(1ch, weightFr)` (names, descriptions, providers; CSS ellipsis truncates, never shrinks below one character). `--fixed-expand` (`0fr` → `1fr` at 768px) lives in `globals.css`. Header and rows are CSS Grid **subgrids** of one outer grid, so tracks are sized across all rows at once and can never drift. Never hand-roll `grid-cols-12`/`col-span-*` math for tables — there is no breakpoint arithmetic to maintain. The grid's outermost container keeps `w-full min-w-0` so the grid can never widen the page beyond its parent.
- Richtext cells: description/reason/diagnosis columns store Tiptap HTML. Always render them through `stripHtml()` from `@/lib/viewHelpers` so tags like `<p>` never leak into table cells; CSS ellipsis (not `trunc()`) handles length.
- Column factories: shared column concepts (priority badge, files count, richtext, date) are built ONLY in `src/components/common/columns.tsx` (`colPriority`, `colFiles`, `colRichtext`, `colDate`). Domain configs export atoms composed from them (e.g. `TASK_PRIORITY`), and widgets/pages assemble per-view arrays from atoms — never re-declare a column's render/sizing/align inline. Date rendering goes through `formatShortDate` from `@/lib/format` (the only date formatter in the codebase).

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

1. Determine the R2 folder prefix for the feature (e.g. `expenses`, `certificates`).
2. Create `src/api/<feature>/<feature>Storage.ts` using `createEncryptedFileStorage` with the feature's folder.
3. Include file metadata (filename, IV, MIME) inside the parent record's encrypted `data` blob.
4. Ensure the folder is in the `allowedFolders` list in `src/app/api/storage/upload/route.ts`.
5. Update `docs/schema.md` with the folder structure.
6. No RLS policies needed — access control is enforced by the Next.js API routes via `getAuthenticatedUserId()`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
