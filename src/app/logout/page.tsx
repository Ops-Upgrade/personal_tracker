"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient, coreSignOut } from "@ops-upgrade/auth-core";
import { clearDEK } from "@/lib/crypto";
import { clearDiscoverCache } from "@/components/media/views/DiscoverView";
import { clearDefaultViewCache } from "@/components/media/views/DefaultView";
import { clearCollectionViewCache } from "@/components/media/views/CollectionView";
import { resolveLogoutRedirect } from "./resolveLogoutRedirect";
import { ROUTES } from "@/routes/paths";

function SigningOut() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">Signing out…</p>
    </div>
  );
}

/**
 * Owns the full client-side logout sequence, executed as three independent
 * steps so a failure in one never blocks the others:
 *
 *   1. DEK teardown — grab the userId, wipe the DEK from IndexedDB + memory.
 *   2. Media view cache clears + local-scope sign-out (this device only).
 *   3. Unconditional navigation — strictly validated cross-subdomain
 *      redirect, else the app's own login page.
 *
 * Reached from the Navbar (this app) and from other *.ops-upgrade.net
 * subdomains via ?redirect=.
 */
function LogoutHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    async function run() {
      try {
        // Step 1: wipe the DEK from IndexedDB + memory.
        try {
          const {
            data: { session },
          } = await createBrowserClient().auth.getSession();
          const userId = session?.user.id;
          if (userId) {
            await clearDEK(userId);
          }
        } catch (error) {
          console.error("Logout: clearDEK failed", error);
        }
        // Step 2: clear each media cache independently, then sign out this device only.
        for (const clear of [
          clearDiscoverCache,
          clearDefaultViewCache,
          clearCollectionViewCache,
        ]) {
          try {
            clear();
          } catch (error) {
            console.error("Logout: cache clear failed", error);
          }
        }
        try {
          await coreSignOut(createBrowserClient());
        } catch (error) {
          console.error("Logout: coreSignOut failed", error);
        }
      } finally {
        // Step 3: unconditional navigation — validated redirect, else login.
        const target = resolveLogoutRedirect(
          searchParams.get("redirect"),
          process.env.NODE_ENV === "production",
        );
        if (target) {
          window.location.href = target;
        } else {
          router.replace(ROUTES.LOGIN);
        }
      }
    }
    run();
  }, [router, searchParams]);

  return <SigningOut />;
}

export default function LogoutPage() {
  return (
    <Suspense fallback={<SigningOut />}>
      <LogoutHandler />
    </Suspense>
  );
}
