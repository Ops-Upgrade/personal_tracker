# Feature 2 — Expense Tracker (`/expense`)

> **Companion docs:** [`context.md`](./context.md), [`PLAN-crypto.md`](./PLAN-crypto.md), [`schema.md`](./schema.md).  
> Follows the same encrypted-blob pattern as Feature 1 (Task Manager). All sensitive fields live inside a single AES-GCM ciphertext blob per row. Supabase stores only opaque `iv` + `data` columns.

---

## Overview

A personal expense tracker at `/expense`. One data entity — **expense items** — stored in a single Supabase table. The UI is organised around a **calendar year**: the page shows all 12 months of the selected year as collapsible rows, each displaying a running total and supporting inline item previews or a full expanded modal.

The year is selected via a **year dropdown** (top-right). All months are always rendered; empty months show ₹ 0. Filtering by year and grouping by month happen entirely client-side after decryption.

### Year-end lifecycle (context only — not in scope)

Same as Task Manager: at year-end the user can export data, then optionally reset for the new year. The year dropdown makes prior-year data accessible without a hard reset.

---

## Wireframe Summary

### Main View — `/expense`

```
┌──────────────────────────────────────────────────────────────┐
│  /expense                                                    │
├──────────────────────────────────────────────────────────────┤
│  Name                                          [Navbar]      │
│                                                              │
│  ┌──────────────────────────────────────────┐               │
│  │                              [2025 ▾]    │               │
│  │                                          │               │
│  │  January    Total expense: ₹ 20000  [v Expand] [+ Add]  │
│  │  February   Total expense: ₹ 0      [v Expand] [+ Add]  │
│  │  March      Total expense: ₹ 0      [v Expand] [+ Add]  │
│  │  April      Total expense: ₹ 0      [v Expand] [+ Add]  │
│  │  May        Total expense: ₹ 0      [v Expand] [+ Add]  │
│  │  June       Total expense: ₹ 0      [v Expand] [+ Add]  │
│  │  ...                                                      │
│  └──────────────────────────────────────────┘               │
│  [Footer]                                                    │
└──────────────────────────────────────────────────────────────┘
```

- 12 month rows, always rendered.
- Each row shows: **month name**, **Total expense: ₹ X** (sum of all item costs in that month/year), **`v Expand`** button, **`+ Add`** button.
- `Total expense` is computed client-side from decrypted items filtered to that month and the selected year.
- `+ Add` opens the **Add Item modal** pre-set to that month.
- `v Expand` expands the month row inline (see below). While expanded, the button becomes `^ Retract`.

### Expanded Month Row — inline

```
┌──────────────────────────────────────────────────────────────┐
│  January     Total expense: ₹ 20000    [^ Retract] [+ Add]  │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Item   Seller   Cost   Date   Reason   Invoice          │ │
│  │  ...    ...      ...    ...    ...      ...             │ │
│  │  ...                                                    │ │
│  │                                         >> View All     │ │
│  └─────────────────────────────────────────────────────────┘ │
│  February    Total expense: ₹ 0        [v Expand] [+ Add]   │
│  ...                                                         │
└──────────────────────────────────────────────────────────────┘
```

- Inline expanded section shows a **preview table** with columns: Item, Seller, Cost, Date, Reason, Invoice.
- Preview is limited to the **5 most recent items** (sorted by `date` descending). If more exist, `>> View All` link appears at the bottom-right of the preview table.
- Clicking any row in the preview opens the **View/Edit Item modal**.
- `>> View All` navigates to `/expense#<month>-<year>` which opens the **Full Month Modal**.
- Multiple months can be expanded simultaneously.

### Add Item Modal

```
┌──────────────────────────────────────────────────────────────┐
│  /expense                                                    │
│  ┌────────────────────────────────────────────────┐          │
│  │  [Add Item modal — overlay]                    │          │
│  │                                                │          │
│  │  Item:      ____________________________       │          │
│  │  Seller:    ____________________________       │          │
│  │  Cost (₹):  ____________________________       │          │
│  │  Date:      [date picker]                      │          │
│  │  Reason:    ____________________________       │          │
│  │  Invoice:   [file upload / text ref]           │          │
│  │                                                │          │
│  │                      [Save] [Cancel]           │          │
│  └────────────────────────────────────────────────┘          │
└──────────────────────────────────────────────────────────────┘
```

- Opened via `+ Add` on any month row.  
- `date` field pre-populated to the 1st of the clicked month (user can change it).
- On Save: encrypts the item blob and inserts into Supabase.

### View / Edit Item Modal

```
┌──────────────────────────────────────────────────────────────┐
│  /expense                                                    │
│  ┌────────────────────────────────────────────────┐          │
│  │  [View/Edit Item modal — overlay]              │          │
│  │                                                │          │
│  │  Item:      ____________________________       │          │
│  │  Seller:    ____________________________       │          │
│  │  Cost (₹):  ____________________________       │          │
│  │  Date:      [date picker]                      │          │
│  │  Reason:    ____________________________       │          │
│  │  Invoice:   [file upload / text ref]           │          │
│  │                                                │          │
│  │              [Save] [Delete] [Cancel]          │          │
│  └────────────────────────────────────────────────┘          │
└──────────────────────────────────────────────────────────────┘
```

- Opened by clicking any expense row (in the preview or full modal).
- Fields pre-filled from decrypted data.
- **Save** re-encrypts with a new IV and updates the row.
- **Delete** opens a confirmation dialog before permanent removal.

### Full Month Modal — `/expense#<month>-<year>`

```
┌──────────────────────────────────────────────────────────────┐
│  /expense#january-2025                                       │
│  ┌────────────────────────────────────────────────┐          │
│  │  January 2025 — All Items                      │          │
│  │                                                │          │
│  │  Item   Seller   Cost   Date   Reason  Invoice │          │
│  │   ...    ...      ...    ...    ...     ...    │          │
│  │   ...                                          │          │
│  │   ...    ↕ scrollable                          │          │
│  │                                                │          │
│  │                              [Close / ✕]       │          │
│  └────────────────────────────────────────────────┘          │
└──────────────────────────────────────────────────────────────┘
```

- Opened via `>> View All` or by direct URL navigation to `/expense#<month>-<year>` (e.g. `/expense#january-2025`).
- Full list of all items for that month/year, sorted by `date` descending.
- Clicking a row opens the View/Edit Item modal on top.
- Closing removes the hash from the URL (`history.replaceState`).

---

## Data Model

### Supabase Table

#### `public.expenses`

