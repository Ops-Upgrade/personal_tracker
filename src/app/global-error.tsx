"use client";

import { useEffect } from "react";

/**
 * Root-level error boundary for personal_tracker.
 *
 * Catches unhandled errors that bubble past all nested error.tsx
 * boundaries, including errors in the root layout. Must be a Client
 * Component and must include its own <html> and <body> tags because
 * the root layout may have failed to render.
 *
 * Renders a safe, opaque message — never exposes the raw error.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (error.digest) {
      console.error("Global error digest:", error.digest);
    }
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            padding: "1rem",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: "0.875rem", color: "#71717a", margin: 0 }}>
            An unexpected error occurred. Please refresh the page.
          </p>
          <button
            onClick={reset}
            style={{
              borderRadius: "0.375rem",
              backgroundColor: "#18181b",
              color: "#fff",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              border: "none",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
