import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Test runner config for the media tracking test suite (and future domains).
 *
 * - `.mts` keeps the config native-ESM so it survives Vite's future
 *   `configLoader: 'native'` default (an ESM file loaded as CommonJS would
 *   otherwise break on a future major).
 * - `@` path alias mirrors tsconfig.json so tests import app code identically
 *   to production code.
 * - Node environment is enough for Tier 1 pure-function tests; a jsdom
 *   environment can be added per-file via `// @vitest-environment jsdom`
 *   if component tests are ever introduced.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    // Integration tests hit the live dummy-user Supabase project and are
    // gated behind credentials in .env.test.local — keep them out of the
    // default unit run (run them via `npm run test:integration`).
    exclude: ["**/*.integration.test.ts"],
  },
});
