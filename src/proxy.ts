import { NextRequest, NextResponse } from "next/server";
import { getSessionForRequest } from "@ops-upgrade/auth-core";
import { PUBLIC_ROUTES, AUTH_ROUTE, DEFAULT_AUTHENTICATED_ROUTE } from "@/routes/config";

const isPreviewEnv = process.env.VERCEL_ENV === "preview";
const isProdEnv =
  process.env.VERCEL_ENV === "production" ||
  (process.env.NODE_ENV === "production" && !isPreviewEnv);

function buildCsp(nonce: string) {
  if (isProdEnv) {
    // Production: maximally locked down, no Vercel domains.
    return [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}' 'wasm-unsafe-eval' 'strict-dynamic'`,
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self' https://*.supabase.co https://*.r2.cloudflarestorage.com",
      "img-src 'self' blob: data: https://*.supabase.co https://image.tmdb.org",
      "frame-ancestors 'none'",
      "frame-src blob:",
    ].join("; ");
  }

  if (isPreviewEnv) {
    // Preview: strict CSP + Vercel Preview Toolbar domains.
    return [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}' 'wasm-unsafe-eval' 'strict-dynamic' https://vercel.live`,
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self' https://*.supabase.co https://*.r2.cloudflarestorage.com https://vercel.live wss://ws-us3.pusher.com",
      "img-src 'self' blob: data: https://*.supabase.co https://image.tmdb.org",
      "frame-ancestors 'none'",
      "frame-src blob: https://vercel.live",
    ].join("; ");
  }

  // Development: loose CSP + Vercel domains.
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://vercel.live",
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self' https://*.supabase.co https://*.r2.cloudflarestorage.com ws://localhost:3000 https://vercel.live wss://ws-us3.pusher.com",
    "img-src 'self' blob: data: https://*.supabase.co https://image.tmdb.org",
    "frame-ancestors 'none'",
    "frame-src blob: https://vercel.live",
  ].join("; ");
}

/**
 * Next.js proxy — runs on every matched request.
 *
 * 1. Generates a per-request nonce for a strict CSP.
 * 2. Sets the nonce on the request BEFORE createClient so it survives
 *    any internal NextResponse recreation during token refresh.
 * 3. Refreshes the Supabase session via getSessionForRequest() (keeps tokens alive).
 * 4. Redirects unauthenticated users away from protected routes.
 * 5. Redirects authenticated users away from the login page.
 * 6. Appends the final CSP header to every returned response.
 *
 * getSessionForRequest() validates the JWT signature against the project's
 * public keys every time — unlike getSession(), which is not guaranteed to
 * revalidate. It also clears stale sb-* cookies on refresh errors, so no
 * separate error handling is needed here.
 */
export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const cspDirectives = buildCsp(nonce);

  // Set on the REQUEST, not the response. This survives Supabase token refreshes.
  request.headers.set("x-nonce", nonce);
  request.headers.set("Content-Security-Policy", cspDirectives);

  const { user, response } = await getSessionForRequest(request);

  const { pathname } = request.nextUrl;

  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // Unauthenticated user trying to access a protected route → login
  if (!user && !isPublicRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = AUTH_ROUTE;
    const redirectResponse = NextResponse.redirect(loginUrl);
    redirectResponse.headers.set("Content-Security-Policy", cspDirectives);
    return redirectResponse;
  }

  // Authenticated user trying to access login → dashboard
  if (user && pathname === AUTH_ROUTE) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = DEFAULT_AUTHENTICATED_ROUTE;
    const redirectResponse = NextResponse.redirect(dashboardUrl);
    redirectResponse.headers.set("Content-Security-Policy", cspDirectives);
    return redirectResponse;
  }

  // Set on the final, post-refresh response object
  response.headers.set("Content-Security-Policy", cspDirectives);
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
