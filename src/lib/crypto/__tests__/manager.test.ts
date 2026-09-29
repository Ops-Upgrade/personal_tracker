// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@ops-upgrade/auth-core";
import { fetchUserKeys, getSession, insertUserKeys, upsertUserKeys } from "@/api/auth";
import { saveDEK } from "@/lib/crypto/store";
import { bootstrapCrypto, generateRecoveryPhrase, rewrapDEK } from "@/lib/crypto/manager";
import {
  decrypt,
  deriveKEK,
  encrypt,
  generateDEK,
  generateSalt,
  unwrapDEK,
  wrapDEK,
} from "@/lib/crypto/primitives";

/**
 * Tier 1 — crypto manager (rewrapDEK + recovery phrase).
 *
 * The critical property under test is atomicity: a password change must not
 * lock the user out of their own encrypted data. If the Supabase write fails,
 * the old user_keys row stays intact (old password still works) and
 * IndexedDB must not be overwritten with a key derived from a bundle that was
 * never saved.
 *
 * Argon2id is mocked with a password/salt-sensitive deterministic stand-in
 * (FNV-1a mixing, pure JS — the real KDF's parameters and WASM are out of
 * scope). A fixed-output mock would make every password derive the *same*
 * KEK, silently defeating the wrong-password test. The wrapped-DEK bundle is
 * built once in `beforeAll` with the REAL primitives, so wrap/unwrap and
 * encrypt/decrypt all run through genuine Web Crypto.
 */

vi.mock("hash-wasm", () => ({
  argon2id: vi.fn(
    async ({ password, salt }: { password: string; salt: Uint8Array }) => {
      // Same inputs → same 32 bytes; different password or salt → different
      // bytes. FNV-1a over salt + password, expanded into 32 output bytes.
      const out = new Uint8Array(32);
      let h = 0x811c9dc5;
      for (const byte of salt) {
        h ^= byte;
        h = Math.imul(h, 0x01000193) >>> 0;
      }
      for (let i = 0; i < password.length; i++) {
        h ^= password.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
      }
      for (let i = 0; i < out.length; i++) {
        h ^= i + 1;
        h = Math.imul(h, 0x01000193) >>> 0;
        out[i] = h & 0xff;
      }
      return out;
    }
  ),
}));
vi.mock("@/api/auth", () => ({
  fetchUserKeys: vi.fn(),
  getSession: vi.fn(),
  insertUserKeys: vi.fn(),
  upsertUserKeys: vi.fn(),
  hasRecoveryKey: vi.fn(),
  upsertRecoveryKey: vi.fn(),
}));
vi.mock("@/lib/crypto/store", () => ({
  saveDEK: vi.fn(),
  loadDEK: vi.fn(),
  clearDEK: vi.fn(),
  hasDEK: vi.fn(),
}));

// ── Fixtures ──

const USER_ID = "user-123";
const EMAIL = "user@example.com";
const OLD_PASSWORD = "old-password";
const NEW_PASSWORD = "new-password";

/** Minimal session whose user matches USER_ID — the bootstrap guard's happy path. */
const mockSession: Session = {
  access_token: "mock-access-token",
  refresh_token: "mock-refresh-token",
  expires_in: 3600,
  token_type: "bearer",
  user: {
    id: USER_ID,
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "2026-01-01T00:00:00Z",
  },
};

/** The original DEK, kept so tests can prove key material survives a rewrap. */
let realDEK: CryptoKey;
/** The user_keys row as Supabase returns it after first-login bootstrap. */
let keyRow: { salt: string; iv: string; wrapped_dek: string };

beforeAll(async () => {
  realDEK = await generateDEK();
  const salt = generateSalt();
  const oldKek = await deriveKEK(OLD_PASSWORD, salt);
  const { iv, wrappedKey } = await wrapDEK(realDEK, oldKek);
  keyRow = { salt, iv, wrapped_dek: wrappedKey };
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchUserKeys).mockResolvedValue(keyRow);
  vi.mocked(getSession).mockResolvedValue(mockSession);
  vi.mocked(insertUserKeys).mockResolvedValue(undefined);
  vi.mocked(upsertUserKeys).mockResolvedValue(undefined);
  vi.mocked(saveDEK).mockResolvedValue(undefined);
});

