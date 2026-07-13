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
  PROFILE: "/settings/profile",
  EXPENSE: "/expense",
  EXPENSE_ALL: "/expense/all",
  EDUCATION: "/education",
  EDUCATION_COMPLETED: "/education/completed",
  EDUCATION_STORE: "/education/store",
  MEDICAL: "/medical",
  MEDICAL_STORE: "/medical/store",
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