| Column       | Type          | Nullable | Default             | Notes                                         |
|--------------|---------------|----------|---------------------|-----------------------------------------------|
| `id`         | `UUID`        | NO       | `gen_random_uuid()` | PK                                            |
| `user_id`    | `UUID`        | NO       | —                   | FK → `auth.users(id) ON DELETE CASCADE`        |
| `iv`         | `TEXT`        | NO       | —                   | Per-record AES-GCM IV (Base64)                 |
| `data`       | `TEXT`        | NO       | —                   | Base64 ciphertext (encrypted JSON blob)        |
| `created_at` | `TIMESTAMPTZ` | YES      | `now()`             | Row creation time — plaintext, not sensitive   |

**Encrypted JSON blob shape** (plaintext inside `data` after decryption):

```typescript
interface ExpensePlaintext {
  item: string;           // Name / description of the purchased item
  seller: string;         // Vendor / seller name
  cost: number;           // Amount in ₹ (stored as a number, e.g. 1999.50)
  date: string;           // ISO 8601 date (YYYY-MM-DD) — determines month/year grouping
  reason: string;         // Purpose / reason for the expense
  invoice: string;          // Legacy: free-text reference (may be empty when file is used)
  invoice_file: string;     // Filename in storage bucket (e.g. "<uuid>.enc"), empty if no file
  invoice_iv: string;       // Base64 IV used to encrypt the file, empty if no file
  invoice_mime: string;     // Original MIME type (e.g. "application/pdf"), empty if no file
  updated_at: string;     // ISO 8601 datetime, updated on every edit
}
```

> **Why `cost` is a number, not a string:** client-side totalling (`Total expense: ₹ X`) requires numeric addition. Storing it as a number in the encrypted blob avoids parse errors at render time.

> **Why `date` drives grouping:** The month a cost belongs to is determined by the `date` field inside the encrypted blob, not by `created_at`. A bill dated 2025-01-15 that is entered in February still appears under January.

### What each column actually does

**`id`** — unique identifier for each expense row. UUID generated by Postgres on insert. Used to target a specific row for updates and deletes (`WHERE id = ?`).

**`user_id`** — which user this row belongs to. Never encrypted because Supabase's RLS policy needs to read it to enforce `auth.uid() = user_id`. This is what prevents user A from ever fetching user B's rows — the DB rejects the query at the policy level before any data is returned.

**`iv`** — the random initialization vector used during AES-GCM encryption of this specific row. Every row gets its own unique IV. This is a hard security requirement: if two rows shared the same IV and the same key, an attacker could XOR the two ciphertexts and begin recovering plaintext. So every insert and every update generates a fresh IV — which is why the update path always re-encrypts the full blob with a new IV rather than patching individual fields.

**`data`** — the encrypted JSON blob. This is where all the actual expense data lives (item, seller, cost, date, reason, invoice, updated_at). Supabase sees only an opaque Base64 string and has no way to read, filter, or aggregate any of it. Only the user's browser with the DEK can decrypt it.

**`created_at`** — the only plaintext column that reveals anything about the row. It tells you when the row was inserted but nothing about what's in it. Acceptable because timestamps are low-sensitivity metadata. Note: `created_at` is NOT used for month grouping — that's driven by the `date` field inside the blob.

### Why everything sensitive is in the blob

The threat model is: if someone gains access to the Supabase database (breach, rogue admin, Supabase staff), they see nothing useful — just random encrypted bytes per row. No item names, no costs, no dates, no sellers. Only the user's browser, holding the DEK derived from their password, can decrypt.

The trade-off is that all filtering, sorting, and aggregation must happen client-side after decryption. For a personal tracker with a year-reset lifecycle (a few hundred rows per user per year), this is fast and imperceptible. The bottleneck is never the number of users — Supabase trivially serves rows to 20 or 2,000 users simultaneously. The only thing that matters is how many rows a single user has accumulated, because that determines the size of the decrypt loop running in their browser.

### DDL (run in Supabase SQL Editor)

```sql
CREATE TABLE public.expenses (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    iv         TEXT NOT NULL,
    data       TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own expenses"
    ON public.expenses
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
```

---

## Encryption Integration

Follows the identical AES-GCM pattern established in Phase 7 / Feature 1.

### Write path (create)

```typescript
import { encryptField } from "@/lib/crypto";

const plaintext: ExpensePlaintext = {
  item, seller, cost, date, reason, invoice,
  updated_at: new Date().toISOString(),
};
const encrypted = await encryptField(userId, JSON.stringify(plaintext));

await supabase.from("expenses").insert({
  user_id: userId,
  iv: encrypted.iv,
  data: encrypted.ciphertext,
});
```

### Read path (list all, then group client-side)

```typescript
import { decryptField } from "@/lib/crypto";

const { data: rows } = await supabase
  .from("expenses")
  .select("*")
  .eq("user_id", userId);

const expenses = await Promise.all(
  rows.map(async (row) => {
    const plaintext = await decryptField(userId, row.iv, row.data);
    return { id: row.id, created_at: row.created_at, ...JSON.parse(plaintext) };
  })
);

// Group by year + month client-side:
// expenses.filter(e => e.date.startsWith("2025-01")) → January 2025
```

### Update path (edit item)

```typescript
const updated: ExpensePlaintext = { ...existing, item: newItem, updated_at: new Date().toISOString() };
const encrypted = await encryptField(userId, JSON.stringify(updated));

await supabase.from("expenses").update({ iv: encrypted.iv, data: encrypted.ciphertext }).eq("id", expenseId);
```

---

## UI Behaviour Details

### Main `/expense` Page

- On load: fetch all expense rows for the user → decrypt all → store in client state.
- **Year dropdown** (top-right): defaults to current calendar year. Options are all years that appear in the decrypted `date` fields, plus the current year. Changing the year re-filters client-side (no new network request).
- **Month rows** (Jan–Dec, always 12): each shows:
  - Month name (left).
  - `Total expense: ₹ X` — sum of `cost` for all decrypted items where `date` falls in that month + selected year. Shows ₹ 0 if none.
  - `v Expand` / `^ Retract` toggle button.
  - `+ Add` button (opens Add Item modal, pre-sets `date` to 1st of that month).
- Multiple months may be expanded simultaneously.

### Inline Expanded Month

- Renders a table directly below the month header row (no separate page).
- **Preview**: up to 5 items, sorted by `date` descending.
- Columns: Item, Seller, Cost, Date, Reason, Invoice.
- If the month has more than 5 items, `>> View All` link appears bottom-right → navigates to `/expense#<month>-<year>`.
- Clicking any table row → View/Edit Item modal.

