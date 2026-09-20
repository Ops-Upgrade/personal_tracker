"use client";

import { ROUTES } from "@/routes/paths";
import GenericStorePage from "@/components/common/store/GenericStorePage";

/**
 * Notes Document Store page.
 * Standalone files uploaded to the notes domain.
 */
export default function NotesStorePage() {
  return (
    <GenericStorePage
      storeType="doc"
      domain={"notes" as any}
      title="Notes Store"
      description="View all uploaded files across all your notes."
      backHref={ROUTES.NOTES}
      allowAdd
    />
  );
}
