import { createClient } from "@/lib/supabase/client";
import { encryptBlob, decryptBlob } from "@/lib/crypto";
import { MAX_FILE_SIZE, ALLOWED_TYPES } from "@/lib/fileConstants";

export interface EncryptedStorageConfig {
  bucket: string;
  folder: string;
}

export interface EncryptedFileMeta {
  fileName: string;
  iv: string;
  mimeType: string;
}

function generateUUID(): string {
  return crypto.randomUUID();
}

export function createEncryptedFileStorage(config: EncryptedStorageConfig) {
  const { bucket, folder } = config;

  return {
    async upload(userId: string, file: File): Promise<EncryptedFileMeta> {
      if (file.size > MAX_FILE_SIZE) throw new Error("File must be under 45 MB.");
      if (!ALLOWED_TYPES.includes(file.type)) throw new Error("Unsupported file type. Allowed: PDF, JPEG, PNG, WEBP.");
      const fileName = generateUUID() + ".enc";
      const { iv, encryptedData } = await encryptBlob(userId, file);
      const supabase = createClient();
      const { error } = await supabase.storage.from(bucket).upload(folder + "/" + fileName, new Blob([encryptedData]), { contentType: "application/octet-stream", upsert: false });
      if (error) throw new Error("Failed to upload to " + folder + ": " + error.message);
      return { fileName, iv, mimeType: file.type };
    },
    async download(userId: string, fileName: string | null | undefined, iv: string | null | undefined, mimeType?: string | null): Promise<Blob> {
      if (!fileName || !iv) throw new Error("Missing file info for " + folder + ".");
      const supabase = createClient();
      const { data, error } = await supabase.storage.from(bucket).download(folder + "/" + fileName);
      if (error) { const msg = error instanceof Error ? error.message : JSON.stringify(error); throw new Error("Download failed for " + folder + ": " + msg); }
      if (!data) throw new Error(folder + " file not found.");
      const encryptedData = await data.arrayBuffer();
      return decryptBlob(userId, encryptedData, iv, mimeType || "application/octet-stream");
    },
    async remove(fileName: string): Promise<void> {
      const supabase = createClient();
      const { error } = await supabase.storage.from(bucket).remove([folder + "/" + fileName]);
      if (error) throw new Error("Failed to delete " + folder + " file: " + error.message);
    },
  };
}
