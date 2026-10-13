// @vitest-environment node
import { describe, expect, it } from "vitest";
import { resolveLogoutRedirect } from "@/app/logout/resolveLogoutRedirect";

/**
 * Tier 1 — logout redirect validation.
 *
 * The `?redirect=` query param is attacker-influenced and previously
 * validated with `endsWith(".ops-upgrade.net")` string matching. These
 * tests pin the strict origin allowlist: every known suffix-spoof vector
 * must resolve to null, and only true *.ops-upgrade.net origins (plus
 * localhost in dev) may pass.
 */

describe("resolveLogoutRedirect", () => {
  it.each(["https://ops-upgrade.net", "https://personal.ops-upgrade.net"])(
    "resolves the prod origin %s",
    (raw) => {
      expect(resolveLogoutRedirect(raw, true)).toBe(raw);
    },
  );

  it("normalizes an uppercase scheme/host to the canonical origin", () => {
    expect(resolveLogoutRedirect("HTTPS://OPS-UPGRADE.NET", true)).toBe(
      "https://ops-upgrade.net",
    );
  });

  it("resolves the localhost dev round-trip in non-prod", () => {
    expect(resolveLogoutRedirect("http://localhost:3001", false)).toBe(
      "http://localhost:3001",
    );
  });

  it.each([
    ["query-string suffix spoof", "https://evil.com/?.ops-upgrade.net"],
    ["fragment suffix spoof", "https://evil.com#.ops-upgrade.net"],
    ["username spoof", "https://ops-upgrade.net@evil.com"],
    ["prefix with no dot boundary", "https://evilops-upgrade.net"],
    ["appended TLD", "https://ops-upgrade.net.evil.com"],
    ["insecure scheme", "http://ops-upgrade.net"],
    ["javascript scheme", "javascript:alert(1)"],
    ["protocol-relative", "//evil.com"],
    ["bare hostname", "ops-upgrade.net"],
    ["backslash spoof", "https://evil.com\\.ops-upgrade.net"],
    ["empty string", ""],
    ["null", null],
  ])("rejects %s", (_label, raw) => {
    expect(resolveLogoutRedirect(raw, true)).toBeNull();
  });

  it("rejects a prod URL carrying a non-default port", () => {
    expect(resolveLogoutRedirect("https://ops-upgrade.net:8443", true)).toBeNull();
  });

  it("rejects localhost in prod", () => {
    expect(resolveLogoutRedirect("http://localhost:3001", true)).toBeNull();
  });
});
