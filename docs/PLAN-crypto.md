# Crypto KMS Implementation Plan

> From current state → working client-side encryption + change password flow.
> Each step marks **where** (which tool/file/platform) and **what** is done.

---

## Progress

| Phase | Status | Notes |
|-------|--------|--------|
| **Phase 1** — Supabase `user_keys` + RLS | **Done** (2026-04-11) | Table and policy applied in Dashboard SQL; see [`schema.md`](./schema.md). |
| **Phase 2** — Crypto Foundation Module | **Done** (2026-04-11) | `src/lib/crypto/` — primitives, store, manager, barrel. `hash-wasm` installed. |
| **Phase 3** — Supabase API for `user_keys` | **Done** (2026-04-11) | `src/api/auth/keys.ts` created, `manager.ts` refactored to import from auth barrel, exports updated. |
| **Phase 4** — Login Flow Integration | **Done** (2026-04-11) | `login()` calls `bootstrapCrypto` after auth; `LoginForm` surfaces crypto errors. |
| **Phase 5** — Session Persistence Check | **Done** (2026-04-11) | `CryptoProvider.tsx` created; wired into protected layout. |
| **Phase 6** — Logout Cleanup | **Done** (2026-04-11) | `logout()` clears DEK from IndexedDB before destroying session. |
| **Phase 7** — Encrypt/Decrypt Wrappers | **Done** (2026-04-12) | Verified with Task Manager feature (PLAN-taskmanager F1.2). `encryptField(userId, plaintext)` → `{ iv, ciphertext }`, `decryptField(userId, iv, ciphertext)` → plaintext. Maps to `iv`/`data` table columns. |
| **Phase 8** — Change Password Flow | **Done** (2026-04-11) | Route, page, form, API function, nav link all wired. |
| **Phase 9** — Security Headers | **Done** (2026-04-11) | CSP (incl. `wasm-unsafe-eval`), HSTS, X-Frame-Options, etc. in `next.config.ts`. No `dangerouslySetInnerHTML` found. |
| Phase 10 | Not started | Manual testing checklist (human). |

---

## Technology Audit (verified 2026-02-22)

| Technology | 2026 Status | Notes |
|---|---|---|
| Web Crypto API (`crypto.subtle`) | ✅ Active W3C Rec, 95.7% browser support | Used for AES-GCM encrypt/decrypt, key wrap/unwrap |
| AES-256-GCM | ✅ NIST revising SP 800-38D to strengthen, not deprecate | Standard authenticated symmetric encryption |
| IndexedDB | ✅ Not deprecated, still recommended by web.dev | CryptoKey persistence across page loads |
| Argon2id via `hash-wasm` 4.12.0 | ✅ OWASP preferred KDF (memory-hard) | ~11 KB WASM. Replaces PBKDF2 as top OWASP pick |
| @supabase/ssr 0.8.0 | ✅ Current package (Nov 2025) | Replacement for deprecated auth-helpers |
| Next.js 16 `proxy.ts` headers | ✅ Recommended approach for Next.js 16 | Already in the project |

**KDF decision:** Argon2id (via `hash-wasm`) over PBKDF2. PBKDF2 is not deprecated and is
still OWASP-acceptable at 600k iterations, but Argon2id is the current OWASP primary
recommendation for new systems. The cost is one ~11 KB WASM dependency. Everything else
(AES-GCM encrypt/decrypt, key wrapping) uses native Web Crypto API with zero dependencies.

---

## Prerequisites — Research (You, Human)

Before any coding, read up on these so the implementation decisions make sense:

- [ ] **Web Crypto API basics** — `crypto.subtle.deriveKey`, `crypto.subtle.encrypt`, `crypto.subtle.decrypt`. MDN docs: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto
- [ ] **Argon2id key derivation** — memory-hard KDF, OWASP preferred. npm: https://www.npmjs.com/package/hash-wasm (see argon2id function)
- [ ] **AES-GCM encryption** — authenticated symmetric encryption. MDN: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt#aes-gcm
- [ ] **IndexedDB CryptoKey storage** — storing non-exportable keys in the browser. Reference: https://github.com/nicolo-ribaudo/tc39-proposal-structs/issues/2 or the `idb` npm package docs
- [ ] **Envelope encryption concept** — Google's 2-minute explainer: https://cloud.google.com/kms/docs/envelope-encryption

