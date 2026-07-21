"use client";

import { useMemo } from "react";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { trunc } from "@/lib/viewHelpers";
import type { MedicalRecord } from "@/types/medical";

// --- Inline SVG Icon Component ---

function PaperClipIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-5.7-1.477-1.477" />
    </svg>
  );
}

// --- Types ---

type SortColumn = "name" | "clinic" | "date";
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

// --- Main Component ---

interface MedicalTableProps {
  records: MedicalRecord[];
  onSelectRecord: (record: MedicalRecord) => void;
  /** When true, column headers are rendered as plain text (no sort controls). */
  disableSorting?: boolean;
}

/**
 * Reusable medical records table — used in both the inline month preview and the full "View All" page.
 * Columns: Name, Clinic, Date, Files.
 * Clicking a column header toggles between ascending, descending, and no-sort.
 */
export default function MedicalTable({
  records,
  onSelectRecord,
  disableSorting = false,
}: MedicalTableProps) {
  const [sortState, setSortState] = useLocalStorage<SortState | null>("medicalTableSortState", null);

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
    if (disableSorting || !sortState) return records;
    const { column, direction } = sortState;
    const sorted = [...records].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (column) {
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case "clinic":
          aVal = (a.clinic ?? "").toLowerCase();
          bVal = (b.clinic ?? "").toLowerCase();
          break;
        case "date":
          aVal = new Date(a.date + "T00:00:00").getTime();
          bVal = new Date(b.date + "T00:00:00").getTime();
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return direction === "asc" ? -1 : 1;
      if (aVal > bVal) return direction === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [records, sortState, disableSorting]);

  if (records.length === 0) {
    return (
      <div className="py-3 text-sm text-zinc-500 dark:text-zinc-400">
        No medical records found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            {disableSorting ? (
              <>
                <th className="pb-2 pr-3 font-medium">Name</th>
                <th className="pb-2 pr-3 font-medium">Clinic</th>
                <th className="pb-2 pr-3 font-medium">Date</th>
                <th className="pb-2 font-medium text-center">Files</th>
              </>
            ) : (
              <>
                <SortableHeader
                  label="Name"
                  column="name"
                  sortState={sortState}
                  onClick={handleSort}
                  className="pb-2 pr-3 font-medium"
                />
                <SortableHeader
                  label="Clinic"
                  column="clinic"
                  sortState={sortState}
                  onClick={handleSort}
                  className="pb-2 pr-3 font-medium"
                />
                <SortableHeader
                  label="Date"
                  column="date"
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
          {sorted.map((record) => (
            <tr
              key={record.id}
              onClick={() => onSelectRecord(record)}
              className="cursor-pointer border-b border-zinc-200 dark:border-zinc-700 last:border-b-0 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
            >
              <td className="py-2 pr-3 font-medium text-zinc-800 dark:text-zinc-100">
                {trunc(record.name, 24) || "—"}
              </td>
              <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-300">
                {trunc(record.clinic, 20) || "—"}
              </td>
              <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-300">
                {formatDate(record.date)}
              </td>
              <td className="py-2 text-center">
                {(record.document_ids && record.document_ids.length > 0) ? (
                  <span className="inline-flex items-center justify-center gap-1 text-rose-500" title={`${record.document_ids.length} document(s) attached`}>
                    <PaperClipIcon className="h-4 w-4" />
                    <span className="text-zinc-600 dark:text-zinc-300">({record.document_ids.length})</span>
                  </span>
                ) : (
                  <span className="text-zinc-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