// ── generateRecoveryPhrase ──

describe("generateRecoveryPhrase", () => {
  it("starts with the opsugrade_ prefix", () => {
    expect(generateRecoveryPhrase().startsWith("opsugrade_")).toBe(true);
  });

  it("contains only Base64 characters, underscores, and hyphens", () => {
    expect(generateRecoveryPhrase()).toMatch(/^opsugrade_[A-Za-z0-9+/=-]+$/);
  });

  it("returns different phrases on consecutive calls", () => {
    expect(generateRecoveryPhrase()).not.toBe(generateRecoveryPhrase());
  });

  it("is long enough to encode 32 random bytes (> 20 characters)", () => {
    expect(generateRecoveryPhrase().length).toBeGreaterThan(20);
  });
});

// ── bootstrapCrypto ──

describe("bootstrapCrypto", () => {
  it("throws when there is no active session", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    await expect(bootstrapCrypto(USER_ID, OLD_PASSWORD, EMAIL)).rejects.toThrow(
      "Active session missing or mismatched"
    );

    expect(fetchUserKeys).not.toHaveBeenCalled();
    expect(insertUserKeys).not.toHaveBeenCalled();
    expect(saveDEK).not.toHaveBeenCalled();
  });

  it("throws when the session user does not match the requested user", async () => {
    vi.mocked(getSession).mockResolvedValue({
      ...mockSession,
      user: { ...mockSession.user, id: "someone-else" },
    });

    await expect(bootstrapCrypto(USER_ID, OLD_PASSWORD, EMAIL)).rejects.toThrow(
      "Active session missing or mismatched"
    );

    expect(insertUserKeys).not.toHaveBeenCalled();
    expect(saveDEK).not.toHaveBeenCalled();
  });

  it("unwraps and stores the existing DEK without writing a key row", async () => {
    await bootstrapCrypto(USER_ID, OLD_PASSWORD, EMAIL);

    expect(insertUserKeys).not.toHaveBeenCalled();
    expect(upsertUserKeys).not.toHaveBeenCalled();
    expect(saveDEK).toHaveBeenCalledTimes(1);
    expect(saveDEK).toHaveBeenCalledWith(USER_ID, expect.anything());

    // The stored DEK must unlock the real user_keys row from beforeAll.
    const storedDek = vi.mocked(saveDEK).mock.calls[0][1] as CryptoKey;
    const kek = await deriveKEK(OLD_PASSWORD, keyRow.salt);
    const recovered = await unwrapDEK(keyRow.wrapped_dek, keyRow.iv, kek);
    const probe = await encrypt("bootstrap probe", recovered);
    expect(await decrypt(probe.iv, probe.ciphertext, storedDek)).toBe(
      "bootstrap probe"
    );
  });

  it("uses plain insert (not upsert) for the first-login branch", async () => {
    vi.mocked(fetchUserKeys).mockResolvedValue(null);

    await bootstrapCrypto(USER_ID, OLD_PASSWORD, EMAIL);

    expect(insertUserKeys).toHaveBeenCalledTimes(1);
    expect(upsertUserKeys).not.toHaveBeenCalled();

    const [userId, email, salt, iv, wrappedDek] =
      vi.mocked(insertUserKeys).mock.calls[0];
    expect(userId).toBe(USER_ID);
    expect(email).toBe(EMAIL);
    expect(() => atob(salt)).not.toThrow();
    expect(() => atob(iv)).not.toThrow();
    expect(() => atob(wrappedDek)).not.toThrow();
    expect(saveDEK).toHaveBeenCalledWith(USER_ID, expect.anything());
  });

  it("keeps the old keys intact when a duplicate row makes the insert fail", async () => {
    vi.mocked(fetchUserKeys).mockResolvedValue(null);
    vi.mocked(insertUserKeys).mockRejectedValue(
      new Error(
        "Encryption keys already exist for this account but could not be read. Refusing to overwrite them. Please sign in again."
      )
    );

    await expect(bootstrapCrypto(USER_ID, OLD_PASSWORD, EMAIL)).rejects.toThrow(
      "Refusing to overwrite"
    );

    // The failure must not leave a fresh DEK in IndexedDB — the real row's
    // DEK still governs every encrypted record.
    expect(saveDEK).not.toHaveBeenCalled();
  });
});

