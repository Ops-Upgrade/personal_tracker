// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { login } from "@/api/auth/auth";

/**
 * Tier 1 — login() enumeration parity, error opacity, and timing parity.
 *
 * login() is the unauthenticated entry point of the app. An attacker can
 * compare its responses (and their timing) across input classes to learn
 * whether an email exists or is confirmed. This suite pins three Phase 3
 * properties:
 *
 *  1. Enumeration parity — every Supabase failure code maps to the SAME
 *     `{ success: false, errorCode: "invalid_credentials" }`, whether the
 *     cause was an unknown email, a wrong password, or an unconfirmed
 *     account.
 *  2. Error opacity — no raw Supabase/crypto error detail is ever returned.
 *  3. Timing parity — the expensive crypto bootstrap runs ONLY on success,
 *     so no failure class is observably slower than another.
 */

const { signInMock, bootstrapMock } = vi.hoisted(() => ({
  signInMock: vi.fn(),
  bootstrapMock: vi.fn(async () => {}),
}));

vi.mock("@ops-upgrade/auth-core", () => ({
  createBrowserClient: vi.fn(() => ({
    auth: { signInWithPassword: signInMock },
  })),
}));

vi.mock("@/lib/crypto", () => ({
  bootstrapCrypto: bootstrapMock,
  clearDEK: vi.fn(),
  rewrapDEK: vi.fn(),
}));

/** Every Supabase auth failure code an attacker could provoke on login. */
const SUPABASE_FAILURE_CODES = [
  "invalid_login_credentials", // unknown email AND wrong password
  "email_not_confirmed", // confirmed-email gate
  "user_banned",
  "over_request_rate_limit",
  "generic_network_failure",
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("login() enumeration parity", () => {
  for (const code of SUPABASE_FAILURE_CODES) {
    it(`maps Supabase error "${code}" to the uniform failure result`, async () => {
      signInMock.mockResolvedValue({
        data: null,
        error: { code, message: "raw supabase detail" },
      });

      await expect(login("user@example.com", "pw")).resolves.toEqual({
        success: false,
        errorCode: "invalid_credentials",
      });
    });
  }

  it("returns identical results for unknown email, wrong password, and unconfirmed account", async () => {
    const run = (code: string) => {
      signInMock.mockResolvedValue({
        data: null,
        error: { code, message: `detail-${code}` },
      });
      return login("user@example.com", "pw");
    };

    const unknownEmail = await run("invalid_login_credentials");
    const wrongPassword = await run("invalid_login_credentials");
    const unconfirmed = await run("email_not_confirmed");

    expect(wrongPassword).toEqual(unknownEmail);
    expect(unconfirmed).toEqual(unknownEmail);
  });

  it("returns no raw Supabase or crypto error detail in any field", async () => {
    signInMock.mockResolvedValue({
      data: null,
      error: { code: "invalid_login_credentials", message: "SENTINEL_RAW_DETAIL" },
    });

    const result = await login("user@example.com", "pw");
    expect(JSON.stringify(result)).not.toContain("SENTINEL_RAW_DETAIL");
    expect(Object.keys(result)).toEqual(["success", "errorCode"]);
  });
});

describe("login() timing parity", () => {
  it("never runs the crypto bootstrap on any failure path", async () => {
    signInMock.mockResolvedValue({
      data: null,
      error: { code: "email_not_confirmed" },
    });

    await login("user@example.com", "pw");
    expect(bootstrapMock).not.toHaveBeenCalled();
  });

  it("runs the crypto bootstrap exactly once, and only on success", async () => {
    signInMock.mockResolvedValue({
      data: { session: { user: { id: "u1" } } },
    });

    await expect(login("user@example.com", "pw")).resolves.toEqual({
      success: true,
    });
    expect(bootstrapMock).toHaveBeenCalledTimes(1);
    expect(bootstrapMock).toHaveBeenCalledWith("u1", "pw", "user@example.com");
  });

  it("treats a missing user id as a failure without crypto work", async () => {
    signInMock.mockResolvedValue({ data: { session: null } });

    await expect(login("user@example.com", "pw")).resolves.toEqual({
      success: false,
      errorCode: "unknown",
    });
    expect(bootstrapMock).not.toHaveBeenCalled();
  });

  it("returns a fixed error code when the crypto bootstrap itself fails", async () => {
    signInMock.mockResolvedValue({
      data: { session: { user: { id: "u1" } } },
    });
    bootstrapMock.mockRejectedValue(new Error("SENTINEL_CRYPTO_DETAIL"));

    const result = await login("user@example.com", "pw");
    expect(result).toEqual({ success: false, errorCode: "crypto_setup_failed" });
    expect(JSON.stringify(result)).not.toContain("SENTINEL_CRYPTO_DETAIL");
  });
});
