import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { COOKIE_OPTIONS } from "@/lib/constants";

/**
 * Creates a Supabase client for use in Server Components,
 * Server Actions, and Route Handlers.
 *
 * Must be called within a request context where `cookies()` is available.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, { ...COOKIE_OPTIONS, ...options })
            );
          } catch {
            // setAll is called from a Server Component where cookies
            // cannot be set. This is safe to ignore — the proxy
            // will refresh the session on the next request.
          }
        },
      },
      cookieOptions: COOKIE_OPTIONS,
    }
  );
}
