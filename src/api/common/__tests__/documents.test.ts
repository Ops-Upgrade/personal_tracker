// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearDocumentsCache,
  createDocument,
  deleteDocument,
  fetchDocuments,
  fetchDocumentsByDomain,
  updateDocument,
} from "@/api/common/documents";
import { createBrowserClient as createClient } from "@ops-upgrade/auth-core";
import type { DocumentPlaintext } from "@/types/document";

/**
 * Tier 1-A — the shared document service.
 * Every document-linked domain (notes, education, expense, medical, vault)
 * reads/writes through this layer, including the label-deduplication rule
 * that keeps linked-document lists unambiguous.
 */

const { supabaseMock, encryptFieldMock, decryptFieldMock, state } = vi.hoisted(() => {
  const plainByData = new Map<string, string>();

  const state = {
    plainByData,
    selectResult: { data: null as unknown, error: null as { message: string } | null },
    insertResult: {
      data: { id: "doc-new", created_at: "2026-01-01T00:00:00Z" },
      error: null as { message: string } | null,
    },
    updateResult: {
      data: { id: "doc-updated", created_at: "2026-01-01T00:00:00Z" },
      error: null as { message: string } | null,
    },
    deleteResult: { error: null as { message: string } | null },
  };

  function makeBuilder() {
    const kind = { current: "select" };
    const builder: Record<string, unknown> = {};
    // from() starts a fresh query builder in Supabase — reset the kind so a
    // chain's terminal resolution never leaks across tests.
    builder.from = vi.fn(() => {
      kind.current = "select";
      return builder;
    });
    builder.select = vi.fn(() => builder);
    builder.insert = vi.fn(() => {
      kind.current = "insert";
      return builder;
    });
    builder.update = vi.fn(() => {
      kind.current = "update";
      return builder;
    });
    builder.delete = vi.fn(() => {
      kind.current = "delete";
      return builder;
    });
    builder.eq = vi.fn(() => builder);
    builder.single = vi.fn(async () =>
      kind.current === "insert" ? state.insertResult : state.updateResult,
    );
    builder.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
    builder.order = vi.fn(() => builder);
    // Awaiting any point of a chain resolves to the result for its query kind.
    builder.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve().then(() => {
        if (kind.current === "delete") return resolve(state.deleteResult);
        return resolve(state.selectResult);
      }, reject);
    return builder;
  }

  const supabaseMock = makeBuilder();

  return {
    supabaseMock,
    state,
    encryptFieldMock: vi.fn(async (_userId: string, plain: string) => ({
      iv: "iv-1",
      ciphertext: `enc:${plain.slice(0, 24)}`,
    })),
    decryptFieldMock: vi.fn(async (_userId: string, _iv: string, data: string) => {
      const plain = plainByData.get(data);
      if (plain === undefined) {
        throw new Error(`No plaintext registered for ${data}`);
      }
      return plain;
    }),
  };
});

vi.mock("@ops-upgrade/auth-core", () => ({
  createBrowserClient: vi.fn(() => supabaseMock),
}));
vi.mock("@/lib/crypto", () => ({
  encryptField: encryptFieldMock,
  decryptField: decryptFieldMock,
}));

function seedRow(id: string, plaintext: object) {
  const data = `ct-${id}`;
  state.plainByData.set(data, JSON.stringify(plaintext));
  return { id, user_id: "u1", iv: "iv", data, created_at: "2026-01-01T00:00:00Z" };
}

function docPlaintext(
  label: string,
  overrides: Partial<DocumentPlaintext> = {},
): DocumentPlaintext {
  return {
    label,
    domain: "taskmanager",
    linked_id: "",
    file_name: "",
    file_iv: "",
    file_mime: "",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  clearDocumentsCache();
  state.plainByData.clear();
  state.selectResult = { data: [], error: null };
  state.insertResult = {
    data: { id: "doc-new", created_at: "2026-01-01T00:00:00Z" },
    error: null,
  };
  state.updateResult = {
    data: { id: "doc-updated", created_at: "2026-01-01T00:00:00Z" },
    error: null,
  };
  state.deleteResult = { error: null };
});

