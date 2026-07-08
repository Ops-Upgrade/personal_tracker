import type { Education, Certificate } from "@/types/education";
import type { Priority } from "@/types/taskmanager";

// ---- Sorting utilities ----

export function sortByCompletedDesc(a: Education, b: Education): number {
  const aTs = a.completed_at ? new Date(a.completed_at).getTime() : 0;
  const bTs = b.completed_at ? new Date(b.completed_at).getTime() : 0;
  return bTs - aTs;
}

export function sortByCreatedAtDesc<T extends { created_at: string }>(
  a: T,
  b: T
): number {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

export function sortByDueDateAsc(a: Education, b: Education): number {
  if (!a.due_date && !b.due_date) return 0;
  if (!a.due_date) return 1;
  if (!b.due_date) return -1;
  return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
}

export function byPriority(educations: Education[]): Record<Priority, Education[]> {
  const PRIORITIES: Priority[] = ["critical", "high", "medium", "low"];
  return PRIORITIES.reduce(
    (acc, priority) => {
      acc[priority] = educations
        .filter((edu) => edu.priority === priority)
        .sort(sortByDueDateAsc);
      return acc;
    },
    {
      critical: [],
      high: [],
      medium: [],
      low: [],
    } as Record<Priority, Education[]>
  );
}

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "long" });

export function activeByMonths(
  educations: Education[],
  nowYear: number
): Array<{ label: string; educations: Education[] }> {
  const monthMap = new Map<string, Education[]>();

  for (const edu of educations) {
    if (!edu.due_date) {
      const unscheduled = monthMap.get("Unscheduled") ?? [];
      unscheduled.push(edu);
      monthMap.set("Unscheduled", unscheduled);
      continue;
    }

    const due = new Date(edu.due_date);
    const year = due.getFullYear();

    let label: string;
    if (year < nowYear) {
      label = "Past Years";
    } else if (year > nowYear) {
      label = "Future Years";
    } else {
      label = MONTH_FORMATTER.format(due);
    }

    const bucket = monthMap.get(label) ?? [];
    bucket.push(edu);
    monthMap.set(label, bucket);
  }

  const orderedMonths = [
    "Unscheduled",
    "Past Years",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
    "Future Years",
  ];

  return orderedMonths.map((label) => ({
    label,
    educations: (monthMap.get(label) ?? []).sort(sortByDueDateAsc),
  }));
}

export function completedByMonths(
  educations: Education[],
  nowYear: number
): Array<{ label: string; educations: Education[] }> {
  const monthMap = new Map<string, Education[]>();

  for (const edu of educations) {
    if (!edu.completed_at) {
      const unscheduled = monthMap.get("Unscheduled") ?? [];
      unscheduled.push(edu);
      monthMap.set("Unscheduled", unscheduled);
      continue;
    }

    const completed = new Date(edu.completed_at);
    const year = completed.getFullYear();

    let label: string;
    if (year < nowYear) {
      label = "Past Years";
    } else if (year > nowYear) {
      label = "Future Years";
    } else {
      label = MONTH_FORMATTER.format(completed);
    }

    const bucket = monthMap.get(label) ?? [];
    bucket.push(edu);
    monthMap.set(label, bucket);
  }

  const orderedMonths = [
    "Future Years",
    "December",
    "November",
    "October",
    "September",
    "August",
    "July",
    "June",
    "May",
    "April",
    "March",
    "February",
    "January",
    "Past Years",
    "Unscheduled",
  ];

  return orderedMonths
    .map((label) => ({
      label,
      educations: (monthMap.get(label) ?? []).sort(sortByCompletedDesc),
    }))
    .filter((group) => group.educations.length > 0);
}

// ---- Text helpers ----

export function trunc(text: string | null | undefined, max = 70): string {
  if (!text) return "";
  return text.length <= max ? text : `${text.slice(0, max)}...`;
}

export function formatShortDate(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

// ---- Certificate helpers ----

/**
 * Count how many certificates are linked to a given education.
 */
export function certCountForEducation(
  educationId: string,
  certificates: Certificate[]
): number {
  return certificates.filter((c) => c.education_id === educationId).length;
}

/**
 * Get certificates linked to a given education.
 */
export function certsForEducation(
  educationId: string,
  certificates: Certificate[]
): Certificate[] {
  return certificates.filter((c) => c.education_id === educationId);
}

/**
 * Get a short file-type label from a MIME type.
 */
export function fileTypeLabel(mime: string): string {
  if (mime === "application/pdf") return "PDF";
  if (mime === "image/jpeg") return "JPEG";
  if (mime === "image/png") return "PNG";
  if (mime === "image/webp") return "WEBP";
  return "File";
}
