import { createClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase client with the secret key (admin privileges).
 * Bypasses RLS. Use ONLY in server-side Route Handlers.
 * Never import this in client components.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    throw new Error("Missing Supabase admin configuration.");
  }
  return createClient(url, secret, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
