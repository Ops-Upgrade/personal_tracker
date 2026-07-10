"use client";

import Link from "next/link";
import type { ReactNode } from "react";

interface BackButtonProps {
  href: string;
  children?: ReactNode;
}

/**
 * Standardized back navigation button for sub-routes.
 * Usage: <BackButton href={ROUTES.TASK_MANAGER}>← Back to Task Manager</BackButton>
 */
export default function BackButton({ href, children = "← Back" }: BackButtonProps) {
  return (
    <Link
      href={href}
      className="shrink-0 rounded-lg border border-zinc-300 px-2.5 py-1 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      {children}
    </Link>
  );
}
