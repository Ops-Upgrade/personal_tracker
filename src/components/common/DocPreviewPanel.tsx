"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  DocumentIcon,
  ArrowPathIcon,
  NoSymbolIcon,
} from "@/components/common/Icons";

export interface DocPreviewPanelProps {
  /** Local File object for instant preview (takes precedence) */
  file?: File | null;
  /** Remote encrypted file metadata */
  existingFileName?: string | null;
  existingMime?: string | null;
  existingIv?: string | null;
  /** Called when user clicks "load preview" for remote encrypted files */
  onLoadPreview?: () => Promise<Blob>;
}

/**
 * Stripped-down document preview panel.
 * No header, no navigation, no download button — those live in the parent (GlobalActionModal).
 * Uses strict height containment: h-full w-full overflow-hidden so a loaded PDF
 * never stretches the modal beyond the form panel's height.
 */
export default function DocPreviewPanel({
  file,
  existingFileName,
  existingMime,
  existingIv,
  onLoadPreview,
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

  // Reset when remote metadata changes
  useEffect(() => {
    if (existingFileName) {
      setBlobUrl(null);
      setLoadError(null);
      setIsLoading(false);
    }
  }, [existingFileName]);

  const handleLoadPreview = async () => {
    if (!onLoadPreview) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const blob = await onLoadPreview();
      const url = URL.createObjectURL(blob);
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      setBlobUrl(url);
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Failed to decrypt document.");
    } finally {
      setIsLoading(false);
    }
  };

  const mimeType = file ? file.type : (existingMime || "");
  const isPdf = mimeType === "application/pdf";
  const isImage = mimeType.startsWith("image/");

  const hasRemoteFile = Boolean(existingFileName && existingIv && onLoadPreview);

  return (
    <div className="flex items-center justify-center h-full w-full overflow-hidden p-4">
      {/* Remote encrypted file — click to load */}
      {!blobUrl && !isLoading && !loadError && hasRemoteFile && !file && (
        <button
          type="button"
          onClick={handleLoadPreview}
          className="cursor-pointer flex flex-col items-center gap-2 text-zinc-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 transition-colors"
        >
          <DocumentIcon className="h-10 w-10" />
          <span className="text-sm font-medium">Click to load preview</span>
          <span className="text-xs text-zinc-400">
            File is encrypted — decrypt on demand
          </span>
        </button>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col items-center gap-3 text-zinc-400">
          <ArrowPathIcon className="h-8 w-8 animate-spin" />
          <span className="text-sm">Decrypting document...</span>
        </div>
      )}

      {/* Error */}
      {loadError && (
        <div className="flex flex-col items-center gap-3 text-red-400">
          <NoSymbolIcon className="h-8 w-8" />
          <span className="text-sm text-center">{loadError}</span>
        </div>
      )}

      {/* PDF preview — no min-height; contained by parent overflow-hidden */}
      {blobUrl && isPdf && (
        <iframe
          src={blobUrl}
          className="w-full h-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white"
          title="Document PDF Preview"
        />
      )}

      {/* Image preview */}
      {blobUrl && isImage && (
        <div className="relative w-full h-full">
          <Image
            src={blobUrl}
            alt="Document preview"
            fill
            unoptimized
            className="object-contain rounded-lg"
          />
        </div>
      )}

      {/* Unsupported type */}
      {blobUrl && !isPdf && !isImage && (
        <div className="flex flex-col items-center gap-3 text-zinc-400">
          <DocumentIcon className="h-8 w-8" />
          <span className="text-sm">Preview not available for this file type.</span>
        </div>
      )}
    </div>
  );
}
