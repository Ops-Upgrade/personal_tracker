# Personal Tracker — Database Schema

> Canonical record of Supabase tables, columns, and RLS.  
> **Companion docs:** [`context.md`](./context.md) (app stack and conventions), [`PLAN-crypto.md`](./PLAN-crypto.md) (crypto/KMS rollout).

Update this file whenever you add or change tables, columns, indexes, or policies in Supabase (Dashboard SQL or migrations).

---

## Schema overview

| Schema  | Object        | Purpose |
|---------|---------------|---------|
| `public` | `user_keys`   | Per-user wrapped DEK (client-side envelope encryption). |
| `public` | `tasks`       | Encrypted task blobs (task manager feature). |
| `public` | `notes`       | Encrypted note blobs (task manager feature). |

---

## `public.user_keys`

Stores one row per authenticated user: salt + IV + password-wrapped data encryption key (DEK). Plaintext DEK never leaves the client; Supabase only sees ciphertext.

| Column        | Type        | Nullable | Default   | Notes |
|---------------|-------------|----------|-----------|--------|
| `user_id`     | `UUID`      | NO       | —         | PK, `REFERENCES auth.users(id) ON DELETE CASCADE` |
| `salt`        | `TEXT`      | NO       | —         | Base64 salt for Argon2id → KEK |
| `iv`          | `TEXT`      | NO       | —         | Base64 IV used when wrapping DEK with KEK |
| `wrapped_dek` | `TEXT`      | NO       | —         | Base64 ciphertext of wrapped DEK |
| `created_at`  | `TIMESTAMPTZ` | YES    | `now()`   | Row creation time |
| `updated_at`  | `TIMESTAMPTZ` | YES    | `now()`   | Last update time |

### DDL (source of truth)

```sql
CREATE TABLE public.user_keys (
    user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    salt        TEXT NOT NULL,
    iv          TEXT NOT NULL,
    wrapped_dek TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.user_keys IS
  'Stores per-user encrypted Data Encryption Keys. The wrapped_dek can only be decrypted client-side with the users password-derived KEK.';
```

### Row Level Security

- **RLS:** `ENABLE ROW LEVEL SECURITY` on `public.user_keys`.

| Policy name | Command | `USING` | `WITH CHECK` |
|-------------|---------|---------|----------------|
| `Users read/update their own key row` | `ALL` | `auth.uid() = user_id` | `auth.uid() = user_id` |

```sql
ALTER TABLE public.user_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read/update their own key row"
    ON public.user_keys
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
```

### Indexes

- Primary key on `user_id` (implicit unique index).

---

## `public.tasks`

Encrypted task data. Each row stores one task as an opaque AES-GCM ciphertext blob. All fields (name, description, priority, due date, mode, completion status) live inside the encrypted `data` JSON — no plaintext columns.

| Column       | Type          | Nullable | Default              | Notes |
|--------------|---------------|----------|----------------------|-------|
| `id`         | `UUID`        | NO       | `gen_random_uuid()`  | PK |
| `user_id`    | `UUID`        | NO       | —                    | FK → `auth.users(id) ON DELETE CASCADE` |
| `iv`         | `TEXT`        | NO       | —                    | Per-record AES-GCM IV (Base64) |
| `data`       | `TEXT`        | NO       | —                    | Base64 ciphertext (encrypted JSON blob) |
| `created_at` | `TIMESTAMPTZ` | YES      | `now()`              | Row creation timestamp |

### DDL (source of truth)

```sql
CREATE TABLE public.tasks (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    iv         TEXT NOT NULL,
    data       TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### Row Level Security

- **RLS:** `ENABLE ROW LEVEL SECURITY` on `public.tasks`.

| Policy name | Command | `USING` | `WITH CHECK` |
|-------------|---------|---------|----------------|
| `Users manage their own tasks` | `ALL` | `auth.uid() = user_id` | `auth.uid() = user_id` |

```sql
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own tasks"
    ON public.tasks
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
```

### Indexes

- Primary key on `id` (implicit unique index).

---

## `public.notes`

Encrypted note data. Each row stores one note as an opaque AES-GCM ciphertext blob. Content and timestamps live inside the encrypted `data` JSON — no plaintext columns.

| Column       | Type          | Nullable | Default              | Notes |
|--------------|---------------|----------|----------------------|-------|
| `id`         | `UUID`        | NO       | `gen_random_uuid()`  | PK |
| `user_id`    | `UUID`        | NO       | —                    | FK → `auth.users(id) ON DELETE CASCADE` |
| `iv`         | `TEXT`        | NO       | —                    | Per-record AES-GCM IV (Base64) |
| `data`       | `TEXT`        | NO       | —                    | Base64 ciphertext (encrypted JSON blob) |
| `created_at` | `TIMESTAMPTZ` | YES      | `now()`              | Row creation timestamp |

### DDL (source of truth)

```sql
CREATE TABLE public.notes (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    iv         TEXT NOT NULL,
    data       TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### Row Level Security

- **RLS:** `ENABLE ROW LEVEL SECURITY` on `public.notes`.

| Policy name | Command | `USING` | `WITH CHECK` |
|-------------|---------|---------|----------------|
| `Users manage their own notes` | `ALL` | `auth.uid() = user_id` | `auth.uid() = user_id` |

```sql
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own notes"
    ON public.notes
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
```

### Indexes

- Primary key on `id` (implicit unique index).

---

## Encrypted blob convention

All encrypted feature tables follow the same shape: `id`, `user_id`, `iv`, `data`, `created_at`. The `iv` + `data` columns hold the per-record AES-GCM payload. No plaintext columns. See [`PLAN-crypto.md`](./docs/PLAN-crypto.md) Phase 7 for the encrypt/decrypt patterns.

Future encrypted tables (e.g. expenses) should follow this same convention.

---

## Storage Buckets

### `expenses` bucket

Private storage bucket for encrypted invoice file attachments. Files are client-side encrypted with the user's DEK before upload — Supabase never sees plaintext.

| Setting | Value |
|---------|-------|
| **Bucket ID** | `expenses` |
| **Public** | No (RLS enforced) |
| **File path convention** | `invoice/<uuid>.enc` |
| **Content-Type on upload** | `application/octet-stream` |
| **Max file size** | 45 MB (client-side enforced) |

#### DDL (source of truth — run in Supabase Dashboard SQL Editor)

```sql
-- 1. Create private storage bucket
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

> **Note:** Supabase auto-sets `owner_id` to `auth.uid()` on INSERT into `storage.objects`.

---

### Expense Blob Fields (Invoice Storage)

The `ExpensePlaintext` encrypted blob includes three additional fields for invoice file storage:

| Field | Type | Description |
|-------|------|-------------|
| `invoice_file` | `string` | Filename in bucket (e.g. `"<uuid>.enc"`), empty if no file attached |
| `invoice_iv` | `string` | Base64 IV used to encrypt the file, empty if no file |
| `invoice_mime` | `string` | Original MIME type (e.g. `"application/pdf"`), empty if no file |

---

## Change log

| Date       | Change |
|------------|--------|
| 2026-04-11 | Initial doc: `public.user_keys` + RLS (Crypto plan Phase 1 complete). |
| 2026-04-12 | Added `public.tasks` + `public.notes` tables + RLS (Task Manager F1.1). |
| 2026-04-12 | Clarified task encrypted blob field wording from `note` to `description` for task content naming consistency. |
| 2026-04-12 | Confirmed no SQL/DDL change required for quick-complete/reopen actions and completion-date display; all use existing encrypted fields (`is_completed`, `completed_at`) in task `data` blob. |