### Add Item Modal

- Single modal component, opened via any month's `+ Add`.
- Fields: Item (text), Seller (text), Cost ₹ (number input), Date (date picker, pre-set to 1st of that month), Reason (text), Invoice (file upload drop zone).
- **Save**: encrypt + insert → update client state → close modal → recalculate totals.
- **Cancel**: close with no changes.

### View / Edit Item Modal

- Same component as Add Item, but pre-filled.
- **Save**: re-encrypt with new IV + update row → update client state → recalculate totals → close.
- **Delete**: confirmation dialog ("Are you sure? This cannot be undone.") → hard-delete from Supabase → update client state → close.
- **Cancel**: close with no changes.

### Full Month Modal (`/expense#<month>-<year>`)

- URL format: `/expense#january-2025`, `/expense#march-2026`, etc.
- On page load, reads `window.location.hash`; if valid month-year hash found, opens the modal automatically.
- Closing removes the hash via `history.replaceState`.
- Full scrollable list of all items for that month, sorted by `date` descending.
- Clicking any row opens the View/Edit Item modal on top of the full-month modal.

### Confirmation Dialog

- Reuse the `ConfirmDialog` component from the Task Manager (`src/components/taskmanager/ConfirmDialog.tsx`).

### Empty States

- Month with no items: `Total expense: ₹ 0`. Expanded preview shows: "No expenses recorded."
- Full month modal with no items: "No expenses recorded."

### Year Dropdown

- Lists all years present in decrypted data + current year. Sorted descending (newest first).
- Changing year re-renders all 12 month rows and recalculates totals client-side.

---

## Hash-Based Navigation

| Hash | Opens |
|------|-------|
| `/expense` (no hash) | Main month-list view |
| `/expense#january-2025` | Full month modal for January 2025 |
| `/expense#march-2026` | Full month modal for March 2026 |

Month names in the hash are lowercase full English names (`january`, `february`, … `december`).

---

## Resolved Design Decisions

| # | Question | Answer |
|---|----------|--------|
| 1 | `invoice` field type | Free-text string for legacy (URL, receipt code, or note). Now uses `invoice_file` for storage file upload. |
| 2 | `cost` storage format | Number (float) inside the encrypted blob. Enables client-side summing. |
| 3 | Month grouping key | `date` field inside the blob (not `created_at`). A January bill entered in February appears in January. |
| 4 | Multiple months expanded | Yes — each month independently expandable. No accordion (only one open) behaviour. |
| 5 | Preview row limit | 5 most recent items (by `date` desc). `>> View All` shown if more exist. |
| 6 | Year options | Derived from all distinct years in decrypted `date` fields, plus current year. No manual entry. |
| 7 | Delete confirmation | Yes — confirmation dialog required before permanent delete. |
| 8 | Empty month display | Always render all 12 months. Empty months show ₹ 0 and "No expenses recorded" when expanded. |
| 9 | Currency | Indian Rupee (₹). Cost stored as a plain number; ₹ symbol is display-only. |
| 10 | Add item date pre-fill | Pre-set to 1st of the clicked month. User can change. |

---

## Proposed File Structure

```
src/
├── api/
│   ├── expense/
│   │   ├── expenses.ts          # CRUD for expenses table (encrypt/decrypt wired in)
│   │   └── index.ts             # Sub-barrel re-export
│   └── index.ts                 # Top-level barrel (add expense re-export here)
├── app/(protected)/
│   └── expense/
│       └── page.tsx             # Main expense page (server component shell)
├── components/expense/
│   ├── ExpenseView.tsx          # Client component — orchestrates month list + hash modal
│   ├── MonthRow.tsx             # Single month row: header + inline expand/retract
│   ├── ExpenseTable.tsx         # Reusable table (used in preview + full modal)
│   ├── ExpenseModal.tsx         # Shared create/edit modal for a single expense item
│   ├── FullMonthModal.tsx       # Hash-modal — all items for a given month/year
│   └── YearDropdown.tsx         # Year selector component
├── types/
│   └── expense.ts               # ExpensePlaintext, Expense, MONTHS const
└── routes/
    └── paths.ts                 # Add EXPENSE route
```

---

## Implementation Phases

| Phase | What | Depends on | Status |
|-------|------|------------|--------|
| **F2.1** | Supabase: create `expenses` table + RLS (human, SQL Editor) | Nothing | Pending |
| **F2.2** | Types + API layer: `src/types/expense.ts`, `src/api/expense/expenses.ts` (fetchExpenses, createExpense, updateExpense, deleteExpense) | F2.1 | Pending |
| **F2.3** | Route + page shell: `/expense` route, `page.tsx`, `ExpenseView.tsx` skeleton with year dropdown and 12 static month rows | F2.2 | Pending |
| **F2.4** | Month rows: total calculation, `v Expand` / `^ Retract` toggle, inline `ExpenseTable` preview (5 rows, `>> View All` link) | F2.3 | Pending |
| **F2.5** | Add Item modal: `ExpenseModal` in create mode — all fields, date pre-fill, encrypt + insert on Save | F2.4 | Pending |
| **F2.6** | View / Edit Item modal: `ExpenseModal` in edit mode — pre-fill, re-encrypt on Save, delete with `ConfirmDialog` | F2.5 | Pending |
| **F2.7** | Full Month modal: `FullMonthModal` component, hash-based navigation (`/expense#month-year`), full scrollable list | F2.4 | Pending |
| **F2.8** | Year dropdown: derive year list from decrypted data + current year, client-side re-filter on change | F2.3 | Pending |
| **F2.9** | Entry integration: activate dashboard Expense tile as primary route entry | F2.3 | Pending |
| **F2.10** | Polish: empty states, loading states, error handling, ₹ formatting (e.g. `toLocaleString('en-IN')`), responsive layout | F2.4–F2.7 | Pending |
| **F2.11** | Invoice Storage: encrypted file upload to Supabase bucket, inline preview, delete integration | F2.5-F2.6 | Pending |

---

## Revision Log

| Date       | Change |
|------------|--------|
| 2026-06-22 | Initial draft — derived from Figma wireframes (5 screens: main, expanded month, add item modal, view single item modal, view all items in month modal). Aligned to Feature 1 (Task Manager) doc conventions and encrypted-blob architecture. |


# Encrypted Invoice File Storage for Expense Tracker

