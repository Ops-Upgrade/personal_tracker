"use client";

import type { MedicalRecord } from "@/types/medical";
import Button from "@/components/common/Button";
import MedicalTable from "./MedicalTable";
import MonthTile from "@/components/common/MonthTile";

interface MedicalYearRowProps {
  year: number;
  records: MedicalRecord[];
  onSelectRecord: (record: MedicalRecord) => void;
  onViewAll: () => void;
}

/**
 * A single past-year row in the medical records tracker.
 * Uses the reusable MonthTile component for consistent styling.
 *
 * Clicking the tile header expands/collapses the inline preview.
 * When expanded, shows a preview table (up to 5 items) of all records for that year.
 */
export default function MedicalYearRow({
  year,
  records,
  onSelectRecord,
  onViewAll,
}: MedicalYearRowProps) {
  const recordCount = records.length;

  // Preview: 5 most recent items sorted by date descending
  const sorted = [...records].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const preview = sorted.slice(0, 5);

  return (
    <MonthTile
      title={year.toString()}
      subtitle={
        <>
          {recordCount} record{recordCount !== 1 ? "s" : ""}
        </>
      }
      accent={recordCount > 0}
      footerActions={
        records.length > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewAll}
          >
            View All
          </Button>
        ) : undefined
      }
    >
      <MedicalTable records={preview} onSelectRecord={onSelectRecord} disableSorting />
    </MonthTile>
  );
}
