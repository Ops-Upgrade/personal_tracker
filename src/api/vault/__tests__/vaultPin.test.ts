// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkVaultPinSet,
  resetVaultPin,
  setVaultPin,
  verifyVaultPin,
} from "@/api/vault/vaultPin";

/**
 * Tier 1-C — vault PIN verification (cumulative failure policy).
 *
 * The 4-digit PIN is protected by a cumulative failure counter with slow
 * decay and a permanent lockout cap, plus a password re-authentication gate
 * on PIN reset (a fresh password-grant access token must be presented).
 * The suite drives the policy end to end with a mocked Supabase client and
 * a deterministic Argon2id stand-in.
 */

const { argon2idMock, createClientMock, state, CORRECT_HASH, hashOf } = vi.hoisted(() => {
  // Deterministic stand-in for argon2id. Hash depends on the password only:
  // the production code base64-decodes the salt before calling, so the mock
  // receives bytes — for these tests the only property that matters is that
  // a wrong PIN produces a different digest than the stored one.
  const hashOf = (password: string): string => {
    const buf = Buffer.alloc(32);
    Buffer.from(password).copy(buf);
    return buf.toString("base64");
  };
  const CORRECT_HASH = hashOf("1234");
  const argon2idMock = vi.fn(async ({ password }: { password: string }) =>
    new Uint8Array(Buffer.from(hashOf(password), "base64")),
  );

  const state = {
    sessionClaims: { sub: "u-session" } as Record<string, unknown> | null,
    tokenClaims: null as Record<string, unknown> | null,
    tokenError: null as { message: string } | null,
    keysRow: null as Record<string, unknown> | null,
    selectError: null as { message: string } | null,
    updates: [] as Array<Record<string, unknown>>,
    eqArgs: [] as unknown[][],
  };

  const builder: Record<string, unknown> = {};
  builder.auth = {
    // No-arg / falsy-token call: mirrors GoTrueClient — getClaims falls back
    // to the cookie session. Token call: verification of a presented access
    // token (the PIN-reset re-auth proof).
    getClaims: vi.fn(async (token?: string) => {
      if (!token) {
        return state.sessionClaims
          ? { data: { claims: state.sessionClaims }, error: null }
          : { data: null, error: { message: "no session" } };
      }
      if (state.tokenError) return { data: null, error: state.tokenError };
      return state.tokenClaims
        ? { data: { claims: state.tokenClaims }, error: null }
        : { data: null, error: { message: "invalid token" } };
    }),
  };
  builder.from = vi.fn(() => builder);
  builder.select = vi.fn(() => builder);
  builder.update = vi.fn((payload: Record<string, unknown>) => {
    state.updates.push(payload);
    return builder;
  });
  builder.eq = vi.fn((...args: unknown[]) => {
    state.eqArgs.push(args);
    return builder;
  });
  builder.maybeSingle = vi.fn(async () =>
    state.selectError
      ? { data: null, error: state.selectError }
      : { data: state.keysRow, error: null },
  );

  return { argon2idMock, createClientMock: vi.fn(async () => builder), state, CORRECT_HASH, hashOf };
});

vi.mock("hash-wasm", () => ({ argon2id: argon2idMock }));
vi.mock("@ops-upgrade/auth-core", () => ({ createServerClient: createClientMock }));

function seedKeys(overrides: Record<string, unknown> = {}) {
  state.keysRow = {
    vault_pin_hash: CORRECT_HASH,
    vault_pin_salt: "c2FsdA==",
    vault_failed_attempts: 0,
    vault_last_failed_at: null,
    vault_locked_out: false,
    ...overrides,
  };
}

/** A fresh password-grant access token (amr password entry minted now). */
function freshPasswordToken(overrides: Record<string, unknown> = {}) {
  state.tokenClaims = {
    sub: "u-session",
    exp: Math.floor(Date.now() / 1000) + 3600,
    amr: [{ method: "password", timestamp: Math.floor(Date.now() / 1000) }],
    ...overrides,
  };
  state.tokenError = null;
}

function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

beforeEach(() => {
  vi.clearAllMocks();
  state.sessionClaims = { sub: "u-session" };
  state.tokenClaims = null;
  state.tokenError = null;
  state.keysRow = null;
  state.selectError = null;
  state.updates = [];
  state.eqArgs = [];
});

describe("session derivation", () => {
  it("rejects every action when no session exists", async () => {
    state.sessionClaims = null;

    await expect(checkVaultPinSet()).rejects.toThrow(
      "Session check failed. Please log in again.",
    );
    await expect(verifyVaultPin("1234")).rejects.toThrow(
      "Session check failed. Please log in again.",
    );
    await expect(setVaultPin("1234")).rejects.toThrow(
      "Session check failed. Please log in again.",
    );
    freshPasswordToken();
    await expect(resetVaultPin("5555", "fresh-token")).rejects.toThrow(
      "Session check failed. Please log in again.",
    );
  });
});

