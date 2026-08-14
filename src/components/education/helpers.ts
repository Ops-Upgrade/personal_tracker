import type { Education } from "@/types/education";
import type { Document } from "@/types/document";
import type { Priority } from "@/types/common";
import { PRIORITIES } from "@/types/common";

export {
  sortByCompletedDesc,
  trunc,
} from "@/lib/viewHelpers";

import { byPriority as sharedByPriority } from "@/lib/viewHelpers";

export function byPriority(educations: Education[]): Record<Priority, Education[]> {
  return sharedByPriority(educations, PRIORITIES) as Record<Priority, Education[]>;
}

/** Get documents linked to a given education */
export function docsForEducation(
  educationId: string,
  documents: Document[]
): Document[] {
  return documents.filter(
    (d) => d.domain === "education" && d.linked_id === educationId
  );
}

export function fileTypeLabel(mime: string): string {
  if (mime === "application/pdf") return "PDF";
  if (mime === "image/jpeg") return "JPEG";
  if (mime === "image/png") return "PNG";
  if (mime === "image/webp") return "WEBP";
  return "File";
}
