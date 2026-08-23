import type { MedicalRecord } from "@/types/medical";
import type { ColumnDef } from "@/components/common/GenericViewPage";
import type { FieldDef } from "@/components/common/GenericDomainModal";
import { colDate, colRichtext, colFiles } from "@/components/common/columns";

// ── Sort column type ──

export type SortColumn = "name" | "clinic" | "date";

// ── Form schema for the medical record modal (store pages) ──

export const MEDICAL_FIELDS: FieldDef[] = [
  { key: "name", type: "text", label: "Name" },
  { key: "clinic", type: "text", label: "Clinic / Doctor" },
  { key: "date", type: "date", label: "Date" },
  { key: "diagnosis_timeline", type: "richtext", label: "Diagnosis Timeline", minHeight: "8rem" },
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
// gracefully via CSS — no breakpoint math anywhere. Cells are declarative
// tokens; the GenericDataGrid engine renders them internally.
export const MEDICAL_COLUMNS: ColumnDef<MedicalRecord, SortColumn>[] = [
  {
    key: "name",
    header: "Name",
    sizing: "flex",
    weight: 2,
    sortColumn: "name",
    token: { type: "text", accessor: (rec) => rec.name, color: "strong" },
  },
  {
    key: "clinic",
    header: "Clinic",
    sizing: "flex",
    weight: 1,
    sortColumn: "clinic",
    token: { type: "text", accessor: (rec) => rec.clinic, color: "muted" },
  },
  MEDICAL_DATE,
  MEDICAL_DIAGNOSIS,
  MEDICAL_FILES,
];
