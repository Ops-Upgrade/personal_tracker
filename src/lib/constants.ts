/**
 * Shared cookie options for Supabase auth across all client factories.
 * The domain is configured via NEXT_PUBLIC_COOKIE_DOMAIN env var
 * to enable cross-subdomain session sharing in production.
 *
 * Vercel preview deployments are served from *.vercel.app, which can never
 * domain-match the production cookie domain — the browser silently drops the
 * Set-Cookie, so the session is never persisted and every request after login
 * goes out anonymous (failing RLS). On preview we omit the domain entirely so
 * the cookie falls back to host-only for the current preview hostname.
 *
 * NEXT_PUBLIC_VERCEL_ENV (not VERCEL_ENV) is required here because this module
 * is bundled into the browser, where only NEXT_PUBLIC_* vars are inlined.
 * NODE_ENV is unusable for this — it is "production" on preview builds too.
 */
export const COOKIE_OPTIONS = {
  domain:
    process.env.NEXT_PUBLIC_VERCEL_ENV === "preview"
      ? undefined
      : process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

/** Ordered month names used by grouping/sorting helpers across domains. */
export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;