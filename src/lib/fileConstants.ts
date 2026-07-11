/**
 * Shared file validation constants.
 * Centralizes MAX_FILE_SIZE and ALLOWED_TYPES used by storage factories
 * and UI file upload zones across all domains.
 */

/** Maximum allowed file size: 45 MiB */
export const MAX_FILE_SIZE = 45 * 1024 * 1024;

/** Allowed MIME types for file uploads */
export const ALLOWED_TYPES: readonly string[] = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

/** Allowed file extensions for the HTML accept attribute (comma-separated) */
export const ALLOWED_EXTENSIONS = ".pdf,.jpg,.jpeg,.png,.webp";
