"use client";

import { useMemo } from "react";
import type { Education } from "@/types/education";
import type { Document } from "@/types/document";
import GenericCompletedBox from "@/components/common/GenericCompletedBox";
import PriorityBadge from "@/components/common/PriorityBadge";
import { PaperClipIcon } from "@/components/common/Icons";
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
    <div className="grid grid-cols-12 gap-2 px-2 pb-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700">
      <div className="col-span-3 min-w-0 truncate">Program Name</div>
      <div className="col-span-3 min-w-0 truncate">Provider</div>
      <div className="col-span-1 text-center">Priority</div>
      <div className="col-span-3">Date</div>
      <div className="col-span-2 text-right">Files</div>
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
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onSelectEducation(edu); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelectEducation(edu); } }}
            className="grid grid-cols-12 items-center gap-2 rounded-md border border-zinc-200 px-2 py-1.5 text-sm cursor-pointer dark:border-zinc-700"
          >
            <span className="col-span-3 min-w-0 truncate font-semibold text-zinc-800 dark:text-zinc-100">
              {trunc(edu.name, 24)}
            </span>
            <div className="col-span-3 min-w-0 truncate text-zinc-600 dark:text-zinc-300">
              {trunc(edu.provider, 20)}
            </div>
            <div className="col-span-1 flex items-center justify-center">
              {edu.priority ? <PriorityBadge priority={edu.priority} /> : "-"}
            </div>
            <div className="col-span-3 shrink-0 whitespace-nowrap text-zinc-600 dark:text-zinc-300">
              {formatShortDate(edu.completed_at)}
            </div>
            <div className="col-span-2 text-right">
              {docCount > 0 ? (
                <span className="inline-flex items-center justify-center gap-1 text-amber-500" title={`${docCount} document(s) attached`}>
                  <PaperClipIcon className="h-4 w-4" />
                  <span className="text-zinc-600 dark:text-zinc-300">({docCount})</span>
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
