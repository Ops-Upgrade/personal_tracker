"use client";

import React, { useEffect, useRef } from "react";
import {
  ChevronsUp,
  ChevronUp,
  ChevronDown,
  ChevronsDown,
  Trash2,
} from "lucide-react";

interface BlockContextMenuProps {
  x: number;
  y: number;
  onBringToFront: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onSendToBack: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function BlockContextMenu({
  x,
  y,
  onBringToFront,
  onBringForward,
  onSendBackward,
  onSendToBack,
  onDelete,
  onClose,
}: BlockContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    window.addEventListener("pointerdown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      style={{ left: `${x}px`, top: `${y}px` }}
      className="fixed z-50 min-w-[160px] rounded-lg border border-zinc-200 bg-white p-1 text-xs shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
    >
      <button
        type="button"
        onClick={() => {
          onBringToFront();
          onClose();
        }}
        className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <ChevronsUp className="h-3.5 w-3.5" />
        Bring to Front
      </button>
      <button
        type="button"
        onClick={() => {
          onBringForward();
          onClose();
        }}
        className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <ChevronUp className="h-3.5 w-3.5" />
        Bring Forward
      </button>
      <button
        type="button"
        onClick={() => {
          onSendBackward();
          onClose();
        }}
        className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <ChevronDown className="h-3.5 w-3.5" />
        Send Backward
      </button>
      <button
        type="button"
        onClick={() => {
          onSendToBack();
          onClose();
        }}
        className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <ChevronsDown className="h-3.5 w-3.5" />
        Send to Back
      </button>
      <div className="my-1 border-t border-zinc-200 dark:border-zinc-800" />
      <button
        type="button"
        onClick={() => {
          onDelete();
          onClose();
        }}
        className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete Block
      </button>
    </div>
  );
}
