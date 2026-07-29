"use client";

import type { ReactNode } from "react";
import { LayoutGrid, List, Plus } from "lucide-react";
import ViewToggle from "@/components/common/ViewToggle";
import type { ViewToggleOption } from "@/components/common/ViewToggle";
import SearchBar from "@/components/common/SearchBar";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import EmptyState from "@/components/common/EmptyState";

const VIEW_OPTIONS: readonly ViewToggleOption<"tiles" | "list">[] = [
  { value: "tiles", label: <LayoutGrid size={16} /> },
  { value: "list", label: <List size={16} /> },
];

interface DataListViewProps {
  // --- View control ---
  viewMode: "tiles" | "list";
  onViewModeChange: (mode: "tiles" | "list") => void;

  // --- Search ---
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder?: string;

  // --- State ---
  isLoading: boolean;
  isEmpty: boolean;
  isFilteredEmpty: boolean;
  emptyMessage?: string;

  // --- Add button ---
  onAdd?: () => void;
  addLabel?: string;

  // --- Selection ---
  selectionEnabled?: boolean;
  selectedCount?: number;
  totalCount?: number;
  onSelectAll?: (checked: boolean) => void;
  onClearSelection?: () => void;
  /** Rendered in place of the search bar when items are selected. */
  bulkActionBar?: ReactNode;

  // --- Render props ---
  /** Render a single grid tile. */
  renderGridTile: (itemIndex: number) => ReactNode;
  /** Render a single list row. */
  renderListRow: (itemIndex: number) => ReactNode;

  // --- Data ---
  itemCount: number;

  // --- View toggle theming ---
  /** Passed through to ViewToggle activeClassName. */
  toggleActiveClassName?: string;
}

/**
 * Shared data-list container that abstracts the header layout (ViewToggle,
 * SearchBar, Add button), loading/empty/no-results states, and list/grid
 * conditional rendering that was duplicated between VaultRecordView and
 * TileView.
 */
export default function DataListView({
  viewMode,
  onViewModeChange,
  searchQuery,
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
  itemCount,
  toggleActiveClassName,
}: DataListViewProps) {
  const hasSelection = selectionEnabled && selectedCount > 0;

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-row items-center gap-3">
          <ViewToggle
            value={viewMode}
            onChange={onViewModeChange}
            options={VIEW_OPTIONS}
            ariaLabel="View toggle"
            variant="media"
            activeClassName={toggleActiveClassName}
          />
          {hasSelection && onSelectAll && (
            <button
              onClick={() => onSelectAll(selectedCount < totalCount)}
              className={`cursor-pointer text-xs font-medium transition-colors ${toggleActiveClassName || "text-zinc-900 hover:text-black dark:text-zinc-100 dark:hover:text-white"}`}
            >
              {selectedCount < totalCount ? `Select all (${totalCount})` : "Deselect all"}
            </button>
          )}
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto mt-3 sm:mt-0">
          {hasSelection && bulkActionBar ? (
            bulkActionBar
          ) : (
            <>
              <SearchBar
                value={searchQuery}
                onChange={onSearchChange}
                placeholder={searchPlaceholder}
                className="flex-1 sm:w-64"
              />
              {onAdd && (
                <button
                  onClick={onAdd}
                  className="cursor-pointer inline-flex items-center justify-center gap-x-1.5 rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 bg-zinc-900 hover:bg-black dark:bg-zinc-100 dark:text-black dark:hover:bg-white"
                >
                  <Plus className="-ml-0.5 h-4 w-4" />
                  {addLabel}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1">
        {isLoading ? (
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
                  className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600 dark:bg-zinc-800 text-zinc-900 focus:ring-zinc-900 dark:text-zinc-100 dark:focus:ring-zinc-100"
                />
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {selectedCount === itemCount
                    ? "All selected"
                    : `${selectedCount} of ${itemCount} selected`}
                </span>
                <button
                  onClick={onClearSelection}
                  className="cursor-pointer ml-auto text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
                >
                  Clear
                </button>
              </div>
            )}
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {Array.from({ length: itemCount }, (_, i) => renderListRow(i))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: itemCount }, (_, i) => renderGridTile(i))}
          </div>
        )}
      </div>
    </>
  );
}