// ── rewrapDEK ──

describe("rewrapDEK", () => {
  it("completes a password change and persists a fresh key row", async () => {
    await expect(
      rewrapDEK(USER_ID, OLD_PASSWORD, NEW_PASSWORD, EMAIL)
    ).resolves.toBeUndefined();

    expect(upsertUserKeys).toHaveBeenCalledTimes(1);
    const [userId, email, newSalt, newIv, newWrappedDek] =
      vi.mocked(upsertUserKeys).mock.calls[0];
    expect(userId).toBe(USER_ID);
    expect(email).toBe(EMAIL);
    // Every password change must mint a fresh salt.
    expect(newSalt).not.toBe(keyRow.salt);
    expect(() => atob(newSalt)).not.toThrow();
    expect(atob(newSalt)).toHaveLength(16);
    expect(() => atob(newIv)).not.toThrow();
    expect(() => atob(newWrappedDek)).not.toThrow();

    expect(saveDEK).toHaveBeenCalledTimes(1);
    expect(saveDEK).toHaveBeenCalledWith(USER_ID, expect.anything());
  });

  it("re-locks the DEK as non-extractable before persisting it", async () => {
    await rewrapDEK(USER_ID, OLD_PASSWORD, NEW_PASSWORD, EMAIL);

    const lockedDek = vi.mocked(saveDEK).mock.calls[0][1] as CryptoKey;
    expect(lockedDek.algorithm.name).toBe("AES-GCM");
    expect(lockedDek.extractable).toBe(false);
  });

  it("preserves the key material: the new row unlocks with the new password", async () => {
    await rewrapDEK(USER_ID, OLD_PASSWORD, NEW_PASSWORD, EMAIL);

    const [, , newSalt, newIv, newWrappedDek] =
      vi.mocked(upsertUserKeys).mock.calls[0];

    // The persisted bundle must be unlockable with the NEW password alone.
    const newKek = await deriveKEK(NEW_PASSWORD, newSalt);
    const recovered = await unwrapDEK(newWrappedDek, newIv, newKek);

    // And the key material must still be the original DEK — decrypt with both
    // the recovered key and the re-locked copy what the original DEK encrypted.
    const probe = await encrypt("integrity probe", realDEK);
    expect(await decrypt(probe.iv, probe.ciphertext, recovered)).toBe("integrity probe");
    const lockedDek = vi.mocked(saveDEK).mock.calls[0][1] as CryptoKey;
    expect(await decrypt(probe.iv, probe.ciphertext, lockedDek)).toBe("integrity probe");
  });

  it("leaves IndexedDB untouched when the Supabase write fails", async () => {
    vi.mocked(upsertUserKeys).mockRejectedValue(new Error("Network error"));

    await expect(
      rewrapDEK(USER_ID, OLD_PASSWORD, NEW_PASSWORD, EMAIL)
    ).rejects.toThrow("Network error");

    // The old row is still intact server-side, so the old password keeps
    // working — IndexedDB must not hold a key derived from an unsaved bundle.
    expect(saveDEK).not.toHaveBeenCalled();
  });

  it("rejects a wrong old password without writing anything", async () => {
    await expect(
      rewrapDEK(USER_ID, "WRONG-password", NEW_PASSWORD, EMAIL)
    ).rejects.toThrow();

    expect(upsertUserKeys).not.toHaveBeenCalled();
    expect(saveDEK).not.toHaveBeenCalled();
  });

  it("throws when the user has no key row", async () => {
    vi.mocked(fetchUserKeys).mockResolvedValue(null);

    await expect(
      rewrapDEK(USER_ID, OLD_PASSWORD, NEW_PASSWORD, EMAIL)
    ).rejects.toThrow("No encryption keys found for this user.");

    expect(upsertUserKeys).not.toHaveBeenCalled();
    expect(saveDEK).not.toHaveBeenCalled();
  });
});
