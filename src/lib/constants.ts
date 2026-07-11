/**
 * Shared cookie options for Supabase auth across all client factories.
 * The domain is configured via NEXT_PUBLIC_COOKIE_DOMAIN env var
 * to enable cross-subdomain session sharing in production.
 */
export const COOKIE_OPTIONS = {
  domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

/** Ordered month names used by grouping/sorting helpers across domains. */
export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;