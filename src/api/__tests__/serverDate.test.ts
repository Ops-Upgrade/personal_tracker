// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatISTDisplay,
  getMonthName,
  getServerDateIST,
  parseISTDate,
  resetServerDateCache,
} from "@/api/serverDate";

/**
 * Tier 1-A — the IST server-date source for create-mode defaults.
 * Task/education/expense/medical all default a date field from
 * getServerDateIST(); a timezone regression here silently mis-dates every
 * new record.
 */

beforeEach(() => {
  vi.useFakeTimers();
  resetServerDateCache();
});

afterEach(() => {
  vi.useRealTimers();
  resetServerDateCache();
});

describe("getServerDateIST", () => {
  it("derives the IST calendar day on both sides of the IST-midnight boundary", async () => {
    // 18:30 UTC = 00:00 IST — the exact boundary instant.
    vi.setSystemTime(new Date("2026-07-08T18:29:59Z"));
    await expect(getServerDateIST()).resolves.toBe("2026-07-08");

    resetServerDateCache();
    vi.setSystemTime(new Date("2026-07-08T18:30:00Z"));
    await expect(getServerDateIST()).resolves.toBe("2026-07-09");
  });

  it("caches the result for the page session (one Intl.DateTimeFormat construction)", async () => {
    const spy = vi.spyOn(Intl, "DateTimeFormat");
    vi.setSystemTime(new Date("2026-07-09T12:00:00Z"));

    const first = await getServerDateIST();
    const second = await getServerDateIST();

    expect(first).toBe(second);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("recomputes after resetServerDateCache clears the module cache", async () => {
    vi.setSystemTime(new Date("2026-07-09T12:00:00Z"));
    await expect(getServerDateIST()).resolves.toBe("2026-07-09");

    resetServerDateCache();
    vi.setSystemTime(new Date("2026-07-10T12:00:00Z"));
    await expect(getServerDateIST()).resolves.toBe("2026-07-10");
  });
});

describe("parseISTDate", () => {
  it("splits YYYY-MM-DD with a 0-based month", () => {
    expect(parseISTDate("2026-07-09")).toEqual({ year: 2026, month: 6, day: 9 });
    expect(parseISTDate("2026-01-01")).toEqual({ year: 2026, month: 0, day: 1 });
  });
});

describe("formatISTDisplay", () => {
  it("renders day name, padded day, month abbreviation and full year", () => {
    // 2026-07-09 and 2026-01-01 are both Thursdays.
    expect(formatISTDisplay("2026-07-09")).toBe("Thursday, 09 Jul 2026");
    expect(formatISTDisplay("2026-01-01")).toBe("Thursday, 01 Jan 2026");
  });
});

describe("getMonthName", () => {
  it("maps 0-based months and returns an empty string out of range", () => {
    expect(getMonthName(0)).toBe("January");
    expect(getMonthName(11)).toBe("December");
    expect(getMonthName(12)).toBe("");
    expect(getMonthName(-1)).toBe("");
  });
});
