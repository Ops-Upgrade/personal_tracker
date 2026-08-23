"use client";

import { ROUTES } from "@/routes/paths";
import GenericStorePage from "@/components/common/store/GenericStorePage";
import { EXPENSE_FIELDS } from "@/components/expense/config";

/**
 * Expense Receipt Store.
 * The expense adapter supplies expenses as parent records. Standalone uploads
 * and link/unlink are disabled — receipts are permanently attached to their
 * parent expense. `allowAdd` is intentionally omitted.
 */
export default function ExpenseStorePage() {
  return (
    <GenericStorePage
      storeType="doc"
      domain="expense"
      modalFields={EXPENSE_FIELDS}
      title="Receipt Store"
      description="View all uploaded receipts across all your expenses."
      backHref={ROUTES.EXPENSE}
    />
  );
}
