# Remaining Work — Expense Invoice File Upload

Everything below still needs to be done. The core feature code (types, API, UI, CSP) is in place and compiles cleanly — these are the gaps.

---

## 🔴 Critical — Must Fix Before Deploy

### 1. Add backward-compat defaults in `fetchExpenses`

**File:** `src/api/expense/expenses.ts` — `fetchExpenses`, the `rows.map(...)` block

Old expense blobs (created before this feature) don't contain `invoice_file`, `invoice_iv`, or `invoice_mime`. When `JSON.parse()` returns them, those fields are `undefined` — not `""`. This will cause runtime errors for any existing user.

**What to do:** Change the deserialization to supply defaults:

```diff
  rows.map(async (row) => {
    const plaintext = await decryptField(userId, row.iv, row.data);
-   const parsed: ExpensePlaintext = JSON.parse(plaintext);
+   const parsed: ExpensePlaintext = {
+     invoice_file: "",
+     invoice_iv: "",
+     invoice_mime: "",
+     ...JSON.parse(plaintext),
+   };
    return { id: row.id, created_at: row.created_at, ...parsed };
  })
```

### 2. Remove unsafe type casts for `invoice_*` fields

**Files:**
- `src/components/expense/ExpenseModal.tsx` — lines 304-309
- `src/components/expense/ExpenseView.tsx` — lines 213-221 and 285-286

These all cast `expense as Expense & { invoice_file?: string }` — but `Expense` already extends `ExpensePlaintext` which has `invoice_file: string`. The casts are wrong and hide the backward-compat bug above.

**What to do:** Replace the pattern with direct property access. Example for ExpenseModal:

```diff
- const existingInvoiceFile = (expense as Expense & { invoice_file?: string })
-   ?.invoice_file ?? "";
- const existingInvoiceMime = (expense as Expense & { invoice_mime?: string })
-   ?.invoice_mime ?? "";
- const existingInvoiceIv = (expense as Expense & { invoice_iv?: string })
-   ?.invoice_iv ?? "";
+ const existingInvoiceFile = expense?.invoice_file ?? "";
+ const existingInvoiceMime = expense?.invoice_mime ?? "";
+ const existingInvoiceIv = expense?.invoice_iv ?? "";
```

Apply the same pattern to the two locations in ExpenseView.tsx.

---

## 🟡 Moderate — Architectural Cleanup

### 3. Move storage cleanup into `deleteExpense` API function

**File:** `src/api/expense/expenses.ts` — `deleteExpense`

The plan specifies that `deleteExpense` should accept an optional invoice filename and delete the storage file. Currently, storage cleanup lives in `ExpenseView.tsx` at the UI layer instead.

**What to do:** Either:
- **(a)** Add an optional `invoiceFile?: string` param to `deleteExpense`, import `deleteInvoice`, and handle cleanup there — so any future caller automatically gets storage cleanup, or
- **(b)** Consciously accept this deviation and leave a comment in `deleteExpense` warning that callers are responsible for storage cleanup.

---

## ❌ Missing — Documentation Updates

The plan explicitly lists three doc files to update. None were touched.

### 4. Update `docs/schema.md`

**What to add:**
- New section for the `expenses` storage bucket configuration
- Storage RLS policies (INSERT, SELECT, DELETE, UPDATE) — the SQL is in `docs/PLAN-expense_file_upload.md`
- Document the `invoice_file`, `invoice_iv`, `invoice_mime` fields in the encrypted blob schema table

### 5. Update `docs/PLAN-expense.md`

**What to add:**
- Updated `ExpensePlaintext` interface definition (3 new fields)
- Change Invoice field description from "free-text string" to "storage file reference"
- Add a new implementation phase entry for invoice storage

### 6. Update `docs/context.md`

**What to add:**
- Move invoice storage from "What's Not Built Yet" to the completed section
- Add a milestone/changelog entry for this feature
