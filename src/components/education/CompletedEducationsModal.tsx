"use client";

import { useState } from "react";
import type { Education, Certificate, EducationViewMode } from "@/types/education";
import { PRIORITIES } from "@/types/taskmanager";
import type { ViewToggleOption } from "@/components/common/ViewToggle";
import ModalFrame from "@/components/taskmanager/ModalFrame";
import ViewToggle from "@/components/common/ViewToggle";
import MonthTile from "@/components/common/MonthTile";
import PriorityBadge from "@/components/taskmanager/PriorityBadge";
import Button from "@/components/common/Button";
import { getPriorityColor } from "@/components/taskmanager/helpers";
import {
  byPriority,
  completedByMonths,
  formatShortDate,
  sortByCompletedDesc,
  trunc,
} from "./helpers";

interface CompletedEducationsModalProps {
  educations: Education[];
  certificates: Certificate[]; // kept for prop signature compatibility if needed, but unused in this layout
  onClose: () => void;
  onSelectEducation: (education: Education) => void;
  onReopenEducation: (education: Education) => void;
}

const EDUCATION_VIEW_OPTIONS: readonly ViewToggleOption<EducationViewMode>[] = [
  { value: "months", label: "Months" },
  { value: "priority", label: "Priority" },
];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function CompletedEducationsModal({
  educations,
  onClose,
  onSelectEducation,
  onReopenEducation,
}: CompletedEducationsModalProps) {
  const [view, setView] = useState<EducationViewMode>("months");

  const now = new Date();
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth();

  const priorityGroups = byPriority(educations.map((edu) => ({ ...edu })));
  const monthGroups = completedByMonths(educations, nowYear);

  return (
    <ModalFrame title="Completed Educations" onClose={onClose}>
      <div className="mb-3">
        <ViewToggle
          value={view}
          onChange={setView}
          options={EDUCATION_VIEW_OPTIONS}
          ariaLabel="Education view toggle"
        />
      </div>

      <div className="max-h-[65vh] space-y-3 overflow-y-auto rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
        {educations.length === 0 && (
          <div className="text-sm text-zinc-500 dark:text-zinc-400">None</div>
        )}

        {view === "priority" &&
          PRIORITIES.map((priority) => {
            const group = [...priorityGroups[priority]].sort(sortByCompletedDesc);
            if (group.length === 0) return null;
            const colors = getPriorityColor(priority);

            return (
              <section
                key={priority}
                className={`rounded-lg border ${colors.border} ${colors.bg} p-2`}
              >
                <h3 className="mb-2">
                  <PriorityBadge priority={priority} />
                </h3>
                <div className="space-y-2">
                  {group.map((edu) => (
                    <div
                      key={edu.id}
                      className={`grid w-full grid-cols-12 items-center gap-2 rounded-md border border-zinc-200 px-2 py-1.5 text-left text-sm dark:border-zinc-700 border-l-[3px] ${colors.border}`}
                    >
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
                    </div>
                  ))}
                </div>
              </section>
            );
          })}

        {view === "months" &&
          monthGroups.map((group, index) => {
            const isCurrentMonth = MONTH_NAMES[nowMonth] === group.label;
            return (
              <MonthTile
                key={group.label}
                title={group.label}
                defaultExpanded={index === 0}
                accent
                className="text-sm"
                highlight={isCurrentMonth}
              >
                <div className="space-y-2">
                  {group.educations.map((edu) => {
                    const colors = edu.priority ? getPriorityColor(edu.priority) : { border: "border-zinc-200", bg: "" };
                    return (
                      <div
                        key={edu.id}
                        className={`grid w-full grid-cols-12 items-center gap-2 rounded-md border border-zinc-200 px-2 py-1.5 text-left text-sm dark:border-zinc-700 border-l-[3px] ${colors.border}`}
                      >
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
                      </div>
                    );
                  })}
                </div>
              </MonthTile>
            );
          })}
      </div>
    </ModalFrame>
  );
}
