import { describe, expect, it } from "bun:test";

import type { Grid, Player } from "@/lib/game/types";
import { PlayerRole } from "@/lib/game/types";

import { analyseGuessConfirmationContext } from "./guessConfirmation";

const createGrid = (): Grid => ({
  id: "grid-test",
  name: "Test",
  rows: 2,
  columns: 2,
  cards: [
    { id: "card-a", label: "Alpha" },
    { id: "card-b", label: "Beta" },
    { id: "card-c", label: "Gamma" },
    { id: "card-d", label: "Delta" },
  ],
});

const createPlayer = (overrides: Partial<Player> = {}): Player => ({
  id: "player-local",
  name: "Local",
  role: PlayerRole.Host,
  flippedCardIds: [],
  ...overrides,
});

describe("analyseGuessConfirmationContext", () => {
  it("returns null when grid or player is missing", () => {
    expect(analyseGuessConfirmationContext(null, null, "card-a")).toBeNull();

    const grid = createGrid();
    expect(analyseGuessConfirmationContext(grid, null, "card-a")).toBeNull();

    const player = createPlayer();
    expect(analyseGuessConfirmationContext(null, player, "card-a")).toBeNull();
  });

  it("tracks the only remaining visible card when a new card is masked", () => {
    const grid = createGrid();
    const player = createPlayer({ flippedCardIds: ["card-b", "card-c"] });

    const result = analyseGuessConfirmationContext(grid, player, "card-d");
    expect(result).not.toBeNull();
    expect(result?.cardWasHiddenBeforeToggle).toBe(false);
    expect(result?.visibleCardIdsAfter).toEqual(["card-a"]);
    expect(result?.remainingVisibleCardId).toBe("card-a");
  });

  it("does not flag a guess when multiple cards stay visible", () => {
    const grid = createGrid();
    const player = createPlayer({ flippedCardIds: ["card-b"] });

    const result = analyseGuessConfirmationContext(grid, player, "card-c");
    expect(result).not.toBeNull();
    expect(result?.cardWasHiddenBeforeToggle).toBe(false);
    expect(result?.visibleCardIdsAfter.sort()).toEqual(
      ["card-a", "card-d"].sort(),
    );
    expect(result?.remainingVisibleCardId).toBeNull();
  });

  it("removes the toggled card from the hidden list when revealing it", () => {
    const grid = createGrid();
    const player = createPlayer({ flippedCardIds: ["card-b", "card-c"] });

    const result = analyseGuessConfirmationContext(grid, player, "card-b");
    expect(result).not.toBeNull();
    expect(result?.cardWasHiddenBeforeToggle).toBe(true);
    expect(result?.hiddenCardIdsAfter.sort()).toEqual(["card-c"].sort());
    expect(result?.remainingVisibleCardId).toBeNull();
  });
});
