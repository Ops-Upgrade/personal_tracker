"use client";

import { useMemo } from "react";
import type { Education, EducationViewMode } from "@/types/education";
import type { Document } from "@/types/document";
import { PRIORITIES } from "@/types/taskmanager";
import type { ViewToggleOption } from "@/components/common/ViewToggle";
import GenericActiveBox from "@/components/common/GenericActiveBox";
import Button from "@/components/common/Button";
import PriorityBadge from "@/components/common/PriorityBadge";
import { getPriorityColor } from "@/lib/priorityColors";
import { trunc } from "./helpers";

// --- Inline SVG Icon ---

function PaperClipIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-5.7-1.477-1.477" />
    </svg>
  );
}

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

function dueDisplay(dueDate: string | null): string {
  return dueDate ?? "-";
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
      renderHeader={() => (
        <div className="hidden sm:flex items-center justify-between gap-2 px-2 pb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700">
          <div className="grid flex-1 gap-2 sm:grid-cols-12 pl-[3px]">
            <div className="col-span-3">Program Name</div>
            <div className="col-span-3">Provider</div>
            <div className="col-span-2">{view === "priority" ? "Due Date" : "Priority"}</div>
            <div className="col-span-2">Description</div>
            <div className="col-span-2 text-center">Files</div>
          </div>
          <div className="w-[85px]" />
        </div>
      )}
      renderItem={(edu) => {
        const colors = edu.priority ? getPriorityColor(edu.priority) : { border: "border-zinc-200", bg: "" };
        const docCount = docCountsByEdu.get(edu.id) ?? 0;
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
              <span className="text-zinc-700 dark:text-zinc-200 sm:col-span-2">
                <span className="mr-1 inline sm:hidden">Desc:</span>
                {trunc(edu.description, 38)}
              </span>
              <span className="sm:col-span-2 flex items-center justify-center">
                {docCount > 0 ? (
                  <span className="inline-flex items-center gap-1 text-amber-500" title={`${docCount} document(s) attached`}>
                    <PaperClipIcon className="h-4 w-4" />
                    <span className="text-zinc-600 dark:text-zinc-300">({docCount})</span>
                  </span>
                ) : (
                  <span className="text-zinc-400 dark:text-zinc-600">—</span>
                )}
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
