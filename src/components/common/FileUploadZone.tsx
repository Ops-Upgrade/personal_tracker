"use client";

import type { ChangeEvent } from "react";
import { ArrowDownTrayIcon, ShieldExclamationIcon } from "./Icons";

export interface FileUploadZoneProps {
  disabled?: boolean;
  accept: string;
  file: File | null;
  hasExistingFile: boolean;
  onFileSelect: (file: File) => void;
  onFileClear: () => void;
  label?: string;
  showEncryptedNotice?: boolean;
  /** Allow selecting multiple files at once. Calls onFileSelect once per file. */
  multiple?: boolean;
}

export default function FileUploadZone({
  disabled = false,
  accept,
  onFileSelect,
  label,
  showEncryptedNotice = true,
  multiple = false,
}: FileUploadZoneProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;
    if (multiple) {
      for (let i = 0; i < selectedFiles.length; i++) {
        onFileSelect(selectedFiles[i]);
      }
    } else {
      onFileSelect(selectedFiles[0]);
    }
    // Reset input so same files can be re-selected
    e.target.value = "";
  };

  return (
    <div className="space-y-2">
      {label && (
        <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
          {label}
        </span>
      )}
      <label
        className={`flex flex-col items-center justify-center gap-1 p-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
          disabled
            ? "opacity-50 pointer-events-none border-zinc-300 dark:border-zinc-700"
            : "border-zinc-300 hover:border-emerald-500 hover:bg-emerald-50 dark:border-zinc-700 dark:hover:border-emerald-600 dark:hover:bg-emerald-900/10"
        }`}
      >
        <input type="file" accept={accept} onChange={handleChange} disabled={disabled} multiple={multiple} className="hidden" />
        <ArrowDownTrayIcon className="h-5 w-5 text-zinc-400" />
        <span className="text-xs text-zinc-500 text-center">Drop files or click to browse</span>
        <span className="text-xs text-zinc-400">PDF, JPEG, PNG, WEBP • Max 45 MB</span>
      </label>
      {showEncryptedNotice && (
        <p className="text-xs text-zinc-400 flex items-center gap-1">
          <ShieldExclamationIcon className="h-3 w-3" />
          Files are encrypted before upload to Supabase Storage.
        </p>
      )}
    </div>
  );
}
