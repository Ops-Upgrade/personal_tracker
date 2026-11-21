"use client";

import { useEffect } from "react";

/**
 * Segment-level error boundary for personal_tracker.
 *
 * Catches unhandled errors thrown by any Server or Client Component
 * in the same route segment. Renders a safe, opaque message — never
 * exposes the raw error to the browser.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the digest (server-generated opaque reference) so it can be
    // correlated with server logs without exposing detail to the user.
    if (error.digest) {
      console.error("Error digest:", error.digest);
    }
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
        Something went wrong
      </h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        An unexpected error occurred. Please try again.
      </p>
      <button
        onClick={reset}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Try again
      </button>
    </div>
  );
}
