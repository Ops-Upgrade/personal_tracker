import Image from "next/image";
import LoginForm from "@/components/auth/LoginForm";

export const metadata = {
  title: "Sign In — Ops Upgrade",
  description: "Sign in to your Ops Upgrade account.",
};

/**
 * Login page — clean centered card, no signup link.
 * The LoginForm client component handles the auth logic.
 */
export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm space-y-8">
        {/* Header */}
        <div className="flex flex-col items-center gap-4">
          <Image
            src="/images/logo-with-name.png"
            alt="Ops Upgrade"
            width={200}
            height={50}
            priority
            className="h-12 w-auto rounded"
          />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Sign in to your account
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
