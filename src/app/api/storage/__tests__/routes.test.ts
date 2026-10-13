import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createServerClient as createClient } from "@ops-upgrade/auth-core";
import { POST as uploadPOST } from "@/app/api/storage/upload/route";
import { POST as downloadPOST } from "@/app/api/storage/download/route";
import { POST as deletePOST } from "@/app/api/storage/delete/route";

/**
 * Tier 1 — R2 presigning route handlers.
 *
 * These three routes are the only thing standing between a logged-in user and
 * the shared `personal-tracker` bucket: R2 itself has no per-user ACL, so the
 * `documents/{userId}/{file}` prefix *is* the tenancy boundary. The suite pins
 * that boundary from both directions — every route must build the prefix from
 * the session (never from the request), and must refuse any fileName that
 * isn't a server-generated UUID.enc (which is what keeps callers from
 * smuggling traversal segments into the key).
 *
 * Only `createServerClient` (from `@ops-upgrade/auth-core`) is mocked for auth, so the real
 * `getAuthenticatedUserId()` helper (getClaims + `claims.sub` extraction) is
 * under test too. The AWS SDK is mocked so nothing reaches the network.
 */

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn(async () => ({})) }));

vi.mock("@ops-upgrade/auth-core", () => ({ createServerClient: vi.fn() }));
vi.mock("@/lib/r2", () => ({
  getR2Client: vi.fn(() => ({ send: sendMock })),
  R2_BUCKET: "personal-tracker",
}));
vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(async () => "https://r2.example.com/presigned"),
}));
vi.mock("@aws-sdk/client-s3", () => ({
  PutObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
}));

// ── Fixtures & helpers ──

const USER_ID = "user-123";
const OTHER_USER_ID = "attacker-999";
const VALID_FILE = "a0b1c2d3-e4f5-6789-abcd-ef0123456789.enc";

/**
 * Point the mocked Supabase server client at a session (or at no session).
 * Mirrors the `getClaims()` shape the real helper destructures.
 */
function mockAuth(userId: string | null) {
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getClaims: vi.fn(async () =>
        userId
          ? { data: { claims: { sub: userId } }, error: null }
          : { data: null, error: { message: "no session" } },
      ),
    },
  } as never);
}

function jsonRequest(body: unknown): NextRequest {
  return new NextRequest("https://app.test/api/storage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function rawRequest(raw: string): NextRequest {
  return new NextRequest("https://app.test/api/storage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw,
  });
}

/** The three handlers share an identical auth + body-parsing preamble. */
const HANDLERS = [
  ["upload", uploadPOST],
  ["download", downloadPOST],
  ["delete", deletePOST],
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth(USER_ID);
});

// ── Shared preamble: auth + body parsing ──

describe("shared route preamble", () => {
  it.each(HANDLERS)("rejects an unauthenticated %s with 401", async (_name, handler) => {
    mockAuth(null);
    const res = await handler(jsonRequest({ fileName: VALID_FILE }));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it.each(HANDLERS)("checks auth on %s before parsing the body", async (_name, handler) => {
    mockAuth(null);
    const res = await handler(rawRequest("{not json"));
    expect(res.status).toBe(401);
  });

  it.each(HANDLERS)("rejects a malformed JSON body on %s with 400", async (_name, handler) => {
    const res = await handler(rawRequest("{not json"));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });

  it.each(HANDLERS)("treats a session with no sub claim as unauthenticated on %s", async (_name, handler) => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getClaims: vi.fn(async () => ({ data: { claims: {} }, error: null })) },
    } as never);
    const res = await handler(jsonRequest({ fileName: VALID_FILE }));
    expect(res.status).toBe(401);
  });

  it("never reaches R2 for an unauthenticated delete", async () => {
    mockAuth(null);
    await deletePOST(jsonRequest({ fileName: VALID_FILE }));
    expect(sendMock).not.toHaveBeenCalled();
  });
});

// ── Upload ──