describe("checkVaultPinSet", () => {
  it("reports whether a PIN hash exists for the session user", async () => {
    seedKeys();
    await expect(checkVaultPinSet()).resolves.toBe(true);
    seedKeys({ vault_pin_hash: null });
    await expect(checkVaultPinSet()).resolves.toBe(false);

    // Both reads target the session-derived user — no caller-supplied id.
    expect(state.eqArgs).toEqual([
      ["user_id", "u-session"],
      ["user_id", "u-session"],
    ]);
  });

  it("rejects with an opaque message on Supabase read errors", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    state.selectError = { message: "SENTINEL_RAW_DETAIL" };
    await expect(checkVaultPinSet()).rejects.toThrow("Failed to check PIN status.");
    errorSpy.mockRestore();
  });
});

describe("verifyVaultPin — cumulative failure policy", () => {
  it("accepts a correct PIN and clears the counter", async () => {
    seedKeys();
    await expect(verifyVaultPin("1234")).resolves.toEqual({ success: true });
    expect(state.updates).toEqual([
      expect.objectContaining({
        vault_failed_attempts: 0,
        vault_last_failed_at: null,
      }),
    ]);
    expect(state.eqArgs[0]).toEqual(["user_id", "u-session"]);
  });

  it("rejects a wrong PIN with the remaining attempts", async () => {
    seedKeys();
    const result = await verifyVaultPin("0000");
    expect(result).toEqual({ success: false, attemptsLeft: 29, lockedOut: false });
    expect(state.updates).toEqual([
      expect.objectContaining({
        vault_failed_attempts: 1,
        vault_locked_out: false,
      }),
    ]);
  });

  it("locks out permanently when the cumulative counter reaches the cap", async () => {
    seedKeys({ vault_failed_attempts: 29 });
    const result = await verifyVaultPin("0000");
    expect(result).toEqual({ success: false, attemptsLeft: 0, lockedOut: true });
    expect(state.updates).toEqual([
      expect.objectContaining({
        vault_failed_attempts: 30,
        vault_locked_out: true,
      }),
    ]);
  });

  it("rejects immediately while locked out, without hashing the PIN", async () => {
    seedKeys({ vault_locked_out: true });
    await expect(verifyVaultPin("1234")).resolves.toEqual({
      success: false,
      lockedOut: true,
    });
    expect(argon2idMock).not.toHaveBeenCalled();
  });

  it("decays one attempt per full quiet hour (pacing cannot accumulate)", async () => {
    seedKeys({ vault_failed_attempts: 9, vault_last_failed_at: hoursAgoIso(11) });
    const result = await verifyVaultPin("0000");
    // 9 - 11h of decay = 0, then +1 for this failure.
    expect(result).toEqual({ success: false, attemptsLeft: 29, lockedOut: false });
    expect(state.updates).toEqual([
      expect.objectContaining({ vault_failed_attempts: 1 }),
    ]);
  });

  it("decays only whole hours", async () => {
    seedKeys({ vault_failed_attempts: 9, vault_last_failed_at: hoursAgoIso(1.5) });
    const result = await verifyVaultPin("0000");
    // 9 - floor(1.5h) = 8, then +1.
    expect(result).toEqual({ success: false, attemptsLeft: 21, lockedOut: false });
    expect(state.updates).toEqual([
      expect.objectContaining({ vault_failed_attempts: 9 }),
    ]);
  });

  it("accepts the correct PIN after the counter has decayed", async () => {
    seedKeys({ vault_failed_attempts: 9, vault_last_failed_at: hoursAgoIso(11) });
    await expect(verifyVaultPin("1234")).resolves.toEqual({ success: true });
    expect(state.updates).toEqual([
      expect.objectContaining({
        vault_failed_attempts: 0,
        vault_last_failed_at: null,
      }),
    ]);
  });

  it("does not inflate the counter when the stored failure time is in the future", async () => {
    const futureIso = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    seedKeys({ vault_failed_attempts: 9, vault_last_failed_at: futureIso });
    const result = await verifyVaultPin("0000");
    // Clock skew: elapsed time clamps at 0 — no decay, no inflation: 9 + 1.
    expect(result).toEqual({ success: false, attemptsLeft: 20, lockedOut: false });
    expect(state.updates).toEqual([
      expect.objectContaining({ vault_failed_attempts: 10 }),
    ]);
  });

  it("enforces the hard floor even if the stored lock flag was never set", async () => {
    seedKeys({ vault_failed_attempts: 30, vault_last_failed_at: null });
    await expect(verifyVaultPin("1234")).resolves.toEqual({
      success: false,
      lockedOut: true,
    });
    expect(argon2idMock).not.toHaveBeenCalled();
    expect(state.updates).toEqual([
      expect.objectContaining({ vault_locked_out: true }),
    ]);
  });

  it("throws when no PIN has been set", async () => {
    seedKeys({ vault_pin_hash: null });
    await expect(verifyVaultPin("1234")).rejects.toThrow(
      "No PIN has been set for this user.",
    );
  });

  it("rejects with an opaque message on Supabase read errors", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    state.selectError = { message: "SENTINEL_RAW_DETAIL" };
    await expect(verifyVaultPin("1234")).rejects.toThrow("Failed to verify PIN.");
    errorSpy.mockRestore();
  });
});

