"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { Certificate, Education } from "@/types/education";
import ModalFrame from "@/components/taskmanager/ModalFrame";
import { fileTypeLabel, sortByCreatedAtDesc } from "./helpers";
import { downloadCertificateFile } from "@/api/education";

interface CertificateStoreModalProps {
  certificates: Certificate[];
  educations: Education[];
  userId: string;
  onClose: () => void;
  onSelectCertificate: (certificate: Certificate) => void;
}

// --- Icons ---
function PdfIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  );
}

function ImageIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.41a2.25 2.25 0 0 1 3.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
  );
}

function GenericFileIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  );
}

function MiniPreview({ cert, userId }: { cert: Certificate; userId: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    if (!cert.file_name || !cert.file_iv) return;

    downloadCertificateFile(userId, cert.file_name, cert.file_iv, cert.file_mime)
      .then((blob) => {
        if (!active) return;
        setBlobUrl(URL.createObjectURL(blob));
      })
      .catch(() => {
        if (!active) return;
        setError(true);
      });

    return () => {
      active = false;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cert, userId]);

  const mimeType = cert.file_mime || "";
  const isPdf = mimeType === "application/pdf";
  const isImage = mimeType.startsWith("image/");

  if (error || !blobUrl) {
    // Show placeholder if loading or error
    return (
      <div className="flex h-full w-full items-center justify-center">
        {isPdf ? (
          <PdfIcon className="h-12 w-12 text-rose-500/30" />
        ) : isImage ? (
          <ImageIcon className="h-12 w-12 text-emerald-500/30" />
        ) : (
          <GenericFileIcon className="h-12 w-12 text-blue-500/30" />
        )}
      </div>
    );
  }

  if (isImage) {
    return (
      <Image
        src={blobUrl}
        alt={cert.label}
        fill
        unoptimized
        className="object-cover" 
      />
    );
  }

  if (isPdf) {
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-2.5rem] left-0 w-full h-[calc(100%+2.5rem)]">
          <iframe
            src={`${blobUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
            className="w-[200%] h-[200%] origin-top-left scale-50 border-none bg-white"
            title="PDF Preview"
            scrolling="no"
            tabIndex={-1}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center">
      <GenericFileIcon className="h-12 w-12 text-blue-500/50" />
    </div>
  );
}

export default function CertificateStoreModal({
  certificates,
  educations,
  userId,
  onClose,
  onSelectCertificate,
}: CertificateStoreModalProps) {
  const sorted = [...certificates].sort(sortByCreatedAtDesc);

  /** Find the education name for a linked certificate */
  function linkedEducationName(educationId: string): string {
    if (!educationId) return "";
    const edu = educations.find((e) => e.id === educationId);
    return edu ? edu.name : "";
  }

  return (
    <ModalFrame title="Certificate Store" onClose={onClose} maxWidthClassName="max-w-5xl">
      <div className="max-h-[70vh] overflow-y-auto p-1">
        {sorted.length === 0 && (
          <div className="text-sm text-zinc-500 dark:text-zinc-400">No certificates uploaded yet.</div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {sorted.map((cert) => {
            const eduName = linkedEducationName(cert.education_id);
            const mimeType = cert.file_mime || "";
            const isPdf = mimeType === "application/pdf";
            const isImage = mimeType.startsWith("image/");

            return (
              <button
                key={cert.id}
                type="button"
                onClick={() => onSelectCertificate(cert)}
                className="group flex flex-col cursor-pointer overflow-hidden rounded-lg border border-zinc-200 bg-white transition-all hover:border-emerald-400 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-emerald-600 text-left"
              >
                {/* Top: Actual Thumbnail Preview */}
                <div className="relative flex h-32 w-full items-center justify-center bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800 group-hover:bg-zinc-100 dark:group-hover:bg-zinc-800 transition-colors overflow-hidden">
                  <MiniPreview cert={cert} userId={userId} />
                </div>
                
                {/* Bottom: Details */}
                <div className="flex flex-col p-3 w-full">
                  <span className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200" title={cert.label}>
                    {cert.label}
                  </span>
                  <div className="mt-1.5 flex flex-col gap-1.5">
                    <span className="truncate text-xs text-zinc-500" title={eduName}>
                      {eduName || "No course"}
                    </span>
                    <span className="self-start rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {fileTypeLabel(mimeType)}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </ModalFrame>
  );
}
