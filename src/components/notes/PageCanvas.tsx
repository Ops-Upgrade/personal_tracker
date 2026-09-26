"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useNotesStore } from "./useNotesStore";
import { getPageContent, uploadNoteImage, deleteNoteImage } from "@/api/notes";
import { createDocument, deleteDocument, fetchDocuments } from "@/api/common/documents";
import RichTextEditor from "@/components/common/RichTextEditor";
import FloatingBlock from "./FloatingBlock";
import InkCanvas from "./InkCanvas";
import ConflictBanner from "./ConflictBanner";
import BlockContextMenu from "./BlockContextMenu";
import { useDebouncedSave } from "./useDebouncedSave";
import type { Editor } from "@tiptap/react";
import type { CanvasBlock, InkStroke, PageContent } from "@/types/notes";

function isPointOnText(x: number, y: number): boolean {
  if (typeof document === "undefined") return false;
  let range: Range | null = null;
  if (typeof document.caretRangeFromPoint === "function") {
    range = document.caretRangeFromPoint(x, y);
  } else if (typeof (document as any).caretPositionFromPoint === "function") {
    const pos = (document as any).caretPositionFromPoint(x, y);
    if (pos && pos.offsetNode) {
      range = document.createRange();
      range.setStart(pos.offsetNode, pos.offset);
      range.collapse(true);
    }
  }

  if (!range) return false;

  const node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE) return false;

  const text = node.textContent || "";
  if (!text.trim()) return false;

  try {
    const charRange = document.createRange();
    const offset = range.startOffset;
    const start = Math.max(0, Math.min(offset, text.length - 1));
    charRange.setStart(node, start);
    charRange.setEnd(node, Math.min(start + 1, text.length));
    const rect = charRange.getBoundingClientRect();

    return (
      y >= rect.top - 6 &&
      y <= rect.bottom + 6 &&
      x >= rect.left - 10 &&
      x <= rect.right + 10
    );
  } catch {
    return false;
  }
}

interface PageCanvasProps {
  userId: string;
  pageId: string | null;
  paneIndex: number;
  penColor?: string;
  penSize?: number;
  onActiveEditorChange?: (editor: Editor | null) => void;
}

