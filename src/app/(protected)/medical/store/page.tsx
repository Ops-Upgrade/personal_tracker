"use client";

import { ROUTES } from "@/routes/paths";
import GenericStorePage from "@/components/common/store/GenericStorePage";
import { MEDICAL_FIELDS } from "@/components/medical/config";

/**
 * Medical Document Store.
 * The medical adapter supplies medical records as parent items. Linking and
 * standalone uploads are disabled — reports are permanently attached to their
 * parent record. `allowAdd` is intentionally omitted.
 */
export default function MedicalStorePage() {
  return (
    <GenericStorePage
      storeType="doc"
      domain="medical"
      modalFields={MEDICAL_FIELDS}
      title="Medical Document Store"
      description="View all uploaded medical reports and documents."
      backHref={ROUTES.MEDICAL}
    />
  );
}
