"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import VaultLockScreen from "@/components/vault/VaultLockScreen";
import VaultPinSetup from "@/components/vault/VaultPinSetup";
import VaultHeader from "@/components/vault/VaultHeader";
import { useVault } from "@/components/vault/VaultProvider";
import { ROUTES } from "@/routes/paths";

/**
 * Client-side vault layout — handles the PIN gate UI.
 * VaultProvider is hoisted to (protected)/layout.tsx so state/timers survive
 * navigation away from vault routes.
 */
export default function VaultClientLayout({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  return <VaultGate userId={userId}>{children}</VaultGate>;
}

/** Inner component — reads vault state and renders the appropriate UI. */
function VaultGate({ userId, children }: { userId: string; children: React.ReactNode }) {
  const { state } = useVault();
  const router = useRouter();
  const pathname = usePathname();

  // Redirect sub-routes back to /vault when locked or PIN not yet set
  useEffect(() => {
    if ((state === "locked" || state === "setup_required") && pathname !== ROUTES.VAULT) {
      router.replace(ROUTES.VAULT);
    }
  }, [state, pathname, router]);

  if (state === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-700 dark:border-t-zinc-400" />
      </div>
    );
  }

  if (state === "setup_required") {
    return (
      <VaultPinSetup
        userId={userId}
        onComplete={() => {
          // After setting PIN, transition to locked state
          // The VaultProvider will detect the PIN is now set on reload
          window.location.reload();
        }}
      />
    );
  }

  if (state === "locked") {
    return <VaultLockScreen />;
  }

  // UNLOCKED or GRACE — show the vault content with floating header
  return (
    <div className="relative">
      <VaultHeader />
      {children}
    </div>
  );
}
