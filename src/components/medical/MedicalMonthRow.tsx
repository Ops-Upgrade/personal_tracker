"use client";

import { useState } from "react";
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
}

/**
 * A single month row in the medical records tracker.
 * Uses the reusable MonthTile component for consistent styling.
 *
 * Clicking the tile header expands/collapses the inline preview.
 * When expanded, shows a preview table (up to 5 items) with a
 * "View All" toggle to expand the full list inline.
 */
export default function MedicalMonthRow({
  monthName,
  records,
  isCurrentMonth,
  onSelectRecord,
}: MedicalMonthRowProps) {
  const recordCount = records.length;
  const [showAll, setShowAll] = useState(false);

  const sorted = [...records].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const preview = showAll ? sorted : sorted.slice(0, 5);

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
        sorted.length > 5 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll((prev) => !prev)}
          >
            {showAll ? "View Less" : `View All (${sorted.length})`}
          </Button>
        ) : undefined
      }
    >
      <MedicalTable records={preview} onSelectRecord={onSelectRecord} disableSorting />
    </MonthTile>
  );
}
