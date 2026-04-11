import { fetchUserKeys, upsertUserKeys } from "@/api/keys";
import {
  deriveKEK,
  generateDEK,
  generateSalt,
  wrapDEK,
  unwrapDEK,
  encrypt,
  decrypt,
  encryptBlob as encryptBlobPrimitive,
  decryptBlob as decryptBlobPrimitive,
  type EncryptedPayload,
} from "./primitives";
import { saveDEK, loadDEK, clearDEK as clearStore, hasDEK } from "./store";

// --- Public API ---

/**
 * Called at login after Supabase auth succeeds.
 *
 * - If user_keys row exists → derive KEK → unwrap DEK → save to IndexedDB.
 * - If no row (first login)  → generate salt + DEK → derive KEK → wrap DEK
 *   → persist row to Supabase → save DEK to IndexedDB.
 */
export async function bootstrapCrypto(
  userId: string,
  password: string
): Promise<void> {
  const existing = await fetchUserKeys(userId);

  if (existing) {
    const kek = await deriveKEK(password, existing.salt);
    const dek = await unwrapDEK(existing.wrapped_dek, existing.iv, kek);
    await saveDEK(userId, dek);
  } else {
    const salt = generateSalt();
    const dek = await generateDEK();
    const kek = await deriveKEK(password, salt);
    const bundle = await wrapDEK(dek, kek);
    await upsertUserKeys(userId, salt, bundle.iv, bundle.wrappedKey);
    await saveDEK(userId, dek);
  }
}

/**
 * Encrypt a plaintext string with the user's DEK from IndexedDB.
 */
export async function encryptField(
  userId: string,
  plaintext: string
): Promise<EncryptedPayload> {
  const dek = await requireDEK(userId);
  return encrypt(plaintext, dek);
}

/**
 * Decrypt a ciphertext payload back to a string.
 */
export async function decryptField(
  userId: string,
  iv: string,
  ciphertext: string
): Promise<string> {
  const dek = await requireDEK(userId);
  return decrypt(iv, ciphertext, dek);
}

/**
 * Encrypt a File/Blob for storage bucket upload.
 */
export async function encryptBlob(
  userId: string,
  file: File
): Promise<{ iv: string; encryptedData: ArrayBuffer }> {
  const dek = await requireDEK(userId);
  return encryptBlobPrimitive(file, dek);
}

/**
 * Decrypt an ArrayBuffer back to a Blob.
 */
export async function decryptBlob(
  userId: string,
  encryptedData: ArrayBuffer,
  iv: string,
  mimeType: string
): Promise<Blob> {
  const dek = await requireDEK(userId);
  return decryptBlobPrimitive(encryptedData, iv, dek, mimeType);
}

/**
 * Re-wrap the DEK when the user changes their password.
 *
 * 1. Derive old KEK → unwrap DEK as extractable (proves old password).
 * 2. Generate new salt → derive new KEK → wrap DEK with new KEK.
 * 3. Update user_keys row in Supabase.
 * 4. Re-import DEK as non-extractable and store in IndexedDB.
 *
 * If the Supabase upsert fails the old row is still intact and the old
 * password still works — no data loss.
 */
export async function rewrapDEK(
  userId: string,
  oldPassword: string,
  newPassword: string
): Promise<void> {
  const existing = await fetchUserKeys(userId);
  if (!existing) {
    throw new Error("No encryption keys found for this user.");
  }

  // Unwrap as extractable so we can re-wrap with a new KEK.
  const oldKek = await deriveKEK(oldPassword, existing.salt);
  const extractableDek = await unwrapDEK(
    existing.wrapped_dek,
    existing.iv,
    oldKek,
    true // extractable for re-wrapping
  );

  const newSalt = generateSalt();
  const newKek = await deriveKEK(newPassword, newSalt);
  const bundle = await wrapDEK(extractableDek, newKek);

  await upsertUserKeys(userId, newSalt, bundle.iv, bundle.wrappedKey);

  // Store non-extractable copy for ongoing encrypt/decrypt.
  const rawDek = await crypto.subtle.exportKey("raw", extractableDek);
  const lockedDek = await crypto.subtle.importKey(
    "raw",
    rawDek,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
  await saveDEK(userId, lockedDek);
}

/**
 * Check if the DEK is available in IndexedDB for this user.
 */
export async function isReady(userId: string): Promise<boolean> {
  return hasDEK(userId);
}

/**
 * Clear the DEK from IndexedDB (called on logout).
 */
export { clearStore as clearDEK };

// --- Internal ---

async function requireDEK(userId: string): Promise<CryptoKey> {
  const dek = await loadDEK(userId);
  if (!dek) {
    throw new Error(
      "Encryption key not available. Please log in again to restore access."
    );
  }
  return dek;
}
