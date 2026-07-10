"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthBootstrap } from "@/lib/useAuthBootstrap";
import { fetchEducations } from "@/api/education";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { ROUTES } from "@/routes/paths";
import type { Education, EducationViewMode } from "@/types/education";
import type { Priority } from "@/types/taskmanager";
import { PRIORITIES } from "@/types/taskmanager";
import type { ViewToggleOption } from "@/components/common/ViewToggle";
import ViewToggle from "@/components/common/ViewToggle";
import MonthTile from "@/components/common/MonthTile";
import BoxContainer, { SCROLLABLE_CLASSES } from "@/components/common/BoxContainer";
import PageShell from "@/components/common/PageShell";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import PriorityBadge from "@/components/taskmanager/PriorityBadge";
import { getPriorityColor } from "@/lib/priorityColors";
import {
  byPriority,
  completedByMonths,
  sortByCompletedDesc,
  formatShortDate,
  trunc,
} from "@/components/education/helpers";
import { MONTH_NAMES } from "@/lib/constants";

const VIEW_OPTIONS: readonly ViewToggleOption<EducationViewMode>[] = [
  { value: "months", label: "Months" },
  { value: "priority", label: "Priority" },
];

export default function CompletedEducationsPage() {
  const router = useRouter();
  const [educations, setEducations] = useState<Education[]>([]);

  const loadData = useCallback(async (uid: string) => {
    const rows = await fetchEducations(uid);
    setEducations(rows);
  }, []);

  const { userId, nowYear, nowMonth, isLoading, error, refreshData } =
    useAuthBootstrap({ loadData, fetchServerDate: false });

  const [view, setView] = useLocalStorage<EducationViewMode>("educationCompletedView", "months");

  const completedEducations = useMemo(
    () => educations.filter((e) => e.is_completed),
    [educations]
  );

  const priorityGroups = byPriority(completedEducations);
  const monthGroups = completedByMonths(completedEducations, nowYear);

  const handleEditEducation = (eduId: string) => {
    router.push(`${ROUTES.EDUCATION}#edit-education-${eduId}`);
  };

  return (
    <PageShell
      backHref={ROUTES.EDUCATION}
      backLabel="← Back to Education"
      title="Completed Educations"
      description="All your completed courses and certifications."
      error={error}
      onRetry={() => userId && refreshData(userId)}
    >
      {isLoading && <LoadingSpinner />}

      {!isLoading && (
        <BoxContainer>
          <header className="mb-3">
            <ViewToggle
              value={view}
              onChange={setView}
              options={VIEW_OPTIONS}
              ariaLabel="Completed educations view toggle"
            />
          </header>

          <div className={`${SCROLLABLE_CLASSES} space-y-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800`}>
            {completedEducations.length === 0 && (
              <div className="text-sm text-zinc-500 dark:text-zinc-400">None</div>
            )}

            {view === "priority" &&
              PRIORITIES.map((priority) => {
                const group = [...(priorityGroups[priority as Priority] ?? [])].sort(sortByCompletedDesc);
                if (group.length === 0) return null;
                const colors = getPriorityColor(priority as Priority);
                return (
                  <section
                    key={priority}
                    className={`rounded-lg border ${colors.border} ${colors.bg} p-2`}
                  >
                    <h3 className="mb-2">
                      <PriorityBadge priority={priority as Priority} />
                    </h3>
                    <div className="space-y-2">
                      {group.map((edu) => (
                        <div
                          key={edu.id}
                          className={`grid w-full grid-cols-12 items-center gap-2 rounded-md border border-zinc-200 px-2 py-1.5 text-left text-sm dark:border-zinc-700 border-l-[3px] ${colors.border}`}
                        >
                          <button
                            type="button"
                            onClick={() => handleEditEducation(edu.id)}
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
                      {group.items.map((edu) => {
                        const colors = getPriorityColor((edu as Education).priority);
                        return (
                          <div
                            key={edu.id}
                            className={`grid w-full grid-cols-12 items-center gap-2 rounded-md border border-zinc-200 px-2 py-1.5 text-left text-sm dark:border-zinc-700 border-l-[3px] ${colors.border}`}
                          >
                            <button
                              type="button"
                              onClick={() => handleEditEducation(edu.id)}
                              className="col-span-7 cursor-pointer text-left font-semibold text-zinc-800 hover:text-zinc-900 dark:text-zinc-100 dark:hover:text-white"
                            >
                              {trunc(edu.name, 42)}
                            </button>
                            <span className="col-span-2">
                              {(edu as Education).priority ? (
                                <PriorityBadge priority={(edu as Education).priority} />
                              ) : (
                                "-"
                              )}
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
        </BoxContainer>
      )}
    </PageShell>
  );
}
