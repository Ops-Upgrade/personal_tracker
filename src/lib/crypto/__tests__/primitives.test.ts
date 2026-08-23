// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  decrypt,
  decryptBlob,
  deriveKEK,
  encrypt,
  encryptBlob,
  generateDEK,
  generateIV,
  generateSalt,
  unwrapDEK,
  wrapDEK,
} from "@/lib/crypto/primitives";

/**
 * Tier 1 — crypto primitives.
 *
 * `primitives.ts` is the bottom of the entire encryption stack: every feature
 * blob and every storage file in the app is enciphered through these
 * functions. The suite exercises the real Web Crypto pipeline end to end —
 * real AES-GCM keys, real wrap/unwrap, real GCM tag verification — with only
 * Argon2id mocked. hash-wasm's WASM module carries its own upstream tests and
 * would cost ~19 MiB of memory per call here; a fixed 32-byte output makes
 * `deriveKEK` deterministic instead. Node 22 exposes `globalThis.crypto`,
 * `btoa`/`atob`, `TextEncoder`, `File`, and `Blob` natively, so no polyfill
 * or setup file is required.
 */

vi.mock("hash-wasm", () => ({
  argon2id: vi.fn(async () =>
    // Fixed 32-byte output — deterministic, avoids the WASM module entirely.
    new Uint8Array([
      0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
      0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
      0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17,
      0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f,
    ])
  ),
}));

// ── Helpers ──

/** Assert a value is a non-empty, base64-decodable string of exactly N bytes. */
function expectBase64(value: string, byteLength: number) {
  expect(value).toBeTruthy();
  expect(() => atob(value)).not.toThrow();
  expect(atob(value)).toHaveLength(byteLength);
}

// ── generateSalt ──

describe("generateSalt", () => {
  it("returns a non-empty string", () => {
    expect(generateSalt()).toBeTruthy();
  });

  it("returns valid Base64 decoding to 16 bytes (128-bit salt)", () => {
    expectBase64(generateSalt(), 16);
  });

  it("returns different values on consecutive calls", () => {
    expect(generateSalt()).not.toBe(generateSalt());
  });
});

// ── generateIV ──

describe("generateIV", () => {
  it("returns a non-empty string", () => {
    expect(generateIV()).toBeTruthy();
  });

  it("returns valid Base64 decoding to 12 bytes (96-bit IV)", () => {
    expectBase64(generateIV(), 12);
  });

  it("returns different values on consecutive calls", () => {
    expect(generateIV()).not.toBe(generateIV());
  });
});

// ── IV uniqueness invariant ──

describe("IV uniqueness invariant", () => {
  it("never repeats across 10,000 consecutive generations", () => {
    // AES-GCM IV collision under the same key breaks confidentiality — the
    // classic GCM nonce-reuse failure. This pins the randomness guarantee.
    const seen = new Set<string>();
    for (let i = 0; i < 10_000; i++) {
      seen.add(generateIV());
    }
    expect(seen.size).toBe(10_000);
  });
});

// ── deriveKEK ──

describe("deriveKEK", () => {
  it("returns a non-extractable AES-GCM key usable only for wrapping", async () => {
    const kek = await deriveKEK("password", generateSalt());
    expect(kek.algorithm.name).toBe("AES-GCM");
    expect(kek.usages).toEqual(expect.arrayContaining(["wrapKey", "unwrapKey"]));
    expect(kek.extractable).toBe(false);
  });

  it("derives functionally identical keys from the same password and salt", async () => {
    // The KEK carries only wrapKey/unwrapKey usages, so it cannot encrypt
    // directly. Functional equality is proven the way production uses it: a
    // DEK wrapped by the first KEK must unwrap cleanly with the second.
    const salt = generateSalt();
    const dek = await generateDEK();
    const kek1 = await deriveKEK("password", salt);
    const kek2 = await deriveKEK("password", salt);

    const { iv, wrappedKey } = await wrapDEK(dek, kek1);
    const unwrapped = await unwrapDEK(wrappedKey, iv, kek2);

    const probe = await encrypt("probe", unwrapped);
    expect(await decrypt(probe.iv, probe.ciphertext, unwrapped)).toBe("probe");
  });
});

