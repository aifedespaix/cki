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

/** Dedicated error thrown when an invite URL targets a different origin. */
export class InviteUrlOriginMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InviteUrlOriginMismatchError";
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
export interface InviteMetadata {
  roomId: string;
  hostId: string;
  hostName: string;
}

export function buildInviteUrl(
  origin: string,
  metadata: InviteMetadata,
  token: string,
): string {
  const trimmedOrigin = origin.replace(/\/$/, "");
  const url = new URL(
    `${trimmedOrigin}/room/${encodeURIComponent(metadata.roomId)}`,
  );
  url.searchParams.set("hostId", metadata.hostId);
  const hostName = metadata.hostName.trim();
  if (hostName) {
    url.searchParams.set("hostName", hostName);
  }
  url.searchParams.set("role", "guest");
  url.hash = token;
  return url.toString();
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

export interface NormalizedInviteInput {
  /** Share token extracted from the provided value. */
  token: string;
  /** Canonical representation of the user input (absolute URL when possible). */
  canonicalValue: string;
  /**
   * Safe room navigation target restricted to the current origin.
   * Contains the pathname, query string and hash (token) when the invite URL
   * points to `/room/{id}`.
   */
  roomPathWithToken: string | null;
}

/**
 * Normalises a raw invite value to safely reuse it inside the application.
 *
 * - Enforces that share URLs belong to the provided {@link currentOrigin}.
 * - Provides a canonical form (absolute URL) for recognised local invite links.
 * - Derives a navigation-safe room path preserving the query string and token.
 */
export function normalizeInviteInput(
  rawValue: string,
  currentOrigin: string,
): NormalizedInviteInput {
  const trimmedValue = rawValue.trim();
  if (!trimmedValue) {
    throw new InvalidShareTokenError(
      "Invite input does not contain a share token fragment.",
    );
  }

  let canonicalValue = trimmedValue;
  let roomPathWithToken: string | null = null;
  let shareToken: string | null = null;

  if (trimmedValue.includes("#")) {
    try {
      const url = new URL(trimmedValue, currentOrigin);
      if (url.origin !== currentOrigin) {
        throw new InviteUrlOriginMismatchError(
          "Invite URL must belong to the current origin.",
        );
      }

      const tokenFromUrl = url.hash.slice(1);
      if (!tokenFromUrl) {
        throw new InvalidShareTokenError(
          "Invite URL does not contain a share token fragment.",
        );
      }

      canonicalValue = url.toString();
      shareToken = tokenFromUrl;

      if (url.pathname.startsWith("/room/") && url.hash.length > 1) {
        roomPathWithToken = `${url.pathname}${url.search}${url.hash}`;
      }
    } catch (error) {
      if (error instanceof InviteUrlOriginMismatchError) {
        throw error;
      }
      if (error instanceof InvalidShareTokenError) {
        throw error;
      }
      // If parsing fails we fall back to manual extraction below.
    }
  }

  if (!shareToken) {
    shareToken = extractTokenFromInput(trimmedValue);
  }

  if (!shareToken) {
    throw new InvalidShareTokenError(
      "Invite input does not contain a share token fragment.",
    );
  }

  return {
    token: shareToken,
    canonicalValue,
    roomPathWithToken,
  };
}
