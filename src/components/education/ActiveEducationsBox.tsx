"use client";

import type { Education, EducationViewMode } from "@/types/education";
import { PRIORITIES } from "@/types/taskmanager";
import type { ViewToggleOption } from "@/components/common/ViewToggle";
import GenericActiveBox from "@/components/common/GenericActiveBox";
import Button from "@/components/common/Button";
import PriorityBadge from "@/components/common/PriorityBadge";
import { getPriorityColor } from "@/lib/priorityColors";
import { trunc } from "./helpers";

const EDUCATION_VIEW_OPTIONS: readonly ViewToggleOption<EducationViewMode>[] = [
  { value: "months", label: "Months" },
  { value: "priority", label: "Priority" },
];

interface ActiveEducationsBoxProps {
  educations: Education[];
  isLoading: boolean;
  view: EducationViewMode;
  nowYear: number;
  nowMonth: number;
  onViewChange: (next: EducationViewMode) => void;
  onAdd: () => void;
  onSelectEducation: (education: Education) => void;
  onMarkComplete: (education: Education) => void;
}

function dueDisplay(dueDate: string | null): string {
  return dueDate ?? "-";
}

export default function ActiveEducationsBox({
  educations,
  isLoading,
  view,
  nowYear,
  nowMonth,
  onViewChange,
  onAdd,
  onSelectEducation,
  onMarkComplete,
}: ActiveEducationsBoxProps) {
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
      renderPriorityBadge={(p) => <PriorityBadge priority={p as "low" | "medium" | "high" | "critical"} />}
      renderItem={(edu) => {
        const colors = edu.priority ? getPriorityColor(edu.priority) : { border: "border-zinc-200", bg: "" };
        return (
          <div
            key={edu.id}
            className={`group flex items-center justify-between gap-2 rounded-md border border-zinc-200 px-2 py-1.5 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/60 border-l-[3px] ${colors.border}`}
          >
            <button
              type="button"
              onClick={() => onSelectEducation(edu)}
              className="grid flex-1 cursor-pointer gap-2 text-left text-sm sm:grid-cols-12"
            >
              <span className="font-semibold text-zinc-800 dark:text-zinc-100 sm:col-span-3">
                {trunc(edu.name, 34)}
              </span>
              <span className="text-zinc-600 dark:text-zinc-300 sm:col-span-3">
                <span className="mr-1 inline sm:hidden">Provider:</span>
                {trunc(edu.provider, 24)}
              </span>
              {view === "priority" ? (
                <span className="text-zinc-600 dark:text-zinc-300 sm:col-span-2">
                  <span className="mr-1 inline sm:hidden">Due:</span>
                  {dueDisplay(edu.due_date)}
                </span>
              ) : (
                <span className="text-zinc-600 dark:text-zinc-300 sm:col-span-2">
                  <span className="mr-1 inline sm:hidden">Priority:</span>
                  {edu.priority ? <PriorityBadge priority={edu.priority} /> : "-"}
                </span>
              )}
              <span className="text-zinc-700 dark:text-zinc-200 sm:col-span-4">
                <span className="mr-1 inline sm:hidden">Desc:</span>
                {trunc(edu.description, 38)}
              </span>
            </button>
            <Button
              variant="success"
              size="sm"
              onClick={() => onMarkComplete(edu)}
            >
              Complete
            </Button>
          </div>
        );
      }}
    />
  );
}
