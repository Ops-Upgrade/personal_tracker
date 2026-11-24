// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as resetPasswordPOST } from "@/app/api/auth/reset-password/route";
import { POST as recoveryDataPOST } from "@/app/api/auth/recovery-data/route";
import { generateResetToken, verifyResetToken } from "@ops-upgrade/auth-core/defense";

/**
 * Tier 1 — recovery-route enumeration parity and error opacity (GREEN pins).
 *
 * Both recovery routes are the only public surface besides login, so they
 * must be indistinguishable across input classes:
 *  - reset-password: invalid token / unknown email / token-user mismatch /
 *    reused token all return the identical `{ error: "Invalid request." }`
 *    + 400.
 *  - recovery-data: unknown email returns deterministic dummy data with the
 *    same field names as a real payload.
 *  - malformed input fails fast (400) without touching the admin DB client.
 *
 * Only the defense module's Upstash-touching factories and the admin
 * client are mocked; the real token helpers (HMAC + single-use consumption)
 * are under test via an in-memory consumed store.
 */

const { state, adminClient, limitMock, consumedStoreMock } = vi.hoisted(() => {
  const state = {
    keyRow: null as Record<string, unknown> | null,
    lookupError: null as { message: string } | null,
    updates: [] as Array<Record<string, unknown>>,
    passwordUpdates: [] as Array<{ id: string; attrs: Record<string, unknown> }>,
    blocked: false,
    consumedKeys: new Set<string>(),
  };

  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "single"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn(async () =>
    state.lookupError
      ? { data: null, error: state.lookupError }
      : { data: state.keyRow, error: null }
  );
  builder.update = vi.fn((payload: Record<string, unknown>) => {
    state.updates.push(payload);
    return builder;
  });
  // `createAdminClient()` is called synchronously (never awaited), so the
  // admin builder may safely be thenable — the update chain ends with a
  // bare `await builder`.
  builder.then = (resolve: (v: unknown) => void) =>
    Promise.resolve({ data: null, error: null }).then(resolve);

  const adminClient = {
    from: vi.fn(() => builder),
    auth: {
      admin: {
        updateUserById: vi.fn(
          async (id: string, attrs: Record<string, unknown>) => {
            state.passwordUpdates.push({ id, attrs });
            return { error: null };
          }
        ),
      },
    },
  };

  const limitMock = vi.fn(async () => ({
    success: !state.blocked,
    limit: 5,
    remaining: 4,
    reset: Date.now(),
  }));

  const consumedStoreMock = {
    async addConsumed(key: string) {
      if (state.consumedKeys.has(key)) return false;
      state.consumedKeys.add(key);
      return true;
    },
  };

  return { state, adminClient, limitMock, consumedStoreMock };
});

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: vi.fn(() => adminClient),
}));

vi.mock("@ops-upgrade/auth-core/defense", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@ops-upgrade/auth-core/defense")
  >();
  return {
    ...actual,
    ipLimiter: vi.fn(() => ({ limit: limitMock })),
    emailLimiter: vi.fn(() => ({ limit: limitMock })),
    createUpstashConsumedStore: vi.fn(() => consumedStoreMock),
  };
});

const RESET_GENERIC = "Invalid request.";
const RECOVERY_GENERIC =
  "If this account exists and has a recovery key, you may reset your password.";

