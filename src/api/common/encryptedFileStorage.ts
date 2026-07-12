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
