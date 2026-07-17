"use client";

import Link from "next/link";
import type { ReactNode } from "react";

interface BackButtonProps {
  href?: string;
  onClick?: () => void;
  children?: ReactNode;
}

const baseClasses =
  "inline-flex items-center shrink-0 rounded-lg border border-zinc-300 px-2.5 py-1 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";

/**
 * Standardized back navigation button for sub-routes.
 * Usage: <BackButton href={ROUTES.TASK_MANAGER} />
 * Or with onClick for router.back(): <BackButton onClick={() => router.back()} />
 * The default label is "← Back" — no explicit children needed.
 */
export default function BackButton({ href, onClick, children = "← Back" }: BackButtonProps) {
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={baseClasses}>
        {children}
      </button>
    );
  }

  return (
    <Link href={href ?? "#"} className={baseClasses}>
      {children}
    </Link>
  );
}
