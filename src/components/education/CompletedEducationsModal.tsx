"use client";

import { useState } from "react";
import type { Education, Certificate, EducationViewMode } from "@/types/education";
import { PRIORITIES } from "@/types/taskmanager";
import type { ViewToggleOption } from "@/components/common/ViewToggle";
import GenericCompletedModal from "@/components/common/GenericCompletedModal";
import PriorityBadge from "@/components/taskmanager/PriorityBadge";
import { getPriorityColor } from "@/lib/priorityColors";
import {
  formatShortDate,
  trunc,
} from "./helpers";

interface CompletedEducationsModalProps {
  educations: Education[];
  certificates: Certificate[];
  onClose: () => void;
  onSelectEducation: (education: Education) => void;
}

const EDUCATION_VIEW_OPTIONS: readonly ViewToggleOption<EducationViewMode>[] = [
  { value: "months", label: "Months" },
  { value: "priority", label: "Priority" },
];

export default function CompletedEducationsModal({
  educations,
  onClose,
  onSelectEducation,
}: CompletedEducationsModalProps) {
  const [view, setView] = useState<EducationViewMode>("months");

  const now = new Date();
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth();

  return (
    <GenericCompletedModal
      items={educations}
      view={view}
      nowYear={nowYear}
      nowMonth={nowMonth}
      onViewChange={(v) => setView(v as EducationViewMode)}
      onClose={onClose}
      title="Completed Educations"
      viewOptions={EDUCATION_VIEW_OPTIONS}
      priorities={PRIORITIES}
      getPriorityColor={(p) => getPriorityColor(p as "low" | "medium" | "high" | "critical")}
      renderPriorityBadge={(p) => <PriorityBadge priority={p as "low" | "medium" | "high" | "critical"} />}
      renderItem={(edu) => {
        const colors = edu.priority ? getPriorityColor(edu.priority) : { border: "border-zinc-200", bg: "" };
        return (
          <div
            key={edu.id}
            className={`grid w-full grid-cols-12 items-center gap-2 rounded-md border border-zinc-200 px-2 py-1.5 text-left text-sm dark:border-zinc-700 border-l-[3px] ${colors.border}`}
          >
            {view === "priority" ? (
              <>
                <button
                  type="button"
                  onClick={() => onSelectEducation(edu)}
                  className="col-span-9 cursor-pointer text-left font-semibold text-zinc-800 hover:text-zinc-900 dark:text-zinc-100 dark:hover:text-white"
                >
                  {trunc(edu.name, 52)}
                </button>
                <span className="col-span-3 text-right pr-2 text-zinc-600 dark:text-zinc-300">
                  {formatShortDate(edu.completed_at)}
                </span>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onSelectEducation(edu)}
                  className="col-span-7 cursor-pointer text-left font-semibold text-zinc-800 hover:text-zinc-900 dark:text-zinc-100 dark:hover:text-white"
                >
                  {trunc(edu.name, 42)}
                </button>
                <span className="col-span-2">
                  {edu.priority ? <PriorityBadge priority={edu.priority} /> : "-"}
                </span>
                <span className="col-span-3 text-right pr-2 text-zinc-600 dark:text-zinc-300">
                  {formatShortDate(edu.completed_at)}
                </span>
              </>
            )}
          </div>
        );
      }}
    />
  );
}
