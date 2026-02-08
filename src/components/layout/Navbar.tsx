"use client";

import { useRouter } from "next/navigation";
import { logout } from "@/api/auth";
import { ROUTES } from "@/routes/paths";

interface NavbarProps {
  userEmail: string;
}

/**
 * Top navigation bar for protected pages.
 * Displays app name, user email, and logout button.
 */
export default function Navbar({ userEmail }: NavbarProps) {
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.push(ROUTES.LOGIN);
    router.refresh();
  }

  return (
    <nav className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* App Name */}
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Personal Tracker
          </span>
        </div>

        {/* User Info + Logout */}
        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-zinc-500 dark:text-zinc-400 sm:inline">
            {userEmail}
          </span>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
}
