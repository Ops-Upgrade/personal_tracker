"use client";

import { useMemo } from "react";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { trunc } from "@/lib/viewHelpers";
import PriorityBadge from "@/components/common/PriorityBadge";
import type { Education } from "@/types/education";
import type { Document } from "@/types/document";
import type { Priority } from "@/types/taskmanager";

// --- Inline SVG Icon ---

function PaperClipIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-5.7-1.477-1.477" />
    </svg>
  );
}

// --- Types ---

type SortColumn = "name" | "provider" | "priority" | "due_date" | "completed_at";
type SortDirection = "asc" | "desc";

interface SortState {
  column: SortColumn;
  direction: SortDirection;
}

interface SortableHeaderProps {
  label: string;
  column: SortColumn;
  sortState: SortState | null;
  onClick: (column: SortColumn) => void;
  className?: string;
}

function SortableHeader({
  label,
  column,
  sortState,
  onClick,
  className,
}: SortableHeaderProps) {
  const isActive = sortState?.column === column;

  return (
    <th
      className={`cursor-pointer select-none hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors ${className ?? ""}`}
      onClick={() => onClick(column)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className="text-[9px] leading-none w-2 inline-block">
          {isActive
            ? sortState.direction === "asc"
              ? "▲"
              : "▼"
            : "↕"}
        </span>
      </span>
    </th>
  );
}

// --- Priority order for sorting ---

const PRIORITY_SORT_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// --- Main Component ---

interface EducationTableProps {
  educations: Education[];
  documents: Document[];
  onSelectEducation: (education: Education) => void;
  /** When true, column headers are rendered as plain text (no sort controls). */
  disableSorting?: boolean;
}

/**
 * Reusable sortable education table — used in the completed educations "View All" page.
 * Columns: Program Name, Provider, Priority, Due Date, Completed Date, Files.
 * Clicking a column header toggles between ascending, descending, and no-sort.
 */
export default function EducationTable({
  educations,
  documents,
  onSelectEducation,
  disableSorting = false,
}: EducationTableProps) {
  const [sortState, setSortState] = useLocalStorage<SortState | null>("educationTableSortState", null);

  const docCountsByEdu = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of documents) {
      if (d.domain === "education" && d.linked_id) {
        map.set(d.linked_id, (map.get(d.linked_id) ?? 0) + 1);
      }
    }
    return map;
  }, [documents]);

  function handleSort(column: SortColumn) {
    setSortState((prev) => {
      if (prev?.column !== column) {
        return { column, direction: "asc" };
      }
      if (prev.direction === "asc") {
        return { column, direction: "desc" };
      }
      // Second click on same column with desc → clear sort
      return null;
    });
  }

  const sorted = useMemo(() => {
    if (disableSorting || !sortState) return educations;
    const { column, direction } = sortState;
    const sorted = [...educations].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (column) {
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case "provider":
          aVal = (a.provider ?? "").toLowerCase();
          bVal = (b.provider ?? "").toLowerCase();
          break;
        case "priority":
          aVal = PRIORITY_SORT_ORDER[a.priority] ?? 99;
          bVal = PRIORITY_SORT_ORDER[b.priority] ?? 99;
          break;
        case "due_date":
          aVal = a.due_date ? new Date(a.due_date + "T00:00:00").getTime() : Number.MAX_SAFE_INTEGER;
          bVal = b.due_date ? new Date(b.due_date + "T00:00:00").getTime() : Number.MAX_SAFE_INTEGER;
          break;
        case "completed_at":
          aVal = a.completed_at ? new Date(a.completed_at).getTime() : 0;
          bVal = b.completed_at ? new Date(b.completed_at).getTime() : 0;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return direction === "asc" ? -1 : 1;
      if (aVal > bVal) return direction === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [educations, sortState, disableSorting]);

  if (educations.length === 0) {
    return (
      <div className="py-3 text-sm text-zinc-500 dark:text-zinc-400">
        No completed educations.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            {disableSorting ? (
              <>
                <th className="pb-2 pr-3 font-medium">Program Name</th>
                <th className="pb-2 pr-3 font-medium">Provider</th>
                <th className="pb-2 pr-3 font-medium">Priority</th>
                <th className="pb-2 pr-3 font-medium">Due Date</th>
                <th className="pb-2 pr-3 font-medium">Completed</th>
                <th className="pb-2 font-medium text-center">Files</th>
              </>
            ) : (
              <>
                <SortableHeader
                  label="Program Name"
                  column="name"
                  sortState={sortState}
                  onClick={handleSort}
                  className="pb-2 pr-3 font-medium"
                />
                <SortableHeader
                  label="Provider"
                  column="provider"
                  sortState={sortState}
                  onClick={handleSort}
                  className="pb-2 pr-3 font-medium"
                />
                <SortableHeader
                  label="Priority"
                  column="priority"
                  sortState={sortState}
                  onClick={handleSort}
                  className="pb-2 pr-3 font-medium"
                />
                <SortableHeader
                  label="Due Date"
                  column="due_date"
                  sortState={sortState}
                  onClick={handleSort}
                  className="pb-2 pr-3 font-medium"
                />
                <SortableHeader
                  label="Completed"
                  column="completed_at"
                  sortState={sortState}
                  onClick={handleSort}
                  className="pb-2 pr-3 font-medium"
                />
                <th className="pb-2 font-medium text-center">Files</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {sorted.map((edu) => {
            const docCount = docCountsByEdu.get(edu.id) ?? 0;
            return (
              <tr
                key={edu.id}
                onClick={() => onSelectEducation(edu)}
                className="cursor-pointer border-b border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60"
              >
                <td className="py-2 pr-3 font-medium text-zinc-800 dark:text-zinc-100">
                  {trunc(edu.name, 28) || "—"}
                </td>
                <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-300">
                  {trunc(edu.provider, 22) || "—"}
                </td>
                <td className="py-2 pr-3">
                  {edu.priority ? (
                    <PriorityBadge priority={edu.priority as Priority} />
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
                <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-300">
                  {edu.due_date ? formatDate(edu.due_date) : "—"}
                </td>
                <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-300">
                  {edu.completed_at ? formatDate(edu.completed_at) : "—"}
                </td>
                <td className="py-2 text-center">
                  {docCount > 0 ? (
                    <span className="inline-flex items-center justify-center gap-1 text-amber-500" title={`${docCount} document(s) attached`}>
                      <PaperClipIcon className="h-4 w-4" />
                      <span className="font-medium text-zinc-500 dark:text-zinc-400">({docCount})</span>
                    </span>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr.includes("T") ? dateStr : dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
