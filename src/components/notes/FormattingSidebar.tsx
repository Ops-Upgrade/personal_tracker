"use client";

import React, { useState, useEffect } from "react";
import {
  PanelRightClose,
  PanelRightOpen,
  Type,
  Image as ImageIcon,
  PenTool,
  Eraser,
  Palette,
  Layers,
  Bold,
  Italic,
  Highlighter,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  RotateCcw,
} from "lucide-react";
import type { Editor } from "@tiptap/react";
import { useNotesStore } from "./useNotesStore";

interface FormattingSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  penColor: string;
  onChangePenColor: (c: string) => void;
  penSize: number;
  onChangePenSize: (s: number) => void;
  onAddFloatingText: () => void;
  onAddImageClick: () => void;
  activeEditor?: Editor | null;
}

const FONT_FAMILIES = [
  { label: "Default Font", value: "" },
  { label: "Inter (Sans)", value: "Inter, sans-serif" },
  { label: "Roboto (Sans)", value: "Roboto, sans-serif" },
  { label: "Outfit (Modern)", value: "Outfit, sans-serif" },
  { label: "Merriweather (Serif)", value: "Merriweather, Georgia, serif" },
  { label: "Playfair (Editorial)", value: "'Playfair Display', Georgia, serif" },
  { label: "JetBrains (Mono)", value: "'JetBrains Mono', monospace" },
  { label: "Caveat (Handwriting)", value: "Caveat, cursive" },
  { label: "Comic (Casual)", value: "'Comic Sans MS', cursive" },
] as const;

const FONT_SIZES = [
  { label: "S", value: "0.75rem" },
  { label: "M", value: "0.875rem" },
  { label: "L", value: "1rem" },
  { label: "XL", value: "1.25rem" },
  { label: "2XL", value: "1.5rem" },
] as const;

const PRESET_COLORS = [
  "#18181b", // zinc-900
  "#2563eb", // blue-600
  "#dc2626", // red-600
  "#16a34a", // green-600
  "#d97706", // amber-600
  "#7c3aed", // violet-600
  "#db2777", // pink-600
];

const PEN_SIZES = [2, 4, 6, 8];

