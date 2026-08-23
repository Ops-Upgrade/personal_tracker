"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
 * Editable date input replacing the native `<input type="date">`:
 * a free-typing DD/MM/YYYY text field plus a react-day-picker calendar
 * popover, with calendar and clear (X) buttons on the right.
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
  const rootRef = useRef<HTMLDivElement>(null);

  // Re-sync the local text when the parent value changes externally (e.g.
  // modal reset). Uses the React "adjust state during render" pattern —
  // typing only touches local state until a valid date is committed.
  const [lastValue, setLastValue] = useState(value);
  if (lastValue !== value) {
    setLastValue(value);
    setInputValue(toDisplay(value));
  }

  // Close the popover on outside pointer interactions.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
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
            onClick={() => setOpen((o) => !o)}
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
        {open && !disabled && (
          <div className="absolute left-0 top-full z-50 mt-1 rounded-lg border border-zinc-200 bg-white p-2 text-zinc-800 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
            <DayPicker mode="single" selected={selectedDay} onSelect={handleDaySelect} />
          </div>
        )}
      </div>
    </div>
  );
}
