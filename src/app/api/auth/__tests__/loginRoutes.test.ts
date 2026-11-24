// @vitest-environment node
import { createHash } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as guardPOST } from "@/app/api/auth/login-guard/route";
import { POST as resultPOST } from "@/app/api/auth/login-result/route";
import { PUBLIC_ROUTES } from "@/routes/config";
import { API_PATHS } from "@/routes/paths";
import { verifyLoginTicket } from "@ops-upgrade/auth-core/defense";

/**
 * Tier 1 — thin route tests for the login guard/recorder.
 *
 * All defense logic and thresholds live in auth-core; these tests pin the
 * public surface only: route availability to unauthenticated clients
 * (PUBLIC_ROUTES membership — the proxy must not redirect them), uniform
 * response shapes, ticket-bound reporting, single-use tickets, and the
 * JWT-proof requirement for clearing the failure budget.
 */

const EMAIL = "user@example.com";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

const { state, limitMock, guardStoreMock, distinctStoreMock, consumedStoreMock, verifyAccessTokenMock } =
  vi.hoisted(() => {
    const state = {
      ipBlocked: false,
      guardFailures: new Map<string, { n: number; lastAt: number }>(),
      distinctMembers: [] as Array<{ key: string; member: string }>,
      consumedKeys: new Set<string>(),
      verifiedEmail: null as string | null,
    };

    const limitMock = vi.fn(async () => ({
      success: !state.ipBlocked,
      limit: 5,
      remaining: 4,
      reset: Date.now(),
    }));

    const guardStoreMock = {
      async recordFailure(key: string, nowMs: number, _ttlMs: number) {
        void _ttlMs; // in-memory store: expiry semantics live in auth-core tests
        const existing = state.guardFailures.get(key);
        if (!existing) {
          state.guardFailures.set(key, { n: 1, lastAt: nowMs });
          return { n: 1, lastAt: nowMs };
        }
        existing.n += 1;
        existing.lastAt = nowMs;
        return { n: existing.n, lastAt: existing.lastAt };
      },
      async getFailures(key: string) {
        return state.guardFailures.get(key) ?? null;
      },
      async clear(key: string) {
        state.guardFailures.delete(key);
      },
    };

    const distinctStoreMock = {
      async addDistinct(key: string, member: string, _ttlMs: number) {
        void _ttlMs; // in-memory store: expiry semantics live in auth-core tests
        state.distinctMembers.push({ key, member });
        return new Set(
          state.distinctMembers.filter((d) => d.key === key).map((d) => d.member)
        ).size;
      },
    };

    const consumedStoreMock = {
      async addConsumed(key: string) {
        if (state.consumedKeys.has(key)) return false;
        state.consumedKeys.add(key);
        return true;
      },
    };

    const verifyAccessTokenMock = vi.fn(async () =>
      state.verifiedEmail ? { email: state.verifiedEmail } : null
    );

    return {
      state,
      limitMock,
      guardStoreMock,
      distinctStoreMock,
      consumedStoreMock,
      verifyAccessTokenMock,
    };
  });

vi.mock("@ops-upgrade/auth-core/defense", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@ops-upgrade/auth-core/defense")
  >();
  return {
    ...actual,
    ipLimiter: vi.fn(() => ({ limit: limitMock })),
    createUpstashLoginGuardStore: vi.fn(() => guardStoreMock),
    createUpstashDistinctStore: vi.fn(() => distinctStoreMock),
    createUpstashConsumedStore: vi.fn(() => consumedStoreMock),
    verifyAccessToken: verifyAccessTokenMock,
  };
});

function post(route: string, body: unknown) {
  return new Request(`http://localhost${route}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": "203.0.113.7" },
    body: JSON.stringify(body),
  });
}

async function getTicket(): Promise<string> {
  const res = await guardPOST(post(API_PATHS.AUTH_LOGIN_GUARD, { email: EMAIL }));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(typeof body.ticket).toBe("string");
  return body.ticket;
}

const GUARD_KEY = `login:fail:${sha256(EMAIL)}`;

function seedThrottle(failures: number) {
  const now = Date.now();
  for (let i = 0; i < failures; i++) {
    const existing = state.guardFailures.get(GUARD_KEY);
    if (!existing) {
      state.guardFailures.set(GUARD_KEY, { n: 1, lastAt: now });
    } else {
      existing.n += 1;
      existing.lastAt = now;
    }
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("LOGIN_TICKET_SECRET", "test-ticket-secret-0123456789abcdef0123456789abcdef");
  state.ipBlocked = false;
  state.guardFailures.clear();
  state.distinctMembers = [];
  state.consumedKeys.clear();
  state.verifiedEmail = null;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("public availability (the proxy must not redirect)", () => {
  it("lists both auth endpoints in PUBLIC_ROUTES", () => {
    expect(PUBLIC_ROUTES).toContain(API_PATHS.AUTH_LOGIN_GUARD);
    expect(PUBLIC_ROUTES).toContain(API_PATHS.AUTH_LOGIN_RESULT);
  });

  it("answers an unauthenticated guard request directly (no redirect)", async () => {
    const res = await guardPOST(post(API_PATHS.AUTH_LOGIN_GUARD, { email: EMAIL }));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("answers an unauthenticated recorder request directly (no redirect)", async () => {
    const res = await resultPOST(
      post(API_PATHS.AUTH_LOGIN_RESULT, { ticket: "junk", outcome: "failure" })
    );
    expect(res.status).toBe(400);
    expect(res.headers.get("location")).toBeNull();
  });
});

describe("login-guard", () => {
  it("issues a verifiable ticket for a valid email", async () => {
    const ticket = await getTicket();
    expect(verifyLoginTicket(ticket)?.email).toBe(EMAIL);
  });

  it("rejects a malformed email with a uniform 400", async () => {
    const res = await guardPOST(
      post(API_PATHS.AUTH_LOGIN_GUARD, { email: "not-an-email" })
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid request." });
  });

  it("rejects a missing body with a uniform 400", async () => {
    const res = await guardPOST(
      new Request(`http://localhost${API_PATHS.AUTH_LOGIN_GUARD}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not-json",
      })
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid request." });
  });

  it("throttles a throttled account with a uniform 429 + Retry-After", async () => {
    seedThrottle(6);
    const res = await guardPOST(post(API_PATHS.AUTH_LOGIN_GUARD, { email: EMAIL }));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({
      error: "Too many requests. Please try again later.",
    });
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("allows a different account when one is throttled", async () => {
    seedThrottle(6);
    const res = await guardPOST(
      post(API_PATHS.AUTH_LOGIN_GUARD, { email: "other@example.com" })
    );
    expect(res.status).toBe(200);
  });

  it("rate-limits per IP with a uniform 429", async () => {
    state.ipBlocked = true;
    const res = await guardPOST(post(API_PATHS.AUTH_LOGIN_GUARD, { email: EMAIL }));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({
      error: "Too many requests. Please try again later.",
    });
  });
});

