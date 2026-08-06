"use client";

import { useRouter } from "next/navigation";
import type { MedicalRecord } from "@/types/medical";
import { ROUTES } from "@/routes/paths";
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
 * Shows a preview of the latest 5 items inline. A "View All" button
 * navigates to the dedicated /medical/all page pre-filtered to this
 * month and year.
 */
export default function MedicalMonthRow({
  monthName,
  monthIndex,
  year,
  records,
  isCurrentMonth,
  onSelectRecord,
}: MedicalMonthRowProps) {
  const router = useRouter();
  const count = records.length;

  const sorted = [...records].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  const preview = sorted.slice(0, 5);

  return (
    <MonthTile
      id={isCurrentMonth ? "current-month-tile" : undefined}
      title={monthName}
      subtitle={
        <>
          {count} record{count !== 1 ? "s" : ""}
        </>
      }
      accent={count > 0}
      defaultExpanded={isCurrentMonth}
      highlight={isCurrentMonth}
      footerActions={
        records.length > 5 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              router.push(`${ROUTES.MEDICAL_ALL}?year=${year}&month=${monthIndex}`)
            }
          >
            View All {monthName} ({records.length})
          </Button>
        ) : undefined
      }
    >
      {preview.length > 0 && (
        <MedicalTable records={preview} onSelectRecord={onSelectRecord} disableSorting />
      )}
    </MonthTile>
  );
}
