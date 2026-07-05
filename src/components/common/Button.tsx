"use client";

import clsx from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "success" | "danger" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

/** Base classes: inline-flex for proper alignment, rounded, transition, cursor-pointer */
const baseClasses =
  "inline-flex items-center justify-center rounded-lg font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border border-blue-600 text-blue-700 bg-blue-50 hover:bg-blue-100 dark:border-blue-500 dark:text-blue-400 dark:bg-blue-950/30 dark:hover:bg-blue-900/40",
  success:
    "border border-green-600 text-green-700 bg-green-50 hover:bg-green-100 dark:border-green-500 dark:text-green-400 dark:bg-green-950/30 dark:hover:bg-green-900/40",
  danger:
    "border border-red-600 text-red-700 bg-red-50 hover:bg-red-100 dark:border-red-500 dark:text-red-400 dark:bg-red-950/30 dark:hover:bg-red-900/40",
  secondary:
    "border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800",
  ghost:
    "border border-zinc-200 font-semibold text-blue-600 dark:text-blue-400 dark:border-zinc-700 hover:bg-blue-50 dark:hover:bg-blue-900/30",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

/** Extracted class generator for use with `Link` or `a` tags that need to look like buttons. */
export function getButtonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string
): string {
  return clsx(
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    className
  );
}

export default function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={getButtonClasses(variant, size, className)}
      {...rest}
    >
      {children}
    </button>
  );
}