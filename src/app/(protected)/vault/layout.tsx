import { redirect } from "next/navigation";
import { createServerClient as createClient } from "@ops-upgrade/auth-core";
import { AUTH_ROUTE } from "@/routes/config";
import VaultClientLayout from "./VaultClientLayout";

export const metadata = {
  title: "Your Vault — Ops Upgrade",
  description: "Secure secrets manager — credentials, PINs, and identity documents.",
};

/**
 * Vault layout — Server Component for session validation.
 *
 * Defense-in-depth gate: validates the session locally via getClaims()
 * (JWT signature check, no extra network round-trip) — the same pattern
 * as (protected)/layout.tsx. Renders a client-side VaultClientLayout
 * which wraps children with VaultProvider (PIN gating).
 */
export default async function VaultLayout({
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

  return <VaultClientLayout>{children}</VaultClientLayout>;
}
