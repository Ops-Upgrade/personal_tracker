import { describe, expect, it, vi } from "vitest";
import {
  getStoreAdapter,
  type StoreAdapter,
  type StoreDomainKey,
} from "@/components/common/store/storeAdapters";

/**
 * Tier 1 — Store adapter registry tests.
 *
 * `storeAdapters.ts` is the single domain-dispatch point behind GenericStorePage.
 * Two things are worth locking down without a browser:
 *
 *   1. Dispatch — every StoreDomainKey resolves to an adapter of the right
 *      store type with the capability flags the store UI keys its buttons off.
 *   2. `modalInitialData` hygiene — the form seed must contain *only* form
 *      fields. Leaking `id` / `created_at` into form state is how a save round-trips
 *      DB-owned columns back into the encrypted blob, and any `undefined` value
 *      flips a controlled React input to uncontrolled on first render.
 *
 * Every API module is mocked so the registry never reaches Supabase, the crypto
 * KMS, or R2 — the adapters are only *constructed* here, never executed.
 */

vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/crypto", () => ({ encryptField: vi.fn(), decryptField: vi.fn() }));
vi.mock("@/api/taskmanager", () => ({
  fetchNotes: vi.fn(),
  createNote: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
}));
vi.mock("@/api/education", () => ({
  fetchEducations: vi.fn(),
  createEducation: vi.fn(),
  updateEducation: vi.fn(),
  deleteEducation: vi.fn(),
}));
vi.mock("@/api/expense", () => ({
  fetchExpenses: vi.fn(),
  createExpense: vi.fn(),
  updateExpense: vi.fn(),
  deleteExpense: vi.fn(),
}));
vi.mock("@/api/medical", () => ({
  fetchMedicalRecords: vi.fn(),
  createMedicalRecord: vi.fn(),
  updateMedicalRecord: vi.fn(),
  deleteMedicalRecord: vi.fn(),
}));
vi.mock("@/api/vault", () => ({
  fetchVaultEntriesBySection: vi.fn(),
  createVaultEntry: vi.fn(),
  updateVaultEntry: vi.fn(),
  deleteVaultEntry: vi.fn(),
}));
vi.mock("@/api/common/documents", () => ({
  fetchDocuments: vi.fn(),
  createDocument: vi.fn(),
  updateDocument: vi.fn(),
  deleteDocument: vi.fn(),
}));
vi.mock("@/api/common/documentStorage", () => ({
  uploadDocumentFile: vi.fn(),
  deleteDocumentFile: vi.fn(),
}));

// ── Helpers ──

/**
 * `StoreAdapter` is a union of nine differently-parameterised adapters, so its
 * members are only callable after narrowing. These tests deliberately assert
 * across the whole registry, so widen once here instead of narrowing nine times.
 */
interface LooseAdapter {
  storeType: "doc" | "record";
  domain?: string;
  modalTitle: (record: unknown) => string;
  modalInitialData: (record: unknown) => Record<string, unknown>;
  modalDeleteLabel: string;
  modalAllowFiles?: boolean;
  modalAllowLinking?: boolean;
  modalDeleteKind?: "cascade" | "simple";
  modalLayout?: string[][];
}

function loose(adapter: StoreAdapter): LooseAdapter {
  return adapter as unknown as LooseAdapter;
}

/** Every key the registry's switch must handle. */
const ALL_DOMAINS: StoreDomainKey[] = [
  "taskmanager",
  "expense",
  "education",
  "medical",
  "vault",
  "vault_banks",
  "vault_bank_details",
  "vault_passwords",
  "vault_records",
];

/** Scope required by the one scope-dependent adapter. */
const SCOPE: Partial<Record<StoreDomainKey, Record<string, string>>> = {
  vault_bank_details: { bankId: "bank-1" },
};

function adapterFor(domain: StoreDomainKey): LooseAdapter {
  return loose(getStoreAdapter(domain, SCOPE[domain]));
}

/** The exact form-field keys each adapter is allowed to seed. */
const EXPECTED_FIELD_KEYS: Record<StoreDomainKey, string[]> = {
  taskmanager: ["name", "content"],
  education: [
    "name",
    "provider",
    "priority",
    "due_date",
    "description",
    "is_completed",
  ],
  expense: ["item", "seller", "cost", "date", "reason"],
  medical: ["name", "clinic", "date", "diagnosis_timeline"],
  vault: ["name", "value"],
  vault_banks: ["bank_name"],
  vault_bank_details: ["name", "pin"],
  vault_passwords: ["site_name", "username", "password"],
  vault_records: ["name", "value"],
};

