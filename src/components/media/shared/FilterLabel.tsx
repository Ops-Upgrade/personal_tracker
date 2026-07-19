interface FilterLabelProps {
  label: string;
  isActive?: boolean;
  onClear?: () => void;
}

export function FilterLabel({ label, isActive, onClear }: FilterLabelProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      {isActive && onClear && (
        <button
          onClick={onClear}
          className="text-[10px] font-bold uppercase tracking-wide text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  );
}
