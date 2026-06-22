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
  invoice: string;        // Free-text invoice ref, URL, or receipt identifier (optional)
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
- Fields: Item (text), Seller (text), Cost ₹ (number input), Date (date picker, pre-set to 1st of that month), Reason (text), Invoice (text — a free-text reference, not a file upload in v1).
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
| 1 | `invoice` field type | Free-text string in v1 (URL, receipt code, or note). No file upload. |
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

---

## Revision Log

| Date       | Change |
|------------|--------|
| 2026-06-22 | Initial draft — derived from Figma wireframes (5 screens: main, expanded month, add item modal, view single item modal, view all items in month modal). Aligned to Feature 1 (Task Manager) doc conventions and encrypted-blob architecture. |
