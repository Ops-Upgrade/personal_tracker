"use client";

import type { Education, Certificate } from "@/types/education";
import GenericCompletedBox from "@/components/common/GenericCompletedBox";
import { getPriorityColor } from "@/lib/priorityColors";
import { certCountForEducation, formatShortDate, sortByCompletedDesc, trunc } from "./helpers";

interface CompletedEducationsBoxProps {
  educations: Education[];
  certificates: Certificate[];
  isLoading: boolean;
  onOpenExpanded: () => void;
  onSelectEducation: (education: Education) => void;
}

export default function CompletedEducationsBox({
  educations,
  certificates,
  isLoading,
  onOpenExpanded,
  onSelectEducation,
}: CompletedEducationsBoxProps) {
  const sorted = [...educations].sort(sortByCompletedDesc);

  return (
    <GenericCompletedBox
      items={sorted}
      isLoading={isLoading}
      onOpenExpanded={onOpenExpanded}
      renderItem={(edu) => {
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
              className="col-span-6 cursor-pointer text-left font-semibold text-zinc-800 hover:text-zinc-900 dark:text-zinc-100 dark:hover:text-white"
            >
              {trunc(edu.name, 30)}
            </button>
            <div className="col-span-3 text-zinc-600 dark:text-zinc-300">
              {formatShortDate(edu.completed_at)}
            </div>
            {/* Certificate count badge */}
            <div className="col-span-2 text-right">
              {certCount > 0 && (
                <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                  {certCount} cert{certCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        );
      }}
    />
  );
}
