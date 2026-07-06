"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logout } from "@/api/auth";
import { ROUTES } from "@/routes/paths";
import { useTheme } from "@wrksz/themes/client";
import Button, { getButtonClasses } from "@/components/common/Button";
import ThemeSwitcher from "@/components/common/ThemeSwitcher";

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
  const { resolvedTheme } = useTheme();
  const showBackToDashboard = pathname !== ROUTES.DASHBOARD;

  const logoSrc =
    resolvedTheme === "dark"
      ? "/images/logo-with-name.png"
      : "/images/logo-with-name-light.png";

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
              src={logoSrc}
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
          <ThemeSwitcher />
          <span className="hidden text-sm text-zinc-500 dark:text-zinc-400 sm:inline">
            {userEmail}
          </span>
          <Link
            href={ROUTES.CHANGE_PASSWORD}
            className={getButtonClasses("secondary", "sm")}
          >
            Settings
          </Link>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleLogout}
          >
            Sign out
          </Button>
        </div>
      </div>
    </nav>
  );
}
