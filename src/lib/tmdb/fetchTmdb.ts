/**
 * Wraps `fetch` for TMDB API calls with:
 * - 8-second per-attempt timeout
 * - Classification of errors as `transient` (safe to retry) or `fatal` (do not retry)
 *
 * ECONNRESET and similar network-level drops are marked transient so the client
 * can retry without spamming the API on genuine 4xx/5xx errors.
 */

const ATTEMPT_TIMEOUT_MS = 8_000;

// Network error codes that indicate a transient connectivity issue rather than
// a bad request or server-side bug.
const TRANSIENT_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EPIPE",
  "ENETUNREACH",
  "ENETDOWN",
  "EHOSTUNREACH",
  "EHOSTDOWN",
  "UND_ERR_CONNECT_TIMEOUT",
]);

// ── Public types ──

export interface FetchTmdbOk<T> {
  kind: "ok";
  data: T;
}

export interface FetchTmdbTransient {
  kind: "transient";
  error: string;
}

export interface FetchTmdbFatal {
  kind: "fatal";
  error: string;
  status?: number;
}

export type FetchTmdbResult<T> =
  | FetchTmdbOk<T>
  | FetchTmdbTransient
  | FetchTmdbFatal;

// ── Implementation ──

export async function fetchTmdb<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<FetchTmdbResult<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);

  // Merge our signal with any caller-provided signal
  const { signal: callerSignal, ...restInit } = init ?? {};
  if (callerSignal) {
    callerSignal.addEventListener("abort", () => controller.abort(), {
      once: true,
    });
  }

  try {
    const res = await fetch(url, {
      ...restInit,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return {
        kind: "fatal",
        error: `TMDB API error: ${res.status}`,
        status: res.status,
      };
    }

    const data = (await res.json()) as T;
    return { kind: "ok", data };
  } catch (err: unknown) {
    clearTimeout(timeoutId);

    // Our own timeout fired — treat as transient
    if (err instanceof DOMException && err.name === "AbortError") {
      return {
        kind: "transient",
        error: "Request timed out — network may be unstable.",
      };
    }

    // Node.js fetch errors: TypeError with cause.code for network-level issues.
    // Extract code per the canonical pattern so we reliably capture ECONNRESET.
    const errAny = err as Record<string, unknown>;
    const cause = errAny.cause as Record<string, unknown> | undefined;
    const code: string | undefined =
      (cause?.code as string | undefined) ??
      (errAny.code as string | undefined);

    if (typeof code === "string" && TRANSIENT_CODES.has(code)) {
      return {
        kind: "transient",
        error: `Network error (${code}) — connection dropped.`,
      };
    }

    // Everything else: surface as fatal
    const message =
      err instanceof Error ? err.message : String(err);
    return {
      kind: "fatal",
      error: message || "Unknown fetch error",
    };
  }
}
