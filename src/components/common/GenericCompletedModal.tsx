"use client";

import type { ReactNode } from "react";
import type { ViewToggleOption } from "@/components/common/ViewToggle";
import ViewToggle from "@/components/common/ViewToggle";
import MonthTile from "@/components/common/MonthTile";
import ModalFrame from "@/components/common/ModalFrame";
import { MONTH_NAMES } from "@/lib/constants";
import { byPriority, completedByMonths, sortByCompletedDesc } from "@/lib/viewHelpers";

/**
 * Minimum shape for a completed item — must have id, priority, and optional completed_at.
 */
export interface CompletedItem {
  id: string;
  priority: string;
  completed_at: string | null;
}

interface GenericCompletedModalProps<T extends CompletedItem> {
  items: T[];
  view: string;
  nowYear: number;
  nowMonth: number;
  onViewChange: (next: string) => void;
  onClose: () => void;
  title: string;
  viewOptions: readonly ViewToggleOption<string>[];
  priorities: readonly string[];
  getPriorityColor: (priority: string) => { border: string; bg: string };
  renderItem: (item: T) => ReactNode;
  renderPriorityBadge: (priority: string) => ReactNode;
}

export default function GenericCompletedModal<T extends CompletedItem>({
  items,
  view,
  nowYear,
  nowMonth,
  onViewChange,
  onClose,
  title,
  viewOptions,
  priorities,
  getPriorityColor,
  renderItem,
  renderPriorityBadge,
}: GenericCompletedModalProps<T>) {
  const priorityGroups = byPriority(items.map((item) => ({ ...item })), [...priorities]);
  const monthGroups = completedByMonths(items, nowYear);

  return (
    <ModalFrame title={title} onClose={onClose}>
      <div className="mb-3">
        <ViewToggle
          value={view}
          onChange={onViewChange}
          options={viewOptions}
          ariaLabel={`${title} view toggle`}
        />
      </div>

      <div className="max-h-[65vh] space-y-3 overflow-y-auto rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
        {items.length === 0 && (
          <div className="text-sm text-zinc-500 dark:text-zinc-400">None</div>
        )}

        {view === "priority" &&
          priorities.map((priority) => {
            const group = [...(priorityGroups[priority] ?? [])].sort(sortByCompletedDesc);
            if (group.length === 0) return null;
            const colors = getPriorityColor(priority);

            return (
              <section
                key={priority}
                className={`rounded-lg border ${colors.border} ${colors.bg} p-2`}
              >
                <h3 className="mb-2">{renderPriorityBadge(priority)}</h3>
                <div className="space-y-2">
                  {group.map((item) => renderItem(item))}
                </div>
              </section>
            );
          })}

        {view === "months" &&
          monthGroups.map((group, index) => {
            const isCurrentMonth = MONTH_NAMES[nowMonth] === group.label;
            return (
              <MonthTile
                key={group.label}
                title={group.label}
                defaultExpanded={index === 0}
                accent
                className="text-sm"
                highlight={isCurrentMonth}
              >
                <div className="space-y-2">
                  {group.items.map((item) => renderItem(item))}
                </div>
              </MonthTile>
            );
          })}
      </div>
    </ModalFrame>
  );
}
