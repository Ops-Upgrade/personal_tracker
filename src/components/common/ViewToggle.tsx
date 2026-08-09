"use client";

import type { ReactNode } from "react";
import { LayoutGrid, List } from "lucide-react";

// ---------- types ----------

export interface ViewToggleOption<T extends string> {
  value: T;
  label: ReactNode;
  /** When true, hides this specific option button on mobile screens. */
  hideOnMobile?: boolean;
}

interface ViewToggleProps<T extends string> {
  value: T;
  onChange: (next: T) => void;
  options?: readonly ViewToggleOption<T>[];
  /** Optional aria-label for the tablist; defaults to "View toggle" */
  ariaLabel?: string;
  /**
   * Styling variant.
   * - "default" — border-based, hidden on mobile (original behaviour)
   * - "media"    — background-based, always visible (used by media pages)
   */
  variant?: "default" | "media";
  /**
   * When false, the container stays visible on mobile.
   * Defaults to true (hidden on mobile) for the "default" variant.
   */
  hideContainerOnMobile?: boolean;
  /**
   * Override the active-state text color when variant="media".
   * Defaults to "text-violet-600 dark:text-violet-400" (Media Manager theme).
   */
  activeClassName?: string;
}

// ---------- built-in media options ----------

const MEDIA_OPTIONS = [
  { value: "detail", label: <List size={16} /> },
  { value: "tile", label: <LayoutGrid size={16} /> },
] as const;

// ---------- component ----------

export default function ViewToggle<T extends string>({
  value,
  onChange,
  options,
  ariaLabel = "View toggle",
  variant = "default",
  hideContainerOnMobile = true,
  activeClassName,
}: ViewToggleProps<T>) {
  const opts =
    options ?? (MEDIA_OPTIONS as unknown as readonly ViewToggleOption<T>[]);

  const isMedia = variant === "media";

  const containerClass = isMedia
    ? "inline-flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1"
    : hideContainerOnMobile
      ? "hidden md:inline-flex rounded-lg border border-zinc-300 p-0.5 dark:border-zinc-700"
      : "inline-flex rounded-lg border border-zinc-300 p-0.5 dark:border-zinc-700";

  return (
    <div
      className={containerClass}
      role="tablist"
      aria-label={ariaLabel}
    >
      {opts.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={
              (isMedia
                ? `cursor-pointer p-1.5 rounded-md transition-colors ${
                    active
                      ? `bg-white dark:bg-zinc-700 shadow-sm ${activeClassName || "text-violet-600 dark:text-violet-400"}`
                      : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
                  }`
                : `cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`) + (opt.hideOnMobile ? " hidden md:inline-flex" : "")
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
