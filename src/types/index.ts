/**
 * Shared TypeScript types for the application.
 * Add domain-specific types here as features are built.
 */

/**
 * Safe categories for auth failures. Intended for UI message mapping —
 * these are the ONLY values from the auth layer that reach the DOM.
 * Raw Supabase/crypto error strings must never be set on results consumed
 * by unauthenticated UI; they are neither returned nor logged.
 */
export type AuthErrorCode =
  | "invalid_credentials"
  | "crypto_setup_failed"
  | "unknown";

export interface AuthResult {
  success: boolean;
  /** Safe machine-readable failure category (see AuthErrorCode). */
  errorCode?: AuthErrorCode;
  /**
   * Human-readable detail for AUTHENTICATED surfaces (e.g. the password-change
   * form needs the rollback message). Must NOT be rendered by unauthenticated
   * UI (e.g. LoginForm) — those consume errorCode only.
   */
  error?: string;
}
