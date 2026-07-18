import React from "react";

interface FilterSidebarProps {
  children: React.ReactNode;
  className?: string;
}

const SIDEBAR_BASE =
  "hidden md:block w-72 shrink-0 space-y-5 sticky top-4 self-start overflow-y-auto rounded-xl border border-zinc-200 bg-white p-4 pb-6 dark:border-zinc-800 dark:bg-zinc-900 " +
  "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 " +
  "dark:[&::-webkit-scrollbar-thumb]:bg-zinc-600 [&::-webkit-scrollbar-track]:bg-transparent";

export function FilterSidebar({ children, className = "" }: FilterSidebarProps) {
  return <aside className={`${SIDEBAR_BASE} ${className}`}>{children}</aside>;
}