export default function PageCanvas({
  userId,
  pageId,
  paneIndex,
  penColor = "#2563eb",
  penSize = 3,
  onActiveEditorChange,
}: PageCanvasProps) {
  const { state, dispatch } = useNotesStore();
  const pageState = pageId ? state.pageContents.get(pageId) : undefined;
  const content = pageState?.content;
  const { saveNow } = useDebouncedSave(userId, pageId);

  // Context menu state for floating blocks
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    blockId: string;
  } | null>(null);

  // Drag-to-create state on empty sheet
  const [dragBox, setDragBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  const sheetRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const flowEditorRef = useRef<any>(null);

  // Fetch content on demand if not loaded yet
  useEffect(() => {
    if (!userId || !pageId) return;
    if (state.pageContents.has(pageId)) return;

    let isMounted = true;
    async function loadContent() {
      try {
        const fetched = await getPageContent(userId, pageId!);
        if (isMounted) {
          dispatch({
            type: "SET_PAGE_CONTENT",
            payload: {
              pageId: pageId!,
              content: fetched,
              dirty: false,
              lastSyncedRevision: fetched.revision,
            },
          });
        }
      } catch (err) {
        console.error("Failed to load page content:", err);
      }
    }

    loadContent();
    return () => {
      isMounted = false;
    };
  }, [userId, pageId, state.pageContents, dispatch]);

  // Compute sheet dimensions: fixed width (900px) and capped dynamic height
  const { sheetW, sheetH } = useMemo(() => {
    let maxBottom = 1200;

    if (content?.blocks) {
      for (const block of content.blocks) {
        maxBottom = Math.max(maxBottom, block.y + block.h + 120);
      }
    }

    if (content?.strokes) {
      for (const stroke of content.strokes) {
        for (const pt of stroke.points) {
          maxBottom = Math.max(maxBottom, pt[1] + 120);
        }
      }
    }

    return {
      sheetW: 900,
      sheetH: Math.min(Math.max(1200, maxBottom), 5000),
    };
  }, [content?.blocks, content?.strokes]);

  // Handle flow block (blocks[0]) update
  const handleUpdateFlowHtml = useCallback(
    (html: string) => {
      if (!pageId) return;
      dispatch({
        type: "MUTATE_PAGE_CONTENT",
        payload: {
          pageId,
          mutator: (prev) => {
            const blocks = [...prev.blocks];
            const flowIdx = blocks.findIndex(
              (b) => b.type === "text" && b.role === "flow"
            );
            if (flowIdx !== -1) {
              blocks[flowIdx] = { ...blocks[flowIdx], html };
            }
            return { ...prev, blocks };
          },
        },
      });
    },
    [pageId, dispatch]
  );

  // Handle floating block position change
  const handleUpdateBlockPos = useCallback(
    (blockId: string, x: number, y: number) => {
      if (!pageId) return;
      dispatch({
        type: "MUTATE_PAGE_CONTENT",
        payload: {
          pageId,
          mutator: (prev) => ({
            ...prev,
            blocks: prev.blocks.map((b) => (b.id === blockId ? { ...b, x, y } : b)),
          }),
        },
      });
    },
    [pageId, dispatch]
  );

  // Handle floating block size change
  const handleUpdateBlockSize = useCallback(
    (blockId: string, w: number, h: number, x: number, y: number) => {
      if (!pageId) return;
      dispatch({
        type: "MUTATE_PAGE_CONTENT",
        payload: {
          pageId,
          mutator: (prev) => ({
            ...prev,
            blocks: prev.blocks.map((b) =>
              b.id === blockId ? { ...b, w, h, x, y } : b
            ),
          }),
        },
      });
    },
    [pageId, dispatch]
  );

  // Handle floating text content update
  const handleUpdateBlockContent = useCallback(
    (blockId: string, html: string) => {
      if (!pageId) return;
      dispatch({
        type: "MUTATE_PAGE_CONTENT",
        payload: {
          pageId,
          mutator: (prev) => ({
            ...prev,
            blocks: prev.blocks.map((b) =>
              b.id === blockId && b.type === "text" ? { ...b, html } : b
            ),
          }),
        },
      });
    },
    [pageId, dispatch]
  );

  // Z-index operations
  const handleBringToFront = useCallback(
    (blockId: string) => {
      if (!pageId || !content) return;
      const maxZ = Math.max(...content.blocks.map((b) => b.z), 1);
      dispatch({
        type: "MUTATE_PAGE_CONTENT",
        payload: {
          pageId,
          mutator: (prev) => ({
            ...prev,
            blocks: prev.blocks.map((b) =>
              b.id === blockId ? { ...b, z: maxZ + 1 } : b
            ),
          }),
        },
      });
    },
    [pageId, content, dispatch]
  );

  const handleBringForward = useCallback(
    (blockId: string) => {
      if (!pageId) return;
      dispatch({
        type: "MUTATE_PAGE_CONTENT",
        payload: {
          pageId,
          mutator: (prev) => ({
            ...prev,
            blocks: prev.blocks.map((b) =>
              b.id === blockId ? { ...b, z: b.z + 1 } : b
            ),
          }),
        },
      });
    },
    [pageId, dispatch]
  );

  const handleSendBackward = useCallback(
    (blockId: string) => {
      if (!pageId) return;
      dispatch({
        type: "MUTATE_PAGE_CONTENT",
        payload: {
          pageId,
          mutator: (prev) => ({
            ...prev,
            blocks: prev.blocks.map((b) =>
              b.id === blockId ? { ...b, z: Math.max(1, b.z - 1) } : b
            ),
          }),
        },
      });
    },
    [pageId, dispatch]
  );

  const handleSendToBack = useCallback(
    (blockId: string) => {
      if (!pageId) return;
      dispatch({
        type: "MUTATE_PAGE_CONTENT",
        payload: {
          pageId,
          mutator: (prev) => ({
            ...prev,
            blocks: prev.blocks.map((b) =>
              b.id === blockId ? { ...b, z: 1 } : b
            ),
          }),
        },
      });
    },
    [pageId, dispatch]
  );

  const handleDeleteBlock = useCallback(
    async (blockId: string) => {
      if (!pageId) return;

      const blockToDelete = content?.blocks.find((b) => b.id === blockId);

      dispatch({
        type: "MUTATE_PAGE_CONTENT",
        payload: {
          pageId,
          mutator: (prev) => ({
            ...prev,
            blocks: prev.blocks.filter((b) => b.id !== blockId),
          }),
        },
      });

      if (state.selection.blockId === blockId) {
        dispatch({ type: "SET_SELECTION", payload: { kind: "none" } });
      }

      // If this was an image block, delete from R2 and documents table if not referenced elsewhere
      if (blockToDelete?.type === "image" && blockToDelete.document_id && userId) {
        const otherRef = content?.blocks.some(
          (b) => b.id !== blockId && b.type === "image" && b.document_id === blockToDelete.document_id
        );
        if (!otherRef) {
          try {
            const docs = await fetchDocuments(userId);
            const doc = docs.find((d) => d.id === blockToDelete.document_id);
            if (doc?.file_name) {
              await deleteNoteImage(userId, doc.file_name);
            }
            await deleteDocument(blockToDelete.document_id);
          } catch (err) {
            console.error("Failed to clean up image from storage:", err);
          }
        }
      }
    },
    [pageId, content?.blocks, userId, state.selection.blockId, dispatch]
  );

  // Ink stroke operations
  const handleAddStroke = useCallback(
    (stroke: InkStroke) => {
      if (!pageId) return;
      dispatch({
        type: "MUTATE_PAGE_CONTENT",
        payload: {
          pageId,
          mutator: (prev) => ({
            ...prev,
            strokes: [...prev.strokes, stroke],
          }),
        },
      });
    },
    [pageId, dispatch]
  );

  const handleRemoveStroke = useCallback(
    (strokeId: string) => {
      if (!pageId) return;
      dispatch({
        type: "MUTATE_PAGE_CONTENT",
        payload: {
          pageId,
          mutator: (prev) => ({
            ...prev,
            strokes: prev.strokes.filter((s) => s.id !== strokeId),
          }),
        },
      });
    },
    [pageId, dispatch]
  );

  // Upload an image file and place as a floating image block
  const handleUploadImageFile = useCallback(
    async (file: File, posX?: number, posY?: number) => {
      if (!userId || !pageId) return;

      try {
        const { fileName, iv, mimeType } = await uploadNoteImage(userId, file);
        const doc = await createDocument(userId, {
          label: file.name || "Pasted image",
          file_name: fileName,
          file_iv: iv,
          file_mime: mimeType,
          domain: "notes",
          linked_id: pageId,
          updated_at: new Date().toISOString(),
        });

        const newBlock: CanvasBlock = {
          id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
          type: "image",
          x: posX ?? 100,
          y: posY ?? 150,
          w: 320,
          h: 240,
          z: (content?.blocks.length || 0) + 1,
          document_id: doc.id,
          alt: file.name,
        };

        dispatch({
          type: "MUTATE_PAGE_CONTENT",
          payload: {
            pageId,
            mutator: (prev) => ({
              ...prev,
              blocks: [...prev.blocks, newBlock],
            }),
          },
        });

        dispatch({
          type: "SET_SELECTION",
          payload: { kind: "image", blockId: newBlock.id },
        });
      } catch (err) {
        console.error("Failed to upload note image:", err);
      }
    },
    [userId, pageId, content?.blocks.length, dispatch]
  );

  // Paste / Drop capture for images
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            e.stopPropagation();
            handleUploadImageFile(file);
            return;
          }
        }
      }
    },
    [handleUploadImageFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const rect = sheetRef.current?.getBoundingClientRect();
      const x = rect ? e.clientX - rect.left : 100;
      const y = rect ? e.clientY - rect.top : 150;

      for (let i = 0; i < files.length; i++) {
        if (files[i].type.startsWith("image/")) {
          handleUploadImageFile(files[i], x, y);
          break;
        }
      }
    },
    [handleUploadImageFile]
  );

  // Tracks whether a drag gesture has committed to "create text box" mode
  const dragCommittedRef = useRef(false);

  // Empty paper click / drag hit testing
  const handleSheetPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // If tool is pen or eraser, let InkCanvas handle drawing
      if (state.pointerTool !== "default") return;

      const target = e.target as HTMLElement;

      // Ignore drag handles and resize handles of floating blocks or buttons
      if (
        target.closest(".rnd-drag-handle") ||
        target.classList.contains("react-resizable-handle") ||
        target.closest(".react-resizable-handle") ||
        target.closest("button")
      ) {
        return;
      }

      // Ignore clicks inside any existing floating block (text box or image)
      if (target.closest(".floating-block-container")) {
        return;
      }

      // If clicking directly on actual text characters, let TipTap handle it
      if (isPointOnText(e.clientX, e.clientY)) {
        return;
      }

      // Start tracking a potential drag-to-create, but DON'T capture or
      // preventDefault yet — let the event reach TipTap so clicking on empty
      // space inside the editor still places the cursor normally.
      const rect = sheetRef.current?.getBoundingClientRect();
      if (!rect) return;

      dragCommittedRef.current = false;
      setDragBox({
        startX: e.clientX - rect.left,
        startY: e.clientY - rect.top,
        currentX: e.clientX - rect.left,
        currentY: e.clientY - rect.top,
      });
    },
    [state.pointerTool]
  );

  const handleSheetPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragBox) return;
      const rect = sheetRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const dx = x - dragBox.startX;
      const dy = y - dragBox.startY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Once dragged >= 8px, commit to drag-to-create mode
      if (dist >= 8 && !dragCommittedRef.current) {
        dragCommittedRef.current = true;
        try {
          sheetRef.current?.setPointerCapture(e.pointerId);
        } catch {}
        // Clear any text selection TipTap might have started
        if (typeof window !== "undefined") {
          const sel = window.getSelection();
          if (sel) sel.removeAllRanges();
        }
      }

      // Once committed, prevent TipTap from also handling move events
      if (dragCommittedRef.current) {
        e.stopPropagation();
      }

      setDragBox((prev) => (prev ? { ...prev, currentX: x, currentY: y } : null));
    },
    [dragBox]
  );

  const handleSheetPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragBox) return;
      const { startX, startY, currentX, currentY } = dragBox;
      setDragBox(null);

      const committed = dragCommittedRef.current;
      dragCommittedRef.current = false;

      try {
        if (sheetRef.current?.hasPointerCapture(e.pointerId)) {
          sheetRef.current.releasePointerCapture(e.pointerId);
        }
      } catch {}

      if (committed && typeof window !== "undefined") {
        const sel = window.getSelection();
        if (sel) sel.removeAllRanges();
      }

      const dx = currentX - startX;
      const dy = currentY - startY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 8 || !committed) {
        // Simple click — let children handle it.
        // If on outer empty paper (not inside TipTap or floating block), deselect.
        const target = e.target as HTMLElement;
        if (
          !target.closest(".tiptap") &&
          !target.closest(".floating-block-container") &&
          state.selection.blockId
        ) {
          dispatch({ type: "SET_SELECTION", payload: { kind: "none" } });
        }
        return;
      }

      // Drag >= 8px with commitment: create a new floating text box
      if (!pageId) return;
      const boxX = Math.min(startX, currentX);
      const boxY = Math.min(startY, currentY);
      const boxW = Math.max(160, Math.abs(dx));
      const boxH = Math.max(80, Math.abs(dy));

      const maxZ =
        content?.blocks && content.blocks.length > 0
          ? Math.max(...content.blocks.map((b) => b.z || 0), 1)
          : 1;

      const newBlock: CanvasBlock = {
        id:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).substring(2, 9),
        type: "text",
        role: "floating",
        x: boxX,
        y: boxY,
        w: boxW,
        h: boxH,
        z: maxZ + 1,
        html: "",
      };

      dispatch({
        type: "MUTATE_PAGE_CONTENT",
        payload: {
          pageId,
          mutator: (prev) => ({
            ...prev,
            blocks: [...prev.blocks, newBlock],
          }),
        },
      });

      dispatch({
        type: "SET_SELECTION",
        payload: { kind: "text", blockId: newBlock.id },
      });
    },
    [dragBox, content?.blocks, pageId, state.selection.blockId, dispatch]
  );

  if (!pageId) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8 text-center text-sm text-zinc-400">
        Select or create a page to view its canvas.
      </div>
    );
  }

  const flowBlock = content?.blocks.find(
    (b) => b.type === "text" && b.role === "flow"
  );
  const floatingBlocks = content?.blocks.filter(
    (b) => b.role === "floating" || b.type === "image"
  ) as Array<Extract<CanvasBlock, { role: "floating" } | { type: "image" }>> | undefined;

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-auto bg-zinc-100/60 dark:bg-zinc-950/60"
      onPaste={handlePaste}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleUploadImageFile(file);
            e.target.value = "";
          }
        }}
      />

      {/* Conflict Resolution Banner */}
      {pageState?.dirty === "conflicted" && (
        <ConflictBanner
          onReload={async () => {
            const fresh = await getPageContent(userId, pageId);
            dispatch({
              type: "SET_PAGE_CONTENT",
              payload: {
                pageId,
                content: fresh,
                dirty: false,
                lastSyncedRevision: fresh.revision,
              },
            });
          }}
          onKeepMine={() => saveNow()}
        />
      )}

      {/* The Sheet Canvas */}
      <div className="relative mx-auto my-6 flex min-h-full items-start justify-center p-4">
        <div
          ref={sheetRef}
          style={{
            width: `${sheetW}px`,
            minHeight: `${sheetH}px`,
          }}
          onPointerDownCapture={handleSheetPointerDown}
          onPointerMoveCapture={handleSheetPointerMove}
          onPointerUpCapture={handleSheetPointerUp}
          className="relative rounded-xl border border-zinc-200/80 bg-white p-8 shadow-sm transition-all dark:border-zinc-800/80 dark:bg-zinc-900 select-text"
        >
          {/* Flow document body (blocks[0]) */}
          {flowBlock && (
            <div className="relative z-0 mx-auto max-w-[760px] pb-16 min-h-[60vh]">
              <RichTextEditor
                value={flowBlock.html}
                onChange={handleUpdateFlowHtml}
                hideToolbar
                borderless
                minHeight="60vh"
                onEditorReady={(ed) => {
                  flowEditorRef.current = ed;
                  onActiveEditorChange?.(ed);
                }}
                onFocus={(ed) => {
                  onActiveEditorChange?.(ed);
                }}
                className="border-none shadow-none focus-within:ring-0 min-h-[60vh]"
              />
            </div>
          )}

          {/* Floating Boxes */}
          {floatingBlocks?.map((block) => (
            <FloatingBlock
              key={block.id}
              block={block}
              userId={userId}
              isSelected={state.selection.blockId === block.id}
              onSelect={(blockId) =>
                dispatch({
                  type: "SET_SELECTION",
                  payload: {
                    kind: block.type === "text" ? "text" : "image",
                    blockId,
                  },
                })
              }
              onUpdatePosition={handleUpdateBlockPos}
              onUpdateSize={handleUpdateBlockSize}
              onUpdateContent={handleUpdateBlockContent}
              onContextMenu={(e, blockId) => {
                e.preventDefault();
                setContextMenu({ x: e.clientX, y: e.clientY, blockId });
              }}
              onDelete={handleDeleteBlock}
            />
          ))}

          {/* Ink Canvas Layer */}
          <InkCanvas
            strokes={content?.strokes || []}
            pointerTool={state.pointerTool}
            penColor={penColor}
            penSize={penSize}
            onAddStroke={handleAddStroke}
            onRemoveStroke={handleRemoveStroke}
            width={sheetW}
            height={sheetH}
          />

          {/* Drag creation preview box */}
          {dragBox && (
            <div
              style={{
                left: `${Math.min(dragBox.startX, dragBox.currentX)}px`,
                top: `${Math.min(dragBox.startY, dragBox.currentY)}px`,
                width: `${Math.abs(dragBox.currentX - dragBox.startX)}px`,
                height: `${Math.abs(dragBox.currentY - dragBox.startY)}px`,
              }}
              className="pointer-events-none absolute z-40 rounded border-2 border-dashed border-blue-500 bg-blue-500/10"
            />
          )}
        </div>
      </div>

      {/* Right-click Block Context Menu */}
      {contextMenu && (
        <BlockContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onBringToFront={() => handleBringToFront(contextMenu.blockId)}
          onBringForward={() => handleBringForward(contextMenu.blockId)}
          onSendBackward={() => handleSendBackward(contextMenu.blockId)}
          onSendToBack={() => handleSendToBack(contextMenu.blockId)}
          onDelete={() => handleDeleteBlock(contextMenu.blockId)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
