import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

/**
 * Real signed-in Supabase client for the dummy test user
 * (docs/plans/PLAN-mediamanager.md Stage 11).
 *
 * Safety properties:
 * - Signed in as `TEST_USER_EMAIL` from the gitignored `.env.test.local` —
 *   never the real user, never a service-role key.
 * - `persistSession: false` — the session lives in memory only (Node has no
 *   localStorage; nothing is written to disk).
 * - PKCE is attempted first with an implicit-flow fallback, mirroring the
 *   production client's security posture without depending on browser APIs.
 */

export interface TestSession {
  client: SupabaseClient;
  userId: string;
  email: string;
  password: string;
}

function memoryStorage(): {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
} {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

async function signIn(): Promise<TestSession> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;

  if (!url || !publishableKey || !email || !password) {
    throw new Error(
      "Supabase URL / publishable key / test credentials missing from env " +
        "(integration-setup should have failed fast before reaching this).",
    );
  }

  // PKCE first — matches production auth; the storage adapter replaces
  // localStorage, which Node lacks.
  let client = createSupabaseClient(url, publishableKey, {
    auth: {
      flowType: "pkce",
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage: memoryStorage(),
    },
  });

  let auth = await client.auth.signInWithPassword({ email, password });
  if (auth.error) {
    // Fallback: implicit flow (no PKCE code exchange available here).
    client = createSupabaseClient(url, publishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storage: memoryStorage(),
      },
    });
    auth = await client.auth.signInWithPassword({ email, password });
  }

  if (auth.error || !auth.data.user) {
    throw new Error(
      `Integration test sign-in failed for ${email}: ` +
        `${auth.error?.message ?? "no user returned"}. Check TEST_USER_EMAIL / ` +
        `TEST_USER_PASSWORD in .env.test.local.`,
    );
  }

  return { client, userId: auth.data.user.id, email, password };
}

let sessionPromise: Promise<TestSession> | null = null;

/**
 * Sign in once and reuse the session. Vitest isolates each test file's
 * module registry, so this is effectively per-file (which is what the
 * sequential `fileParallelism: false` integration run expects).
 */
export function getTestSession(): Promise<TestSession> {
  if (!sessionPromise) sessionPromise = signIn();
  return sessionPromise;
}
