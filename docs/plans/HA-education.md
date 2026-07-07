# Human Actions: Education Domain

**Paired with**: [PLAN-education.md](./PLAN-education.md)
**Date**: 2026-07-07

> These are actions that CANNOT be automated by the agent and MUST be performed manually by the human, in the correct sequence relative to the implementation phases.

---

## Action Index

| # | Action | When | Where | Blocking? |
|---|--------|------|-------|-----------|
| 1 | Create Supabase Tables | Before Phase 1 | Supabase Dashboard / SQL Editor | Yes |
| 2 | Create Supabase Bucket | Before Phase 1 | Supabase Storage Dashboard | Yes |

---

## Detailed Actions

### HA-01 — Create Supabase Tables
- **When**: Before beginning implementation (Phase 1).
- **Where**: Supabase SQL Editor.
- **What**: Create the `educations` and `certificates` tables with RLS policies.
- **How**:
  1. Open the Supabase dashboard and go to the SQL Editor.
  2. Execute the following SQL to create the tables:
```sql
CREATE TABLE public.educations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    iv text NOT NULL,
    data text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.certificates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    iv text NOT NULL,
    data text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.educations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own educations" ON public.educations
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own certificates" ON public.certificates
    FOR ALL USING (auth.uid() = user_id);
```
- **Why this can't be automated**: The agent does not have direct database connection strings or dashboard access.
- **Blocking**: Yes. The agent cannot proceed with testing the APIs until the tables exist.

### HA-02 — Create Supabase Bucket
- **When**: Before beginning implementation (Phase 1).
- **Where**: Supabase Storage Dashboard.
- **What**: Create the `certificates` bucket for encrypted file storage.
- **How**:
  1. Go to Storage in your Supabase dashboard.
  2. Click "New bucket".
  3. Name the bucket `certificates`.
  4. Ensure it is **private** (not public).
  5. Go to Storage Policies and create an RLS policy for the `certificates` bucket allowing users to insert, select, update, and delete where `bucket_id = 'certificates'` AND `auth.uid() = owner` (or however your expense bucket is configured).
- **Why this can't be automated**: The agent lacks dashboard access to provision storage buckets.
- **Blocking**: Yes. File uploads will fail without the bucket.
