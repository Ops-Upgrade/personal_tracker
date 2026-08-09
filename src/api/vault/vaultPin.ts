"use server";

import { createClient } from "@/lib/supabase/server";
import { argon2id } from "hash-wasm";

// ── Argon2id parameters for PIN hashing ──
// Strong params because a 4-digit PIN has only 10,000 possibilities.
// Making each hash expensive is the primary defence against brute-force.

const PIN_ARGON2_MEMORY = 19456; // 19 MiB
const PIN_ARGON2_ITERATIONS = 2;
const PIN_ARGON2_PARALLELISM = 1;
const PIN_ARGON2_HASH_LENGTH = 32; // 256 bits
const PIN_SALT_BYTE_LENGTH = 16;

const MAX_ATTEMPTS = 10;
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
// ── Helpers ──

function generateSalt(): Uint8Array {
  const salt = new Uint8Array(PIN_SALT_BYTE_LENGTH);
  crypto.getRandomValues(salt);
  return salt;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function hashPin(pin: string, saltB64: string): Promise<string> {
  const salt = fromBase64(saltB64);
  const rawHash = await argon2id({
    password: pin,
    salt,
    parallelism: PIN_ARGON2_PARALLELISM,
    iterations: PIN_ARGON2_ITERATIONS,
    memorySize: PIN_ARGON2_MEMORY,
    hashLength: PIN_ARGON2_HASH_LENGTH,
    outputType: "binary",
  });
  // rawHash is a Uint8Array; convert to Base64 for storage
  return toBase64(new Uint8Array(rawHash));
}

// ── Public Server Actions ──

/**
 * Check whether the user has set a vault PIN.
 * Returns true if a PIN hash exists in user_keys.
 */
export async function checkVaultPinSet(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_keys")
    .select("vault_pin_hash")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Failed to check PIN status: ${error.message}`);
  return data?.vault_pin_hash != null;
}

/**
 * Verify a vault PIN attempt.
 *
 * Sliding window logic:
 * - If >10 minutes since vault_last_failed_at, reset vault_failed_attempts to 0.
 * - If vault_locked_out is true, reject immediately.
 * - On correct PIN: reset attempts, clear last_failed_at, return success.
 * - On wrong PIN: increment attempts. If >= MAX_ATTEMPTS, set vault_locked_out.
 */
export async function verifyVaultPin(
  userId: string,
  pin: string
): Promise<{ success: boolean; attemptsLeft?: number; lockedOut?: boolean }> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  // Fetch current state
  const { data: keys, error } = await supabase
    .from("user_keys")
    .select(
      "vault_pin_hash, vault_pin_salt, vault_failed_attempts, vault_last_failed_at, vault_locked_out"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Failed to verify PIN: ${error.message}`);
  if (!keys?.vault_pin_hash) {
    throw new Error("No PIN has been set for this user.");
  }

  // Locked out — permanent until PIN reset via password
  if (keys.vault_locked_out) {
    return { success: false, lockedOut: true };
  }

  let attempts = keys.vault_failed_attempts ?? 0;
  const lastFailed = keys.vault_last_failed_at
    ? new Date(keys.vault_last_failed_at).getTime()
    : null;

  // Sliding window: reset if > 10 minutes since last failure
  if (lastFailed && Date.now() - lastFailed > ATTEMPT_WINDOW_MS) {
    attempts = 0;
    await supabase
      .from("user_keys")
      .update({
        vault_failed_attempts: 0,
        vault_last_failed_at: null,
        updated_at: now,
      })
      .eq("user_id", userId);
  }

  // Hash the PIN and compare
  const hash = await hashPin(pin, keys.vault_pin_salt);
  const correct = hash === keys.vault_pin_hash;

  if (correct) {
    // Reset attempt counter on success
    await supabase
      .from("user_keys")
      .update({
        vault_failed_attempts: 0,
        vault_last_failed_at: null,
        updated_at: now,
      })
      .eq("user_id", userId);

    return { success: true };
  }

  // Wrong PIN — increment counter
  const newAttempts = attempts + 1;
  const lockedOut = newAttempts >= MAX_ATTEMPTS;

  await supabase
    .from("user_keys")
    .update({
      vault_failed_attempts: newAttempts,
      vault_last_failed_at: now,
      vault_locked_out: lockedOut,
      updated_at: now,
    })
    .eq("user_id", userId);

  const attemptsLeft = MAX_ATTEMPTS - newAttempts;
  return {
    success: false,
    attemptsLeft: Math.max(0, attemptsLeft),
    lockedOut,
  };
}

/**
 * Set the vault PIN for the first time.
 * Generates a salt, hashes the PIN with Argon2id, stores in user_keys.
 */
export async function setVaultPin(
  userId: string,
  pin: string
): Promise<void> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  // Check PIN is not already set
  const { data: existing } = await supabase
    .from("user_keys")
    .select("vault_pin_hash")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.vault_pin_hash) {
    throw new Error("PIN is already set. Use the reset flow to change it.");
  }

  const salt = generateSalt();
  const saltB64 = toBase64(salt);
  const hash = await hashPin(pin, saltB64);

  const { error } = await supabase
    .from("user_keys")
    .update({
      vault_pin_hash: hash,
      vault_pin_salt: saltB64,
      vault_pin_set_at: now,
      vault_failed_attempts: 0,
      vault_last_failed_at: null,
      vault_locked_out: false,
      updated_at: now,
    })
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to set PIN: ${error.message}`);
}

/**
 * Reset the vault PIN by verifying the login password first.
 *
 * 1. Re-authenticates with Supabase (signInWithPassword) to verify password.
 * 2. If password is correct, re-hashes the new PIN and updates user_keys.
 * 3. Clears lockout state (vault_locked_out, vault_failed_attempts).
 *
 * NOTE: signInWithPassword is called server-side but does NOT create a new
 * session — the existing cookie session remains active.
 */
export async function resetPinWithPassword(
  userId: string,
  email: string,
  password: string,
  newPin: string
): Promise<void> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  // Re-authenticate to verify password
  const { error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    throw new Error("Incorrect password. PIN reset denied.");
  }

  // Generate new salt and hash for the new PIN
  const salt = generateSalt();
  const saltB64 = toBase64(salt);
  const hash = await hashPin(newPin, saltB64);

  // Update user_keys: new PIN hash + clear lockout state
  const { error } = await supabase
    .from("user_keys")
    .update({
      vault_pin_hash: hash,
      vault_pin_salt: saltB64,
      vault_pin_set_at: now,
      vault_failed_attempts: 0,
      vault_last_failed_at: null,
      vault_locked_out: false,
      updated_at: now,
    })
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to reset PIN: ${error.message}`);
}
