import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AUTH_ROUTE } from "@/routes/config";
import Navbar from "@/components/layout/Navbar";

/**
 * Protected layout — wraps all authenticated routes.
 *
 * Defense-in-depth: validates the session server-side even though
 * the middleware already guards these routes. If the session is
 * missing, redirects to login.
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

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Navbar userEmail={user.email ?? "User"} />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
