import { describe, expect, it } from "bun:test";

import { gridSchema } from "@/lib/game/schema";
import type { Grid } from "@/lib/game/types";

import {
  buildInviteUrl,
  decodeGridFromToken,
  encodeGridToToken,
  extractTokenFromInput,
  InvalidShareTokenError,
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
});
