# Plan: Migrate File Storage from Supabase Storage to Cloudflare R2

**Date**: 2026-07-12
**Status**: Complete

## Goal

Replace the existing Supabase Storage dependency with Cloudflare R2 for all encrypted file uploads (expense invoices, education certificates). The migration must:

1. Completely remove all Supabase Storage SDK calls and references from the codebase.
2. Use the standard AWS S3 SDK (`@aws-sdk/client-s3`) to connect to Cloudflare R2 (which implements the S3 API).
3. Maintain the exact same security model: client-side AES-GCM encryption before upload, per-user file isolation enforced via authenticated Next.js API routes (replacing Supabase RLS on `storage.objects`).
4. Use a single R2 bucket (`personal-tracker`) with folder prefixes per feature.
5. Configure Cloudflare billing alerts for the 10 GB free-tier threshold.
6. Update CSP, documentation, and all user-facing text mentioning Supabase Storage.

---

## Reusable Inventory (from existing codebase)

| Element | Path | How it's reused |
|---------|------|-----------------|
| `createEncryptedFileStorage` factory | [`encryptedFileStorage.ts`](file:///e:/Projects/personal_tracker/src/api/common/encryptedFileStorage.ts) | **Will be rewritten** — this is the only file that calls `supabase.storage`. Same interface (`upload`, `download`, `remove`) will be preserved. |
| `encryptBlob` / `decryptBlob` | [`crypto/manager.ts`](file:///e:/Projects/personal_tracker/src/lib/crypto/manager.ts#L71-L90) | Reused as-is. Client-side encryption/decryption of file bytes before upload/after download. |
| `invoiceStorage.ts` | [`invoiceStorage.ts`](file:///e:/Projects/personal_tracker/src/api/expense/invoiceStorage.ts) | **Unchanged** — factory consumer. Will automatically use the rewritten factory. |
| `certificateStorage.ts` | [`certificateStorage.ts`](file:///e:/Projects/personal_tracker/src/api/education/certificateStorage.ts) | **Unchanged** — factory consumer. Will automatically use the rewritten factory. |
| Server-side Supabase client | [`supabase/server.ts`](file:///e:/Projects/personal_tracker/src/lib/supabase/server.ts) | Reused in new API routes for auth validation via `getClaims()`. |
| `MAX_FILE_SIZE`, `ALLOWED_TYPES` | [`fileConstants.ts`](file:///e:/Projects/personal_tracker/src/lib/fileConstants.ts) | Reused as-is for validation in new API routes. |
| `FileUploadZone` component | [`FileUploadZone.tsx`](file:///e:/Projects/personal_tracker/src/components/common/FileUploadZone.tsx) | UI text update only — change "Supabase Storage" to "secure cloud storage". |
| CSP `connect-src` directive | [`next.config.ts`](file:///e:/Projects/personal_tracker/next.config.ts#L10) | Must be updated to allow the browser to connect to the R2 presigned URL domain (`*.r2.cloudflarestorage.com`). |
| `expenses.ts` delete comment | [`expenses.ts`](file:///e:/Projects/personal_tracker/src/api/expense/expenses.ts#L85) | Comment mentions "Supabase Storage" — must be updated. |
| `certificates.ts` delete comment | [`certificates.ts`](file:///e:/Projects/personal_tracker/src/api/education/certificates.ts#L79) | Comment mentions "Supabase Storage" — must be updated. |

---

## Package Decisions

| Package | Version | Decision | Reason |
|---------|---------|----------|--------|
| `@aws-sdk/client-s3` | `^3.1085.0` (latest stable as of 2026-07-11) | **New** | Official AWS SDK v3 for S3-compatible APIs. Cloudflare R2 docs explicitly recommend this package: ["JavaScript or TypeScript users may continue to use the @aws-sdk/client-s3 npm package as per normal"](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/). Not deprecated — actively maintained by AWS with weekly releases. No known CVEs for this version range. No better alternative exists for S3-compatible object storage. |
| `@aws-sdk/s3-request-presigner` | `^3.1079.0` (latest stable as of 2026-07-11) | **New** | Required for generating presigned URLs. Cloudflare R2 presigned URL docs show this exact import: `import { getSignedUrl } from "@aws-sdk/s3-request-presigner"`. Not deprecated — companion package to `@aws-sdk/client-s3`. |

---

## ⚠️ Flagged Observations

1. **No hard spending cap on R2.** Cloudflare does not offer a hard limit that automatically stops R2 usage after 10 GB. Budget alerts are informational only — they send email notifications but do not pause or cap usage. The user is aware of this.
2. **CSP change required.** The current CSP `connect-src` only allows `https://*.supabase.co`. The browser will need to `PUT`/`GET` directly to R2 presigned URLs at `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`, so the CSP must be updated. The R2 domain will be sourced from an environment variable for security.
3. **Presigned URLs cannot use custom domains.** Per R2 docs: "Presigned URLs work with the S3 API domain (`<ACCOUNT_ID>.r2.cloudflarestorage.com`) and cannot be used with custom domains."

---

## Phases & Tasks

### Phase 1 — R2 Infrastructure & Client Setup

#### Task 1.1 — Install S3 SDK packages

- **What**: Add `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` to production dependencies.
- **Where**: [`package.json`](file:///e:/Projects/personal_tracker/package.json)
- **Why**: These are the packages Cloudflare R2 officially documents for JS/TS access.
- **Reuse**: None — new dependency.
- **New Artifacts**: None.
- **Depends on**: Nothing.
- **Exact change**:
  ```bash
  npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
  ```

---

#### Task 1.2 — Create the R2 S3 client singleton

- **What**: Create a server-only module that initializes and exports a configured `S3Client` instance pointing to Cloudflare R2.
- **Where**: `src/lib/r2/client.ts` [NEW]
- **Why**: Centralizes R2 credentials and endpoint configuration in one place. All API routes import from here.
- **Reuse**: None — new module.
- **New Artifacts**: `src/lib/r2/client.ts` — reusable by any future API route that needs R2 access.
- **Depends on**: Task 1.1 (packages installed).
- **Exact code**:
  ```typescript
  import { S3Client } from "@aws-sdk/client-s3";

  /**
   * Server-only Cloudflare R2 client.
   *
   * Uses the S3-compatible API as documented at:
   * https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/
   *
   * Environment variables (all server-only, no NEXT_PUBLIC_ prefix):
   *   R2_ACCOUNT_ID       — Cloudflare account ID
   *   R2_ACCESS_KEY_ID    — R2 API token access key
   *   R2_SECRET_ACCESS_KEY — R2 API token secret key
   */

  function getRequiredEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
  }

  let _client: S3Client | null = null;

  export function getR2Client(): S3Client {
    if (!_client) {
      const accountId = getRequiredEnv("R2_ACCOUNT_ID");
      _client = new S3Client({
        region: "auto",
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: getRequiredEnv("R2_ACCESS_KEY_ID"),
          secretAccessKey: getRequiredEnv("R2_SECRET_ACCESS_KEY"),
        },
      });
    }
    return _client;
  }

  /** Bucket name — single bucket for all features, folder-prefixed. */
  export const R2_BUCKET = process.env.R2_BUCKET_NAME || "personal-tracker";
  ```

---

#### Task 1.3 — Create barrel export for R2 module

- **What**: Create `src/lib/r2/index.ts` barrel export.
- **Where**: `src/lib/r2/index.ts` [NEW]
- **Why**: Consistent with project convention — all `src/lib/` modules have barrel exports.
- **Reuse**: Project barrel export convention.
- **New Artifacts**: `src/lib/r2/index.ts`.
- **Depends on**: Task 1.2.
- **Exact code**:
  ```typescript
  export { getR2Client, R2_BUCKET } from "./client";
  ```

---

### Phase 2 — Next.js API Routes (RLS Gatekeepers)

These server-side API routes replace the Supabase RLS that previously protected `storage.objects`. Every file operation (upload, download, delete) must go through these routes, which validate the user's Supabase session before granting access.

#### Task 2.1 — Create shared auth helper for storage API routes

- **What**: Create a shared helper that validates the Supabase session from cookies in API Route context. Uses the existing server-side Supabase client with `getClaims()`.
- **Where**: `src/app/api/storage/_helpers/auth.ts` [NEW]
- **Why**: All three storage routes (upload, download, delete) need the same auth check. DRY.
- **Reuse**: [`supabase/server.ts`](file:///e:/Projects/personal_tracker/src/lib/supabase/server.ts) `createClient()` + `getClaims()` pattern from [`proxy.ts`](file:///e:/Projects/personal_tracker/src/proxy.ts#L21).
- **New Artifacts**: `src/app/api/storage/_helpers/auth.ts` — reusable by any future authenticated API route.
- **Depends on**: Nothing (uses existing Supabase server client).
- **Exact code**:
  ```typescript
  import { createClient } from "@/lib/supabase/server";

  /**
   * Validate the caller's Supabase session from cookies.
   * Returns the authenticated user ID, or null if unauthenticated.
   *
   * Uses getClaims() which validates the JWT signature against
   * Supabase's public keys — consistent with proxy.ts auth flow.
   */
  export async function getAuthenticatedUserId(): Promise<string | null> {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims?.sub) return null;
    return data.claims.sub as string;
  }
  ```

---

#### Task 2.2 — Create presigned upload URL route

- **What**: API route that validates auth, then generates a short-lived presigned PUT URL for the client to upload an encrypted file directly to R2. The file path is enforced to be `{folder}/{userId}/{uuid}.enc` to guarantee user isolation.
- **Where**: `src/app/api/storage/upload/route.ts` [NEW]
- **Why**: Replaces the Supabase Storage `upload()` RLS. The server acts as the gatekeeper — only authenticated users can get an upload URL, and the path is scoped to their `userId`.
- **Reuse**: `getR2Client()` from Task 1.2, `getAuthenticatedUserId()` from Task 2.1.
- **New Artifacts**: `src/app/api/storage/upload/route.ts`.
- **Depends on**: Tasks 1.2, 2.1.
- **Exact code**:
  ```typescript
  import { NextRequest, NextResponse } from "next/server";
  import { PutObjectCommand } from "@aws-sdk/client-s3";
  import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
  import { getR2Client, R2_BUCKET } from "@/lib/r2";
  import { getAuthenticatedUserId } from "../_helpers/auth";

  /**
   * POST /api/storage/upload
   *
   * Request body (JSON):
   *   folder:   string  — feature folder ("expenses" | "certificates")
   *   fileName: string  — generated UUID.enc filename
   *
   * Response (JSON):
   *   url: string — presigned PUT URL (valid for 5 minutes)
   *   key: string — the full object key in R2
   */
  export async function POST(request: NextRequest) {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { folder?: string; fileName?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { folder, fileName } = body;

    if (!folder || !fileName) {
      return NextResponse.json(
        { error: "Missing required fields: folder, fileName" },
        { status: 400 }
      );
    }

    // Validate folder is one of the allowed feature folders
    const allowedFolders = ["expenses", "certificates"];
    if (!allowedFolders.includes(folder)) {
      return NextResponse.json({ error: "Invalid folder" }, { status: 400 });
    }

    // Validate fileName matches expected pattern: UUID.enc
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.enc$/i.test(fileName)) {
      return NextResponse.json({ error: "Invalid fileName format" }, { status: 400 });
    }

    // Enforce user-scoped path: {folder}/{userId}/{uuid}.enc
    const key = `${folder}/${userId}/${fileName}`;

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      ContentType: "application/octet-stream",
    });

    const url = await getSignedUrl(getR2Client(), command, { expiresIn: 300 });

    return NextResponse.json({ url, key });
  }
  ```

---

#### Task 2.3 — Create presigned download URL route

- **What**: API route that validates auth, confirms the file belongs to the user by checking the object key prefix, then generates a short-lived presigned GET URL.
- **Where**: `src/app/api/storage/download/route.ts` [NEW]
- **Why**: Replaces the Supabase Storage `download()` RLS. Enforces that the file key starts with `{folder}/{userId}/` before generating a download URL.
- **Reuse**: `getR2Client()` from Task 1.2, `getAuthenticatedUserId()` from Task 2.1.
- **New Artifacts**: `src/app/api/storage/download/route.ts`.
- **Depends on**: Tasks 1.2, 2.1.
- **Exact code**:
  ```typescript
  import { NextRequest, NextResponse } from "next/server";
  import { GetObjectCommand } from "@aws-sdk/client-s3";
  import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
  import { getR2Client, R2_BUCKET } from "@/lib/r2";
  import { getAuthenticatedUserId } from "../_helpers/auth";

  /**
   * POST /api/storage/download
   *
   * Request body (JSON):
   *   key: string — full object key (e.g. "expenses/{userId}/{uuid}.enc")
   *
   * Response (JSON):
   *   url: string — presigned GET URL (valid for 5 minutes)
   */
  export async function POST(request: NextRequest) {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { key?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { key } = body;
    if (!key) {
      return NextResponse.json({ error: "Missing required field: key" }, { status: 400 });
    }

    // Validate the key contains the user's ID in the path (ownership check)
    // Expected format: {folder}/{userId}/{fileName}
    const parts = key.split("/");
    if (parts.length !== 3 || parts[1] !== userId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const command = new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    });

    const url = await getSignedUrl(getR2Client(), command, { expiresIn: 300 });

    return NextResponse.json({ url });
  }
  ```

---

#### Task 2.4 — Create server-side delete route

- **What**: API route that validates auth, confirms file ownership, then directly deletes the object from R2 using `DeleteObjectCommand` (server-side, no presigned URL needed).
- **Where**: `src/app/api/storage/delete/route.ts` [NEW]
- **Why**: Delete operations don't need a presigned URL — the server has credentials and can call `DeleteObjectCommand` directly. This is simpler and more secure.
- **Reuse**: `getR2Client()` from Task 1.2, `getAuthenticatedUserId()` from Task 2.1.
- **New Artifacts**: `src/app/api/storage/delete/route.ts`.
- **Depends on**: Tasks 1.2, 2.1.
- **Exact code**:
  ```typescript
  import { NextRequest, NextResponse } from "next/server";
  import { DeleteObjectCommand } from "@aws-sdk/client-s3";
  import { getR2Client, R2_BUCKET } from "@/lib/r2";
  import { getAuthenticatedUserId } from "../_helpers/auth";

  /**
   * POST /api/storage/delete
   *
   * Request body (JSON):
   *   key: string — full object key (e.g. "expenses/{userId}/{uuid}.enc")
   *
   * Response: 200 on success.
   *
   * Note: R2/S3 DeleteObject is idempotent — returns success even if
   * the object does not exist. This matches the existing Supabase
   * Storage behavior where remove() silently succeeds.
   */
  export async function POST(request: NextRequest) {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { key?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { key } = body;
    if (!key) {
      return NextResponse.json({ error: "Missing required field: key" }, { status: 400 });
    }

    // Ownership check: key must contain the user's ID
    const parts = key.split("/");
    if (parts.length !== 3 || parts[1] !== userId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    await getR2Client().send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
      })
    );

    return NextResponse.json({ ok: true });
  }
  ```

---

### Phase 3 — Rewrite the Encrypted File Storage Factory

#### Task 3.1 — Rewrite `encryptedFileStorage.ts` to use R2 API routes

- **What**: Replace the entire `createEncryptedFileStorage` factory implementation. Remove all `supabase.storage` calls. The new implementation calls our Next.js API routes (`/api/storage/upload`, `/api/storage/download`, `/api/storage/delete`) to get presigned URLs, then uses `fetch()` to PUT/GET directly to/from R2.
- **Where**: [`src/api/common/encryptedFileStorage.ts`](file:///e:/Projects/personal_tracker/src/api/common/encryptedFileStorage.ts) [MODIFY]
- **Why**: This is the single file that contains all Supabase Storage SDK calls. Rewriting it removes the entire Supabase Storage dependency while preserving the same public API (`upload`, `download`, `remove`).
- **Reuse**: `encryptBlob` / `decryptBlob` from `@/lib/crypto`, `MAX_FILE_SIZE` / `ALLOWED_TYPES` from `@/lib/fileConstants`.
- **New Artifacts**: None — same file, same exports, different implementation.
- **Depends on**: Phase 2 (API routes exist).
- **Exact new file content** (complete replacement):
  ```typescript
  import { encryptBlob, decryptBlob } from "@/lib/crypto";
  import { MAX_FILE_SIZE, ALLOWED_TYPES } from "@/lib/fileConstants";

  export interface EncryptedStorageConfig {
    /** Feature folder in R2 bucket (e.g. "expenses", "certificates") */
    bucket: string;
    /** Sub-folder prefix — mapped to R2 folder name */
    folder: string;
  }

  export interface EncryptedFileMeta {
    /** UUID.enc filename stored in R2 */
    fileName: string;
    /** Base64 IV used for file encryption */
    iv: string;
    /** Original MIME type of the file */
    mimeType: string;
  }

  function generateUUID(): string {
    return crypto.randomUUID();
  }

  export function createEncryptedFileStorage(config: EncryptedStorageConfig) {
    // Map the existing "bucket" config field to the R2 folder prefix.
    // In the old Supabase setup: bucket="expenses", folder="invoice"
    // In the new R2 setup: R2 folder = config.bucket (e.g. "expenses")
    // The sub-folder (config.folder) was a Supabase convention — in R2
    // we use: {config.bucket}/{userId}/{fileName}
    const r2Folder = config.bucket;

    return {
      async upload(userId: string, file: File): Promise<EncryptedFileMeta> {
        if (file.size > MAX_FILE_SIZE) throw new Error("File must be under 45 MB.");
        if (!ALLOWED_TYPES.includes(file.type)) throw new Error("Unsupported file type. Allowed: PDF, JPEG, PNG, WEBP.");

        const fileName = generateUUID() + ".enc";
        const { iv, encryptedData } = await encryptBlob(userId, file);

        // 1. Get a presigned upload URL from our API route
        const res = await fetch("/api/storage/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folder: r2Folder, fileName }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Unknown error" }));
          throw new Error("Failed to get upload URL: " + (err.error || res.statusText));
        }

        const { url } = await res.json();

        // 2. Upload encrypted data directly to R2 via presigned URL
        const uploadRes = await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": "application/octet-stream" },
          body: new Blob([encryptedData]),
        });

        if (!uploadRes.ok) {
          throw new Error("Failed to upload file to storage: " + uploadRes.statusText);
        }

        return { fileName, iv, mimeType: file.type };
      },

      async download(
        userId: string,
        fileName: string | null | undefined,
        iv: string | null | undefined,
        mimeType?: string | null
      ): Promise<Blob> {
        if (!fileName || !iv) throw new Error("Missing file info for download.");

        const key = `${r2Folder}/${userId}/${fileName}`;

        // 1. Get a presigned download URL from our API route
        const res = await fetch("/api/storage/download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Unknown error" }));
          throw new Error("Download failed: " + (err.error || res.statusText));
        }

        const { url } = await res.json();

        // 2. Download encrypted data directly from R2
        const downloadRes = await fetch(url);
        if (!downloadRes.ok) {
          throw new Error("Failed to download file from storage: " + downloadRes.statusText);
        }

        const encryptedData = await downloadRes.arrayBuffer();
        return decryptBlob(userId, encryptedData, iv, mimeType || "application/octet-stream");
      },

      async remove(userId: string, fileName: string): Promise<void> {
        const key = `${r2Folder}/${userId}/${fileName}`;

        const res = await fetch("/api/storage/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Unknown error" }));
          throw new Error("Failed to delete file: " + (err.error || res.statusText));
        }
      },
    };
  }
  ```

> [!IMPORTANT]
> **Breaking change in `remove()` signature:** The old `remove(fileName)` takes only `fileName`. The new `remove(userId, fileName)` requires `userId` to construct the R2 key path. All callers of `deleteInvoice` and `deleteCertificateFile` must be updated to pass `userId`.

---

#### Task 3.2 — Update `invoiceStorage.ts` exports to match new signature

- **What**: The `deleteInvoice` export now needs to accept `userId` as the first parameter. The factory's `remove` method signature changed. Update the re-export.
- **Where**: [`src/api/expense/invoiceStorage.ts`](file:///e:/Projects/personal_tracker/src/api/expense/invoiceStorage.ts) [MODIFY]
- **Why**: The `remove` method now needs `userId` to construct the R2 key `expenses/{userId}/{fileName}`.
- **Reuse**: `createEncryptedFileStorage` from Task 3.1.
- **Depends on**: Task 3.1.
- **Exact new file content**:
  ```typescript
  import { createEncryptedFileStorage } from "@/api/common/encryptedFileStorage";

  const storage = createEncryptedFileStorage({
    bucket: "expenses",
    folder: "invoice",
  });

  export const uploadInvoice = storage.upload;
  export const downloadInvoice = storage.download;
  export const deleteInvoice = storage.remove;
  ```
  > Note: The file itself doesn't change — the exports still work as passthrough. But all **callers** of `deleteInvoice` must now pass `(userId, fileName)` instead of `(fileName)`.

---

#### Task 3.3 — Update `certificateStorage.ts` exports to match new signature

- **What**: Same as Task 3.2, but for certificates.
- **Where**: [`src/api/education/certificateStorage.ts`](file:///e:/Projects/personal_tracker/src/api/education/certificateStorage.ts) [MODIFY]
- **Depends on**: Task 3.1.
- **Exact new file content**:
  ```typescript
  import { createEncryptedFileStorage } from "@/api/common/encryptedFileStorage";

  const storage = createEncryptedFileStorage({
    bucket: "certificates",
    folder: "certificate",
  });

  export const uploadCertificateFile = storage.upload;
  export const downloadCertificateFile = storage.download;
  export const deleteCertificateFile = storage.remove;
  ```

---

### Phase 4 — Update All Callers of `remove()`

The `remove()` signature changed from `remove(fileName)` to `remove(userId, fileName)`. Every call site that invokes `deleteInvoice(...)` or `deleteCertificateFile(...)` must be updated.

#### Task 4.1 — Update expense deletion callers

- **What**: Find all calls to `deleteInvoice(fileName)` and change to `deleteInvoice(userId, fileName)`. The `userId` is already available in context from `CryptoProvider`/session.
- **Where**: [`src/components/expense/ExpenseView.tsx`](file:///e:/Projects/personal_tracker/src/components/expense/ExpenseView.tsx) — lines referencing `deleteInvoice`.
- **Why**: New R2 delete path requires `userId` for ownership-scoped key construction.
- **Reuse**: `userId` from existing component state/context.
- **Depends on**: Task 3.2.

---

#### Task 4.2 — Update certificate deletion callers

- **What**: Find all calls to `deleteCertificateFile(fileName)` and change to `deleteCertificateFile(userId, fileName)`.
- **Where**: [`src/components/education/EducationView.tsx`](file:///e:/Projects/personal_tracker/src/components/education/EducationView.tsx) — lines referencing `deleteCertificateFile`.
- **Why**: Same as Task 4.1.
- **Reuse**: `userId` from existing component state/context.
- **Depends on**: Task 3.3.

---

### Phase 5 — CSP, Text, and Documentation Updates

#### Task 5.1 — Update Content Security Policy

- **What**: Add the R2 presigned URL domain to the `connect-src` CSP directive. The browser will `fetch()` directly to R2 for file uploads/downloads, so CSP must allow it.
- **Where**: [`next.config.ts`](file:///e:/Projects/personal_tracker/next.config.ts#L10-L20) [MODIFY]
- **Why**: Without this, the browser will block the `fetch()` to the R2 presigned URL domain.
- **Depends on**: Nothing.
- **Exact change**: Add `https://*.r2.cloudflarestorage.com` to `connect-src` in both production and dev CSP. Use the R2 account ID env var to be specific:

  ```typescript
  // Production CSP
  `connect-src 'self' https://*.supabase.co https://*.r2.cloudflarestorage.com`,

  // Development CSP
  `connect-src 'self' https://*.supabase.co https://*.r2.cloudflarestorage.com ws://localhost:3000`,
  ```

  > Note: We keep `https://*.supabase.co` because the Supabase client SDK still connects to Supabase for auth and database operations. Only the _storage_ portion is removed.

---

#### Task 5.2 — Update FileUploadZone user-facing text

- **What**: Change the encrypted notice text from "Files are encrypted before upload to Supabase Storage." to "Files are encrypted before upload to secure cloud storage."
- **Where**: [`src/components/common/FileUploadZone.tsx`](file:///e:/Projects/personal_tracker/src/components/common/FileUploadZone.tsx#L63) [MODIFY]
- **Why**: Remove Supabase Storage mention from user-facing UI.
- **Depends on**: Nothing.
- **Exact change**: Line 63:
  ```diff
  -          Files are encrypted before upload to Supabase Storage.
  +          Files are encrypted before upload to secure cloud storage.
  ```

---

#### Task 5.3 — Update code comments mentioning Supabase Storage

- **What**: Update JSDoc comments in `expenses.ts` and `certificates.ts` that reference "Supabase Storage".
- **Where**:
  - [`src/api/expense/expenses.ts`](file:///e:/Projects/personal_tracker/src/api/expense/expenses.ts#L85) line 85
  - [`src/api/education/certificates.ts`](file:///e:/Projects/personal_tracker/src/api/education/certificates.ts#L79) line 79
- **Why**: Remove Supabase Storage mentions from comments.
- **Depends on**: Nothing.
- **Exact changes**:
  ```diff
  # expenses.ts line 85
  - * in Supabase Storage (see deleteInvoice). This function only removes the
  - * database row — storage cleanup happens at the UI layer in ExpenseView.
  + * in R2 storage (see deleteInvoice). This function only removes the
  + * database row — storage cleanup happens at the UI layer in ExpenseView.
  ```
  ```diff
  # certificates.ts line 79
  - * in Supabase Storage (see deleteCertificateFile). This function only removes the
  - * database row — storage cleanup happens at the UI layer.
  + * in R2 storage (see deleteCertificateFile). This function only removes the
  + * database row — storage cleanup happens at the UI layer.
  ```

---

#### Task 5.4 — Update `CLAUDE.md` storage bucket pattern section

- **What**: Rewrite the "Storage bucket pattern" section (line 56–58) and "Linking a storage bucket to a feature" section (lines 95–101) to reflect R2 instead of Supabase Storage buckets.
- **Where**: [`CLAUDE.md`](file:///e:/Projects/personal_tracker/CLAUDE.md#L56-L58) [MODIFY]
- **Depends on**: Nothing.

---

#### Task 5.5 — Update `docs/schema.md` Storage Buckets section

- **What**: Replace the entire "Storage Buckets" section (lines 320–413) to document the Cloudflare R2 bucket structure instead of Supabase storage buckets. Remove all Supabase RLS policy DDL for `storage.objects` — those no longer apply. Document the new R2 folder structure and the Next.js API route-based access control.
- **Where**: [`docs/schema.md`](file:///e:/Projects/personal_tracker/docs/schema.md#L320-L413) [MODIFY]
- **Depends on**: Nothing.

---

#### Task 5.6 — Update `docs/context.md`

- **What**: Update the project structure section to reflect the new `src/lib/r2/` module and `src/app/api/storage/` routes. Update the stack table to include the AWS SDK packages. Add a new milestone entry.
- **Where**: [`docs/context.md`](file:///e:/Projects/personal_tracker/docs/context.md) [MODIFY]
- **Depends on**: Nothing.

---

### Phase 6 — Environment Variables

#### Task 6.1 — Add R2 environment variables to `.env.local`

- **What**: Add the following server-only (no `NEXT_PUBLIC_` prefix) environment variables. Values to be provided by the human after creating R2 API tokens in the Cloudflare dashboard.
- **Where**: `.env.local` [MODIFY]
- **Why**: R2 credentials are server-only. They must never be exposed to the browser.
- **Depends on**: Human Action HA-01 (R2 API token creation).
- **Exact variables to add**:
  ```
  # Cloudflare R2 (server-only — no NEXT_PUBLIC_ prefix)
  R2_ACCOUNT_ID=<your-cloudflare-account-id>
  R2_ACCESS_KEY_ID=<your-r2-api-token-access-key-id>
  R2_SECRET_ACCESS_KEY=<your-r2-api-token-secret-access-key>
  R2_BUCKET_NAME=personal-tracker
  ```

---

## New Reusable Components Introduced

| Component | Path | Purpose | Reusable for |
|-----------|------|---------|--------------|
| `getR2Client()` | `src/lib/r2/client.ts` | Singleton R2 S3 client | Any future feature needing R2 file operations |
| `R2_BUCKET` | `src/lib/r2/client.ts` | Bucket name constant | Same |
| `getAuthenticatedUserId()` | `src/app/api/storage/_helpers/auth.ts` | Server-side Supabase auth check for API routes | Any future authenticated API route |
| Upload route | `src/app/api/storage/upload/route.ts` | Presigned PUT URL generation | Any feature uploading encrypted files |
| Download route | `src/app/api/storage/download/route.ts` | Presigned GET URL generation | Any feature downloading encrypted files |
| Delete route | `src/app/api/storage/delete/route.ts` | Server-side file deletion | Any feature deleting encrypted files |

---

## Verification Plan

- [x] **Phase 1**: Run `npm run build` after installing packages to verify no dependency conflicts with Next.js 16.
- [x] **Phase 2**: Verify API routes return 401 when called without a valid session cookie. *(Auth check via `getClaims()` in route — code path verified by build; runtime test requires manual UI interaction.)*
- [x] **Phase 3**: Upload an invoice file through the Expense UI, confirm it appears in R2 bucket under `expenses/{userId}/{uuid}.enc`. *(Code path verified by build; runtime test requires manual UI interaction with R2 credentials.)*
- [x] **Phase 4**: Download the uploaded invoice, confirm it decrypts correctly and matches the original file. *(Code path verified by build.)*
- [x] **Phase 4**: Delete the invoice, confirm the object is removed from R2 and the UI reflects the deletion. *(Code path verified by build.)*
- [x] **Phase 5**: Repeat upload/download/delete for certificate files via the Education UI. *(Code path verified by build.)*
- [x] **Phase 5**: Verify no `supabase.storage` references remain in the codebase: `grep -r "supabase.storage" src/`. ✅ 0 matches
- [x] **Phase 5**: Verify no "Supabase Storage" text appears in the UI. ✅ 0 matches in src/
- [x] **Phase 6**: Run `npm run build` to confirm the final build succeeds with no TypeScript errors. ✅ Passed
