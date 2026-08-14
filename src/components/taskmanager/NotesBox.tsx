"use client";

import { useMemo } from "react";
import type { Document } from "@/types/document";
import type { ColumnDef } from "@/components/common/GenericViewPage";
import type { UnifiedNoteRecord } from "./helpers";
import { getNoteTitle } from "./helpers";
import { colRichtext, colDate, colFiles } from "@/components/common/columns";
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

export default function NotesBox({
  items,
  isLoading,
  onAdd,
  onOpenExpanded,
  onSelectNote,
  onSelectDocument,
}: NotesBoxProps) {
  // Fixed tracks size themselves to content; flex tracks share the rest.
  // Cells branch on item.type (note vs attached document).
  const columns: ColumnDef<UnifiedNoteRecord>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Name",
        sizing: "flex",
        weight: 2,
        render: (item) => (
          <span className="font-medium">
            {item.type === "note"
              ? getNoteTitle(item.data)
              : item.data.label || "Unnamed"}
          </span>
        ),
      },
      colRichtext<UnifiedNoteRecord>({
        key: "note",
        header: "Note",
        accessor: (item) => (item.type === "note" ? item.data.content : ""),
        weight: 3,
      }),
      colDate<UnifiedNoteRecord>({
        key: "date",
        header: "Date Added",
        accessor: (item) => item.data.created_at,
        className: "text-zinc-500 dark:text-zinc-400",
      }),
      colFiles<UnifiedNoteRecord>(
        {
          getCount: (item) => (item.type === "note" ? item.attachedDocs.length : 1),
          iconColorClass: "text-sky-500",
          countClass: "text-zinc-500 dark:text-zinc-400",
        },
        { align: "right" },
      ),
    ],
    [],
  );

  return (
    <GenericCompletedBox
      items={items}
      isLoading={isLoading}
      onOpenExpanded={onOpenExpanded}
      title="Notes"
      columns={columns}
      onRowClick={(item) => {
        if (item.type === "note") {
          onSelectNote(item);
        } else {
          onSelectDocument(item.data);
        }
      }}
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
