# Personal Tracker — Database Schema

> Canonical record of Supabase tables, columns, and RLS.  
> **Companion docs:** [`context.md`](./context.md) (app stack and conventions), [`PLAN-crypto.md`](./PLAN-crypto.md) (crypto/KMS rollout).

Update this file whenever you add or change tables, columns, indexes, or policies in Supabase (Dashboard SQL or migrations).

---

## Schema overview

| Schema  | Object          | Purpose |
|---------|-----------------|----------|
| `public` | `user_keys`    | Per-user wrapped DEK (client-side envelope encryption). |
| `public` | `tasks`        | Encrypted task blobs (task manager feature). |
| `public` | `notes`        | Encrypted note blobs (task manager feature). |
| `public` | `expenses`     | Encrypted expense blobs (expense tracker feature). |
| `public` | `educations`   | Encrypted education/course blobs (education feature). |
| `public` | `documents`    | Encrypted global document metadata blobs (used by multiple features). |
| `public` | `medical_records` | Encrypted medical records blobs (medical tracker feature). |
| `public` | `media`        | Encrypted media/movie/TV tracking blobs (media tracker feature). |
| `public` | `media_collections` | Encrypted collection grouping blobs (media tracker feature). |

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
| `recovery_salt`        | `TEXT`      | YES    | —         | Base64 salt for Argon2id → recovery KEK |
| `recovery_iv`          | `TEXT`      | YES    | —         | Base64 IV used when wrapping DEK with recovery KEK |
| `recovery_wrapped_dek` | `TEXT`      | YES    | —         | Base64 ciphertext of DEK wrapped by recovery KEK |
| `updated_at`  | `TIMESTAMPTZ` | YES    | `now()`   | Last update time |

### DDL (source of truth)

```sql
CREATE TABLE public.user_keys (
    user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    salt        TEXT NOT NULL,
    iv          TEXT NOT NULL,
    wrapped_dek TEXT NOT NULL,
    recovery_salt        TEXT,
    recovery_iv          TEXT,
    recovery_wrapped_dek TEXT,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.user_keys IS
  'Stores per-user encrypted Data Encryption Keys. The wrapped_dek can only be decrypted client-side with the users password-derived KEK. Recovery columns hold a second wrapped copy of the DEK protected by a recovery phrase.';
```

### Recovery key migration (for existing deployments)

```sql
ALTER TABLE public.user_keys
  ADD COLUMN recovery_salt        TEXT,
  ADD COLUMN recovery_iv          TEXT,
  ADD COLUMN recovery_wrapped_dek TEXT;
```

No RLS changes needed — the existing `auth.uid() = user_id` FOR ALL policy already covers new columns.

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

## `public.expenses`

Encrypted expense data. Each row stores one expense as an opaque AES-GCM ciphertext blob. All fields (title, amount, date, category, notes, linked document IDs) live inside the encrypted `data` JSON — no plaintext columns.

| Column       | Type          | Nullable | Default              | Notes |
|--------------|---------------|----------|----------------------|-------|
| `id`         | `UUID`        | NO       | `gen_random_uuid()`  | PK |
| `user_id`    | `UUID`        | NO       | —                    | FK → `auth.users(id)` |
| `iv`         | `TEXT`        | NO       | —                    | Per-record AES-GCM IV (Base64) |
| `data`       | `TEXT`        | NO       | —                    | Base64 ciphertext (encrypted JSON blob) |
| `created_at` | `TIMESTAMPTZ` | YES      | `now()`              | Row creation timestamp |

### DDL (source of truth)

