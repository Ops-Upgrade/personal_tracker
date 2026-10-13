import { encryptBlob, decryptBlob } from "@/lib/crypto";
import { MAX_FILE_SIZE, ALLOWED_TYPES } from "@/lib/fileConstants";

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

/**
 * Encrypted file pipeline against the unified `documents/` store.
 *
 * Every file lives at `documents/{userId}/{fileName}` in R2 — the API routes
 * construct that key server-side from the session, so callers only ever send
 * the generated `fileName` back.
 */

/** Encrypt and upload a file, returning the metadata to store in the parent record. */
export async function uploadFile(userId: string, file: File): Promise<EncryptedFileMeta> {
  if (file.size > MAX_FILE_SIZE) throw new Error("File must be under 45 MB.");
  if (!ALLOWED_TYPES.includes(file.type)) throw new Error("Unsupported file type. Allowed: PDF, JPEG, PNG, WEBP.");

  const fileName = generateUUID() + ".enc";
  const { iv, encryptedData } = await encryptBlob(userId, file);

  // 1. Get a presigned upload URL from our API route
  const res = await fetch("/api/storage/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName }),
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
}

/** Download and decrypt a file, returning the plaintext blob. */
export async function downloadFile(
  userId: string,
  fileName: string | null | undefined,
  iv: string | null | undefined,
  mimeType?: string | null
): Promise<Blob> {
  if (!fileName || !iv) throw new Error("Missing file info for download.");

  // 1. Get a presigned download URL from our API route
  const res = await fetch("/api/storage/download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName }),
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
}

/** Delete a file from R2 (idempotent — succeeds even if the object is absent). */
export async function deleteFile(_userId: string, fileName: string): Promise<void> {
  const res = await fetch("/api/storage/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error("Failed to delete file: " + (err.error || res.statusText));
  }
}
