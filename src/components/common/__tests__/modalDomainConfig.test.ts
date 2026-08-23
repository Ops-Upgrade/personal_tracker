// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getModalDomainConfig,
  storeToModalDomain,
} from "@/components/common/modalDomainConfig";
import { getServerDateIST } from "@/api/serverDate";
import { createTask, updateTask } from "@/api/taskmanager";
import type { StoreDomainKey } from "@/components/common/store/storeAdapters";

/**
 * Tier 1-A — the modal-domain registry.
 * One registry drives every create/edit modal. Configs are built at module
 * load from the store adapters, so wiring regressions (wrong deleteKind,
 * leaked row columns, missing date defaults) break every domain at once.
 */

const { makeDocAdapter, makeRecordAdapter, getStoreAdapterMock } = vi.hoisted(() => {
  const makeDocAdapter = (domain: string, overrides: Record<string, unknown> = {}) => ({
    storeType: "doc" as const,
    domain,
    modalTitle: (record: unknown) => (record ? `Edit ${domain}` : `Add ${domain}`),
    modalInitialData: (record: unknown) => ({
      mapped: (record as { name?: string } | null)?.name ?? "",
    }),
    modalAllowFiles: true,
    modalAllowLinking: true,
    modalDeleteLabel: "Delete",
    modalDeleteKind: "cascade" as const,
    fetchData: async () => ({
      rows: [{ id: "p1", name: "Parent" }],
      documents: [{ id: "d1", label: "Doc", domain, linked_id: "p1" }],
    }),
    deriveParentRecords: (rows: Array<{ id: string; name?: string }>) =>
      rows.map((r) => ({ id: r.id, name: r.name ?? "Parent" })),
    saveRecord: async () => ({ id: "saved", name: "saved" }),
    deleteRecord: async () => {},
    ...overrides,
  });

  const makeRecordAdapter = (overrides: Record<string, unknown> = {}) => ({
    storeType: "record" as const,
    domain: undefined as string | undefined,
    modalTitle: (record: unknown) => (record ? "Edit" : "Add"),
    modalInitialData: () => ({ mapped: "" }),
    modalDeleteLabel: "Delete",
    fetchData: async () => ({ rows: [] }),
    mapRecordToItem: (r: { id: string }) => ({ id: r.id, title: "", values: [] }),
    saveRecord: async () => ({
      id: "saved",
      name: "n",
      site_name: "site",
      bank_name: "bank",
    }),
    deleteRecord: async () => {},
    bulkDeleteRecords: async () => {},
    itemName: "item",
    ...overrides,
  });

  const getStoreAdapterMock = vi.fn();

  return { makeDocAdapter, makeRecordAdapter, getStoreAdapterMock };
});

vi.mock("@/api/serverDate", () => ({
  getServerDateIST: vi.fn(async () => "2026-08-23"),
}));

vi.mock("@/api/taskmanager", () => ({
  createTask: vi.fn(async () => ({ id: "t1", name: "task" })),
  updateTask: vi.fn(async () => ({ id: "t1", name: "task" })),
  deleteTask: vi.fn(async () => {}),
}));

vi.mock("@/api/common/documents", () => ({
  createDocument: vi.fn(),
  updateDocument: vi.fn(),
  deleteDocument: vi.fn(),
  fetchDocuments: vi.fn(async () => []),
}));

vi.mock("@/api/common/documentStorage", () => ({
  uploadDocumentFile: vi.fn(async () => ({
    fileName: "file.enc",
    iv: "iv",
    mimeType: "application/pdf",
  })),
  deleteDocumentFile: vi.fn(async () => {}),
}));

