"use client";

import {
  AlertCircleIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  CopyIcon,
  CrownIcon,
  EyeIcon,
  EyeOffIcon,
  InfoIcon,
  PlayIcon,
  ShuffleIcon,
  TargetIcon,
  TimerIcon,
  UserCogIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  type ActionReplicator,
  createActionReplicator,
} from "@/lib/p2p/action-sync";
import {
  type ConnectionPhase,
  createPeer,
  PeerRole,
  type PeerRuntime,
} from "@/lib/p2p/peer";
import {
  GAME_PROTOCOL_NAMESPACE,
  type GameActionMessagePayload,
  type GameProtocolMessageMap,
  SUPPORTED_GAME_PROTOCOL_VERSIONS,
  validateGameActionMessage,
} from "@/lib/p2p/protocol";
import {
  buildInviteUrl,
  decodeGridFromToken,
  encodeGridToToken,
} from "@/lib/share/url";
import type { HostPreparationRecord } from "@/lib/storage/session";
import { loadHostPreparation } from "@/lib/storage/session";
import { cn, createRandomId } from "@/lib/utils";

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

interface RoomPeerCreationConfig {
  role: PeerRole;
  peerId: string;
  metadata: Record<string, unknown>;
}

interface RoomPeerRuntimeState {
  runtime: PeerRuntime<GameProtocolMessageMap> | null;
  peerId: string | null;
  remotePeerId: string | null;
  phase: ConnectionPhase;
  error: Error | null;
}

const createInitialPeerState = (): Omit<RoomPeerRuntimeState, "runtime"> => ({
  peerId: null,
  remotePeerId: null,
  phase: "idle",
  error: null,
});

const useRoomPeerRuntime = (
  config: RoomPeerCreationConfig | null,
  remotePeerId: string | null,
): RoomPeerRuntimeState => {
  const runtimeRef = useRef<PeerRuntime<GameProtocolMessageMap> | null>(null);
  const [state, setState] = useState<Omit<RoomPeerRuntimeState, "runtime">>(
    createInitialPeerState,
  );

  useEffect(() => {
    if (!config) {
      if (runtimeRef.current) {
        runtimeRef.current.destroy();
        runtimeRef.current = null;
      }
      setState(createInitialPeerState());
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const runtime = createPeer<GameProtocolMessageMap>({
      role: config.role,
      peerId: config.peerId,
      metadata: config.metadata,
      supportedProtocolVersions: SUPPORTED_GAME_PROTOCOL_VERSIONS,
    });
    runtimeRef.current = runtime;
    setState({
      peerId: runtime.peerId,
      remotePeerId: runtime.remotePeerId,
      phase: runtime.phase,
      error: null,
    });

    const offPeerOpen = runtime.events.on("peer/open", ({ peerId }) => {
      setState((previous) => ({ ...previous, peerId }));
    });
    const offRemote = runtime.events.on("connection/remote", ({ peerId }) => {
      setState((previous) => ({ ...previous, remotePeerId: peerId }));
    });
    const offPhase = runtime.events.on("connection/phase", ({ phase }) => {
      setState((previous) => ({ ...previous, phase }));
    });
    const offError = runtime.events.on("connection/error", ({ error }) => {
      setState((previous) => ({ ...previous, error, phase: "error" }));
    });
    const offDisconnected = runtime.events.on("connection/disconnected", () => {
      setState((previous) => ({
        ...previous,
        remotePeerId: null,
        phase: "reconnecting",
      }));
    });
    const offPeerClose = runtime.events.on("peer/close", () => {
      setState(createInitialPeerState());
    });

    return () => {
      offPeerOpen();
      offRemote();
      offPhase();
      offError();
      offDisconnected();
      offPeerClose();
      runtime.destroy();
      runtimeRef.current = null;
      setState(createInitialPeerState());
    };
  }, [config]);

  useEffect(() => {
    if (!config || config.role !== PeerRole.Guest) {
      return;
    }
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }
    if (!remotePeerId) {
      runtime.disconnect();
      return;
    }
    runtime.connect(remotePeerId).catch((error) => {
      setState((previous) => ({ ...previous, error, phase: "error" }));
    });
  }, [config, remotePeerId]);

  return {
    runtime: runtimeRef.current,
    peerId: state.peerId,
    remotePeerId: state.remotePeerId,
    phase: state.phase,
    error: state.error,
  };
};

interface InviteContext {
  hostId: string;
  hostName: string;
  grid: Grid;
}

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

type CopyStatus = "idle" | "copied" | "error";

interface HostIdentitySummary {
  id: string;
  name: string;
}

