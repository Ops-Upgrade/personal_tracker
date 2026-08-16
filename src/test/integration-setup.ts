import { beforeAll, afterEach, vi } from "vitest";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "node:process";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getTestSession } from "./testSession";
import { wipeTestUserData } from "./integration-helpers";
import { bootstrapCrypto } from "@/lib/crypto";
import { clearMediaCache } from "@/api/media";

/**
 * Shared setup for the media Tier 2/3 integration suite
 * (docs/plans/PLAN-mediamanager.md Stage 11).
 *
 * - Fails FAST (throws at load) when the test credentials are absent — the
 *   suite never silently skips.
 * - Mocks only the two browser-only boundaries: `@/lib/supabase/client`
 *   (createBrowserClient → the real signed-in supabase-js client) and
 *   `@/lib/crypto/store` (IndexedDB → in-memory Map). Everything else —
 *   encryption, the media API layer, RLS — is the real production path.
 */

// ── 1. Local env (fail fast when credentials are absent) ──

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
for (const envFile of [".env.local", ".env.test.local"]) {
  try {
    loadEnvFile(`${projectRoot}/${envFile}`);
  } catch {
    // .env.local may be absent in CI; a missing .env.test.local is caught by
    // the explicit env check below with a clearer message.
  }
}

const requiredEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "TEST_USER_EMAIL",
  "TEST_USER_PASSWORD",
];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  throw new Error(
    `Integration tests are gated behind test credentials: ${missingEnv.join(
      ", ",
    )} missing from .env.local / .env.test.local. ` +
      `Add them (see docs/plans/PLAN-mediamanager.md Stage 11) or run only ` +
      `unit tests with "npm test".`,
  );
}

// ── 2. Browser-only boundaries → real client / in-memory store ──

const clientHolder = vi.hoisted(() => ({
  client: null as SupabaseClient | null,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => {
    if (!clientHolder.client) {
      throw new Error(
        "Integration test Supabase client not initialized (beforeAll failed?).",
      );
    }
    return clientHolder.client;
  },
}));

vi.mock("@/lib/crypto/store", () => {
  const deks = new Map<string, CryptoKey>();
  return {
    saveDEK: async (userId: string, dek: CryptoKey) => {
      deks.set(userId, dek);
    },
    loadDEK: async (userId: string) => deks.get(userId) ?? null,
    clearDEK: async (userId: string) => {
      deks.delete(userId);
    },
    hasDEK: async (userId: string) => deks.has(userId),
  };
});

// ── 3. Per-file bootstrap: sign in as the dummy user + unlock the DEK ──

beforeAll(async () => {
  const session = await getTestSession();
  clientHolder.client = session.client;
  // bootstrapCrypto self-creates the user_keys row on first login; on later
  // runs it derives the KEK and unwraps the existing DEK into the mock store.
  await bootstrapCrypto(session.userId, session.password, session.email);
});

// ── 4. Per-test teardown: remove only rows this run created ──

afterEach(async () => {
  const session = await getTestSession();
  await wipeTestUserData(session);
  clearMediaCache();
});
