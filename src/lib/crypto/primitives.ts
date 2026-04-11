import { argon2id } from "hash-wasm";

// --- Argon2id parameters (OWASP 2024+ minimum) ---
const ARGON2_MEMORY = 19456; // 19 MiB in KiB
const ARGON2_ITERATIONS = 2;
const ARGON2_PARALLELISM = 1;
const ARGON2_HASH_LENGTH = 32; // 256 bits

const AES_KEY_LENGTH = 256;
const IV_BYTE_LENGTH = 12; // 96 bits — AES-GCM standard
const SALT_BYTE_LENGTH = 16; // 128 bits

// --- Helpers: binary ↔ Base64 ---

function toBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes =
    buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// --- Random generators ---

export function generateSalt(): string {
  return toBase64(crypto.getRandomValues(new Uint8Array(SALT_BYTE_LENGTH)));
}

export function generateIV(): string {
  return toBase64(crypto.getRandomValues(new Uint8Array(IV_BYTE_LENGTH)));
}

// --- Key derivation (Argon2id → AES-GCM CryptoKey) ---

/**
 * Derive a 256-bit KEK (Key Encryption Key) from the user's password + salt.
 * Uses Argon2id via hash-wasm, then imports the raw bytes as an AES-GCM
 * CryptoKey with wrapKey/unwrapKey permissions.
 */
export async function deriveKEK(
  password: string,
  saltB64: string
): Promise<CryptoKey> {
  const salt = fromBase64(saltB64);

  const rawHash = await argon2id({
    password,
    salt,
    parallelism: ARGON2_PARALLELISM,
    iterations: ARGON2_ITERATIONS,
    memorySize: ARGON2_MEMORY,
    hashLength: ARGON2_HASH_LENGTH,
    outputType: "binary",
  });

  return crypto.subtle.importKey(
    "raw",
    rawHash.buffer as ArrayBuffer,
    { name: "AES-GCM", length: AES_KEY_LENGTH },
    false,
    ["wrapKey", "unwrapKey"]
  );
}

// --- DEK generation ---

/**
 * Generate a fresh random AES-256-GCM Data Encryption Key.
 * Extractable so it can be wrapped (exported + encrypted) by the KEK.
 */
export async function generateDEK(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: AES_KEY_LENGTH },
    true, // extractable — required for wrapKey
    ["encrypt", "decrypt"]
  );
}

// --- Key wrapping / unwrapping ---

export interface WrappedKeyBundle {
  iv: string; // Base64
  wrappedKey: string; // Base64
}

/**
 * Wrap (encrypt) the DEK with the KEK using AES-GCM.
 * Returns Base64 IV + ciphertext.
 */
export async function wrapDEK(
  dek: CryptoKey,
  kek: CryptoKey
): Promise<WrappedKeyBundle> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTE_LENGTH));

  const wrapped = await crypto.subtle.wrapKey("raw", dek, kek, {
    name: "AES-GCM",
    iv,
  });

  return {
    iv: toBase64(iv),
    wrappedKey: toBase64(wrapped),
  };
}

/**
 * Unwrap the DEK from its encrypted form using the KEK.
 * @param extractable — false (default) for normal use; true during rewrap
 *   so the key material can be re-exported and wrapped with a new KEK.
 */
export async function unwrapDEK(
  wrappedKeyB64: string,
  ivB64: string,
  kek: CryptoKey,
  extractable = false
): Promise<CryptoKey> {
  const wrappedKey = fromBase64(wrappedKeyB64);
  const iv = fromBase64(ivB64);

  return crypto.subtle.unwrapKey(
    "raw",
    wrappedKey,
    kek,
    { name: "AES-GCM", iv },
    { name: "AES-GCM", length: AES_KEY_LENGTH },
    extractable,
    ["encrypt", "decrypt"]
  );
}

// --- Data encryption / decryption ---

export interface EncryptedPayload {
  iv: string; // Base64
  ciphertext: string; // Base64
}

/**
 * AES-GCM encrypt arbitrary string data with the DEK.
 */
export async function encrypt(
  data: string,
  dek: CryptoKey
): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTE_LENGTH));
  const encoded = new TextEncoder().encode(data);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    dek,
    encoded
  );

  return {
    iv: toBase64(iv),
    ciphertext: toBase64(ciphertext),
  };
}

/**
 * AES-GCM decrypt a payload back to the original string.
 */
export async function decrypt(
  ivB64: string,
  ciphertextB64: string,
  dek: CryptoKey
): Promise<string> {
  const iv = fromBase64(ivB64);
  const ciphertext = fromBase64(ciphertextB64);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    dek,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * AES-GCM encrypt a File/Blob for storage bucket upload.
 * Returns raw encrypted ArrayBuffer (prepend IV when storing).
 */
export async function encryptBlob(
  file: File,
  dek: CryptoKey
): Promise<{ iv: string; encryptedData: ArrayBuffer }> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTE_LENGTH));
  const plaintext = await file.arrayBuffer();

  const encryptedData = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    dek,
    plaintext
  );

  return { iv: toBase64(iv), encryptedData };
}

/**
 * AES-GCM decrypt an ArrayBuffer back to a Blob.
 */
export async function decryptBlob(
  encryptedData: ArrayBuffer,
  ivB64: string,
  dek: CryptoKey,
  mimeType: string
): Promise<Blob> {
  const iv = fromBase64(ivB64);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    dek,
    encryptedData
  );

  return new Blob([decrypted], { type: mimeType });
}
