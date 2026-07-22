import { fetchUserKeys, upsertUserKeys, hasRecoveryKey as apiHasRecoveryKey, upsertRecoveryKey } from "@/api/auth";
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

/**
 * Generate a random recovery phrase for the user to write down.
 * 32 random bytes → Base64 → split into 6-char groups joined by "-".
 */
export function generateRecoveryPhrase(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 = btoa(binary);
  // Split into 6-char groups for readability
  const groups = b64.match(/.{1,6}/g) ?? [b64];
  return `opsugrade_${groups.join("-")}`;
}

/**
 * Check whether the logged-in user has a recovery key set up.
 */
export async function hasRecoveryKey(userId: string): Promise<boolean> {
  return apiHasRecoveryKey(userId);
}

/**
 * Set up (or regenerate) a recovery key for the current user.
 *
 * 1. Fetches the existing user_keys row.
 * 2. Derives the KEK from currentPassword + existing salt.
 * 3. Unwraps the DEK as extractable (proves the password is correct).
 * 4. Generates a new recovery salt → derives recovery KEK from recoveryPhrase.
 * 5. Wraps the DEK with the recovery KEK.
 * 6. Upserts the recovery columns to Supabase.
 *
 * The DEK never leaves the client in plaintext; only the encrypted recovery
 * columns are sent to the server.
 */
export async function setupRecoveryKey(
  userId: string,
  currentPassword: string,
  recoveryPhrase: string
): Promise<void> {
  const existing = await fetchUserKeys(userId);
  if (!existing) {
    throw new Error("No key row found for user.");
  }

  // Derive KEK from current password and unwrap DEK as extractable.
  // If password is wrong, unwrapKey throws DOMException — let it propagate.
  const kek = await deriveKEK(currentPassword, existing.salt);
  const extractableDek = await unwrapDEK(
    existing.wrapped_dek,
    existing.iv,
    kek,
    true // extractable for re-wrapping
  );

  // Generate recovery KEK from the recovery phrase.
  // Use generateSalt() from primitives for the new salt.
  const recoverySalt = generateSalt();
  const recoveryKEK = await deriveKEK(recoveryPhrase, recoverySalt);

  // Wrap DEK with recovery KEK.
  const { iv: recoveryIv, wrappedKey: recoveryWrappedDek } =
    await wrapDEK(extractableDek, recoveryKEK);

  // Persist to Supabase.
  await upsertRecoveryKey(userId, recoverySalt, recoveryIv, recoveryWrappedDek);
}

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
