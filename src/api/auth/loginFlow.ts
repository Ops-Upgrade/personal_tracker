import { API_PATHS } from "@/routes/paths";

/**
 * Client-side calls to the login guard/recorder endpoints.
 *
 * The guard is called BEFORE signInWithPassword; the recorder is
 * fire-and-forget (keepalive) and must never block or fail a login.
 */

export interface LoginGuardOutcome {
  allowed: boolean;
  ticket: string | null;
  retryAfterSec: number | null;
}

export async function requestLoginGuard(
  email: string
): Promise<LoginGuardOutcome> {
  try {
    const res = await fetch(API_PATHS.AUTH_LOGIN_GUARD, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (res.ok) {
      const body: unknown = await res.json();
      const ticket =
        typeof body === "object" && body !== null && "ticket" in body
          ? String((body as { ticket: unknown }).ticket)
          : "";
      return {
        allowed: true,
        ticket: ticket || null,
        retryAfterSec: null,
      };
    }

    const retryAfter = res.headers.get("retry-after");
    return {
      allowed: false,
      ticket: null,
      retryAfterSec: retryAfter ? Number(retryAfter) || null : null,
    };
  } catch {
    // Fail open: if the guard is unreachable, let the login proceed.
    return { allowed: true, ticket: null, retryAfterSec: null };
  }
}

/**
 * Report the login outcome. Fire-and-forget with keepalive: the promise
 * is deliberately unawaited at the call site and every failure is
 * swallowed — reporting must never block or fail a login.
 */
export function reportLoginResult(
  ticket: string | null,
  outcome: "success" | "failure",
  accessToken?: string
): void {
  if (!ticket) return;

  void fetch(API_PATHS.AUTH_LOGIN_RESULT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ticket, outcome, accessToken }),
    keepalive: true,
  }).catch(() => {
    // Reporting is best-effort by design.
  });
}
