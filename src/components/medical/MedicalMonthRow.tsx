"use client";

import type { MedicalRecord } from "@/types/medical";
import Button from "@/components/common/Button";
import MedicalTable from "./MedicalTable";
import MonthTile from "@/components/common/MonthTile";

interface MedicalMonthRowProps {
  monthName: string;
  monthIndex: number; // 0-based
  year: number;
  records: MedicalRecord[];
  isCurrentMonth?: boolean;
  onSelectRecord: (record: MedicalRecord) => void;
  onViewAll: () => void;
}

/**
 * A single month row in the medical records tracker.
 * Uses the reusable MonthTile component for consistent styling.
 *
 * Clicking the tile header expands/collapses the inline preview.
 * When expanded, shows a preview table (up to 5 items).
 */
export default function MedicalMonthRow({
  monthName,
  records,
  isCurrentMonth,
  onSelectRecord,
  onViewAll,
}: MedicalMonthRowProps) {
  const recordCount = records.length;

  // Preview: 5 most recent items sorted by date descending
  const sorted = [...records].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const preview = sorted.slice(0, 5);

  return (
    <MonthTile
      id={isCurrentMonth ? "current-month-tile" : undefined}
      title={monthName}
      subtitle={
        <>
          {recordCount} record{recordCount !== 1 ? "s" : ""}
        </>
      }
      accent={recordCount > 0}
      defaultExpanded={isCurrentMonth}
      highlight={isCurrentMonth}
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