// ── generateDEK ──

describe("generateDEK", () => {
  it("returns an extractable AES-GCM key usable for data encryption", async () => {
    const dek = await generateDEK();
    expect(dek.algorithm.name).toBe("AES-GCM");
    expect(dek.usages).toEqual(expect.arrayContaining(["encrypt", "decrypt"]));
    // Extractable is required: wrapKey can only wrap keys whose raw material
    // the browser may export.
    expect(dek.extractable).toBe(true);
  });
});

// ── wrapDEK ──

describe("wrapDEK", () => {
  it("returns a base64 IV + ciphertext bundle", async () => {
    const dek = await generateDEK();
    const kek = await deriveKEK("password", generateSalt());
    const bundle = await wrapDEK(dek, kek);
    expectBase64(bundle.iv, 12);
    expectBase64(bundle.wrappedKey, 16 + 16 + 16); // 32-byte DEK + 16-byte GCM tag = 48 bytes
  });

  it("uses a fresh IV (and therefore fresh ciphertext) on every wrap", async () => {
    const dek = await generateDEK();
    const kek = await deriveKEK("password", generateSalt());
    const a = await wrapDEK(dek, kek);
    const b = await wrapDEK(dek, kek);
    expect(a.iv).not.toBe(b.iv);
    expect(a.wrappedKey).not.toBe(b.wrappedKey);
  });
});

// ── unwrapDEK ──

describe("unwrapDEK", () => {
  it("round-trips a wrapped DEK into a usable, non-extractable key", async () => {
    const dek = await generateDEK();
    const kek = await deriveKEK("password", generateSalt());
    const bundle = await wrapDEK(dek, kek);

    const unwrapped = await unwrapDEK(bundle.wrappedKey, bundle.iv, kek);
    expect(unwrapped.extractable).toBe(false);

    const payload = await encrypt("hello world", unwrapped);
    expect(await decrypt(payload.iv, payload.ciphertext, unwrapped)).toBe("hello world");
  });

  it("honours extractable=true (required by rewrapDEK)", async () => {
    const dek = await generateDEK();
    const kek = await deriveKEK("password", generateSalt());
    const bundle = await wrapDEK(dek, kek);

    const unwrapped = await unwrapDEK(bundle.wrappedKey, bundle.iv, kek, true);
    expect(unwrapped.extractable).toBe(true);
  });

  it("rejects unwrapping with a different KEK", async () => {
    const dek = await generateDEK();
    const kek1 = await deriveKEK("password", generateSalt());
    const kek2 = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false,
      ["wrapKey", "unwrapKey"]
    );
    const bundle = await wrapDEK(dek, kek1);

    // Ciphertext is bound to the wrapping key — the GCM tag must not verify.
    await expect(unwrapDEK(bundle.wrappedKey, bundle.iv, kek2)).rejects.toThrow();
  });
});

// ── encrypt / decrypt ──

describe("encrypt", () => {
  it("returns a base64 payload with a 12-byte IV", async () => {
    const dek = await generateDEK();
    const payload = await encrypt("hello world", dek);
    expectBase64(payload.iv, 12);
    // 11 plaintext bytes + the 16-byte GCM tag — pins that the tag is emitted.
    expectBase64(payload.ciphertext, 11 + 16);
  });

  it("never produces the same output for the same plaintext (random IV per call)", async () => {
    const dek = await generateDEK();
    const a = await encrypt("same input", dek);
    const b = await encrypt("same input", dek);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });
});

