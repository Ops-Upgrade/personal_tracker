/**
 * Centralized route path constants.
 * Import ROUTES instead of hardcoding path strings throughout the app.
 */
export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  DASHBOARD: "/dashboard",
  TASK_MANAGER: "/taskmanager",
  TASK_MANAGER_COMPLETED: "/taskmanager/completed",
  TASK_MANAGER_NOTES: "/taskmanager/notes",
  TASK_MANAGER_STORE: "/taskmanager/store",
  PROFILE: "/settings/profile",
  EXPENSE: "/expense",
  EXPENSE_ALL: "/expense/all",
  EDUCATION: "/education",
  EDUCATION_COMPLETED: "/education/completed",
  EDUCATION_STORE: "/education/store",
  MEDICAL: "/medical",
  MEDICAL_STORE: "/medical/store",
  MEDIA: "/media",
  MEDIA_COLLECTION: (id: string) => `/media/collection/${id}`,
  MEDIA_MOVIE: (tmdbId: number) => `/media/movie/${tmdbId}`,
  MEDIA_TV: (tmdbId: number) => `/media/tv/${tmdbId}`,
  /** Convenience helper — resolves to MEDIA_MOVIE or MEDIA_TV based on type. */
  MEDIA_DETAIL: (tmdbId: number, type: "movie" | "tv") =>
    type === "movie"
      ? (`/media/movie/${tmdbId}` as const)
      : (`/media/tv/${tmdbId}` as const),
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