vi.mock("@/components/common/store/storeAdapters", () => {
  // The registry builds its configs at module load, so the adapter graph must
  // be wired before modalDomainConfig is first imported.
  getStoreAdapterMock.mockImplementation((domain: string) => {
    switch (domain) {
      case "taskmanager":
        return makeDocAdapter("taskmanager", { createParent: async () => "parent-1" });
      case "education":
        return makeDocAdapter("education", { createParent: async () => "parent-1" });
      case "expense":
        return makeDocAdapter("expense", { modalAllowLinking: false });
      case "medical":
        return makeDocAdapter("medical", {
          modalAllowLinking: false,
          modalDeleteKind: "simple",
        });
      case "vault":
        return makeDocAdapter("vault", {
          modalDeleteKind: "simple",
          createParent: async () => "parent-1",
        });
      case "vault_records":
        return makeRecordAdapter({ domain: "vault", allowFiles: true });
      case "vault_passwords":
        return makeRecordAdapter({});
      case "vault_banks":
        return makeRecordAdapter({});
      case "vault_bank_details":
        return makeRecordAdapter({});
      default:
        throw new Error(`Unexpected store domain in test: ${domain}`);
    }
  });
  return { getStoreAdapter: getStoreAdapterMock };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("storeToModalDomain", () => {
  it.each([
    ["taskmanager", "taskmanager_notes"],
    ["vault", "vault_documents"],
    ["education", "education"],
    ["expense", "expense"],
    ["medical", "medical"],
    ["vault_records", "vault_records"],
    ["vault_passwords", "vault_passwords"],
    ["vault_banks", "vault_banks"],
    ["vault_bank_details", "vault_bank_details"],
  ] as const)("maps store key %s to modal key %s", (store, modal) => {
    expect(storeToModalDomain(store as StoreDomainKey)).toBe(modal);
  });
});

describe("getModalDomainConfig — taskmanager", () => {
  const config = getModalDomainConfig("taskmanager");

  it("is a record modal without files, linking or inline creation", () => {
    expect(config.label).toBe("taskmanager");
    expect(config.allowFiles).toBe(false);
    expect(config.allowLinking).toBe(false);
    expect(config.canCreateParent).toBe(false);
    expect(config.deleteKind).toBe("simple");
    expect(config.deleteLabel).toBe("Delete");
    expect(config.docDomain).toBeUndefined();
  });

  it("maps edit-mode fields exactly and never leaks row plumbing columns", () => {
    const out = config.initialDataFor({
      id: "1",
      user_id: "u1",
      iv: "iv",
      data: "{}",
      created_at: "2026-01-01T00:00:00Z",
      name: "Task A",
      priority: "low",
      due_date: "2026-07-09",
      mode: "offline",
      description: "desc",
      is_completed: true,
      extra: "ignored",
    });
    expect(Object.keys(out).sort()).toEqual([
      "description",
      "due_date",
      "is_completed",
      "mode",
      "name",
      "priority",
    ]);
    expect(out).toEqual({
      name: "Task A",
      priority: "low",
      due_date: "2026-07-09",
      mode: "offline",
      description: "desc",
      is_completed: true,
    });
  });

  it("defaults every field when the row is null", () => {
    expect(config.initialDataFor(null)).toEqual({
      name: "",
      priority: "medium",
      due_date: "",
      mode: "online",
      description: "",
      is_completed: false,
    });
  });

  it("defaults due_date to the IST server date in create mode", async () => {
    await expect(config.createDefaults!()).resolves.toEqual({ due_date: "2026-08-23" });
    expect(getServerDateIST).toHaveBeenCalledTimes(1);
  });

  it("routes saves to createTask/updateTask and rejects an empty name", async () => {
    const fileActions = { newFiles: [], docsToLink: [], docsToUnlink: [], docsToDelete: [] };
    const ctx = { documents: [], parentRecords: [] };

    const created = await config.saveRecord(
      "u1",
      null,
      {
        name: "  Trimmed  ",
        priority: "high",
        due_date: "",
        mode: "online",
        description: "",
        is_completed: false,
      },
      fileActions,
      ctx,
    );
    expect(createTask).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ name: "Trimmed", due_date: null }),
    );
    expect(created.name).toBe("task");

    await config.saveRecord(
      "u1",
      { type: "record", id: "t1", data: { id: "t1" } },
      {
        name: "X",
        priority: "medium",
        due_date: "2026-07-09",
        mode: "online",
        description: "",
        is_completed: false,
      },
      fileActions,
      ctx,
    );
    expect(updateTask).toHaveBeenCalledWith(
      "u1",
      "t1",
      expect.objectContaining({ name: "X" }),
    );

    await expect(
      config.saveRecord("u1", null, { name: "   " }, fileActions, ctx),
    ).rejects.toThrow("Task name is required.");
  });
});

