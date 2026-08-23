"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { format, isValid, parse } from "date-fns";
import { normalizeDateForInput } from "@/lib/utils";
import { LABEL_CLASSES, INPUT_CLASSES, INPUT_ACTION_CLASSES } from "./formFieldClasses";

import "react-day-picker/dist/style.css";

interface DatePickerProps {
  label: string;
  /** YYYY-MM-DD (or "" for no date). Full ISO strings with a `T` are normalized. */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Parses strict DD/MM/YYYY text. The round-trip check rejects lenient
 * rollovers (e.g. "31/02/2026" would parse to March 3rd in date-fns).
 */
function parseDisplayText(text: string): Date | null {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(text)) return null;
  const parsed = parse(text, "dd/MM/yyyy", new Date());
  if (!isValid(parsed)) return null;
  return format(parsed, "dd/MM/yyyy") === text ? parsed : null;
}

/** Converts the incoming value ("" or YYYY-MM-DD or full ISO) to DD/MM/YYYY display text. */
function toDisplay(raw: string): string {
  const iso = normalizeDateForInput(raw);
  if (!iso) return "";
  const d = parse(iso, "yyyy-MM-dd", new Date());
  return isValid(d) ? format(d, "dd/MM/yyyy") : "";
}

/**
 * Upper bound on the rendered calendar width (7 × 40px cells + padding and
 * border ≈ 300px). Only used to keep the popover clear of the right viewport
 * edge — over-clamping by a few pixels is harmless, clipping is not.
 */
const POPOVER_MAX_WIDTH = 320;

/** Gap between the input and the popover, and the minimum viewport inset. */
const POPOVER_OFFSET = 4;
const VIEWPORT_INSET = 8;

/**
 * Editable date input replacing the native `<input type="date">`:
 * a free-typing DD/MM/YYYY text field plus a react-day-picker calendar
 * popover, with calendar and clear (X) buttons on the right.
 *
 * The popover is portalled to `document.body` and positioned with `fixed`
 * viewport coordinates: rendered inline it was clipped by the `overflow-y-auto`
 * boundary of any scrollable ancestor (notably GenericDomainModal).
 */
export default function DatePicker({
  label,
  value,
  onChange,
  disabled = false,
  placeholder = "DD/MM/YYYY",
}: DatePickerProps) {
  const [inputValue, setInputValue] = useState(() => toDisplay(value));
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Re-sync the local text when the parent value changes externally (e.g.
  // modal reset). Uses the React "adjust state during render" pattern —
  // typing only touches local state until a valid date is committed.
  const [lastValue, setLastValue] = useState(value);
  if (lastValue !== value) {
    setLastValue(value);
    setInputValue(toDisplay(value));
  }

  /**
   * Measures the anchor and opens. The rect is captured here rather than in an
   * effect because effects run after paint — the popover would render one frame
   * unpositioned at the end of `<body>` before jumping into place.
   */
  const openPopover = () => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPopoverStyle({
      position: "fixed",
      top: rect.bottom + POPOVER_OFFSET,
      left: Math.max(
        VIEWPORT_INSET,
        Math.min(rect.left, window.innerWidth - POPOVER_MAX_WIDTH - VIEWPORT_INSET),
      ),
    });
    setOpen(true);
  };

  // Close the popover on outside pointer interactions.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      // The popover lives outside rootRef (portalled to body), so it needs its
      // own containment check — otherwise pointerdown on a day would unmount
      // the calendar before the click landed and onSelect would never fire.
      if (rootRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // The fixed coordinates are a snapshot of the anchor at open time, so any
  // scroll or resize strands the popover. Capture phase is required to see
  // scrolls inside the modal's own overflow container, which don't bubble.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener("scroll", close, { capture: true });
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const selectedDay = useMemo(() => {
    const iso = normalizeDateForInput(value);
    if (!iso) return undefined;
    const d = parse(iso, "yyyy-MM-dd", new Date());
    return isValid(d) ? d : undefined;
  }, [value]);

  const handleTextChange = (raw: string) => {
    setInputValue(raw);
    const parsed = parseDisplayText(raw);
    if (parsed) onChange(format(parsed, "yyyy-MM-dd"));
  };

  const handleBlur = () => {
    // Incomplete/invalid text reverts to the last committed value.
    if (!parseDisplayText(inputValue)) setInputValue(toDisplay(value));
  };

  const handleDaySelect = (day: Date | undefined) => {
    if (day) {
      onChange(format(day, "yyyy-MM-dd"));
      setInputValue(format(day, "dd/MM/yyyy"));
    }
    setOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setInputValue("");
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <span className={LABEL_CLASSES}>{label}</span>
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          value={inputValue}
          onChange={(e) => handleTextChange(e.target.value)}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={placeholder}
          className={`${INPUT_CLASSES} pr-16`}
        />
        <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
          <button
            type="button"
            onClick={() => (open ? setOpen(false) : openPopover())}
            disabled={disabled}
            className={INPUT_ACTION_CLASSES}
            title="Open calendar"
            aria-label="Open calendar"
          >
            <CalendarIcon className="h-4 w-4" />
          </button>
          {inputValue !== "" && (
            <button
              type="button"
              onClick={handleClear}
              disabled={disabled}
              className={INPUT_ACTION_CLASSES}
              title="Clear"
              aria-label="Clear date"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {open &&
          !disabled &&
          // z-50 matches the highest modal overlay (VaultLockScreen); as a
          // later sibling of the app root in <body> it wins the tie by DOM order.
          createPortal(
            <div
              ref={popoverRef}
              style={popoverStyle}
              className="z-50 rounded-lg border border-zinc-200 bg-white p-2 text-zinc-800 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <DayPicker mode="single" selected={selectedDay} onSelect={handleDaySelect} />
            </div>,
            document.body,
          )}
      </div>
    </div>
  );
}
