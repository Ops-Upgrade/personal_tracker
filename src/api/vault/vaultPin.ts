"use server";

import { createServerClient as createClient } from "@ops-upgrade/auth-core";
import { argon2id } from "hash-wasm";

// ── Argon2id parameters for PIN hashing ──

const PIN_ARGON2_MEMORY = 19456; // 19 MiB
const PIN_ARGON2_ITERATIONS = 2;
const PIN_ARGON2_PARALLELISM = 1;
const PIN_ARGON2_HASH_LENGTH = 32; // 256 bits
const PIN_SALT_BYTE_LENGTH = 16;

// ── Cumulative failure policy ──
// Each failed attempt adds 1 to the counter; one attempt decays after each
// full hour since the last failure. Reaching the cap locks the PIN
// permanently until it is reset through the password flow. Because the
// counter only ever decays slowly, the per-account hash cost is bounded.

const PIN_MAX_CUMULATIVE_FAILURES = 30;
const PIN_DECAY_MS = 60 * 60 * 1000;

// A password re-authentication must be this recent to authorise a PIN reset.
const PIN_RESET_REAUTH_WINDOW_MS = 10 * 60 * 1000;

// ── Helpers ──

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

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

/**
 * Derive the caller's user id from the validated session. Every action
 * operates on this id — a client-supplied id is never trusted.
 */
async function requireSessionUserId(
  supabase: ServerSupabaseClient
): Promise<string> {
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) {
    throw new Error("Session check failed. Please log in again.");
  }
  return data.claims.sub as string;
}

/**
 * True when the claims include a password sign-in within the re-auth
 * window. Refreshed tokens keep the original (older) password timestamp,
 * so a session that merely got refreshed does not satisfy this check.
 */
function hasRecentPasswordAuth(claims: Record<string, unknown>): boolean {
  const amr = claims.amr;
  if (!Array.isArray(amr)) return false;
  const cutoffSec =
    Math.floor(Date.now() / 1000) - Math.floor(PIN_RESET_REAUTH_WINDOW_MS / 1000);
  for (const entry of amr) {
    if (typeof entry !== "object" || entry === null) continue;
    const method = (entry as { method?: unknown }).method;
    const timestamp = (entry as { timestamp?: unknown }).timestamp;
    if (method === "password" && typeof timestamp === "number" && timestamp >= cutoffSec) {
      return true;
    }
  }
  return false;
}

// ── Public Server Actions ──

/**
 * Check whether the user has set a vault PIN.
 * Returns true if a PIN hash exists in user_keys.
 */
export async function checkVaultPinSet(): Promise<boolean> {
  const supabase = await createClient();
  const userId = await requireSessionUserId(supabase);
  const { data, error } = await supabase
    .from("user_keys")
    .select("vault_pin_hash")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    // Server-side only: the detail is logged, never shipped to the client.
    console.error("checkVaultPinSet failed:", error);
    throw new Error("Failed to check PIN status.");
  }
  return data?.vault_pin_hash != null;
}

/**
 * Verify a vault PIN attempt.
 *
 * Cumulative counter logic:
 * - If vault_locked_out is true, reject immediately (permanent until reset).
 * - The counter decays by 1 per full hour since the last failure.
 * - If the effective counter is at or above the cap, lock permanently.
 * - On correct PIN: reset the counter and clear last_failed_at.
 * - On wrong PIN: increment; reaching the cap sets vault_locked_out.
 */
