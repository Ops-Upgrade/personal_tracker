// @vitest-environment node
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ColumnToken } from "@/components/common/GenericViewPage";
import { renderTokenCell } from "@/components/common/GenericDataGrid";
import type { Priority } from "@/types/common";

/**
 * Tier 1-A — the declarative cell-token engine.
 * Every domain list view renders cells through renderTokenCell; a broken arm
 * silently renders "—" (or nothing) for an entire column on every route.
 * Node + renderToStaticMarkup keeps this hermetic — no DOM needed.
 */

interface Item {
  value?: string | number | null;
}

const html = (token: ColumnToken<Item>, item: Item = {}): string =>
  renderToStaticMarkup(<>{renderTokenCell(token, item)}</>);

describe("text token", () => {
  it("renders the em-dash placeholder for null and empty values", () => {
    expect(html({ type: "text", accessor: () => null })).toContain("—");
    expect(html({ type: "text", accessor: () => "" })).toContain("—");
    expect(html({ type: "text", accessor: () => undefined })).toContain("—");
  });

  it("renders plain values in the muted colour", () => {
    const out = html({ type: "text", accessor: () => "Groceries" });
    expect(out).toContain("Groceries");
    expect(out).toContain("text-zinc-600");
  });

  it("applies localeFormat to numeric values", () => {
    const out = html({
      type: "text",
      accessor: () => 123456,
      localeFormat: "en-IN",
    });
    expect(out).toContain("1,23,456");
  });

  it("prepends the prefix and applies capitalize/colour classes", () => {
    const out = html({
      type: "text",
      accessor: () => "online",
      prefix: "₹ ",
      capitalize: true,
      color: "strong",
    });
    expect(out).toContain("₹ online");
    expect(out).toContain("capitalize");
    expect(out).toContain("font-medium");
  });
});

describe("date token", () => {
  it("formats dates through formatShortDate", () => {
    expect(html({ type: "date", accessor: () => "2026-07-09" })).toContain("09/07/26");
  });

  it("renders the em-dash placeholder for null", () => {
    expect(html({ type: "date", accessor: () => null })).toContain("—");
  });
});

describe("richtext token", () => {
  it("strips HTML tags", () => {
    const out = html({ type: "richtext", accessor: () => "<p>hello</p>" });
    expect(out).toContain("hello");
    expect(out).not.toContain("<p>");
  });

  it("renders the placeholder for empty richtext", () => {
    expect(html({ type: "richtext", accessor: () => "" })).toContain("—");
    expect(html({ type: "richtext", accessor: () => "<p><br></p>" })).toContain("—");
  });
});

describe("badge token", () => {
  it("renders a PriorityBadge for a priority value", () => {
    const out = html({ type: "badge", accessor: () => "high" as Priority });
    expect(out).toContain("High");
    expect(out).not.toContain("—");
  });

  it("renders the placeholder for null", () => {
    expect(html({ type: "badge", accessor: () => null })).toContain("—");
  });
});

describe("files token", () => {
  it("renders the placeholder when the count is 0", () => {
    const out = html({
      type: "files",
      getCount: () => 0,
      iconColorClass: "text-blue-500",
    });
    expect(out).toContain("—");
  });

  it("renders the paperclip count when files exist", () => {
    const out = html({
      type: "files",
      getCount: () => 3,
      iconColorClass: "text-blue-500",
    });
    expect(out).toContain("(3)");
    expect(out).toContain("3 document(s) attached");
  });
});

describe("boolean token", () => {
  const mk = (
    value: boolean,
    overrides: Partial<Extract<ColumnToken<Item>, { type: "boolean" }>> = {},
  ) =>
    html({
      type: "boolean",
      accessor: () => value,
      trueLabel: "Active",
      trueColorClass: "text-emerald-600",
      falseLabel: "Inactive",
      falseColorClass: "text-zinc-400",
      ...overrides,
    });

  it("renders trueLabel with the true colour", () => {
    const out = mk(true);
    expect(out).toContain("Active");
    expect(out).toContain("text-emerald-600");
  });

  it("renders falseLabel with the false colour", () => {
    const out = mk(false);
    expect(out).toContain("Inactive");
    expect(out).toContain("text-zinc-400");
  });

  it("falls back to trueLabel when falseLabel is absent", () => {
    const out = mk(false, { falseLabel: undefined });
    expect(out).toContain("Active");
  });
});
