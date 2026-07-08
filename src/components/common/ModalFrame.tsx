"use client";

import type { ReactNode } from "react";

interface ModalFrameProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidthClassName?: string;
  sidePanel?: ReactNode;
  zClassName?: string;
}

export default function ModalFrame({
  title,
  onClose,
  children,
  maxWidthClassName = "max-w-3xl",
  sidePanel,
  zClassName = "z-40",
}: ModalFrameProps) {
  return (
    <div className={`fixed inset-0 ${zClassName} flex items-center justify-center bg-zinc-950/60 p-4`}>
      <div
        className={`w-full ${maxWidthClassName} rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900`}
      >
        <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Close
          </button>
        </header>
        <div className={`flex ${sidePanel ? "flex-col sm:flex-row" : ""}`}>
          <div className="flex-1 min-w-0 p-4">{children}</div>
          {sidePanel && (
            <div className="shrink-0 border-t border-zinc-200 sm:w-[420px] sm:border-l sm:border-t-0 dark:border-zinc-800">
              {sidePanel}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
