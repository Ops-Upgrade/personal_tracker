// @vitest-environment node
import { describe, expect, it } from "vitest";
import { formatBytes, formatShortDate } from "@/lib/format";

/**
 * Tier 1-A — shared formatting utilities.
 * formatShortDate feeds every domain's list views via the grid token engine;
 * formatBytes renders attachment sizes. Both must stay timezone-stable.
 */

describe("formatShortDate", () => {
  it("returns the em-dash placeholder for null and empty values", () => {
    expect(formatShortDate(null)).toBe("—");
    expect(formatShortDate("")).toBe("—");
  });

  it("formats date-only strings as DD/MM/YY without any timezone shift", () => {
    expect(formatShortDate("2026-07-09")).toBe("09/07/26");
    expect(formatShortDate("2026-12-31")).toBe("31/12/26");
    expect(formatShortDate("2026-01-01")).toBe("01/01/26");
  });

  it("formats ISO timestamps without shifting the day", () => {
    // Noon-UTC instants (and 13:00Z from the +05:30 offset) stay on the same
    // calendar day for every IANA offset, so these are machine-independent.
    expect(formatShortDate("2026-07-09T12:00:00Z")).toBe("09/07/26");
    expect(formatShortDate("2026-07-09T18:30:00+05:30")).toBe("09/07/26");
  });
});

describe("formatBytes", () => {
  it("renders raw bytes below 1 KB", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1023)).toBe("1023 B");
  });

  it("renders KB with one decimal", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  it("renders MB with one decimal", () => {
    expect(formatBytes(1048576)).toBe("1.0 MB");
  });
});
