import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ROUTES } from "@/routes/paths";

export const metadata = {
  title: "Dashboard — Ops Upgrade",
  description: "Your personal tracking dashboard.",
};

/**
 * Dashboard page — landing page after login.
 * Shows a welcome message and placeholder cards for future features.
 */
export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Welcome back{user?.email ? `, ${user.email.split("@")[0]}` : ""}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Here&apos;s an overview of your personal tracker.
        </p>
      </div>

      {/* Feature Cards Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Task Manager Card */}
        <Link
          href={ROUTES.TASK_MANAGER}
          className="rounded-xl border border-blue-200 bg-white p-6 shadow-sm transition hover:border-blue-300 hover:shadow-md dark:border-blue-900/60 dark:bg-zinc-900 dark:hover:border-blue-800"
        >
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <svg
              className="h-5 w-5 text-blue-600 dark:text-blue-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Task Manager
          </h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Manage tasks and notes in priority/month views.
          </p>
          <div className="h-10" />
        </Link>

        {/* Expenses Card */}
        <Link
          href={ROUTES.EXPENSE}
          className="rounded-xl border border-emerald-200 bg-white p-6 shadow-sm transition hover:border-emerald-300 hover:shadow-md dark:border-emerald-900/60 dark:bg-zinc-900 dark:hover:border-emerald-800"
        >
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
            <svg
              className="h-5 w-5 text-emerald-600 dark:text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Expenses
          </h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Track and categorize your spending.
          </p>
          <div className="h-10" />
        </Link>

        {/* Education Card */}
        <Link
          href={ROUTES.EDUCATION}
          className="rounded-xl border border-amber-200 bg-white p-6 shadow-sm transition hover:border-amber-300 hover:shadow-md dark:border-amber-900/60 dark:bg-zinc-900 dark:hover:border-amber-800"
        >
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
            <svg
              className="h-5 w-5 text-amber-600 dark:text-amber-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Education
          </h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Track courses, certifications, and certificates.
          </p>
          <div className="h-10" />
        </Link>

        {/* Medical Records Card */}
        <Link
          href={ROUTES.MEDICAL}
          className="rounded-xl border border-red-200 bg-white p-6 shadow-sm transition hover:border-red-300 hover:shadow-md dark:border-red-900/60 dark:bg-zinc-900 dark:hover:border-red-800"
        >
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
            <svg
              className="h-5 w-5 text-red-600 dark:text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Medical Records
          </h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Track medical visits, diagnoses, and reports.
          </p>
          <div className="h-10" />
        </Link>

        {/* Media Tracker Card */}
        <Link
          href={ROUTES.MEDIA}
          className="rounded-xl border border-violet-200 bg-white p-6 shadow-sm transition hover:border-violet-300 hover:shadow-md dark:border-violet-900/60 dark:bg-zinc-900 dark:hover:border-violet-800"
        >
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30">
            <svg
              className="h-5 w-5 text-violet-600 dark:text-violet-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Media Tracker
          </h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Track movies and TV shows with ratings and collections.
          </p>
          <div className="h-10" />
        </Link>
        {/* The Vault Card */}
        <Link
          href={ROUTES.VAULT}
          className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:border-black hover:shadow-md dark:border-zinc-600 dark:bg-zinc-900 dark:hover:border-white"
        >
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 dark:bg-white/5">
            <svg
              className="h-5 w-5 text-zinc-600 dark:text-zinc-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Your Vault
          </h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Secure store for credentials, PINs, and identity documents.
          </p>
          <div className="h-10" />
        </Link>
      </div>
    </div>
  );
}
