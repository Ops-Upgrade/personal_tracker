"use client";

import type { Education, Certificate } from "@/types/education";
import Button from "@/components/common/Button";
import BoxContainer, { SCROLLABLE_CLASSES } from "@/components/common/BoxContainer";
import { getPriorityColor } from "@/components/taskmanager/helpers";
import { certCountForEducation, formatShortDate, sortByCompletedDesc, trunc } from "./helpers";

interface CompletedEducationsBoxProps {
  educations: Education[];
  certificates: Certificate[];
  isLoading: boolean;
  onOpenExpanded: () => void;
  onSelectEducation: (education: Education) => void;
  onReopenEducation: (education: Education) => void;
}

export default function CompletedEducationsBox({
  educations,
  certificates,
  isLoading,
  onOpenExpanded,
  onSelectEducation,
  onReopenEducation,
}: CompletedEducationsBoxProps) {
  const sorted = [...educations].sort(sortByCompletedDesc);

  return (
    <BoxContainer>
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Completed
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenExpanded}
          disabled={isLoading}
        >
          View all
        </Button>
      </header>
      <div className={`${SCROLLABLE_CLASSES} space-y-1 rounded-lg border border-zinc-200 p-2 dark:border-zinc-800`}>
        {isLoading && (
          <div className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</div>
        )}
        {!isLoading && sorted.length === 0 && (
          <div className="text-sm text-zinc-500 dark:text-zinc-400">None</div>
        )}
        {!isLoading &&
          sorted.map((edu) => {
            const certCount = certCountForEducation(edu.id, certificates);
            const colors = edu.priority ? getPriorityColor(edu.priority) : { dot: "bg-zinc-400" };
            return (
              <div
                key={edu.id}
                className="grid grid-cols-12 items-center gap-2 rounded-md border border-zinc-200 px-2 py-1.5 text-sm dark:border-zinc-700"
              >
                {/* Priority dot */}
                <span
                  className={`col-span-1 inline-block h-2 w-2 rounded-full ${colors.dot}`}
                  aria-hidden="true"
                />
                <button
                  type="button"
                  onClick={() => onSelectEducation(edu)}
                  className="col-span-4 cursor-pointer text-left font-semibold text-zinc-800 hover:text-zinc-900 dark:text-zinc-100 dark:hover:text-white"
                >
                  {trunc(edu.name, 30)}
                </button>
                <div className="col-span-2 text-zinc-600 dark:text-zinc-300">
                  {formatShortDate(edu.completed_at)}
                </div>
                {/* Certificate count badge */}
                <div className="col-span-2 text-center">
                  {certCount > 0 && (
                    <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                      {certCount} cert{certCount !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => onReopenEducation(edu)}
                  className="col-span-3 text-right"
                >
                  Reopen
                </Button>
              </div>
            );
          })}
      </div>
    </BoxContainer>
  );
}
