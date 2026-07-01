import { createClient } from "@/lib/supabase/client";

/**
 * Module-level cache for the server year.
 * Once resolved, the year won't change within a single browser session,
 * so we avoid redundant RPC calls.
 */
let cachedYear: number | null = null;

/**
 * Returns the current year from the Supabase PostgreSQL server
 * via the `get_server_year` RPC function.
 *
 * Falls back to the device clock if the RPC call fails (e.g. network
 * error, function not yet deployed, etc.).
 *
 * The result is cached for the lifetime of the page session.
 */
export async function getServerYear(): Promise<number> {
  if (cachedYear !== null) return cachedYear;

  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("get_server_year").single();

    if (!error && typeof data === "number") {
      cachedYear = data;
      return data;
    }
    // RPC returned an unexpected shape — fall through to fallback.
  } catch {
    // Network failure or other exception — fall through to fallback.
  }

  cachedYear = new Date().getFullYear();
  return cachedYear;
}

/**
 * Resets the cached year. Useful if the app stays open across
 * a year boundary and the user triggers a manual refresh.
 */
export function resetServerYearCache(): void {
  cachedYear = null;
}
