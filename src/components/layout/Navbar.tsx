"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { logout } from "@/api/auth";
import { getServerDateIST, formatISTDisplay } from "@/api/serverDate";
import { ROUTES } from "@/routes/paths";
import { useTheme } from "@wrksz/themes/client";
import Button, { getButtonClasses } from "@/components/common/Button";
import ThemeSwitcher from "@/components/common/ThemeSwitcher";
import { Menu, X } from "lucide-react";

interface NavbarProps {
  userEmail: string;
}

/**
 * Top navigation bar for protected pages.
 * Displays app name, user email, current IST date, and logout button.
 */
export default function Navbar({ userEmail }: NavbarProps) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [dateDisplay, setDateDisplay] = useState<string>("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getServerDateIST().then((dateStr) => {
      setDateDisplay(formatISTDisplay(dateStr));
    });
  }, []);

  // Close mobile menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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
    <nav className="relative z-50 border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Left: App Logo */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link href={ROUTES.DASHBOARD} className="flex shrink-0 items-center">
            <Image
              src={logoSrc}
              alt="Ops Upgrade"
              width={160}
              height={40}
              priority
              className="h-8 w-auto rounded sm:h-9"
            />
          </Link>
        </div>

        {/* Right: User Info + Actions */}
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-4">
          <div className="flex min-w-0 flex-col text-right">
            <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {userEmail}
            </span>
            {dateDisplay && (
              <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                {dateDisplay}
              </span>
            )}
          </div>

          {/* Hamburger Toggle (All Screens) */}
          <div className="flex shrink-0 items-center">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="cursor-pointer p-2 text-zinc-500 hover:text-zinc-900 focus:outline-none dark:text-zinc-400 dark:hover:text-zinc-100"
              aria-label="Toggle menu"
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Dropdown Menu (All Screens) */}
      {isMobileMenuOpen && (
        <div
          ref={menuRef}
          className="absolute right-0 top-16 flex w-56 flex-col gap-1 rounded-bl-lg border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Theme
            </span>
            <ThemeSwitcher />
          </div>
          <div className="my-1 h-px bg-zinc-200 dark:bg-zinc-800" />
          <Link
            href={ROUTES.CHANGE_PASSWORD}
            className="w-full rounded-md px-3 py-2 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Settings
          </Link>
          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              handleLogout();
            }}
            className="w-full rounded-md px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
          >
            Sign out
          </button>
        </div>
      )}
    </nav>
  );
}