Add file upload/download/delete for invoice attachments on each expense entry. Files are **client-side encrypted** with the user's existing DEK before upload to Supabase Storage, so even a data admin with bucket access sees only opaque ciphertext.

## Current State Summary

### Database Tables & RLS

| Table | Schema | RLS Policy | Purpose |
|-------|--------|-----------|---------|
| `public.user_keys` | `user_id` (PK), `salt`, `iv`, `wrapped_dek`, `created_at`, `updated_at` | `auth.uid() = user_id` (ALL) | Per-user wrapped DEK |
| `public.tasks` | `id` (PK), `user_id`, `iv`, `data`, `created_at` | `auth.uid() = user_id` (ALL) | Encrypted task blobs |
| `public.notes` | `id` (PK), `user_id`, `iv`, `data`, `created_at` | `auth.uid() = user_id` (ALL) | Encrypted note blobs |
| `public.expenses` | `id` (PK), `user_id`, `iv`, `data`, `created_at` | `auth.uid() = user_id` (ALL) | Encrypted expense blobs |

### Existing Crypto Infrastructure

- `encryptBlob(userId, file)` and `decryptBlob(userId, encryptedData, iv, mimeType)` already exist in [primitives.ts](file:///d:/Projects/Ops-Upgrade/personal_tracker/src/lib/crypto/primitives.ts#L197-L231) and are exported from [manager.ts](file:///d:/Projects/Ops-Upgrade/personal_tracker/src/lib/crypto/manager.ts#L71-L90) and [index.ts](file:///d:/Projects/Ops-Upgrade/personal_tracker/src/lib/crypto/index.ts).
- The encrypted blob pattern uses the same AES-GCM DEK as text field encryption.
- These functions are **already built and exported but never used** — this feature will be their first consumer.

---

## User Review Required

> [!IMPORTANT]
> **Supabase Dashboard action required.** You must create the storage bucket and its RLS policies manually in the Supabase Dashboard SQL Editor. The DDL is provided below in the Proposed Changes section.

> [!IMPORTANT]
> **The `invoice` field changes meaning.** Currently `invoice` in the encrypted blob is a free-text string (receipt code, URL, note). This plan repurposes it to hold the **storage file reference** (the filename in the bucket) when a file is attached. When no file is attached, it remains an empty string. The old free-text use case is effectively replaced by the file upload.

> [!WARNING]
> **File size limit.** Web Crypto API requires the entire file in memory for AES-GCM encryption. We will enforce a **10 MB** client-side limit per invoice file. This is sufficient for scanned receipts, photos, and PDF invoices.

---

## Open Questions

> [!IMPORTANT]
> **Q1: Accepted file types.** The plan currently allows PDF, JPEG, PNG, and WEBP for invoice files. Should we support additional types (e.g., HEIC for iPhone photos, DOC/XLSX)?

> [!IMPORTANT]
> **Q2: Invoice text field removal.** Currently `invoice` is a free-text field in the modal. With file upload replacing it, should we keep a separate "Invoice notes" text field alongside the file upload, or is the file attachment sufficient?

---

## Architecture: How Encryption, Storage & Decryption Work

### The Problem
Supabase Storage encrypts files at rest (AES-256, managed by the platform), but Supabase engineers / data admins can still read file contents. Our threat model requires **zero-knowledge** — even someone with full DB + bucket access sees only encrypted bytes.

### The Solution: Client-Side Encryption (CSE) with Existing DEK

```
┌─────────────────────────────────────────────────────────────┐
│                       UPLOAD FLOW                           │
│                                                             │
│  Browser                                                    │
│  ┌─────────┐    ┌──────────┐    ┌───────────────────────┐  │
│  │ File    │───>│ AES-GCM  │───>│ Encrypted ArrayBuffer │  │
│  │ (plain) │    │ encrypt  │    │ + IV (Base64 string)  │  │
│  └─────────┘    │ via DEK  │    └──────────┬────────────┘  │
│                 └──────────┘               │               │
│                                            ▼               │
│                              Supabase Storage               │
│                    expenses/invoice/<uuid>.enc              │
│                                                             │
│  Expense Row (encrypted blob):                              │
│  { ...fields, invoice_file: "<uuid>.enc",                  │
│    invoice_iv: "<base64-iv>",                               │
│    invoice_mime: "application/pdf" }                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      DOWNLOAD FLOW                          │
│                                                             │
│  Supabase Storage                                           │
│  expenses/invoice/<uuid>.enc                                │
│        │                                                    │
│        ▼                                                    │
│  ┌───────────────────────┐    ┌──────────┐    ┌──────────┐ │
│  │ Encrypted ArrayBuffer │───>│ AES-GCM  │───>│ Blob     │ │
│  │ (downloaded)          │    │ decrypt  │    │ (plain)  │ │
│  └───────────────────────┘    │ via DEK  │    └────┬─────┘ │
│                               │ + stored │         │       │
│                               │   IV     │    URL.createObj│
│                               └──────────┘    ObjectURL()  │
│                                                    │       │
│                                               Open / DL    │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Encryption algorithm | AES-256-GCM (same as data blobs) | Reuse existing DEK; no new key management |
| IV storage | Inside the encrypted expense blob (`invoice_iv` field) | IV itself is not sensitive; storing it inside the blob means the admin can't even see the IV |
| File path in bucket | `expenses/invoice/<uuid>.enc` | `table_name/col_name/value` convention per requirement |
| File reference in DB | `invoice_file` field in encrypted blob | Filename stored alongside IV and MIME type |
| Content-Type on upload | `application/octet-stream` | File is encrypted; original MIME is meaningless to the server |
| Download method | SDK `download()` (not signed URL) | Respects RLS via JWT; signed URLs would expose encrypted bytes — acceptable since they're useless, but `download()` is simpler and more secure |
| Viewer approach | In-app preview (PDF iframe / image tag via `blob:` URL) + download button | No external redirect needed; `blob:` URLs are already permitted by CSP (`img-src 'self' blob:`) |
| File name format | `<random-uuid>.enc` | UUID avoids path collisions; `.enc` makes intent clear |
| Max file size | 10 MB | Web Crypto API keeps entire file in memory |

---

## Proposed Changes

### Supabase Dashboard (Human Action — SQL Editor)

#### [NEW] Storage Bucket + RLS Policies

```sql
-- 1. Create private storage bucket (NOT public — RLS enforced)
INSERT INTO storage.buckets (id, name, public)
VALUES ('expenses', 'expenses', false);

-- 2. RLS: Authenticated users can upload to their own folder
--    Path convention: expenses/invoice/<filename>
--    We use owner_id (auto-set by Supabase on INSERT) for access control
CREATE POLICY "Users upload their own invoices"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'expenses'
    AND auth.uid() IS NOT NULL
);

