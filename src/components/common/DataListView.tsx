"use client";

import { type ReactNode } from "react";
import { LayoutGrid, List, Plus } from "lucide-react";
import type { ViewToggleOption } from "./ViewToggle";
import ViewToggle from "./ViewToggle";
import SearchBar from "./SearchBar";
import LoadingSpinner from "./LoadingSpinner";
import EmptyState from "./EmptyState";

// ============================================================
// DataListView — shared list/grid container with bulk selection
// ============================================================
// Extracted from GenericStorePage so the tick box, "Select all", and bulk
// action bar logic is reusable by GenericViewPage ("/all" pages) too.
// `renderListRow` / `renderGridTile` drive the tiles/list branches;
// `renderContent` replaces them entirely (e.g. a GenericDataGrid).

const VIEW_OPTIONS: readonly ViewToggleOption<"tiles" | "list">[] = [
  { value: "tiles", label: <LayoutGrid size={16} /> },
  { value: "list", label: <List size={16} /> },
];

interface DataListViewProps {
  viewMode?: "tiles" | "list";
  onViewModeChange?: (mode: "tiles" | "list") => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
  isLoading: boolean;
  isEmpty: boolean;
  isFilteredEmpty: boolean;
  emptyMessage?: string;
  onAdd?: () => void;
  addLabel?: string;
  selectionEnabled?: boolean;
  selectedCount?: number;
  totalCount?: number;
  onSelectAll?: (checked: boolean) => void;
  onClearSelection?: () => void;
  bulkActionBar?: ReactNode;
  renderGridTile?: (itemIndex: number) => ReactNode;
  renderListRow?: (itemIndex: number) => ReactNode;
  /** Optional full custom content (e.g. GenericDataGrid) — replaces the tiles/list branches. */
  renderContent?: () => ReactNode;
  itemCount: number;
  toggleActiveClassName?: string;
  themeBtnClassName?: string;
  themeInputFocus?: string;
}

export default function DataListView({
  viewMode,
  onViewModeChange,
  searchQuery = "",
  onSearchChange,
  searchPlaceholder = "Search...",
  isLoading,
  isEmpty,
  isFilteredEmpty,
  emptyMessage = "No items to display.",
  onAdd,
  addLabel = "Add",
  selectionEnabled = false,
  selectedCount = 0,
  totalCount = 0,
  onSelectAll,
  onClearSelection,
  bulkActionBar,
  renderGridTile,
  renderListRow,
  renderContent,
  itemCount,
  toggleActiveClassName,
  themeBtnClassName,
  themeInputFocus,
}: DataListViewProps) {
  const hasSelection = selectionEnabled && selectedCount > 0;

  return (
    <>
      {/* Header */}
      {(viewMode !== undefined || onSearchChange || onAdd || hasSelection) && (
        <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
          <div className="order-1 flex flex-row items-center gap-3">
            {viewMode !== undefined && onViewModeChange && (
              <ViewToggle
                value={viewMode}
                onChange={onViewModeChange}
                options={VIEW_OPTIONS}
                ariaLabel="View toggle"
                variant="media"
                activeClassName={toggleActiveClassName}
              />
            )}
            {hasSelection && onSelectAll && (
              <button
                onClick={() => onSelectAll(selectedCount < totalCount)}
                className={`cursor-pointer text-xs font-medium transition-colors ${toggleActiveClassName || "text-zinc-900 hover:text-black dark:text-zinc-100 dark:hover:text-white"}`}
              >
                {selectedCount < totalCount ? `Select all (${totalCount})` : "Deselect all"}
              </button>
            )}
          </div>
          {hasSelection && bulkActionBar ? (
            <div className="order-2 sm:order-3 w-full sm:w-auto">{bulkActionBar}</div>
          ) : (
            <>
              {onSearchChange && (
                <div className="order-3 sm:order-2 w-full sm:w-auto sm:ml-auto mt-3 sm:mt-0">
                  <SearchBar
                    value={searchQuery}
                    onChange={onSearchChange}
                    placeholder={searchPlaceholder}
                    className="flex-1 sm:w-64"
                  />
                </div>
              )}
              {onAdd && (
                <button
                  onClick={onAdd}
                  className={`order-2 sm:order-3 cursor-pointer inline-flex items-center justify-center gap-x-1.5 rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${themeBtnClassName || "bg-zinc-900 hover:bg-black dark:bg-zinc-100 dark:text-black dark:hover:bg-white"}`}
                >
                  <Plus className="-ml-0.5 h-4 w-4" />
                  {addLabel}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1">
        {renderContent ? (
          renderContent()
        ) : isLoading ? (
          <LoadingSpinner message="Loading..." />
        ) : isEmpty ? (
          <EmptyState message={emptyMessage} />
        ) : isFilteredEmpty ? (
          <EmptyState message="No matching items found." />
        ) : viewMode === "list" ? (
          <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
            {hasSelection && onSelectAll && (
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50">
                <input
                  type="checkbox"
                  checked={itemCount > 0 && selectedCount === itemCount}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  className={`h-4 w-4 rounded border-zinc-300 dark:border-zinc-600 dark:bg-zinc-800 ${themeInputFocus || "text-zinc-900 focus:ring-zinc-900 dark:text-zinc-100 dark:focus:ring-zinc-100"}`}
                />
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {selectedCount === itemCount ? "All selected" : `${selectedCount} of ${itemCount} selected`}
                </span>
                <button onClick={onClearSelection} className="cursor-pointer ml-auto text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors">
                  Clear
                </button>
              </div>
            )}
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {Array.from({ length: itemCount }, (_, i) => renderListRow?.(i))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: itemCount }, (_, i) => renderGridTile?.(i))}
          </div>
        )}
      </div>
    </>
  );
}
