import { createClient } from "@/lib/supabase/client";
import { bootstrapCrypto, clearDEK, rewrapDEK } from "@/lib/crypto";
import type { AuthResult } from "@/types";

/**
 * Auth service layer — wraps Supabase auth calls.
 * Components import from here; they never call Supabase directly.
 */

/**
 * Sign in with email and password.
 * After Supabase confirms credentials, bootstraps the client-side
 * crypto layer (derives KEK from password, unwraps/creates DEK).
 * The password is never stored — it only lives as a function argument.
 */
export async function login(
  email: string,
  password: string
): Promise<AuthResult> {
  const supabase = createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const userId = data.session?.user.id;
  if (!userId) {
    return { success: false, error: "Login succeeded but no session returned." };
  }

  try {
    await bootstrapCrypto(userId, password);
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? `Encryption setup failed: ${err.message}`
          : "Encryption setup failed. Please try again.",
    };
  }

  return { success: true };
}

/**
 * Sign out the current user, clear the DEK from IndexedDB, and
 * destroy the session cookie. userId is retrieved before sign-out
 * because the session is gone afterwards.
 */
export async function logout(): Promise<AuthResult> {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.user.id) {
    await clearDEK(session.user.id);
  }

  const { error } = await supabase.auth.signOut();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Change the user's password. Re-wraps the DEK with the new password
 * FIRST, then updates Supabase auth. If the Supabase update fails the
 * old wrapped DEK row is already overwritten — but the new password is
 * not yet active in auth, so the user must retry. In practice both
 * steps succeed or the user is prompted to contact support.
 */
export async function changePassword(
  oldPassword: string,
  newPassword: string
): Promise<AuthResult> {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const userId = session?.user.id;
  if (!userId) {
    return { success: false, error: "No active session. Please log in again." };
  }

  try {
    await rewrapDEK(userId, oldPassword, newPassword);
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to re-encrypt keys. Password not changed.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    return { success: false, error: `Password update failed: ${error.message}` };
  }

  return { success: true };
}

/**
 * Get the current browser session (client-side).
 * Returns the session object or null.
 */
export async function getSession() {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session;
}