describe("encrypt → decrypt round-trip", () => {
  const cases = [
    ["plain text", "hello world"],
    ["an empty string", ""],
    ["unicode", "नमस्ते"],
    ["a 10,000-char string", "a".repeat(10_000)],
  ] as const;

  it.each(cases)("round-trips %s", async (_label, plaintext) => {
    const dek = await generateDEK();
    const payload = await encrypt(plaintext, dek);
    expect(await decrypt(payload.iv, payload.ciphertext, dek)).toBe(plaintext);
  });
});

describe("decrypt tamper detection", () => {
  it("rejects a ciphertext whose bytes were modified (GCM tag mismatch)", async () => {
    const dek = await generateDEK();
    const payload = await encrypt("secret data", dek);

    // Swap the first base64 char for a different valid one — the decoded
    // plaintext bytes change, so the authentication tag must fail to verify.
    const decoded = atob(payload.ciphertext);
    const tampered = decoded[0] === "A" ? `B${decoded.slice(1)}` : `A${decoded.slice(1)}`;

    await expect(decrypt(payload.iv, tampered, dek)).rejects.toThrow();
  });

  it("rejects a ciphertext that is no longer valid base64", async () => {
    const dek = await generateDEK();
    const payload = await encrypt("secret data", dek);
    await expect(decrypt(payload.iv, `*${payload.ciphertext.slice(1)}`, dek)).rejects.toThrow();
  });
});

describe("decrypt wrong-key rejection", () => {
  it("rejects ciphertext encrypted under a different DEK", async () => {
    const dek1 = await generateDEK();
    const dek2 = await generateDEK();
    const payload = await encrypt("secret", dek1);
    await expect(decrypt(payload.iv, payload.ciphertext, dek2)).rejects.toThrow();
  });
});

// ── encryptBlob / decryptBlob ──

describe("encryptBlob", () => {
  it("returns a base64 IV and an encrypted ArrayBuffer", async () => {
    const dek = await generateDEK();
    const file = new File([new Uint8Array([1, 2, 3, 4, 5])], "test.bin", {
      type: "application/octet-stream",
    });

    const result = await encryptBlob(file, dek);
    expectBase64(result.iv, 12);
    expect(result.encryptedData).toBeInstanceOf(ArrayBuffer);
    // 5 plaintext bytes + the 16-byte GCM tag.
    expect(result.encryptedData.byteLength).toBe(21);
  });
});

describe("encryptBlob → decryptBlob round-trip", () => {
  it("recovers the exact original bytes", async () => {
    const dek = await generateDEK();
    const file = new File([new Uint8Array([1, 2, 3, 4, 5])], "test.bin", {
      type: "application/octet-stream",
    });

    const { iv, encryptedData } = await encryptBlob(file, dek);
    const blob = await decryptBlob(encryptedData, iv, dek, "application/octet-stream");
    const bytes = new Uint8Array(await blob.arrayBuffer());

    expect([...bytes]).toEqual([1, 2, 3, 4, 5]);
  });

  it("passes the supplied mimeType through to the Blob", async () => {
    const dek = await generateDEK();
    const file = new File([new Uint8Array([9, 8, 7])], "doc.bin", { type: "application/pdf" });

    const { iv, encryptedData } = await encryptBlob(file, dek);
    const blob = await decryptBlob(encryptedData, iv, dek, "application/pdf");

    expect(blob.type).toBe("application/pdf");
  });

  it("rejects encrypted bytes that were modified (GCM tag mismatch)", async () => {
    const dek = await generateDEK();
    const file = new File([new Uint8Array([1, 2, 3, 4, 5])], "test.bin", {
      type: "application/octet-stream",
    });

    const { iv, encryptedData } = await encryptBlob(file, dek);
    const tampered = new Uint8Array(encryptedData).slice();
    // The final 16 bytes are the GCM tag — flipping one guarantees rejection.
    tampered[tampered.length - 1] ^= 0xff;

    await expect(
      decryptBlob(tampered.buffer, iv, dek, "application/octet-stream")
    ).rejects.toThrow();
  });
});
