"use client";

import { useCallback, useState, type ChangeEvent } from "react";
import { Check, Copy, Eye, EyeOff } from "lucide-react";
import DatePicker from "@/components/common/DatePicker";
import { LABEL_CLASSES, INPUT_CLASSES, INPUT_ACTION_CLASSES } from "./formFieldClasses";

// ── Input ──

interface InputFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  type?: "text" | "date" | "number" | "password";
  min?: string | number;
  step?: string;
  /** When true, renders an inline copy button inside the input. Password inputs always get a reveal (eye) toggle. */
  isCopyable?: boolean;
}

export function InputField({
  label,
  value,
  onChange,
  disabled = false,
  placeholder,
  type = "text",
  min,
  step,
  isCopyable = false,
}: InputFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const isPassword = type === "password";
  const showActions = isPassword || isCopyable;
  const effectiveType = isPassword && revealed ? "text" : type;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — silently ignore
    }
  }, [value]);

  // Date fields delegate to the editable DatePicker (text input + calendar
  // popover + clear button) instead of the native date input.
  if (type === "date") {
    return (
      <DatePicker
        label={label}
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
      />
    );
  }

  return (
    <label className="block">
      <span className={LABEL_CLASSES}>{label}</span>
      <div className="relative">
        <input
          type={effectiveType}
          value={value}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          min={min}
          step={step}
          className={`${INPUT_CLASSES} ${showActions ? (isPassword && isCopyable ? "pr-16" : "pr-10") : ""}`}
        />
        {showActions && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
            {isPassword && (
              <button
                type="button"
                onClick={() => setRevealed((r) => !r)}
                disabled={disabled}
                className={INPUT_ACTION_CLASSES}
                title={revealed ? "Hide" : "Reveal"}
              >
                {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            )}
            {isCopyable && (
              <button
                type="button"
                onClick={handleCopy}
                disabled={disabled}
                className={INPUT_ACTION_CLASSES}
                title="Copy"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </button>
            )}
          </div>
        )}
      </div>
    </label>
  );
}

// ── Select ──

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  options: { value: string; label: string }[];
}

export function SelectField({
  label,
  value,
  onChange,
  disabled = false,
  options,
}: SelectFieldProps) {
  return (
    <label className="block">
      <span className={LABEL_CLASSES}>{label}</span>
      <select
        value={value}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
        disabled={disabled}
        className={INPUT_CLASSES}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// ── Textarea ──

interface TextareaFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
}

export function TextareaField({
  label,
  value,
  onChange,
  disabled = false,
  placeholder,
  rows = 4,
}: TextareaFieldProps) {
  return (
    <label className="block">
      <span className={LABEL_CLASSES}>{label}</span>
      <textarea
        value={value}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        rows={rows}
        className={INPUT_CLASSES}
      />
    </label>
  );
}

// ── Checkbox ──

interface CheckboxFieldProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
}

export function CheckboxField({
  label,
  checked,
  onChange,
  disabled = false,
  id,
}: CheckboxFieldProps) {
  const checkboxId = id ?? label.toLowerCase().replace(/\s+/g, "_");
  return (
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        id={checkboxId}
        checked={checked}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)}
        disabled={disabled}
        className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-600 dark:border-zinc-600 dark:bg-zinc-800 dark:checked:bg-emerald-500"
      />
      <label htmlFor={checkboxId} className="text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
        {label}
      </label>
    </div>
  );
}