```sql
CREATE TABLE public.expenses (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES auth.users(id),
    iv         TEXT NOT NULL,
    data       TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### Row Level Security

- **RLS:** `ENABLE ROW LEVEL SECURITY` on `public.expenses`.

| Policy name | Command | `USING` | `WITH CHECK` |
|-------------|---------|---------|----------------|
| `Users manage their own expenses` | `ALL` | `auth.uid() = user_id` | `auth.uid() = user_id` |

```sql
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own expenses"
    ON public.expenses
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
```

### Indexes

- Primary key on `id` (implicit unique index).

---

## `public.educations`

Encrypted education/course data. Each row stores one education record as an opaque AES-GCM ciphertext blob. Fields (course name, provider, status, start/end dates, notes, linked document IDs) live inside the encrypted `data` JSON.

| Column       | Type          | Nullable | Default              | Notes |
|--------------|---------------|----------|----------------------|-------|
| `id`         | `UUID`        | NO       | `gen_random_uuid()`  | PK |
| `user_id`    | `UUID`        | NO       | —                    | FK → `auth.users(id)` |
| `iv`         | `TEXT`        | NO       | —                    | Per-record AES-GCM IV (Base64) |
| `data`       | `TEXT`        | NO       | —                    | Base64 ciphertext (encrypted JSON blob) |
| `created_at` | `TIMESTAMPTZ` | NO       | `now()`              | Row creation timestamp |

### DDL (source of truth)

```sql
CREATE TABLE public.educations (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES auth.users(id),
    iv         TEXT NOT NULL,
    data       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Row Level Security

- **RLS:** `ENABLE ROW LEVEL SECURITY` on `public.educations`.

| Policy name | Command | `USING` | `WITH CHECK` |
|-------------|---------|---------|----------------|
| `Users can manage their own educations` | `ALL` | `auth.uid() = user_id` | — |

```sql
ALTER TABLE public.educations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own educations"
    ON public.educations
    FOR ALL USING (auth.uid() = user_id);
```

### Indexes

- Primary key on `id` (implicit unique index).

---

## `public.documents`

Encrypted global document metadata. Each row represents one document file attached to a domain record (expense, education, medical) or uploaded independently to the Global Document Store. File content is stored encrypted in R2 storage; this table stores encrypted metadata (filename, MIME type, IV, linked ID, domain).

| Column       | Type          | Nullable | Default              | Notes |
|--------------|---------------|----------|----------------------|-------|
| `id`         | `UUID`        | NO       | `gen_random_uuid()`  | PK |
| `user_id`    | `UUID`        | NO       | —                    | FK → `auth.users(id)` |
| `iv`         | `TEXT`        | NO       | —                    | Per-record AES-GCM IV (Base64) |
| `data`       | `TEXT`        | NO       | —                    | Base64 ciphertext (encrypted JSON blob) |
| `created_at` | `TIMESTAMPTZ` | NO       | `now()`              | Row creation timestamp |

### DDL (source of truth)

```sql
CREATE TABLE public.documents (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES auth.users(id),
    iv         TEXT NOT NULL,
    data       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Row Level Security

- **RLS:** `ENABLE ROW LEVEL SECURITY` on `public.documents`.

| Policy name | Command | `USING` | `WITH CHECK` |
|-------------|---------|---------|----------------|
| `Users can manage their own documents` | `ALL` | `auth.uid() = user_id` | — |

```sql
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own documents"
    ON public.documents
    FOR ALL USING (auth.uid() = user_id);
```

### Indexes

- Primary key on `id` (implicit unique index).

---

## `public.medical_records`

Encrypted medical records data. Each row stores one medical record as an opaque AES-GCM ciphertext blob. Fields (name, clinic, date, diagnosis timeline, linked document IDs) live inside the encrypted `data` JSON.

| Column       | Type          | Nullable | Default              | Notes |
|--------------|---------------|----------|----------------------|-------|
| `id`         | `UUID`        | NO       | `gen_random_uuid()`  | PK |
| `user_id`    | `UUID`        | NO       | —                    | FK → `auth.users(id)` |
| `iv`         | `TEXT`        | NO       | —                    | Per-record AES-GCM IV (Base64) |
| `data`       | `TEXT`        | NO       | —                    | Base64 ciphertext (encrypted JSON blob) |
| `created_at` | `TIMESTAMPTZ` | NO       | `now()`              | Row creation timestamp |

### DDL (source of truth)

```sql
CREATE TABLE public.medical_records (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES auth.users(id),
    iv         TEXT NOT NULL,
    data       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Row Level Security

- **RLS:** `ENABLE ROW LEVEL SECURITY` on `public.medical_records`.

| Policy name | Command | `USING` | `WITH CHECK` |
|-------------|---------|---------|----------------|
| `Users can manage their own medical_records` | `ALL` | `auth.uid() = user_id` | — |

```sql
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own medical_records"
    ON public.medical_records
    FOR ALL USING (auth.uid() = user_id);
```

---

## `public.media`

Encrypted media tracking data. Each row stores one movie or TV show as an opaque AES-GCM ciphertext blob. Fields (tmdb_id, type, title, status, rating, review_notes, collection_id, episodes) live inside the encrypted `data` JSON.

| Column       | Type          | Nullable | Default              | Notes |
|--------------|---------------|----------|----------------------|-------|
| `id`         | `UUID`        | NO       | `gen_random_uuid()`  | PK |
| `user_id`    | `UUID`        | NO       | —                    | FK → `auth.users(id) ON DELETE CASCADE` |
| `iv`         | `TEXT`        | NO       | —                    | Per-record AES-GCM IV (Base64) |
| `data`       | `TEXT`        | NO       | —                    | Base64 ciphertext (encrypted JSON blob) |
| `created_at` | `TIMESTAMPTZ` | YES      | `now()`              | Row creation timestamp |

### DDL (source of truth)

```sql
CREATE TABLE public.media (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    iv text NOT NULL,
    data text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
```

### Row Level Security

- **RLS:** `ENABLE ROW LEVEL SECURITY` on `public.media`.

| Policy name | Command | `USING` | `WITH CHECK` |
|-------------|---------|---------|----------------|
| `Users can manage their own media` | `ALL` | `auth.uid() = user_id` | — |

```sql
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own media"
    ON public.media
    FOR ALL USING (auth.uid() = user_id);
```

### Indexes

- Primary key on `id` (implicit unique index).

---

## `public.media_collections`

Encrypted collection grouping data. Each row stores one collection (name, description, color) used to group media items.

| Column       | Type          | Nullable | Default              | Notes |
|--------------|---------------|----------|----------------------|-------|
| `id`         | `UUID`        | NO       | `gen_random_uuid()`  | PK |
| `user_id`    | `UUID`        | NO       | —                    | FK → `auth.users(id) ON DELETE CASCADE` |
| `iv`         | `TEXT`        | NO       | —                    | Per-record AES-GCM IV (Base64) |
| `data`       | `TEXT`        | NO       | —                    | Base64 ciphertext (encrypted JSON blob) |
| `created_at` | `TIMESTAMPTZ` | YES      | `now()`              | Row creation timestamp |

### DDL (source of truth)

```sql
CREATE TABLE public.media_collections (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    iv text NOT NULL,
    data text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
```

### Row Level Security

- **RLS:** `ENABLE ROW LEVEL SECURITY` on `public.media_collections`.

| Policy name | Command | `USING` | `WITH CHECK` |
|-------------|---------|---------|----------------|
| `Users can manage their own media_collections` | `ALL` | `auth.uid() = user_id` | — |

```sql
ALTER TABLE public.media_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own media_collections"
    ON public.media_collections
    FOR ALL USING (auth.uid() = user_id);
```

### Indexes

- Primary key on `id` (implicit unique index).

---

## Encrypted blob convention

All encrypted feature tables follow the same shape: `id`, `user_id`, `iv`, `data`, `created_at`. The `iv` + `data` columns hold the per-record AES-GCM payload. No plaintext columns. See [`PLAN-crypto.md`](./plans/PLAN-crypto.md) Phase 7 for the encrypt/decrypt patterns.

---

---

## Cloudflare R2 Storage

All file storage uses a single Cloudflare R2 bucket (`personal-tracker`) with folder prefixes per feature. Files are client-side encrypted with the user's DEK before upload — R2 never sees plaintext.

Access control is enforced by Next.js API routes (`src/app/api/storage/`) that validate the user's Supabase session before granting presigned URLs or performing server-side deletes. There is no RLS — the API routes are the gatekeepers.

### R2 Bucket: `personal-tracker`

| Setting | Value |
|---------|-------|
| **Bucket name** | `personal-tracker` (configurable via `R2_BUCKET_NAME` env var) |
| **Region** | `auto` (Cloudflare R2 default) |
| **Endpoint** | `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com` |
| **Auth** | S3-compatible API via `@aws-sdk/client-s3` with R2 API token |
| **Max file size** | 45 MB (client-side enforced) |
| **Content-Type** | `application/octet-stream` |

### Folder Structure

```
personal-tracker/
├── expenses/
│   └── {userId}/
│       └── {uuid}.enc         # Encrypted invoice files
└── certificates/
    └── {userId}/
        └── {uuid}.enc         # Encrypted certificate files
```

User isolation is guaranteed by path: every object key includes the authenticated `userId` in the second path segment, validated server-side before any operation.

### API Routes (Access Control)

| Route | Method | Purpose | Auth Check |
|-------|--------|---------|------------|
| `/api/storage/upload` | POST | Returns presigned PUT URL (5 min TTL) | Session → `getClaims()` |
| `/api/storage/download` | POST | Returns presigned GET URL (5 min TTL) | Session + key ownership |
| `/api/storage/delete` | POST | Server-side `DeleteObjectCommand` | Session + key ownership |

All routes validate:
1. Valid Supabase session (JWT signature verified via `getClaims()`)
2. Key ownership: the second path segment must match `userId`
3. Folder whitelist: only `expenses` and `certificates` folders are allowed for upload
4. Filename format: `UUID.enc` pattern enforced for upload

### Environment Variables

| Variable | Scope | Purpose |
|----------|-------|---------|
| `R2_ACCOUNT_ID` | Server-only | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | Server-only | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | Server-only | R2 API token secret key |
| `R2_BUCKET_NAME` | Server-only | Bucket name (defaults to `personal-tracker`) |

These are **server-only** (no `NEXT_PUBLIC_` prefix) — the browser never sees R2 credentials. The browser uploads/downloads via presigned URLs, which are temporary and scoped to a single object.

### Encrypted Blob Fields (Global Document Store)

The `DocumentPlaintext` encrypted blob includes file metadata fields:

| Field | Type | Description |
|-------|------|-------------|
| `file_name` | `string` | Filename in R2 (e.g. `"<uuid>.enc"`), empty if no file attached |
| `file_iv` | `string` | Base64 IV used to encrypt the file, empty if no file |
| `file_mime` | `string` | Original MIME type (e.g. `"application/pdf"`), empty if no file |

### CSP Requirement

The `connect-src` CSP directive must allow `https://*.r2.cloudflarestorage.com` so the browser can `fetch()` directly to R2 presigned URLs.

---

## Change log

| Date       | Change |
|------------|--------|
| 2026-04-11 | Initial doc: `public.user_keys` + RLS (Crypto plan Phase 1 complete). |
| 2026-04-12 | Added `public.tasks` + `public.notes` tables + RLS (Task Manager F1.1). |
| 2026-04-12 | Clarified task encrypted blob field wording from `note` to `description` for task content naming consistency. |
| 2026-04-12 | Confirmed no SQL/DDL change required for quick-complete/reopen actions and completion-date display; all use existing encrypted fields (`is_completed`, `completed_at`) in task `data` blob. |
| 2026-06-23 | Added `public.expenses` table + RLS + `expenses` storage bucket (Expense Tracker feature). |
| 2026-07-07 | Added `public.educations` + `public.certificates` tables + RLS + `certificates` storage bucket (Education feature). |
| 2026-07-08 | Schema doc brought up to date: documented all 3 previously undocumented tables and the certificates bucket. |
| 2026-07-13 | Renamed `public.certificates` to `public.documents` for Global Document Store. Added `public.medical_records` table + RLS (Medical Records feature). |
| 2026-07-15 | Added `public.media` + `public.media_collections` tables + RLS (Media Tracker feature). |
| 2026-07-23 | Added `recovery_salt`, `recovery_iv`, `recovery_wrapped_dek` nullable columns to `public.user_keys` (Recovery Key feature). |
