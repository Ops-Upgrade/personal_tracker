"use client";

import { useTheme } from "@wrksz/themes/client";
import { Sun, Moon } from "lucide-react";
import clsx from "clsx";

/**
 * Simple toggle button that switches between Light and Dark themes.
 * Uses @wrksz/themes useTheme hook for state management.
 * Default theme is "system" (set in provider), but toggle only cycles Light ↔ Dark.
 */
export default function ThemeSwitcher() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  function toggle() {
    setTheme(isDark ? "light" : "dark");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={clsx(
        "inline-flex items-center justify-center rounded-lg border p-2 transition-colors cursor-pointer",
        "border-zinc-300 text-zinc-700 hover:bg-zinc-100",
        "dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      )}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
    </button>
  );
}