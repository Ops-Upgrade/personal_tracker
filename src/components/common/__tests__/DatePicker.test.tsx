// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DatePicker from "@/components/common/DatePicker";

/**
 * Tier 1-B — DatePicker strict DD/MM/YYYY parsing.
 * Lenient date parsing (date-fns) silently rolls invalid dates over
 * (e.g. 31/02 → 03/03); the round-trip check must reject those instead.
 */

afterEach(() => {
  cleanup();
});

function setup(value = "") {
  const onChange = vi.fn();
  const utils = render(<DatePicker label="Date" value={value} onChange={onChange} />);
  const input = screen.getByRole("textbox") as HTMLInputElement;
  return { input, onChange, ...utils };
}

describe("typing", () => {
  it("commits a valid DD/MM/YYYY as ISO YYYY-MM-DD", async () => {
    const { input, onChange } = setup();
    await userEvent.type(input, "09/07/2026");
    expect(onChange).toHaveBeenLastCalledWith("2026-07-09");
  });

  it("rejects lenient rollovers (31/02/2026 must not become 03/03)", async () => {
    const { input, onChange } = setup();
    await userEvent.type(input, "31/02/2026");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("rejects day 0", async () => {
    const { input, onChange } = setup();
    await userEvent.type(input, "00/07/2026");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("rejects 29/02 in a non-leap year but accepts it in a leap year", async () => {
    const a = setup();
    await userEvent.type(a.input, "29/02/2026");
    expect(a.onChange).not.toHaveBeenCalled();

    cleanup();
    const b = setup();
    await userEvent.type(b.input, "29/02/2028");
    expect(b.onChange).toHaveBeenLastCalledWith("2028-02-29");
  });

  it("ignores text that does not match the strict format", async () => {
    const { input, onChange } = setup();
    await userEvent.type(input, "incomplete");
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("value sync", () => {
  it("displays the value as DD/MM/YYYY", () => {
    setup("2026-07-09");
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe(
      "09/07/2026",
    );
  });

  it("normalizes full ISO timestamps to the calendar day", () => {
    setup("2026-07-09T18:30:00+05:30");
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe(
      "09/07/2026",
    );
  });

  it("renders an empty input for an empty value", () => {
    setup("");
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("");
  });

  it("re-syncs the text when the value prop changes externally", () => {
    const { rerender } = render(
      <DatePicker label="Date" value="2026-07-09" onChange={vi.fn()} />,
    );
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe(
      "09/07/2026",
    );
    rerender(<DatePicker label="Date" value="2026-08-01" onChange={vi.fn()} />);
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe(
      "01/08/2026",
    );
  });
});

describe("blur and clear", () => {
  it("reverts invalid text to the last committed value on blur", async () => {
    const { input } = setup("2026-07-09");
    await userEvent.clear(input);
    await userEvent.type(input, "99/99/9999");
    expect(input.value).toBe("99/99/9999");
    fireEvent.blur(input);
    expect(input.value).toBe("09/07/2026");
  });

  it("clears the value via the clear button", () => {
    const { input, onChange } = setup("2026-07-09");
    fireEvent.click(screen.getByRole("button", { name: "Clear date" }));
    expect(onChange).toHaveBeenCalledWith("");
    expect(input.value).toBe("");
  });
});
