import Link from "next/link";
import { ROUTES } from "@/routes/paths";
import ChangePasswordForm from "@/components/auth/ChangePasswordForm";

export default function ChangePasswordPage() {
  return (
    <div className="flex flex-col items-center py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-start gap-4">
          <Link
            href={ROUTES.DASHBOARD}
            className="shrink-0 rounded-lg border border-zinc-300 px-2.5 py-1 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            ← Back
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              Change password
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Update your password. This will also re-encrypt your data encryption
              key with the new password.
            </p>
          </div>
        </div>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
