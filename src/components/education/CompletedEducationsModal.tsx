"use client";

import type { Education } from "@/types/education";
import type { Document } from "@/types/document";
import ModalFrame from "@/components/common/ModalFrame";
import EducationTable from "./EducationTable";

interface CompletedEducationsModalProps {
  educations: Education[];
  documents: Document[];
  onClose: () => void;
  onSelectEducation: (education: Education) => void;
}

/**
 * Full-screen modal for "View All" completed educations.
 * Renders the sortable EducationTable with all columns.
 */
export default function CompletedEducationsModal({
  educations,
  documents,
  onClose,
  onSelectEducation,
}: CompletedEducationsModalProps) {
  return (
    <ModalFrame title="Completed Educations" onClose={onClose}>
      <div className="max-h-[65vh] overflow-y-auto rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
        <EducationTable
          educations={educations}
          documents={documents}
          onSelectEducation={onSelectEducation}
        />
      </div>
    </ModalFrame>
  );
}
