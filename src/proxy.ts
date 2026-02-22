import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/proxy";
import { PUBLIC_ROUTES, AUTH_ROUTE, DEFAULT_AUTHENTICATED_ROUTE } from "@/routes/config";

/**
 * Next.js proxy — runs on every matched request.
 *
 * 1. Refreshes the Supabase session via getClaims() (keeps tokens alive).
 * 2. Redirects unauthenticated users away from protected routes.
 * 3. Redirects authenticated users away from the login page.
 *
 * IMPORTANT: Do not run code between createClient and getClaims().
 * getClaims() validates the JWT signature against the project's public keys
 * every time — unlike getSession(), which is not guaranteed to revalidate.
 */
export async function proxy(request: NextRequest) {
  const { supabase, response } = createClient(request);

  // Refresh the session — getClaims() is safe to trust because it
  // validates the JWT signature against published public keys.
  const { data, error } = await supabase.auth.getClaims();
  const user = data?.claims;

  // If the refresh token is stale/invalid, clear the auth cookies
  // so we don't keep retrying on every request.
  if (error) {
    request.cookies.getAll().forEach(({ name }) => {
      if (name.startsWith("sb-")) {
        response.cookies.delete(name);
      }
    });
  }

  const { pathname } = request.nextUrl;

  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // Unauthenticated user trying to access a protected route → login
  if (!user && !isPublicRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = AUTH_ROUTE;
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated user trying to access login → dashboard
  if (user && pathname === AUTH_ROUTE) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = DEFAULT_AUTHENTICATED_ROUTE;
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}

/**
 * Match all routes except static files, images, and Next.js internals.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
