# The Vault — Feature Plan

> **Status:** Complete
> **Replaces:** Analytics tile (dashboard placeholder)
> **Priority:** Highest sensitivity page in the app — extra caution required at every layer
> **Last updated:** 2026-07-23

---

## Overview

The Vault is a dedicated secure secrets manager embedded within the personal tracker.
It replaces the "Analytics (Coming soon)" tile on the dashboard and lives at `/vault`.
The entire page is gated behind a secondary 4-digit PIN, separate from the app login.

The Vault contains four sub-sections:

| Section | Purpose |
|---|---|
| **Personal Records** | Key-value store for personal, government, and employment IDs and reference numbers |
| **Password Manager** | Website login credentials (inspired by Kaspersky PM UI) |
| **Bank Manager** | Two-layer: banks → per-bank PINs (card, MPIN, transaction, internet banking) |
| **Document Vault** | File store for identity documents — linked to records or standalone |

All data inside the Vault is encrypted at rest using the existing app-level DEK (AES-GCM), exactly like every other feature. The PIN adds a **second factor for UI access** — it does not create a new encryption key.

---

## Theme

| Mode | Background | Text | Borders |
|---|---|---|---|
| Dark | `zinc-900` / `zinc-800` (gray) | `zinc-100` / `zinc-50` (white) | `zinc-700` / `zinc-600` |
| Light | `zinc-100` / `zinc-200` (gray) | `zinc-900` / `zinc-800` (black) | `zinc-400` / `zinc-300` |

No accent colors (unlike blue/green/amber used elsewhere). Vault uses **monochrome gray** to visually distinguish it as a high-security zone.

Dashboard tile: gray border, lock icon, no "Open feature" badge — replaced by a lock badge labeled "Secured".

---

## Lock Mechanism Design

### PIN Setup & Storage

- PIN is a 4-digit numeric code.
- On first vault access, user is prompted to **set a PIN**.
- PIN is hashed server-side using **Argon2id** (same library already in stack: `hash-wasm`).
- Hash is stored in a new Supabase column on `user_keys` table (adding columns, not a new table — same RLS pattern applies).
- PIN hash is **never stored in localStorage or sessionStorage**.
- PIN verification happens server-side via a Next.js Server Action — never client-side comparison.

> **Why server-side verification?** A 4-digit PIN has only 10,000 possible values. Client-side comparison is trivially brute-forced by reading the hash from the browser. Server-side + rate limiting is the only secure approach (per 2025 best practices research).

### Vault Session State

- Vault unlock state is held **only in React component state** (`useState` in VaultProvider context).
- It is **not persisted** to localStorage, sessionStorage, or cookies.
- While the user is on any `/vault/*` route — vault stays unlocked indefinitely (no timer).
- On manual lock (lock button) — vault locks immediately, regardless of route.

### 30-Second Navigation-Away Grace Period

This replaces the original "in-vault idle timer" design. The behavior is:

| Situation | Behaviour |
|---|---|
| User is on any `/vault/*` route | No timer — vault stays unlocked as long as needed |
| User navigates to a non-vault route | 30-second countdown begins |
| User returns to `/vault/*` within 30 seconds | Timer cancelled — vault remains unlocked, no PIN re-entry |
| 30 seconds elapses outside vault | Vault locks — PIN required on next `/vault/*` visit |
| User presses the lock button | Vault locks immediately regardless of route or timer state |

**Implementation approach:**
- The `VaultProvider` subscribes to Next.js router events (via `usePathname` from `next/navigation`).
- When `pathname` changes from a vault route (`/vault/*`) to a non-vault route, a 30-second `setTimeout` is started and stored in a `ref`.
- When `pathname` changes back to a vault route, the pending timeout is cleared — no lock occurs.
- The countdown is surfaced in a `useContext`-accessible value (`graceSecondsLeft`) so any component (e.g. a persistent navbar badge) can display it.
- No DOM event listeners needed (no mouse/keyboard polling).

> **Why client-side, not server-side?** The Supabase app session is long-lived. This is a UX-layer screen lock (analogous to a phone screen lock), not an auth session. The threat model is "user walked away from the browser after visiting another page." A 30-second server-side window would require constant polling — inappropriate for this use case.

### PIN Reset via Password

- User can click "Forgot PIN?" on the lock screen.
- A modal appears requesting the **login password**.
- Password is sent to a Server Action that re-authenticates with Supabase (calls `supabase.auth.signInWithPassword` to verify, does not issue a new session).
- If password is correct: a "Set New PIN" dialog appears (4-digit, confirmed twice).
- New PIN is hashed (Argon2id) and the column on `user_keys` is updated.

### Brute Force Protection

