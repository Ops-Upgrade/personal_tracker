import { describe, expect, it } from "vitest";
import {
  getUniqueFileName,
  groupByStatus,
  sortByCompletedAsc,
  sortByCompletedDesc,
  sortByCreatedAtDesc,
  sortByDueDateAsc,
  stripHtml,
  trunc,
} from "@/lib/viewHelpers";

/**
 * Tier 1 — Pure function unit tests for the shared view helpers.
 *
 * Every export here is dependency-free, so this suite needs no mocks and runs
 * in the default node environment. Comparators are checked both pairwise (the
 * raw contract: negative / zero / positive) and through a real `.sort()` call,
 * because the pairwise sign is what `Array.prototype.sort` actually consumes.
 */

// ── sortByDueDateAsc ──

describe("sortByDueDateAsc", () => {
  const row = (due_date: string | null) => ({ due_date });

  it("floats an unscheduled (null) due_date above a real date", () => {
    expect(sortByDueDateAsc(row(null), row("2026-01-01"))).toBeLessThan(0);
  });

  it("keeps a real date below an unscheduled (null) due_date", () => {
    expect(sortByDueDateAsc(row("2026-01-01"), row(null))).toBeGreaterThan(0);
  });

  it("treats two unscheduled rows as equal", () => {
    expect(sortByDueDateAsc(row(null), row(null))).toBe(0);
  });

  it("orders two real dates oldest-first", () => {
    expect(sortByDueDateAsc(row("2026-01-01"), row("2026-06-01"))).toBeLessThan(0);
    expect(sortByDueDateAsc(row("2026-06-01"), row("2026-01-01"))).toBeGreaterThan(0);
  });

  it("sorts a mixed list to nulls-first then ascending dates", () => {
    const rows = [row("2026-06-01"), row(null), row("2026-01-01")];
    expect(rows.slice().sort(sortByDueDateAsc).map((r) => r.due_date)).toEqual([
      null,
      "2026-01-01",
      "2026-06-01",
    ]);
  });
});

// ── sortByCompletedDesc ──

describe("sortByCompletedDesc", () => {
  const row = (completed_at: string | null) => ({ completed_at });

  it("puts the most recently completed row first", () => {
    expect(
      sortByCompletedDesc(row("2026-01-01"), row("2026-06-01")),
    ).toBeGreaterThan(0);
  });

  it("sinks a null completed_at to the bottom (treated as epoch 0)", () => {
    expect(sortByCompletedDesc(row(null), row("2026-01-01"))).toBeGreaterThan(0);
    expect(sortByCompletedDesc(row("2026-01-01"), row(null))).toBeLessThan(0);
  });

  it("treats two null completed_at values as equal", () => {
    expect(sortByCompletedDesc(row(null), row(null))).toBe(0);
  });

  it("sorts a mixed list newest-first with nulls last", () => {
    const rows = [row("2026-01-01"), row(null), row("2026-06-01")];
    expect(rows.slice().sort(sortByCompletedDesc).map((r) => r.completed_at)).toEqual([
      "2026-06-01",
      "2026-01-01",
      null,
    ]);
  });
});

// ── sortByCompletedAsc ──

describe("sortByCompletedAsc", () => {
  const row = (completed_at: string | null) => ({ completed_at });

  it("puts the oldest completed row first", () => {
    expect(sortByCompletedAsc(row("2026-06-01"), row("2026-01-01"))).toBeGreaterThan(0);
    expect(sortByCompletedAsc(row("2026-01-01"), row("2026-06-01"))).toBeLessThan(0);
  });

  it("floats a null completed_at to the top (epoch 0 precedes every real date)", () => {
    expect(sortByCompletedAsc(row(null), row("2026-01-01"))).toBeLessThan(0);
  });

  it("treats two null completed_at values as equal", () => {
    expect(sortByCompletedAsc(row(null), row(null))).toBe(0);
  });

  it("is the exact inverse of sortByCompletedDesc on a mixed list", () => {
    const rows = [row("2026-01-01"), row(null), row("2026-06-01")];
    const asc = rows.slice().sort(sortByCompletedAsc).map((r) => r.completed_at);
    const desc = rows.slice().sort(sortByCompletedDesc).map((r) => r.completed_at);
    expect(asc).toEqual(desc.slice().reverse());
  });
});