/** Domain payloads for a hydrated (already-persisted, decrypted) row. */
const DOMAIN_FIELDS: Record<StoreDomainKey, Record<string, unknown>> = {
  taskmanager: { name: "Renewal checklist", content: "<p>body</p>", document_ids: [] },
  education: {
    name: "Security+",
    provider: "CompTIA",
    priority: "high",
    due_date: "2026-03-01T00:00:00Z",
    description: "<p>cert</p>",
    is_completed: true,
    completed_at: "2026-02-01T00:00:00Z",
    document_ids: [],
  },
  expense: {
    item: "Laptop",
    seller: "Acme",
    cost: 132999.5,
    date: "2026-01-15T00:00:00Z",
    reason: "<p>work</p>",
    document_ids: [],
  },
  medical: {
    name: "Blood panel",
    clinic: "City Labs",
    date: "2026-01-20",
    diagnosis_timeline: "<p>normal</p>",
    document_ids: [],
  },
  vault: { section: "records", name: "Aadhaar", value: "1234 5678 9012" },
  vault_banks: { section: "banks", bank_name: "HDFC Bank", pins: [] },
  vault_bank_details: { name: "ATM PIN", pin: "4321" },
  vault_passwords: {
    section: "passwords",
    site_name: "Gmail",
    username: "user@example.com",
    password: "hunter2",
  },
  vault_records: { section: "records", name: "PAN", value: "ABCDE1234F" },
};

/** A decrypted row as it arrives from the API layer: DB columns + blob fields. */
function hydratedRow(domain: StoreDomainKey): Record<string, unknown> {
  return {
    id: "test-id",
    created_at: "2026-01-01T00:00:00.000Z",
    ...DOMAIN_FIELDS[domain],
  };
}

// ── Registry dispatch ──

describe("getStoreAdapter dispatch", () => {
  it.each(ALL_DOMAINS)("returns an adapter for %s", (domain) => {
    expect(adapterFor(domain)).toBeTruthy();
  });

  it.each(["taskmanager", "expense", "education", "medical", "vault"] as const)(
    "resolves %s to a doc store",
    (domain) => {
      expect(adapterFor(domain).storeType).toBe("doc");
    },
  );

  it.each(["vault_passwords", "vault_records", "vault_banks", "vault_bank_details"] as const)(
    "resolves %s to a record store",
    (domain) => {
      expect(adapterFor(domain).storeType).toBe("record");
    },
  );

  it.each([
    ["taskmanager", "taskmanager"],
    ["expense", "expense"],
    ["education", "education"],
    ["medical", "medical"],
    ["vault", "vault"],
  ] as const)("tags the %s doc adapter with the %s document domain", (key, domain) => {
    expect(adapterFor(key).domain).toBe(domain);
  });

  it("gives every adapter a delete label for its confirm dialog", () => {
    for (const domain of ALL_DOMAINS) {
      expect(adapterFor(domain).modalDeleteLabel).toBeTruthy();
    }
  });
});

// ── Capability flags ──

describe("doc adapter capability flags", () => {
  it.each(["taskmanager", "education", "vault"] as const)(
    "allows linking existing documents on %s",
    (domain) => {
      expect(adapterFor(domain).modalAllowLinking).toBe(true);
    },
  );

  it.each(["expense", "medical"] as const)(
    "disallows linking on %s (receipts/reports belong to exactly one record)",
    (domain) => {
      expect(adapterFor(domain).modalAllowLinking).toBe(false);
    },
  );

  it.each(["taskmanager", "expense", "education", "medical", "vault"] as const)(
    "enables the file pane on %s",
    (domain) => {
      expect(adapterFor(domain).modalAllowFiles).toBe(true);
    },
  );

  it.each([
    ["taskmanager", "cascade"],
    ["education", "cascade"],
    ["expense", "cascade"],
    ["medical", "simple"],
    ["vault", "simple"],
  ] as const)("uses the %s delete kind %s", (domain, kind) => {
    expect(adapterFor(domain).modalDeleteKind).toBe(kind);
  });
});

describe("scope-dependent adapters", () => {
  it("builds a bank-details adapter bound to the scoped bankId", () => {
    expect(getStoreAdapter("vault_bank_details", { bankId: "bank-1" })).toBeTruthy();
  });

  it("still returns a usable adapter when no scope is supplied", () => {
    const adapter = loose(getStoreAdapter("vault_bank_details"));
    expect(adapter.storeType).toBe("record");
    expect(adapter.modalInitialData(null)).toEqual({ name: "", pin: "" });
  });

  it("returns a fresh adapter instance per scope rather than a shared singleton", () => {
    const a = getStoreAdapter("vault_bank_details", { bankId: "bank-1" });
    const b = getStoreAdapter("vault_bank_details", { bankId: "bank-2" });
    expect(a).not.toBe(b);
  });
});

// ── modalTitle ──

