"use client";

import { useCallback, useMemo } from "react";
import type { Education, EducationViewMode } from "@/types/education";
import type { Document } from "@/types/document";
import { PRIORITIES } from "@/types/common";
import type { ViewToggleOption } from "@/components/common/ViewToggle";
import GenericActiveBox from "@/components/common/GenericActiveBox";
import type { ColumnDef } from "@/components/common/GenericViewPage";
import Button from "@/components/common/Button";
import PriorityBadge from "@/components/common/PriorityBadge";
import { getPriorityColor } from "@/lib/priorityColors";
import { PaperClipIcon } from "@/components/common/Icons";
import { ROUTES } from "@/routes/paths";
import { formatShortDate, trunc } from "./helpers";

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

  // ── Column definitions (view-dependent: Priority hidden in priority view, Due Date always present) ──

  const educationColumns: ColumnDef<Education>[] = useMemo(
    () => {
      const isPriorityView = view === "priority";
      const cols: ColumnDef<Education>[] = [
        {
          key: "name",
          header: "Program Name",
          colSpan: isPriorityView ? 3 : 2,
          mobileBehavior: "truncate",
          render: (edu) => (
            <span className="font-semibold text-zinc-800 dark:text-zinc-100">
              {trunc(edu.name, 34)}
            </span>
          ),
        },
        {
          key: "provider",
          header: "Provider",
          colSpan: 2,
          mobileBehavior: "truncate",
          render: (edu) => (
            <span className="text-zinc-600 dark:text-zinc-300">
              {trunc(edu.provider, 24)}
            </span>
          ),
        },
      ];

      if (!isPriorityView) {
        cols.push({
          key: "priority",
          header: "Priority",
          colSpan: 1,
          mobileBehavior: "fixed",
          render: (edu) =>
            edu.priority ? (
              <PriorityBadge priority={edu.priority} />
            ) : (
              <span className="text-zinc-400">—</span>
            ),
        });
      }

      cols.push({
        key: "due_date",
        header: "Due Date",
        colSpan: 4,
        mobileBehavior: "fixed",
        render: (edu) => (
          <span className="text-zinc-600 dark:text-zinc-300">
            {formatShortDate(edu.due_date)}
          </span>
        ),
      });

      cols.push(
        {
          key: "description",
          header: "Description",
          colSpan: 1,
          mobileBehavior: "truncate",
          render: (edu) => (
            <span className="text-zinc-700 dark:text-zinc-200">
              {trunc(edu.description, 38)}
            </span>
          ),
        },
        {
          key: "files",
          header: "Files",
          colSpan: 2,
          mobileBehavior: "fixed",
          render: (edu) => {
            const count = docCountsByEdu.get(edu.id) ?? 0;
            return count > 0 ? (
              <span className="inline-flex items-center gap-1 text-amber-500" title={`${count} document(s) attached`}>
                <PaperClipIcon className="h-4 w-4" />
                <span className="text-zinc-600 dark:text-zinc-300">({count})</span>
              </span>
            ) : (
              <span className="text-zinc-400 dark:text-zinc-600">—</span>
            );
          },
        },
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
      <Button variant="success" size="sm" onClick={() => onMarkComplete(edu)}>
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