describe("POST /api/storage/upload", () => {
  it("rejects a missing fileName with 400", async () => {
    const res = await uploadPOST(jsonRequest({}));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "Missing required field: fileName",
    });
  });

  it.each([
    ["a non-UUID name", "notauuid.enc"],
    ["a traversal name", "../../passwd.enc"],
    ["a wrong extension", "a0b1c2d3-e4f5-6789-abcd-ef0123456789.txt"],
    ["a bare UUID with no extension", "a0b1c2d3-e4f5-6789-abcd-ef0123456789"],
    ["a UUID with a nested path", `sub/${VALID_FILE}`],
    ["a non-hex UUID", "z0b1c2d3-e4f5-6789-abcd-ef0123456789.enc"],
  ])("rejects %s with 400", async (_label, fileName) => {
    const res = await uploadPOST(jsonRequest({ fileName }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid fileName format" });
  });

  it("presigns a valid request and returns the documents-scoped key", async () => {
    const res = await uploadPOST(jsonRequest({ fileName: VALID_FILE }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      url: "https://r2.example.com/presigned",
      key: `documents/${USER_ID}/${VALID_FILE}`,
    });
  });

  it("builds the object key from the session, so a caller cannot target another user", async () => {
    // The request body carries no userId at all — the only way to change the
    // prefix is to change the session.
    mockAuth(OTHER_USER_ID);
    const res = await uploadPOST(jsonRequest({ fileName: VALID_FILE }));
    const body = (await res.json()) as { key: string };
    expect(body.key.startsWith(`documents/${OTHER_USER_ID}/`)).toBe(true);
    expect(body.key).not.toContain(USER_ID);
  });

  it("signs a PutObjectCommand against the same user-scoped key", async () => {
    await uploadPOST(jsonRequest({ fileName: VALID_FILE }));
    expect(PutObjectCommand).toHaveBeenCalledTimes(1);
    expect(vi.mocked(PutObjectCommand).mock.calls[0][0]).toMatchObject({
      Bucket: "personal-tracker",
      Key: `documents/${USER_ID}/${VALID_FILE}`,
      ContentType: "application/octet-stream",
    });
  });

  it("expires the presigned PUT URL after 5 minutes", async () => {
    await uploadPOST(jsonRequest({ fileName: VALID_FILE }));
    expect(vi.mocked(getSignedUrl).mock.calls[0][2]).toEqual({ expiresIn: 300 });
  });

  it("does not presign anything when validation fails", async () => {
    await uploadPOST(jsonRequest({ fileName: "../../passwd.enc" }));
    expect(getSignedUrl).not.toHaveBeenCalled();
  });
});

// ── Download ──

describe("POST /api/storage/download", () => {
  it("rejects a missing fileName with 400", async () => {
    const res = await downloadPOST(jsonRequest({}));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Missing required field: fileName" });
  });

  it.each([
    ["a traversal name", "../../passwd.enc"],
    ["a UUID with a nested path", `sub/${VALID_FILE}`],
    ["a bare filename", "a0b1c2d3-e4f5-6789-abcd-ef0123456789"],
    ["a wrong extension", "a0b1c2d3-e4f5-6789-abcd-ef0123456789.txt"],
  ])("refuses %s with 400", async (_label, fileName) => {
    const res = await downloadPOST(jsonRequest({ fileName }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid fileName format" });
  });

  it("presigns a valid fileName under the caller's documents folder", async () => {
    const res = await downloadPOST(jsonRequest({ fileName: VALID_FILE }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ url: "https://r2.example.com/presigned" });
    expect(vi.mocked(GetObjectCommand).mock.calls[0][0]).toMatchObject({
      Bucket: "personal-tracker",
      Key: `documents/${USER_ID}/${VALID_FILE}`,
    });
  });

  it("builds the object key from the session, not the request", async () => {
    mockAuth(OTHER_USER_ID);
    await downloadPOST(jsonRequest({ fileName: VALID_FILE }));
    expect(vi.mocked(GetObjectCommand).mock.calls[0][0]).toMatchObject({
      Bucket: "personal-tracker",
      Key: `documents/${OTHER_USER_ID}/${VALID_FILE}`,
    });
  });

  it("does not presign anything for a rejected fileName", async () => {
    await downloadPOST(jsonRequest({ fileName: "../../passwd.enc" }));
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it("expires the presigned GET URL after 5 minutes", async () => {
    await downloadPOST(jsonRequest({ fileName: VALID_FILE }));
    expect(vi.mocked(getSignedUrl).mock.calls[0][2]).toEqual({ expiresIn: 300 });
  });
});

// ── Delete ──

describe("POST /api/storage/delete", () => {
  it("rejects a missing fileName with 400", async () => {
    const res = await deletePOST(jsonRequest({}));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Missing required field: fileName" });
  });

  it.each([
    ["a traversal name", "../../passwd.enc"],
    ["a UUID with a nested path", `sub/${VALID_FILE}`],
    ["a wrong extension", "a0b1c2d3-e4f5-6789-abcd-ef0123456789.txt"],
  ])("refuses %s with 400", async (_label, fileName) => {
    const res = await deletePOST(jsonRequest({ fileName }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid fileName format" });
  });

  it("deletes a valid fileName under the caller's documents folder", async () => {
    const res = await deletePOST(jsonRequest({ fileName: VALID_FILE }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(vi.mocked(DeleteObjectCommand).mock.calls[0][0]).toMatchObject({
      Bucket: "personal-tracker",
      Key: `documents/${USER_ID}/${VALID_FILE}`,
    });
  });

  it("builds the object key from the session, not the request", async () => {
    mockAuth(OTHER_USER_ID);
    await deletePOST(jsonRequest({ fileName: VALID_FILE }));
    expect(vi.mocked(DeleteObjectCommand).mock.calls[0][0]).toMatchObject({
      Bucket: "personal-tracker",
      Key: `documents/${OTHER_USER_ID}/${VALID_FILE}`,
    });
  });

  it("never issues a DeleteObject for a rejected fileName", async () => {
    await deletePOST(jsonRequest({ fileName: "../../passwd.enc" }));
    expect(sendMock).not.toHaveBeenCalled();
    expect(DeleteObjectCommand).not.toHaveBeenCalled();
  });
});