// ── sortByCreatedAtDesc ──

describe("sortByCreatedAtDesc", () => {
  const row = (created_at: string) => ({ created_at });

  it("puts the newest created_at first", () => {
    expect(sortByCreatedAtDesc(row("2026-01-01"), row("2026-06-01"))).toBeGreaterThan(0);
    expect(sortByCreatedAtDesc(row("2026-06-01"), row("2026-01-01"))).toBeLessThan(0);
  });

  it("treats identical timestamps as equal", () => {
    expect(sortByCreatedAtDesc(row("2026-01-01"), row("2026-01-01"))).toBe(0);
  });

  it("sorts a list newest-first", () => {
    const rows = [row("2026-01-01"), row("2026-12-01"), row("2026-06-01")];
    expect(rows.slice().sort(sortByCreatedAtDesc).map((r) => r.created_at)).toEqual([
      "2026-12-01",
      "2026-06-01",
      "2026-01-01",
    ]);
  });
});

// ── stripHtml ──

describe("stripHtml", () => {
  it("unwraps a paragraph, leaving no stray whitespace", () => {
    expect(stripHtml("<p>Hello</p>")).toBe("Hello");
  });

  it("turns a <br> into a space rather than joining words", () => {
    expect(stripHtml("<br/>Line")).toBe("Line");
    expect(stripHtml("one<br/>two")).toBe("one two");
  });

  it("splits adjacent paragraphs with a space instead of concatenating them", () => {
    expect(stripHtml("<p>one</p><p>two</p>")).toBe("one two");
  });

  it("strips nested tags", () => {
    expect(stripHtml("<b><i>Bold</i></b>")).toBe("Bold");
  });

  it("strips tags carrying attributes", () => {
    expect(stripHtml('<a href="https://example.com" target="_blank">link</a>')).toBe("link");
  });

  it("decodes the supported HTML entities", () => {
    // Only &nbsp; contributes whitespace; the rest decode in place, so the
    // single space sits between the decoded & and <.
    expect(stripHtml("&amp;&nbsp;&lt;&gt;&quot;&#39;")).toBe("& <>\"'");
  });

  it("does not double-decode an already-encoded entity (ampersand decoded last)", () => {
    expect(stripHtml("&amp;lt;")).toBe("&lt;");
  });

  it("keeps double-encoded gt and quot in their singly-encoded form", () => {
    expect(stripHtml("&amp;gt;")).toBe("&gt;");
    expect(stripHtml("&amp;quot;")).toBe("&quot;");
  });

  it("collapses runs of whitespace and trims the result", () => {
    expect(stripHtml("  multiple   spaces  ")).toBe("multiple spaces");
  });

  it("collapses newlines and tabs into single spaces", () => {
    expect(stripHtml("a\n\n\tb")).toBe("a b");
  });

  it("returns an empty string unchanged", () => {
    expect(stripHtml("")).toBe("");
  });

  it("leaves plain text untouched", () => {
    expect(stripHtml("plain text")).toBe("plain text");
  });

  it("returns an empty string for markup that carries no text", () => {
    expect(stripHtml("<p></p>")).toBe("");
  });
});

// ── trunc ──

