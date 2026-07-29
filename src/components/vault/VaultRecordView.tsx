"use client";

import { useState, useMemo, useCallback } from "react";
import { Trash2, Eye, EyeOff, Copy, Check } from "lucide-react";
import BackButton from "@/components/common/BackButton";
import BoxContainer from "@/components/common/BoxContainer";
import DataListView from "@/components/common/DataListView";
import type { VaultRecordItem } from "@/types/vault";

function InlineSecretValue({ value, isSecret }: { value: string; isSecret: boolean }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, [value]);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setRevealed(r => !r);
  }, []);

  return (
    <div 
      className="group/val flex flex-1 min-w-0 items-center gap-1 rounded px-1 py-2 -mx-1 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors cursor-text"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="text-base text-zinc-700 dark:text-zinc-300 font-mono overflow-x-auto whitespace-nowrap flex-1 min-w-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {isSecret && !revealed ? "••••••••" : value}
      </span>
      <div className="flex items-center gap-1 opacity-0 group-hover/val:opacity-100 focus-within:opacity-100 transition-opacity">
        {isSecret && (
          <button
            type="button"
            onClick={handleToggle}
            className="cursor-pointer flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300 transition-colors"
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
        <button
          type="button"
          onClick={handleCopy}
          className="cursor-pointer flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300 transition-colors"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

interface VaultRecordViewProps {
  items: VaultRecordItem[];
  isLoading?: boolean;
  onAdd?: () => void;
  onActionClick?: (id: string) => void;
  title?: React.ReactNode;
  emptyMessage?: string;
  searchPlaceholder?: string;
  /** When "body-only", the tile header bar is hidden and the title + values render together in the body without labels. */
  tileLayout?: "standard" | "body-only";
  /** Page-level description shown below the title. */
  description?: string;
  /** Back button href. When provided, a BackButton is rendered above the title. */
  backHref?: string;
  /** Back button label. Defaults to "← Back". */
  backLabel?: string;
  /** Actions rendered on the right side of the page header (e.g. Delete button). */
  headerActions?: React.ReactNode;
  /** When true, shows checkboxes and enables multi-select bulk actions. */
  selectionEnabled?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (id: string, checked: boolean) => void;
  onSelectAll?: (checked: boolean) => void;
  /** Rendered in place of the search bar when items are selected. */
  bulkActions?: React.ReactNode;
  /** Called when the user clicks the quick-delete (Trash) button on an item. */
  onDeleteClick?: (id: string) => void;
}

export default function VaultRecordView({
  items,
  isLoading = false,
  onAdd,
  onActionClick,
  title,
  emptyMessage = "No items to display.",
  searchPlaceholder = "Search...",
  tileLayout = "standard",
  description,
  backHref,
  backLabel = "← Back",
  headerActions,
  selectionEnabled = false,
  selectedIds,
  onSelectionChange,
  onSelectAll,
  bulkActions,
  onDeleteClick,
}: VaultRecordViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"tiles" | "list">("tiles");

  const filtered = useMemo(() => {
    if (!searchQuery) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.values.some((v) => !v.isSecret && v.value.toLowerCase().includes(q))
    );
  }, [items, searchQuery]);

  const selectedCount = selectedIds?.size ?? 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col items-start gap-4">
        {backHref && <BackButton href={backHref}>{backLabel}</BackButton>}
        <div className="flex w-full items-center justify-between">
          <div>
            {title && <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{title}</h1>}
            {description && (
              <p className="mt-1 text-sm font-normal text-zinc-500 dark:text-zinc-400">
                {description}
              </p>
            )}
          </div>
          {headerActions && <div>{headerActions}</div>}
        </div>
      </div>

      <BoxContainer className="flex flex-col h-full w-full space-y-6">
        <DataListView
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder={searchPlaceholder}
          isLoading={isLoading}
          isEmpty={items.length === 0}
          isFilteredEmpty={filtered.length === 0 && items.length > 0}
          emptyMessage={emptyMessage}
          onAdd={onAdd}
          selectionEnabled={selectionEnabled}
          selectedCount={selectedCount}
          totalCount={filtered.length}
          onSelectAll={onSelectAll}
          onClearSelection={() => onSelectAll?.(false)}
          bulkActionBar={bulkActions}
          itemCount={filtered.length}
          toggleActiveClassName="text-zinc-900 dark:text-zinc-100"
          renderListRow={(i) => {
            const item = filtered[i];
            const isSelected = selectedIds?.has(item.id) ?? false;
            return (
              <div
                key={item.id}
                onClick={() => onActionClick?.(item.id)}
                className={`group flex items-center gap-4 px-4 py-4 min-h-[72px] transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
                  onActionClick ? "cursor-pointer" : ""
                }`}
              >
                {selectionEnabled && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      e.stopPropagation();
                      onSelectionChange?.(item.id, e.target.checked);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className={`h-4 w-4 shrink-0 rounded border-zinc-300 dark:border-zinc-600 dark:bg-zinc-800 transition-opacity ${
                      isSelected
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100"
                    } text-zinc-900 focus:ring-zinc-900 dark:text-zinc-100 dark:focus:ring-zinc-100`}
                  />
                )}
                {tileLayout === "body-only" ? (
                  <div className="w-1/3 min-w-[120px] pt-0.5 flex items-start">
                    <div
                      className="flex-1 min-w-0 flex items-center gap-1 rounded px-1 py-2 -mx-1 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors cursor-text"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-base text-zinc-700 dark:text-zinc-300 font-mono overflow-x-auto whitespace-nowrap flex-1 min-w-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        {item.title}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="w-1/3 min-w-[120px] font-medium text-sm text-zinc-900 dark:text-zinc-100 break-words pt-0.5">
                    {item.title}
                  </div>
                )}
                <div className="w-px bg-zinc-200 dark:bg-zinc-700 self-stretch min-h-[1.5rem]" />
                <div className="flex-1 flex flex-col gap-1 min-w-0">
                  {item.values.map((v, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      {v.label && (
                        <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400 w-24 shrink-0 mt-0.5">
                          {v.label}
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <InlineSecretValue value={v.value} isSecret={v.isSecret ?? false} />
                      </div>
                    </div>
                  ))}
                </div>
                {onDeleteClick && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteClick(item.id);
                    }}
                    className="cursor-pointer flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          }}
          renderGridTile={(i) => {
            const item = filtered[i];
            const isSelected = selectedIds?.has(item.id) ?? false;
            return (
              <div
                key={item.id}
                onClick={() => onActionClick?.(item.id)}
                className={`group relative flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-all duration-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 min-h-[9rem] ${
                  onActionClick ? "cursor-pointer" : ""
                } hover:border-zinc-900 dark:hover:border-zinc-100`}
              >
                {/* Header (Top) */}
                <div className="flex items-center justify-between gap-2 px-3 py-3 border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700/50 dark:bg-zinc-800/50">
                  <div className="flex items-center gap-2 min-w-0">
                    {selectionEnabled && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => onSelectionChange?.(item.id, e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                        className={`h-4 w-4 shrink-0 rounded border-zinc-300 dark:border-zinc-600 dark:bg-zinc-800 text-zinc-900 focus:ring-zinc-900 dark:text-zinc-100 dark:focus:ring-zinc-100 transition-opacity ${
                          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        }`}
                      />
                    )}
                    <span className="block truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100" title={tileLayout === "standard" ? item.title : undefined}>
                      {tileLayout === "standard" ? item.title : " "}
                    </span>
                  </div>
                  {onDeleteClick && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteClick(item.id); }}
                      className="cursor-pointer flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/60 text-zinc-700 backdrop-blur-sm transition-all hover:bg-red-500/80 hover:text-white dark:bg-black/40 dark:text-zinc-300 opacity-0 group-hover:opacity-100"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {/* Content (Bottom) */}
                <div className="flex flex-col flex-1 p-3 gap-2 justify-end overflow-hidden">
                  {tileLayout === "body-only" && (
                    <div className="flex flex-col overflow-hidden">
                      <div
                        className="flex items-center gap-1 rounded px-1 py-2 -mx-1 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors cursor-text"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-base text-zinc-700 dark:text-zinc-300 font-mono overflow-x-auto whitespace-nowrap flex-1 min-w-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                          {item.title}
                        </span>
                      </div>
                    </div>
                  )}
                  {item.values.map((v, idx) => (
                    <div key={idx} className="flex flex-col overflow-hidden">
                      {v.label && (
                        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-1">
                          {v.label}
                        </span>
                      )}
                      <InlineSecretValue value={v.value} isSecret={v.isSecret ?? false} />
                    </div>
                  ))}
                </div>
              </div>
            );
          }}
        />
      </BoxContainer>
    </div>
  );
}
