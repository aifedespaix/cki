import type { Grid, Player } from "@/lib/game/types";

export interface GuessConfirmationAnalysis {
  readonly cardWasHiddenBeforeToggle: boolean;
  readonly hiddenCardIdsAfter: readonly string[];
  readonly visibleCardIdsAfter: readonly string[];
  readonly remainingVisibleCardId: string | null;
}

export function analyseGuessConfirmationContext(
  grid: Grid | null,
  player: Player | null,
  cardId: string,
): GuessConfirmationAnalysis | null {
  if (!grid || !player) {
    return null;
  }

  const hiddenCardIds = new Set(player.flippedCardIds);
  const cardWasHiddenBeforeToggle = hiddenCardIds.has(cardId);

  if (cardWasHiddenBeforeToggle) {
    hiddenCardIds.delete(cardId);
  } else {
    hiddenCardIds.add(cardId);
  }

  const hiddenCardIdsAfter = Array.from(hiddenCardIds);
  const visibleCardIdsAfter = grid.cards
    .map((card) => card.id)
    .filter((id) => !hiddenCardIds.has(id));
  const remainingVisibleCardId =
    visibleCardIdsAfter.length === 1 ? (visibleCardIdsAfter[0] ?? null) : null;

  return {
    cardWasHiddenBeforeToggle,
    hiddenCardIdsAfter,
    visibleCardIdsAfter,
    remainingVisibleCardId,
  } satisfies GuessConfirmationAnalysis;
}
