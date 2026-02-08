import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_AUTHENTICATED_ROUTE, AUTH_ROUTE } from "@/routes/config";

/**
 * Auth callback route handler.
 * Supabase redirects here after OAuth or magic link flows.
 * Exchanges the code for a session and redirects to dashboard.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? DEFAULT_AUTHENTICATED_ROUTE;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // If code exchange fails, redirect to login with error
  return NextResponse.redirect(`${origin}${AUTH_ROUTE}?error=auth_callback_failed`);
}
