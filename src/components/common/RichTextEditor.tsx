"use client";

import { useCallback, useEffect } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import { Extension } from "@tiptap/core";

// ---------------------------------------------------------------------------
// Custom FontSize extension (uses TextStyle as the backing mark)
// The plan only lists @tiptap/extension-text-style; we build font-size on
// top of it so we don't add an extra package.
// ---------------------------------------------------------------------------

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

const FontSize = Extension.create({
  name: "fontSize",

  addOptions() {
    return {
      types: ["textStyle"],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (el: HTMLElement) =>
              el.style.fontSize?.replace(/["']/g, "") || null,
            renderHTML: (attrs: Record<string, string | null>) => {
              if (!attrs.fontSize) return {};
              return { style: `font-size: ${attrs.fontSize}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontSize:
        (size: string) =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize: size }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RichTextEditorProps {
  /** Current HTML content */
  value: string;
  /** Called whenever the editor content changes (HTML string) */
  onChange: (html: string) => void;
  /** When true, the editor is visually and functionally disabled */
  disabled?: boolean;
  /** Optional class name for the outermost wrapper */
  className?: string;
  /** Minimum height for the editor area (default: "12rem") */
  minHeight?: string;
}

// ---------------------------------------------------------------------------
// Toolbar button helpers
// ---------------------------------------------------------------------------

function ToolbarButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`inline-flex h-7 w-7 items-center justify-center rounded text-xs transition-colors ${
        active
          ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100"
          : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
      }`}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return (
    <div className="mx-0.5 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />
  );
}

// ---------------------------------------------------------------------------
// Font size constants
// ---------------------------------------------------------------------------

const FONT_SIZES = [
  { label: "S", value: "0.75rem" },
  { label: "M", value: "0.875rem" },
  { label: "L", value: "1rem" },
  { label: "XL", value: "1.25rem" },
  { label: "2XL", value: "1.5rem" },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RichTextEditor({
  value,
  onChange,
  disabled = false,
  className = "",
  minHeight = "12rem",
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: true,
    extensions: [
      StarterKit.configure({
        // We only want bulletList, orderedList, bold, italic from starter-kit.
        // Disable heading, codeBlock, blockquote, etc. — keep it focused.
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        code: false,
        strike: false,
      }),
      TextStyle,
      FontSize,
      TextAlign.configure({
        types: ["paragraph"],
        alignments: ["left", "center", "right", "justify"],
      }),
      Highlight.configure({
        multicolor: true,
      }),
    ],
    content: value,
    editable: !disabled,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[var(--editor-min-h)] rounded-b-lg border border-t-0 border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-500",
        style: `--editor-min-h: ${minHeight}`,
      },
    },
    onUpdate: useCallback(
      ({ editor: ed }: { editor: Editor }) => {
        const html = ed.getHTML();
        if (html === "<p></p>") {
          onChange("");
        } else {
          onChange(html);
        }
      },
      [onChange],
    ),
  });

  // Sync external value changes into the editor (e.g. form reset, undo)
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const currentHTML = editor.getHTML();
    const normalisedCurrent = currentHTML === "<p></p>" ? "" : currentHTML;
    if (value !== normalisedCurrent) {
      editor.commands.setContent(value || "");
    }
  }, [value, editor]);

  if (!editor) return null;

  const currentFontSize = editor.getAttributes("textStyle").fontSize ?? null;

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Toolbar */}
      <div
        className={`flex flex-wrap items-center gap-0.5 rounded-t-lg border border-zinc-300 bg-zinc-50 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900 ${
          disabled ? "pointer-events-none opacity-50" : ""
        }`}
      >
        {/* Font size dropdown */}
        <select
          value={currentFontSize ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) {
              editor.chain().focus().unsetFontSize().run();
            } else {
              editor.chain().focus().setFontSize(v).run();
            }
          }}
          className="h-7 rounded border border-zinc-200 bg-white px-1 text-xs text-zinc-700 outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
          title="Font size"
        >
          <option value="">Aa</option>
          {FONT_SIZES.map((fs) => (
            <option key={fs.value} value={fs.value}>
              {fs.label}
            </option>
          ))}
        </select>

        <ToolbarDivider />

        {/* Bold */}
        <ToolbarButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <strong>B</strong>
        </ToolbarButton>

        {/* Italic */}
        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <em>I</em>
        </ToolbarButton>

        <ToolbarDivider />

        {/* Bullet list */}
        <ToolbarButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet list"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z" />
          </svg>
        </ToolbarButton>

        {/* Numbered list */}
        <ToolbarButton
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered list"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z" />
          </svg>
        </ToolbarButton>

        <ToolbarDivider />

        {/* Highlight */}
        <ToolbarButton
          active={editor.isActive("highlight")}
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          title="Highlight"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.245 3.002a2.25 2.25 0 0 1 3.007.12l2.626 2.626a2.25 2.25 0 0 1-.12 3.007l-9.06 9.06a1.5 1.5 0 0 1-.776.418L7.14 19.2a.75.75 0 0 1-.893-.893l.967-3.782a1.5 1.5 0 0 1 .418-.776l9.06-9.06Z" />
          </svg>
        </ToolbarButton>

        <ToolbarDivider />

        {/* Text alignment */}
        {(["left", "center", "right", "justify"] as const).map((align) => (
          <ToolbarButton
            key={align}
            active={editor.isActive({ textAlign: align })}
            onClick={() => editor.chain().focus().setTextAlign(align).run()}
            title={`Align ${align}`}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
              {align === "left" && (
                <path d="M3 3h18v2H3V3zm0 4h12v2H3V7zm0 4h18v2H3v-2zm0 4h12v2H3v-2zm0 4h18v2H3v-2z" />
              )}
              {align === "center" && (
                <path d="M3 3h18v2H3V3zm4 4h10v2H7V7zm-4 4h18v2H3v-2zm4 4h10v2H7v-2zm-4 4h18v2H3v-2z" />
              )}
              {align === "right" && (
                <path d="M3 3h18v2H3V3zm6 4h12v2H9V7zm-6 4h18v2H3v-2zm6 4h12v2H9v-2zm-6 4h18v2H3v-2z" />
              )}
              {align === "justify" && (
                <path d="M3 3h18v2H3V3zm0 4h18v2H3V7zm0 4h18v2H3v-2zm0 4h18v2H3v-2zm0 4h18v2H3v-2z" />
              )}
            </svg>
          </ToolbarButton>
        ))}

        {/* Clear formatting */}
        <ToolbarDivider />
        <ToolbarButton
          active={false}
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
          title="Clear formatting"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </ToolbarButton>
      </div>

      {/* Editor content */}
      <EditorContent editor={editor} />
    </div>
  );
}