- User has **10 total attempts within a 10-minute window** before permanent lockout.
- `vault_failed_attempts` is incremented in the DB on every wrong PIN — server-side, persisted, shared across all devices.
- `vault_last_failed_at` records the timestamp of each wrong attempt.
- **On every PIN verification attempt (before checking the PIN):** if `now() - vault_last_failed_at > 10 minutes`, reset `vault_failed_attempts` to `0`. The window is sliding from the most recent failure.
- **Attempts 1–5 (within the window):** Silent failure — "Incorrect PIN" message only.
- **Attempts 6–9 (within the window):** Red warning label below the PIN pad: `"X attempts remaining before lockout"` (e.g. "4 attempts remaining").
- **Attempt 10 (within the window):** `vault_locked_out` flag set to `true` in DB. Vault permanently locked across all devices and sessions.
- **Only way to clear lockout:** Reset PIN via password ("Forgot PIN?" flow). Resets `vault_failed_attempts` to `0`, `vault_last_failed_at` to `null`, and `vault_locked_out` to `false`.
- Every **correct** PIN entry resets `vault_failed_attempts` to `0` and `vault_last_failed_at` to `null`.
- Lockout is per `user_id` — not per IP or device.

> **Sliding window example:** User enters 4 wrong PINs, then waits 11 minutes, then enters 6 more wrong PINs — no lockout triggers (counter reset after the gap). But 10 consecutive wrong PINs with under 10 minutes between each = permanent lockout. This prevents casual shoulder-surf brute-forcing while not punishing genuine forgotten-PIN situations after a break.

> **Why permanent and DB-persisted, not a timed lockout?** This is explicitly a cross-device lock. A 5-minute in-memory timer can be bypassed by reloading the page or spinning up a new Vercel instance. A DB-persisted `vault_locked_out` flag survives server restarts and enforces the lockout on every device the user is logged in to — consistent with the most sensitive page in the app.

---

## Page 1: Personal Records

> **Renamed from "Employment Info"** — the section holds far more than just employment data: government IDs (Aadhaar, PAN), pension/retirement numbers (PRAN, UAN, PF), travel documents (Passport), and any other reference number worth keeping. "Personal Records" covers all of this without implying a work-only scope.

### Data Model

Each entry is a named key-value pair, optionally grouped by category.

```typescript
interface PersonalRecord {
  id: string;
  key: string;       // "Aadhaar Number", "PRAN", "Personnel No", etc.
  value: string;     // encrypted
  category?: string; // optional grouping: "Work", "Government", "Financial", etc.
  notes?: string;    // encrypted, optional free-text annotation
  updated_at: string;
}
```

Pre-seeded field suggestions (not enforced, user can add anything):
- Personnel Number
- PRAN Number (Pension)
- Employee ID
- PF Account Number
- UAN (Universal Account Number)
- Aadhaar Number
- PAN Number
- Passport Number
- Voter ID
- Driving Licence Number
- Department / Designation

### UI — Main Views + Detail Modal (matches GlobalStoreView pattern)

**Tile View** (`/vault/records`):
- Tile grid (3 columns desktop, 2 tablet, 1 mobile) — each tile is one key-value entry.
- Tile shows: key name (visible), value masked as `••••••••`, category badge.
- `+ Add` button top-right.
- Search bar filters by key name or category.
- `ViewToggle` component (tile ↔ list view) — same control used in other store pages.

**Detail Modal** (click a record in tile or list view → opens GlobalActionModal):
- Shows key, full value (initially masked), category, notes.
- Eye icon reveals value — stays visible until user clicks **the same eye button again**, **another eye button**, or an **edit/delete button**. Does not hide on general page clicks or focus changes.
- Copy button copies value to clipboard.
- Edit and Delete buttons.
- **Linked Documents section** — shows files attached to this record (e.g., scanned PAN card, Aadhaar PDF). "+ Attach File" opens the document upload flow. Identical to how education records show attached certificates.

### File Linking

- Documents linked to a Personal Record use `domain = "vault"` and `linked_id = <record_id>`.
- Standalone vault documents (no parent record) use `domain = "vault"` and `linked_id = ""`.
- The Document Vault section shows **all** vault documents regardless of `linked_id`.

---

## Page 2: Password Manager

### Data Model

```typescript
interface PasswordEntry {
  id: string;
  site_name: string;       // "Gmail", "GitHub", etc.
  site_url?: string;       // optional — used for display only (no external favicon fetch)
  username: string;        // encrypted
  password: string;        // encrypted
  notes?: string;          // encrypted, optional
  category?: string;       // "Work", "Personal", "Finance", etc.
  updated_at: string;
}
```

