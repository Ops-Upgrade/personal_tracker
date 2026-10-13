import { createBrowserClient as createClient } from "@ops-upgrade/auth-core";

export interface UserKeysRow {
  salt: string;
  iv: string;
  wrapped_dek: string;
}

/**
 * Fetch the encryption key material for a user.
 * Returns `{ salt, iv, wrapped_dek }` or `null` if no row exists yet.
 */
export async function fetchUserKeys(
  userId: string
): Promise<UserKeysRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_keys")
    .select("salt, iv, wrapped_dek")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch user_keys: ${error.message}`);
  return data;
}

/**
 * Insert the FIRST key row for a user. Never overwrites.
 *
 * `fetchUserKeys` returns null both when no row exists and when a row exists
 * but is invisible (RLS filtered it because the session was dropped, a
 * transient error, etc.). Those two cases are indistinguishable at the call
 * site, so the first-login path must not use an upsert — doing so would
 * replace the user's wrapped DEK and permanently orphan every encrypted row
 * they own. `user_id` is the PK, so a plain insert makes Postgres reject the
 * duplicate (23505) instead. Use `upsertUserKeys` only where overwriting is
 * intended (password change / re-wrap).
 */
export async function insertUserKeys(
  userId: string,
  email: string,
  salt: string,
  iv: string,
  wrappedDek: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("user_keys").insert({
    user_id: userId,
    email: email.toLowerCase(),
    salt,
    iv,
    wrapped_dek: wrappedDek,
    updated_at: new Date().toISOString(),
  });

  if (!error) return;

  // 23505 = unique_violation. A row already existed that we could not read,
  // so the "first login" assumption was wrong. Failing here is what protects
  // the existing DEK.
  if (error.code === "23505") {
    throw new Error(
      "Encryption keys already exist for this account but could not be read. " +
        "Refusing to overwrite them. Please sign in again."
    );
  }

  throw new Error(`Failed to insert user_keys: ${error.message}`);
}

/**
 * Insert or update the encryption key material for a user.
 * The email is lowercased and stored to enable indexed lookups
 * from the reset-password / recovery-data API routes.
 *
 * Overwrites an existing row — only correct when the caller has already
 * proven ownership of the current DEK (see `rewrapDEK`). For first-login
 * key creation use `insertUserKeys`.
 */
export async function upsertUserKeys(
  userId: string,
  email: string,
  salt: string,
  iv: string,
  wrappedDek: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("user_keys").upsert(
    {
      user_id: userId,
      email: email.toLowerCase(),
      salt,
      iv,
      wrapped_dek: wrappedDek,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) throw new Error(`Failed to upsert user_keys: ${error.message}`);
}

/**
 * Check if the user has a recovery key set up.
 * Returns true if recovery_wrapped_dek is non-null.
 */
export async function hasRecoveryKey(userId: string): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_keys")
    .select("recovery_wrapped_dek")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Failed to check recovery key: ${error.message}`);
  return data?.recovery_wrapped_dek != null;
}

/**
 * Save (or overwrite) the recovery key columns for a user.
 * Uses .update() because the row always exists at this point.
 */
export async function upsertRecoveryKey(
  userId: string,
  recoverySalt: string,
  recoveryIv: string,
  recoveryWrappedDek: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("user_keys")
    .update({
      recovery_salt: recoverySalt,
      recovery_iv: recoveryIv,
      recovery_wrapped_dek: recoveryWrappedDek,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to save recovery key: ${error.message}`);
}
