// ── Shared Tailwind classes for form fields ──
// Used by both FormField and DatePicker. Kept in a separate module so
// FormField can delegate date inputs to DatePicker without a circular import
// (DatePicker needs INPUT_CLASSES, FormField needs the DatePicker component).

export const LABEL_CLASSES =
  "mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300";

export const INPUT_CLASSES =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 disabled:opacity-50";

export const INPUT_ACTION_CLASSES =
  "cursor-pointer flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300 transition-colors disabled:opacity-50";
