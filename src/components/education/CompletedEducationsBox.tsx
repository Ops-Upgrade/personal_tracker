"use client";

import { useMemo } from "react";
import type { Education } from "@/types/education";
import type { Document } from "@/types/document";
import GenericCompletedBox from "@/components/common/GenericCompletedBox";
import PriorityBadge from "@/components/common/PriorityBadge";
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

  const listHeader = (
    <div className="grid grid-cols-12 px-2 pb-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700">
      <div className="col-span-4">Program Name</div>
      <div className="col-span-3">Provider</div>
      <div className="col-span-2">Priority</div>
      <div className="col-span-2">Date</div>
      <div className="col-span-1 text-right">Files</div>
    </div>
  );

  return (
    <GenericCompletedBox
      items={sorted}
      isLoading={isLoading}
      onOpenExpanded={onOpenExpanded}
      listHeader={listHeader}
      renderItem={(edu) => {
        const docCount = docCountsByEdu.get(edu.id) ?? 0;
        return (
          <div
            key={edu.id}
            className="grid grid-cols-12 items-center gap-2 rounded-md border border-zinc-200 px-2 py-1.5 text-sm dark:border-zinc-700"
          >
            <button
              type="button"
              onClick={() => onSelectEducation(edu)}
              className="col-span-4 cursor-pointer text-left font-semibold text-zinc-800 hover:text-zinc-900 dark:text-zinc-100 dark:hover:text-white"
            >
              {trunc(edu.name, 24)}
            </button>
            <div className="col-span-3 text-zinc-600 dark:text-zinc-300">
              {trunc(edu.provider, 20)}
            </div>
            <div className="col-span-2 flex items-center">
              {edu.priority ? <PriorityBadge priority={edu.priority} /> : "-"}
            </div>
            <div className="col-span-2 text-zinc-600 dark:text-zinc-300">
              {formatShortDate(edu.completed_at)}
            </div>
            <div className="col-span-1 text-right">
              {docCount > 0 ? (
                <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                  {docCount}
                </span>
              ) : (
                <span className="text-xs text-zinc-400">—</span>
              )}
            </div>
          </div>
        );
      }}
    />
  );
}
