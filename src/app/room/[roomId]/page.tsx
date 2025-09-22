"use client";

import {
  AlertCircleIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  CrownIcon,
  EyeIcon,
  EyeOffIcon,
  PlayIcon,
  ShuffleIcon,
  TargetIcon,
  TimerIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

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
import { Skeleton } from "@/components/ui/skeleton";
import {
  canStartGame,
  createInitialState,
  InvalidGameActionError,
  isPlayerReady,
  reduceGameState,
  selectActivePlayer,
  selectPlayers,
  selectWinner,
} from "@/lib/game/state";
import {
  type Action,
  type Card as GameCard,
  GameConclusionReason,
  type GameState,
  GameStatus,
  type Grid,
  type Player,
  PlayerRole,
} from "@/lib/game/types";
import type { HostPreparationRecord } from "@/lib/storage/session";
import { loadHostPreparation } from "@/lib/storage/session";
import { cn } from "@/lib/utils";

interface Spectator {
  id: string;
  name: string;
}

type PlayerBoardAccent = "self" | "opponent" | "neutral";

type PlayerSummary = {
  player: Player;
  ready: boolean;
  isLocal: boolean;
  isActive: boolean;
};

type LoadState = "idle" | "loading" | "ready" | "error";

const roleLabels: Record<PlayerRole, string> = {
  host: "Hôte",
  guest: "Invité",
};

const accentClasses: Record<PlayerBoardAccent, string> = {
  self: "border-sky-400/80 bg-sky-500/10 dark:border-sky-500/60 dark:bg-sky-500/15",
  opponent:
    "border-rose-400/80 bg-rose-500/10 dark:border-rose-500/60 dark:bg-rose-500/15",
  neutral: "border-border/70 bg-muted/40",
};

const formatStatusLabel = (status: GameStatus): string => {
  switch (status) {
    case GameStatus.Idle:
      return "Initialisation";
    case GameStatus.Lobby:
      return "Préparation de la partie";
    case GameStatus.Playing:
      return "En cours";
    case GameStatus.Finished:
      return "Partie terminée";
    default:
      return status;
  }
};

const getConclusionLabel = (reason: GameConclusionReason): string => {
  switch (reason) {
    case GameConclusionReason.CorrectGuess:
      return "Victoire sur bonne réponse";
    case GameConclusionReason.IncorrectGuess:
      return "Victoire par mauvaise réponse";
    default:
      return reason;
  }
};
function ParticipantChip({ summary }: { summary: PlayerSummary }) {
  const { player, ready, isLocal, isActive } = summary;
  return (
    <Badge
      key={player.id}
      variant={isLocal ? "default" : ready ? "secondary" : "outline"}
      className={cn(
        "flex items-center gap-1 px-3 py-1 text-sm",
        isActive ? "ring-2 ring-offset-1 ring-primary/60" : null,
      )}
      title={`${player.name} — ${roleLabels[player.role]}`}
    >
      {player.role === PlayerRole.Host ? (
        <CrownIcon aria-hidden className="size-3.5" />
      ) : (
        <UserIcon aria-hidden className="size-3.5" />
      )}
      <span className="font-medium">{player.name}</span>
      {ready ? (
        <CheckCircle2Icon aria-hidden className="size-3 text-emerald-500" />
      ) : null}
      {isLocal ? <span className="text-xs">(vous)</span> : null}
    </Badge>
  );
}

function ParticipantBanner({
  players,
  spectators,
  status,
  turn,
  activePlayerName,
}: {
  players: PlayerSummary[];
  spectators: readonly Spectator[];
  status: GameStatus;
  turn: number | null;
  activePlayerName: string | null;
}) {
  return (
    <section className="rounded-lg border border-border/70 bg-muted/30 p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <UsersIcon aria-hidden className="size-4" />
            Joueurs connectés ({players.length}/2)
          </div>
          <div className="flex flex-wrap gap-2">
            {players.length > 0 ? (
              players.map((summary) => (
                <ParticipantChip key={summary.player.id} summary={summary} />
              ))
            ) : (
              <span className="text-sm text-muted-foreground">
                Aucun joueur connecté pour le moment.
              </span>
            )}
          </div>
        </div>
        <div className="flex-1 min-w-[220px] space-y-3">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              État
            </span>
            <p className="text-sm font-medium text-foreground">
              {formatStatusLabel(status)}
            </p>
          </div>
          {turn !== null ? (
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Tour actuel
              </span>
              <p className="text-sm text-foreground">
                Tour {turn}
                {activePlayerName ? ` — ${activePlayerName}` : ""}
              </p>
            </div>
          ) : null}
        </div>
      </div>
      <div className="mt-5 border-t border-border/60 pt-4">
        <span className="text-xs font-semibold uppercase text-muted-foreground">
          Spectateurs ({spectators.length})
        </span>
        {spectators.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {spectators.map((spectator) => (
              <li key={spectator.id}>
                <Badge variant="secondary">{spectator.name}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Aucun spectateur connecté pour le moment.
          </p>
        )}
      </div>
    </section>
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

interface CardTileProps {
  card: GameCard;
  hidden: boolean;
  showSecretBadge: boolean;
  disabled: boolean;
  onClick?: () => void;
  actionLabel?: string;
  interactionType: "toggle" | "select" | "none";
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
  const ariaPressed =
    interactionType === "toggle"
      ? hidden
      : interactionType === "select" && showSecretBadge
        ? true
        : undefined;

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
interface PlayerBoardProps {
  player: Player;
  grid: Grid;
  accent: PlayerBoardAccent;
  hiddenCardIds: Set<string>;
  secretCard: GameCard | null;
  showSecretCard: boolean;
  allowSecretSelection: boolean;
  allowRandomSecret: boolean;
  allowCardToggle: boolean;
  onSelectSecret(cardId: string): void;
  onRandomSecret(): void;
  onToggleCard(cardId: string): void;
  status: GameStatus;
  isLocal: boolean;
  isActiveTurn: boolean;
  isSpectatorView: boolean;
  ready: boolean;
}

function PlayerBoard({
  player,
  grid,
  accent,
  hiddenCardIds,
  secretCard,
  showSecretCard,
  allowSecretSelection,
  allowRandomSecret,
  allowCardToggle,
  onSelectSecret,
  onRandomSecret,
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

  const interactionType: "toggle" | "select" | "none" = allowCardToggle
    ? "toggle"
    : allowSecretSelection
      ? "select"
      : "none";

  const handleCardInteraction = useCallback(
    (cardId: string) => {
      if (interactionType === "toggle") {
        onToggleCard(cardId);
      } else if (interactionType === "select") {
        onSelectSecret(cardId);
      }
    },
    [interactionType, onToggleCard, onSelectSecret],
  );

  const hiddenCount = hiddenCardIds.size;

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
        Choisissez une carte en cliquant sur le plateau ou utilisez la sélection
        aléatoire.
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
        "border-2 shadow-sm transition-colors",
        accentClasses[accent],
      )}
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
            {isActiveTurn ? (
              <Badge className="flex items-center gap-1 bg-primary/15 text-primary">
                <TimerIcon aria-hidden className="size-3.5" />
                Tour en cours
              </Badge>
            ) : null}
          </div>
        </div>
        <CardDescription>
          {grid.rows} × {grid.columns} — {grid.cards.length} cartes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <TargetIcon aria-hidden className="size-4 text-primary" />
              Carte secrète
            </h3>
            {allowSecretSelection ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onRandomSecret}
                disabled={!allowRandomSecret}
              >
                <ShuffleIcon aria-hidden className="mr-2 size-4" />
                Aléatoire
              </Button>
            ) : null}
          </div>
          {secretContent}
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground">
            <span>
              {hiddenCount} carte{hiddenCount > 1 ? "s" : ""} masquée
              {hiddenCount > 1 ? "s" : ""}
            </span>
            {status === GameStatus.Playing ? (
              <span>
                {isActiveTurn
                  ? "Vous pouvez manipuler vos cartes pendant ce tour."
                  : isLocal
                    ? "Tour de l’adversaire."
                    : "Tour en cours."}
              </span>
            ) : null}
          </div>
          <ul
            className="grid list-none gap-2 sm:gap-3"
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
                  : interactionType === "select"
                    ? `Sélectionner ${card.label} comme carte secrète`
                    : card.label;
              return (
                <li key={card.id} className="list-none">
                  <CardTile
                    card={card}
                    hidden={hidden}
                    showSecretBadge={showSecret}
                    disabled={disabled}
                    onClick={() => handleCardInteraction(card.id)}
                    actionLabel={actionLabel}
                    interactionType={interactionType}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function MissingOpponentBoard({ grid }: { grid: Grid | null }) {
  return (
    <Card className="border-dashed border-border/70 bg-muted/20">
      <CardHeader>
        <CardTitle>En attente d’un adversaire</CardTitle>
        <CardDescription>
          {grid
            ? `Le plateau ${grid.rows} × ${grid.columns} est prêt à être partagé.`
            : "Configurez un plateau pour démarrer la partie."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Invitez un joueur à rejoindre cette salle pour afficher son plateau et
          démarrer la partie.
        </p>
      </CardContent>
    </Card>
  );
}

function FinalResultCard({
  state,
  cardLookup,
}: {
  state: Extract<GameState, { status: typeof GameStatus.Finished }>;
  cardLookup: Map<string, GameCard>;
}) {
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
export default function RoomPage() {
  const params = useParams<{ roomId: string }>();
  const rawRoomId = params?.roomId;
  const roomId = typeof rawRoomId === "string" ? rawRoomId : "";

  const [hostPreparation, setHostPreparation] =
    useState<HostPreparationRecord | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState>(() =>
    createInitialState(),
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [spectators] = useState<readonly Spectator[]>([]);

  useEffect(() => {
    setLoadState("loading");
    setLoadError(null);

    if (!roomId) {
      setHostPreparation(null);
      setLoadError(
        "Identifiant de salle invalide. Retournez à la création pour recommencer.",
      );
      setLoadState("error");
      return;
    }

    const preparation = loadHostPreparation(roomId);
    if (!preparation) {
      setHostPreparation(null);
      setLoadError(
        "Cette salle n’a pas été trouvée sur cet appareil. Créez une nouvelle partie depuis la page de configuration.",
      );
      setLoadState("error");
      return;
    }

    setHostPreparation(preparation);
    setLoadState("ready");
  }, [roomId]);

  useEffect(() => {
    if (loadState !== "ready" || !hostPreparation) {
      setGameState(createInitialState());
      return;
    }

    setActionError(null);
    setGameState(() => {
      try {
        return reduceGameState(createInitialState(), {
          type: "game/createLobby",
          payload: {
            grid: hostPreparation.grid,
            host: {
              id: hostPreparation.hostId,
              name: hostPreparation.nickname,
            },
          },
        });
      } catch (error) {
        console.error("Impossible d'initialiser la salle.", error);
        setActionError(
          error instanceof Error
            ? error.message
            : "Impossible d'initialiser la salle de jeu.",
        );
        return createInitialState();
      }
    });
  }, [hostPreparation, loadState]);

  useEffect(() => {
    if (!actionError) {
      return;
    }
    const timeout = window.setTimeout(() => setActionError(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [actionError]);
  const applyGameAction = useCallback((action: Action) => {
    setGameState((previous) => {
      try {
        const next = reduceGameState(previous, action);
        setActionError(null);
        return next;
      } catch (error) {
        if (error instanceof InvalidGameActionError) {
          setActionError(error.message);
          return previous;
        }
        throw error;
      }
    });
  }, []);

  const players = useMemo(() => selectPlayers(gameState), [gameState]);
  const localPlayerId = hostPreparation?.hostId ?? null;
  const localPlayer = useMemo(() => {
    if (!localPlayerId) {
      return null;
    }
    return players.find((player) => player.id === localPlayerId) ?? null;
  }, [players, localPlayerId]);
  const isSpectatorView = !localPlayer;

  const orderedPlayers = useMemo(() => {
    if (!localPlayerId) {
      return players;
    }
    const local = players.find((player) => player.id === localPlayerId);
    if (!local) {
      return players;
    }
    const others = players.filter((player) => player.id !== localPlayerId);
    return [local, ...others];
  }, [players, localPlayerId]);

  const grid = useMemo(() => {
    if (gameState.status === GameStatus.Idle) {
      return hostPreparation?.grid ?? null;
    }
    return gameState.grid;
  }, [gameState, hostPreparation]);

  const cardLookup = useMemo(() => {
    if (!grid) {
      return new Map<string, GameCard>();
    }
    return new Map(grid.cards.map((card) => [card.id, card] as const));
  }, [grid]);

  const activePlayer = useMemo(
    () => selectActivePlayer(gameState),
    [gameState],
  );
  const activePlayerId = activePlayer?.id ?? null;
  const activePlayerName = activePlayer?.name ?? null;
  const turn =
    gameState.status === GameStatus.Playing ||
    gameState.status === GameStatus.Finished
      ? gameState.turn
      : null;

  const playerSummaries = useMemo(
    () =>
      players.map((player) => ({
        player,
        ready: isPlayerReady(gameState, player.id),
        isLocal: localPlayerId === player.id,
        isActive: activePlayerId === player.id,
      })),
    [players, gameState, localPlayerId, activePlayerId],
  );

  const canHostStart =
    localPlayer?.role === PlayerRole.Host &&
    gameState.status === GameStatus.Lobby;
  const startDisabled = !canStartGame(gameState);
  const isLocalTurn =
    gameState.status === GameStatus.Playing &&
    Boolean(localPlayer) &&
    activePlayerId === localPlayer?.id;

  const handleSelectSecret = useCallback(
    (playerId: string, cardId: string) => {
      if (!playerId || !cardId) {
        return;
      }
      applyGameAction({
        type: "game/setSecret",
        payload: { playerId, cardId },
      });
    },
    [applyGameAction],
  );

  const handleRandomSecret = useCallback(
    (player: Player) => {
      if (!grid || grid.cards.length === 0) {
        setActionError(
          "Aucune carte n’est disponible pour la sélection aléatoire.",
        );
        return;
      }
      const index = Math.floor(Math.random() * grid.cards.length);
      const randomCard = grid.cards[index];
      if (!randomCard) {
        setActionError("Aucune carte n’a pu être sélectionnée.");
        return;
      }
      applyGameAction({
        type: "game/setSecret",
        payload: { playerId: player.id, cardId: randomCard.id },
      });
    },
    [applyGameAction, grid],
  );

  const handleToggleCard = useCallback(
    (playerId: string, cardId: string) => {
      applyGameAction({
        type: "turn/flipCard",
        payload: { playerId, cardId },
      });
    },
    [applyGameAction],
  );

  const handleStartGame = useCallback(() => {
    if (!localPlayer) {
      return;
    }
    applyGameAction({
      type: "game/start",
      payload: { startingPlayerId: localPlayer.id },
    });
  }, [applyGameAction, localPlayer]);

  const handleEndTurn = useCallback(() => {
    if (!localPlayer) {
      return;
    }
    applyGameAction({
      type: "turn/end",
      payload: { playerId: localPlayer.id },
    });
  }, [applyGameAction, localPlayer]);

  const isLoading = loadState === "loading" || loadState === "idle";
  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-1/3" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <div className="grid gap-4 xl:grid-cols-2">
            <Skeleton className="h-[420px] w-full" />
            <Skeleton className="h-[420px] w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (loadState === "error" && loadError) {
    return (
      <div className="space-y-6">
        <Card className="border border-destructive/40 bg-destructive/10">
          <CardHeader className="flex flex-row items-start gap-3">
            <AlertCircleIcon
              aria-hidden
              className="mt-1 size-5 text-destructive"
            />
            <div className="space-y-1">
              <CardTitle className="text-lg text-destructive">
                Impossible d’ouvrir la salle
              </CardTitle>
              <CardDescription className="text-sm text-destructive">
                {loadError}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/create">Revenir à la configuration</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loadState === "ready" && !grid) {
    return (
      <div className="space-y-6">
        <Card className="border border-destructive/30 bg-destructive/5">
          <CardHeader className="flex flex-row items-start gap-3">
            <AlertCircleIcon
              aria-hidden
              className="mt-1 size-5 text-destructive"
            />
            <div className="space-y-1">
              <CardTitle className="text-lg text-destructive">
                Plateau introuvable
              </CardTitle>
              <CardDescription className="text-sm text-destructive">
                Le plateau associé à cette salle est introuvable. Retournez à la
                configuration pour créer une nouvelle partie.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/create">Créer une nouvelle salle</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!grid) {
    return null;
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          <UsersIcon aria-hidden className="size-4" />
          Salle KeyS
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Salle {roomId}
        </h1>
        <p className="text-base text-muted-foreground sm:text-lg">
          Gérez les plateaux, les joueurs et le déroulement de la partie.
        </p>
      </section>

      <ParticipantBanner
        players={playerSummaries}
        spectators={spectators}
        status={gameState.status}
        turn={turn}
        activePlayerName={activePlayerName}
      />

      {actionError ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircleIcon aria-hidden className="mt-0.5 size-4" />
          <span>{actionError}</span>
        </div>
      ) : null}

      {canHostStart ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {startDisabled
              ? "Chaque joueur doit choisir une carte secrète avant de commencer."
              : "Lancez la partie pour démarrer le premier tour."}
          </div>
          <Button
            type="button"
            onClick={handleStartGame}
            disabled={startDisabled}
          >
            <PlayIcon aria-hidden className="mr-2 size-4" />
            Démarrer le match
          </Button>
        </div>
      ) : null}

      {isLocalTurn ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background/80 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            Vous pouvez retourner vos cartes puis passer la main à votre
            adversaire.
          </div>
          <Button type="button" variant="outline" onClick={handleEndTurn}>
            <ArrowRightIcon aria-hidden className="mr-2 size-4" />
            Terminer le tour
          </Button>
        </div>
      ) : null}

      {gameState.status === GameStatus.Finished ? (
        <FinalResultCard state={gameState} cardLookup={cardLookup} />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        {orderedPlayers.map((player) => {
          const isLocal = localPlayer?.id === player.id;
          const accent: PlayerBoardAccent = isLocal
            ? "self"
            : localPlayer
              ? "opponent"
              : "neutral";
          const hiddenCardIds = new Set(player.flippedCardIds);
          const secretCard = player.secretCardId
            ? (cardLookup.get(player.secretCardId) ?? null)
            : null;
          const allowSecretSelection =
            isLocal && gameState.status === GameStatus.Lobby;
          const allowRandomSecret =
            allowSecretSelection && grid.cards.length > 0;
          const allowCardToggle =
            isLocal &&
            gameState.status === GameStatus.Playing &&
            activePlayerId === player.id;
          const showSecretCard = isSpectatorView || isLocal;

          return (
            <PlayerBoard
              key={player.id}
              player={player}
              grid={grid}
              accent={accent}
              hiddenCardIds={hiddenCardIds}
              secretCard={secretCard}
              showSecretCard={showSecretCard}
              allowSecretSelection={allowSecretSelection}
              allowRandomSecret={allowRandomSecret}
              allowCardToggle={allowCardToggle}
              onSelectSecret={(cardId) => handleSelectSecret(player.id, cardId)}
              onRandomSecret={() => handleRandomSecret(player)}
              onToggleCard={(cardId) => handleToggleCard(player.id, cardId)}
              status={gameState.status}
              isLocal={isLocal}
              isActiveTurn={activePlayerId === player.id}
              isSpectatorView={isSpectatorView}
              ready={Boolean(player.secretCardId)}
            />
          );
        })}
        {orderedPlayers.length < 2 ? (
          <MissingOpponentBoard grid={grid} />
        ) : null}
      </div>
    </div>
  );
}