function post(route: string, body: unknown) {
  return new Request(`http://localhost${route}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-real-ip": "203.0.113.7",
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret-for-reset-tokens");
  state.keyRow = null;
  state.lookupError = null;
  state.updates = [];
  state.passwordUpdates = [];
  state.blocked = false;
  state.consumedKeys.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("reset-password enumeration parity", () => {
  const baseBody = {
    email: "user@example.com",
    reset_token: "irrelevant",
    new_password: "new-password",
    new_salt: "s",
    new_iv: "i",
    new_wrapped_dek: "w",
  };

  it("returns the identical generic response for an invalid token", async () => {
    const res = await resetPasswordPOST(post("/api/auth/reset-password", baseBody));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: RESET_GENERIC });
  });

  it("returns the identical generic response for an unknown email", async () => {
    // A valid token, but no user_keys row for the email.
    const body = { ...baseBody, reset_token: generateResetToken("user-unknown") };
    state.keyRow = null;

    const res = await resetPasswordPOST(post("/api/auth/reset-password", body));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: RESET_GENERIC });
  });

  it("returns the identical generic response when the token user mismatches the email", async () => {
    const body = { ...baseBody, reset_token: generateResetToken("user-other") };
    state.keyRow = { user_id: "user-real" };

    const res = await resetPasswordPOST(post("/api/auth/reset-password", body));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: RESET_GENERIC });
  });

  it("returns the identical generic response when a consumed token is reused", async () => {
    const token = generateResetToken("user-real");
    state.keyRow = { user_id: "user-real" };

    const first = await resetPasswordPOST(
      post("/api/auth/reset-password", { ...baseBody, reset_token: token })
    );
    expect(first.status).toBe(200);

    const replay = await resetPasswordPOST(
      post("/api/auth/reset-password", { ...baseBody, reset_token: token })
    );
    expect(replay.status).toBe(400);
    expect(await replay.json()).toEqual({ error: RESET_GENERIC });
  });

  it("fails fast on malformed input without touching the admin client", async () => {
    const res = await resetPasswordPOST(
      post("/api/auth/reset-password", { email: "user@example.com" })
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: RESET_GENERIC });
    expect(adminClient.from).not.toHaveBeenCalled();
  });

  it("completes the reset when the token matches the account", async () => {
    const body = { ...baseBody, reset_token: generateResetToken("user-real") };
    state.keyRow = { user_id: "user-real" };

    const res = await resetPasswordPOST(post("/api/auth/reset-password", body));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(state.updates).toEqual([
      expect.objectContaining({
        salt: "s",
        iv: "i",
        wrapped_dek: "w",
      }),
    ]);
    expect(state.passwordUpdates).toEqual([
      { id: "user-real", attrs: { password: "new-password" } },
    ]);
  });

  it("rate-limits at 429 with a uniform message", async () => {
    state.blocked = true;

    const res = await resetPasswordPOST(post("/api/auth/reset-password", baseBody));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({
      error: "Too many requests. Please try again later.",
    });
  });
});

describe("recovery-data enumeration parity", () => {
  it("returns deterministic dummy data for an unknown email", async () => {
    const res = await recoveryDataPOST(
      post("/api/auth/recovery-data", { email: "ghost@example.com" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(Object.keys(body).sort()).toEqual(
      ["recovery_salt", "recovery_iv", "recovery_wrapped_dek", "reset_token"].sort()
    );
    for (const value of Object.values(body)) {
      expect(typeof value).toBe("string");
    }

    // Deterministic: the HKDF-derived fields are byte-identical across
    // repeated probes for the same email, and the token verifies against
    // the same deterministic dummy user id. (Only the token's embedded
    // expiry timestamp advances, which reveals nothing to a prober.)
    const res2 = await recoveryDataPOST(
      post("/api/auth/recovery-data", { email: "ghost@example.com" })
    );
    const body2 = await res2.json();
    expect(body2.recovery_salt).toBe(body.recovery_salt);
    expect(body2.recovery_iv).toBe(body.recovery_iv);
    expect(body2.recovery_wrapped_dek).toBe(body.recovery_wrapped_dek);
    expect(verifyResetToken(body.reset_token)).not.toBeNull();
  });

  it("returns real recovery data with a token that verifies for the real user", async () => {
    state.keyRow = {
      user_id: "user-real",
      recovery_salt: "s",
      recovery_iv: "i",
      recovery_wrapped_dek: "w",
    };

    const res = await recoveryDataPOST(
      post("/api/auth/recovery-data", { email: "real@example.com" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(
      expect.objectContaining({
        recovery_salt: "s",
        recovery_iv: "i",
        recovery_wrapped_dek: "w",
      })
    );
    expect(verifyResetToken(body.reset_token)).toEqual({ userId: "user-real" });
  });

  it("returns the dummy shape for an existing account without a recovery key", async () => {
    state.keyRow = { user_id: "user-real", recovery_wrapped_dek: null };

    const res = await recoveryDataPOST(
      post("/api/auth/recovery-data", { email: "nokey@example.com" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(
      ["recovery_salt", "recovery_iv", "recovery_wrapped_dek", "reset_token"].sort()
    );
  });

  it("fails fast on a malformed email without touching the admin client", async () => {
    const res = await recoveryDataPOST(
      post("/api/auth/recovery-data", { email: "not-an-email" })
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: RECOVERY_GENERIC });
    expect(adminClient.from).not.toHaveBeenCalled();
  });

  it("rate-limits at 429 with a uniform message", async () => {
    state.blocked = true;

    const res = await recoveryDataPOST(
      post("/api/auth/recovery-data", { email: "ghost@example.com" })
    );
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({
      error: "Too many requests. Please try again later.",
    });
  });
});
