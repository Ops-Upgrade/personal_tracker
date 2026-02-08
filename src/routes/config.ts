import { ROUTES } from "./paths";

/**
 * Routes that do NOT require authentication.
 * Everything else is treated as protected by the middleware.
 */
export const PUBLIC_ROUTES: string[] = [ROUTES.LOGIN];

/**
 * The default route to redirect to after successful login.
 */
export const DEFAULT_AUTHENTICATED_ROUTE = ROUTES.DASHBOARD;

/**
 * The route to redirect unauthenticated users to.
 */
export const AUTH_ROUTE = ROUTES.LOGIN;
