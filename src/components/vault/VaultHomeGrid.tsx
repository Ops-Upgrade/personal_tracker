"use client";

import Link from "next/link";
import { FileText, Key, CreditCard, FolderOpen } from "lucide-react";
import { ROUTES } from "@/routes/paths";
import BackButton from "@/components/common/BackButton";

const SECTIONS = [
  {
    title: "Personal Records",
    description: "IDs, government numbers, employment & reference IDs.",
    href: ROUTES.VAULT_RECORDS,
    icon: FileText,
  },
  {
    title: "Password Manager",
    description: "Website login credentials and account details.",
    href: ROUTES.VAULT_PASSWORDS,
    icon: Key,
  },
  {
    title: "Bank Manager",
    description: "Bank accounts, cards, PINs, and internet banking.",
    href: ROUTES.VAULT_BANKS,
    icon: CreditCard,
  },
  {
    title: "Document Vault",
    description: "Identity documents, scans, and certificates.",
    href: ROUTES.VAULT_DOCUMENTS,
    icon: FolderOpen,
  },
] as const;

interface VaultHomeGridProps {
  /** When false, tiles render as inert divs (skeleton / background layer). */
  interactive?: boolean;
}

/** 2×2 tile grid of vault sections. Reusable in both the unlocked home page
 *  and the locked background skeleton. */
export default function VaultHomeGrid({ interactive = true }: VaultHomeGridProps) {
  return (
    <div className="space-y-6 px-4 pb-6">
      <BackButton href={ROUTES.DASHBOARD} />
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Your Vault
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Secure store for credentials, PINs, and identity documents.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {SECTIONS.map((section) => {
          const Icon = section.icon;

          const tileContent = (
            <>
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 dark:bg-white/5">
                <Icon className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {section.title}
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {section.description}
              </p>
              <div className="h-10" />
            </>
          );

          if (interactive) {
            return (
              <Link
                key={section.href}
                href={section.href}
                className="group rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:border-black hover:shadow-md dark:border-zinc-600 dark:bg-zinc-900 dark:hover:border-white"
              >
                {tileContent}
              </Link>
            );
          }

          return (
            <div
              key={section.href}
              className="cursor-default rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-600 dark:bg-zinc-900"
            >
              {tileContent}
            </div>
          );
        })}
      </div>
    </div>
  );
}
