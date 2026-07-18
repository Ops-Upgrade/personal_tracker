import React from "react";

interface MobileFilterBarTab {
  id: string;
  label: string;
}

interface MobileFilterBarProps {
  tabs: readonly MobileFilterBarTab[];
  activeTab: string | null;
  onTabChange: (id: string) => void;
  onClose: () => void;
  children: React.ReactNode;
}

export function MobileFilterBar({
  tabs,
  activeTab,
  onTabChange,
  onClose,
  children,
}: MobileFilterBarProps) {
  return (
    <div className="md:hidden relative">
      {/* Scrollable tab row */}
      <div className="w-full overflow-x-auto scrollbar-hide pb-2">
        <div className="flex gap-2 min-w-max">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === id
                  ? "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-300"
                  : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-750"
              }`}
            >
              {label}
              <span className="text-[10px]">
                {activeTab === id ? "⌃" : "⌄"}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Dropdown popover */}
      {activeTab && (
        <>
          <div className="fixed inset-0 z-30" onClick={onClose} />
          <div className="absolute top-full left-0 right-0 z-40 mt-1 rounded-xl border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
            {children}
          </div>
        </>
      )}
    </div>
  );
}
