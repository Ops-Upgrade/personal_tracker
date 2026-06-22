"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  const pathname = usePathname();
  const showBackToDashboard = pathname !== ROUTES.DASHBOARD;

  async function handleLogout() {
    await logout();
    router.push(ROUTES.LOGIN);
    router.refresh();
  }

  return (
    <nav className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* App Logo */}
        <div className="flex items-center gap-3">
          {showBackToDashboard && (
            <Link
              href={ROUTES.DASHBOARD}
              className="rounded-lg border border-zinc-300 px-2.5 py-1 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              ← Back
            </Link>
          )}
          <Link href={ROUTES.DASHBOARD} className="flex items-center">
            <Image
              src="/images/logo-with-name.png"
              alt="Ops Upgrade"
              width={160}
              height={40}
              priority
              className="h-9 w-auto rounded"
            />
          </Link>
        </div>

        {/* User Info + Actions */}
        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-zinc-500 dark:text-zinc-400 sm:inline">
            {userEmail}
          </span>
          <Link
            href={ROUTES.CHANGE_PASSWORD}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Settings
          </Link>
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
