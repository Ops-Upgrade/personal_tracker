"use client";

import { useMemo } from "react";
import type { Education } from "@/types/education";
import type { Document } from "@/types/document";
import GenericCompletedBox from "@/components/common/GenericCompletedBox";
import { getPriorityColor } from "@/lib/priorityColors";
import { formatShortDate, sortByCompletedDesc, trunc } from "./helpers";

interface CompletedEducationsBoxProps {
  educations: Education[];
  documents: Document[];
  isLoading: boolean;
  onOpenExpanded: () => void;
  onSelectEducation: (education: Education) => void;
}

export default function CompletedEducationsBox({
  educations,
  documents,
  isLoading,
  onOpenExpanded,
  onSelectEducation,
}: CompletedEducationsBoxProps) {
  const sorted = [...educations].sort(sortByCompletedDesc);

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
    <GenericCompletedBox
      items={sorted}
      isLoading={isLoading}
      onOpenExpanded={onOpenExpanded}
      renderItem={(edu) => {
        const docCount = docCountsByEdu.get(edu.id) ?? 0;
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
            {/* Document count badge */}
            <div className="col-span-2 text-right">
              {docCount > 0 && (
                <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                  {docCount} file{docCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        );
      }}
    />
  );
}