describe("setVaultPin", () => {
  it("stores a fresh salt + hash for the session user and clears counters", async () => {
    seedKeys({ vault_pin_hash: null });
    await setVaultPin("4321");

    expect(state.updates).toEqual([
      expect.objectContaining({
        vault_pin_hash: hashOf("4321"),
        vault_failed_attempts: 0,
        vault_last_failed_at: null,
        vault_locked_out: false,
      }),
    ]);
    expect(state.eqArgs[0]).toEqual(["user_id", "u-session"]);
  });

  it("refuses to overwrite an existing PIN", async () => {
    seedKeys();
    await expect(setVaultPin("4321")).rejects.toThrow(
      "PIN is already set. Use the reset flow to change it.",
    );
  });
});

describe("resetVaultPin — password re-authentication gate", () => {
  it("resets the PIN and clears the lockout for a fresh password re-auth", async () => {
    seedKeys({ vault_locked_out: true, vault_failed_attempts: 30 });
    freshPasswordToken();

    await resetVaultPin("5555", "fresh-token");

    expect(state.updates).toEqual([
      expect.objectContaining({
        vault_pin_hash: hashOf("5555"),
        vault_failed_attempts: 0,
        vault_last_failed_at: null,
        vault_locked_out: false,
      }),
    ]);
    expect(state.eqArgs[0]).toEqual(["user_id", "u-session"]);
  });

  it("rejects a token whose password re-auth is outside the window", async () => {
    seedKeys();
    freshPasswordToken({
      amr: [
        { method: "password", timestamp: Math.floor(Date.now() / 1000) - 11 * 60 },
      ],
    });

    await expect(resetVaultPin("5555", "stale-token")).rejects.toThrow(
      "Password verification failed. PIN reset denied.",
    );
    expect(state.updates).toEqual([]);
  });

  it("rejects a token without an amr claim", async () => {
    seedKeys();
    state.tokenClaims = {
      sub: "u-session",
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    await expect(resetVaultPin("5555", "no-amr")).rejects.toThrow(
      "Password verification failed. PIN reset denied.",
    );
    expect(state.updates).toEqual([]);
  });

  it("rejects a token whose only recent amr entry is a refresh", async () => {
    seedKeys();
    freshPasswordToken({
      amr: [
        { method: "password", timestamp: Math.floor(Date.now() / 1000) - 86400 },
        { method: "token_refresh", timestamp: Math.floor(Date.now() / 1000) },
      ],
    });

    await expect(resetVaultPin("5555", "refreshed-token")).rejects.toThrow(
      "Password verification failed. PIN reset denied.",
    );
    expect(state.updates).toEqual([]);
  });

  it("rejects a token for a different user", async () => {
    seedKeys();
    freshPasswordToken({ sub: "someone-else" });

    await expect(resetVaultPin("5555", "foreign-token")).rejects.toThrow(
      "Password verification failed. PIN reset denied.",
    );
    expect(state.updates).toEqual([]);
  });

  it("rejects a token that fails verification", async () => {
    seedKeys();
    state.tokenError = { message: "signature mismatch" };

    await expect(resetVaultPin("5555", "bad-token")).rejects.toThrow(
      "Password verification failed. PIN reset denied.",
    );
    expect(state.updates).toEqual([]);
  });

  it("rejects an empty token even when the session itself is freshly re-authed", async () => {
    seedKeys({ vault_locked_out: true });
    // The cookie session carries a recent password amr — without an explicit
    // empty-token guard, GoTrue's falsy-token fallback would validate THIS
    // session instead of the presented proof.
    state.sessionClaims = {
      sub: "u-session",
      amr: [{ method: "password", timestamp: Math.floor(Date.now() / 1000) }],
    };
    freshPasswordToken();

    await expect(resetVaultPin("5555", "")).rejects.toThrow(
      "Password verification failed. PIN reset denied.",
    );
    expect(state.updates).toEqual([]);
  });

  it("rejects amr entries in plain-string form (fail closed)", async () => {
    seedKeys();
    freshPasswordToken({ amr: ["password"] });

    await expect(resetVaultPin("5555", "string-amr")).rejects.toThrow(
      "Password verification failed. PIN reset denied.",
    );
    expect(state.updates).toEqual([]);
  });
});
