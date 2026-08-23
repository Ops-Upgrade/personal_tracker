"use client";

import { ROUTES } from "@/routes/paths";
import GenericStorePage from "@/components/common/store/GenericStorePage";
import { NOTE_FIELDS } from "@/components/taskmanager/config";

/**
 * Task Manager Document Store.
 * The taskmanager adapter supplies notes as parent records, inline note
 * creation, the linked-note editor, and unlink/bulk-link/cascade handlers.
 */
export default function TaskManagerStorePage() {
  return (
    <GenericStorePage
      storeType="doc"
      domain="taskmanager"
      modalFields={NOTE_FIELDS}
      title="Note Store"
      description="View all uploaded files across all your notes."
      backHref={ROUTES.TASK_MANAGER}
      allowAdd
    />
  );
}
