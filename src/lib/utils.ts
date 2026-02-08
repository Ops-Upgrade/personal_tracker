import { type ClassValue, clsx } from "clsx";

/**
 * Merge Tailwind class names conditionally.
 * Lightweight utility — avoids pulling in tailwind-merge for now.
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
