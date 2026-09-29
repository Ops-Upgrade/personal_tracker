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
 * the middleware already guards these routes. If the session is
 * missing, redirects to login; if it lacks an email, redirects to
 * /logout (the shared Navbar's contract requires one).
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(AUTH_ROUTE);
  }

  // The shared Navbar requires a logged-in user with an email. Without one
  // the logout chain can loop, so bounce early.
  if (!user.email) {
    redirect(ROUTES.LOGOUT);
  }

  // user_metadata is user-writable — treat every field as untrusted input.
  const meta = user.user_metadata as Record<string, unknown> | undefined;

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
  // public URL from the bucket, with the same strict https: sanitization.
  if (!avatarUrl) {
    const avatarTs =
      typeof meta?.avatar_updated_at === "string"
        ? (meta.avatar_updated_at as string)
        : null;
    if (avatarTs) {
      const { data } = supabase.storage
        .from("avatars")
        .getPublicUrl(`${user.id}/avatar.jpg`);
      if (data?.publicUrl && data.publicUrl.startsWith("https://")) {
        avatarUrl = `${data.publicUrl}?t=${encodeURIComponent(avatarTs)}`;
      }
    }
  }

  const navUser: NavbarUser = {
    email: user.email,
    name: finalName,
    avatarUrl,
  };

  return (
    <div className="min-h-screen">
      <NavbarWrapper user={navUser} serverDate={new Date().toISOString()} />
      <main className="px-4 py-8 sm:px-6 lg:px-8">
        <CryptoProvider userId={user.id}>
          <VaultProvider userId={user.id}>{children}</VaultProvider>
        </CryptoProvider>
      </main>
    </div>
  );
}
