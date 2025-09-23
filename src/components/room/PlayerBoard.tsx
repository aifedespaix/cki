"use client";

import { EyeIcon, EyeOffIcon, TargetIcon, TimerIcon } from "lucide-react";
import { useMemo } from "react";

import { ImageSafe } from "@/components/common/ImageSafe";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { GameCard, Grid, Player } from "@/lib/game/types";
import { GameStatus } from "@/lib/game/types";
import { cn } from "@/lib/utils";

import { roleLabels } from "./roomLabels";

export type PlayerBoardAccent = "self" | "opponent" | "neutral";

const accentClasses: Record<PlayerBoardAccent, string> = {
  self: "border-sky-400/80 bg-sky-500/10 dark:border-sky-500/60 dark:bg-sky-500/15",
  opponent:
    "border-rose-400/80 bg-rose-500/10 dark:border-rose-500/60 dark:bg-rose-500/15",
  neutral: "border-border/70 bg-muted/40",
};

interface PlayerBoardProps {
  player: Player;
  grid: Grid;
  accent: PlayerBoardAccent;
  hiddenCardIds: Set<string>;
  secretCard: GameCard | null;
  showSecretCard: boolean;
  allowSecretSelection: boolean;
  allowCardToggle: boolean;
  onRequestSecretSelection?: () => void;
  onToggleCard(cardId: string): void;
  status: GameStatus;
  isLocal: boolean;
  isActiveTurn: boolean;
  isSpectatorView: boolean;
  ready: boolean;
}

