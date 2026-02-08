/**
 * Centralized route path constants.
 * Import ROUTES instead of hardcoding path strings throughout the app.
 */
export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  DASHBOARD: "/dashboard",
  // Future feature routes:
  // EXPENSES: "/expenses",
  // TASKS: "/tasks",
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
