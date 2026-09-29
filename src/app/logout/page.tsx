"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient, coreSignOut } from "@ops-upgrade/auth-core";
import { clearDEK } from "@/lib/crypto";
import { clearDiscoverCache } from "@/components/media/views/DiscoverView";
import { clearDefaultViewCache } from "@/components/media/views/DefaultView";
import { clearCollectionViewCache } from "@/components/media/views/CollectionView";
import { ROUTES } from "@/routes/paths";

function SigningOut() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">Signing out…</p>
    </div>
  );
}

/**
 * Owns the full client-side logout sequence:
 * DEK teardown → media view cache clears → local-scope sign-out → redirect.
 * Reached from the Navbar (this app) and from other *.ops-upgrade.net
 * subdomains via ?redirect=.
 */
function LogoutHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    async function run() {
      // 1-2. Grab the userId, then wipe the DEK from IndexedDB + memory.
      try {
        const {
          data: { session },
        } = await createBrowserClient().auth.getSession();
        const userId = session?.user.id;
        if (userId) {
          await clearDEK(userId);
        }
      } catch {
        // Best-effort — sign-out proceeds regardless.
      }

      // 3. Clear per-view media caches.
      clearDiscoverCache();
      clearDefaultViewCache();
      clearCollectionViewCache();

      // 4. Sign out this device only (scope: "local").
      try {
        await coreSignOut(createBrowserClient());
      } catch {
        // Session cookies may already be gone — navigation proceeds.
      }

      // 5-6. Validated cross-subdomain redirect, else login.
      const redirect = searchParams.get("redirect");
      const isValidRedirect =
        redirect === "ops-upgrade.net" || redirect?.endsWith(".ops-upgrade.net");
      if (isValidRedirect) {
        window.location.href = `https://${redirect}`;
      } else {
        router.replace(ROUTES.LOGIN);
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
