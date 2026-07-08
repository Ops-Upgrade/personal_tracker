"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { Certificate } from "@/types/education";
import { downloadCertificateFile } from "@/api/education";

function ArrowDownTrayIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}

function DocumentIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  );
}

function PhotoIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.41a2.25 2.25 0 0 1 3.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
  );
}

function LinkIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
    </svg>
  );
}

function ArrowPathIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m-8.331-8.331a.75.75 0 0 1 1.06 0l4.242 4.242a.75.75 0 0 1 0 1.06l-4.242 4.242a.75.75 0 0 1-1.06-1.06l2.97-2.97H5.25a.75.75 0 0 1 0-1.5h8.19l-2.97-2.97a.75.75 0 0 1 0-1.06Z" />
    </svg>
  );
}

function NoSymbolIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
  );
}

export interface DocPreviewPanelProps {
  cert?: Certificate | null;
  file?: File | null;
  userId?: string;
  onDownload?: () => void;
  isDownloading?: boolean;
  currentIndex?: number;
  totalCerts?: number;
  onPrev?: () => void;
  onNext?: () => void;
}

export default function DocPreviewPanel({
  cert,
  file,
  userId,
  onDownload,
  isDownloading,
  currentIndex,
  totalCerts,
  onPrev,
  onNext
}: DocPreviewPanelProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Handle local File preview immediately
  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setBlobUrl(url);
      setLoadError(null);
      setIsLoading(false);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  // Reset when remote cert changes
  useEffect(() => {
    if (cert) {
      setBlobUrl(null);
      setLoadError(null);
      setIsLoading(false);
    }
  }, [cert]);

  const handleLoadPreview = async () => {
    if (!cert || !userId || !cert.file_name || !cert.file_iv) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const blob = await downloadCertificateFile(userId, cert.file_name, cert.file_iv, cert.file_mime);
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Failed to decrypt document.");
    } finally {
      setIsLoading(false);
    }
  };

  const mimeType = file ? file.type : (cert?.file_mime || "");
  const isPdf = mimeType === "application/pdf";
  const isImage = mimeType.startsWith("image/");
  const FileIcon = isPdf ? DocumentIcon : isImage ? PhotoIcon : LinkIcon;

  const titleText = file ? file.name : (cert?.label || "Preview");
  const showNav = currentIndex !== undefined && totalCerts !== undefined && totalCerts > 0;

  return (
    <div className="flex flex-col h-full max-h-[80vh]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        {/* Navigation */}
        {showNav && onPrev && onNext && (
          <>
            <button 
              type="button" 
              disabled={currentIndex === 0}
              onClick={onPrev}
              className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 tabular-nums">
              {currentIndex + 1} / {totalCerts}
            </span>
            <button 
              type="button" 
              disabled={currentIndex === totalCerts - 1}
              onClick={onNext}
              className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </>
        )}

        <span className="flex-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 truncate min-w-0 pl-2">
          {titleText}
        </span>

        {onDownload && (
          <button
            type="button"
            onClick={onDownload}
            disabled={isDownloading || (!cert && !file)}
            className="cursor-pointer p-1 rounded-md text-zinc-400 hover:text-amber-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40"
            title="Download document"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4">
        {!blobUrl && !isLoading && !loadError && cert && !file && (
          <button
            type="button"
            onClick={handleLoadPreview}
            className="cursor-pointer flex flex-col items-center gap-2 text-zinc-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 transition-colors"
          >
            <FileIcon className="h-10 w-10" />
            <span className="text-sm font-medium">Click to load preview</span>
            <span className="text-xs text-zinc-400">
              File is encrypted — decrypt on demand
            </span>
          </button>
        )}

        {isLoading && (
          <div className="flex flex-col items-center gap-3 text-zinc-400">
            <ArrowPathIcon className="h-8 w-8 animate-spin" />
            <span className="text-sm">Decrypting document...</span>
          </div>
        )}

        {loadError && (
          <div className="flex flex-col items-center gap-3 text-red-400">
            <NoSymbolIcon className="h-8 w-8" />
            <span className="text-sm text-center">{loadError}</span>
          </div>
        )}

        {blobUrl && isPdf && (
          <iframe
            src={blobUrl}
            className="w-full h-full min-h-[400px] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white"
            title="Document PDF Preview"
          />
        )}

        {blobUrl && isImage && (
          <div className="relative w-full h-full min-h-[200px]">
            <Image
              src={blobUrl}
              alt="Document preview"
              fill
              unoptimized
              className="object-contain rounded-lg"
            />
          </div>
        )}

        {blobUrl && !isPdf && !isImage && (
          <div className="flex flex-col items-center gap-3 text-zinc-400">
            <DocumentIcon className="h-8 w-8" />
            <span className="text-sm">Preview not available for this file type.</span>
          </div>
        )}
      </div>
    </div>
  );
}
