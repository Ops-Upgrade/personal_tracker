import { redirect } from "next/navigation";
import { createServerClient as createClient } from "@ops-upgrade/auth-core";
import { AUTH_ROUTE } from "@/routes/config";
import { ROUTES } from "@/routes/paths";
import NavbarWrapper from "@/components/layout/NavbarWrapper";
import type { NavbarUser } from "@/components/layout/NavbarWrapper";
import CryptoProvider from "@/lib/crypto/CryptoProvider";
import VaultProvider from "@/components/vault/VaultProvider";

/**
 * Protected layout — wraps all authenticated routes.
 *
 * Defense-in-depth: validates the session server-side even though
 * the middleware already guards these routes. Uses getClaims() via
 * createServerClient (local JWT signature check, no extra network
 * round-trip) instead of getUser() (live Supabase revalidation call).
 * If the session is missing, redirects to login; if it lacks an email,
 * redirects to /logout (the shared Navbar's contract requires one).
 *
 * CryptoProvider (client-side) ensures the DEK is in IndexedDB.
 * If missing, the user is redirected to /login to re-derive it.
 */
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims) {
    redirect(AUTH_ROUTE);
  }

  const claims = claimsData!.claims;

  const userId = claims.sub as string;
  const email =
    typeof claims.email === "string" ? claims.email : undefined;

  // The shared Navbar requires a logged-in user with an email. Without one
  // the logout chain can loop, so bounce early.
  if (!email) {
    redirect(ROUTES.LOGOUT);
  }

  // user_metadata is user-writable — treat every field as untrusted input.
  const meta = (claims.user_metadata ?? {}) as Record<string, unknown>;

  const rawName = meta?.full_name ?? meta?.name;
  const name = typeof rawName === "string" ? rawName.trim() : null;
  const finalName = name === "" ? null : name;

  // Preferred: an https: URL already stored in metadata. Reject anything
  // else (javascript:, protocol-relative, http:) before it reaches the UI.
  const rawAvatar = meta?.avatar_url ?? meta?.picture;
  let avatarUrl =
    typeof rawAvatar === "string" && rawAvatar.startsWith("https://")
      ? rawAvatar
      : null;

  // Fallback: this app's avatar pipeline uploads to the `avatars` bucket and
  // stamps user_metadata.avatar_updated_at for cache-busting. Derive the
  // public URL from NEXT_PUBLIC_SUPABASE_URL directly (no SDK call needed —
  // the storage public URL pattern is deterministic).
  if (!avatarUrl) {
    const avatarTs =
      typeof meta?.avatar_updated_at === "string"
        ? (meta.avatar_updated_at as string)
        : null;
    if (avatarTs) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
      const rawUrl = `${supabaseUrl}/storage/v1/object/public/avatars/${userId}/avatar.jpg`;
      if (rawUrl.startsWith("https://")) {
        avatarUrl = `${rawUrl}?t=${encodeURIComponent(avatarTs)}`;
      }
    }
  }

  const navUser: NavbarUser = {
    email,
    name: finalName,
    avatarUrl,
  };

  return (
    <div className="min-h-screen">
      <NavbarWrapper user={navUser} serverDate={new Date().toISOString()} />
      <main className="px-4 py-8 sm:px-6 lg:px-8">
        <CryptoProvider userId={userId}>
          <VaultProvider userId={userId}>{children}</VaultProvider>
        </CryptoProvider>
      </main>
    </div>
  );
}