describe("trunc", () => {
  it("returns a string of exactly the max length without an ellipsis", () => {
    const exact = "a".repeat(70);
    expect(trunc(exact)).toBe(exact);
  });

  it("truncates one character past the max to max chars plus an ellipsis", () => {
    const over = "a".repeat(71);
    const result = trunc(over);
    expect(result).toBe(`${"a".repeat(70)}...`);
    expect(result).toHaveLength(73);
  });

  it("returns an empty string for empty input", () => {
    expect(trunc("")).toBe("");
  });

  it("returns an empty string for null", () => {
    expect(trunc(null)).toBe("");
  });

  it("returns an empty string for undefined", () => {
    expect(trunc(undefined)).toBe("");
  });

  it("strips HTML before measuring length", () => {
    expect(trunc("<b>Hello</b>")).toBe("Hello");
  });

  it("measures the stripped text, not the raw markup, against the max", () => {
    // 70 visible chars wrapped in tags — the raw string is far longer than the
    // max, but the stripped text is exactly at it, so no ellipsis is added.
    const wrapped = `<p><strong>${"a".repeat(70)}</strong></p>`;
    expect(trunc(wrapped)).toBe("a".repeat(70));
  });

  it("honours a custom max", () => {
    expect(trunc("Hello World", 5)).toBe("Hello...");
  });

  it("does not truncate when a custom max exceeds the text length", () => {
    expect(trunc("Hello", 50)).toBe("Hello");
  });
});

// ── getUniqueFileName ──

describe("getUniqueFileName", () => {
  it("returns the desired name untouched when it is not taken", () => {
    expect(getUniqueFileName("file.pdf", new Set(["other.pdf"]))).toBe("file.pdf");
  });

  it("returns the desired name untouched against an empty set", () => {
    expect(getUniqueFileName("file.pdf", new Set())).toBe("file.pdf");
  });

  it("appends (1) on the first collision", () => {
    expect(getUniqueFileName("file.pdf", new Set(["file.pdf"]))).toBe("file.pdf (1)");
  });

  it("skips to (2) when both the base name and (1) are taken", () => {
    const taken = new Set(["file.pdf", "file.pdf (1)"]);
    expect(getUniqueFileName("file.pdf", taken)).toBe("file.pdf (2)");
  });

  it("keeps counting past a long run of collisions", () => {
    const taken = new Set(["file.pdf", ...Array.from({ length: 5 }, (_, i) => `file.pdf (${i + 1})`)]);
    expect(getUniqueFileName("file.pdf", taken)).toBe("file.pdf (6)");
  });

  it("only fills the first gap in the sequence", () => {
    // (1) is free even though (2) is taken — the first free counter wins.
    const taken = new Set(["file.pdf", "file.pdf (2)"]);
    expect(getUniqueFileName("file.pdf", taken)).toBe("file.pdf (1)");
  });
});

// ── groupByStatus ──

describe("groupByStatus", () => {
  const item = (status: string, id = status) => ({ status, id });

  it("returns an empty array for no items", () => {
    expect(groupByStatus([])).toEqual([]);
  });

  it("orders groups Watching → Not Watched → Watched regardless of input order", () => {
    const groups = groupByStatus([item("watched"), item("watching"), item("unwatched")]);
    expect(groups.map((g) => g.status)).toEqual(["watching", "unwatched", "watched"]);
  });

  it("maps each known status to its display label", () => {
    const groups = groupByStatus([item("watched"), item("watching"), item("unwatched")]);
    expect(groups.map((g) => g.label)).toEqual(["Watching", "Not Watched", "Watched"]);
  });

  it("collects every item sharing a status into one group", () => {
    const groups = groupByStatus([
      item("watching", "a"),
      item("watching", "b"),
      item("watched", "c"),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(groups[1].items.map((i) => i.id)).toEqual(["c"]);
  });

  it("sorts an unknown status after every known one and labels it with the raw value", () => {
    const groups = groupByStatus([item("pending"), item("watched"), item("watching")]);
    expect(groups.map((g) => g.status)).toEqual(["watching", "watched", "pending"]);
    expect(groups[2].label).toBe("pending");
  });

  it("preserves the original item order inside a group", () => {
    const groups = groupByStatus([
      item("watched", "first"),
      item("watching", "other"),
      item("watched", "second"),
    ]);
    const watched = groups.find((g) => g.status === "watched");
    expect(watched?.items.map((i) => i.id)).toEqual(["first", "second"]);
  });
});