Optional deeper reads:
- Bitwarden security whitepaper: https://bitwarden.com/help/bitwarden-security-white-paper/
- OWASP Password Storage Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html

---

## Phase 1 — Supabase Table Setup — **COMPLETE**

**Where:** Supabase Dashboard → SQL Editor  
**Who:** You (human)  
**Done:** 2026-04-11 — Canonical copy of DDL/RLS lives in [`schema.md`](./schema.md).

### Step 1.1 — Create `user_keys` table

Run this SQL in the Supabase SQL Editor:

```sql
CREATE TABLE public.user_keys (
    user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    salt       TEXT NOT NULL,
    iv         TEXT NOT NULL,
    wrapped_dek TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.user_keys IS
  'Stores per-user encrypted Data Encryption Keys. The wrapped_dek can only be decrypted client-side with the users password-derived KEK.';

ALTER TABLE public.user_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read/update their own key row"
    ON public.user_keys
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
```

### Step 1.2 — Verify

- [x] Table Editor → `user_keys` has columns: `user_id`, `salt`, `iv`, `wrapped_dek`, `created_at`, `updated_at`.
- [x] Authentication → Policies → RLS policy active on `user_keys`.

---

## Phase 2 — Crypto Foundation Module — **COMPLETE**

**Where:** Codebase — `src/lib/crypto/`
**Who:** Agent (coding)
**Done:** 2026-04-11

### Step 2.1 — `src/lib/crypto/primitives.ts` ✅

Low-level Web Crypto API wrappers. Pure functions, no side effects.

What this file provides:
- `deriveKEK(password, salt)` — Argon2id (via `hash-wasm`) → raw 256-bit key → imported as AES-GCM CryptoKey
- `generateDEK()` — random AES-256-GCM CryptoKey (extractable: true, so it can be wrapped)
- `wrapDEK(dek, kek)` — encrypt the DEK with the KEK → returns `{ iv, wrappedKey }` as Base64
- `unwrapDEK(wrappedKeyB64, ivB64, kek)` — decrypt → returns CryptoKey (extractable: false for storage)
- `encrypt(data, dek)` — AES-GCM encrypt arbitrary data → `{ iv, ciphertext }` as Base64
- `decrypt(ivB64, ciphertextB64, dek)` — AES-GCM decrypt → original data
- `generateSalt()` — 16 random bytes, Base64 encoded
- `generateIV()` — 12 random bytes, Base64 encoded

Argon2id parameters (OWASP minimum): 19 MiB memory, 2 iterations, 1 parallelism.
Benchmark on your slowest device; target 200–300ms derivation time.

Encoding convention: all binary ↔ Base64 for safe storage in Supabase TEXT columns.

Dependency: `hash-wasm` (^4.12.0) — only used in this file for `argon2id()`.
Everything else (AES-GCM, key import/export, random bytes) uses native Web Crypto.

### Step 2.2 — `src/lib/crypto/store.ts` ✅

IndexedDB wrapper for persisting the DEK across page loads.

What this file provides:
- `saveDEK(userId, dek)` — store a CryptoKey in IndexedDB, keyed by user ID
- `loadDEK(userId)` — retrieve the CryptoKey, or `null` if missing
- `clearDEK(userId)` — remove the key (used on logout)
- `hasDEK(userId)` — boolean check

Uses a single IndexedDB database `personal-tracker-keys` with one object store `dek-store`.

### Step 2.3 — `src/lib/crypto/manager.ts` ✅

High-level orchestrator. This is the only file the rest of the app imports.

What this file provides:
- `bootstrapCrypto(userId, password)` — called at login:
  1. Fetch `user_keys` row from Supabase (via the API layer, not direct)
  2. If row exists → derive KEK from password + salt → unwrap DEK → save to IndexedDB
  3. If no row (first login) → generate salt + DEK → derive KEK → wrap DEK → save row to Supabase → save DEK to IndexedDB
