// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkVaultPinSet, verifyVaultPin } from "@/api/vault/vaultPin";

/**
 * Tier 1-C — vault PIN verification.
 * The only brute-force defence for a 4-digit PIN: sliding-window attempt
 * counting, the 10-attempt permanent lockout, and its hard gate before any
 * hashing happens.
 */

const { argon2idMock, createClientMock, state, CORRECT_HASH } = vi.hoisted(() => {
  // Deterministic stand-in for argon2id. Hash depends on the password only:
  // the production code base64-decodes the salt (fromBase64) before calling,
  // so the mock would receive bytes, not the stored column value — and for
  // these tests the only property that matters is that a wrong PIN produces
  // a different digest than the stored one.
  const mockHash = (password: string): string => {
    const buf = Buffer.alloc(32);
    Buffer.from(password).copy(buf);
    return buf.toString("base64");
  };
  const CORRECT_HASH = mockHash("1234");
  const argon2idMock = vi.fn(async ({ password }: { password: string }) =>
    new Uint8Array(Buffer.from(mockHash(password), "base64")),
  );

  const state = {
    keysRow: null as Record<string, unknown> | null,
    selectError: null as { message: string } | null,
    updates: [] as Array<Record<string, unknown>>,
  };

  const builder: Record<string, unknown> = {};
  builder.from = vi.fn(() => builder);
  builder.select = vi.fn(() => builder);
  builder.update = vi.fn((payload: Record<string, unknown>) => {
    state.updates.push(payload);
    return builder;
  });
  builder.eq = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () =>
    state.selectError
      ? { data: null, error: state.selectError }
      : { data: state.keysRow, error: null },
  );

  return { argon2idMock, createClientMock: vi.fn(async () => builder), state, CORRECT_HASH };
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

beforeEach(() => {
  vi.clearAllMocks();
  state.keysRow = null;
  state.selectError = null;
  state.updates = [];
});

describe("checkVaultPinSet", () => {
  it("reports whether a PIN hash exists", async () => {
    seedKeys();
    await expect(checkVaultPinSet("u1")).resolves.toBe(true);
    seedKeys({ vault_pin_hash: null });
    await expect(checkVaultPinSet("u1")).resolves.toBe(false);
  });
});

describe("verifyVaultPin", () => {
  it("accepts a correct PIN and resets the attempt counter", async () => {
    seedKeys();
    await expect(verifyVaultPin("u1", "1234")).resolves.toEqual({ success: true });
    expect(state.updates).toEqual([
      expect.objectContaining({
        vault_failed_attempts: 0,
        vault_last_failed_at: null,
      }),
    ]);
  });

  it("rejects a wrong PIN with the remaining attempts", async () => {
    seedKeys();
    const result = await verifyVaultPin("u1", "0000");
    expect(result).toEqual({ success: false, attemptsLeft: 9, lockedOut: false });
    expect(state.updates).toEqual([
      expect.objectContaining({
        vault_failed_attempts: 1,
        vault_locked_out: false,
      }),
    ]);
  });

  it("locks out permanently on the 10th wrong attempt", async () => {
    seedKeys({ vault_failed_attempts: 9 });
    const result = await verifyVaultPin("u1", "0000");
    expect(result).toEqual({ success: false, attemptsLeft: 0, lockedOut: true });
    expect(state.updates).toEqual([
      expect.objectContaining({
        vault_failed_attempts: 10,
        vault_locked_out: true,
      }),
    ]);
  });

  it("rejects immediately while locked out, without hashing the PIN", async () => {
    seedKeys({ vault_locked_out: true });
    await expect(verifyVaultPin("u1", "1234")).resolves.toEqual({
      success: false,
      lockedOut: true,
    });
    expect(argon2idMock).not.toHaveBeenCalled();
  });

  it("resets the counter when the last failure is outside the 10-minute window", async () => {
    const elevenMinutesAgo = new Date(Date.now() - 11 * 60 * 1000).toISOString();
    seedKeys({ vault_failed_attempts: 9, vault_last_failed_at: elevenMinutesAgo });

    await expect(verifyVaultPin("u1", "1234")).resolves.toEqual({ success: true });

    // Window reset followed by the success reset.
    expect(state.updates).toEqual([
      expect.objectContaining({
        vault_failed_attempts: 0,
        vault_last_failed_at: null,
      }),
      expect.objectContaining({
        vault_failed_attempts: 0,
        vault_last_failed_at: null,
      }),
    ]);
  });

  it("throws when no PIN has been set", async () => {
    seedKeys({ vault_pin_hash: null });
    await expect(verifyVaultPin("u1", "1234")).rejects.toThrow(
      "No PIN has been set for this user.",
    );
  });

  it("surfaces Supabase read errors", async () => {
    state.selectError = { message: "boom" };
    await expect(verifyVaultPin("u1", "1234")).rejects.toThrow(
      "Failed to verify PIN: boom",
    );
  });
});
