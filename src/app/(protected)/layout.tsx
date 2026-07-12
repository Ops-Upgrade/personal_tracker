import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AUTH_ROUTE } from "@/routes/config";
import Navbar from "@/components/layout/Navbar";
import CryptoProvider from "@/lib/crypto/CryptoProvider";

/**
 * Protected layout — wraps all authenticated routes.
 *
 * Defense-in-depth: validates the session server-side even though
 * the middleware already guards these routes. If the session is
 * missing, redirects to login.
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

  // Extract user metadata for Navbar display
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const userName =
    typeof meta?.full_name === "string" && meta.full_name
      ? (meta.full_name as string)
      : null;

  let userAvatarUrl: string | null = null;
  const avatarTs =
    typeof meta?.avatar_updated_at === "string"
      ? (meta.avatar_updated_at as string)
      : null;
  if (avatarTs) {
    const { data } = supabase.storage
      .from("avatars")
      .getPublicUrl(`${user.id}/avatar.jpg`);
    if (data?.publicUrl) {
      userAvatarUrl = `${data.publicUrl}?t=${encodeURIComponent(avatarTs)}`;
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Navbar
        userEmail={user.email ?? "User"}
        userName={userName}
        userAvatarUrl={userAvatarUrl}
      />
      <main className="px-4 py-8 sm:px-6 lg:px-8">
        <CryptoProvider userId={user.id}>
          {children}
        </CryptoProvider>
      </main>
    </div>
  );
}
