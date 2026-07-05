"use client";

import type { TaskView } from "@/types/taskmanager";

interface ViewToggleProps {
  value: TaskView;
  onChange: (next: TaskView) => void;
}

export default function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div
      className="inline-flex rounded-lg border border-zinc-300 p-0.5 dark:border-zinc-700"
      role="tablist"
      aria-label="Task view toggle"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === "months"}
        onClick={() => onChange("months")}
        className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
          value === "months"
            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
            : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        }`}
      >
        Months
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "priority"}
        onClick={() => onChange("priority")}
        className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
          value === "priority"
            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
            : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        }`}
      >
        Priority
      </button>
    </div>
  );
}