-- 3. RLS: Users can only read/download files they own
CREATE POLICY "Users read their own invoices"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'expenses'
    AND owner_id = auth.uid()
);

-- 4. RLS: Users can only delete files they own
CREATE POLICY "Users delete their own invoices"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'expenses'
    AND owner_id = auth.uid()
);

-- 5. RLS: Users can update (overwrite) files they own
CREATE POLICY "Users update their own invoices"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'expenses'
    AND owner_id = auth.uid()
);
```

> [!NOTE]
> Supabase auto-sets `owner_id` to `auth.uid()` on INSERT into `storage.objects`. We rely on this for SELECT/DELETE/UPDATE policies. The `owner_id` approach is simpler and more secure than path-based checks.

---

### Types Layer

#### [MODIFY] [expense.ts](file:///d:/Projects/Ops-Upgrade/personal_tracker/src/types/expense.ts)

Add invoice file metadata fields to the encrypted blob interface:

```diff
 export interface ExpensePlaintext {
   item: string;
   seller: string;
   cost: number;
   date: string;
   reason: string;
-  invoice: string;
+  invoice: string;          // Legacy: free-text ref (kept for backward compat, may be empty)
+  invoice_file: string;     // Filename in storage bucket (e.g. "<uuid>.enc"), empty if no file
+  invoice_iv: string;       // Base64 IV used to encrypt the file, empty if no file
+  invoice_mime: string;     // Original MIME type (e.g. "application/pdf"), empty if no file
   updated_at: string;
 }
```

---

### API Layer

#### [NEW] [invoiceStorage.ts](file:///d:/Projects/Ops-Upgrade/personal_tracker/src/api/expense/invoiceStorage.ts)

New module for Supabase Storage operations (upload, download, delete) with client-side encryption/decryption:

```typescript
// Storage path convention: expenses/invoice/<filename>
const BUCKET = "expenses";
const FOLDER = "invoice";     // = col_name

export async function uploadInvoice(
    userId: string, file: File
): Promise<{ fileName: string; iv: string; mimeType: string }>

export async function downloadInvoice(
    userId: string, fileName: string, iv: string, mimeType: string
): Promise<Blob>

export async function deleteInvoice(fileName: string): Promise<void>
```

**Upload flow:**
1. Validate file size (≤ 10 MB) and type (PDF, JPEG, PNG, WEBP).
2. Generate a UUID filename: `<uuid>.enc`.
3. Call `encryptBlob(userId, file)` → get `{ iv, encryptedData }`.
4. Upload `encryptedData` to `expenses/invoice/<uuid>.enc` with `contentType: 'application/octet-stream'`.
5. Return `{ fileName, iv, mimeType: file.type }`.

**Download flow:**
1. Call `supabase.storage.from('expenses').download('invoice/<fileName>')`.
2. Convert the returned `Blob` to `ArrayBuffer`.
3. Call `decryptBlob(userId, arrayBuffer, iv, mimeType)` → get plaintext `Blob`.
4. Return the decrypted `Blob`.

**Delete flow:**
1. Call `supabase.storage.from('expenses').remove(['invoice/<fileName>'])`.

#### [MODIFY] [expenses.ts](file:///d:/Projects/Ops-Upgrade/personal_tracker/src/api/expense/expenses.ts)

- `createExpense` and `updateExpense`: accept the new `invoice_file`, `invoice_iv`, `invoice_mime` fields (they're just part of `ExpensePlaintext`, already encrypted in the blob).
- `deleteExpense`: add an optional parameter to also delete the associated storage file if `invoice_file` is non-empty.

#### [MODIFY] [index.ts](file:///d:/Projects/Ops-Upgrade/personal_tracker/src/api/expense/index.ts)

Re-export `uploadInvoice`, `downloadInvoice`, `deleteInvoice`.

---

### UI Components

#### [MODIFY] [ExpenseModal.tsx](file:///d:/Projects/Ops-Upgrade/personal_tracker/src/components/expense/ExpenseModal.tsx)

Major changes to the modal:

1. **Replace the `invoice` text input** with a file upload zone:
   - `<input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp">` styled as a drop zone.
   - Shows the selected file name + size, with a ✕ remove button.
   - In edit mode, if a file already exists, shows "📎 invoice.pdf" with View / Download / Remove buttons.

2. **New state variables:**
   - `invoiceFile: File | null` — the selected file (for new uploads).
   - `existingInvoiceFile: string` — filename from the existing expense (for edits).
   - `isUploading: boolean` — upload progress state.
   - `invoiceAction: 'keep' | 'replace' | 'remove'` — tracks what to do with the file on save.

3. **Save handler changes:**
   - If `invoiceAction === 'replace'`: upload new file → get `{ fileName, iv, mimeType }` → include in draft.
   - If `invoiceAction === 'remove'`: delete old file from storage → clear fields in draft.
   - If `invoiceAction === 'keep'`: preserve existing `invoice_file`, `invoice_iv`, `invoice_mime` values.
   - Old file is deleted from storage when replaced or removed.

4. **View/Download inline:**
   - "View" button: calls `downloadInvoice()`, creates `blob:` URL, opens in-app preview (PDF in `<iframe>`, images in `<img>`).
   - "Download" button: calls `downloadInvoice()`, creates `blob:` URL, triggers download via hidden `<a>` element with `download` attribute.

5. **onSave signature update:**
   ```typescript
   onSave: (
     draft: {
       item: string; seller: string; cost: number; date: string; reason: string;
       invoice: string; invoice_file: string; invoice_iv: string; invoice_mime: string;
     },
     existingExpense: Expense | null,
     fileAction: { action: 'upload' | 'remove' | 'keep'; file?: File }
   ) => Promise<void>;
   ```

#### [MODIFY] [ExpenseTable.tsx](file:///d:/Projects/Ops-Upgrade/personal_tracker/src/components/expense/ExpenseTable.tsx)

- Invoice column: show 📎 icon when `invoice_file` is non-empty (clickable to trigger view), show "—" when empty.

#### [MODIFY] [ExpenseView.tsx](file:///d:/Projects/Ops-Upgrade/personal_tracker/src/components/expense/ExpenseView.tsx)

- Update `handleExpenseSave` to orchestrate file upload/delete alongside expense row save.
- Update `handleExpenseDelete` to also delete the associated storage file.

---

