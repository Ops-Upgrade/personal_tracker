"use client";

import { useCallback, useMemo } from "react";
import type { Education, EducationViewMode } from "@/types/education";
import type { Document } from "@/types/document";
import { PRIORITIES } from "@/types/common";
import type { ViewToggleOption } from "@/components/common/ViewToggle";
import GenericActiveBox from "@/components/common/GenericActiveBox";
import type { ColumnDef } from "@/components/common/GenericViewPage";
import PriorityBadge from "@/components/common/PriorityBadge";
import Button from "@/components/common/Button";
import { getPriorityColor } from "@/lib/priorityColors";
import { EDU_PRIORITY, EDU_DUE_DATE } from "./config";
import { colRichtext, colFiles } from "@/components/common/columns";
import { ROUTES } from "@/routes/paths";

const EDUCATION_VIEW_OPTIONS: readonly ViewToggleOption<EducationViewMode>[] = [
  { value: "months", label: "Months" },
  { value: "priority", label: "Priority" },
];

interface ActiveEducationsBoxProps {
  educations: Education[];
  documents: Document[];
  isLoading: boolean;
  view: EducationViewMode;
  nowYear: number;
  nowMonth: number;
  onViewChange: (next: EducationViewMode) => void;
  onAdd: () => void;
  onSelectEducation: (education: Education) => void;
  onMarkComplete: (education: Education) => void;
}

export default function ActiveEducationsBox({
  educations,
  documents,
  isLoading,
  view,
  nowYear,
  nowMonth,
  onViewChange,
  onAdd,
  onSelectEducation,
  onMarkComplete,
}: ActiveEducationsBoxProps) {
  const docCountsByEdu = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of documents) {
      if (d.domain === "education" && d.linked_id) {
        map.set(d.linked_id, (map.get(d.linked_id) ?? 0) + 1);
      }
    }
    return map;
  }, [documents]);

  // ── Column definitions (Priority hidden in the priority view) ──
  // Fixed tracks size themselves to content; flex tracks share the rest.
  // No breakpoint math: track widths emerge from content + available space.

  const educationColumns: ColumnDef<Education>[] = useMemo(
    () => {
      const isPriorityView = view === "priority";
      const cols: ColumnDef<Education>[] = [
        {
          key: "name",
          header: "Program Name",
          sizing: "flex",
          weight: 2,
          render: (edu) => (
            <span className="font-semibold text-zinc-800 dark:text-zinc-100">
              {edu.name}
            </span>
          ),
        },
        {
          key: "provider",
          header: "Provider",
          sizing: "flex",
          weight: 1,
          render: (edu) => (
            <span className="text-zinc-600 dark:text-zinc-300">
              {edu.provider}
            </span>
          ),
        },
      ];

      if (!isPriorityView) {
        cols.push(EDU_PRIORITY);
      }

      cols.push(EDU_DUE_DATE);

      cols.push(
        colRichtext<Education>({
          key: "description",
          header: "Description",
          accessor: (edu) => edu.description,
          weight: 2,
          className: "text-zinc-700 dark:text-zinc-200",
        }),
        colFiles<Education>({
          getCount: (edu) => docCountsByEdu.get(edu.id) ?? 0,
          iconColorClass: "text-amber-500",
        }),
      );

      return cols;
    },
    [view, docCountsByEdu],
  );

  const getItemClassName = useCallback(
    (edu: Education) => {
      const colors = edu.priority
        ? getPriorityColor(edu.priority)
        : { border: "border-zinc-200" };
      return `border-l-[3px] ${colors.border}`;
    },
    [],
  );

  const rowAction = useCallback(
    (edu: Education) => (
      <Button
        variant="success"
        size="sm"
        className="w-[85px]"
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          onMarkComplete(edu);
        }}
      >
        Complete
      </Button>
    ),
    [onMarkComplete],
  );

  const getSubtitle = useCallback(
    (items: Education[]) => (
      <>{items.length} education{items.length !== 1 ? "s" : ""}</>
    ),
    [],
  );

  return (
    <GenericActiveBox
      items={educations}
      isLoading={isLoading}
      view={view}
      nowYear={nowYear}
      nowMonth={nowMonth}
      onViewChange={(v) => onViewChange(v as EducationViewMode)}
      onAdd={onAdd}
      title="Active Educations"
      viewOptions={EDUCATION_VIEW_OPTIONS}
      priorities={PRIORITIES}
      getPriorityColor={(p) => getPriorityColor(p as "low" | "medium" | "high" | "critical")}
      renderPriorityBadge={(p) => <PriorityBadge priority={p as "low" | "medium" | "high" | "critical"} showTextOnMobile />}
      columns={educationColumns}
      onRowClick={onSelectEducation}
      rowAction={rowAction}
      getItemClassName={getItemClassName}
      getSubtitle={getSubtitle}
      viewAllBaseHref={ROUTES.EDUCATION_ALL}
    />
  );
}