### UI — Main Views + Detail Modal (matches GlobalStoreView pattern)

**Tile View** (`/vault/passwords`):
- Tile grid (3 columns desktop, 2 tablet, 1 mobile) — each tile is one credential entry.
- Tile shows: site name (bold), username (visible — usernames are not secrets), category badge.
- Generic globe/key Lucide icon (no external favicon fetch — strict CSP maintained).
- `+ Add` button, search bar, `ViewToggle` control.

**Detail Modal** (click a credential in tile or list view → opens GlobalActionModal):
- Shows site name, site URL (if set), username, password (masked `••••••••`).
- Eye icon reveals password — stays visible until user clicks the same eye icon again, another eye icon on the same page, or an edit/delete button.
- Copy buttons for username and password separately.
- Edit and Delete.
- **Linked Documents section** — attach files to this credential if needed (e.g., account recovery codes PDF).

---

## Page 3: Bank Manager

### Design: Two-Layer Navigation

- **Layer 1 — Bank List** (`/vault/banks`): tile grid of banks.
- **Layer 2 — Bank Detail** (`/vault/banks/[bankId]`): all PINs and credentials for a single bank.

This mirrors how MediaTracker uses movie/TV detail pages — a list view drilling down into a detail page.

### Data Model

```typescript
// Layer 1 — one row per bank
interface BankEntry {
  id: string;
  bank_name: string;        // "HDFC Bank", "SBI", "ICICI", etc.
  account_label?: string;   // "Savings", "Current", "Salary", etc.
  notes?: string;           // encrypted, any other info
  updated_at: string;
}

// Layer 2 — PIN/credential fields stored inside BankEntry's encrypted blob
// (these are nested fields within the same vault_entries row, not separate rows)
interface BankPins {
  card_pin?: string;                    // encrypted 4-digit debit/credit card PIN
  mpin?: string;                        // encrypted mobile banking app PIN
  transaction_pin?: string;             // encrypted UPI / transfer PIN
  internet_banking_password?: string;   // encrypted
  atm_pin?: string;                     // encrypted (if different from card_pin)
  custom_fields?: { label: string; value: string }[]; // encrypted, for anything else
}
```

> `BankEntry` and `BankPins` are merged into a single encrypted blob per `vault_entries` row. No separate rows for PINs.

### UI — Two-Layer Tile + Detail

**Layer 1 — Bank List** (`/vault/banks`):
- Tile grid — each tile is one bank.
- Tile shows: bank name (bold), account label badge (e.g. "Savings").
- `+ Add Bank` button, search bar, `ViewToggle` (tile ↔ list).

**Layer 2 — Bank Detail** (`/vault/banks/[bankId]`):
- Header: bank name + account label + breadcrumb back to bank list.
- PIN rows: Card PIN `••••`, MPIN `••••`, Transaction PIN `••••`, Internet Banking `••••••••`, etc.
- Each row: eye icon (toggle reveal — hides when another eye or edit/delete clicked), copy button.
- Custom fields section for any extra entries the user wants to add.
- Edit and Delete bank buttons.
- **Linked Documents section** — attach files (e.g., bank statement PDF, card image).
- `+ Attach File` button opens document upload flow.

### File Linking

- Documents linked to a BankEntry use `domain = "vault"` and `linked_id = <bankEntry_id>`.

---

## Page 4: Document Vault

### Design Principle

> **Hub for all vault files** — shows every file with `domain = "vault"`, regardless of whether it is linked to a record or standalone. Files can also be uploaded here as standalone documents (no parent record required).

### Data Model

Reuses the existing `documents` table with `domain = "vault"`.

```typescript
// Add "vault" to DocumentDomain in types/document.ts:
type DocumentDomain = "education" | "expense" | "medical" | "taskmanager" | "vault";

// linked_id = ""        → standalone document (uploaded directly to Document Vault)
// linked_id = <record_id> → linked to a PersonalRecord, PasswordEntry, or BankEntry
```

### UI (GlobalStoreView — full reuse)

- `GlobalStoreView` with `domain="vault"`, with `parentRecords` populated from all vault entry IDs+names.
- Shows both linked and standalone files in the tile grid.
- Linked files show the parent record name as a badge.
- Standalone files show no badge.
- `+ Upload` button creates a standalone document.
- Linking/unlinking works exactly as in Education Store.
- Files can be linked to any vault record (PersonalRecord, PasswordEntry, or BankEntry) — the `linked_id` just holds the `vault_entries.id`.

---

## Database Changes

### New columns on `user_keys`