### Configuration

#### [MODIFY] [next.config.ts](file:///d:/Projects/Ops-Upgrade/personal_tracker/next.config.ts)

No changes needed. CSP already allows:
- `img-src 'self' blob: data:` — covers `blob:` URLs for decrypted image previews.
- `connect-src 'self' https://*.supabase.co` — covers Supabase Storage API calls.

For PDF preview via `<iframe>`, we need to add `frame-src blob:` to CSP:

```diff
-"frame-ancestors 'none'",
+"frame-ancestors 'none'",
+"frame-src blob:",
```

---

### Documentation

#### [MODIFY] [schema.md](file:///d:/Projects/Ops-Upgrade/personal_tracker/docs/schema.md)

Add new section documenting:
- The `expenses` storage bucket configuration.
- Storage RLS policies (INSERT, SELECT, DELETE, UPDATE).
- The `invoice_file`, `invoice_iv`, `invoice_mime` fields in the encrypted blob.

#### [MODIFY] [PLAN-expense.md](file:///d:/Projects/Ops-Upgrade/personal_tracker/docs/PLAN-expense.md)

- Update the `ExpensePlaintext` interface definition.
- Update the Invoice field description from "free-text" to "file upload".
- Add a new implementation phase for invoice storage.

#### [MODIFY] [context.md](file:///d:/Projects/Ops-Upgrade/personal_tracker/docs/context.md)

- Update "What's Not Built Yet" to reflect invoice storage progress.
- Add milestone entry.

---

## Verification Plan

### Manual Verification

1. **Bucket Creation:** Verify the `expenses` bucket exists as private in Supabase Dashboard → Storage.
2. **Upload Test:** Add a new expense with a PDF invoice → verify the file appears in `expenses/invoice/` in the bucket as an `.enc` file → confirm the file content in the bucket is unreadable ciphertext (not a valid PDF).
3. **Download/View Test:** Open the expense → click View → confirm the PDF renders correctly in the in-app preview. Click Download → confirm the file downloads with the correct name and opens normally.
4. **Delete Test:** Delete the expense → verify the storage file is also removed from the bucket.
5. **Replace Test:** Edit an expense, replace the invoice file → verify old file is deleted and new file appears.
6. **RLS Test:** Log in as a different user → confirm they cannot see or download the first user's files (Supabase should return 404/403).
7. **Admin Test:** Check the Supabase Dashboard → Storage → browse to the `.enc` file → download it manually → confirm it cannot be opened as a valid document (encrypted bytes).
8. **Size Limit Test:** Try uploading a file > 10 MB → confirm client-side validation rejects it.
9. **Type Limit Test:** Try uploading an unsupported file type → confirm validation rejects it.
10. **Backward Compatibility:** Verify existing expenses without invoice files still render correctly (empty invoice column).


# PLAN: Side-by-Side Invoice Preview in Expense Modal

Replace the current "eye icon → separate preview modal" flow with an **inline side-by-side layout**: the expense form on the left, and the invoice preview panel on the right, rendered together as one unified modal.

---

## Current Behavior

1. Expense form renders inside a `ModalFrame` (`max-w-3xl`).
2. Attached files appear as a list row with eye / download / remove icons.
3. Clicking the **eye icon** opens a **separate** `InvoicePreviewModal` (`z-50`) overlay on top of the expense modal.
4. The system currently supports **one file per expense** (single `invoice_file` / `invoice_iv` / `invoice_mime` triplet in `ExpensePlaintext`).

---

## Proposed Behavior

1. When an expense has an attached file **or** the user selects a new file, a **preview panel** appears to the **right** of the form inside the same modal.
2. The modal widens to accommodate both panels (`max-w-6xl`).
3. For **newly selected files** (before save), the preview is generated client-side from the local `File` object via `URL.createObjectURL`.
4. For **existing encrypted files**, the preview is fetched via `downloadInvoice` with a "Click to load" placeholder (to avoid unnecessary decrypt API calls on every open).
5. The separate `InvoicePreviewModal` component is **removed entirely**.
6. On **mobile / narrow viewports**, the preview panel stacks **below** the form.

> **Note on multi-file:** The current data model supports only one file per expense. Arrow navigation UI is built as a future-proof shell but operates on a single file today. No schema changes are made by this plan.

---

## Files Changed

### 1. `src/components/taskmanager/ModalFrame.tsx` — MODIFY

Add an optional `sidePanel?: ReactNode` prop.

- When `sidePanel` is provided → inner layout becomes `flex-row` (form left, panel right).
- When absent → layout is identical to today (no breaking change for any other modal).
- Responsive: `flex-col` on `sm` and below (stacked).

```diff
 interface ModalFrameProps {
   title: string;
   onClose: () => void;
   children: ReactNode;
   maxWidthClassName?: string;
+  sidePanel?: ReactNode;
 }

 export default function ModalFrame({
   title,
   onClose,
   children,
   maxWidthClassName = "max-w-3xl",
+  sidePanel,
 }: ModalFrameProps) {
   return (
     <div className="fixed inset-0 z-40 flex items-center justify-center bg-zinc-950/60 p-4">
       <div className={`w-full ${maxWidthClassName} rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900`}>
         <header ...>...</header>
-        <div className="p-4">{children}</div>
+        <div className={`flex ${sidePanel ? "flex-col sm:flex-row" : ""}`}>
+          <div className="p-4 flex-1 min-w-0">{children}</div>
+          {sidePanel && (
+            <div className="sm:w-[420px] shrink-0 border-t sm:border-t-0 sm:border-l border-zinc-200 dark:border-zinc-800">
+              {sidePanel}
+            </div>
+          )}
+        </div>
       </div>
     </div>
   );
 }
```

---

### 2. `src/components/expense/ExpenseModal.tsx` — MODIFY

#### 2a. Remove `InvoicePreviewModal` (lines 147–244)
Delete the entire `InvoicePreviewModal` component — it is replaced by the inline panel.

#### 2b. Remove `isPreviewOpen` state
```diff
-  const [isPreviewOpen, setPreviewOpen] = useState(false);
```
The panel is always visible when a file exists; no toggle needed.

#### 2c. Add `InvoicePreviewPanel` component (new, inside the file)

Panel layout:
```
┌─────────────────────────────────────────┐
│  ← 1 / 1 →          filename   ⬇       │  ← header: nav arrows, counter, download
├─────────────────────────────────────────┤
│                                         │
│     [Image | PDF iframe | Placeholder]  │  ← scrollable content
│                                         │
│    [Click to load]  (encrypted files)   │
└─────────────────────────────────────────┘
```

