# Human Actions: Migrate File Storage to Cloudflare R2

**Paired with**: [PLAN-r2-migration.md](./PLAN-r2-migration.md)
**Date**: 2026-07-12
**Status**: Implementation Complete — Awaiting Human Actions

> These are actions that CANNOT be automated by the agent and MUST be performed manually by the human, in the correct sequence relative to the implementation phases.

---

## Action Index

| # | Action | When | Where | Blocking? |
|---|--------|------|-------|-----------|
| 1 | Create R2 bucket in Cloudflare Dashboard | Before Phase 1 | Cloudflare Dashboard | Yes |
| 2 | Generate R2 API token (Access Key ID + Secret) | Before Phase 1 | Cloudflare Dashboard | Yes |
| 3 | Configure CORS policy on R2 bucket | Before Phase 3 (before first browser upload) | Cloudflare Dashboard | Yes |
| 4 | Set up Cloudflare Budget Alert for R2 spend | After Phase 6 (non-blocking) | Cloudflare Dashboard | No |
| 5 | Add R2 environment variables to Vercel (production) | Before production deployment | Vercel Dashboard | Yes |
| 6 | Remove Supabase Storage buckets and RLS policies (cleanup) | After migration is verified | Supabase Dashboard | No |

---

## Detailed Actions

### HA-01 — Create R2 Bucket in Cloudflare Dashboard

- **When**: Before Phase 1
- **Where**: Cloudflare Dashboard → R2 Object Storage
- **What**: Create a single private R2 bucket named `personal-tracker`.
- **How**:
  1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/).
  2. Navigate to **R2 Object Storage** in the sidebar.
  3. Click **Create bucket**.
  4. Set **Bucket name** to `personal-tracker`.
  5. Choose **Automatic** for location (or your preferred region).
  6. Click **Create bucket**.
- **Why this can't be automated**: Requires Cloudflare Dashboard access with billing-enabled account. Bucket creation is a one-time infrastructure provisioning step.
- **Blocking**: Yes — the agent cannot test uploads/downloads without a bucket.

---

### HA-02 — Generate R2 API Token

- **When**: Before Phase 1
- **Where**: Cloudflare Dashboard → **R2 Object Storage** (sidebar) → Manage R2 API Tokens
- **What**: Create an API token with read/write access scoped to the `personal-tracker` bucket. This generates the `Access Key ID` and `Secret Access Key` needed by the S3 SDK.
  
  > ⚠️ **CRITICAL WARNING** ⚠️ 
  > Do NOT go to "My Profile" -> "API Tokens". That creates a general Cloudflare API token (which starts with `cfat_` and uses Bearer auth). You must create an **R2 API Token** specifically from the R2 Object Storage page. The AWS SDK expects an Access Key ID and a Secret Access Key, not a Bearer token.

- **How**:
  1. In the Cloudflare Dashboard, go to **R2 Object Storage** (in the left sidebar).
  2. On the right side of the page, under **Account Details**, click **Manage R2 API Tokens**.
  3. Click **Create API token**.
  4. Set **Token name** to `personal-tracker-server`.
  5. Under **Permissions**, select **Object Read & Write**.
  6. Under **Specify bucket(s)**, select **Apply to specific buckets only** → choose `personal-tracker`.
  7. Leave **TTL** as default (no expiry) unless you prefer rotation.
  8. Click **Create API Token**.
  9. **Copy the `Access Key ID` and `Secret Access Key`** — the secret is shown only once.
  10. Also note your **Cloudflare Account ID** from the right sidebar of the R2 overview page.
  11. Add these values to `.env.local`:
     ```
     R2_ACCOUNT_ID=<your-account-id>
     R2_ACCESS_KEY_ID=<access-key-id-from-step-9>
     R2_SECRET_ACCESS_KEY=<secret-access-key-from-step-9>
     R2_BUCKET_NAME=personal-tracker
     ```
- **Why this can't be automated**: Requires Cloudflare Dashboard access. API token secrets are shown only once during creation.
- **Blocking**: Yes — R2 client cannot authenticate without these credentials.

---

### HA-03 — Configure CORS Policy on R2 Bucket

