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
 * `aad` (optional) is bound as additional authenticated data — the
 * ciphertext only decrypts when the same AAD is supplied again.
 */
export async function encrypt(
  data: string,
  dek: CryptoKey,
  aad?: string
): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTE_LENGTH));
  const encoded = new TextEncoder().encode(data);
  const aadBytes = aad !== undefined ? new TextEncoder().encode(aad) : undefined;
  const params: AesGcmParams = { name: "AES-GCM", iv };
  if (aadBytes !== undefined) params.additionalData = aadBytes;

  const ciphertext = await crypto.subtle.encrypt(params, dek, encoded);

  return {
    iv: toBase64(iv),
    ciphertext: toBase64(ciphertext),
  };
}

/**
 * AES-GCM decrypt a payload back to the original string.
 * Pass the same `aad` that was supplied at encryption time.
 */
export async function decrypt(
  ivB64: string,
  ciphertextB64: string,
  dek: CryptoKey,
  aad?: string
): Promise<string> {
  const iv = fromBase64(ivB64);
  const ciphertext = fromBase64(ciphertextB64);
  const aadBytes = aad !== undefined ? new TextEncoder().encode(aad) : undefined;
  const params: AesGcmParams = { name: "AES-GCM", iv };
  if (aadBytes !== undefined) params.additionalData = aadBytes;

  const decrypted = await crypto.subtle.decrypt(params, dek, ciphertext);

  return new TextDecoder().decode(decrypted);
}

/**
 * AES-GCM encrypt a File/Blob for storage bucket upload.
 * With `aad` set, the result is the v1 file layout: a `v1|<aad-b64>|`
 * header followed by the raw ciphertext (the IV stays in the parent
 * record's metadata). Without `aad` the legacy layout (bare ciphertext)
 * is produced.
 */
export async function encryptBlob(
  file: File,
  dek: CryptoKey,
  aad?: string
): Promise<{ iv: string; encryptedData: ArrayBuffer }> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTE_LENGTH));
  const plaintext = await file.arrayBuffer();
  const aadBytes = aad !== undefined ? new TextEncoder().encode(aad) : undefined;
  const params: AesGcmParams = { name: "AES-GCM", iv };
  if (aadBytes !== undefined) params.additionalData = aadBytes;

  const encryptedData = await crypto.subtle.encrypt(params, dek, plaintext);

  if (aad === undefined) {
    return { iv: toBase64(iv), encryptedData };
  }

  const header = packBlobHeader(aad);
  const out = new Uint8Array(header.length + encryptedData.byteLength);
  out.set(header, 0);
  out.set(new Uint8Array(encryptedData), header.length);
  return { iv: toBase64(iv), encryptedData: out.buffer };
}

/**
 * AES-GCM decrypt an ArrayBuffer back to a Blob.
 * For v1 files the header's stored identity must equal the `aad` the
 * caller passes (the identity the file is being read as); legacy files
 * decrypt without AAD.
 */
export async function decryptBlob(
  encryptedData: ArrayBuffer,
  ivB64: string,
  dek: CryptoKey,
  mimeType: string,
  aad?: string
): Promise<Blob> {
  const iv = fromBase64(ivB64);
  const bytes = new Uint8Array(encryptedData);
  const parsed = parseBlobHeader(bytes);

  if (parsed.version === 1) {
    if (aad === undefined || parsed.aad !== aad) {
      throw new Error("File identity check failed.");
    }
    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
        additionalData: new TextEncoder().encode(aad),
      },
      dek,
      bytes.slice(parsed.offset)
    );
    return new Blob([decrypted], { type: mimeType });
  }

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    dek,
    encryptedData
  );

  return new Blob([decrypted], { type: mimeType });
}

// --- Payload format (versioned, AAD-bound) ---

/**
 * Build the AAD context string for a feature row: `feature|userId|rowId`.
 * This value is bound into the GCM tag, so a row moved between tables,
 * users or row ids no longer decrypts.
 */
export function buildFieldAad(
  feature: string,
  userId: string,
  rowId: string
): string {
  return `${feature}|${userId}|${rowId}`;
}

/**
 * v1 field payload: `v1|<aad-b64>|<ciphertext-b64>`. The IV stays in the
 * row's `iv` column. Legacy rows hold the bare base64 ciphertext (no
 * version prefix) and decrypt without AAD until they are re-written.
 */
export function packFieldPayload(aad: string, ciphertextB64: string): string {
  const aadB64 = toBase64(new TextEncoder().encode(aad));
  return `v1|${aadB64}|${ciphertextB64}`;
}

export type ParsedFieldPayload =
  | { version: 1; aad: string; ciphertextB64: string }
  | { version: 0; ciphertextB64: string };

export function parseFieldPayload(data: string): ParsedFieldPayload {
  if (!data.startsWith("v1|")) {
    return { version: 0, ciphertextB64: data };
  }
  const rest = data.slice(3);
  const sep = rest.indexOf("|");
  if (sep === -1) {
    throw new Error("Malformed encrypted payload.");
  }
  const aadB64 = rest.slice(0, sep);
  const ciphertextB64 = rest.slice(sep + 1);
  const aad = new TextDecoder().decode(fromBase64(aadB64));
  return { version: 1, aad, ciphertextB64 };
}

/**
 * v1 blob header: `v1|<aad-b64>|`, prepended to the raw ciphertext bytes.
 * Legacy files start with the ciphertext directly.
 */
export function packBlobHeader(aad: string): Uint8Array {
  const aadB64 = toBase64(new TextEncoder().encode(aad));
  return new TextEncoder().encode(`v1|${aadB64}|`);
}

export type ParsedBlobHeader =
  | { version: 1; aad: string; offset: number }
  | { version: 0; offset: number };

export function parseBlobHeader(bytes: Uint8Array): ParsedBlobHeader {
  // Version prefix check: ASCII "v1|". A raw GCM ciphertext begins with
  // these exact bytes with probability 2^-24 — negligible.
  if (
    bytes.length >= 3 &&
    bytes[0] === 0x76 &&
    bytes[1] === 0x31 &&
    bytes[2] === 0x7c
  ) {
    let sep = -1;
    for (let i = 3; i < bytes.length; i++) {
      if (bytes[i] === 0x7c) {
        sep = i;
        break;
      }
    }
    if (sep === -1) {
      throw new Error("Malformed encrypted file.");
    }
    const aadB64 = new TextDecoder().decode(bytes.slice(3, sep));
    const aad = new TextDecoder().decode(fromBase64(aadB64));
    return { version: 1, aad, offset: sep + 1 };
  }
  return { version: 0, offset: 0 };
}