- `encryptField(userId, plaintext)` — load DEK from IndexedDB → encrypt → return `{ iv, ciphertext }`
- `decryptField(userId, iv, ciphertext)` — load DEK from IndexedDB → decrypt → return plaintext
- `encryptBlob(file: File)` — encrypt a File/Blob for storage bucket upload
- `decryptBlob(encryptedData, originalType)` — decrypt back to a Blob
- `rewrapDEK(userId, oldPassword, newPassword)` — for password change flow:
  1. Derive old KEK → unwrap DEK
  2. Generate new salt → derive new KEK → re-wrap DEK
  3. Update `user_keys` row in Supabase
- `isReady(userId)` — check if DEK is available in IndexedDB

### Step 2.4 — `src/lib/crypto/index.ts` ✅

Barrel export. Only exposes what the app needs:
- `bootstrapCrypto`, `encryptField`, `decryptField`, `encryptBlob`, `decryptBlob`, `rewrapDEK`, `isReady`

---

## Phase 3 — Supabase API for `user_keys` — **COMPLETE**

**Where:** Codebase — `src/api/`
**Who:** Agent (coding)
**Done:** 2026-04-11

### Step 3.1 — `src/api/auth/keys.ts` ✅

Service layer for the `user_keys` table (follows existing auth service conventions in `src/api/auth/auth.ts`).

What this file provides:
- `fetchUserKeys(userId)` — SELECT the row, return `{ salt, iv, wrapped_dek }` or `null`
- `upsertUserKeys(userId, salt, iv, wrappedDek)` — INSERT or UPDATE the row

### Step 3.2 — Update `src/api/index.ts` ✅

Barrel exports added for `fetchUserKeys`, `upsertUserKeys`, and `UserKeysRow` type.

---

## Phase 4 — Login Flow Integration — **COMPLETE**

**Where:** Codebase — `src/api/auth/auth.ts` + `src/components/auth/LoginForm.tsx`
**Who:** Agent (coding)
**Done:** 2026-04-11

### Step 4.1 — Modify `login()` in `src/api/auth/auth.ts` ✅

Current flow:
```
login(email, password) → supabase.auth.signInWithPassword()
```

New flow:
```
login(email, password)
  → supabase.auth.signInWithPassword()
  → if success: get userId from session
  → bootstrapCrypto(userId, password)
  → return result
```

The password is already passed into `login()` as a parameter. After Supabase confirms
the credentials are valid, we use that same password to bootstrap the crypto layer.
The password is never stored — it exists only as a function argument, then goes out of scope.

Important: Supabase auth happens FIRST. If the password is wrong, Supabase rejects it
and we never touch the crypto layer. This prevents oracle attacks on the wrapped DEK.

### Step 4.2 — Update `LoginForm.tsx` error handling ✅

Crypto errors are detected by prefix and shown with a browser-compatibility hint.

---

## Phase 5 — Session Persistence Check — **COMPLETE**

**Where:** Codebase — `src/app/(protected)/layout.tsx` + new React context
**Who:** Agent (coding)
**Done:** 2026-04-11

### Step 5.1 — Create `src/lib/crypto/CryptoProvider.tsx` ✅

A client-side React context that:
1. On mount, checks `isReady(userId)` (is DEK in IndexedDB?)
2. If ready → renders children normally
3. If not ready → redirects to `/login` (DEK missing = need password to re-derive)

This wraps the protected layout's children so every protected page
can assume the DEK is available.

### Step 5.2 — Wire into `src/app/(protected)/layout.tsx` ✅

`{children}` wrapped with `<CryptoProvider userId={user.id}>`. The `userId` comes from the server-side `supabase.auth.getUser()` call already in the layout.

---

## Phase 6 — Logout Cleanup — **COMPLETE**

**Where:** Codebase — `src/api/auth/auth.ts`
**Who:** Agent (coding)
**Done:** 2026-04-11

### Step 6.1 — Modify `logout()` in `src/api/auth/auth.ts` ✅

`logout()` now fetches `session.user.id` first, calls `clearDEK(userId)`, then `signOut()`.

