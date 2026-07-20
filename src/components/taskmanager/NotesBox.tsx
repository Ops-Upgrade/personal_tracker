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

function PaperClipIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-5.7-1.477-1.477" />
    </svg>
  );
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
              <div className="col-span-2">
                {item.attachedDocs.length > 0 ? (
                  <span className="inline-flex items-center gap-1 text-sky-500" title={`${item.attachedDocs.length} document(s) attached`}>
                    <PaperClipIcon className="h-4 w-4" />
                    <span className="font-medium text-zinc-500 dark:text-zinc-400">({item.attachedDocs.length})</span>
                  </span>
                ) : (
                  <span className="text-zinc-400">—</span>
                )}
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
