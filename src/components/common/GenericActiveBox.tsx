"use client";

import type { ReactNode } from "react";
import type { ViewToggleOption } from "@/components/common/ViewToggle";
import ViewToggle from "@/components/common/ViewToggle";
import MonthTile from "@/components/common/MonthTile";
import Button from "@/components/common/Button";
import BoxContainer, { SCROLLABLE_CLASSES } from "@/components/common/BoxContainer";
import { MONTH_NAMES } from "@/lib/constants";
import { activeByMonths, byPriority } from "@/lib/viewHelpers";

/**
 * Minimum shape for an active item — must have id, priority, and optional due_date.
 * Extend with domain-specific fields via the renderItem callback.
 */
export interface ActiveItem {
  id: string;
  priority: string;
  due_date: string | null;
}

interface GenericActiveBoxProps<T extends ActiveItem> {
  items: T[];
  isLoading: boolean;
  view: string;
  nowYear: number;
  nowMonth: number;
  onViewChange: (next: string) => void;
  onAdd: () => void;
  title: string;
  viewOptions: readonly ViewToggleOption<string>[];
  priorities: readonly string[];
  getPriorityColor: (priority: string) => { border: string; bg: string };
  renderItem: (item: T) => ReactNode;
  renderPriorityBadge: (priority: string) => ReactNode;
}

export default function GenericActiveBox<T extends ActiveItem>({
  items,
  isLoading,
  view,
  nowYear,
  nowMonth,
  onViewChange,
  onAdd,
  title,
  viewOptions,
  priorities,
  getPriorityColor,
  renderItem,
  renderPriorityBadge,
}: GenericActiveBoxProps<T>) {
  const priorityGroups = byPriority(items, [...priorities]);
  const monthGroups = activeByMonths(items, nowYear);

  return (
    <BoxContainer className="lg:col-span-2">
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {title}
          </h2>
          <ViewToggle
            value={view}
            onChange={onViewChange}
            options={viewOptions}
            ariaLabel={`${title} view toggle`}
          />
        </div>
        <Button
          variant="secondary"
          size="md"
          onClick={onAdd}
          disabled={isLoading}
        >
          + Add
        </Button>
      </header>

      <div className={`${SCROLLABLE_CLASSES} space-y-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800`}>
        {isLoading && (
          <div className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</div>
        )}
        {!isLoading && items.length === 0 && (
          <div className="text-sm text-zinc-500 dark:text-zinc-400">None</div>
        )}

        {!isLoading &&
          view === "priority" &&
          priorities.map((priority) => {
            const group = priorityGroups[priority] ?? [];
            const colors = getPriorityColor(priority);

            return (
              <section
                key={priority}
                className={`rounded-lg border ${colors.border} ${colors.bg} p-2`}
              >
                <h3 className="mb-2">{renderPriorityBadge(priority)}</h3>
                {group.length === 0 && (
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">None</div>
                )}
                <div className="space-y-2">
                  {group.map((item) => renderItem(item))}
                </div>
              </section>
            );
          })}

        {!isLoading &&
          view === "months" &&
          monthGroups.map((group) => {
            const isCurrentMonth = MONTH_NAMES[nowMonth] === group.label;
            return (
              <MonthTile
                key={group.label}
                title={group.label}
                defaultExpanded={isCurrentMonth}
                accent={group.items.length > 0}
                className="text-sm"
                highlight={isCurrentMonth}
              >
                {group.items.length === 0 ? (
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">None</div>
                ) : (
                  <div className="space-y-2">
                    {group.items.map((item) => renderItem(item))}
                  </div>
                )}
              </MonthTile>
            );
          })}
      </div>
    </BoxContainer>
  );
}
