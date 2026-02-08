import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_OPTIONS } from "@/lib/constants";

/**
 * Creates a Supabase client for use in the Next.js proxy (proxy.ts).
 * Handles cookie read/write through request/response headers
 * so the session can be refreshed on every navigation.
 *
 * Always create a new client per request — never store in a global variable.
 */
export function createClient(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Set cookies on the request (for downstream server components)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );

          // Create a fresh response that carries the updated request cookies
          supabaseResponse = NextResponse.next({ request });

          // Set cookies on the response (for the browser)
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...COOKIE_OPTIONS,
              ...options,
            })
          );
        },
      },
      cookieOptions: COOKIE_OPTIONS,
    }
  );

  return { supabase, response: supabaseResponse };
}
