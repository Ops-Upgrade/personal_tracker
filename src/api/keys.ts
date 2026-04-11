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
