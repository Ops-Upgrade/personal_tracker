// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { uploadFile, downloadFile, deleteFile } from "@/api/common/encryptedFileStorage";
import { MAX_FILE_SIZE } from "@/lib/fileConstants";

/**
 * Tier 1-C — the client-side encrypted file pipeline.
 * Upload/download/delete orchestrate encryptBlob/decryptBlob around the
 * presigned-URL API routes; the routes build the documents/{userId}/{fileName}
 * key server-side, so the client only ever sends { fileName }.
 */

const { encryptBlobMock, decryptBlobMock, fetchMock } = vi.hoisted(() => ({
  encryptBlobMock: vi.fn(async () => ({
    iv: "test-iv",
    encryptedData: new ArrayBuffer(8),
  })),
  decryptBlobMock: vi.fn(async () => new Blob(["decrypted"])),
  fetchMock: vi.fn(),
}));

vi.mock("@/lib/crypto", () => ({
  encryptBlob: encryptBlobMock,
  decryptBlob: decryptBlobMock,
}));

function jsonResponse(body: unknown, ok = true, status = 200, statusText = "OK") {
  return {
    ok,
    status,
    statusText,
    json: async () => body,
    arrayBuffer: async () => new ArrayBuffer(0),
  };
}

function makeFile(name = "receipt.pdf", type = "application/pdf"): File {
  return new File(["x"], name, { type });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("uploadFile", () => {
  it("rejects files over the 45 MB limit before any network call", async () => {
    const file = makeFile();
    Object.defineProperty(file, "size", { value: MAX_FILE_SIZE + 1 });

    await expect(uploadFile("u1", file)).rejects.toThrow(
      "File must be under 45 MB.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects unsupported MIME types", async () => {
    await expect(uploadFile("u1", makeFile("a.txt", "text/plain"))).rejects.toThrow(
      "Unsupported file type. Allowed: PDF, JPEG, PNG, WEBP.",
    );
  });

  it("throws when the upload-URL route fails", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "boom" }, false, 500, "err"));

    await expect(uploadFile("u1", makeFile())).rejects.toThrow(
      "Failed to get upload URL: boom",
    );
  });

  it("throws when the R2 PUT fails", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ url: "https://r2.test/presigned" }))
      .mockResolvedValueOnce(jsonResponse({}, false, 403, "Forbidden"));

    await expect(uploadFile("u1", makeFile())).rejects.toThrow(
      "Failed to upload file to storage: Forbidden",
    );
  });

  it("encrypts the file, posts only the fileName, and returns the stored metadata", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ url: "https://r2.test/presigned" }))
      .mockResolvedValueOnce(jsonResponse({}));

    const result = await uploadFile("u1", makeFile());

    expect(encryptBlobMock).toHaveBeenCalledWith("u1", expect.any(File));
    expect(result.iv).toBe("test-iv");
    expect(result.mimeType).toBe("application/pdf");
    expect(result.fileName).toMatch(/^[0-9a-f-]{36}\.enc$/);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/storage/upload");
    const body = JSON.parse(init.body as string) as { fileName: string };
    expect(body).toEqual({ fileName: result.fileName });
  });
});

describe("downloadFile", () => {
  it("requires both fileName and iv", async () => {
    await expect(downloadFile("u1", null, "iv")).rejects.toThrow(
      "Missing file info for download.",
    );
    await expect(downloadFile("u1", "f.enc", null)).rejects.toThrow(
      "Missing file info for download.",
    );
  });

  it("throws when the download-URL route fails", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "nope" }, false, 404, "Not Found"),
    );

    await expect(downloadFile("u1", "f.enc", "iv")).rejects.toThrow(
      "Download failed: nope",
    );
  });

  it("throws when the R2 GET fails", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ url: "https://r2.test/presigned" }))
      .mockResolvedValueOnce(jsonResponse({}, false, 404, "Gone"));

    await expect(
      downloadFile("u1", "f.enc", "iv", "application/pdf"),
    ).rejects.toThrow("Failed to download file from storage: Gone");
  });

  it("downloads with only the fileName posted and decrypts the blob", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ url: "https://r2.test/presigned" }))
      .mockResolvedValueOnce(jsonResponse({}));

    const blob = await downloadFile("u1", "f.enc", "iv-x", "application/pdf");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/storage/download");
    expect(JSON.parse(init.body as string)).toEqual({ fileName: "f.enc" });
    expect(decryptBlobMock).toHaveBeenCalledWith(
      "u1",
      expect.any(ArrayBuffer),
      "iv-x",
      "application/pdf",
    );
    await expect(blob.text()).resolves.toBe("decrypted");
  });
});

describe("deleteFile", () => {
  it("deletes via only the fileName posted", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));

    await deleteFile("u1", "f.enc");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/storage/delete");
    expect(JSON.parse(init.body as string)).toEqual({ fileName: "f.enc" });
  });

  it("throws when the delete route fails", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "x" }, false, 500, "err"));

    await expect(deleteFile("u1", "f.enc")).rejects.toThrow(
      "Failed to delete file: x",
    );
  });
});