function InviteDialog({
  grid,
  roomId,
  host,
  canShare,
  allowJoin,
  canJoinAsPlayer,
  onJoin,
  isJoining,
}: {
  grid: Grid | null;
  roomId: string | null;
  host: HostIdentitySummary | null;
  canShare: boolean;
  allowJoin: boolean;
  canJoinAsPlayer: boolean;
  onJoin: (nickname: string) => void;
  isJoining: boolean;
}) {
  const [origin, setOrigin] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const [copyError, setCopyError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    setOrigin(window.location.origin);
  }, []);

  const sharePayload = useMemo(() => {
    if (!grid) {
      return { token: null as string | null, error: null as string | null };
    }
    try {
      const token = encodeGridToToken(grid);
      return { token, error: null };
    } catch (error) {
      console.error("Impossible de générer le code d’invitation.", error);
      return {
        token: null,
        error:
          error instanceof Error
            ? error.message
            : "Erreur inconnue lors de la génération du code.",
      };
    }
  }, [grid]);

  const inviteUrl = useMemo(() => {
    if (!sharePayload.token || !origin || !roomId || !host) {
      return null;
    }
    try {
      return buildInviteUrl(
        origin,
        { roomId, hostId: host.id, hostName: host.name },
        sharePayload.token,
      );
    } catch (error) {
      console.error("Impossible de construire l’URL d’invitation.", error);
      return null;
    }
  }, [origin, sharePayload.token, roomId, host]);

  useEffect(() => {
    if (inviteUrl === null) {
      setCopyStatus("idle");
      setCopyError(null);
      return;
    }
    setCopyStatus("idle");
    setCopyError(null);
  }, [inviteUrl]);

  useEffect(() => {
    if (copyStatus !== "copied") {
      return;
    }
    const timeout = window.setTimeout(() => {
      setCopyStatus("idle");
    }, 2500);
    return () => window.clearTimeout(timeout);
  }, [copyStatus]);

  const handleCopy = useCallback(async () => {
    if (!inviteUrl) {
      return;
    }
    if (
      typeof navigator === "undefined" ||
      !navigator.clipboard ||
      typeof navigator.clipboard.writeText !== "function"
    ) {
      setCopyStatus("error");
      setCopyError(
        "Copie automatique indisponible : sélectionnez le lien et copiez-le manuellement.",
      );
      return;
    }
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopyStatus("copied");
      setCopyError(null);
    } catch (error) {
      console.error("Impossible de copier le lien d’invitation.", error);
      setCopyStatus("error");
      setCopyError(
        "Impossible de copier automatiquement le lien. Sélectionnez-le et copiez-le manuellement.",
      );
    }
  }, [inviteUrl]);

  if (!grid) {
    return null;
  }

  const hasTokenError = Boolean(sharePayload.error);
  const invitePlaceholder = hasTokenError
    ? "Erreur lors de la génération du lien"
    : "Le lien apparaîtra ici dès qu’il est prêt.";
  const hostName = host?.name ?? "Hôte";
  const isSubmitting = isJoining;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <CopyIcon aria-hidden className="size-4" />
          Inviter
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Inviter un adversaire</DialogTitle>
          <DialogDescription>
            Partagez ce lien pour permettre à un joueur de rejoindre la salle et
            importer automatiquement le plateau « {grid.name} ».
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          <div className="space-y-2">
            <label
              htmlFor="invite-link"
              className="text-sm font-medium text-foreground"
            >
              Lien d’invitation
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <input
                id="invite-link"
                type="text"
                value={inviteUrl ?? ""}
                readOnly
                placeholder={invitePlaceholder}
                onFocus={(event) => event.currentTarget.select()}
                spellCheck={false}
                className="w-full flex-1 rounded-md border border-border/70 bg-background px-3 py-2 text-xs font-mono shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
                aria-invalid={hasTokenError || copyStatus === "error"}
                aria-describedby={
                  hasTokenError
                    ? "invite-link-error"
                    : copyStatus === "error" && copyError
                      ? "invite-link-copy-error"
                      : undefined
                }
                disabled={!canShare}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleCopy}
                disabled={!inviteUrl || !canShare}
                className="sm:w-auto sm:flex-none"
              >
                {copyStatus === "copied" ? (
                  <>
                    <CheckCircle2Icon aria-hidden className="mr-2 size-4" />
                    Lien copié
                  </>
                ) : (
                  <>
                    <CopyIcon aria-hidden className="mr-2 size-4" />
                    Copier
                  </>
                )}
              </Button>
            </div>
            {sharePayload.token ? (
              <p className="text-xs text-muted-foreground">
                Code compressé :{" "}
                <code className="break-all rounded bg-muted px-1 py-0.5">
                  {sharePayload.token}
                </code>
              </p>
            ) : null}
            {hasTokenError ? (
              <div
                id="invite-link-error"
                className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                aria-live="polite"
              >
                <AlertCircleIcon aria-hidden className="mt-0.5 size-4" />
                <span>
                  Impossible de générer le lien d’invitation.{" "}
                  {sharePayload.error}
                </span>
              </div>
            ) : canShare ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <ArrowRightIcon aria-hidden className="size-4" />
                Les invités peuvent ouvrir ce lien sur n’importe quel appareil
                pour importer automatiquement votre plateau.
              </p>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <EyeIcon aria-hidden className="size-4" />
                Seul l’hôte peut partager ce lien depuis cet appareil.
              </p>
            )}
            {copyStatus === "error" && copyError ? (
              <p
                id="invite-link-copy-error"
                className="text-sm text-destructive"
                aria-live="polite"
              >
                {copyError}
              </p>
            ) : null}
          </div>
          {allowJoin ? (
            <div className="space-y-4 border-t border-border/60 pt-4">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">
                  Rejoindre la salle de {hostName}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Sélectionnez votre rôle puis choisissez un pseudo si vous
                  souhaitez affronter l’hôte.
                </p>
                {!canJoinAsPlayer ? (
                  <p className="text-xs text-muted-foreground">
                    La place de joueur est déjà occupée. Vous pouvez néanmoins
                    observer la partie en tant que spectateur.
                  </p>
                ) : null}
              </div>
              <JoinAsGuestForm
                hostName={hostName}
                onJoin={onJoin}
                disabled={!allowJoin || isJoining}
                isSubmitting={isSubmitting}
                canJoinAsPlayer={canJoinAsPlayer}
              />
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type JoinRole = "player" | "spectator";

function JoinAsGuestForm({
  hostName,
  onJoin,
  disabled,
  isSubmitting,
  canJoinAsPlayer,
}: {
  hostName: string;
  onJoin: (nickname: string) => void;
  disabled: boolean;
  isSubmitting: boolean;
  canJoinAsPlayer: boolean;
}) {
  const [nickname, setNickname] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<JoinRole>(
    canJoinAsPlayer ? "player" : "spectator",
  );
  const roleFieldId = useId();
  const playerOptionId = `${roleFieldId}-player`;
  const spectatorOptionId = `${roleFieldId}-spectator`;

  useEffect(() => {
    if (!canJoinAsPlayer) {
      setSelectedRole("spectator");
    }
  }, [canJoinAsPlayer]);

  const handleRoleChange = useCallback((role: JoinRole) => {
    setSelectedRole(role);
    setLocalError(null);
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled || selectedRole !== "player") {
      return;
    }
    const trimmed = nickname.trim();
    if (!trimmed) {
      setLocalError("Veuillez renseigner un pseudo pour rejoindre la salle.");
      return;
    }
    try {
      onJoin(trimmed);
      setLocalError(null);
    } catch (error) {
      setLocalError(
        error instanceof Error
          ? error.message
          : "Impossible de rejoindre la salle. Réessayez dans un instant.",
      );
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-foreground">
          Choisissez comment participer
        </legend>
        <div className="space-y-2">
          <label
            htmlFor={playerOptionId}
            className={cn(
              "flex items-start gap-3 rounded-md border px-3 py-3 text-sm transition-colors",
              selectedRole === "player"
                ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                : "border-border/70 bg-background",
              canJoinAsPlayer && !disabled
                ? "cursor-pointer hover:border-primary/50 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
                : "cursor-not-allowed opacity-60",
            )}
          >
            <input
              id={playerOptionId}
              type="radio"
              name={`${roleFieldId}-role`}
              value="player"
              checked={selectedRole === "player"}
              onChange={() => handleRoleChange("player")}
              disabled={disabled || isSubmitting || !canJoinAsPlayer}
              className="mt-1 h-4 w-4 border-border/70 text-primary focus:ring-ring"
            />
            <div className="flex flex-col gap-1">
              <span className="font-medium text-foreground">Joueur</span>
              <span className="text-xs text-muted-foreground">
                Défiez l’hôte sur ce plateau personnalisé.
              </span>
              {!canJoinAsPlayer ? (
                <span className="text-xs text-destructive">
                  La place de joueur est déjà occupée.
                </span>
              ) : null}
            </div>
          </label>
          <label
            htmlFor={spectatorOptionId}
            className={cn(
              "flex items-start gap-3 rounded-md border px-3 py-3 text-sm transition-colors",
              selectedRole === "spectator"
                ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                : "border-border/70 bg-background",
              "cursor-pointer hover:border-primary/50 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
            )}
          >
            <input
              id={spectatorOptionId}
              type="radio"
              name={`${roleFieldId}-role`}
              value="spectator"
              checked={selectedRole === "spectator"}
              onChange={() => handleRoleChange("spectator")}
              className="mt-1 h-4 w-4 border-border/70 text-primary focus:ring-ring"
            />
            <div className="flex flex-col gap-1">
              <span className="font-medium text-foreground">Spectateur</span>
              <span className="text-xs text-muted-foreground">
                Observez la partie en direct sans interagir avec le plateau.
              </span>
            </div>
          </label>
        </div>
      </fieldset>

      {selectedRole === "player" ? (
        <>
          <div className="space-y-2">
            <label
              htmlFor="guest-nickname"
              className="text-sm font-medium text-foreground"
            >
              Votre pseudo
            </label>
            <input
              id="guest-nickname"
              type="text"
              value={nickname}
              onChange={(event) => {
                setNickname(event.target.value);
                if (localError) {
                  setLocalError(null);
                }
              }}
              onBlur={() => {
                if (!nickname.trim()) {
                  setLocalError(
                    "Un pseudo est nécessaire pour identifier chaque joueur.",
                  );
                }
              }}
              className="w-full rounded-md border border-border/70 bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Invité mystère"
              maxLength={40}
              autoComplete="off"
              disabled={disabled || isSubmitting}
            />
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Ce pseudo sera visible par les autres participants afin que votre
              adversaire sache qui a rejoint la salle.
            </p>
            <p>
              Vous pourrez le modifier ultérieurement depuis votre tableau de
              bord.
            </p>
          </div>
        </>
      ) : (
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Aucun pseudo n’est requis pour observer la partie.</p>
          <p>
            Fermez cette fenêtre pour suivre la partie en tant que spectateur.
          </p>
        </div>
      )}

      {localError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {localError}
        </div>
      ) : null}

      {selectedRole === "player" ? (
        <Button
          type="submit"
          disabled={disabled || isSubmitting || !canJoinAsPlayer}
        >
          <UsersIcon aria-hidden className="mr-2 size-4" />
          {isSubmitting ? "Connexion…" : `Rejoindre ${hostName}`}
        </Button>
      ) : (
        <DialogClose asChild>
          <Button type="button" variant="outline">
            <EyeIcon aria-hidden className="mr-2 size-4" />
            Observer la partie
          </Button>
        </DialogClose>
      )}
    </form>
  );
}
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

function ParticipantsDialog({
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
  const playerCount = players.length;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <UsersIcon aria-hidden className="size-4" />
          Participants ({playerCount}/2)
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Joueurs et spectateurs</DialogTitle>
          <DialogDescription>
            Consultez l’état des connexions en temps réel.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <UsersIcon aria-hidden className="size-4" />
              Joueurs connectés ({playerCount}/2)
            </div>
            <div className="flex flex-wrap gap-2">
              {playerCount > 0 ? (
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
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                État
              </span>
              <p className="text-sm font-medium text-foreground">
                {formatStatusLabel(status)}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Tour actuel
              </span>
              <p className="text-sm text-foreground">
                {turn !== null
                  ? `Tour ${turn}${
                      activePlayerName ? ` — ${activePlayerName}` : ""
                    }`
                  : "En attente de préparation"}
              </p>
            </div>
          </div>
          <div className="space-y-2 border-t border-border/60 pt-4">
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              Spectateurs ({spectators.length})
            </span>
            {spectators.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {spectators.map((spectator) => (
                  <li key={spectator.id}>
                    <Badge variant="secondary">{spectator.name}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aucun spectateur connecté pour le moment.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RoomInformationDialog({
  roomId,
  grid,
  status,
  hostName,
}: {
  roomId: string;
  grid: Grid;
  status: GameStatus;
  hostName: string | null;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <InfoIcon aria-hidden className="size-4" />
          Infos salle
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Informations sur la salle</DialogTitle>
          <DialogDescription>
            Récapitulatif du plateau et des paramètres de cette partie.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 text-sm">
          <div className="grid gap-3">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Identifiant
              </span>
              <code className="inline-flex items-center rounded bg-muted px-2 py-1 text-xs font-mono">
                {roomId}
              </code>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Plateau
              </span>
              <p className="text-foreground">
                {grid.name} — {grid.rows} × {grid.columns} ({grid.cards.length}{" "}
                cartes)
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Hôte
              </span>
              <p className="text-foreground">{hostName ?? "Hôte inconnu"}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                État
              </span>
              <p className="text-foreground">{formatStatusLabel(status)}</p>
            </div>
          </div>
          <p className="text-muted-foreground">
            La salle reste active tant que les participants conservent cette
            page ouverte. Les échanges se synchronisent directement entre
            appareils via une connexion chiffrée de navigateur à navigateur.
          </p>
        </div>
      </DialogContent>
    </Dialog>
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
        "flex h-full min-h-0 flex-col border-2 shadow-sm transition-colors",
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
      <CardContent className="flex flex-1 min-h-0 flex-col space-y-6 overflow-hidden">
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

        <div className="flex flex-1 min-h-0 flex-col space-y-3">
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
          <div className="min-h-0 flex-1 overflow-hidden">
            <ul
              className="grid h-full list-none gap-2 overflow-auto pr-1 sm:gap-3"
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
        </div>
      </CardContent>
    </Card>
  );
}

interface RoleSelectionSummary {
  name: string;
  details: string;
}

interface RoleSelectionScreenProps {
  gridSummary: RoleSelectionSummary | null;
  isAlreadyPlayer: boolean;
  isViewingAsSpectator: boolean;
  playerName: string | null;
  playerRole: PlayerRole | null;
  nickname: string;
  canJoinAsPlayer: boolean;
  isJoining: boolean;
  error: string | null;
  onNicknameChange(value: string): void;
  onConfirmPlayer(): void;
  onConfirmSpectator(): void;
}

function RoleSelectionScreen({
  gridSummary,
  isAlreadyPlayer,
  isViewingAsSpectator,
  playerName,
  playerRole,
  nickname,
  canJoinAsPlayer,
  isJoining,
  error,
  onNicknameChange,
  onConfirmPlayer,
  onConfirmSpectator,
}: RoleSelectionScreenProps) {
  const trimmedNickname = nickname.trim();
  const playerLabel = playerRole ? roleLabels[playerRole] : null;
  const joinDisabled =
    !canJoinAsPlayer || trimmedNickname.length === 0 || isJoining;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (joinDisabled) {
      return;
    }
    onConfirmPlayer();
  };

  return (
    <div className="full-height-page flex min-h-0 flex-1 flex-col items-center justify-center gap-10 py-12">
      <section className="flex flex-col items-center gap-3 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          <UsersIcon aria-hidden className="size-4" />
          Sélection du rôle
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Comment souhaitez-vous participer ?
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
          Choisissez de rejoindre la salle comme joueur actif ou d’observer la
          partie sans manipuler les plateaux.
        </p>
        {gridSummary ? (
          <p className="text-sm text-muted-foreground">
            Plateau « {gridSummary.name} » — {gridSummary.details}
          </p>
        ) : null}
      </section>

      <div className="grid w-full max-w-4xl gap-6 md:grid-cols-2">
        <Card className="border border-border/70">
          <CardHeader>
            <CardTitle>Rejoindre en tant que joueur</CardTitle>
            <CardDescription>
              Affrontez votre adversaire en manipulant votre plateau dédié.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isAlreadyPlayer ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Vous participez déjà en tant que
                  {playerLabel ? ` ${playerLabel.toLowerCase()}` : " joueur"}
                  {playerName ? ` « ${playerName} »` : ""}.
                </p>
                <p className="text-sm text-muted-foreground">
                  {isViewingAsSpectator
                    ? "Sélectionnez « Revenir en tant que joueur » pour reprendre le contrôle de votre plateau sur cet appareil."
                    : "Sélectionnez « Continuer en tant que joueur » pour accéder à votre plateau et finaliser la préparation."}
                </p>
                <Button type="button" onClick={onConfirmPlayer}>
                  <UsersIcon aria-hidden className="mr-2 size-4" />
                  {isViewingAsSpectator
                    ? "Revenir en tant que joueur"
                    : "Continuer en tant que joueur"}
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Prenez la prochaine place disponible pour affronter l’hôte.
                </p>
                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div className="space-y-2">
                    <label
                      htmlFor="role-selection-nickname"
                      className="text-sm font-medium text-foreground"
                    >
                      Votre pseudo
                    </label>
                    <input
                      id="role-selection-nickname"
                      type="text"
                      value={nickname}
                      onChange={(event) => onNicknameChange(event.target.value)}
                      className="w-full rounded-md border border-border/70 bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="Invité mystère"
                      maxLength={40}
                      autoComplete="off"
                      disabled={!canJoinAsPlayer || isJoining}
                    />
                    <p className="text-xs text-muted-foreground">
                      Ce pseudo identifie votre plateau pendant la partie.
                    </p>
                  </div>
                  {error ? (
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {error}
                    </div>
                  ) : null}
                  {!canJoinAsPlayer ? (
                    <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                      Les deux places de joueur sont déjà occupées. Choisissez
                      le mode spectateur pour suivre la partie.
                    </div>
                  ) : null}
                  <Button type="submit" disabled={joinDisabled}>
                    <UsersIcon aria-hidden className="mr-2 size-4" />
                    {isJoining ? "Connexion…" : "Rejoindre la partie"}
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border border-border/70">
          <CardHeader>
            <CardTitle>Observer la partie</CardTitle>
            <CardDescription>
              Suivez le déroulement en direct sans intervenir sur les plateaux.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Visualisez les cartes retournées en temps réel et les actions des
              joueurs sans impacter la partie. Vous pourrez tenter de rejoindre
              plus tard si une place se libère.
            </p>
            {isAlreadyPlayer && !isViewingAsSpectator ? (
              <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                Passer en mode spectateur désactive les interactions avec votre
                plateau sur cet appareil. Vous pourrez redevenir joueur à tout
                moment.
              </div>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={onConfirmSpectator}
            >
              <EyeIcon aria-hidden className="mr-2 size-4" />
              {isViewingAsSpectator
                ? "Continuer en spectateur"
                : "Observer la partie"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MissingOpponentBoard({ grid }: { grid: Grid | null }) {
  return (
    <Card className="flex h-full flex-col border-dashed border-border/70 bg-muted/20">
      <CardHeader>
        <CardTitle>En attente d’un adversaire</CardTitle>
        <CardDescription>
          {grid
            ? `Le plateau ${grid.rows} × ${grid.columns} est prêt à être partagé.`
            : "Configurez un plateau pour démarrer la partie."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-center gap-3">
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
  const searchParams = useSearchParams();
  const hostNameParam = searchParams?.get("hostName") ?? null;
  const hostIdParam = searchParams?.get("hostId") ?? null;

  const [hostPreparation, setHostPreparation] =
    useState<HostPreparationRecord | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState>(() =>
    createInitialState(),
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [spectators] = useState<readonly Spectator[]>([]);
  const [inviteContext, setInviteContext] = useState<InviteContext | null>(
    null,
  );
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteTokenResolved, setInviteTokenResolved] = useState(false);
  const [inviteGrid, setInviteGrid] = useState<Grid | null>(null);
  const [inviteTokenError, setInviteTokenError] = useState<string | null>(null);
  const [localGuestId] = useState(() => createRandomId("player"));
  const [localGuestName, setLocalGuestName] = useState<string | null>(null);
  const [isJoiningLobby, setIsJoiningLobby] = useState(false);
  const [isRoleSelectionOpen, setIsRoleSelectionOpen] = useState(true);
  const [viewAsSpectator, setViewAsSpectator] = useState(false);
  const [roleSelectionNickname, setRoleSelectionNickname] = useState("");
  const [roleSelectionError, setRoleSelectionError] = useState<string | null>(
    null,
  );
  const resolvedPeerRole = useMemo<PeerRole | null>(() => {
    if (loadState !== "ready") {
      return null;
    }
    if (hostPreparation) {
      return PeerRole.Host;
    }
    if (inviteContext) {
      return PeerRole.Guest;
    }
    return null;
  }, [loadState, hostPreparation, inviteContext]);
  const localPeerIdentifier = useMemo(() => {
    if (resolvedPeerRole === PeerRole.Host) {
      return hostPreparation?.hostId ?? null;
    }
    if (resolvedPeerRole === PeerRole.Guest) {
      return localGuestId;
    }
    return null;
  }, [resolvedPeerRole, hostPreparation, localGuestId]);
  const remotePeerIdentifier = useMemo(() => {
    if (resolvedPeerRole === PeerRole.Guest) {
      return inviteContext?.hostId ?? null;
    }
    return null;
  }, [resolvedPeerRole, inviteContext]);
  const peerMetadata = useMemo(() => {
    if (!resolvedPeerRole) {
      return null;
    }
    return {
      roomId,
      role: resolvedPeerRole,
      namespace: GAME_PROTOCOL_NAMESPACE,
    } satisfies RoomPeerCreationConfig["metadata"];
  }, [resolvedPeerRole, roomId]);
  const peerCreationConfig = useMemo(() => {
    if (!resolvedPeerRole || !localPeerIdentifier || !peerMetadata) {
      return null;
    }
    return {
      role: resolvedPeerRole,
      peerId: localPeerIdentifier,
      metadata: peerMetadata,
    } satisfies RoomPeerCreationConfig;
  }, [resolvedPeerRole, localPeerIdentifier, peerMetadata]);
  const peerConnection = useRoomPeerRuntime(
    peerCreationConfig,
    remotePeerIdentifier,
  );
  const replicatorRef = useRef<ActionReplicator | null>(null);
  const inviteHostName = useMemo(() => {
    const trimmed = hostNameParam?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : null;
  }, [hostNameParam]);
  const inviteHostId = useMemo(() => {
    const trimmed = hostIdParam?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : null;
  }, [hostIdParam]);
  const fallbackHostId = useMemo(
    () => createRandomId(roomId ? `host-${roomId}` : "host"),
    [roomId],
  );
  const derivedHostId = inviteHostId ?? fallbackHostId;
  const inviteHostNameFallback = useMemo(
    () => inviteHostName ?? "Hôte",
    [inviteHostName],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const readToken = () => {
      const hash = window.location.hash.slice(1);
      setInviteToken(hash ? hash : null);
    };

    readToken();
    window.addEventListener("hashchange", readToken);
    return () => window.removeEventListener("hashchange", readToken);
  }, []);

  useEffect(() => {
    setInviteTokenResolved(false);
    if (!inviteToken) {
      setInviteGrid(null);
      setInviteTokenError(null);
      setInviteTokenResolved(true);
      return;
    }
    try {
      const payload = decodeGridFromToken(inviteToken);
      setInviteGrid(payload.grid);
      setInviteTokenError(null);
    } catch (error) {
      setInviteGrid(null);
      setInviteTokenError(
        error instanceof Error
          ? error.message
          : "Le plateau partagé est invalide.",
      );
    } finally {
      setInviteTokenResolved(true);
    }
  }, [inviteToken]);

  useEffect(() => {
    setLoadState("loading");
    setLoadError(null);

    if (!roomId) {
      setHostPreparation(null);
      setInviteContext(null);
      setLoadError(
        "Identifiant de salle invalide. Retournez à la création pour recommencer.",
      );
      setLoadState("error");
      return;
    }

    const preparation = loadHostPreparation(roomId);
    if (!preparation) {
      if (!inviteTokenResolved) {
        return;
      }

      if (inviteGrid) {
        setHostPreparation(null);
        setInviteContext({
          hostId: derivedHostId,
          hostName: inviteHostNameFallback,
          grid: inviteGrid,
        });
        setLoadState("ready");
        return;
      }

      setHostPreparation(null);
      setInviteContext(null);
      const message = inviteTokenError
        ? `Le lien d’invitation est invalide : ${inviteTokenError}`
        : "Cette salle n’a pas été trouvée sur cet appareil. Demandez à l’hôte de renvoyer un lien depuis sa salle.";
      setLoadError(message);
      setLoadState("error");
      return;
    }

    setHostPreparation(preparation);
    setInviteContext(null);
    setLoadState("ready");
  }, [
    roomId,
    inviteTokenResolved,
    inviteGrid,
    inviteTokenError,
    derivedHostId,
    inviteHostNameFallback,
  ]);

  useEffect(() => {
    if (loadState !== "ready") {
      setGameState(createInitialState());
      return;
    }

    if (hostPreparation) {
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
      return;
    }

    if (inviteContext) {
      setActionError(null);
      setGameState(() => {
        try {
          return reduceGameState(createInitialState(), {
            type: "game/createLobby",
            payload: {
              grid: inviteContext.grid,
              host: {
                id: inviteContext.hostId,
                name: inviteContext.hostName,
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
      return;
    }

    setGameState(createInitialState());
  }, [hostPreparation, inviteContext, loadState]);

  useEffect(() => {
    if (!actionError) {
      return;
    }
    const timeout = window.setTimeout(() => setActionError(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [actionError]);

  useEffect(() => {
    const role = peerCreationConfig?.role ?? null;
    const runtime = peerConnection.runtime;
    const peerId = peerConnection.peerId ?? peerCreationConfig?.peerId ?? null;

    if (!runtime || !role || !peerId) {
      replicatorRef.current = null;
      return;
    }

    const sendMessage = (payload: GameActionMessagePayload) => {
      const validated = validateGameActionMessage(payload);
      runtime.send("game/action", validated);
    };

    const replicator = createActionReplicator({
      role,
      localPeerId: peerId,
      send: sendMessage,
      shouldDeferLocalApplication: (action) =>
        role === PeerRole.Guest && action.type === "game/joinLobby",
      generateActionId: () =>
        createRandomId(roomId ? `action-${roomId}` : "action"),
      onApply: (action, metadata) => {
        setGameState((previous) => {
          const next = reduceGameState(previous, action);
          return next;
        });
        setActionError(null);
        if (
          role === PeerRole.Guest &&
          metadata.source === "remote" &&
          action.type === "game/joinLobby" &&
          action.payload.player.id === localGuestId
        ) {
          setIsJoiningLobby(false);
        }
      },
      onError: (error, { action }) => {
        if (role === PeerRole.Guest && action.type === "game/joinLobby") {
          setIsJoiningLobby(false);
        }
        setActionError(error.message);
      },
      onAcknowledged: (_actionId, payload) => {
        if (
          role === PeerRole.Guest &&
          payload.acknowledgedByHost &&
          payload.action.type === "game/joinLobby" &&
          payload.action.payload.player.id === localGuestId
        ) {
          setIsJoiningLobby(false);
        }
      },
    });

    replicatorRef.current = replicator;

    return () => {
      if (replicatorRef.current === replicator) {
        replicatorRef.current = null;
      }
    };
  }, [
    peerConnection.runtime,
    peerConnection.peerId,
    peerCreationConfig,
    roomId,
    localGuestId,
  ]);

  useEffect(() => {
    const runtime = peerConnection.runtime;
    if (!runtime) {
      return;
    }
    const unsubscribe = runtime.onMessage("game/action", (message) => {
      try {
        const payload = validateGameActionMessage(message.payload);
        replicatorRef.current?.handleRemote(payload);
      } catch (error) {
        const details =
          error instanceof Error ? error.message : "Message distant invalide.";
        console.error("Invalid realtime action payload", error);
        setActionError(`Action distante invalide : ${details}`);
        if (resolvedPeerRole === PeerRole.Guest) {
          setIsJoiningLobby(false);
        }
      }
    });
    return () => {
      unsubscribe();
    };
  }, [peerConnection.runtime, resolvedPeerRole]);

  useEffect(() => {
    if (resolvedPeerRole !== PeerRole.Guest) {
      return;
    }
    if (peerConnection.phase === "error" && peerConnection.error) {
      setIsJoiningLobby(false);
      setActionError(
        peerConnection.error.message ??
          "Erreur de connexion directe. Réessayez plus tard.",
      );
    }
  }, [resolvedPeerRole, peerConnection.phase, peerConnection.error]);

  useEffect(() => {
    if (resolvedPeerRole !== PeerRole.Guest && isJoiningLobby) {
      setIsJoiningLobby(false);
    }
  }, [resolvedPeerRole, isJoiningLobby]);

  const applyGameAction = useCallback(
    (action: Action) => {
      const replicator = replicatorRef.current;
      if (!replicator) {
        if (resolvedPeerRole === PeerRole.Guest) {
          const error = new Error(
            "Connexion directe indisponible. Réessayez une fois la synchronisation établie.",
          );
          setActionError(error.message);
          throw error;
        }
        try {
          setGameState((previous) => {
            const next = reduceGameState(previous, action);
            return next;
          });
          setActionError(null);
          return;
        } catch (error) {
          if (error instanceof InvalidGameActionError) {
            setActionError(error.message);
            throw error;
          }
          if (error instanceof Error) {
            setActionError(error.message);
            throw error;
          }
          throw error;
        }
      }

      try {
        replicator.dispatch(action);
      } catch (error) {
        if (
          resolvedPeerRole === PeerRole.Guest &&
          action.type === "game/joinLobby"
        ) {
          setIsJoiningLobby(false);
        }
        if (error instanceof InvalidGameActionError) {
          setActionError(error.message);
          throw error;
        }
        if (error instanceof Error) {
          setActionError(error.message);
          throw error;
        }
        throw error;
      }
    },
    [resolvedPeerRole],
  );

  const players = useMemo(() => selectPlayers(gameState), [gameState]);
  useEffect(() => {
    if (hostPreparation) {
      if (localGuestName !== null) {
        setLocalGuestName(null);
      }
      return;
    }
    if (!inviteContext) {
      if (localGuestName !== null) {
        setLocalGuestName(null);
      }
      return;
    }
    const guestPlayer = players.find((player) => player.id === localGuestId);
    if (guestPlayer) {
      if (guestPlayer.name !== localGuestName) {
        setLocalGuestName(guestPlayer.name);
      }
      return;
    }
    if (localGuestName !== null) {
      setLocalGuestName(null);
    }
  }, [players, hostPreparation, inviteContext, localGuestId, localGuestName]);
  const canonicalLocalPlayerId = hostPreparation
    ? hostPreparation.hostId
    : localGuestName
      ? localGuestId
      : null;
  const canonicalLocalPlayer = useMemo(() => {
    if (!canonicalLocalPlayerId) {
      return null;
    }
    return (
      players.find((player) => player.id === canonicalLocalPlayerId) ?? null
    );
  }, [players, canonicalLocalPlayerId]);
  const canonicalLocalPlayerName = canonicalLocalPlayer?.name ?? null;
  const canonicalLocalPlayerRole = canonicalLocalPlayer?.role ?? null;
  useEffect(() => {
    if (!isRoleSelectionOpen) {
      return;
    }
    if (canonicalLocalPlayerName) {
      setRoleSelectionNickname(canonicalLocalPlayerName);
      return;
    }
    if (localGuestName) {
      setRoleSelectionNickname(localGuestName);
    }
  }, [isRoleSelectionOpen, canonicalLocalPlayerName, localGuestName]);
  const effectiveLocalPlayerId = viewAsSpectator
    ? null
    : canonicalLocalPlayerId;
  const localPlayer = useMemo(() => {
    if (!effectiveLocalPlayerId) {
      return null;
    }
    return (
      players.find((player) => player.id === effectiveLocalPlayerId) ?? null
    );
  }, [players, effectiveLocalPlayerId]);
  const isSpectatorView = viewAsSpectator || !localPlayer;

  const orderedPlayers = useMemo(() => {
    if (!effectiveLocalPlayerId) {
      return players;
    }
    const local = players.find(
      (player) => player.id === effectiveLocalPlayerId,
    );
    if (!local) {
      return players;
    }
    const others = players.filter(
      (player) => player.id !== effectiveLocalPlayerId,
    );
    return [local, ...others];
  }, [players, effectiveLocalPlayerId]);

  const grid = useMemo(() => {
    if (gameState.status === GameStatus.Idle) {
      if (hostPreparation) {
        return hostPreparation.grid;
      }
      return inviteContext?.grid ?? null;
    }
    return gameState.grid;
  }, [gameState, hostPreparation, inviteContext]);

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
        isLocal: effectiveLocalPlayerId === player.id,
        isActive: activePlayerId === player.id,
      })),
    [players, gameState, effectiveLocalPlayerId, activePlayerId],
  );

  const hostIdentityForInvite = useMemo(() => {
    if (hostPreparation) {
      return { id: hostPreparation.hostId, name: hostPreparation.nickname };
    }
    if (inviteContext) {
      return { id: inviteContext.hostId, name: inviteContext.hostName };
    }
    return null;
  }, [hostPreparation, inviteContext]);

  const normalizedRoomId = roomId ? roomId : null;
  const canShareInvite = Boolean(hostPreparation);
  const isInvitee = !hostPreparation && inviteContext !== null;
  const hasJoinedAsGuest = Boolean(localGuestName);
  const shouldShowJoinCard =
    isInvitee && !hasJoinedAsGuest && gameState.status === GameStatus.Lobby;
  const canJoinAsPlayer =
    gameState.status === GameStatus.Lobby && players.length < 2;

  const canHostStart =
    localPlayer?.role === PlayerRole.Host &&
    gameState.status === GameStatus.Lobby;
  const startDisabled = !canStartGame(gameState);
  const isLocalTurn =
    gameState.status === GameStatus.Playing &&
    Boolean(localPlayer) &&
    activePlayerId === localPlayer?.id;

  const handleJoinAsGuest = useCallback(
    (nickname: string) => {
      const trimmed = nickname.trim();
      if (!trimmed) {
        throw new Error(
          "Veuillez renseigner un pseudo pour rejoindre la salle.",
        );
      }
      setIsJoiningLobby(true);
      try {
        applyGameAction({
          type: "game/joinLobby",
          payload: { player: { id: localGuestId, name: trimmed } },
        });
      } catch (error) {
        setIsJoiningLobby(false);
        throw error;
      }
    },
    [applyGameAction, localGuestId],
  );
  const handleRoleSelectionNicknameChange = useCallback(
    (value: string) => {
      setRoleSelectionNickname(value);
      if (roleSelectionError) {
        setRoleSelectionError(null);
      }
    },
    [roleSelectionError],
  );
  const handleConfirmSpectatorRole = useCallback(() => {
    setViewAsSpectator(true);
    setIsRoleSelectionOpen(false);
    setRoleSelectionError(null);
  }, []);
  const handleConfirmPlayerRole = useCallback(() => {
    if (canonicalLocalPlayer) {
      setViewAsSpectator(false);
      setIsRoleSelectionOpen(false);
      setRoleSelectionError(null);
      return;
    }
    try {
      handleJoinAsGuest(roleSelectionNickname);
      setViewAsSpectator(false);
      setIsRoleSelectionOpen(false);
      setRoleSelectionError(null);
    } catch (error) {
      setRoleSelectionError(
        error instanceof Error
          ? error.message
          : "Impossible de rejoindre la salle. Réessayez dans un instant.",
      );
    }
  }, [canonicalLocalPlayer, handleJoinAsGuest, roleSelectionNickname]);
  const handleOpenRoleSelection = useCallback(() => {
    setRoleSelectionNickname(canonicalLocalPlayerName ?? localGuestName ?? "");
    setRoleSelectionError(null);
    setIsRoleSelectionOpen(true);
  }, [canonicalLocalPlayerName, localGuestName]);

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

  const roleSelectionGridSummary = {
    name: grid.name,
    details: `${grid.rows} × ${grid.columns} — ${grid.cards.length} cartes`,
  } satisfies RoleSelectionSummary;
  if (isRoleSelectionOpen) {
    return (
      <RoleSelectionScreen
        gridSummary={roleSelectionGridSummary}
        isAlreadyPlayer={Boolean(canonicalLocalPlayer)}
        isViewingAsSpectator={isSpectatorView}
        playerName={canonicalLocalPlayerName}
        playerRole={canonicalLocalPlayerRole}
        nickname={roleSelectionNickname}
        canJoinAsPlayer={canJoinAsPlayer}
        isJoining={isJoiningLobby}
        error={roleSelectionError}
        onNicknameChange={handleRoleSelectionNicknameChange}
        onConfirmPlayer={handleConfirmPlayerRole}
        onConfirmSpectator={handleConfirmSpectatorRole}
      />
    );
  }

  const hostPlayerName =
    playerSummaries.find((summary) => summary.player.role === PlayerRole.Host)
      ?.player.name ??
    hostIdentityForInvite?.name ??
    null;

  const summaryItems = [
    {
      key: "players",
      label: "Joueurs connectés",
      value: `${playerSummaries.length}/2`,
      icon: <UsersIcon aria-hidden className="size-4" />,
    },
    {
      key: "status",
      label: "État de la partie",
      value: formatStatusLabel(gameState.status),
      icon: <TargetIcon aria-hidden className="size-4" />,
    },
    {
      key: "turn",
      label: "Tour actuel",
      value:
        turn !== null
          ? `Tour ${turn}${activePlayerName ? ` — ${activePlayerName}` : ""}`
          : "Préparation en cours",
      icon: <TimerIcon aria-hidden className="size-4" />,
    },
    {
      key: "spectators",
      label: "Spectateurs",
      value: `${spectators.length}`,
      icon: <EyeIcon aria-hidden className="size-4" />,
    },
  ];

  return (
    <div className="full-height-page flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex basis-1/4 min-h-[25%] flex-col gap-6 overflow-auto rounded-2xl border border-border/70 bg-background/80 p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
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
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              onClick={handleOpenRoleSelection}
            >
              <UserCogIcon aria-hidden className="size-4" />
              Changer de rôle
            </Button>
            <ParticipantsDialog
              players={playerSummaries}
              spectators={spectators}
              status={gameState.status}
              turn={turn}
              activePlayerName={activePlayerName}
            />
            <InviteDialog
              grid={grid}
              roomId={normalizedRoomId}
              host={hostIdentityForInvite}
              canShare={canShareInvite}
              allowJoin={shouldShowJoinCard}
              canJoinAsPlayer={canJoinAsPlayer}
              onJoin={handleJoinAsGuest}
              isJoining={isJoiningLobby}
            />
            <RoomInformationDialog
              roomId={roomId}
              grid={grid}
              status={gameState.status}
              hostName={hostPlayerName}
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summaryItems.map((item) => (
            <div
              key={item.key}
              className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 p-3"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                {item.icon}
              </span>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  {item.label}
                </p>
                <p className="text-sm font-medium text-foreground">
                  {item.value}
                </p>
              </div>
            </div>
          ))}
        </div>
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
      </div>
      <div className="flex basis-3/4 min-h-0 flex-col gap-4 overflow-hidden">
        <div className="flex flex-1 flex-col gap-4 overflow-hidden xl:flex-row xl:gap-6">
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
              <div
                key={player.id}
                className="flex flex-1 min-h-[320px] flex-col overflow-hidden"
              >
                <PlayerBoard
                  player={player}
                  grid={grid}
                  accent={accent}
                  hiddenCardIds={hiddenCardIds}
                  secretCard={secretCard}
                  showSecretCard={showSecretCard}
                  allowSecretSelection={allowSecretSelection}
                  allowRandomSecret={allowRandomSecret}
                  allowCardToggle={allowCardToggle}
                  onSelectSecret={(cardId) =>
                    handleSelectSecret(player.id, cardId)
                  }
                  onRandomSecret={() => handleRandomSecret(player)}
                  onToggleCard={(cardId) => handleToggleCard(player.id, cardId)}
                  status={gameState.status}
                  isLocal={isLocal}
                  isActiveTurn={activePlayerId === player.id}
                  isSpectatorView={isSpectatorView}
                  ready={Boolean(player.secretCardId)}
                />
              </div>
            );
          })}
          {orderedPlayers.length < 2 ? (
            <div className="flex flex-1 min-h-[320px] flex-col overflow-hidden">
              <MissingOpponentBoard grid={grid} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