export async function verifyVaultPin(
  pin: string
): Promise<{ success: boolean; attemptsLeft?: number; lockedOut?: boolean }> {
  const supabase = await createClient();
  const userId = await requireSessionUserId(supabase);
  const now = new Date().toISOString();

  // Fetch current state
  const { data: keys, error } = await supabase
    .from("user_keys")
    .select(
      "vault_pin_hash, vault_pin_salt, vault_failed_attempts, vault_last_failed_at, vault_locked_out"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("verifyVaultPin failed:", error);
    throw new Error("Failed to verify PIN.");
  }
  if (!keys?.vault_pin_hash) {
    throw new Error("No PIN has been set for this user.");
  }

  // Locked out — permanent until PIN reset via password
  if (keys.vault_locked_out) {
    return { success: false, lockedOut: true };
  }

  const storedAttempts = keys.vault_failed_attempts ?? 0;
  const lastFailedMs = keys.vault_last_failed_at
    ? new Date(keys.vault_last_failed_at).getTime()
    : null;

  // Decay: one attempt drops off per full hour since the last failure.
  // The elapsed time is clamped at 0 so a clock-skewed (future) timestamp
  // can never inflate the counter.
  const decayedAttempts = lastFailedMs
    ? Math.max(
        0,
        storedAttempts -
          Math.floor(Math.max(0, Date.now() - lastFailedMs) / PIN_DECAY_MS)
      )
    : storedAttempts;

  // Hard floor: once the cumulative counter reaches the cap the lockout is
  // permanent — decay never brings it back (cleared only by the reset flow).
  if (decayedAttempts >= PIN_MAX_CUMULATIVE_FAILURES) {
    const { error: lockError } = await supabase
      .from("user_keys")
      .update({ vault_locked_out: true, updated_at: now })
      .eq("user_id", userId);
    if (lockError) {
      console.error("verifyVaultPin lockout persist failed:", lockError);
    }
    return { success: false, lockedOut: true };
  }

  // Hash the PIN and compare
  const hash = await hashPin(pin, keys.vault_pin_salt);
  const correct = hash === keys.vault_pin_hash;

  if (correct) {
    // Reset attempt counter on success
    const { error: resetError } = await supabase
      .from("user_keys")
      .update({
        vault_failed_attempts: 0,
        vault_last_failed_at: null,
        updated_at: now,
      })
      .eq("user_id", userId);
    if (resetError) {
      console.error("verifyVaultPin counter reset failed:", resetError);
    }

    return { success: true };
  }

  // Wrong PIN — increment the cumulative counter
  const newAttempts = decayedAttempts + 1;
  const lockedOut = newAttempts >= PIN_MAX_CUMULATIVE_FAILURES;

  const { error: incrementError } = await supabase
    .from("user_keys")
    .update({
      vault_failed_attempts: newAttempts,
      vault_last_failed_at: now,
      vault_locked_out: lockedOut,
      updated_at: now,
    })
    .eq("user_id", userId);
  if (incrementError) {
    console.error("verifyVaultPin counter increment failed:", incrementError);
  }

  const attemptsLeft = PIN_MAX_CUMULATIVE_FAILURES - newAttempts;
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
export async function setVaultPin(pin: string): Promise<void> {
  const supabase = await createClient();
  const userId = await requireSessionUserId(supabase);
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

  if (error) {
    console.error("setVaultPin failed:", error);
    throw new Error("Failed to set PIN.");
  }
}

/**
 * Reset the vault PIN.
 *
 * The client re-authenticates against Supabase directly (sign-in with
 * password in the browser — the password never reaches this server) and
 * presents the fresh access token as proof. The token must belong to the
 * session's user and carry a password sign-in within the re-auth window.
 * On success the new PIN is hashed and the lockout state cleared.
 */
export async function resetVaultPin(
  newPin: string,
  freshAccessToken: string
): Promise<void> {
  const supabase = await createClient();
  const userId = await requireSessionUserId(supabase);

  // Fail closed on a missing proof: GoTrue's getClaims() falls back to the
  // cookie session for a falsy token, which would silently validate the
  // caller's own session instead of the presented re-authentication.
  if (!freshAccessToken) {
    throw new Error("Password verification failed. PIN reset denied.");
  }

  // Verify the presented token: valid signature/expiry, same user, and a
  // password sign-in inside the re-auth window.
  const { data: tokenData, error: tokenError } =
    await supabase.auth.getClaims(freshAccessToken);
  const claims = tokenData?.claims as Record<string, unknown> | undefined;

  if (
    tokenError ||
    !claims ||
    claims.sub !== userId ||
    !hasRecentPasswordAuth(claims)
  ) {
    throw new Error("Password verification failed. PIN reset denied.");
  }

  const now = new Date().toISOString();

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

  if (error) {
    console.error("resetVaultPin failed:", error);
    throw new Error("Failed to reset PIN.");
  }
}
