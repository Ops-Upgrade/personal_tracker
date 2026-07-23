"use client";

import { useMemo } from "react";
import { trunc } from "@/lib/viewHelpers";
import PriorityBadge from "@/components/common/PriorityBadge";
import SortableHeader from "@/components/common/SortableHeader";
import { PaperClipIcon } from "@/components/common/Icons";
import { useTableSort, type SortConfig } from "@/hooks/useTableSort";
import type { Education } from "@/types/education";
import type { Document } from "@/types/document";
import type { Priority } from "@/types/common";

// --- Column type ---

type SortColumn = "name" | "provider" | "priority" | "due_date" | "completed_at";

// --- Priority order for sorting ---

const PRIORITY_SORT_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// --- Sort configs ---

const SORT_CONFIGS: SortConfig<SortColumn, Education>[] = [
  {
    column: "name",
    extractor: (edu) => edu.name.toLowerCase(),
  },
  {
    column: "provider",
    extractor: (edu) => (edu.provider ?? "").toLowerCase(),
  },
  {
    column: "priority",
    extractor: (edu) => PRIORITY_SORT_ORDER[edu.priority] ?? 99,
  },
  {
    column: "due_date",
    extractor: (edu) =>
      edu.due_date
        ? new Date(edu.due_date + "T00:00:00").getTime()
        : Number.MAX_SAFE_INTEGER,
  },
  {
    column: "completed_at",
    extractor: (edu) =>
      edu.completed_at ? new Date(edu.completed_at).getTime() : 0,
  },
];

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
  const { sortState, handleSort, sorted } = useTableSort(
    "educationTableSortState",
    educations,
    SORT_CONFIGS,
    disableSorting,
  );

  const docCountsByEdu = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of documents) {
      if (d.domain === "education" && d.linked_id) {
        map.set(d.linked_id, (map.get(d.linked_id) ?? 0) + 1);
      }
    }
    return map;
  }, [documents]);

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
                  as="th"
                  column="name"
                  label="Program Name"
                  sortState={sortState}
                  onSort={handleSort}
                  className="pb-2 pr-3 font-medium"
                />
                <SortableHeader
                  as="th"
                  column="provider"
                  label="Provider"
                  sortState={sortState}
                  onSort={handleSort}
                  className="pb-2 pr-3 font-medium"
                />
                <SortableHeader
                  as="th"
                  column="priority"
                  label="Priority"
                  sortState={sortState}
                  onSort={handleSort}
                  className="pb-2 pr-3 font-medium"
                />
                <SortableHeader
                  as="th"
                  column="due_date"
                  label="Due Date"
                  sortState={sortState}
                  onSort={handleSort}
                  className="pb-2 pr-3 font-medium"
                />
                <SortableHeader
                  as="th"
                  column="completed_at"
                  label="Completed"
                  sortState={sortState}
                  onSort={handleSort}
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
                      <span className="text-zinc-600 dark:text-zinc-300">({docCount})</span>
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
