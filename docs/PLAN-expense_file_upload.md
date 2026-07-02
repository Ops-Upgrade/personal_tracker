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