---

## Phase 7 — Encrypt/Decrypt Wrappers for Data Layer — **COMPLETE**

**Where:** Codebase — `src/lib/crypto/manager.ts` (already implemented), `src/api/taskmanager/tasks.ts` + `src/api/taskmanager/notes.ts` (wired in Task Manager)
**Who:** Agent (coding)
**Done:** 2026-04-12 — Verified via Task Manager feature (PLAN-taskmanager F1.2).

The `encryptField` and `decryptField` functions in `manager.ts` were already fully implemented.
Phase 7 completion is the verification that they work with real feature tables.

**Actual signatures** (note: `userId` is required — plan pseudocode below omits it for brevity):
- `encryptField(userId, plaintext)` → `{ iv: string, ciphertext: string }`
- `decryptField(userId, iv, ciphertext)` → `string`

**Column mapping:** `encrypted.iv` → table `iv` column, `encrypted.ciphertext` → table `data` column.

Documenting the patterns used:

### Pattern for any data write:

```typescript
import { encryptField } from "@/lib/crypto";

async function createExpense(amount: number, description: string, date: string) {
  const encrypted = await encryptField(userId, JSON.stringify({ amount, description, date }));

  await supabase.from("expenses").insert({
    user_id: userId,
    iv: encrypted.iv,
    data: encrypted.ciphertext,
  });
}
```

### Pattern for any data read:

```typescript
import { decryptField } from "@/lib/crypto";

async function getExpenses(userId: string) {
  const { data } = await supabase.from("expenses").select("*").eq("user_id", userId);

  return Promise.all(
    data.map(async (row) => {
      const plaintext = await decryptField(userId, row.iv, row.data);
      return { id: row.id, ...JSON.parse(plaintext) };
    })
  );
}
```

### Pattern for file upload:

```typescript
import { encryptBlob } from "@/lib/crypto";

async function uploadReceipt(file: File) {
  const encrypted = await encryptBlob(file);

  await supabase.storage.from("receipts").upload(
    `${userId}/${file.name}.enc`,
    encrypted,
    { contentType: "application/octet-stream" }
  );
}
```

### Data table schema convention:

All encrypted tables follow the same shape:
```sql
CREATE TABLE public.expenses (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    iv         TEXT NOT NULL,       -- per-record AES-GCM IV
    data       TEXT NOT NULL,       -- Base64 ciphertext (JSON blob inside)
    created_at TIMESTAMPTZ DEFAULT now()
);
```

The `iv` + `data` columns hold the encrypted payload. No plaintext columns.

---

## Phase 8 — Change Password Flow — **COMPLETE**

**Where:** Codebase — new page + API function
**Who:** Agent (coding)
**Done:** 2026-04-11

### Step 8.1 — Add route `src/routes/paths.ts` ✅
### Step 8.2 — Create `src/app/(protected)/settings/change-password/page.tsx` ✅
### Step 8.3 — Create `src/components/auth/ChangePasswordForm.tsx` ✅
### Step 8.4 — Add API function `src/api/auth/auth.ts` ✅

`changePassword()` uses a two-step flow with compensation:
1. Re-wrap DEK from old password material to new password material.
2. Update Supabase auth password.
3. If auth update fails, perform best-effort rollback by re-wrapping DEK back to old password material, and surface an explicit error if rollback also fails.
### Step 8.5 — Add nav link in `src/components/layout/Navbar.tsx` ✅

---

## Phase 9 — Security Headers — **COMPLETE**

**Where:** Codebase — `next.config.ts`
**Who:** Agent (coding)
**Done:** 2026-04-11

### Step 9.1 — Add CSP and security headers ✅

All headers added via `next.config.ts` `headers()` on the `"/(.*)"` source pattern.

Note: `script-src` includes `'wasm-unsafe-eval'` (not in original plan) — required for
`hash-wasm` Argon2id WASM compilation. This is narrower than `'unsafe-eval'` and only
permits WebAssembly, not JS eval. Supported in Chrome 97+, Firefox 102+, Safari 16+.

### Step 9.2 — Verify no `dangerouslySetInnerHTML` usage ✅

