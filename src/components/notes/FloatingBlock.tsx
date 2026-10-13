"use client";

import React, { useState, useEffect, useRef } from "react";
import { Rnd } from "react-rnd";
import { Move, Trash2, Crop } from "lucide-react";
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
  onDelete?: (blockId: string, block?: CanvasBlock) => void;
  onCrop?: (blockId: string, imageUrl: string) => void;
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
  onCrop,
}: FloatingBlockProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const imageUrlRef = useRef<string | null>(null);
  const isImage = block.type === "image";
  const docId = block.type === "image" ? block.document_id : undefined;

  // If this is an image block, resolve its document to an object URL
  useEffect(() => {
    if (block.type !== "image" || !docId || !userId) return;
    let revoked = false;
    setLoadState("loading");

    async function loadImage() {
      try {
        const docs = await fetchDocuments(userId);
        const doc = docs.find((d) => d.id === docId);
        if (doc && doc.file_name && doc.file_iv) {
          const blob = await downloadNoteImage(userId, doc.file_name, doc.file_iv);
          if (!revoked) {
            const url = URL.createObjectURL(blob);
            imageUrlRef.current = url;
            setImageUrl(url);
            setLoadState("ready");
          }
        } else {
          if (!revoked) setLoadState("error");
        }
      } catch (err) {
        console.error("Failed to load note image block:", err);
        if (!revoked) setLoadState("error");
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
  }, [block.id, block.type, docId, userId]);

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
      className={`floating-block-container group absolute transition-all ${
        isImage
          ? isSelected
            ? "ring-2 ring-blue-500 rounded-sm shadow-md"
            : "hover:ring-1 hover:ring-blue-400/50"
          : isSelected
          ? "rounded-lg border border-blue-500 bg-white/95 shadow-lg ring-2 ring-blue-500/20 dark:bg-zinc-900/95"
          : "rounded-lg border border-zinc-200/80 bg-white/80 shadow-sm hover:border-zinc-300 dark:border-zinc-800/80 dark:bg-zinc-900/80 dark:hover:border-zinc-700"
      }`}
    >
      {/* For Image: Floating action bar above image when selected */}
      {isImage && isSelected && (
        <div
          className="absolute -top-9 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 rounded-md border border-zinc-200 bg-white/95 px-1.5 py-1 text-xs shadow-md dark:border-zinc-700 dark:bg-zinc-800/95 backdrop-blur-xs select-none"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {imageUrl && onCrop && (
            <button
              type="button"
              onClick={() => onCrop(block.id, imageUrl)}
              title="Crop image"
              className="flex items-center gap-1 rounded px-2 py-0.5 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700 font-medium"
            >
              <Crop className="h-3 w-3" />
              <span>Crop</span>
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(block.id, block);
              }}
              title="Delete image"
              className="flex items-center gap-1 rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {/* For Text Box: Border drag handle header */}
      {!isImage && (
        <div
          className="rnd-drag-handle flex h-6 w-full cursor-grab items-center justify-between rounded-t-lg bg-zinc-100/90 px-2 text-[11px] text-zinc-500 active:cursor-grabbing dark:bg-zinc-800/90 dark:text-zinc-400 select-none"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(block.id);
          }}
        >
          <div className="flex items-center gap-1.5 truncate">
            <Move className="h-3 w-3 shrink-0 opacity-70" />
            <span className="font-medium truncate">Text box</span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(block.id, block);
            }}
            title="Delete box"
            className="rounded p-0.5 text-zinc-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400 transition-colors"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Content Area */}
      <div
        className={
          isImage
            ? "rnd-drag-handle relative h-full w-full cursor-grab active:cursor-grabbing overflow-hidden"
            : "h-[calc(100%-24px)] w-full overflow-auto p-2"
        }
        onContextMenu={(e) => onContextMenu(e, block.id)}
        onPointerDown={(e) => {
          e.stopPropagation();
          onSelect(block.id);
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(block.id);
        }}
      >
        {!isImage ? (
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
        ) : loadState === "ready" && imageUrl ? (
          <img
            src={imageUrl}
            alt={block.alt || "Note canvas image"}
            className="h-full w-full object-fill pointer-events-none select-none"
            draggable={false}
          />
        ) : loadState === "error" ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-red-300 bg-red-50/50 p-2 text-center text-xs text-red-600 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
            <span className="font-medium">Image not found</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(block.id, block);
              }}
              className="mt-1 rounded bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60"
            >
              Remove block
            </button>
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
            Loading image...
          </div>
        )}
      </div>
    </Rnd>
  );
}
