import type { MedicalRecord } from "@/types/medical";
import type { ColumnDef } from "@/components/common/GenericViewPage";
import { PaperClipIcon } from "@/components/common/Icons";
import { trunc } from "@/lib/viewHelpers";

// ── Sort column type ──

export type SortColumn = "name" | "clinic" | "date";

// ── Sort configs ──

export const SORT_CONFIGS = [
  { column: "name" as const, extractor: (rec: MedicalRecord) => rec.name.toLowerCase() },
  { column: "clinic" as const, extractor: (rec: MedicalRecord) => (rec.clinic ?? "").toLowerCase() },
  { column: "date" as const, extractor: (rec: MedicalRecord) => new Date(rec.date + "T00:00:00").getTime() },
];

// ── Date formatting ──

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── Column definitions for the "all" view ──

export const MEDICAL_COLUMNS: ColumnDef<MedicalRecord, SortColumn>[] = [
  {
    key: "name",
    header: "Name",
    colSpan: 3,
    sortColumn: "name",
    render: (rec) => (
      <span className="font-medium text-zinc-800 dark:text-zinc-100">
        {trunc(rec.name, 24) || "—"}
      </span>
    ),
  },
  {
    key: "clinic",
    header: "Clinic",
    colSpan: 2,
    sortColumn: "clinic",
    render: (rec) => (
      <span className="text-zinc-600 dark:text-zinc-300">
        {trunc(rec.clinic, 20) || "—"}
      </span>
    ),
  },
  {
    key: "date",
    header: "Date",
    colSpan: 2,
    sortColumn: "date",
    render: (rec) => (
      <span className="text-zinc-600 dark:text-zinc-300">
        {formatDate(rec.date)}
      </span>
    ),
  },
  {
    key: "diagnosis",
    header: "Diagnosis",
    colSpan: 3,
    render: (rec) => (
      <span className="text-zinc-500 dark:text-zinc-400">
        {trunc(rec.diagnosis_timeline, 28) || "—"}
      </span>
    ),
  },
  {
    key: "files",
    header: "Files",
    colSpan: 2,
    render: (rec) => {
      const count = rec.document_ids?.length ?? 0;
      return count > 0 ? (
        <span
          className="inline-flex items-center justify-center gap-1 text-rose-500"
          title={`${count} document(s) attached`}
        >
          <PaperClipIcon className="h-4 w-4" />
          <span className="text-zinc-600 dark:text-zinc-300">
            ({count})
          </span>
        </span>
      ) : (
        <span className="text-zinc-400">—</span>
      );
    },
  },
];
