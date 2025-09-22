import { describe, expect, it } from "bun:test";

import { gridSchema } from "@/lib/game/schema";
import type { Grid } from "@/lib/game/types";

import {
  buildInviteUrl,
  decodeGridFromToken,
  encodeGridToToken,
  extractTokenFromInput,
  InvalidShareTokenError,
  InviteUrlOriginMismatchError,
  normalizeInviteInput,
} from "./url";

const createSampleGrid = (): Grid => ({
  id: "grid-demo",
  name: "Grille de test",
  rows: 2,
  columns: 3,
  cards: [
    { id: "card-a", label: "Alpha" },
    { id: "card-b", label: "Beta" },
    { id: "card-c", label: "Gamma" },
    { id: "card-d", label: "Delta" },
    { id: "card-e", label: "Epsilon" },
    { id: "card-f", label: "Zeta" },
  ],
});

describe("share/url", () => {
  it("round-trips a grid through compression", () => {
    const grid = createSampleGrid();
    const token = encodeGridToToken(grid);
    const payload = decodeGridFromToken(token);

    expect(payload.grid).toEqual(gridSchema.parse(grid));
  });

  it("throws a dedicated error for malformed tokens", () => {
    expect(() => decodeGridFromToken("invalid")).toThrow(
      InvalidShareTokenError,
    );
  });

  it("builds a proper invite URL", () => {
    const token = "abc";
    const url = buildInviteUrl(
      "https://example.com",
      { roomId: "room-123", hostId: "player-host", hostName: "Alice" },
      token,
    );

    expect(url).toBe(
      "https://example.com/room/room-123?hostId=player-host&hostName=Alice&role=guest#abc",
    );
  });

  it("extracts tokens from URLs or raw values", () => {
    expect(extractTokenFromInput("token-value")).toBe("token-value");
    expect(extractTokenFromInput("https://example.com/join#token")).toBe(
      "token",
    );
    expect(extractTokenFromInput("   ")).toBeNull();
    expect(extractTokenFromInput("/#inline")).toBe("inline");
  });

  describe("normalizeInviteInput", () => {
    it("returns canonical data for a same-origin invite URL", () => {
      const result = normalizeInviteInput(
        "https://example.com/room/room-123?role=guest#token-123",
        "https://example.com",
      );

      expect(result).toEqual({
        token: "token-123",
        canonicalValue:
          "https://example.com/room/room-123?role=guest#token-123",
        roomPathWithToken: "/room/room-123?role=guest#token-123",
      });
    });

    it("normalises relative room paths using the current origin", () => {
      const result = normalizeInviteInput(
        "/room/demo#abc",
        "https://example.com",
      );

      expect(result).toEqual({
        token: "abc",
        canonicalValue: "https://example.com/room/demo#abc",
        roomPathWithToken: "/room/demo#abc",
      });
    });

    it("keeps tokens without URLs untouched", () => {
      const result = normalizeInviteInput("plain-token", "https://example.com");

      expect(result).toEqual({
        token: "plain-token",
        canonicalValue: "plain-token",
        roomPathWithToken: null,
      });
    });

    it("rejects invite URLs targeting a different origin", () => {
      expect(() =>
        normalizeInviteInput(
          "https://malicious.com/room/room-1#abc",
          "https://example.com",
        ),
      ).toThrow(InviteUrlOriginMismatchError);
    });

    it("does not expose a room path when the URL does not target a room", () => {
      const result = normalizeInviteInput(
        "https://example.com/join#token-value",
        "https://example.com",
      );

      expect(result).toEqual({
        token: "token-value",
        canonicalValue: "https://example.com/join#token-value",
        roomPathWithToken: null,
      });
    });
  });
});
