"use client";

import { ROUTES } from "@/routes/paths";
import GenericStorePage from "@/components/common/store/GenericStorePage";
import { EDUCATION_FIELDS } from "@/components/education/config";

/**
 * Education Document Store.
 * The education adapter supplies educations as parent records, inline
 * education creation, the linked-education editor, and unlink/bulk-link
 * /cascade handlers.
 */
export default function EducationStorePage() {
  return (
    <GenericStorePage
      storeType="doc"
      domain="education"
      modalFields={EDUCATION_FIELDS}
      title="Certificate Store"
      description="View all uploaded certificates across all your educations."
      backHref={ROUTES.EDUCATION}
      allowAdd
    />
  );
}