Codebase scanned — zero occurrences found.

---

## Phase 10 — Testing Checklist

**Where:** Browser (manual testing)
**Who:** You (human) + Agent can help verify

### Happy paths:
- [ ] First login ever → new `user_keys` row created in Supabase, DEK in IndexedDB
- [ ] Close browser, reopen → persistent session works, DEK still in IndexedDB, no login needed
- [ ] Open in new browser/device → login required → DEK unwrapped from `user_keys` row
- [ ] Logout → DEK cleared from IndexedDB → cannot access protected pages
- [ ] Login again after logout → DEK re-unwrapped, everything works

### Change password:
- [ ] Change password with correct old password → `user_keys` row updated, data still accessible
- [ ] Change password with wrong old password → rejected, nothing changes
- [ ] Login on other device with new password → DEK unwrapped correctly

### Edge cases:
- [ ] Clear IndexedDB manually (DevTools) → next page load redirects to login → login restores DEK
- [ ] Open Supabase table editor → `wrapped_dek` visible but undecryptable, data columns show ciphertext only
- [ ] Inspect network tab → encrypted payloads in requests, no plaintext

### Argon2id benchmark:
- [ ] Time the `deriveKEK` call on your slowest device
- [ ] Target: 200–300ms. Adjust memory/iterations if too fast (<100ms) or too slow (>500ms)
- [ ] OWASP minimum: 19 MiB memory, 2 iterations, 1 parallelism — increase if device allows

---

## Execution Order Summary

| Order | Phase | Who | Where | Depends on |
|-------|-------|-----|-------|------------|
| 0 | Prerequisites reading | Human | Web browser | Nothing |
| 1 | Supabase table setup | Human | Supabase Dashboard | Nothing — **done** (see [`schema.md`](./schema.md)) |
| 2 | Crypto foundation | Agent | `src/lib/crypto/` | Phase 1 — **done** |
| 3 | API for `user_keys` | Agent | `src/api/auth/keys.ts` | Phase 2 — **done** |
| 4 | Login integration | Agent | `src/api/auth/auth.ts`, `LoginForm.tsx` | Phase 2 + 3 — **done** |
| 5 | Session persistence | Agent | `(protected)/layout.tsx`, context | Phase 2 — **done** |
| 6 | Logout cleanup | Agent | `src/api/auth/auth.ts` | Phase 2 — **done** |
| 7 | Encrypt/decrypt wrappers | Agent | `src/api/` | Phase 2 — **done** (Task Manager F1.2) |
| 8 | Change password | Agent | New page + `ChangePasswordForm` | Phase 2 + 3 + 4 — **done** |
| 9 | Security headers | Agent | `next.config.ts` | Nothing — **done** |
| 10 | Testing | Human | Browser | All above |

Phases 2–6 + 9 can be built in one coding session.
Phase 7 is wired in later when you build expense/task features.
Phase 8 can be built right after 6, or deferred.

---

## Files Changed / Created (Summary)

```
NEW FILES:
  src/lib/crypto/primitives.ts    — Web Crypto API wrappers
  src/lib/crypto/store.ts         — IndexedDB DEK persistence
  src/lib/crypto/manager.ts       — high-level orchestrator
  src/lib/crypto/CryptoProvider.tsx — React context for DEK readiness
  src/lib/crypto/index.ts         — barrel export
  src/api/auth/keys.ts            — user_keys table service layer
  src/app/(protected)/settings/change-password/page.tsx
  src/components/auth/ChangePasswordForm.tsx

MODIFIED FILES:
  src/api/auth/auth.ts            — add crypto bootstrap to login, cleanup to logout
  src/api/index.ts                — add new exports
  src/components/auth/LoginForm.tsx — handle crypto errors
  src/app/(protected)/layout.tsx  — wrap children with CryptoProvider
  src/components/layout/Navbar.tsx — add settings/change-password link
  src/routes/paths.ts             — add CHANGE_PASSWORD route
  next.config.ts                  — security headers (or proxy.ts)

SUPABASE (manual):
  New table: user_keys — Phase 1 done; canonical DDL/RLS in schema.md
```