describe("modalTitle", () => {
  it.each(ALL_DOMAINS)("returns a non-empty create title for %s", (domain) => {
    expect(adapterFor(domain).modalTitle(null)).toBeTruthy();
  });

  it.each(ALL_DOMAINS)("returns a distinct edit title for %s", (domain) => {
    const adapter = adapterFor(domain);
    expect(adapter.modalTitle(hydratedRow(domain))).not.toBe(adapter.modalTitle(null));
  });
});

// ── modalInitialData: plaintext hygiene ──

describe("modalInitialData plaintext hygiene", () => {
  it.each(ALL_DOMAINS)(
    "seeds %s from a null record without any DB-owned column",
    (domain) => {
      const data = adapterFor(domain).modalInitialData(null);
      expect(data).not.toHaveProperty("id");
      expect(data).not.toHaveProperty("created_at");
    },
  );

  it.each(ALL_DOMAINS)(
    "seeds %s from a hydrated row without leaking id or created_at into form state",
    (domain) => {
      const data = adapterFor(domain).modalInitialData(hydratedRow(domain));
      expect(data).not.toHaveProperty("id");
      expect(data).not.toHaveProperty("created_at");
    },
  );

  it.each(ALL_DOMAINS)(
    "seeds %s with exactly its declared form fields and nothing more",
    (domain) => {
      const data = adapterFor(domain).modalInitialData(hydratedRow(domain));
      expect(Object.keys(data).sort()).toEqual([...EXPECTED_FIELD_KEYS[domain]].sort());
    },
  );

  it.each(ALL_DOMAINS)(
    "never seeds %s with an undefined value (would flip inputs to uncontrolled)",
    (domain) => {
      for (const record of [null, hydratedRow(domain)]) {
        const data = adapterFor(domain).modalInitialData(record);
        for (const [key, value] of Object.entries(data)) {
          expect(value, `${domain}.${key} must not be undefined`).toBeDefined();
        }
      }
    },
  );
});

// ── modalInitialData: per-domain values ──

describe("modalInitialData values", () => {
  it("seeds an empty note form", () => {
    expect(adapterFor("taskmanager").modalInitialData(null)).toEqual({
      name: "",
      content: "",
    });
  });

  it("defaults a new education to medium priority and not-completed", () => {
    expect(adapterFor("education").modalInitialData(null)).toEqual({
      name: "",
      provider: "",
      priority: "medium",
      due_date: "",
      description: "",
      is_completed: false,
    });
  });

  it("normalizes a full ISO due_date down to the YYYY-MM-DD a date input requires", () => {
    const data = adapterFor("education").modalInitialData(hydratedRow("education"));
    expect(data.due_date).toBe("2026-03-01");
  });

  it("seeds an empty expense cost as a string, not the number 0", () => {
    const data = adapterFor("expense").modalInitialData(null);
    expect(data.cost).toBe("");
  });

  it("stringifies an existing expense cost for the text input", () => {
    const data = adapterFor("expense").modalInitialData(hydratedRow("expense"));
    expect(data.cost).toBe("132999.5");
    expect(typeof data.cost).toBe("string");
  });

  it("normalizes an ISO expense date for the date input", () => {
    const data = adapterFor("expense").modalInitialData(hydratedRow("expense"));
    expect(data.date).toBe("2026-01-15");
  });

  it("round-trips medical fields verbatim", () => {
    expect(adapterFor("medical").modalInitialData(hydratedRow("medical"))).toEqual({
      name: "Blood panel",
      clinic: "City Labs",
      date: "2026-01-20",
      diagnosis_timeline: "<p>normal</p>",
    });
  });

  it("seeds a password form with the stored credential", () => {
    expect(adapterFor("vault_passwords").modalInitialData(hydratedRow("vault_passwords"))).toEqual({
      site_name: "Gmail",
      username: "user@example.com",
      password: "hunter2",
    });
  });

  it("seeds a bank form with only the bank name, never its PIN array", () => {
    const data = adapterFor("vault_banks").modalInitialData(hydratedRow("vault_banks"));
    expect(data).toEqual({ bank_name: "HDFC Bank" });
    expect(data).not.toHaveProperty("pins");
  });

  it("seeds a vault record form with name and value", () => {
    expect(adapterFor("vault_records").modalInitialData(hydratedRow("vault_records"))).toEqual({
      name: "PAN",
      value: "ABCDE1234F",
    });
  });

  it("never seeds a vault form with the section discriminator", () => {
    for (const domain of ["vault", "vault_records", "vault_passwords", "vault_banks"] as const) {
      expect(adapterFor(domain).modalInitialData(hydratedRow(domain))).not.toHaveProperty(
        "section",
      );
    }
  });

  it("never seeds a doc-linked form with document_ids", () => {
    for (const domain of ["taskmanager", "education", "expense", "medical"] as const) {
      expect(adapterFor(domain).modalInitialData(hydratedRow(domain))).not.toHaveProperty(
        "document_ids",
      );
    }
  });
});
