import type { Document } from "@/types/document";

export {
  sortByCompletedDesc,
  trunc,
} from "@/lib/viewHelpers";

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
