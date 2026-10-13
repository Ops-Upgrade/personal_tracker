/**
 * Validates a cross-subdomain `?redirect=` value for the logout flow.
 *
 * The redirect arrives as a raw attacker-influenced query string, so it must
 * be parsed with `new URL()` and checked against strict origin rules — never
 * string-matched. Suffix checks like `endsWith(".ops-upgrade.net")` are
 * bypassable via URLs such as `https://evil.com/?.ops-upgrade.net`.
 *
 * Returns the safe `url.origin` to navigate to, or `null` when the caller
 * should fall back to the app's own login page.
 */
export function resolveLogoutRedirect(
  raw: string | null,
  isProd: boolean,
): string | null {
  if (raw === null || raw === "") return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  const { hostname, protocol } = url;

  // Prod targets: HTTPS only, default port only, *.ops-upgrade.net only.
  if (hostname === "ops-upgrade.net" || hostname.endsWith(".ops-upgrade.net")) {
    if (protocol !== "https:") return null;
    if (url.port !== "") return null;
    return url.origin;
  }

  // Dev-only: also allow localhost over http/https so the local ops-upgrade
  // dev server (e.g. http://localhost:3001) round-trips.
  if (!isProd && hostname === "localhost") {
    if (protocol === "http:" || protocol === "https:") return url.origin;
  }

  return null;
}
