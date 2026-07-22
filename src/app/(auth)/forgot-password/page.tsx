import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";
import ThemeSwitcher from "@/components/common/ThemeSwitcher";
import LoginLogo from "../login/LoginLogo";

export const metadata = {
  title: "Recover Account — Ops Upgrade",
  description: "Recover your account using your recovery key.",
};

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="absolute right-4 top-4">
        <ThemeSwitcher />
      </div>
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-4">
          <LoginLogo />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Account Recovery
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <ForgotPasswordForm />
        </div>
      </div>
    </div>
  );
}