Props interface:
```ts
interface InvoicePreviewPanelProps {
  // Existing encrypted file (from saved expense)
  existingFile: string;      // filename in storage
  existingIv: string;
  existingMime: string;
  userId: string;
  // Newly selected local file (not yet saved)
  localFile: File | null;
  isDownloading: boolean;
  onDownload: () => void;
}
```

Behaviour:
- If `localFile` is set → immediately create a blob URL from `URL.createObjectURL(localFile)` and render inline (no decrypt needed).
- If `existingFile` is set and no `localFile` → show "Click to load preview" button; on click call `downloadInvoice` and render.
- Arrows (← →): rendered but `disabled` when file count === 1. Future-proofed.
- File counter badge: "1 / 1".
- Download button: calls `onDownload` prop.
- Content rendering:
  - `image/*` → `<img>` with `object-contain`
  - `application/pdf` → `<iframe>`
  - Other → Document icon + "Preview not available" + download link

#### 2d. Wire up `ExpenseModal` render

```diff
-  return (
-    <>
-      <ModalFrame title={...} onClose={onClose}>
-        <div className="space-y-3">
-          {/* form fields */}
-        </div>
-      </ModalFrame>
-      {/* Invoice preview modal */}
-      <InvoicePreviewModal isOpen={isPreviewOpen} ... />
-    </>
-  );

+  const hasFile = Boolean(displayFileName);
+
+  const sidePanel = hasFile ? (
+    <InvoicePreviewPanel
+      existingFile={existingInvoiceFile}
+      existingIv={existingInvoiceIv}
+      existingMime={existingInvoiceMime}
+      userId={userId}
+      localFile={invoiceFile}
+      isDownloading={isDownloading}
+      onDownload={handleDownload}
+    />
+  ) : undefined;
+
+  return (
+    <>
+      <ModalFrame
+        title={isEditing ? "Edit expense" : "Add expense"}
+        onClose={onClose}
+        maxWidthClassName={hasFile ? "max-w-6xl" : "max-w-md"}
+        sidePanel={sidePanel}
+      >
+        <div className="space-y-3">
+          {/* form fields — unchanged */}
+        </div>
+      </ModalFrame>
+      {/* ConfirmDialog — unchanged */}
+    </>
+  );
```

#### 2e. Keep unchanged
- File upload drop zone, file bar (existing file row), new file bar
- `handleFileChange`, `handleRemoveFile`, `handleDownload`, `handleSave`, `handleDelete`
- All form fields (Item, Seller, Cost, Date, Reason)
- Delete confirmation dialog

---

## Files NOT Changed

| File | Reason |
|------|--------|
| `ExpenseView.tsx` | No change — passes expense to modal, preview is internal |
| `ExpenseTable.tsx` | No change |
| `FullMonthModal.tsx` | No change |
| `src/types/expense.ts` | No schema change (single-file model retained) |
| `src/api/expense/*` | No API change |

---

## Open Decisions (answer before implementing)

1. **Multi-file data model**: Do you want this plan to also include a schema migration to support multiple files per expense (changes to `ExpensePlaintext`, API, and all CRUD), or is the UI-only approach (arrows shell, single file) acceptable for now?

2. **Auto-load vs. click-to-load**: For existing encrypted files, should the preview panel auto-decrypt the file when the modal opens, or show a "Click to load preview" placeholder? **Recommendation: click-to-load** to avoid unnecessary API calls.

---

## Verification Checklist

- [ ] Edit modal with existing file → preview panel appears on right with "Click to load"
- [ ] Click "load" → decrypts and renders correctly (image or PDF)
- [ ] Edit modal without file → normal width, no side panel
- [ ] Create modal + file upload → side panel appears immediately with local file preview
- [ ] Remove file → side panel disappears, modal shrinks
- [ ] Replace file → panel updates to new local file preview
- [ ] Download button in panel header → downloads the file
- [ ] Arrow buttons → visible but disabled (single file)
- [ ] Responsive (mobile) → preview stacks below form
- [ ] PDF preview → iframe renders correctly
- [ ] Image preview → img renders correctly
- [ ] `ModalFrame` with no `sidePanel` → identical to current behaviour (no regressions)

# Plan: Expense Tracker — View-All Modal Z-Index, PDF Upload UX, and Column Sort

**Date**: 2026-07-04
**Status**: Draft

## Goal

Fix four bugs / add one feature in the expense tracker UI:

1. **ExpenseModal hidden behind FullMonthModal** — clicking an expense row in the "View All" full-screen modal opens the ExpenseModal _behind_ it because FullMonthModal is `z-50` and ModalFrame is `z-40`.
2. **PDF upload "unsaved" indicator** — after selecting a file, nothing tells the user it isn't persisted yet. Show a clear "unsaved" badge so users know they must press Save.
3. **Upload drop zone disappears** — the upload zone is hidden the moment a file is selected (`!invoiceFile` guard on line 688). It should remain visible (or a "Replace" button should appear) so users can swap the file.
4. **Column sorting** — neither the inline preview (`MonthRow` → `ExpenseTable`) nor the full-month modal table supports clicking a column header to sort.

---

## Reusable Inventory (from existing codebase)

| Element | Path | How it's reused |
|---------|------|-----------------|
| `ModalFrame` | `src/components/taskmanager/ModalFrame.tsx` | Provides the z-index backdrop for ExpenseModal. The z-index will be made configurable. |
| `ExpenseTable` | `src/components/expense/ExpenseTable.tsx` | The shared table component that will receive sort state/callbacks. |
| `FullMonthModal` | `src/components/expense/FullMonthModal.tsx` | The z-50 full-screen overlay. Sort state will be managed here and forwarded to ExpenseTable. |
| `MonthRow` | `src/components/expense/MonthRow.tsx` | The inline preview row. Sort state will be managed here and forwarded to ExpenseTable. |
| `ExpenseModal` | `src/components/expense/ExpenseModal.tsx` | Where PDF upload UX changes happen. |
| `Expense` type | `src/types/expense.ts` | Defines sortable fields (item, seller, cost, date, reason). |

## Package Decisions

No new packages required. All changes are pure React/TypeScript/Tailwind within the existing codebase.

## ⚠️ Flagged Observations

None — all four items are straightforward bug fixes / enhancements.

---

## Phases & Tasks

### Phase 1 — Fix ExpenseModal Z-Index Stacking

#### Task 1.1 — Add `zClassName` prop to ModalFrame

