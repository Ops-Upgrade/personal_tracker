"use client";

import { trunc } from "@/lib/viewHelpers";
import { formatShortDate } from "@/lib/format";
import SortableHeader from "@/components/common/SortableHeader";
import { PaperClipIcon } from "@/components/common/Icons";
import { useTableSort, type SortConfig } from "@/hooks/useTableSort";
import type { MedicalRecord } from "@/types/medical";

// --- Column type ---

type SortColumn = "name" | "clinic" | "date" | "diagnosis";

// --- Sort configs ---

const SORT_CONFIGS: SortConfig<SortColumn, MedicalRecord>[] = [
  { column: "name", extractor: (rec) => rec.name.toLowerCase() },
  { column: "clinic", extractor: (rec) => (rec.clinic ?? "").toLowerCase() },
  { column: "date", extractor: (rec) => new Date(rec.date + "T00:00:00").getTime() },
  { column: "diagnosis", extractor: (rec) => (rec.diagnosis_timeline ?? "").toLowerCase() },
];

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
  const { sortState, handleSort, sorted } = useTableSort(
    "medicalTableSortState",
    records,
    SORT_CONFIGS,
    disableSorting,
  );

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
                <th className="pb-2 pr-3 font-medium">Diagnosis</th>
                <th className="pb-2 font-medium text-center">Files</th>
              </>
            ) : (
              <>
                <SortableHeader
                  as="th"
                  column="name"
                  label="Name"
                  sortState={sortState}
                  onSort={handleSort}
                  className="pb-2 pr-3 font-medium"
                />
                <SortableHeader
                  as="th"
                  column="clinic"
                  label="Clinic"
                  sortState={sortState}
                  onSort={handleSort}
                  className="pb-2 pr-3 font-medium"
                />
                <SortableHeader
                  as="th"
                  column="date"
                  label="Date"
                  sortState={sortState}
                  onSort={handleSort}
                  className="pb-2 pr-3 font-medium"
                />
                <SortableHeader
                  as="th"
                  column="diagnosis"
                  label="Diagnosis"
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
              <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                {formatShortDate(record.date)}
              </td>
              <td className="py-2 pr-3 text-zinc-500 dark:text-zinc-400 truncate max-w-[120px]">
                {trunc(record.diagnosis_timeline, 28) || "—"}
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