describe("login-result", () => {
  it("records a failure bound to the ticket's email", async () => {
    const ticket = await getTicket();
    const res = await resultPOST(
      post(API_PATHS.AUTH_LOGIN_RESULT, { ticket, outcome: "failure" })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    expect(state.guardFailures.get(GUARD_KEY)?.n).toBe(1);
    expect(state.distinctMembers.length).toBe(1);
  });

  it("rejects a replayed ticket with a uniform 400", async () => {
    const ticket = await getTicket();
    const first = await resultPOST(
      post(API_PATHS.AUTH_LOGIN_RESULT, { ticket, outcome: "failure" })
    );
    expect(first.status).toBe(200);

    const replay = await resultPOST(
      post(API_PATHS.AUTH_LOGIN_RESULT, { ticket, outcome: "failure" })
    );
    expect(replay.status).toBe(400);
    expect(await replay.json()).toEqual({ error: "Invalid request." });

    // The replay must not inflate the account's failure count.
    expect(state.guardFailures.get(GUARD_KEY)?.n).toBe(1);
  });

  it("rejects a tampered ticket with a uniform 400", async () => {
    const ticket = await getTicket();
    const [payload, sig] = ticket.split(".");
    const flipped = sig.endsWith("a") ? `${sig.slice(0, -1)}b` : `${sig.slice(0, -1)}a`;

    const res = await resultPOST(
      post(API_PATHS.AUTH_LOGIN_RESULT, {
        ticket: `${payload}.${flipped}`,
        outcome: "failure",
      })
    );
    expect(res.status).toBe(400);
    expect(state.guardFailures.size).toBe(0);
  });

  it("does not clear the budget on a success report without a verified token", async () => {
    seedThrottle(3);
    const ticket = await getTicket();

    const res = await resultPOST(
      post(API_PATHS.AUTH_LOGIN_RESULT, { ticket, outcome: "success" })
    );
    expect(res.status).toBe(200);
    expect(state.guardFailures.get(GUARD_KEY)?.n).toBe(3);
  });

  it("does not clear the budget when the token belongs to a different account", async () => {
    seedThrottle(3);
    state.verifiedEmail = "someone-else@example.com";
    const ticket = await getTicket();

    const res = await resultPOST(
      post(API_PATHS.AUTH_LOGIN_RESULT, {
        ticket,
        outcome: "success",
        accessToken: "forged",
      })
    );
    expect(res.status).toBe(200);
    expect(state.guardFailures.get(GUARD_KEY)?.n).toBe(3);
  });

  it("clears the budget when a verified token matches the ticket account", async () => {
    seedThrottle(3);
    state.verifiedEmail = EMAIL;
    const ticket = await getTicket();

    const res = await resultPOST(
      post(API_PATHS.AUTH_LOGIN_RESULT, {
        ticket,
        outcome: "success",
        accessToken: "valid-jwt",
      })
    );
    expect(res.status).toBe(200);
    expect(state.guardFailures.has(GUARD_KEY)).toBe(false);
  });

  it("rejects an invalid outcome with a uniform 400", async () => {
    const ticket = await getTicket();
    const res = await resultPOST(
      post(API_PATHS.AUTH_LOGIN_RESULT, { ticket, outcome: "whatever" })
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid request." });
  });

  it("rate-limits per IP with a uniform 429", async () => {
    const ticket = await getTicket();
    state.ipBlocked = true;
    const res = await resultPOST(
      post(API_PATHS.AUTH_LOGIN_RESULT, { ticket, outcome: "failure" })
    );
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({
      error: "Too many requests. Please try again later.",
    });
    expect(state.guardFailures.size).toBe(0);
  });
});
