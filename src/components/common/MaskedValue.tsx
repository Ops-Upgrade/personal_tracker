"use client";

import { useState, useCallback } from "react";
import { Eye, EyeOff, Copy, Check } from "lucide-react";

interface MaskedValueProps {
  label: string;
  value: string;
  /** When true, the value is hidden behind dots and can be revealed via eye toggle */
  isSecret?: boolean;
  /** Called when the eye toggle reveals this field — parent can use this to hide other revealed fields */
  onReveal?: () => void;
  /** External control: force-hide the value (used when another field is revealed) */
  forceHidden?: boolean;
  /**
   * Visual variant:
   * - "bordered" (default) — card-like border + background. Use in detail views.
   * - "plain" — no border or background. Use in list rows and tiles.
   */
  variant?: "bordered" | "plain";
}

/**
 * Masked value field with exclusive reveal toggle and copy-to-clipboard.
 *
 * Reveal rules (per plan OQ-4):
 * - Reveal stays until user clicks same eye, another eye, or edit/delete button.
 * - Only one value visible at a time — revealing another hides the previous.
 *
 * Moved from src/components/vault/SecretField.tsx to src/components/common/
 * so it can be reused across vault and non-vault contexts.
 */
export default function MaskedValue({
  label,
  value,
  isSecret = true,
  onReveal,
  forceHidden = false,
  variant = "bordered",
}: MaskedValueProps) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  // If parent forces hidden, reset local state
  const isRevealed = forceHidden ? false : revealed;

  const handleToggle = useCallback(() => {
    if (isRevealed) {
      setRevealed(false);
    } else {
      setRevealed(true);
      onReveal?.();
    }
  }, [isRevealed, onReveal]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available — silently fail
    }
  }, [value]);

  const containerClass =
    variant === "bordered"
      ? "flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/50"
      : "flex items-center gap-2";

  return (
    <div className={containerClass}>
      <div className="min-w-0 flex-1">
        <span className="block text-[10px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          {label}
        </span>
        <span className="mt-0.5 block truncate text-sm font-mono text-zinc-900 dark:text-zinc-100">
          {isSecret && !isRevealed ? "••••••••" : value}
        </span>
      </div>

      {isSecret && (
        <button
          type="button"
          onClick={handleToggle}
          className="shrink-0 rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
          title={isRevealed ? "Hide" : "Reveal"}
        >
          {isRevealed ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      )}

      <button
        type="button"
        onClick={handleCopy}
        className="shrink-0 rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
        title="Copy to clipboard"
      >
        {copied ? (
          <Check className="h-4 w-4 text-emerald-500" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
