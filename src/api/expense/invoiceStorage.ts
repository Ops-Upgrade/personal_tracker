import { createClient } from "@/lib/supabase/client";
import { encryptBlob, decryptBlob } from "@/lib/crypto";

// --- Constants ---

const BUCKET = "expenses";
const FOLDER = "invoice";
const MAX_FILE_SIZE = 45 * 1024 * 1024; // 45 MiB
const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

// --- Helpers ---

function generateUUID(): string {
  return crypto.randomUUID();
}

// --- Public API ---

/**
 * Validate, encrypt, and upload an invoice file to Supabase Storage.
 * Returns metadata needed to store in the encrypted expense blob.
 */
export async function uploadInvoice(
  userId: string,
  file: File
): Promise<{ fileName: string; iv: string; mimeType: string }> {
  // 1. Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File must be under 45 MB.");
  }

  // 2. Validate file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(
      "Unsupported file type. Allowed: PDF, JPEG, PNG, WEBP."
    );
  }

  // 3. Generate a UUID filename with .enc extension
  const fileName = `${generateUUID()}.enc`;

  // 4. Client-side encrypt the file using the user's DEK
  const { iv, encryptedData } = await encryptBlob(userId, file);

  // 5. Upload encrypted data to Supabase Storage
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(`${FOLDER}/${fileName}`, new Blob([encryptedData]), {
      contentType: "application/octet-stream",
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload invoice: ${error.message}`);
  }

  return { fileName, iv, mimeType: file.type };
}

/**
 * Download and decrypt an invoice file from Supabase Storage.
 * Returns a plaintext Blob ready for preview or download.
 */
export async function downloadInvoice(
  userId: string,
  fileName: string,
  iv: string,
  mimeType: string
): Promise<Blob> {
  const supabase = createClient();

  // 1. Download encrypted blob from storage
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(`${FOLDER}/${fileName}`);

  if (error) {
    throw new Error(`Failed to download invoice: ${error.message}`);
  }
  if (!data) {
    throw new Error("Invoice file not found in storage.");
  }

  // 2. Convert Blob to ArrayBuffer
  const encryptedData = await data.arrayBuffer();

  // 3. Decrypt using the user's DEK
  const decrypted = await decryptBlob(userId, encryptedData, iv, mimeType);

  return decrypted;
}

/**
 * Permanently delete an invoice file from Supabase Storage.
 */
export async function deleteInvoice(fileName: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([`${FOLDER}/${fileName}`]);

  if (error) {
    throw new Error(`Failed to delete invoice: ${error.message}`);
  }
}