"use client";

import type { Education, EducationViewMode } from "@/types/education";
import { PRIORITIES } from "@/types/taskmanager";
import ViewToggle from "@/components/common/ViewToggle";
import type { ViewToggleOption } from "@/components/common/ViewToggle";
import MonthTile from "@/components/common/MonthTile";
import Button from "@/components/common/Button";
import BoxContainer, { SCROLLABLE_CLASSES } from "@/components/common/BoxContainer";
import PriorityBadge from "@/components/taskmanager/PriorityBadge";
import { getPriorityColor } from "@/components/taskmanager/helpers";
import { activeByMonths, byPriority, trunc } from "./helpers";

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

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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
  const priorityGroups = byPriority(educations);
  const monthGroups = activeByMonths(educations, nowYear);

  return (
    <BoxContainer className="lg:col-span-2">
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Active Educations
          </h2>
          <ViewToggle
            value={view}
            onChange={onViewChange}
            options={EDUCATION_VIEW_OPTIONS}
            ariaLabel="Education view toggle"
          />
        </div>
        <Button
          variant="secondary"
          size="md"
          onClick={onAdd}
          disabled={isLoading}
        >
          + Add
        </Button>
      </header>

      <div className={`${SCROLLABLE_CLASSES} space-y-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800`}>
        {isLoading && (
          <div className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</div>
        )}
        {!isLoading && educations.length === 0 && (
          <div className="text-sm text-zinc-500 dark:text-zinc-400">None</div>
        )}

        {!isLoading &&
          view === "priority" &&
          PRIORITIES.map((priority) => {
            const group = priorityGroups[priority];
            const colors = getPriorityColor(priority);

            return (
              <section
                key={priority}
                className={`rounded-lg border ${colors.border} ${colors.bg} p-2`}
              >
                <h3 className="mb-2">
                  <PriorityBadge priority={priority} />
                </h3>
                {group.length === 0 && (
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">None</div>
                )}
                <div className="space-y-2">
                  {group.map((edu) => (
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
                        <span className="text-zinc-600 dark:text-zinc-300 sm:col-span-2">
                          <span className="mr-1 inline sm:hidden">Due:</span>
                          {dueDisplay(edu.due_date)}
                        </span>
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
                  ))}
                </div>
              </section>
            );
          })}

        {!isLoading &&
          view === "months" &&
          monthGroups.map((group) => {
            const isCurrentMonth = MONTH_NAMES[nowMonth] === group.label;
            return (
              <MonthTile
                key={group.label}
                title={group.label}
                defaultExpanded={isCurrentMonth}
                accent={group.educations.length > 0}
                className="text-sm"
                highlight={isCurrentMonth}
              >
                {group.educations.length === 0 ? (
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">None</div>
                ) : (
                  <div className="space-y-2">
                    {group.educations.map((edu) => {
                      const colors = edu.priority ? getPriorityColor(edu.priority) : { border: "border-zinc-200" };
                      return (
                        <div
                          key={edu.id}
                          className={`group flex items-center justify-between gap-2 rounded-md border border-zinc-200 border-l-[3px] px-2 py-1.5 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/60 ${colors.border}`}
                        >
                          <button
                            type="button"
                            onClick={() => onSelectEducation(edu)}
                            className="grid flex-1 cursor-pointer gap-2 text-left text-sm sm:grid-cols-12"
                          >
                            <span className="font-semibold text-zinc-800 dark:text-zinc-100 sm:col-span-3">
                              {trunc(edu.name, 34)}
                            </span>
                            <span className="text-zinc-600 dark:text-zinc-300 sm:col-span-2">
                              <span className="mr-1 inline sm:hidden">Provider:</span>
                              {trunc(edu.provider, 24)}
                            </span>
                            <span className="text-zinc-600 dark:text-zinc-300 sm:col-span-2">
                              <span className="mr-1 inline sm:hidden">Priority:</span>
                              {edu.priority ? <PriorityBadge priority={edu.priority} /> : "-"}
                            </span>
                            <span className="text-zinc-600 dark:text-zinc-300 sm:col-span-2">
                              <span className="mr-1 inline sm:hidden">Due:</span>
                              {dueDisplay(edu.due_date)}
                            </span>
                            <span className="text-zinc-700 dark:text-zinc-200 sm:col-span-3">
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
                    })}
                  </div>
                )}
              </MonthTile>
            );
          })}
      </div>
    </BoxContainer>
  );
}