- **When**: Before Phase 3 (before the first browser upload/download test)
- **Where**: Cloudflare Dashboard → R2 → `personal-tracker` bucket → Settings
- **What**: Add a CORS policy that allows the browser to PUT (upload) and GET (download) encrypted files using presigned URLs. Without this, browser-based `fetch()` to the R2 domain will be blocked by CORS.
- **How**:
  1. In the Cloudflare Dashboard, go to **R2 Object Storage**.
  2. Click the `personal-tracker` bucket.
  3. Go to the **Settings** tab.
  4. Under **CORS Policy**, click **Add CORS policy**.
  5. Switch to the **JSON** tab and paste the following policy:
     ```json
     [
       {
         "AllowedOrigins": [
           "http://localhost:3000",
           "https://ops-upgrade.com",
           "https://*.ops-upgrade.com"
         ],
         "AllowedMethods": ["GET", "PUT", "HEAD"],
         "AllowedHeaders": ["Content-Type"],
         "ExposeHeaders": ["ETag"],
         "MaxAgeSeconds": 3600
       }
     ]
     ```
  6. Click **Save**.
- **Why this can't be automated**: Requires Cloudflare Dashboard access. CORS policies are configured on the bucket settings page.
- **Blocking**: Yes — browser uploads and downloads will fail with CORS errors without this policy.

---

### HA-04 — Set Up Cloudflare Budget Alert

- **When**: After Phase 6 (can be done any time, non-blocking)
- **Where**: Cloudflare Dashboard → Manage Account → Billing → Billable Usage
- **What**: Create a budget alert to receive email notifications when R2 spend approaches the free-tier limit. Since R2 charges $0.015/GB-month for standard storage, 10 GB costs $0.15/month. Setting a budget alert at $0.01 (just above zero) will notify you before any charges start.
- **How**:
  1. In the Cloudflare Dashboard, click **Manage Account** (bottom-left sidebar).
  2. Go to **Billing** → **Billable Usage**.
  3. Click **Create budget alert** (or **Set Budget Alert**).
  4. Set **Name** to `R2 Storage Free Tier Alert`.
  5. Set **Budget threshold** to `$0.01` (this will trigger at the moment any paid usage begins, i.e., you've exceeded the 10 GB free tier).
  6. Add your email address as the notification recipient.
  7. Click **Save**.
- **Why this can't be automated**: Requires Cloudflare Dashboard access with billing permissions.
- **Blocking**: No — the application functions without this, it's a cost protection measure.

---

### HA-05 — Add R2 Environment Variables to Vercel (Production)

- **When**: Before deploying to production
- **Where**: Vercel Dashboard → Project Settings → Environment Variables
- **What**: Add the same R2 environment variables used in `.env.local` to Vercel for the production deployment.
- **How**:
  1. Go to [Vercel Dashboard](https://vercel.com/dashboard).
  2. Open your `personal_tracker` project.
  3. Go to **Settings** → **Environment Variables**.
  4. Add the following variables for **Production** (and **Preview** if desired):
     | Name | Value | Environment |
     |------|-------|-------------|
     | `R2_ACCOUNT_ID` | `<your-cloudflare-account-id>` | Production |
     | `R2_ACCESS_KEY_ID` | `<your-r2-access-key-id>` | Production |
     | `R2_SECRET_ACCESS_KEY` | `<your-r2-secret-access-key>` | Production |
     | `R2_BUCKET_NAME` | `personal-tracker` | Production |
  5. Click **Save** for each variable.
  6. Redeploy the application for the variables to take effect.
- **Why this can't be automated**: Requires Vercel Dashboard access with project admin permissions.
- **Blocking**: Yes — production deployment will fail to connect to R2 without these.

---

### HA-06 — Remove Supabase Storage Buckets and RLS Policies (Cleanup)

- **When**: After the R2 migration is fully verified and working
- **Where**: Supabase Dashboard → Storage & SQL Editor
- **What**: Remove the now-unused `expenses` and `certificates` storage buckets and their RLS policies from Supabase.
- **How**:
  1. Log in to your Supabase Dashboard.
  2. **Migrate existing files first** (if any): Download any existing encrypted files from the Supabase `expenses` and `certificates` buckets and re-upload them to R2 (manually or via a migration script).
  3. Go to **Storage** → delete all objects in the `expenses` bucket → delete the bucket.
  4. Repeat for the `certificates` bucket.
  5. Go to **SQL Editor** and run:
     ```sql
     -- Remove storage RLS policies
     DROP POLICY IF EXISTS "Users upload their own invoices" ON storage.objects;
     DROP POLICY IF EXISTS "Users read their own invoices" ON storage.objects;
     DROP POLICY IF EXISTS "Users delete their own invoices" ON storage.objects;
     DROP POLICY IF EXISTS "Users update their own invoices" ON storage.objects;
     -- Repeat for any certificate-specific policies
     ```
- **Why this can't be automated**: Requires Supabase Dashboard access. Data migration of existing files may be needed.
- **Blocking**: No — can be done after the migration is verified.