export default function FormattingSidebar({
  isOpen,
  onToggle,
  penColor,
  onChangePenColor,
  penSize,
  onChangePenSize,
  onAddFloatingText,
  onAddImageClick,
  activeEditor,
}: FormattingSidebarProps) {
  const { state, dispatch } = useNotesStore();

  // Listen to editor transaction to update toolbar active states (bold, italic, etc.)
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!activeEditor) return;
    const update = () => setTick((t) => t + 1);
    activeEditor.on("transaction", update);
    activeEditor.on("selectionUpdate", update);
    return () => {
      activeEditor.off("transaction", update);
      activeEditor.off("selectionUpdate", update);
    };
  }, [activeEditor]);
  const activeContent = state.activePageId
    ? state.pageContents.get(state.activePageId)?.content
    : undefined;

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={onToggle}
        title="Open Tools Panel"
        className="fixed right-3 top-20 z-30 flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-white shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
      >
        <PanelRightOpen className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
      </button>
    );
  }

  return (
    <aside className="relative flex h-full w-64 shrink-0 flex-col border-l border-zinc-200 bg-zinc-50/70 p-4 text-xs dark:border-zinc-800 dark:bg-zinc-900/70 backdrop-blur-sm overflow-y-auto">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
          <Palette className="h-4 w-4 text-zinc-500" />
          Canvas Tools
        </h3>
        <button
          type="button"
          onClick={onToggle}
          className="rounded p-1 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
          title="Close Tools Panel"
        >
          <PanelRightClose className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 space-y-6">
        {/* Insert Elements */}
        <div>
          <span className="font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[10px]">
            Insert Blocks
          </span>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => dispatch({ type: "SET_POINTER_TOOL", payload: "textbox" })}
              className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 font-medium shadow-sm transition-colors ${
                state.pointerTool === "textbox"
                  ? "border-blue-500 bg-blue-50 text-blue-900 dark:bg-blue-950/50 dark:text-blue-200"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-700"
              }`}
              title="Click and drag on canvas to draw a text box"
            >
              <Type className="h-3.5 w-3.5" />
              Text Box
            </button>
            <button
              type="button"
              onClick={onAddImageClick}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white py-2 font-medium text-zinc-700 shadow-sm hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-700"
            >
              <ImageIcon className="h-3.5 w-3.5" />
              Image
            </button>
          </div>
        </div>

        {/* Text Formatting */}
        <div>
          <span className="font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[10px] flex items-center justify-between">
            <span>Text Formatting</span>
            {!activeEditor && (
              <span className="text-[9px] text-zinc-400 font-normal lowercase">
                (click text to format)
              </span>
            )}
          </span>
          <div className="mt-2 space-y-2 rounded-lg border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-800">
            {/* Row 1: Font Family and Font Size */}
            <div className="flex items-center gap-1.5">
              <select
                disabled={!activeEditor}
                value={activeEditor?.getAttributes("textStyle")?.fontFamily || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) {
                    activeEditor?.chain().focus().unsetFontFamily().run();
                  } else {
                    activeEditor?.chain().focus().setFontFamily(val).run();
                  }
                }}
                className="h-7 flex-1 rounded border border-zinc-200 bg-white px-1.5 text-xs text-zinc-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 disabled:opacity-40"
                title="Font Family"
              >
                {FONT_FAMILIES.map((ff) => (
                  <option
                    key={ff.value}
                    value={ff.value}
                    style={{ fontFamily: ff.value || "inherit" }}
                  >
                    {ff.label}
                  </option>
                ))}
              </select>

              <select
                disabled={!activeEditor}
                value={activeEditor?.getAttributes("textStyle")?.fontSize || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) {
                    activeEditor?.chain().focus().unsetFontSize().run();
                  } else {
                    activeEditor?.chain().focus().setFontSize(val).run();
                  }
                }}
                className="h-7 w-16 shrink-0 rounded border border-zinc-200 bg-white px-1 text-xs text-zinc-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 disabled:opacity-40"
                title="Font Size"
              >
                <option value="">Size</option>
                {FONT_SIZES.map((fs) => (
                  <option key={fs.value} value={fs.value}>
                    {fs.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Row 2: Bold, Italic, Highlight, Clear */}
            <div className="flex items-center justify-between gap-1 pt-1 border-t border-zinc-100 dark:border-zinc-700/50">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={!activeEditor}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => activeEditor?.chain().focus().toggleBold().run()}
                  className={`flex h-7 w-7 items-center justify-center rounded transition-colors disabled:opacity-40 ${
                    activeEditor?.isActive("bold")
                      ? "bg-blue-100 text-blue-900 font-bold dark:bg-blue-950/60 dark:text-blue-200"
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  }`}
                  title="Bold"
                >
                  <Bold className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={!activeEditor}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => activeEditor?.chain().focus().toggleItalic().run()}
                  className={`flex h-7 w-7 items-center justify-center rounded transition-colors disabled:opacity-40 ${
                    activeEditor?.isActive("italic")
                      ? "bg-blue-100 text-blue-900 font-bold dark:bg-blue-950/60 dark:text-blue-200"
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  }`}
                  title="Italic"
                >
                  <Italic className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={!activeEditor}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => activeEditor?.chain().focus().toggleHighlight().run()}
                  className={`flex h-7 w-7 items-center justify-center rounded transition-colors disabled:opacity-40 ${
                    activeEditor?.isActive("highlight")
                      ? "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200"
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  }`}
                  title="Highlight"
                >
                  <Highlighter className="h-3.5 w-3.5" />
                </button>
              </div>

              <button
                type="button"
                disabled={!activeEditor}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() =>
                  activeEditor?.chain().focus().clearNodes().unsetAllMarks().run()
                }
                className="flex h-7 w-7 items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 disabled:opacity-40"
                title="Clear Formatting"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            </div>

            {/* Row 2: Alignment and Lists */}
            <div className="flex items-center justify-between gap-1 pt-1 border-t border-zinc-100 dark:border-zinc-700/50">
              <div className="flex items-center gap-0.5">
                {(["left", "center", "right", "justify"] as const).map((align) => (
                  <button
                    key={align}
                    type="button"
                    disabled={!activeEditor}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => activeEditor?.chain().focus().setTextAlign(align).run()}
                    className={`flex h-6 w-6 items-center justify-center rounded transition-colors disabled:opacity-40 ${
                      activeEditor?.isActive({ textAlign: align })
                        ? "bg-blue-100 text-blue-900 dark:bg-blue-950/60 dark:text-blue-200"
                        : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
                    }`}
                    title={`Align ${align}`}
                  >
                    {align === "left" && <AlignLeft className="h-3 w-3" />}
                    {align === "center" && <AlignCenter className="h-3 w-3" />}
                    {align === "right" && <AlignRight className="h-3 w-3" />}
                    {align === "justify" && <AlignJustify className="h-3 w-3" />}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  disabled={!activeEditor}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => activeEditor?.chain().focus().toggleBulletList().run()}
                  className={`flex h-6 w-6 items-center justify-center rounded transition-colors disabled:opacity-40 ${
                    activeEditor?.isActive("bulletList")
                      ? "bg-blue-100 text-blue-900 dark:bg-blue-950/60 dark:text-blue-200"
                      : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
                  }`}
                  title="Bullet list"
                >
                  <List className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  disabled={!activeEditor}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => activeEditor?.chain().focus().toggleOrderedList().run()}
                  className={`flex h-6 w-6 items-center justify-center rounded transition-colors disabled:opacity-40 ${
                    activeEditor?.isActive("orderedList")
                      ? "bg-blue-100 text-blue-900 dark:bg-blue-950/60 dark:text-blue-200"
                      : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
                  }`}
                  title="Numbered list"
                >
                  <ListOrdered className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Pointer Tools */}
        <div>
          <span className="font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[10px]">
            Pointer Tools
          </span>
          <div className="mt-2 flex rounded-lg border border-zinc-200 bg-white p-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-800">
            <button
              type="button"
              onClick={() => dispatch({ type: "SET_POINTER_TOOL", payload: "default" })}
              className={`flex-1 rounded py-1.5 text-center font-medium transition-colors ${
                state.pointerTool === "default"
                  ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              Cursor
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "SET_POINTER_TOOL", payload: "pen" })}
              className={`flex flex-1 items-center justify-center gap-1 rounded py-1.5 font-medium transition-colors ${
                state.pointerTool === "pen"
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              <PenTool className="h-3.5 w-3.5" />
              Pen
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "SET_POINTER_TOOL", payload: "eraser" })}
              className={`flex flex-1 items-center justify-center gap-1 rounded py-1.5 font-medium transition-colors ${
                state.pointerTool === "eraser"
                  ? "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              <Eraser className="h-3.5 w-3.5" />
              Eraser
            </button>
          </div>
        </div>

        {/* Pen Styling */}
        {state.pointerTool === "pen" && (
          <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900/40 dark:bg-blue-950/20">
            <div>
              <span className="font-medium text-blue-900 dark:text-blue-300 text-[11px]">
                Ink Color
              </span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onChangePenColor(c)}
                    style={{ backgroundColor: c }}
                    className={`h-5 w-5 rounded-full border border-black/10 transition-transform ${
                      penColor === c ? "scale-125 ring-2 ring-blue-500 ring-offset-1" : "hover:scale-110"
                    }`}
                  />
                ))}
              </div>
            </div>

            <div>
              <span className="font-medium text-blue-900 dark:text-blue-300 text-[11px]">
                Stroke Size
              </span>
              <div className="mt-1.5 flex gap-2">
                {PEN_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => onChangePenSize(size)}
                    className={`flex h-7 flex-1 items-center justify-center rounded border text-xs font-semibold ${
                      penSize === size
                        ? "border-blue-500 bg-blue-600 text-white"
                        : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    }`}
                  >
                    {size}px
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Sheet Info */}
        {activeContent && (
          <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
            <span className="font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[10px] flex items-center gap-1">
              <Layers className="h-3 w-3" />
              Sheet Stats
            </span>
            <div className="mt-2 space-y-1.5 text-zinc-600 dark:text-zinc-400">
              <div className="flex justify-between">
                <span>Blocks:</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {activeContent.blocks.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Ink strokes:</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {activeContent.strokes.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Revision:</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  v{activeContent.revision}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Size:</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {activeContent.sheet_w} × {activeContent.sheet_h}px
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
