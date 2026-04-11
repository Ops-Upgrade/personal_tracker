import ChangePasswordForm from "@/components/auth/ChangePasswordForm";

export default function ChangePasswordPage() {
  return (
    <div className="flex flex-col items-center py-8">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Change password
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Update your password. This will also re-encrypt your data encryption
            key with the new password.
          </p>
        </div>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
