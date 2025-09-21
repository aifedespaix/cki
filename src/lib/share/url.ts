import { compressToBase64, decompressFromBase64 } from "lz-string";

import { gridSchema } from "@/lib/game/schema";
import type { Grid } from "@/lib/game/types";

export const SHARE_PAYLOAD_VERSION = 1 as const;

export interface ShareableGridPayload {
  version: typeof SHARE_PAYLOAD_VERSION;
  grid: Grid;
}

/** Dedicated error thrown when a token cannot be parsed or validated. */
export class InvalidShareTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidShareTokenError";
  }
}

/**
 * Compresses a grid configuration into a compact Base64 token suitable for URLs.
 * The data structure is versioned to remain extensible over time.
 */
export function encodeGridToToken(grid: Grid): string {
  const payload: ShareableGridPayload = {
    version: SHARE_PAYLOAD_VERSION,
    grid,
  };

  const json = JSON.stringify(payload);
  const token = compressToBase64(json);

  if (!token) {
    throw new Error(
      "Failed to compress the grid payload into a shareable token",
    );
  }

  return token;
}

/**
 * Restores a grid configuration from a compressed Base64 token.
 * Validation is performed using the runtime {@link gridSchema} to guarantee integrity.
 */
export function decodeGridFromToken(token: string): ShareableGridPayload {
  const normalizedToken = token.trim();
  if (!normalizedToken) {
    throw new InvalidShareTokenError("Share token cannot be empty");
  }

  const json = decompressFromBase64(normalizedToken);
  if (!json) {
    throw new InvalidShareTokenError(
      "Unable to decompress the provided share token",
    );
  }

  let payload: ShareableGridPayload;
  try {
    payload = JSON.parse(json) as ShareableGridPayload;
  } catch (_error) {
    throw new InvalidShareTokenError("Share token contains invalid JSON data");
  }

  if (payload.version !== SHARE_PAYLOAD_VERSION) {
    throw new InvalidShareTokenError("Unsupported share token version");
  }

  return {
    version: SHARE_PAYLOAD_VERSION,
    grid: gridSchema.parse(payload.grid),
  };
}

/**
 * Builds a full invite URL including the `#/token` fragment.
 * The origin is normalised to avoid accidental double slashes.
 */
export function buildInviteUrl(origin: string, token: string): string {
  const trimmedOrigin = origin.replace(/\/$/, "");
  return `${trimmedOrigin}/join#${token}`;
}

/**
 * Extracts a share token from a raw user input, which can be either a token
 * or a full invite URL.
 */
export function extractTokenFromInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (!trimmed.includes("#")) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    return url.hash.slice(1) || null;
  } catch (_error) {
    // The value might not be a valid URL (for instance `/#token`).
    const fragmentIndex = trimmed.indexOf("#");
    if (fragmentIndex === -1) {
      return trimmed;
    }

    const fragment = trimmed.slice(fragmentIndex + 1);
    return fragment ? fragment : null;
  }
}
