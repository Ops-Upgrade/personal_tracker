"use client";

import type { Certificate, Education } from "@/types/education";
import Button from "@/components/common/Button";
import BoxContainer, { SCROLLABLE_CLASSES } from "@/components/common/BoxContainer";
import { fileTypeLabel, sortByCreatedAtDesc, trunc } from "./helpers";

interface CertificateStoreBoxProps {
  certificates: Certificate[];
  educations: Education[];
  isLoading: boolean;
  onAdd: () => void;
  onOpenExpanded: () => void;
  onSelectCertificate: (certificate: Certificate) => void;
}

export default function CertificateStoreBox({
  certificates,
  educations,
  isLoading,
  onAdd,
  onOpenExpanded,
  onSelectCertificate,
}: CertificateStoreBoxProps) {
  const sorted = [...certificates].sort(sortByCreatedAtDesc);

  /** Find the education name for a linked certificate */
  function linkedEducationName(educationId: string): string {
    if (!educationId) return "";
    const edu = educations.find((e) => e.id === educationId);
    return edu ? edu.name : "";
  }

  return (
    <BoxContainer>
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Certificate Store
          </h2>
          <Button
            variant="secondary"
            size="md"
            onClick={onAdd}
            disabled={isLoading}
          >
            + Upload
          </Button>
        </div>
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
          sorted.map((cert) => {
            const eduName = linkedEducationName(cert.education_id);
            return (
              <button
                key={cert.id}
                type="button"
                onClick={() => onSelectCertificate(cert)}
                className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                {/* File type badge */}
                <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {fileTypeLabel(cert.file_mime)}
                </span>
                {/* Label */}
                <span className="flex-1 font-medium text-zinc-700 dark:text-zinc-300">
                  {trunc(cert.label, 40)}
                </span>
                {/* Linked education */}
                {eduName && (
                  <span className="shrink-0 text-[10px] text-zinc-500 dark:text-zinc-500">
                    {trunc(eduName, 20)}
                  </span>
                )}
              </button>
            );
          })}
      </div>
    </BoxContainer>
  );
}
