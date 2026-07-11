import type { Education, Certificate } from "@/types/education";
import type { Priority } from "@/types/taskmanager";
import { PRIORITIES } from "@/types/taskmanager";

export {
  sortByCompletedDesc,
  sortByCreatedAtDesc,
  sortByDueDateAsc,
  activeByMonths,
  completedByMonths,
  trunc,
} from "@/lib/viewHelpers";

export { formatShortDate } from "@/lib/format";

import { byPriority as sharedByPriority } from "@/lib/viewHelpers";

export function byPriority(educations: Education[]): Record<Priority, Education[]> {
  return sharedByPriority(educations, PRIORITIES) as Record<Priority, Education[]>;
}

export function certCountForEducation(
  educationId: string,
  certificates: Certificate[]
): number {
  return certificates.filter((c) => c.education_id === educationId).length;
}

export function certsForEducation(
  educationId: string,
  certificates: Certificate[]
): Certificate[] {
  return certificates.filter((c) => c.education_id === educationId);
}

export function fileTypeLabel(mime: string): string {
  if (mime === "application/pdf") return "PDF";
  if (mime === "image/jpeg") return "JPEG";
  if (mime === "image/png") return "PNG";
  if (mime === "image/webp") return "WEBP";
  return "File";
}

/**
 * Returns a unique file name by appending (1), (2), ... if the desired name
 * already exists in the provided set of taken names.
 * The renamed name becomes the canonical name for the file.
 */
export function getUniqueFileName(desiredName: string, takenNames: Set<string>): string {
  if (!takenNames.has(desiredName)) return desiredName;
  let counter = 1;
  let candidate = `${desiredName} (${counter})`;
  while (takenNames.has(candidate)) {
    counter++;
    candidate = `${desiredName} (${counter})`;
  }
  return candidate;
}
