import { createBrowserClient } from "@supabase/ssr";
import { COOKIE_OPTIONS } from "@/lib/constants";

/**
 * Creates a Supabase client for use in Client Components (browser).
 * Call this inside event handlers, useEffect, or other client-side code.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookieOptions: COOKIE_OPTIONS },
  );
}