- **What**: Add an optional `zClassName` prop (default `"z-40"`) to `ModalFrame`, replacing the hardcoded `z-40` on the outer `<div>`.
- **Where**: [ModalFrame.tsx](file:///e:/Projects/personal_tracker/src/components/taskmanager/ModalFrame.tsx)
- **Why**: `FullMonthModal` uses `z-50`. The `ExpenseModal` (via `ModalFrame`) uses `z-40`, so it renders behind. We need a way to push `ExpenseModal` to `z-60` when opened from within `FullMonthModal`.
- **Reuse**: Existing `ModalFrame` component — backwards-compatible change.
- **New Artifacts**: None (extending existing component).
- **Depends on**: Nothing.

#### Task 1.2 — Pass `z-60` from ExpenseModal when FullMonthModal is open

- **What**: In `ExpenseView`, detect when `fullMonthModal` is truthy AND `expenseModalTarget` is set simultaneously. Pass a higher z-index class (`z-60`) to `ExpenseModal` → `ModalFrame` so it renders above `FullMonthModal`.
- **Where**: [ExpenseView.tsx](file:///e:/Projects/personal_tracker/src/components/expense/ExpenseView.tsx) (lines 388–405) and [ExpenseModal.tsx](file:///e:/Projects/personal_tracker/src/components/expense/ExpenseModal.tsx) (line 541).
- **Why**: The modal stacking must be dynamic — `z-40` is fine when opened from the main view, but needs `z-60` when opened from within the `z-50` FullMonthModal.
- **Reuse**: The new `zClassName` prop from Task 1.1.
- **New Artifacts**: None.
- **Depends on**: Task 1.1.

---

### Phase 2 — PDF Upload UX Improvements

#### Task 2.1 — Add "Unsaved" indicator badge to the new file bar

- **What**: When `invoiceFile` is set (a new file selected but not yet saved), show a visible amber/yellow "Unsaved" badge or pill next to the file info in the new file bar (line 662–685 of `ExpenseModal.tsx`). This communicates to the user that pressing Save will upload the file.
- **Where**: [ExpenseModal.tsx](file:///e:/Projects/personal_tracker/src/components/expense/ExpenseModal.tsx) (lines 662–685, the new file bar).
- **Why**: Users see the file appear in a green-bordered bar but have no visual cue that it hasn't been uploaded yet.
- **Reuse**: Existing inline SVG icons, Tailwind utility classes.
- **New Artifacts**: None.
- **Depends on**: Nothing.

#### Task 2.2 — Keep upload drop zone visible (as "Replace" action) after file selection

- **What**: Remove the `!invoiceFile` guard on the upload drop zone (line 688). Instead, always render the upload zone but change its label to "Replace file" when `invoiceFile` is already set or when an existing file is present. When a new file is picked in "Replace" mode, swap `invoiceFile` state to the new file.
- **Where**: [ExpenseModal.tsx](file:///e:/Projects/personal_tracker/src/components/expense/ExpenseModal.tsx) (lines 687–711).
- **Why**: Currently the upload button vanishes once 1 file is selected. The user loses the ability to swap without first removing the file.
- **Reuse**: Same `handleFileChange` handler.
- **New Artifacts**: None.
- **Depends on**: Nothing.

---

### Phase 3 — Column Sort Feature

#### Task 3.1 — Add sort state and sorting logic to ExpenseTable

- **What**: Add `sortColumn` and `sortDirection` state management to `ExpenseTable`. Make each column header (`Item`, `Seller`, `Cost`, `Date`, `Reason`) clickable. Clicking toggles between ascending, descending, and default (no sort). Add a sort indicator arrow (▲/▼) next to the active column header. Sort the expense list in `useMemo` based on the current sort state before rendering rows. The Invoice column is not sortable.
- **Where**: [ExpenseTable.tsx](file:///e:/Projects/personal_tracker/src/components/expense/ExpenseTable.tsx)
- **Why**: Users need to quickly find expenses by different attributes without scrolling through unsorted data.
- **Reuse**: Existing `Expense` type fields for sort keys.
- **New Artifacts**: None.
- **Depends on**: Nothing.

#### Task 3.2 — Verify sort works in both MonthRow preview and FullMonthModal

- **What**: Since `ExpenseTable` will now manage its own sort state internally, both `MonthRow` (preview with 5 items) and `FullMonthModal` (all items) will automatically get sort functionality with no extra wiring. The parent components pass in their pre-sorted arrays, and `ExpenseTable` will re-sort based on user clicks. Verify that `MonthRow`'s preview slicing (first 5 by date desc) interacts correctly — the sort should apply _within_ the 5 items shown. This is a verification task, not a code change.
- **Where**: [MonthRow.tsx](file:///e:/Projects/personal_tracker/src/components/expense/MonthRow.tsx), [FullMonthModal.tsx](file:///e:/Projects/personal_tracker/src/components/expense/FullMonthModal.tsx)
- **Why**: Confirm the feature works end-to-end in both usage contexts without regressions.
- **Reuse**: Task 3.1's internal sort state in `ExpenseTable`.
- **New Artifacts**: None.
- **Depends on**: Task 3.1.

---

## New Reusable Components Introduced

| Component | Path | Purpose | Reusable for |
|-----------|------|---------|--------------|
| `zClassName` prop on `ModalFrame` | `src/components/taskmanager/ModalFrame.tsx` | Dynamic z-index layering | Any future stacked-modal scenario |
| Sort logic in `ExpenseTable` | `src/components/expense/ExpenseTable.tsx` | Self-contained clickable column sort | Any table that reuses this component |

## Verification Plan

- [ ] **Phase 1**: From the main expense view, open a month's "View All" modal → click an expense row → confirm ExpenseModal renders on top of FullMonthModal, is fully interactive, and closing it returns to the FullMonthModal (not the main view).
- [ ] **Phase 2a**: Open ExpenseModal (create or edit) → upload a file → confirm an "Unsaved" badge is visible on the file bar → press Save → confirm the badge is gone on re-open.
- [ ] **Phase 2b**: Open ExpenseModal → upload a file → confirm the upload zone still shows as "Replace file" → pick another file → confirm the first is swapped → confirm for existing files (edit mode) the "Replace" zone is also available.
- [ ] **Phase 3**: In the inline month preview, click each column header → verify sort toggles (asc → desc → default). In the FullMonthModal, do the same. Confirm the Invoice column is not sortable. Confirm sort indicators are visible.
- [ ] Run `next build` to ensure no TypeScript or build errors.
