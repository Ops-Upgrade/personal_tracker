import { NextResponse } from "next/server";
import {
  createLoginGuard,
  createUpstashLoginGuardStore,
  ipLimiter,
  mintLoginTicket,
} from "@ops-upgrade/auth-core/defense";

/**
 * Login pre-flight guard (public route).
 *
 * Issues a short-lived single-use ticket when the account is not
 * throttled, and a uniform 429 with Retry-After when it is. All throttle
 * logic and thresholds live in auth-core — this file carries none.
 * No account-existence checks are made anywhere; responses and timing
 * stay uniform.
 */

const TOO_MANY = "Too many requests. Please try again later.";
const INVALID_REQUEST = "Invalid request.";
const SERVER_ERROR = "Something went wrong. Please try again.";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const loginGuard = createLoginGuard(createUpstashLoginGuardStore());

function clientIp(request: Request): string {
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for") ??
    "anonymous"
  );
}

export async function POST(request: Request) {
  let email = "";
  try {
    const body = await request.json();
    email = typeof body.email === "string" ? body.email : "";
  } catch {
    return NextResponse.json({ error: INVALID_REQUEST }, { status: 400 });
  }

  email = email.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
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

  const retryAfterMs = await loginGuard.retryAfterMs(email);
  if (retryAfterMs > 0) {
    return NextResponse.json(
      { error: TOO_MANY },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
      }
    );
  }

  try {
    const ticket = mintLoginTicket(email);
    return NextResponse.json({ ticket });
  } catch {
    return NextResponse.json({ error: SERVER_ERROR }, { status: 500 });
  }
}
