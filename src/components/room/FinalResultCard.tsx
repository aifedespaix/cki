"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { selectWinner } from "@/lib/game/state";
import type { GameCard, GameState } from "@/lib/game/types";

import { getConclusionLabel } from "./roomLabels";

interface FinalResultCardProps {
  state: Extract<GameState, { status: "finished" }>;
  cardLookup: Map<string, GameCard>;
}

export function FinalResultCard({ state, cardLookup }: FinalResultCardProps) {
  const winner = selectWinner(state);
  const guess = state.finalGuess;
  const guessedCard = cardLookup.get(guess.cardId);
  const guesser = state.players.find((player) => player.id === guess.guesserId);
  const target = state.players.find(
    (player) => player.id === guess.targetPlayerId,
  );

  return (
    <Card className="border border-emerald-400/60 bg-emerald-500/10 shadow-sm dark:border-emerald-500/40 dark:bg-emerald-500/15">
      <CardHeader>
        <CardTitle>
          Victoire de {winner ? winner.name : "joueur inconnu"}
        </CardTitle>
        <CardDescription>{getConclusionLabel(state.reason)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-foreground">
          {guesser ? guesser.name : "Un joueur"} a tenté de deviner{" "}
          {guessedCard ? guessedCard.label : guess.cardId} chez{" "}
          {target ? target.name : "son adversaire"}.
        </p>
        <p className="text-muted-foreground">
          Tour {state.turn} —{" "}
          {guess.correct ? "réponse correcte." : "réponse incorrecte."}
        </p>
      </CardContent>
    </Card>
  );
}
