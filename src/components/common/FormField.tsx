"use client";

import type { ChangeEvent } from "react";

// ── Shared Tailwind classes ──

const LABEL_CLASSES = "mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300";

const INPUT_CLASSES =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 disabled:opacity-50";

const DATE_CLASSES = `${INPUT_CLASSES} [color-scheme:dark]`;

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
}: InputFieldProps) {
  return (
    <label className="block">
      <span className={LABEL_CLASSES}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        min={min}
        step={step}
        className={type === "date" ? DATE_CLASSES : INPUT_CLASSES}
      />
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
