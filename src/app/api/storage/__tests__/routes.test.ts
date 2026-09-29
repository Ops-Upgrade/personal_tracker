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
 * `{folder}/{userId}/{file}` prefix *is* the tenancy boundary. The suite pins
 * that boundary from both directions — the upload route must build the prefix
 * from the session (never from the request), and download/delete must refuse a
 * key whose prefix belongs to anyone else.
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
const ALLOWED_FOLDERS = ["expenses", "certificates", "documents", "vault"] as const;

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
    const res = await handler(jsonRequest({ folder: "expenses", fileName: VALID_FILE, key: `expenses/${USER_ID}/${VALID_FILE}` }));
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
    const res = await handler(jsonRequest({ folder: "expenses", fileName: VALID_FILE, key: "x/y/z" }));
    expect(res.status).toBe(401);
  });

  it("never reaches R2 for an unauthenticated delete", async () => {
    mockAuth(null);
    await deletePOST(jsonRequest({ key: `expenses/${USER_ID}/${VALID_FILE}` }));
    expect(sendMock).not.toHaveBeenCalled();
  });
});

// ── Upload ──

describe("POST /api/storage/upload", () => {
  it("rejects a missing folder with 400", async () => {
    const res = await uploadPOST(jsonRequest({ fileName: VALID_FILE }));
    expect(res.status).toBe(400);
  });

  it("rejects a missing fileName with 400", async () => {
    const res = await uploadPOST(jsonRequest({ folder: "expenses" }));
    expect(res.status).toBe(400);
  });

  it("rejects an empty body with 400", async () => {
    const res = await uploadPOST(jsonRequest({}));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "Missing required fields: folder, fileName",
    });
  });

  it("rejects a folder outside the allowlist with 400", async () => {
    const res = await uploadPOST(jsonRequest({ folder: "admin", fileName: VALID_FILE }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid folder" });
  });

  it.each(["../expenses", "expenses/../vault", "/expenses", "EXPENSES"])(
    "rejects the traversal / casing attempt %s with 400",
    async (folder) => {
      const res = await uploadPOST(jsonRequest({ folder, fileName: VALID_FILE }));
      expect(res.status).toBe(400);
    },
  );

  it.each([
    ["a non-UUID name", "notauuid.enc"],
    ["a traversal name", "../../passwd.enc"],
    ["a wrong extension", "a0b1c2d3-e4f5-6789-abcd-ef0123456789.txt"],
    ["a bare UUID with no extension", "a0b1c2d3-e4f5-6789-abcd-ef0123456789"],
    ["a UUID with a nested path", `sub/${VALID_FILE}`],
    ["a non-hex UUID", "z0b1c2d3-e4f5-6789-abcd-ef0123456789.enc"],
  ])("rejects %s with 400", async (_label, fileName) => {
    const res = await uploadPOST(jsonRequest({ folder: "expenses", fileName }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid fileName format" });
  });

  it("presigns a valid request and returns the user-scoped key", async () => {
    const res = await uploadPOST(jsonRequest({ folder: "expenses", fileName: VALID_FILE }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      url: "https://r2.example.com/presigned",
      key: `expenses/${USER_ID}/${VALID_FILE}`,
    });
  });

  it.each(ALLOWED_FOLDERS)("accepts the allowed folder %s", async (folder) => {
    const res = await uploadPOST(jsonRequest({ folder, fileName: VALID_FILE }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { key: string };
    expect(body.key).toBe(`${folder}/${USER_ID}/${VALID_FILE}`);
  });

  it("builds the object key from the session, so a caller cannot target another user", async () => {
    // The request body carries no userId at all — the only way to change the
    // prefix is to change the session.
    mockAuth(OTHER_USER_ID);
    const res = await uploadPOST(jsonRequest({ folder: "expenses", fileName: VALID_FILE }));
    const body = (await res.json()) as { key: string };
    expect(body.key.startsWith(`expenses/${OTHER_USER_ID}/`)).toBe(true);
    expect(body.key).not.toContain(USER_ID);
  });

  it("signs a PutObjectCommand against the same user-scoped key", async () => {
    await uploadPOST(jsonRequest({ folder: "certificates", fileName: VALID_FILE }));
    expect(PutObjectCommand).toHaveBeenCalledTimes(1);
    expect(vi.mocked(PutObjectCommand).mock.calls[0][0]).toMatchObject({
      Bucket: "personal-tracker",
      Key: `certificates/${USER_ID}/${VALID_FILE}`,
      ContentType: "application/octet-stream",
    });
  });

  it("expires the presigned PUT URL after 5 minutes", async () => {
    await uploadPOST(jsonRequest({ folder: "expenses", fileName: VALID_FILE }));
    expect(vi.mocked(getSignedUrl).mock.calls[0][2]).toEqual({ expiresIn: 300 });
  });

  it("does not presign anything when validation fails", async () => {
    await uploadPOST(jsonRequest({ folder: "admin", fileName: VALID_FILE }));
    expect(getSignedUrl).not.toHaveBeenCalled();
  });
});

// ── Download ──

describe("POST /api/storage/download", () => {
  it("rejects a missing key with 400", async () => {
    const res = await downloadPOST(jsonRequest({}));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Missing required field: key" });
  });

  it("presigns a key owned by the caller", async () => {
    const key = `expenses/${USER_ID}/${VALID_FILE}`;
    const res = await downloadPOST(jsonRequest({ key }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ url: "https://r2.example.com/presigned" });
    expect(vi.mocked(GetObjectCommand).mock.calls[0][0]).toMatchObject({
      Bucket: "personal-tracker",
      Key: key,
    });
  });

  it.each([
    ["another user's object", `expenses/${OTHER_USER_ID}/${VALID_FILE}`],
    ["a userId that merely prefixes the caller's", `expenses/${USER_ID}4/${VALID_FILE}`],
    ["a two-segment key with no user prefix", `expenses/${VALID_FILE}`],
    ["a nested key that smuggles the user id into segment 1", `expenses/${USER_ID}/sub/${VALID_FILE}`],
    ["a traversal escaping the user prefix", `expenses/${USER_ID}/../${OTHER_USER_ID}/${VALID_FILE}`],
    ["a bare filename", VALID_FILE],
  ])("refuses %s with 403", async (_label, key) => {
    const res = await downloadPOST(jsonRequest({ key }));
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "Access denied" });
  });

  it("does not presign anything for a rejected key", async () => {
    await downloadPOST(jsonRequest({ key: `expenses/${OTHER_USER_ID}/${VALID_FILE}` }));
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it("expires the presigned GET URL after 5 minutes", async () => {
    await downloadPOST(jsonRequest({ key: `expenses/${USER_ID}/${VALID_FILE}` }));
    expect(vi.mocked(getSignedUrl).mock.calls[0][2]).toEqual({ expiresIn: 300 });
  });
});

// ── Delete ──

describe("POST /api/storage/delete", () => {
  it("rejects a missing key with 400", async () => {
    const res = await deletePOST(jsonRequest({}));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Missing required field: key" });
  });

  it("deletes a key owned by the caller", async () => {
    const key = `documents/${USER_ID}/${VALID_FILE}`;
    const res = await deletePOST(jsonRequest({ key }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(vi.mocked(DeleteObjectCommand).mock.calls[0][0]).toMatchObject({
      Bucket: "personal-tracker",
      Key: key,
    });
  });

  it.each([
    ["another user's object", `expenses/${OTHER_USER_ID}/${VALID_FILE}`],
    ["a userId that merely prefixes the caller's", `expenses/${USER_ID}4/${VALID_FILE}`],
    ["a two-segment key with no user prefix", `expenses/${VALID_FILE}`],
    ["a nested key that smuggles the user id into segment 1", `expenses/${USER_ID}/sub/${VALID_FILE}`],
    ["a traversal escaping the user prefix", `expenses/${USER_ID}/../${OTHER_USER_ID}/${VALID_FILE}`],
  ])("refuses to delete %s with 403", async (_label, key) => {
    const res = await deletePOST(jsonRequest({ key }));
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "Access denied" });
  });

  it("never issues a DeleteObject for a rejected key", async () => {
    await deletePOST(jsonRequest({ key: `expenses/${OTHER_USER_ID}/${VALID_FILE}` }));
    expect(sendMock).not.toHaveBeenCalled();
    expect(DeleteObjectCommand).not.toHaveBeenCalled();
  });
});
