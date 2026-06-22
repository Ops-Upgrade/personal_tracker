/**
 * Centralized route path constants.
 * Import ROUTES instead of hardcoding path strings throughout the app.
 */
export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  DASHBOARD: "/dashboard",
  TASK_MANAGER: "/taskmanager",
  CHANGE_PASSWORD: "/settings/change-password",
  EXPENSE: "/expense",
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
