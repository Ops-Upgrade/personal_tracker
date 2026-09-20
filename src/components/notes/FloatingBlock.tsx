"use client";

import React, { useState, useEffect, useRef } from "react";
import { Rnd } from "react-rnd";
import { Move, Trash2 } from "lucide-react";
import type { CanvasBlock } from "@/types/notes";
import RichTextEditor from "@/components/common/RichTextEditor";
import { downloadNoteImage } from "@/api/notes";
import { fetchDocuments } from "@/api/common/documents";

interface FloatingBlockProps {
  block: CanvasBlock;
  isSelected: boolean;
  userId: string;
  onSelect: (blockId: string) => void;
  onUpdatePosition: (blockId: string, x: number, y: number) => void;
  onUpdateSize: (
    blockId: string,
    w: number,
    h: number,
    x: number,
    y: number
  ) => void;
  onUpdateContent: (blockId: string, html: string) => void;
  onContextMenu: (e: React.MouseEvent, blockId: string) => void;
  onDelete?: (blockId: string) => void;
}

export default function FloatingBlock({
  block,
  isSelected,
  userId,
  onSelect,
  onUpdatePosition,
  onUpdateSize,
  onUpdateContent,
  onContextMenu,
  onDelete,
}: FloatingBlockProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const imageUrlRef = useRef<string | null>(null);

  // If this is an image block, resolve its document to an object URL
  useEffect(() => {
    if (block.type !== "image" || !block.document_id || !userId) return;
    let revoked = false;

    async function loadImage() {
      try {
        const docs = await fetchDocuments(userId);
        const doc = docs.find((d) => d.id === (block as { document_id: string }).document_id);
        if (doc && doc.file_name && doc.file_iv) {
          const blob = await downloadNoteImage(userId, doc.file_name, doc.file_iv);
          if (!revoked) {
            const url = URL.createObjectURL(blob);
            imageUrlRef.current = url;
            setImageUrl(url);
          }
        }
      } catch (err) {
        console.error("Failed to load note image block:", err);
      }
    }

    loadImage();

    return () => {
      revoked = true;
      if (imageUrlRef.current) {
        URL.revokeObjectURL(imageUrlRef.current);
        imageUrlRef.current = null;
      }
    };
  }, [block, userId]);

  return (
    <Rnd
      size={{ width: block.w, height: block.h }}
      position={{ x: block.x, y: block.y }}
      onDragStop={(_e, d) => onUpdatePosition(block.id, d.x, d.y)}
      onResizeStop={(_e, _direction, ref, _delta, position) => {
        onUpdateSize(
          block.id,
          ref.offsetWidth,
          ref.offsetHeight,
          position.x,
          position.y
        );
      }}
      dragHandleClassName="rnd-drag-handle"
      bounds="parent"
      style={{ zIndex: 10 + block.z }}
      onPointerDown={(e) => {
        e.stopPropagation();
      }}
      className={`floating-block-container group absolute rounded-lg border transition-all ${
        isSelected
          ? "border-blue-500 bg-white/95 shadow-lg ring-2 ring-blue-500/20 dark:bg-zinc-900/95"
          : "border-zinc-200/80 bg-white/80 shadow-sm hover:border-zinc-300 dark:border-zinc-800/80 dark:bg-zinc-900/80 dark:hover:border-zinc-700"
      }`}
    >
      {/* Border drag handle header */}
      <div
        className="rnd-drag-handle flex h-6 w-full cursor-grab items-center justify-between rounded-t-lg bg-zinc-100/90 px-2 text-[11px] text-zinc-500 active:cursor-grabbing dark:bg-zinc-800/90 dark:text-zinc-400 select-none"
        onClick={(e) => {
          e.stopPropagation();
          onSelect(block.id);
        }}
      >
        <div className="flex items-center gap-1.5 truncate">
          <Move className="h-3 w-3 shrink-0 opacity-70" />
          <span className="font-medium truncate">
            {block.type === "text" ? "Text box" : "Image"}
          </span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.(block.id);
          }}
          title="Delete box"
          className="rounded p-0.5 text-zinc-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400 transition-colors"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {/* Content Area */}
      <div
        className="h-[calc(100%-24px)] w-full overflow-auto p-2"
        onContextMenu={(e) => onContextMenu(e, block.id)}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(block.id);
        }}
      >
        {block.type === "text" ? (
          isSelected ? (
            <RichTextEditor
              value={block.html}
              onChange={(html) => onUpdateContent(block.id, html)}
              hideToolbar
              borderless
              className="border-none shadow-none focus-within:ring-0 h-full"
              minHeight="100%"
            />
          ) : (
            <div
              className="prose prose-sm dark:prose-invert max-w-none select-text cursor-text"
              dangerouslySetInnerHTML={{
                __html:
                  block.html ||
                  "<p class='text-zinc-400 italic'>Empty text box</p>",
              }}
            />
          )
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt={block.alt || "Note canvas image"}
            className="h-full w-full object-contain pointer-events-none select-none"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
            Loading image...
          </div>
        )}
      </div>
    </Rnd>
  );
}