```sql
ALTER TABLE public.user_keys
  ADD COLUMN vault_pin_hash        TEXT,
  ADD COLUMN vault_pin_salt        TEXT,
  ADD COLUMN vault_pin_set_at      TIMESTAMPTZ,
  ADD COLUMN vault_failed_attempts INT          NOT NULL DEFAULT 0,
  ADD COLUMN vault_last_failed_at  TIMESTAMPTZ,
  ADD COLUMN vault_locked_out      BOOL         NOT NULL DEFAULT FALSE;
```

> `vault_failed_attempts` counts consecutive wrong PINs within a 10-minute sliding window. `vault_last_failed_at` records when the last failure occurred — the Server Action checks this before each verification and resets the counter if >10 minutes have elapsed. `vault_locked_out` is set permanently at attempt 10 and only cleared by a successful PIN reset via password. All columns covered by existing RLS.

No new RLS needed — same `auth.uid() = user_id` FOR ALL policy covers new columns.

### New table: `vault_entries`

```sql
CREATE TABLE public.vault_entries (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    section     TEXT NOT NULL,   -- 'employment' | 'passwords' | 'banks'
    iv          TEXT NOT NULL,   -- Per-record AES-GCM IV (Base64)
    data        TEXT NOT NULL,   -- Base64 ciphertext (encrypted JSON blob)
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.vault_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own vault entries"
    ON public.vault_entries FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX vault_entries_user_section_idx
    ON public.vault_entries(user_id, section);
```

Document Vault files (both linked and standalone) stored under R2 key prefix: `vault/{userId}/{filename}.enc`

---

## API Layer (`src/api/vault/`)

```
src/api/vault/
├── vaultPin.ts        # Server Actions: verifyVaultPin, setVaultPin, resetPinWithPassword
├── vaultEntries.ts    # encrypted CRUD for vault_entries table (all 3 sections)
└── index.ts           # barrel export
```

### Key Server Actions (`vaultPin.ts`, `"use server"`)

- `checkVaultPinSet(userId)` → `boolean`
- `verifyVaultPin(userId, pin)` → `{ success: boolean; attemptsLeft?: number }`
- `setVaultPin(userId, pin)` → `void`
- `resetPinWithPassword(userId, password, newPin)` → `void`

---

## Component Architecture

```
src/components/vault/
├── VaultProvider.tsx
├── VaultLockScreen.tsx
├── VaultPinSetup.tsx
├── VaultPinReset.tsx
├── VaultHome.tsx                         # 2x2 section tile grid
├── VaultHeader.tsx                       # Header + lock button + grace countdown
├── records/                              # Personal Records (renamed from employment/)
│   ├── RecordsView.tsx                   # Tile grid of key-value entries + ViewToggle
│   ├── RecordModal.tsx                   # Create/edit record modal
│   └── RecordDetailModal.tsx             # Detail modal: value reveal, copy, linked docs
├── passwords/
│   ├── PasswordView.tsx                  # Tile grid of credential entries + ViewToggle
│   ├── PasswordModal.tsx                 # Create/edit credential modal
│   └── PasswordDetailModal.tsx           # Detail modal: reveal, copy, linked docs
├── banks/
│   ├── BankListView.tsx                  # Layer 1: tile grid of banks
│   ├── BankModal.tsx                     # Create/edit bank entry modal (Layer 1)
│   └── BankDetailView.tsx               # Layer 2: PIN rows + linked docs for one bank
└── documents/
    └── VaultDocumentsView.tsx            # GlobalStoreView with domain="vault", all vault files
```

## VaultProvider State Machine

```
LOADING → SETUP_REQUIRED | LOCKED | UNLOCKED
LOCKED → UNLOCKED (correct PIN)
UNLOCKED → LOCKED (manual lock button pressed)
UNLOCKED → GRACE (user navigates to non-vault route)
GRACE → UNLOCKED (user returns to /vault/* within 30s)
GRACE → LOCKED (30s elapses outside vault)
SETUP_REQUIRED → LOCKED (after first PIN set)
```

```typescript
type VaultState = 'loading' | 'setup_required' | 'locked' | 'unlocked' | 'grace';

interface VaultContext {
  state: VaultState;
  unlock: (pin: string) => Promise<boolean>;
  lock: () => void;                  // manual lock — always immediate
  graceSecondsLeft: number | null;   // null unless state === 'grace'
}
```

