"use client";

import { useMemo } from "react";
import type { Education } from "@/types/education";
import type { Document } from "@/types/document";
import type { ColumnDef } from "@/components/common/GenericViewPage";
import GenericCompletedBox from "@/components/common/GenericCompletedBox";
import { EDU_PRIORITY } from "./config";
import { colDate, colFiles } from "@/components/common/columns";
import { sortByCompletedDesc } from "./helpers";

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

  // Fixed tracks size themselves to content; flex tracks share the rest.
  const columns: ColumnDef<Education>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Program Name",
        sizing: "flex",
        weight: 2,
        render: (edu) => (
          <span className="font-semibold text-zinc-800 dark:text-zinc-100">
            {edu.name}
          </span>
        ),
      },
      {
        key: "provider",
        header: "Provider",
        sizing: "flex",
        weight: 1,
        render: (edu) => (
          <span className="text-zinc-600 dark:text-zinc-300">
            {edu.provider}
          </span>
        ),
      },
      EDU_PRIORITY,
      colDate<Education>({
        key: "date",
        header: "Date",
        accessor: (edu) => edu.completed_at,
      }),
      colFiles<Education>(
        {
          getCount: (edu) => docCountsByEdu.get(edu.id) ?? 0,
          iconColorClass: "text-amber-500",
        },
        { align: "right" },
      ),
    ],
    [docCountsByEdu],
  );

  return (
    <GenericCompletedBox
      items={sorted}
      isLoading={isLoading}
      onOpenExpanded={onOpenExpanded}
      columns={columns}
      onRowClick={onSelectEducation}
    />
  );
}
