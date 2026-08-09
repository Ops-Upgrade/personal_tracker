import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AUTH_ROUTE } from "@/routes/config";
import VaultClientLayout from "./VaultClientLayout";

export const metadata = {
  title: "Your Vault — Ops Upgrade",
  description: "Secure secrets manager — credentials, PINs, and identity documents.",
};

/**
 * Vault layout — Server Component for session validation.
 *
 * Renders a client-side VaultClientLayout which wraps children with VaultProvider
 * (PIN gating). This is the same pattern as (protected)/layout.tsx → CryptoProvider.
 */
export default async function VaultLayout({
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

  return <VaultClientLayout userId={user.id}>{children}</VaultClientLayout>;
}
