import type { ReactNode } from "react";
import BackButton from "./BackButton";
import ErrorBanner from "./ErrorBanner";

interface PageShellProps {
  backHref: string;
  backLabel?: string;
  title: string;
  description?: string;
  error?: string | null;
  onRetry?: () => void;
  children: ReactNode;
}

/** Standard page layout used by every domain view and sub-page. */
export default function PageShell({
  backHref,
  backLabel = "← Back",
  title,
  description,
  error,
  onRetry,
  children,
}: PageShellProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-start gap-4">
        <BackButton href={backHref}>{backLabel}</BackButton>
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {description}
            </p>
          )}
        </div>
      </div>

      {children}

      {error && <ErrorBanner message={error} onRetry={onRetry} />}
    </div>
  );
}
