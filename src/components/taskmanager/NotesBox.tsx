"use client";

import type { Document } from "@/types/document";
import type { UnifiedNoteRecord } from "./helpers";
import { getNoteTitle } from "./helpers";
import { trunc } from "@/lib/viewHelpers";
import { formatShortDate } from "@/lib/format";
import Button from "@/components/common/Button";
import GenericCompletedBox from "@/components/common/GenericCompletedBox";

interface NotesBoxProps {
  items: UnifiedNoteRecord[];
  isLoading: boolean;
  onAdd: () => void;
  onOpenExpanded: () => void;
  onSelectNote: (item: UnifiedNoteRecord & { type: "note" }) => void;
  onSelectDocument: (doc: Document) => void;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

export default function NotesBox({
  items,
  isLoading,
  onAdd,
  onOpenExpanded,
  onSelectNote,
  onSelectDocument,
}: NotesBoxProps) {
  const listHeader = (
    <div className="grid grid-cols-12 px-2 pb-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700">
      <div className="col-span-3">Name</div>
      <div className="col-span-5">Note</div>
      <div className="col-span-2">Date Added</div>
      <div className="col-span-2">Files</div>
    </div>
  );

  return (
    <GenericCompletedBox
      items={items}
      isLoading={isLoading}
      onOpenExpanded={onOpenExpanded}
      title="Notes"
      listHeader={listHeader}
      renderItem={(item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => {
            if (item.type === "note") {
              onSelectNote(item);
            } else {
              onSelectDocument(item.data);
            }
          }}
          className="grid grid-cols-12 items-center gap-2 w-full rounded-md border border-zinc-200 px-2 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
        >
          {item.type === "note" ? (
            <>
              <div className="col-span-3 truncate font-medium">
                {getNoteTitle(item.data)}
              </div>
              <div className="col-span-5 truncate text-zinc-500 dark:text-zinc-400">
                {(() => {
                  const stripped = stripHtml(item.data.content || "");
                  return stripped ? trunc(stripped, 60) : "—";
                })()}
              </div>
              <div className="col-span-2 text-zinc-500 dark:text-zinc-400">
                {formatShortDate(item.data.created_at)}
              </div>
              <div className="col-span-2 text-zinc-500 dark:text-zinc-400">
                {item.attachedDocs.length > 0
                  ? `${item.attachedDocs.length} file${item.attachedDocs.length !== 1 ? "s" : ""}`
                  : "—"}
              </div>
            </>
          ) : (
            <>
              <div className="col-span-3 text-zinc-400 dark:text-zinc-500">—</div>
              <div className="col-span-5 text-zinc-400 dark:text-zinc-500">—</div>
              <div className="col-span-2 text-zinc-500 dark:text-zinc-400">
                {formatShortDate(item.data.created_at)}
              </div>
              <div className="col-span-2 truncate text-zinc-500 dark:text-zinc-400">
                {item.data.label || "Unnamed"}
              </div>
            </>
          )}
        </button>
      )}
      headerActions={
        <Button
          variant="secondary"
          size="md"
          onClick={onAdd}
          disabled={isLoading}
        >
          + Add
        </Button>
      }
    />
  );
}
