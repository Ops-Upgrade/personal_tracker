import type { MedicalRecord } from "@/types/medical";
import type { ColumnDef } from "@/components/common/GenericViewPage";
import { colDate, colRichtext, colFiles } from "@/components/common/columns";

// ── Sort column type ──

export type SortColumn = "name" | "clinic" | "date";

// ── Sort configs ──

export const SORT_CONFIGS = [
  { column: "name" as const, extractor: (rec: MedicalRecord) => rec.name.toLowerCase() },
  { column: "clinic" as const, extractor: (rec: MedicalRecord) => (rec.clinic ?? "").toLowerCase() },
  { column: "date" as const, extractor: (rec: MedicalRecord) => new Date(rec.date + "T00:00:00").getTime() },
];

// ── Shared column atoms ──

export const MEDICAL_DATE: ColumnDef<MedicalRecord, SortColumn> = colDate<MedicalRecord, SortColumn>(
  { key: "date", header: "Date", accessor: (rec) => rec.date },
  { sortColumn: "date" },
);

export const MEDICAL_DIAGNOSIS: ColumnDef<MedicalRecord, SortColumn> = colRichtext<MedicalRecord, SortColumn>(
  { key: "diagnosis", header: "Diagnosis", accessor: (rec) => rec.diagnosis_timeline, weight: 1 },
);

export const MEDICAL_FILES: ColumnDef<MedicalRecord, SortColumn> = colFiles<MedicalRecord, SortColumn>({
  getCount: (rec) => rec.document_ids?.length ?? 0,
  iconColorClass: "text-rose-500",
});

// ── Column definitions for the "all" view ──

// Sizing model: "fixed" columns get max-content tracks (dates, files always
// fit their content); "flex" columns share the remaining space and truncate
// gracefully via CSS — no breakpoint math anywhere.
export const MEDICAL_COLUMNS: ColumnDef<MedicalRecord, SortColumn>[] = [
  {
    key: "name",
    header: "Name",
    sizing: "flex",
    weight: 2,
    sortColumn: "name",
    render: (rec) => (
      <span className="font-medium text-zinc-800 dark:text-zinc-100">
        {rec.name || "—"}
      </span>
    ),
  },
  {
    key: "clinic",
    header: "Clinic",
    sizing: "flex",
    weight: 1,
    sortColumn: "clinic",
    render: (rec) => (
      <span className="text-zinc-600 dark:text-zinc-300">
        {rec.clinic || "—"}
      </span>
    ),
  },
  MEDICAL_DATE,
  MEDICAL_DIAGNOSIS,
  MEDICAL_FILES,
];
