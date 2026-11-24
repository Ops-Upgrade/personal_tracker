import { NextResponse } from "next/server";
import {
  consumeLoginTicket,
  createGlobalMonitor,
  createLoginGuard,
  createUpstashConsumedStore,
  createUpstashDistinctStore,
  createUpstashLoginGuardStore,
  ipLimiter,
  normalizeEmail,
  verifyAccessToken,
} from "@ops-upgrade/auth-core/defense";

/**
 * Login result recorder (public route).
 *
 * Ticket-bound and single-use: the email comes ONLY from the verified
 * ticket payload, never from the request body. A "success" report only
 * clears the account's failure budget when backed by a valid access
 * token for that same account. All responses are uniform; failures are
 * recorded with auth-core's guard and global monitor.
 */

const TOO_MANY = "Too many requests. Please try again later.";
const INVALID_REQUEST = "Invalid request.";

const loginGuard = createLoginGuard(createUpstashLoginGuardStore());
const globalMonitor = createGlobalMonitor(createUpstashDistinctStore());
const ticketStore = createUpstashConsumedStore();

function clientIp(request: Request): string {
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for") ??
    "anonymous"
  );
}

export async function POST(request: Request) {
  let ticket = "";
  let outcome = "";
  let accessToken = "";
  try {
    const body = await request.json();
    ticket = typeof body.ticket === "string" ? body.ticket : "";
    outcome = typeof body.outcome === "string" ? body.outcome : "";
    accessToken =
      typeof body.accessToken === "string" ? body.accessToken : "";
  } catch {
    return NextResponse.json({ error: INVALID_REQUEST }, { status: 400 });
  }

  if (!ticket || (outcome !== "success" && outcome !== "failure")) {
    return NextResponse.json({ error: INVALID_REQUEST }, { status: 400 });
  }

  const ipResult = await ipLimiter().limit(clientIp(request));
  if (!ipResult.success) {
    return NextResponse.json(
      { error: TOO_MANY },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.max(1, Math.ceil((ipResult.reset - Date.now()) / 1000))
          ),
        },
      }
    );
  }

  const consumed = await consumeLoginTicket(ticket, ticketStore);
  if (!consumed) {
    return NextResponse.json({ error: INVALID_REQUEST }, { status: 400 });
  }
  const email = consumed.email;

  if (outcome === "success") {
    // Only a real sign-in can prove success: require a valid access token
    // for the ticket's account before clearing the failure budget.
    const claims = accessToken ? await verifyAccessToken(accessToken) : null;
    if (claims?.email && normalizeEmail(claims.email) === email) {
      await loginGuard.recordSuccess(email);
    }
    return NextResponse.json({ ok: true });
  }

  await loginGuard.recordFailure(email);
  await globalMonitor.recordFailure(email);
  return NextResponse.json({ ok: true });
}
