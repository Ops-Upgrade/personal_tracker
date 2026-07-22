import { createClient } from "@/lib/supabase/client";

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
 * Insert or update the encryption key material for a user.
 */
export async function upsertUserKeys(
  userId: string,
  salt: string,
  iv: string,
  wrappedDek: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("user_keys").upsert(
    {
      user_id: userId,
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
