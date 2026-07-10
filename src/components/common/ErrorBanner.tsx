"use client";

import Button from "./Button";

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

export default function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
      <span>{message}</span>
      {onRetry && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRetry}
          className="border border-red-300 hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-900/40"
        >
          Retry
        </Button>
      )}
    </div>
  );
}
