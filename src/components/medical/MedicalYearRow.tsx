"use client";

import { useState } from "react";
import type { MedicalRecord } from "@/types/medical";
import Button from "@/components/common/Button";
import MedicalTable from "./MedicalTable";
import MonthTile from "@/components/common/MonthTile";

interface MedicalYearRowProps {
  year: number;
  records: MedicalRecord[];
  onSelectRecord: (record: MedicalRecord) => void;
}

/**
 * A single past-year row in the medical records tracker.
 * Uses the reusable MonthTile component for consistent styling.
 *
 * Clicking the tile header expands/collapses the inline preview.
 * When expanded, shows a preview table (up to 5 items) with a
 * "View All" toggle to expand the full list inline.
 */
export default function MedicalYearRow({
  year,
  records,
  onSelectRecord,
}: MedicalYearRowProps) {
  const recordCount = records.length;
  const [showAll, setShowAll] = useState(false);

  const sorted = [...records].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const preview = showAll ? sorted : sorted.slice(0, 5);

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
