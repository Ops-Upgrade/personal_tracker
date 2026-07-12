import { createClient } from "@/lib/supabase/server";

/**
 * Validate the caller's Supabase session from cookies.
 * Returns the authenticated user ID, or null if unauthenticated.
 *
 * Uses getClaims() which validates the JWT signature against
 * Supabase's public keys — consistent with proxy.ts auth flow.
 */
export async function getAuthenticatedUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return data.claims.sub as string;
}
