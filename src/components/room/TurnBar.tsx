"use client";

import {
  AlertCircleIcon,
  FastForwardIcon,
  PauseIcon,
  RotateCcwIcon,
  TimerIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { GameStatus } from "@/lib/game/types";
import { cn } from "@/lib/utils";

type HostControlConfig = {
  readonly onNextTurn?: () => void;
  readonly nextTurnDisabled: boolean;
  readonly onPause?: () => void;
  readonly pauseDisabled: boolean;
  readonly onResetRound?: () => void;
  readonly resetDisabled: boolean;
};

type GuessFailureSummary = {
  readonly guesserName: string;
  readonly targetName: string;
  readonly cardLabel: string;
};

type TurnBarProps = {
  readonly turn: number | null;
  readonly activePlayerName: string | null;
  readonly status: GameStatus;
  readonly isHost: boolean;
  readonly canEndTurn: boolean;
  readonly onEndTurn?: () => void;
  readonly hostControls: HostControlConfig;
  readonly lastGuessFailure?: GuessFailureSummary | null;
  readonly className?: string;
};

const statusLabels: Record<GameStatus, string> = {
  idle: "Salle inactive",
  lobby: "Préparation du match",
  playing: "Partie en cours",
  finished: "Match terminé",
};

function formatTurnSummary(
  turn: number | null,
  activePlayerName: string | null,
  status: GameStatus,
): string {
  if (status === "lobby") {
    return "En attente du début de la partie";
  }
  if (status === "idle") {
    return "Salle en veille";
  }
  if (turn === null) {
    return "Tour en attente";
  }
  if (!activePlayerName) {
    return `Tour ${turn}`;
  }
  return `Tour ${turn} — ${activePlayerName}`;
}

function TurnBar({
  turn,
  activePlayerName,
  status,
  isHost,
  canEndTurn,
  onEndTurn,
  hostControls,
  lastGuessFailure = null,
  className,
}: TurnBarProps) {
  const {
    onNextTurn,
    nextTurnDisabled,
    onPause,
    pauseDisabled,
    onResetRound,
    resetDisabled,
  } = hostControls;

  const turnSummary = formatTurnSummary(turn, activePlayerName, status);
  const statusLabel = statusLabels[status];
  const failureDescription = lastGuessFailure
    ? `${lastGuessFailure.guesserName} a annoncé ${lastGuessFailure.cardLabel}, mais ${lastGuessFailure.targetName} protégeait une autre carte.`
    : null;

  return (
    <div
      className={cn(
        "sticky bottom-4 z-20 w-full", // anchor near bottom by default
        className,
      )}
    >
      <div className="rounded-2xl border border-border/60 bg-background/95 px-4 py-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
              <TimerIcon aria-hidden className="size-4 text-primary" />
              {turnSummary}
            </span>
            <span className="text-xs text-muted-foreground">{statusLabel}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!isHost && canEndTurn && onEndTurn ? (
              <Button type="button" onClick={onEndTurn}>
                Terminer mon tour
              </Button>
            ) : null}
            {isHost ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  onClick={onNextTurn}
                  disabled={nextTurnDisabled || !onNextTurn}
                >
                  <FastForwardIcon aria-hidden className="mr-2 size-4" />
                  Tour suivant
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onPause}
                  disabled={pauseDisabled || !onPause}
                >
                  <PauseIcon aria-hidden className="mr-2 size-4" />
                  Pause
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onResetRound}
                  disabled={resetDisabled || !onResetRound}
                >
                  <RotateCcwIcon aria-hidden className="mr-2 size-4" />
                  Réinitialiser
                </Button>
              </div>
            ) : null}
          </div>
        </div>
        {failureDescription ? (
          <div className="mt-3 flex items-start gap-3 rounded-xl border border-destructive/50 bg-destructive/10 px-3 py-2">
            <AlertCircleIcon
              aria-hidden
              className="mt-0.5 size-4 text-destructive"
            />
            <div className="space-y-0.5 text-destructive">
              <p className="text-sm font-semibold">Proposition incorrecte</p>
              <p className="text-xs leading-relaxed text-destructive/90">
                {failureDescription}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export { TurnBar };