describe("getModalDomainConfig — document-store domains", () => {
  it.each([
    ["taskmanager_notes", "taskmanager", true, true, "cascade", true],
    ["education", "education", true, true, "cascade", true],
    ["expense", "expense", true, false, "cascade", false],
    ["medical", "medical", true, false, "simple", false],
    ["vault_documents", "vault", true, true, "simple", true],
  ] as const)(
    "%s wires the %s doc adapter",
    (modalKey, storeKey, allowFiles, allowLinking, deleteKind, canCreateParent) => {
      const config = getModalDomainConfig(modalKey);
      expect(config.label).toBe(storeKey);
      expect(config.docDomain).toBe(storeKey);
      expect(config.allowFiles).toBe(allowFiles);
      expect(config.allowLinking).toBe(allowLinking);
      expect(config.deleteKind).toBe(deleteKind);
      expect(config.canCreateParent).toBe(canCreateParent);
    },
  );

  it("translates document titles independently of the adapter", () => {
    const config = getModalDomainConfig("education");
    expect(config.modalTitle("document", true)).toBe("Edit Document");
    expect(config.modalTitle("document", false)).toBe("Add Document");
    expect(config.modalTitle("record", true, { name: "X" })).toBe("Edit education");
    expect(config.modalTitle("record", false, null)).toBe("Add education");
  });

  it("delegates initialDataFor to the adapter mapping", () => {
    const config = getModalDomainConfig("expense");
    expect(config.initialDataFor({ name: "Chair" })).toEqual({ mapped: "Chair" });
  });

  it("resolves fetchContext from the adapter's rows and documents", async () => {
    const ctx = await getModalDomainConfig("taskmanager_notes").fetchContext("u1");
    expect(ctx.documents).toEqual([
      { id: "d1", label: "Doc", domain: "taskmanager", linked_id: "p1" },
    ]);
    expect(ctx.parentRecords).toEqual([{ id: "p1", name: "Parent" }]);
  });

  it("attaches createDefaults only to taskmanager/education/expense/medical", async () => {
    expect(getModalDomainConfig("taskmanager").createDefaults).toBeDefined();
    expect(getModalDomainConfig("education").createDefaults).toBeDefined();
    expect(getModalDomainConfig("expense").createDefaults).toBeDefined();
    expect(getModalDomainConfig("medical").createDefaults).toBeDefined();
    expect(getModalDomainConfig("taskmanager_notes").createDefaults).toBeUndefined();
    expect(getModalDomainConfig("vault_documents").createDefaults).toBeUndefined();

    await expect(getModalDomainConfig("education").createDefaults!()).resolves.toEqual({
      due_date: "2026-08-23",
    });
    await expect(getModalDomainConfig("expense").createDefaults!()).resolves.toEqual({
      date: "2026-08-23",
    });
    await expect(getModalDomainConfig("medical").createDefaults!()).resolves.toEqual({
      date: "2026-08-23",
    });
  });

  it("supports standalone document CRUD on document stores only", () => {
    for (const key of [
      "taskmanager_notes",
      "education",
      "expense",
      "medical",
      "vault_documents",
    ] as const) {
      expect(getModalDomainConfig(key).saveDocument).toBeDefined();
      expect(getModalDomainConfig(key).deleteDocument).toBeDefined();
    }
    for (const key of [
      "taskmanager",
      "vault_records",
      "vault_passwords",
      "vault_banks",
      "vault_bank_details",
    ] as const) {
      expect(getModalDomainConfig(key).saveDocument).toBeUndefined();
      expect(getModalDomainConfig(key).deleteDocument).toBeUndefined();
    }
  });
});

describe("getModalDomainConfig — record-store domains", () => {
  it.each(["vault_records", "vault_passwords", "vault_banks"] as const)(
    "%s is a simple-delete record modal without inline creation",
    (key) => {
      const config = getModalDomainConfig(key);
      expect(config.deleteKind).toBe("simple");
      expect(config.canCreateParent).toBe(false);
    },
  );

  it("vault_records enables the file pane from the adapter's allowFiles", () => {
    const config = getModalDomainConfig("vault_records");
    expect(config.allowFiles).toBe(true);
    expect(config.allowLinking).toBe(true);
  });

  it("vault_passwords and vault_banks have no file pane", () => {
    expect(getModalDomainConfig("vault_passwords").allowFiles).toBe(false);
    expect(getModalDomainConfig("vault_banks").allowFiles).toBe(false);
  });

  it("derives save-result names from the adapter result", async () => {
    const fileActions = { newFiles: [], docsToLink: [], docsToUnlink: [], docsToDelete: [] };
    const ctx = { documents: [], parentRecords: [] };

    const passwords = await getModalDomainConfig("vault_passwords").saveRecord(
      "u1",
      null,
      { site_name: "s", username: "u", password: "p" },
      fileActions,
      ctx,
    );
    expect(passwords.id).toBe("saved");
    expect(passwords.name).toBe("site");

    const banks = await getModalDomainConfig("vault_banks").saveRecord(
      "u1",
      null,
      { bank_name: "SBI" },
      fileActions,
      ctx,
    );
    expect(banks.name).toBe("bank");
  });
});

describe("getModalDomainConfig — vault_bank_details", () => {
  it("builds a scope-scoped adapter and caches the config per bankId", () => {
    const a = getModalDomainConfig("vault_bank_details", { bankId: "b1" });
    const b = getModalDomainConfig("vault_bank_details", { bankId: "b1" });
    expect(a).toBe(b);
    expect(getStoreAdapterMock).toHaveBeenCalledWith("vault_bank_details", {
      bankId: "b1",
    });

    getModalDomainConfig("vault_bank_details", { bankId: "b2" });
    expect(getStoreAdapterMock).toHaveBeenCalledWith("vault_bank_details", {
      bankId: "b2",
    });
  });
});

describe("getModalDomainConfig — registry errors", () => {
  it("throws on unknown modal domains", () => {
    expect(() => getModalDomainConfig("nope")).toThrow("Unknown modal domain: nope");
  });
});