describe("fetchDocuments", () => {
  it("hydrates and caches decrypted rows on a cold cache", async () => {
    state.selectResult = { data: [seedRow("d1", docPlaintext("report"))], error: null };

    const docs = await fetchDocuments("u1");

    expect(docs).toEqual([expect.objectContaining({ id: "d1", label: "report" })]);
    expect(decryptFieldMock).toHaveBeenCalledWith("u1", "iv", "ct-d1");
  });

  it("serves the same userId from the warm cache without refetching", async () => {
    state.selectResult = { data: [seedRow("d1", docPlaintext("report"))], error: null };
    await fetchDocuments("u1");
    await fetchDocuments("u1");
    expect(createClient).toHaveBeenCalledTimes(1);
  });

  it("refetches when the userId differs from the cached one", async () => {
    state.selectResult = { data: [seedRow("d1", docPlaintext("report"))], error: null };
    await fetchDocuments("u1");

    state.selectResult = { data: [seedRow("d2", docPlaintext("invoice"))], error: null };
    const docs = await fetchDocuments("u2");

    expect(docs[0]).toEqual(expect.objectContaining({ id: "d2", label: "invoice" }));
    expect(createClient).toHaveBeenCalledTimes(2);
  });

  it("throws when Supabase reports an error", async () => {
    state.selectResult = { data: null, error: { message: "boom" } };
    await expect(fetchDocuments("u1")).rejects.toThrow(
      "Failed to fetch documents: boom",
    );
  });
});

describe("createDocument", () => {
  it("encrypts the payload and appends the created row to the cache", async () => {
    const created = await createDocument("u1", docPlaintext("report"));

    expect(encryptFieldMock).toHaveBeenCalled();
    expect(created).toEqual(expect.objectContaining({ id: "doc-new", label: "report" }));

    // Cache updated — a warm fetch returns the new document without a refetch.
    const cached = await fetchDocuments("u1");
    expect(cached).toHaveLength(1);
    expect(cached[0].id).toBe("doc-new");
  });

  it("deduplicates the label against existing documents in the same domain", async () => {
    state.selectResult = { data: [seedRow("d1", docPlaintext("report"))], error: null };

    const created = await createDocument("u1", docPlaintext("report"));

    expect(created.label).toBe("report (1)");
  });
});

describe("updateDocument", () => {
  it("re-encrypts and replaces the cached entry", async () => {
    state.selectResult = { data: [seedRow("d1", docPlaintext("report"))], error: null };

    const updated = await updateDocument("u1", "d1", docPlaintext("renamed"));

    expect(updated.label).toBe("renamed");
    const cached = await fetchDocuments("u1");
    expect(cached).toHaveLength(1);
    expect(cached[0].label).toBe("renamed");
  });

  it("excludes the document itself from label deduplication", async () => {
    state.selectResult = { data: [seedRow("d1", docPlaintext("report"))], error: null };

    const updated = await updateDocument("u1", "d1", docPlaintext("report"));

    expect(updated.label).toBe("report");
  });
});

describe("deleteDocument", () => {
  it("removes the row from Supabase and from the cache", async () => {
    state.selectResult = {
      data: [seedRow("d1", docPlaintext("report")), seedRow("d2", docPlaintext("invoice"))],
      error: null,
    };
    await fetchDocuments("u1");

    await deleteDocument("d1");

    const cached = await fetchDocuments("u1");
    expect(cached).toHaveLength(1);
    expect(cached[0].id).toBe("d2");
  });

  it("throws when Supabase reports an error", async () => {
    state.deleteResult = { error: { message: "boom" } };
    await expect(deleteDocument("d1")).rejects.toThrow(
      "Failed to delete document: boom",
    );
  });
});

describe("fetchDocumentsByDomain", () => {
  it("filters by domain and optional linked_id", async () => {
    state.selectResult = {
      data: [
        seedRow("d1", docPlaintext("a", { domain: "taskmanager" })),
        seedRow("d2", docPlaintext("b", { domain: "vault", linked_id: "r1" })),
      ],
      error: null,
    };

    expect(await fetchDocumentsByDomain("u1", "vault")).toHaveLength(1);
    expect(await fetchDocumentsByDomain("u1", "vault", "r1")).toHaveLength(1);
    expect(await fetchDocumentsByDomain("u1", "vault", "other")).toHaveLength(0);
  });
});
