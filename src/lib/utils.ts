import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generates a random identifier prefixed with a semantic namespace.
 *
 * The helper falls back to `Math.random` when the Web Crypto API is not
 * available (e.g. during server-side rendering or old browsers). The returned
 * identifier is suitable for client-side state management and storage keys.
 */
export function createRandomId(prefix: string): string {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${suffix}`;
}
