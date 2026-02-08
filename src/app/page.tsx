import { redirect } from "next/navigation";
import { ROUTES } from "@/routes/paths";

/**
 * Root page — redirects to the dashboard.
 * The middleware will handle redirecting to /login if unauthenticated.
 */
export default function HomePage() {
  redirect(ROUTES.DASHBOARD);
}
