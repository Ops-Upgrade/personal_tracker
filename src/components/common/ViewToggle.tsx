"use client";

import type { ReactNode } from "react";

// ---------- types ----------

export interface ViewToggleOption<T extends string> {
  value: T;
  label: ReactNode;
}

interface ViewToggleProps<T extends string> {
  value: T;
  onChange: (next: T) => void;
  options: readonly ViewToggleOption<T>[];
  /** Optional aria-label for the tablist; defaults to "View toggle" */
  ariaLabel?: string;
}

// ---------- component ----------

export default function ViewToggle<T extends string>({
  value,
  onChange,
  options,
  ariaLabel = "View toggle",
}: ViewToggleProps<T>) {
  return (
    <div
      className="inline-flex rounded-lg border border-zinc-300 p-0.5 dark:border-zinc-700"
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              active
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}