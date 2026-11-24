// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listCollections, updateCollection } from "@/api/media/collections";
import { listMedia } from "@/api/media/media";
import { fetchMedicalRecords } from "@/api/medical/records";
import { fetchNotes } from "@/api/taskmanager/notes";
import { fetchTasks } from "@/api/taskmanager/tasks";
import { fetchVaultEntries } from "@/api/vault/vaultEntries";
import { checkVaultPinSet } from "@/api/vault/vaultPin";
import { fetchDocuments } from "@/api/common/documents";
import { fetchEducations } from "@/api/education/educations";
import { fetchExpenses } from "@/api/expense/expenses";

/**
 * Tier 1 — error opacity across the API layer (regression pins).
 *
 * Supabase error detail (messages, codes, hints) must never reach the
 * caller. Every module below rejects with an opaque message; the mock
 * Supabase client fails each query with a sentinel detail string, and any
 * rejection containing the sentinel fails the test.
 */

const SENTINEL = "SENTINEL_RAW_DB_DETAIL_9f3a";

const { state, browserClientMock, serverClientMock } = vi.hoisted(() => {
  const state = {
    error: null as { message: string; code: string } | null,
  };

  /**
   * Browser-module builder. Browser code calls `createClient()` WITHOUT
   * awaiting the client (`const supabase = createClient()`), then awaits the
   * query chain — so the builder itself must be thenable.
   */
  const makeBrowserBuilder = () => {
    const builder: Record<string, unknown> = {};
    for (const method of [
      "from",
      "select",
      "eq",
      "order",
      "ascending",
      "maybeSingle",
      "single",
      "insert",
      "update",
      "delete",
      "upsert",
    ]) {
      builder[method] = vi.fn(() => builder);
    }
    builder.then = (resolve: (v: unknown) => void) =>
      Promise.resolve(
        state.error
          ? { data: null, error: state.error }
          : { data: [], error: null }
      ).then(resolve);
    return builder;
  };

  /**
   * Server-module builder. Server actions do `const supabase = await
   * createClient()` — awaiting the CLIENT. A thenable client would be
   * assimilated by promise resolution into its query result, so this builder
   * is plain and the TERMINAL methods resolve the result directly
   * (the same shape the repo's vaultPin.test.ts uses). Server actions also
   * derive the caller from `supabase.auth.getClaims()`.
   */
  const makeServerBuilder = () => {
    const builder: Record<string, unknown> = {};
    builder.auth = {
      getClaims: vi.fn(async () => ({
        data: { claims: { sub: "u1" } },
        error: null,
      })),
    };
    for (const method of ["from", "select", "eq", "order", "ascending", "update"]) {
      builder[method] = vi.fn(() => builder);
    }
    builder.single = vi.fn(async () =>
      state.error ? { data: null, error: state.error } : { data: [], error: null }
    );
    builder.maybeSingle = vi.fn(async () =>
      state.error ? { data: null, error: state.error } : { data: [], error: null }
    );
    return builder;
  };

  return {
    state,
    browserClientMock: vi.fn(() => makeBrowserBuilder()),
    serverClientMock: vi.fn(async () => makeServerBuilder()),
  };
});

vi.mock("@ops-upgrade/auth-core", () => ({
  createBrowserClient: browserClientMock,
  createServerClient: serverClientMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
  state.error = null;
});

type Call = (userId: string) => Promise<unknown>;

/** Feature CRUD modules — all now opaque. */
const LEAKY_MODULES: Array<[string, Call]> = [
  ["media/collections.updateCollection", (u) => updateCollection(u, "c1", { name: "x" })],
  ["media/media.listMedia", (u) => listMedia(u)],
  ["medical/records.fetchMedicalRecords", (u) => fetchMedicalRecords(u)],
  ["taskmanager/notes.fetchNotes", (u) => fetchNotes(u)],
  ["taskmanager/tasks.fetchTasks", (u) => fetchTasks(u)],
  ["vault/vaultEntries.fetchVaultEntries", (u) => fetchVaultEntries(u)],
  ["vault/vaultPin.checkVaultPinSet", () => checkVaultPinSet()],
];

/** Modules made opaque earlier (regression pins). */
const FIXED_MODULES: Array<[string, Call]> = [
  ["media/collections.listCollections", (u) => listCollections(u)],
  ["common/documents.fetchDocuments", (u) => fetchDocuments(u)],
  ["education/educations.fetchEducations", (u) => fetchEducations(u)],
  ["expense/expenses.fetchExpenses", (u) => fetchExpenses(u)],
];

async function rejectionOf(call: Call): Promise<unknown> {
  state.error = { message: SENTINEL, code: "XX000" };
  try {
    await call("u1");
  } catch (e) {
    return e;
  }
  return null;
}

describe("error opacity — no raw supabase detail reaches the caller", () => {
  for (const [name, call] of LEAKY_MODULES) {
    it(`${name} rejects with an opaque message`, async () => {
      const error = await rejectionOf(call);

      expect(error, `${name} must reject on a supabase error`).toBeInstanceOf(
        Error
      );
      const message = (error as Error).message;
      expect(message).not.toContain(SENTINEL);
      expect(message.length).toBeGreaterThan(0);
    });
  }

  for (const [name, call] of FIXED_MODULES) {
    it(`${name} (regression pin) rejects with an opaque message`, async () => {
      const error = await rejectionOf(call);

      expect(error, `${name} must reject on a supabase error`).toBeInstanceOf(
        Error
      );
      const message = (error as Error).message;
      expect(message).not.toContain(SENTINEL);
      expect(message.length).toBeGreaterThan(0);
    });
  }
});
