# Human Actions: Medical Records & Global Document Store

**Paired with**: [PLAN-medical-records.md](./PLAN-medical-records.md)
**Date**: 2026-07-13
**Status**: Implementation Complete — Awaiting Human Actions

> These actions CANNOT be automated. Perform them in the order listed, relative to deployment.

## Action Index

| # | Action | When | Where | Blocking? |
|---|--------|------|-------|-----------|
| 1 | Create `documents` table + RLS in Supabase | Before running the app | Supabase SQL Editor | **Yes** |
| 2 | Create `medical_records` table + RLS in Supabase | Before running the app | Supabase SQL Editor | **Yes** |
| 3 | Migrate `certificates` table data to `documents` | After tables created | Supabase SQL Editor / App UI | Yes |
| 4 | Add `documents` folder to R2 allowed folders | Verified — already in code | `src/app/api/storage/upload/route.ts` | No |
| 5 | Re-upload existing expense invoices | After migration, at convenience | App UI | No |

## Detailed Actions

### HA-01 — Create `documents` table + RLS in Supabase
- **When**: Before running the app
- **Where**: Supabase Dashboard → SQL Editor
- **What**: Create the generic `documents` table that replaces the education-specific `certificates` table and serves all domains (education, expense, medical).
- **How**: Run the following DDL:
  ```sql
  CREATE TABLE public.documents (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      iv         TEXT NOT NULL,
      data       TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Users can manage their own documents"
      ON public.documents
      FOR ALL USING (auth.uid() = user_id);
  ```
- **Why this can't be automated**: Supabase database schema changes require direct SQL access or Dashboard UI — no migration framework is configured in this project.
- **Blocking**: Yes — the app will crash when trying to query the `documents` table if it doesn't exist.

### HA-02 — Create `medical_records` table + RLS in Supabase
- **When**: Before running the app
- **Where**: Supabase Dashboard → SQL Editor
- **What**: Create the `medical_records` table for the new Medical Records domain. Uses the standard encrypted-blob shape (id, user_id, iv, data, created_at).
- **How**: Run the following DDL:
  ```sql
  CREATE TABLE public.medical_records (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      iv         TEXT NOT NULL,
      data       TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Users can manage their own medical records"
      ON public.medical_records
      FOR ALL USING (auth.uid() = user_id);
  ```
- **Why this can't be automated**: Supabase database schema changes require direct SQL access or Dashboard UI.
- **Blocking**: Yes — the `/medical` route will crash when trying to query the `medical_records` table if it doesn't exist.

### HA-03 — Migrate `certificates` table data to `documents` (if certificates exist)
- **When**: After tables created, before using the Education Store
- **Where**: Supabase Dashboard → SQL Editor, optionally App UI
- **What**: If you have existing certificates in the `certificates` table, they won't appear in the new Education Store (which now queries `documents`). Options:
  - **Option A (Simple)**: Manually re-upload certificates through the new Education Store UI at `/education/store`.
  - **Option B (SQL)**: Rename the existing `certificates` table to `documents`:
    ```sql
    ALTER TABLE public.certificates RENAME TO documents;
    ```
    Then update the encrypted `data` blobs client-side to include the new `domain` and `linked_id` fields (this requires decrypting/re-encrypting each row, which can only be done client-side with the user's DEK).
- **Why this can't be automated**: Data migration involves decrypting and re-encrypting with the user's DEK, which is only available client-side. The server cannot access plaintext keys.
- **Blocking**: Yes — existing certificates won't appear in the new store until migrated.

### HA-04 — Add `documents` folder to R2 allowed folders
- **When**: Verified — already complete
- **Where**: `src/app/api/storage/upload/route.ts` — the `allowedFolders` array now includes `"documents"`.
- **What**: No action needed. R2 folders are created automatically on first write.
- **Blocking**: No

### HA-05 — Re-upload existing expense invoices
- **When**: After migration, at your convenience
- **Where**: App UI — Expense Tracker
- **What**: The `ExpensePlaintext` type has been changed from inline `invoice_file`/`invoice_iv`/`invoice_mime` fields to a `document_ids: string[]` array referencing the global document store. Existing expenses with invoice file metadata in their encrypted blobs will have that metadata ignored (the `document_ids` fallback is `[]`). The `.enc` files in R2 are NOT deleted — only the database references are lost for old records.
- **How**:
  1. Open each expense that previously had an invoice file.
  2. Upload the invoice file through the Document Store.
  3. Link the document to the expense record from the store.
- **Why this can't be automated**: The old `invoice_file`/`invoice_iv`/`invoice_mime` fields are encrypted inside per-record AES-GCM blobs. Migrating them to the new `documents` table would require: (1) decrypting each expense blob client-side, (2) decrypting each invoice file and re-uploading it to the `documents/` R2 folder, (3) creating a new `documents` row with the new metadata, (4) updating the expense's `document_ids` array. This is a per-user, per-record operation requiring the DEK.
- **Blocking**: No — the app functions without re-uploading. Expenses simply show no attached documents until re-linked.
