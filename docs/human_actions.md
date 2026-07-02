# Human Actions — Expense Invoice File Upload

Manual steps you must perform **before** the invoice file upload feature will work in production.

---

## 1. Create Supabase Storage Bucket + RLS Policies

**Where:** Supabase Dashboard → SQL Editor

Run the following SQL (copied from the plan):

```sql
-- 1. Create private storage bucket (NOT public — RLS enforced)
INSERT INTO storage.buckets (id, name, public)
VALUES ('expenses', 'expenses', false);

-- 2. RLS: Authenticated users can upload to their own folder
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
    AND owner_id = auth.uid()::text
);

-- 4. RLS: Users can only delete files they own
CREATE POLICY "Users delete their own invoices"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'expenses'
    AND owner_id = auth.uid()::text
);

-- 5. RLS: Users can update (overwrite) files they own
CREATE POLICY "Users update their own invoices"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'expenses'
    AND owner_id = auth.uid()::text
);
```

## 2. Verify Bucket Creation

1. Go to **Supabase Dashboard → Storage**.
2. Confirm the `expenses` bucket exists and is marked as **Private** (not public).

## 3. Run Manual Verification Tests

After deploying, run through the verification plan from the original [PLAN-expense_file_upload.md](file:///e:/Projects/personal_tracker/docs/PLAN-expense_file_upload.md#L331-L345):

- [ ] Upload a PDF invoice → verify `.enc` file in bucket is unreadable ciphertext
- [ ] View the invoice → confirm PDF renders in-app
- [ ] Download the invoice → confirm it opens normally
- [ ] Delete an expense → verify storage file is also removed
- [ ] Replace an invoice → verify old file deleted, new file appears
- [ ] Log in as different user → confirm they can't access other user's files
- [ ] Download `.enc` file from Supabase Dashboard → confirm it's encrypted
- [ ] Try uploading > 10 MB file → confirm rejection
- [ ] Try uploading unsupported file type → confirm rejection
- [ ] Verify existing expenses (without invoice files) still render correctly

## 4. Fix Critical Issue Before Deploy

> [!CAUTION]
> The backward compatibility issue identified in the verification report **must** be fixed before deploying. Old expense blobs don't contain `invoice_file`, `invoice_iv`, or `invoice_mime` fields. See the verification report for the fix.
