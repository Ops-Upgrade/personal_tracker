import { createClient } from "@/lib/supabase/client";
import type { AuthResult } from "@/types";

/**
 * Auth service layer — wraps Supabase auth calls.
 * Components import from here; they never call Supabase directly.
 */

/**
 * Sign in with email and password.
 * Returns a standardized result — no Supabase types leak to the UI.
 */
export async function login(
  email: string,
  password: string
): Promise<AuthResult> {
  const supabase = createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Sign out the current user and clear the session cookie.
 */
export async function logout(): Promise<AuthResult> {
  const supabase = createClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    return { success: false, error: error.message };
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
