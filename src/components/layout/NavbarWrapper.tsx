"use client";

import { Navbar } from "@ops-upgrade/auth-core/ui";
import { ROUTES } from "@/routes/paths";

/**
 * User shape required by the shared Navbar. The protected layout guarantees
 * `email` is present (bounces to /logout otherwise); `name`/`avatarUrl` are
 * sanitized by the layout before reaching this component.
 */
export interface NavbarUser {
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
}

interface NavbarWrapperProps {
  user: NavbarUser;
  /** Server-supplied ISO date string, rendered by the core Navbar as the IST calendar date. */
  serverDate: string;
}

/**
 * Adapts the protected layout's session data to the shared Navbar from
 * @ops-upgrade/auth-core. Owns this app's logout navigation: full navigation
 * to /logout, where DEK teardown, media cache clears, and the local-scope
 * sign-out live.
 */
export default function NavbarWrapper({ user, serverDate }: NavbarWrapperProps) {
  // Defense-in-depth: avatarUrl is user-controlled metadata — only ever
  // render https: URLs, never javascript: or protocol-relative values.
  const sanitizedUser: NavbarUser = {
    ...user,
    avatarUrl:
      typeof user.avatarUrl === "string" && user.avatarUrl.startsWith("https://")
        ? user.avatarUrl
        : null,
  };

  return (
    <Navbar
      user={sanitizedUser}
      serverDate={serverDate}
      onLogout={() => {
        window.location.href = ROUTES.LOGOUT;
      }}
      routes={{
        dashboard: ROUTES.DASHBOARD,
        profile: ROUTES.PROFILE,
      }}
      logoSrcLight="/images/logo-with-name-light.png"
      logoSrcDark="/images/logo-with-name.png"
    />
  );
}
