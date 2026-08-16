import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Integration config for the media Tier 2/3 suite (real Supabase project,
 * dummy test user — see docs/plans/PLAN-mediamanager.md Stage 11).
 *
 * Safety properties:
 * - Separate glob (`*.integration.test.ts`) — never part of `npm test`.
 * - `fileParallelism: false` — one file at a time, so the per-file dummy-user
 *   session and per-test wipes can't race.
 * - The setup file fails FAST (throws) when the test credentials are absent —
 *   the suite never silently skips.
 * - Only the dummy user's password is used — never a service-role key.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    setupFiles: ["src/test/integration-setup.ts"],
    fileParallelism: false,
    // Sign-in + Argon2id DEK bootstrap happens per file; per-test assertions
    // each make a handful of real network round-trips.
    testTimeout: 60_000,
    hookTimeout: 180_000,
  },
});