export function PlayerBoard({
  player,
  grid,
  accent,
  hiddenCardIds,
  secretCard,
  showSecretCard,
  allowSecretSelection,
  allowCardToggle,
  onRequestSecretSelection,
  onToggleCard,
  status,
  isLocal,
  isActiveTurn,
  isSpectatorView,
  ready,
}: PlayerBoardProps) {
  const templateColumns = useMemo(
    () => `repeat(${grid.columns}, minmax(0, 1fr))`,
    [grid.columns],
  );

  const interactionType: "toggle" | "none" = allowCardToggle
    ? "toggle"
    : "none";
  const hiddenCount = hiddenCardIds.size;

  const activeTurnBadgeLabel = isActiveTurn
    ? isLocal
      ? "À vous de jouer"
      : isSpectatorView
        ? `Tour de ${player.name}`
        : "Tour de l’adversaire"
    : null;

  let playingStatusMessage: string | null = null;
  if (status === GameStatus.Playing) {
    if (isActiveTurn) {
      playingStatusMessage = isLocal
        ? "C’est à vous de jouer : masquez les cartes correspondantes ou annoncez une proposition."
        : isSpectatorView
          ? `Tour de ${player.name} — observez ses actions en direct.`
          : "Tour de votre adversaire : observez ses actions avant votre prochain tour.";
    } else {
      playingStatusMessage = isLocal
        ? "Tour de l’adversaire : observez son plateau pour préparer votre réponse."
        : isSpectatorView
          ? `En attente du prochain mouvement de ${player.name}.`
          : "Tour en cours : suivez les manipulations de votre adversaire.";
    }
  }

  let secretContent: React.ReactNode;
  if (secretCard && showSecretCard) {
    secretContent = <SecretCardPreview card={secretCard} />;
  } else if (secretCard) {
    secretContent = (
      <p className="text-sm text-muted-foreground">
        {isSpectatorView
          ? `Carte secrète sélectionnée : ${secretCard.label}.`
          : "Carte secrète sélectionnée et cachée pour l’adversaire."}
      </p>
    );
  } else if (allowSecretSelection) {
    secretContent = (
      <p className="text-sm text-muted-foreground">
        Choisissez une carte secrète à l’aide du sélecteur dédié pour pouvoir
        démarrer la partie.
      </p>
    );
  } else {
    secretContent = (
      <p className="text-sm text-muted-foreground">
        En attente que {player.name} choisisse sa carte secrète.
      </p>
    );
  }

  return (
    <Card
      className={cn(
        "flex h-full min-h-0 flex-col border-2 transition-colors transition-shadow",
        accentClasses[accent],
        isActiveTurn
          ? "shadow-lg ring-2 ring-primary/60 ring-offset-2 ring-offset-background"
          : "shadow-sm ring-1 ring-transparent ring-offset-2 ring-offset-background",
      )}
      data-active-turn={isActiveTurn ? "true" : "false"}
    >
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-lg font-semibold text-foreground">
            {isLocal ? "Votre plateau" : `Plateau de ${player.name}`}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="border-border/60 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {roleLabels[player.role]}
            </Badge>
            {isLocal ? (
              <Badge className="bg-sky-500/15 text-sky-600 dark:text-sky-300">
                Vous
              </Badge>
            ) : null}
            {ready ? (
              <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
                Prêt
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-dashed text-muted-foreground"
              >
                À préparer
              </Badge>
            )}
            {activeTurnBadgeLabel ? (
              <Badge className="flex items-center gap-1 bg-primary/15 text-primary">
                <TimerIcon aria-hidden className="size-3.5" />
                {activeTurnBadgeLabel}
              </Badge>
            ) : null}
          </div>
        </div>
        <CardDescription>
          {grid.rows} × {grid.columns} — {grid.cards.length} cartes
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 min-h-0 flex-col space-y-6 overflow-hidden">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <TargetIcon aria-hidden className="size-4 text-primary" />
              Carte secrète
            </h3>
            {allowSecretSelection && onRequestSecretSelection ? (
              <Button
                type="button"
                size="sm"
                onClick={onRequestSecretSelection}
              >
                {secretCard ? "Modifier" : "Choisir"} la carte secrète
              </Button>
            ) : null}
          </div>
          {secretContent}
        </div>

        <div className="flex flex-1 min-h-0 flex-col space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:justify-between">
            <span>
              {hiddenCount} carte{hiddenCount > 1 ? "s" : ""} masquée
              {hiddenCount > 1 ? "s" : ""}
            </span>
          </div>
          {playingStatusMessage ? (
            <p className="text-sm font-medium text-foreground">
              {playingStatusMessage}
            </p>
          ) : null}
          <div className="min-h-0 flex-1 overflow-hidden">
            <ul
              className="grid h-full list-none gap-2 overflow-hidden pr-1 sm:gap-3"
              style={{ gridTemplateColumns: templateColumns }}
              aria-label={`Plateau de ${player.name}`}
            >
              {grid.cards.map((card) => {
                const hidden = hiddenCardIds.has(card.id);
                const showSecret =
                  showSecretCard && player.secretCardId === card.id;
                const disabled = interactionType === "none";
                const actionLabel =
                  interactionType === "toggle"
                    ? hidden
                      ? `Révéler ${card.label}`
                      : `Masquer ${card.label}`
                    : card.label;
                const handleClick =
                  interactionType === "toggle"
                    ? () => onToggleCard(card.id)
                    : undefined;
                return (
                  <li key={card.id} className="list-none">
                    <CardTile
                      card={card}
                      hidden={hidden}
                      showSecretBadge={showSecret}
                      disabled={disabled}
                      onClick={handleClick}
                      actionLabel={actionLabel}
                      interactionType={interactionType}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface CardTileProps {
  card: GameCard;
  hidden: boolean;
  showSecretBadge: boolean;
  disabled: boolean;
  onClick?: () => void;
  actionLabel?: string;
  interactionType: "toggle" | "none";
}

function CardTile({
  card,
  hidden,
  showSecretBadge,
  disabled,
  onClick,
  actionLabel,
  interactionType,
}: CardTileProps) {
  const label = actionLabel ?? card.label;
  const ariaPressed = interactionType === "toggle" ? hidden : undefined;

  const content = (
    <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-background/90 p-3 shadow-sm transition-colors hover:border-border">
      <div className="relative aspect-square overflow-hidden rounded-md bg-muted">
        {card.imageUrl ? (
          <ImageSafe
            src={card.imageUrl}
            alt={card.label}
            className="absolute inset-0"
            imageProps={{
              sizes: "(min-width: 1280px) 180px, (min-width: 768px) 33vw, 50vw",
            }}
            fallback={
              <span className="absolute inset-0 flex items-center justify-center px-2 text-center text-xs text-destructive">
                Image indisponible
              </span>
            }
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center px-2 text-center text-xs text-muted-foreground">
            Aucun visuel
          </span>
        )}
        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-background/95 px-2 py-1 text-xs font-medium text-foreground shadow-sm">
          {hidden ? (
            <EyeOffIcon aria-hidden className="size-3.5" />
          ) : (
            <EyeIcon aria-hidden className="size-3.5" />
          )}
          <span>{hidden ? "Masquée" : "Visible"}</span>
        </div>
        {showSecretBadge ? (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground shadow">
            <TargetIcon aria-hidden className="size-3.5" />
            Carte secrète
          </div>
        ) : null}
        {hidden ? (
          <div
            className="absolute inset-0 bg-background/60 backdrop-blur-[1px]"
            aria-hidden
          />
        ) : null}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{card.label}</p>
        {card.description ? (
          <p className="text-xs text-muted-foreground">{card.description}</p>
        ) : null}
      </div>
    </div>
  );

  return (
    <button
      type="button"
      className={cn(
        "w-full text-left",
        disabled
          ? "cursor-default"
          : "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      )}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      aria-label={label}
      aria-pressed={ariaPressed}
    >
      {content}
    </button>
  );
}

function SecretCardPreview({ card }: { card: GameCard }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-border/60 bg-background/80 p-3 shadow-sm">
      <div className="relative h-16 w-16 overflow-hidden rounded-md bg-muted">
        {card.imageUrl ? (
          <ImageSafe
            src={card.imageUrl}
            alt={card.label}
            className="absolute inset-0"
            imageProps={{ sizes: "64px" }}
            fallback={
              <span className="absolute inset-0 flex items-center justify-center px-1 text-center text-xs text-destructive">
                Image indisponible
              </span>
            }
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center px-2 text-center text-xs text-muted-foreground">
            Aucun visuel
          </span>
        )}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">{card.label}</p>
        {card.description ? (
          <p className="text-xs text-muted-foreground">{card.description}</p>
        ) : null}
      </div>
    </div>
  );
}
