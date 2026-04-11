# Personal Tracker — Database Schema

> Canonical record of Supabase tables, columns, and RLS.  
> **Companion docs:** [`context.md`](./context.md) (app stack and conventions), [`PLAN-crypto.md`](./PLAN-crypto.md) (crypto/KMS rollout).

Update this file whenever you add or change tables, columns, indexes, or policies in Supabase (Dashboard SQL or migrations).

---

## Schema overview

| Schema  | Object        | Purpose |
|---------|---------------|---------|
| `public` | `user_keys`   | Per-user wrapped DEK (client-side envelope encryption). |

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

## Planned (not applied yet)

From [`PLAN-crypto.md`](./PLAN-crypto.md) Phase 7 — encrypted feature tables will follow this shape when built:

```sql
-- Example only; do not run until that feature ships.
CREATE TABLE public.expenses (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    iv         TEXT NOT NULL,
    data       TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

RLS for those tables should follow the same pattern: `USING` / `WITH CHECK` on `auth.uid() = user_id` (or stricter per table).

---

## Change log

| Date       | Change |
|------------|--------|
| 2026-04-11 | Initial doc: `public.user_keys` + RLS (Crypto plan Phase 1 complete). |