> Note: In `GRACE` state, the vault content is **not rendered** on non-vault pages (there's nothing to show anyway), but the session is preserved in-memory. If the user navigates back to `/vault/*` within 30 seconds, state transitions straight back to `UNLOCKED` without showing the lock screen.

---

## Page Routes

```
src/app/(protected)/vault/
├── page.tsx
├── layout.tsx                # Server Component + VaultClientLayout wrapping VaultProvider
├── records/
│   └── page.tsx              # Personal Records grid + detail modal
├── passwords/
│   └── page.tsx              # Password Manager grid + detail modal
├── banks/
│   ├── page.tsx              # Bank Manager Layer 1 (bank list)
│   └── [bankId]/
│       └── page.tsx          # Bank Manager Layer 2 (bank detail — PINs)
└── documents/
    └── page.tsx              # Document Vault (all vault files)
```

Routes to add to `paths.ts`:
```typescript
VAULT: '/vault',
VAULT_RECORDS: '/vault/records',
VAULT_PASSWORDS: '/vault/passwords',
VAULT_BANKS: '/vault/banks',
VAULT_BANK_DETAIL: (id: string) => `/vault/banks/${id}`,
VAULT_DOCUMENTS: '/vault/documents',
```

---

## Grace-Period Timer Implementation (simplified sketch)

```typescript
// VaultProvider — navigation-away grace period
const pathname = usePathname(); // next/navigation
const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const [graceSecondsLeft, setGraceSecondsLeft] = useState<number | null>(null);

const isVaultRoute = (p: string) => p.startsWith('/vault');

useEffect(() => {
  if (state !== 'unlocked' && state !== 'grace') return;

  if (isVaultRoute(pathname)) {
    // Returned to vault — cancel any pending grace timer
    if (graceTimerRef.current) {
      clearTimeout(graceTimerRef.current);
      graceTimerRef.current = null;
    }
    setGraceSecondsLeft(null);
    if (state === 'grace') setState('unlocked'); // resume without PIN
  } else {
    // Left vault — start grace period if not already running
    if (!graceTimerRef.current) {
      let remaining = 30;
      setGraceSecondsLeft(remaining);
      setState('grace');
      const countdown = setInterval(() => {
        remaining -= 1;
        setGraceSecondsLeft(remaining);
        if (remaining <= 0) clearInterval(countdown);
      }, 1_000);
      graceTimerRef.current = setTimeout(() => {
        clearInterval(countdown);
        setState('locked');
        graceTimerRef.current = null;
        setGraceSecondsLeft(null);
      }, 30_000);
    }
  }
}, [pathname, state]);
```

**Key points:**
- No DOM event listeners (mouse/keyboard) — only `pathname` changes are observed.
- Inside `/vault/*`: completely timer-free. User can work indefinitely.
- Outside `/vault/*`: countdown shown as a persistent badge/indicator (e.g. navbar or browser tab title) so user knows the grace window is active.
- `graceSecondsLeft` is exposed via context so any component can render the countdown.
- Manual `lock()` call clears the timer and immediately sets state to `locked`.

---

## Dashboard Tile Change

Replace Analytics `<div>` (lines 199–227, `dashboard/page.tsx`) with a `<Link href={ROUTES.VAULT}>`:

```tsx
<Link href={ROUTES.VAULT}
  className="rounded-xl border border-zinc-300 bg-white p-6 shadow-sm transition
             hover:border-zinc-400 hover:shadow-md
             dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600">
  {/* Lock icon */}
  <h3>The Vault</h3>
  <p>Secure store for credentials, PINs, and identity documents.</p>
  <span>🔒 PIN Protected</span>
</Link>
```

---

## Security Summary

| Concern | Mitigation |
|---|---|
| PIN brute force | 10 attempts within a 10-min sliding window; silent fail 1–5; red warning 6–9; permanent DB-persisted lockout at 10 (clears only via PIN reset with password) |
| Client-side PIN storage | PIN never stored client-side; unlock state is in-memory React state only |
| Data encryption | All vault entries encrypted with existing DEK (AES-GCM) |
| Favicon loading (CSP) | Default: no favicons (Option B). Strict CSP maintained. |
| Session leakage | VaultProvider resets on unmount — no persistence across nav |
| PIN reset | Uses Supabase `signInWithPassword` server-side to verify password |

---

## Packages Required

No new packages — all already in stack:
- `hash-wasm` — Argon2id PIN hashing
- `@supabase/ssr` — server-side auth for PIN reset
- `lucide-react` — Lock, Shield, Key, CreditCard, FileText, Eye, EyeOff, Copy icons

---

## Implementation Phases

### Phase V1 — Lock + Home
1. Add `vault_pin_*` columns to `user_keys` in Supabase (human action)
2. Create `src/api/vault/vaultPin.ts` Server Actions
3. Build `VaultProvider` (state machine + idle timer)
4. Build `VaultLockScreen` (numpad UI)
5. Build `VaultPinSetup` + `VaultPinReset`
6. Create vault layout + `/vault/page.tsx` + `VaultHome` (2×2 tiles)
7. Replace Analytics tile on dashboard

### Phase V2 — Employment Info
8. Create `vault_entries` table + RLS in Supabase (human action)
9. Create `src/api/vault/vaultEntries.ts`
10. Build `EmploymentView` + `EmploymentModal`
11. Add route `/vault/employment`

### Phase V3 — Password Manager
12. Build `PasswordView` + `PasswordModal` (card grid, focus-aware reveal toggle)
13. Add route `/vault/passwords`

### Phase V4 — Bank Manager
14. Build `BankView` + `BankModal`
15. Add route `/vault/banks`

### Phase V5 — Document Vault
16. Add `"vault"` to `DocumentDomain` union type
17. Build `VaultDocumentsView` (GlobalStoreView wrapper)
18. Add route `/vault/documents`

### Phase V6 — Polish & Docs
19. Update `context.md`, `schema.md`, `paths.ts`
20. Responsive testing (mobile + laptop)
21. Manual security testing (brute force lockout, idle timer, navigate-away re-lock)

---

## Open Questions

### ~~OQ-1: Brute Force Lockout Persistence~~ — RESOLVED

**Decision:** DB-persisted, permanent lockout (not time-based).

- Two columns track attempts: `vault_failed_attempts INT` (0–10) and `vault_last_failed_at TIMESTAMPTZ`.
- One column tracks lockout: `vault_locked_out BOOL`.
- Counter resets automatically if >10 minutes elapse since `vault_last_failed_at` (checked server-side on every verification attempt).
- Lockout at attempt 10 is **permanent** — no automatic expiry. Clears only on successful PIN reset via login password.
- Cross-device enforcement: `vault_locked_out = true` in DB blocks all devices simultaneously.

---

### ~~OQ-2: Personal Records — Edit UX~~ — RESOLVED

**Decision:** Tile/List main views + Detail Modal, matching the GlobalStoreView pattern used across the app.

- Clicking a record in tile or list view opens the `GlobalActionModal` showing the full entry, reveal button, copy, linked docs.
- A separate Create/Edit modal handles adding and editing entries.
- This is consistent with Education, Medical, and other store pages.

---

### ~~OQ-3: Password Manager — Favicons~~ — RESOLVED

**Decision:** No favicons. Generic globe/key Lucide icon for all credential tiles.
- CSP unchanged — no external `img-src` needed.
- `site_url` field still stored (display-only) so favicons can be added later by updating the CSP and swapping the icon component — no data model change required.

---

### ~~OQ-4: Password/PIN Reveal Duration~~ — RESOLVED

**Decision:** Option A (manual toggle) with scoped dismiss rules.

- Value/PIN stays **revealed until the user explicitly hides it** — no auto-timeout.
- Reveal is dismissed only by:
  1. Clicking the **same eye button** again (toggle off).
  2. Clicking **any other eye button** on the same page (only one field revealed at a time).
  3. Clicking an **edit or delete button** for any entry on the page.
- General page clicks, scrolling, or navigating focus do **not** hide the revealed value.
- This means only one value is ever visible at a time (opening a new eye closes the previous one).

---

### ~~OQ-5: Personal Records — Field Suggestions~~ — RESOLVED

**Decision:** Predefined suggestions + custom option, per original recommendation. The rename to "Personal Records" and addition of government/financial ID suggestions (Voter ID, Driving Licence) expand the predefined list slightly.

---


---

### ~~OQ-6: Bank Manager — One Entry Per Account or Per Bank~~ — RESOLVED

**Decision:** Two-layer approach — one `vault_entries` row per bank, with all PINs nested inside the encrypted blob.
- Layer 1 tile grid shows banks (HDFC, SBI, etc.).
- Layer 2 detail page shows all PINs and credentials for that specific bank.
- User can add custom PIN fields in addition to the predefined set (card, MPIN, T-PIN, IB password).
- This is more realistic than "one entry per account" and avoids duplication of bank name across multiple tiles.

---

### ~~OQ-7: Vault Layout — Server vs Client Component Pattern~~ — RESOLVED

**Decision:** `vault/layout.tsx` = Server Component (session validation + metadata) → renders `<VaultClientLayout>` Client Component → which wraps children with `<VaultProvider>`.

This is identical to the existing `(protected)/layout.tsx` → `CryptoProvider` pattern already in the codebase. No deviation from established convention.

---

## Common Component Reuse & Extensibility

Instead of building bespoke UI, the Vault strongly leverages existing common components and contributes new ones back to `src/components/common/` for future features to use.

### 1. GlobalActionModal for Detail Modals
All three detail modals (Personal Records, Password Manager, Bank Manager Layer 2) **MUST** use `src/components/common/GlobalActionModal.tsx` as their wrapper. This provides the entire layout for free:
- Left panel: form fields and masked values.
- Right panel: linked documents (handles preview, download, delete, unlink automatically).
- Footer: Save / Delete buttons.

### 2. Extracted SecretField Component
The masked value input (dots, eye toggle logic, copy button) is currently used extensively across all Vault pages (Records, Passwords, Banks).
- **Action:** Create `src/components/vault/SecretField.tsx`.
- It will encapsulate the `••••••••` masking, the exclusive reveal state, and the copy-to-clipboard function.
- We will keep it within the `vault` domain for now since no other domain uses it yet.

### 3. Shared Form Elements
All forms inside the Vault must use `InputField`, `SelectField`, and `TextareaField` from `src/components/common/FormField.tsx`. Do not write raw `<input>` or `<label>` tags.

### 4. DOMAIN_THEMES Update
Both `TileView.tsx` and `GlobalStoreView.tsx` hardcode domain theme colours (e.g., `expense: emerald`).
- **Action:** Add `vault` to the `DOMAIN_THEMES` object in both files.
- Theme colour for vault: `zinc` (monochrome/gray) to match the dark-mode aesthetic.

---

## Files to Change / Create

| File | Action | Reason |
|---|---|---|
| `docs/schema.md` | MODIFY | Add vault_pin columns + vault_entries table |
| `docs/context.md` | MODIFY | Add vault to structure + milestones |
| `src/routes/paths.ts` | MODIFY | Add VAULT_* constants |
| `src/types/vault.ts` | NEW | PersonalRecord, PasswordEntry, BankEntry, BankPins types |
| `src/types/document.ts` | MODIFY | Add "vault" to DocumentDomain |
| `src/components/common/TileView.tsx` | MODIFY | Add `vault` to `DOMAIN_THEMES` (zinc) |
| `src/components/common/store/GlobalStoreView.tsx` | MODIFY | Add `vault` to `DOMAIN_THEMES` (zinc) |
| `src/api/vault/vaultPin.ts` | NEW | Server Actions: verify/set/reset PIN |
| `src/api/vault/vaultEntries.ts` | NEW | Encrypted CRUD for vault_entries |
| `src/api/vault/index.ts` | NEW | Barrel export |
| `src/components/vault/VaultProvider.tsx` | NEW | Context + state machine + grace timer |
| `src/components/vault/VaultLockScreen.tsx` | NEW | Numpad PIN UI |
| `src/components/vault/VaultPinSetup.tsx` | NEW | First-time setup modal |
| `src/components/vault/VaultPinReset.tsx` | NEW | Forgot PIN flow |
| `src/components/vault/VaultHome.tsx` | NEW | 2x2 section tile grid |
| `src/components/vault/VaultHeader.tsx` | NEW | Header + lock button + grace countdown |
| `src/components/vault/SecretField.tsx` | NEW | Masked input component with reveal toggle |
| `src/components/vault/records/RecordsView.tsx` | NEW | Tile grid + ViewToggle |
| `src/components/vault/records/RecordModal.tsx` | NEW | Create/edit record modal |
| `src/components/vault/records/RecordDetailModal.tsx` | NEW | Detail modal + reveal + linked docs |
| `src/components/vault/passwords/PasswordView.tsx` | NEW | Tile grid + ViewToggle |
| `src/components/vault/passwords/PasswordModal.tsx` | NEW | Create/edit credential modal |
| `src/components/vault/passwords/PasswordDetailModal.tsx` | NEW | Detail modal + reveal + linked docs |
| `src/components/vault/banks/BankListView.tsx` | NEW | Layer 1: bank tile grid |
| `src/components/vault/banks/BankModal.tsx` | NEW | Create/edit bank modal |
| `src/components/vault/banks/BankDetailView.tsx` | NEW | Layer 2: PIN rows + linked docs |
| `src/components/vault/documents/VaultDocumentsView.tsx` | NEW | GlobalStoreView wrapper (linked+standalone) |
| `src/app/(protected)/vault/layout.tsx` | NEW | Server layout + VaultClientLayout |
| `src/app/(protected)/vault/page.tsx` | NEW | Vault home |
| `src/app/(protected)/vault/records/page.tsx` | NEW | Personal Records page |
| `src/app/(protected)/vault/passwords/page.tsx` | NEW | Password Manager page |
| `src/app/(protected)/vault/banks/page.tsx` | NEW | Bank Manager Layer 1 |
| `src/app/(protected)/vault/banks/[bankId]/page.tsx` | NEW | Bank Manager Layer 2 (dynamic route) |
| `src/app/(protected)/vault/documents/page.tsx` | NEW | Document Vault page |
| `src/app/(protected)/dashboard/page.tsx` | MODIFY | Replace Analytics tile with Vault tile |
| `next.config.ts` | NO CHANGE | Favicons deferred (OQ-3 resolved as no favicons). CSP unchanged. |

---

## Human Actions Required

> These actions CANNOT be automated. Perform them in the order listed.

### Action Index

| # | Action | When | Where | Blocking? |
|---|--------|------|-------|-----------|
| 1 | Add vault PIN columns to `user_keys` | Before using the app | Supabase Dashboard → SQL Editor | Yes |
| 2 | Create `vault_entries` table + RLS | Before using the app | Supabase Dashboard → SQL Editor | Yes |
| 3 | Manual security testing | After deployment | Local dev or production | No |

### Detailed Actions

#### HA-01 — Add vault PIN columns to `user_keys`

- **When**: Before first use of the Vault feature
- **Where**: Supabase Dashboard → SQL Editor
- **What**: Run the ALTER TABLE DDL to add PIN-related columns
- **How**:
  1. Open your Supabase project dashboard
  2. Go to SQL Editor
  3. Run the following SQL:
     ```sql
     ALTER TABLE public.user_keys
       ADD COLUMN vault_pin_hash        TEXT,
       ADD COLUMN vault_pin_salt        TEXT,
       ADD COLUMN vault_pin_set_at      TIMESTAMPTZ,
       ADD COLUMN vault_failed_attempts INT          NOT NULL DEFAULT 0,
       ADD COLUMN vault_last_failed_at  TIMESTAMPTZ,
       ADD COLUMN vault_locked_out      BOOL         NOT NULL DEFAULT FALSE;
     ```
  4. Verify columns appear in the Table Editor
- **Why this can't be automated**: Supabase does not expose a Terraform/Pulumi provider or API for DDL changes; SQL must be run manually in the dashboard.
- **Blocking**: Yes — the Vault PIN system will not function without these columns.

#### HA-02 — Create `vault_entries` table + RLS

- **When**: After HA-01, before using the Vault
- **Where**: Supabase Dashboard → SQL Editor
- **What**: Create the vault entries table with RLS policy
- **How**:
  1. In Supabase SQL Editor, run:
     ```sql
     CREATE TABLE public.vault_entries (
         id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
         section     TEXT NOT NULL,
         iv          TEXT NOT NULL,
         data        TEXT NOT NULL,
         created_at  TIMESTAMPTZ DEFAULT now(),
         updated_at  TIMESTAMPTZ DEFAULT now()
     );

     ALTER TABLE public.vault_entries ENABLE ROW LEVEL SECURITY;

     CREATE POLICY "Users manage their own vault entries"
         ON public.vault_entries FOR ALL
         USING (auth.uid() = user_id)
         WITH CHECK (auth.uid() = user_id);

     CREATE INDEX vault_entries_user_section_idx
         ON public.vault_entries(user_id, section);
     ```
  2. Verify the table appears with RLS enabled
- **Why this can't be automated**: Same as HA-01 — Supabase DDL requires manual SQL execution.
- **Blocking**: Yes — vault entries cannot be stored without this table.

#### HA-03 — Manual Security Testing

- **When**: After HA-01 and HA-02, after deploying
- **Where**: Local dev (`npm run dev`) or production
- **What**: Verify the PIN lockout and grace period mechanisms
- **How**:
  1. **PIN setup test**: Navigate to `/vault` → set a 4-digit PIN → verify lock screen appears
  2. **Brute force test**: Enter 5 wrong PINs (verify silent error) → enter 6th wrong PIN (verify red warning "4 attempts remaining") → enter 10th wrong PIN → verify permanent lockout screen
  3. **Lockout recovery**: Click "Forgot PIN?" → enter correct login password → set new PIN → verify vault unlocks with new PIN
  4. **Grace period test**: Unlock vault → navigate to `/dashboard` → observe grace countdown badge → return to `/vault` within 30s → verify still unlocked
  5. **Grace expiry test**: Unlock vault → navigate to `/dashboard` → wait 30s → return to `/vault` → verify lock screen appears
  6. **Manual lock test**: Unlock vault → click Lock button in vault header → verify immediate lock
  7. **Document upload test**: Upload a file to Document Vault → verify it appears in the tile grid
- **Why this can't be automated**: Security-sensitive flows involving PIN entry and navigation timing require human verification.
- **Blocking**: No — app is functional without this, but security guarantees are unverified.

---

## Out of Scope (Phase 1)

- Biometric unlock (WebAuthn / fingerprint)
- TOTP storage in Password Manager
- Secure free-form notes (5th section — future)
- PIN complexity > 4 digits
- Vault export / backup
- Multi-user vault sharing
- Offline mode
