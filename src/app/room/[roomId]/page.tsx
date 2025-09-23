"use client";

import {
  AlertCircleIcon,
  EyeIcon,
  PlayIcon,
  TargetIcon,
  TimerIcon,
  UserCogIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DevPanel } from "@/components/app/DevPanel";
import {
  type HeaderActionState,
  useHeaderActionRegistration,
} from "@/components/app/HeaderActionsContext";
import { ActiveTurnNotice } from "@/components/room/ActiveTurnNotice";
import { BoardsArea, type BoardsLayout } from "@/components/room/BoardsArea";
import { FinalResultCard } from "@/components/room/FinalResultCard";
import {
  type HostIdentitySummary,
  InviteDialog,
} from "@/components/room/InviteDialog";
import { MissingOpponentBoard } from "@/components/room/MissingOpponentBoard";
import { ParticipantsSheet } from "@/components/room/ParticipantsSheet";
import {
  PlayerBoard,
  type PlayerBoardAccent,
} from "@/components/room/PlayerBoard";
import {
  RoleSelectionScreen,
  type RoleSelectionSummary,
} from "@/components/room/RoleSelectionScreen";
import { RoomInformationDialog } from "@/components/room/RoomInformationDialog";
import { formatStatusLabel } from "@/components/room/roomLabels";
import { TargetSelectionModal } from "@/components/room/TargetSelectionModal";
import { TurnBar } from "@/components/room/TurnBar";
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
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { useRenderMetrics } from "@/lib/debug/renderMetrics";
import { gameStateSchema } from "@/lib/game/schema";
import {
  canStartGame,
  createInitialState,
  InvalidGameActionError,
  isPlayerReady,
  reduceGameState,
  selectActivePlayer,
  selectPlayers,
} from "@/lib/game/state";
import {
  type Action,
  type Card as GameCard,
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
import { PeerRole } from "@/lib/p2p/peer";
import {
  GAME_PROTOCOL_NAMESPACE,
  GAME_PROTOCOL_VERSION,
  type GameActionMessagePayload,
  type SpectatorUpdateMessagePayload,
  validateGameActionMessage,
  validateSpectatorRosterMessage,
  validateSpectatorUpdateMessage,
} from "@/lib/p2p/protocol";
import { RemoteActionQueue } from "@/lib/p2p/remote-action-queue";
import {
  addOrUpdateSpectator,
  normaliseSpectatorName,
  normaliseSpectatorRoster,
  removeSpectatorById,
  type SpectatorProfile,
} from "@/lib/room/spectators";
import { decodeGridFromToken } from "@/lib/share/url";
import {
  loadPartySession,
  type PartySessionRecord,
  savePartySession,
} from "@/lib/storage/db";
import {
  type HostPreparationRecord,
  loadGuestSession,
  loadHostPreparation,
  persistGuestSession,
  persistLatestNickname,
  updateHostPreparation,
} from "@/lib/storage/session";
import { cn, createRandomId } from "@/lib/utils";
import { analyseGuessConfirmationContext } from "./guessConfirmation";
import {
  type RoomPeerCreationConfig,
  type RoomPeerRuntimeOptions,
  useRoomPeerRuntime,
} from "./hooks/useRoomPeerRuntime";

type PlayerSummary = {
  player: Player;
  ready: boolean;
  isLocal: boolean;
  isActive: boolean;
};

type LoadState = "idle" | "loading" | "ready" | "error";

interface InviteContext {
  hostId: string;
  hostName: string;
  grid: Grid;
}

interface GuessConfirmationRequest {
  playerId: string;
  targetPlayerId: string;
  candidateCardId: string;
  lastMaskedCardId: string;
}

type ActiveTurnNoticeContent = {
  readonly title: string;
  readonly description: string;
};

type RemoteDisconnectEvent = Parameters<
  NonNullable<RoomPeerRuntimeOptions["onRemoteDisconnect"]>
>[0];

const SECRET_SELECTION_REQUIREMENT_MESSAGE =
  "Chaque joueur doit choisir une carte secrète avant de commencer.";

export default function RoomPage() {
  const params = useParams<{ roomId: string }>();
  const rawRoomId = params?.roomId;
  const roomId = typeof rawRoomId === "string" ? rawRoomId : "";
  const searchParams = useSearchParams();
  const router = useRouter();
  const hostNameParam = searchParams?.get("hostName") ?? null;
  const hostIdParam = searchParams?.get("hostId") ?? null;
  const renderMetrics = useRenderMetrics();

  const [hostPreparation, setHostPreparation] =
    useState<HostPreparationRecord | null>(null);
  const [storedPartySession, setStoredPartySession] =
    useState<PartySessionRecord | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState>(() =>
    createInitialState(),
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [spectators, setSpectators] = useState<readonly SpectatorProfile[]>([]);
  const [secretSelectionPlayerId, setSecretSelectionPlayerId] = useState<
    string | null
  >(null);
  const [hasPromptedSecretSelection, setHasPromptedSecretSelection] =
    useState(false);
  const [guessConfirmationRequest, setGuessConfirmationRequest] =
    useState<GuessConfirmationRequest | null>(null);
  const [inviteContext, setInviteContext] = useState<InviteContext | null>(
    null,
  );
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteTokenResolved, setInviteTokenResolved] = useState(false);
  const [inviteGrid, setInviteGrid] = useState<Grid | null>(null);
  const [inviteTokenError, setInviteTokenError] = useState<string | null>(null);
  const [localGuestId, setLocalGuestId] = useState(() =>
    createRandomId("player"),
  );
  const [localGuestName, setLocalGuestName] = useState<string | null>(null);
  const [isJoiningLobby, setIsJoiningLobby] = useState(false);
  const [isRoleSelectionOpen, setIsRoleSelectionOpen] = useState(true);
  const [viewAsSpectator, setViewAsSpectator] = useState(false);
  const [roleSelectionNickname, setRoleSelectionNickname] = useState("");
  const [roleSelectionError, setRoleSelectionError] = useState<string | null>(
    null,
  );
  const { toast } = useToast();
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
  const remoteDisconnectHandlerRef =
    useRef<RoomPeerRuntimeOptions["onRemoteDisconnect"]>();
  const peerRuntimeOptions = useMemo<RoomPeerRuntimeOptions>(
    () => ({
      onRemoteDisconnect: (event) => {
        remoteDisconnectHandlerRef.current?.(event);
      },
    }),
    [],
  );
  const peerConnection = useRoomPeerRuntime(
    peerCreationConfig,
    remotePeerIdentifier,
    peerRuntimeOptions,
  );
  const replicatorRef = useRef<ActionReplicator | null>(null);
  const playersRef = useRef<readonly Player[]>([]);
  const pendingRemoteActionsRef = useRef<RemoteActionQueue | null>(null);
  const lastGuessNotificationKeyRef = useRef<string | null>(null);
  const hasAppliedStoredSessionRef = useRef(false);
  const hasInitialisedGameStateRef = useRef(false);
  const hasLoadedGuestSessionRef = useRef(false);
  const lastPersistedPartyStateRef = useRef<string | null>(null);
  const lastPersistedGuestSessionRef = useRef<string | null>(null);
  const spectatorPresencePendingRef =
    useRef<SpectatorUpdateMessagePayload | null>(null);
  const lastSentSpectatorPresenceRef = useRef<{
    spectatorId: string;
    name: string;
    present: boolean;
  } | null>(null);
  const activeSpectatorIdentityRef = useRef<SpectatorProfile | null>(null);
  const previousViewAsSpectatorRef = useRef(viewAsSpectator);
  if (!pendingRemoteActionsRef.current) {
    pendingRemoteActionsRef.current = new RemoteActionQueue();
  }
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
    hasAppliedStoredSessionRef.current = false;
    hasInitialisedGameStateRef.current = false;
    lastPersistedPartyStateRef.current = null;
    lastPersistedGuestSessionRef.current = null;
    hasLoadedGuestSessionRef.current = false;

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
    if (typeof window === "undefined") {
      return;
    }

    if (!roomId) {
      setStoredPartySession(null);
      return;
    }

    let cancelled = false;
    loadPartySession(roomId)
      .then((record) => {
        if (cancelled) {
          return;
        }
        setStoredPartySession(record);
      })
      .catch((error) => {
        console.error(
          "Impossible de charger la session locale de la partie.",
          error,
        );
      });

    return () => {
      cancelled = true;
    };
  }, [roomId]);

  useEffect(() => {
    if (loadState !== "ready") {
      hasAppliedStoredSessionRef.current = false;
      hasInitialisedGameStateRef.current = false;
      setGameState(createInitialState());
      return;
    }

    const tryRestoreFromSnapshot = (): boolean => {
      if (!storedPartySession) {
        return false;
      }

      try {
        const parsed = gameStateSchema.parse(storedPartySession.state);
        if (parsed.status === GameStatus.Idle) {
          return false;
        }

        if (hostPreparation) {
          if (
            parsed.hostId !== hostPreparation.hostId ||
            parsed.grid.id !== hostPreparation.grid.id
          ) {
            return false;
          }
        }

        if (!hostPreparation) {
          const hostPlayer = parsed.players.find(
            (player) => player.role === PlayerRole.Host,
          );
          const resolvedHostName =
            hostPlayer?.name ?? inviteContext?.hostName ?? "Hôte";

          if (inviteContext) {
            if (parsed.grid.id !== inviteContext.grid.id) {
              return false;
            }
            if (
              parsed.hostId !== inviteContext.hostId ||
              resolvedHostName !== inviteContext.hostName
            ) {
              setInviteContext({
                hostId: parsed.hostId,
                hostName: resolvedHostName,
                grid: parsed.grid,
              });
            }
          } else {
            setInviteContext({
              hostId: parsed.hostId,
              hostName: resolvedHostName,
              grid: parsed.grid,
            });
          }
        }

        setActionError(null);
        setGameState(parsed);
        return true;
      } catch (error) {
        console.error("Impossible de restaurer l’état de la partie.", error);
        return false;
      }
    };

    if (!hasAppliedStoredSessionRef.current && storedPartySession) {
      const restored = tryRestoreFromSnapshot();
      hasAppliedStoredSessionRef.current = true;
      if (restored) {
        hasInitialisedGameStateRef.current = true;
        return;
      }
    }

    if (hasInitialisedGameStateRef.current) {
      return;
    }

    const initialiseFromContext = () => {
      if (hostPreparation) {
        try {
          const nextState = reduceGameState(createInitialState(), {
            type: "game/createLobby",
            payload: {
              grid: hostPreparation.grid,
              host: {
                id: hostPreparation.hostId,
                name: hostPreparation.nickname,
              },
            },
          });
          setActionError(null);
          setGameState(nextState);
        } catch (error) {
          console.error("Impossible d'initialiser la salle.", error);
          setActionError(
            error instanceof Error
              ? error.message
              : "Impossible d'initialiser la salle de jeu.",
          );
          setGameState(createInitialState());
        }
        hasInitialisedGameStateRef.current = true;
        return;
      }

      if (inviteContext) {
        try {
          const nextState = reduceGameState(createInitialState(), {
            type: "game/createLobby",
            payload: {
              grid: inviteContext.grid,
              host: {
                id: inviteContext.hostId,
                name: inviteContext.hostName,
              },
            },
          });
          setActionError(null);
          setGameState(nextState);
        } catch (error) {
          console.error("Impossible d'initialiser la salle.", error);
          setActionError(
            error instanceof Error
              ? error.message
              : "Impossible d'initialiser la salle de jeu.",
          );
          setGameState(createInitialState());
        }
        hasInitialisedGameStateRef.current = true;
        return;
      }

      setGameState(createInitialState());
      hasInitialisedGameStateRef.current = true;
    };

    initialiseFromContext();
  }, [loadState, storedPartySession, hostPreparation, inviteContext]);

  useEffect(() => {
    if (loadState !== "ready" || hostPreparation) {
      if (loadState !== "ready") {
        hasLoadedGuestSessionRef.current = false;
        lastPersistedGuestSessionRef.current = null;
      }
      return;
    }

    if (hasLoadedGuestSessionRef.current) {
      return;
    }

    if (!roomId) {
      return;
    }

    const record = loadGuestSession(roomId);
    if (record) {
      setLocalGuestId(record.guestId);
      setLocalGuestName(record.nickname);
      setViewAsSpectator(record.viewAsSpectator);
      setIsRoleSelectionOpen(!record.roleSelectionCompleted);
      lastPersistedGuestSessionRef.current = JSON.stringify({
        roomId: record.roomId,
        guestId: record.guestId,
        nickname: record.nickname,
        viewAsSpectator: record.viewAsSpectator,
        roleSelectionCompleted: record.roleSelectionCompleted,
      });
    }

    hasLoadedGuestSessionRef.current = true;
  }, [loadState, hostPreparation, roomId]);

  useEffect(() => {
    if (!roomId || loadState !== "ready" || hostPreparation) {
      return;
    }

    if (!hasLoadedGuestSessionRef.current) {
      return;
    }

    const snapshot = {
      roomId,
      guestId: localGuestId,
      nickname: localGuestName,
      viewAsSpectator,
      roleSelectionCompleted: !isRoleSelectionOpen,
    } satisfies Parameters<typeof persistGuestSession>[0];

    const serialised = JSON.stringify(snapshot);
    if (lastPersistedGuestSessionRef.current === serialised) {
      return;
    }

    lastPersistedGuestSessionRef.current = serialised;
    persistGuestSession(snapshot);
  }, [
    roomId,
    loadState,
    hostPreparation,
    localGuestId,
    localGuestName,
    viewAsSpectator,
    isRoleSelectionOpen,
  ]);

  useEffect(() => {
    if (!roomId || loadState !== "ready") {
      return;
    }

    if (gameState.status === GameStatus.Idle) {
      return;
    }

    let serialised: string;
    try {
      serialised = JSON.stringify(gameState);
    } catch (error) {
      console.error(
        "Impossible de préparer la sauvegarde de l’état de partie.",
        error,
      );
      return;
    }

    if (lastPersistedPartyStateRef.current === serialised) {
      return;
    }

    lastPersistedPartyStateRef.current = serialised;
    void savePartySession({ id: roomId, state: gameState });
  }, [roomId, loadState, gameState]);

  useEffect(() => {
    if (!actionError) {
      return;
    }
    const timeout = window.setTimeout(() => setActionError(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [actionError]);

  const resetAfterRestart = useCallback(() => {
    hasInitialisedGameStateRef.current = false;
    setSecretSelectionPlayerId(null);
    setHasPromptedSecretSelection(false);
    setGuessConfirmationRequest(null);
    setActionError(null);
    setRoleSelectionError(null);
    setIsJoiningLobby(false);
    lastGuessNotificationKeyRef.current = null;
    if (hostPreparation) {
      setIsRoleSelectionOpen(false);
    } else {
      setIsRoleSelectionOpen(true);
    }
  }, [hostPreparation]);

  const handleRemoteProcessingError = useCallback(
    (error: unknown) => {
      const details =
        error instanceof Error ? error.message : "Message distant invalide.";
      console.error("Invalid realtime action payload", error);
      setActionError(`Action distante invalide : ${details}`);
      if (resolvedPeerRole === PeerRole.Guest) {
        setIsJoiningLobby(false);
      }
    },
    [resolvedPeerRole],
  );

  const processRemotePayload = useCallback(
    (payload: GameActionMessagePayload) => {
      const replicator = replicatorRef.current;
      if (!replicator) {
        pendingRemoteActionsRef.current?.enqueue(payload);
        return;
      }
      replicator.handleRemote(payload);
    },
    [],
  );

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
        if (action.type === "game/restart") {
          resetAfterRestart();
        }
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

    pendingRemoteActionsRef.current?.drain(
      (payload) => {
        replicator.handleRemote(payload);
      },
      (error) => {
        handleRemoteProcessingError(error);
      },
    );

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
    handleRemoteProcessingError,
    resetAfterRestart,
  ]);

  useEffect(() => {
    const runtime = peerConnection.runtime;
    if (!runtime) {
      return;
    }
    const unsubscribeGameAction = runtime.onMessage(
      "game/action",
      (message) => {
        try {
          const payload = validateGameActionMessage(message.payload);
          processRemotePayload(payload);
        } catch (error) {
          handleRemoteProcessingError(error);
        }
      },
    );
    const unsubscribeSpectatorUpdate = runtime.onMessage(
      "spectator/update",
      (message) => {
        if (
          resolvedPeerRole !== PeerRole.Host ||
          runtime.protocolVersion !== GAME_PROTOCOL_VERSION
        ) {
          return;
        }
        try {
          const payload = validateSpectatorUpdateMessage(message.payload);
          setSpectators((current) =>
            payload.present
              ? addOrUpdateSpectator(current, payload.spectator)
              : removeSpectatorById(current, payload.spectator.id),
          );
        } catch (error) {
          console.error("Payload spectateur distant invalide.", error);
        }
      },
    );
    const unsubscribeSpectatorRoster = runtime.onMessage(
      "spectator/roster",
      (message) => {
        if (
          resolvedPeerRole !== PeerRole.Guest ||
          runtime.protocolVersion !== GAME_PROTOCOL_VERSION
        ) {
          return;
        }
        try {
          const payload = validateSpectatorRosterMessage(message.payload);
          setSpectators(normaliseSpectatorRoster(payload.spectators));
        } catch (error) {
          console.error("Liste de spectateurs invalide.", error);
        }
      },
    );
    return () => {
      unsubscribeGameAction();
      unsubscribeSpectatorUpdate();
      unsubscribeSpectatorRoster();
    };
  }, [
    peerConnection.runtime,
    processRemotePayload,
    handleRemoteProcessingError,
    resolvedPeerRole,
  ]);

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

  const handleRemotePeerDisconnected = useCallback(
    (event: RemoteDisconnectEvent) => {
      if (resolvedPeerRole !== PeerRole.Host) {
        return;
      }
      const peerId = event.peerId;
      if (!peerId) {
        return;
      }
      const participantPresent = playersRef.current.some(
        (player) => player.id === peerId,
      );
      if (!participantPresent) {
        return;
      }
      try {
        applyGameAction({
          type: "game/leave",
          payload: { playerId: peerId },
        });
        setSpectators((current) => removeSpectatorById(current, peerId));
      } catch (error) {
        console.error("Impossible de retirer le joueur déconnecté.", error);
        if (error instanceof Error) {
          setActionError(error.message);
        }
      }
    },
    [applyGameAction, resolvedPeerRole],
  );

  useEffect(() => {
    remoteDisconnectHandlerRef.current = handleRemotePeerDisconnected;
  }, [handleRemotePeerDisconnected]);

  const players = useMemo(() => selectPlayers(gameState), [gameState]);
  useEffect(() => {
    playersRef.current = players;
  }, [players]);
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
  const isLocalHost = resolvedPeerRole === PeerRole.Host;
  const trimmedRoleSelectionNickname = useMemo(
    () => roleSelectionNickname.trim(),
    [roleSelectionNickname],
  );
  const localSpectatorId = useMemo(() => {
    if (canonicalLocalPlayerId) {
      return canonicalLocalPlayerId;
    }
    if (hostPreparation) {
      return hostPreparation.hostId;
    }
    return localGuestId;
  }, [canonicalLocalPlayerId, hostPreparation, localGuestId]);
  const localSpectatorProfile = useMemo<SpectatorProfile | null>(() => {
    if (!localSpectatorId) {
      return null;
    }
    const candidateName =
      canonicalLocalPlayerName ??
      localGuestName ??
      (hostPreparation ? hostPreparation.nickname : null) ??
      (trimmedRoleSelectionNickname.length > 0
        ? trimmedRoleSelectionNickname
        : null) ??
      "";
    return {
      id: localSpectatorId,
      name: normaliseSpectatorName(candidateName, localSpectatorId),
    } satisfies SpectatorProfile;
  }, [
    localSpectatorId,
    canonicalLocalPlayerName,
    localGuestName,
    hostPreparation,
    trimmedRoleSelectionNickname,
  ]);
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
  useEffect(() => {
    activeSpectatorIdentityRef.current =
      viewAsSpectator && localSpectatorProfile ? localSpectatorProfile : null;
  }, [viewAsSpectator, localSpectatorProfile]);
  const emitSpectatorPresence = useCallback(
    (profile: SpectatorProfile, present: boolean) => {
      if (resolvedPeerRole !== PeerRole.Guest) {
        return;
      }
      const runtime = peerConnection.runtime;
      const protocolVersion = runtime?.protocolVersion;
      const payload: SpectatorUpdateMessagePayload = {
        spectator: profile,
        present,
        issuedAt: Date.now(),
      };
      const lastSent = lastSentSpectatorPresenceRef.current;
      if (
        lastSent &&
        lastSent.spectatorId === profile.id &&
        lastSent.present === present &&
        lastSent.name === profile.name
      ) {
        return;
      }
      if (!runtime || protocolVersion !== GAME_PROTOCOL_VERSION) {
        spectatorPresencePendingRef.current = payload;
      } else {
        try {
          runtime.send("spectator/update", payload);
          spectatorPresencePendingRef.current = null;
        } catch (error) {
          console.error(
            "Impossible d’envoyer la mise à jour de présence spectateur.",
            error,
          );
          spectatorPresencePendingRef.current = payload;
        }
      }
      lastSentSpectatorPresenceRef.current = {
        spectatorId: profile.id,
        name: profile.name,
        present,
      };
    },
    [peerConnection.runtime, resolvedPeerRole],
  );
  useEffect(() => {
    if (resolvedPeerRole !== PeerRole.Guest) {
      spectatorPresencePendingRef.current = null;
      lastSentSpectatorPresenceRef.current = null;
      return;
    }
    const runtime = peerConnection.runtime;
    if (!runtime || runtime.protocolVersion !== GAME_PROTOCOL_VERSION) {
      return;
    }
    const pending = spectatorPresencePendingRef.current;
    if (!pending) {
      return;
    }
    try {
      runtime.send("spectator/update", pending);
      lastSentSpectatorPresenceRef.current = {
        spectatorId: pending.spectator.id,
        name: pending.spectator.name,
        present: pending.present,
      };
      spectatorPresencePendingRef.current = null;
    } catch (error) {
      console.error(
        "Impossible d’envoyer la mise à jour de présence spectateur.",
        error,
      );
    }
  }, [peerConnection.runtime, resolvedPeerRole]);
  useEffect(() => {
    const identity = localSpectatorProfile;
    if (!identity) {
      return;
    }
    const previouslyViewing = previousViewAsSpectatorRef.current;
    previousViewAsSpectatorRef.current = viewAsSpectator;

    if (viewAsSpectator) {
      setSpectators((current) => addOrUpdateSpectator(current, identity));
      if (resolvedPeerRole === PeerRole.Guest) {
        emitSpectatorPresence(identity, true);
      }
      return;
    }

    if (previouslyViewing) {
      setSpectators((current) => removeSpectatorById(current, identity.id));
      if (resolvedPeerRole === PeerRole.Guest) {
        emitSpectatorPresence(identity, false);
      }
      return;
    }

    if (resolvedPeerRole === PeerRole.Guest) {
      emitSpectatorPresence(identity, false);
    }
  }, [
    emitSpectatorPresence,
    localSpectatorProfile,
    resolvedPeerRole,
    viewAsSpectator,
  ]);
  useEffect(() => {
    if (resolvedPeerRole !== PeerRole.Host) {
      return;
    }
    const runtime = peerConnection.runtime;
    if (!runtime || runtime.protocolVersion !== GAME_PROTOCOL_VERSION) {
      return;
    }
    try {
      runtime.send("spectator/roster", {
        spectators,
        issuedAt: Date.now(),
      });
    } catch (error) {
      console.error("Impossible de diffuser la liste des spectateurs.", error);
    }
  }, [peerConnection.runtime, resolvedPeerRole, spectators]);
  useEffect(() => {
    return () => {
      if (resolvedPeerRole !== PeerRole.Guest) {
        return;
      }
      const runtime = peerConnection.runtime;
      if (!runtime || runtime.protocolVersion !== GAME_PROTOCOL_VERSION) {
        return;
      }
      const identity = activeSpectatorIdentityRef.current;
      if (!identity) {
        return;
      }
      try {
        runtime.send("spectator/update", {
          spectator: identity,
          present: false,
          issuedAt: Date.now(),
        });
      } catch (error) {
        console.warn("Impossible de notifier le départ du spectateur.", error);
      }
    };
  }, [peerConnection.runtime, resolvedPeerRole]);
  useEffect(() => {
    if (resolvedPeerRole !== PeerRole.Host) {
      return;
    }
    if (peerConnection.phase === "connected") {
      return;
    }
    setSpectators((current) => {
      if (viewAsSpectator && localSpectatorProfile) {
        const next = addOrUpdateSpectator([], localSpectatorProfile);
        if (
          current.length === next.length &&
          current.every(
            (entry, index) =>
              entry.id === next[index]?.id && entry.name === next[index]?.name,
          )
        ) {
          return current;
        }
        return next;
      }
      if (!viewAsSpectator) {
        return current.length > 0 ? [] : current;
      }
      return current;
    });
  }, [
    resolvedPeerRole,
    peerConnection.phase,
    viewAsSpectator,
    localSpectatorProfile,
  ]);
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
  const localPlayerId = localPlayer?.id ?? null;
  const isSpectatorView = viewAsSpectator || !localPlayer;
  const hasLocalPlayer = Boolean(localPlayer);

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

  useEffect(() => {
    const selectableCardCount = grid?.cards.length ?? 0;
    const hasSelectableCards = selectableCardCount > 0;

    if (!localPlayer || isSpectatorView || !hasSelectableCards) {
      if (secretSelectionPlayerId) {
        setSecretSelectionPlayerId(null);
      }
      setHasPromptedSecretSelection(false);
      return;
    }

    const needsSecretSelection =
      gameState.status === GameStatus.Lobby && !localPlayer.secretCardId;

    if (needsSecretSelection) {
      if (!hasPromptedSecretSelection) {
        setSecretSelectionPlayerId((current) => current ?? localPlayer.id);
        setHasPromptedSecretSelection(true);
      }
      return;
    }

    if (hasPromptedSecretSelection) {
      setHasPromptedSecretSelection(false);
    }
  }, [
    gameState.status,
    grid,
    hasPromptedSecretSelection,
    isSpectatorView,
    localPlayer,
    secretSelectionPlayerId,
  ]);

  const cardLookup = useMemo(() => {
    if (!grid) {
      return new Map<string, GameCard>();
    }
    return new Map(grid.cards.map((card) => [card.id, card] as const));
  }, [grid]);

  const lastGuessFailureSummary = useMemo(() => {
    if (gameState.status !== GameStatus.Playing) {
      return null;
    }
    const result = gameState.lastGuessResult;
    if (!result || result.correct) {
      return null;
    }
    const guesserName =
      players.find((player) => player.id === result.guesserId)?.name ??
      "Un joueur";
    const targetName =
      players.find((player) => player.id === result.targetPlayerId)?.name ??
      "l’adversaire";
    const cardLabel = cardLookup.get(result.cardId)?.label ?? "cette carte";

    return {
      guesserName,
      targetName,
      cardLabel,
    };
  }, [cardLookup, gameState, players]);

  useEffect(() => {
    if (gameState.status !== GameStatus.Playing) {
      lastGuessNotificationKeyRef.current = null;
      return;
    }
    const result = gameState.lastGuessResult;
    if (!result || result.correct || !lastGuessFailureSummary) {
      lastGuessNotificationKeyRef.current = null;
      return;
    }

    const guessKey = `${gameState.turn}:${result.guesserId}:${result.cardId}`;
    if (lastGuessNotificationKeyRef.current === guessKey) {
      return;
    }

    toast({
      title: "Proposition incorrecte",
      description: `${lastGuessFailureSummary.guesserName} a annoncé ${lastGuessFailureSummary.cardLabel}, mais ${lastGuessFailureSummary.targetName} protégeait une autre carte.`,
    });
    lastGuessNotificationKeyRef.current = guessKey;
  }, [gameState, lastGuessFailureSummary, toast]);

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

  const playerSummaries = useMemo<PlayerSummary[]>(
    () =>
      players.map((player) => ({
        player,
        ready: isPlayerReady(gameState, player.id),
        isLocal: effectiveLocalPlayerId === player.id,
        isActive: activePlayerId === player.id,
      })),
    [players, gameState, effectiveLocalPlayerId, activePlayerId],
  );

  const hostIdentityForInvite = useMemo<HostIdentitySummary | null>(() => {
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
  const handleLeave = useCallback(() => {
    if (typeof window !== "undefined") {
      const shouldLeave = window.confirm(
        "Voulez-vous quitter la salle ? Vous pourrez la rejoindre plus tard grâce au lien d’invitation.",
      );
      if (!shouldLeave) {
        return;
      }
    }
    router.push("/");
  }, [router]);
  const leaveHeaderAction = useMemo<HeaderActionState>(
    () => ({
      leave: {
        label: "Quitter la salle",
        ariaLabel: "Quitter la salle et revenir à l’accueil",
        onActivate: handleLeave,
      },
    }),
    [handleLeave],
  );
  useHeaderActionRegistration(leaveHeaderAction);
  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const htmlElement = document.documentElement;
    const bodyElement = document.body;
    if (!bodyElement || !htmlElement) {
      return;
    }
    bodyElement.classList.add("room-screen-active");
    htmlElement.classList.add("room-screen-html");
    return () => {
      bodyElement.classList.remove("room-screen-active");
      htmlElement.classList.remove("room-screen-html");
    };
  }, []);
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

  const activeTurnNotice = useMemo<ActiveTurnNoticeContent | null>(() => {
    if (gameState.status !== GameStatus.Playing) {
      return null;
    }
    if (!activePlayer) {
      return null;
    }

    if (isLocalTurn) {
      return {
        title: "À vous de jouer",
        description:
          "Les deux plateaux restent visibles pour vous et les spectateurs : masquez les cartes qui ne correspondent pas ou annoncez votre proposition.",
      };
    }

    const playerName = activePlayer.name;
    if (isSpectatorView) {
      return {
        title: `Tour de ${playerName}`,
        description:
          "Les deux plateaux sont affichés pour que les spectateurs suivent chaque action en direct.",
      };
    }

    return {
      title: `Tour de ${playerName}`,
      description:
        "Observez votre adversaire : les deux plateaux restent visibles pendant son tour afin de préparer votre prochaine action.",
    };
  }, [activePlayer, gameState.status, isLocalTurn, isSpectatorView]);

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
    if (canonicalLocalPlayer) {
      try {
        applyGameAction({
          type: "game/leave",
          payload: { playerId: canonicalLocalPlayer.id },
        });
      } catch (error) {
        setRoleSelectionError(
          error instanceof Error
            ? error.message
            : "Impossible de libérer la place du joueur. Réessayez dans un instant.",
        );
        return;
      }
    }
    setViewAsSpectator(true);
    setIsRoleSelectionOpen(false);
    setRoleSelectionError(null);
  }, [applyGameAction, canonicalLocalPlayer]);
  const handleConfirmPlayerRole = useCallback(() => {
    const trimmedNickname = roleSelectionNickname.trim();
    if (!trimmedNickname) {
      setRoleSelectionError(
        "Veuillez renseigner un pseudo pour rejoindre la salle.",
      );
      return;
    }

    if (canonicalLocalPlayer) {
      const shouldUpdateName = trimmedNickname !== canonicalLocalPlayer.name;
      if (shouldUpdateName) {
        try {
          applyGameAction({
            type: "game/updatePlayerName",
            payload: {
              playerId: canonicalLocalPlayer.id,
              name: trimmedNickname,
            },
          });
        } catch (error) {
          setRoleSelectionError(
            error instanceof Error
              ? error.message
              : "Impossible de mettre à jour le pseudo. Réessayez dans un instant.",
          );
          return;
        }

        if (hostPreparation && canonicalLocalPlayer.role === PlayerRole.Host) {
          const updatedPreparation: HostPreparationRecord = {
            ...hostPreparation,
            nickname: trimmedNickname,
          };
          setHostPreparation(updatedPreparation);
          try {
            updateHostPreparation(updatedPreparation);
          } catch (storageError) {
            console.error(
              "Impossible de mettre à jour le pseudo de l’hôte dans le stockage local.",
              storageError,
            );
          }
        }
      }

      if (canonicalLocalPlayer.role === PlayerRole.Host) {
        try {
          persistLatestNickname(trimmedNickname);
        } catch (storageError) {
          console.error(
            "Impossible de mémoriser le dernier pseudo utilisé.",
            storageError,
          );
        }
      }

      setRoleSelectionNickname(trimmedNickname);
      setViewAsSpectator(false);
      setIsRoleSelectionOpen(false);
      setRoleSelectionError(null);
      return;
    }

    try {
      handleJoinAsGuest(trimmedNickname);
      setRoleSelectionNickname(trimmedNickname);
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
  }, [
    canonicalLocalPlayer,
    handleJoinAsGuest,
    roleSelectionNickname,
    hostPreparation,
    applyGameAction,
  ]);
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

  const handleConfirmSecretSelection = useCallback(
    (cardId: string) => {
      if (!secretSelectionPlayerId) {
        return;
      }
      handleSelectSecret(secretSelectionPlayerId, cardId);
      setSecretSelectionPlayerId(null);
    },
    [handleSelectSecret, secretSelectionPlayerId],
  );

  const handleSecretSelectionOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setSecretSelectionPlayerId(null);
    }
  }, []);

  const handleToggleCard = useCallback(
    (playerId: string, cardId: string) => {
      const player = players.find((entry) => entry.id === playerId) ?? null;
      const analysis = analyseGuessConfirmationContext(grid, player, cardId);

      applyGameAction({
        type: "turn/flipCard",
        payload: { playerId, cardId },
      });

      if (
        !analysis ||
        analysis.cardWasHiddenBeforeToggle ||
        !localPlayerId ||
        localPlayerId !== playerId ||
        gameState.status !== GameStatus.Playing ||
        activePlayerId !== playerId
      ) {
        return;
      }

      const remainingVisibleCardId = analysis.remainingVisibleCardId;
      if (!remainingVisibleCardId) {
        return;
      }

      const targetPlayer = players.find((entry) => entry.id !== playerId);
      if (!targetPlayer) {
        return;
      }

      setGuessConfirmationRequest({
        playerId,
        targetPlayerId: targetPlayer.id,
        candidateCardId: remainingVisibleCardId,
        lastMaskedCardId: cardId,
      });
    },
    [
      activePlayerId,
      applyGameAction,
      gameState.status,
      grid,
      localPlayerId,
      players,
    ],
  );

  const handlePromoteSpectator = useCallback(
    (spectatorId: string) => {
      if (!isLocalHost) {
        return;
      }
      const spectator = spectators.find((entry) => entry.id === spectatorId);
      if (!spectator) {
        setActionError("Spectateur introuvable.");
        return;
      }
      if (gameState.status !== GameStatus.Lobby) {
        setActionError(
          "La promotion n’est possible que pendant la phase de préparation.",
        );
        return;
      }
      if (players.length >= 2) {
        setActionError(
          "Les deux places de joueur sont déjà occupées. Libérez une place avant de promouvoir un spectateur.",
        );
        return;
      }
      try {
        applyGameAction({
          type: "game/joinLobby",
          payload: {
            player: { id: spectator.id, name: spectator.name },
          },
        });
        setSpectators((current) => removeSpectatorById(current, spectatorId));
      } catch (error) {
        setActionError(
          error instanceof Error
            ? error.message
            : "Impossible de promouvoir ce spectateur.",
        );
      }
    },
    [
      applyGameAction,
      gameState.status,
      isLocalHost,
      players.length,
      spectators,
    ],
  );

  const handleConfirmGuess = useCallback(() => {
    if (!guessConfirmationRequest) {
      return;
    }
    const { playerId, targetPlayerId, candidateCardId } =
      guessConfirmationRequest;
    if (!localPlayerId || localPlayerId !== playerId) {
      setGuessConfirmationRequest(null);
      return;
    }
    applyGameAction({
      type: "turn/guess",
      payload: {
        playerId,
        targetPlayerId,
        cardId: candidateCardId,
      },
    });
    setGuessConfirmationRequest(null);
  }, [applyGameAction, guessConfirmationRequest, localPlayerId]);

  const handleCancelGuess = useCallback(() => {
    let revertError: unknown = null;
    setGuessConfirmationRequest((current) => {
      if (!current) {
        return null;
      }
      if (localPlayerId && localPlayerId === current.playerId) {
        const player =
          players.find((entry) => entry.id === current.playerId) ?? null;
        const shouldRestore =
          player?.flippedCardIds.includes(current.lastMaskedCardId) ?? false;
        if (shouldRestore) {
          try {
            applyGameAction({
              type: "turn/flipCard",
              payload: {
                playerId: current.playerId,
                cardId: current.lastMaskedCardId,
              },
            });
          } catch (error) {
            revertError = error;
            return current;
          }
        }
      }
      return null;
    });
    if (revertError) {
      throw revertError;
    }
  }, [applyGameAction, localPlayerId, players]);

  const handleGuessDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        handleCancelGuess();
      }
    },
    [handleCancelGuess],
  );

  const handleKickSpectator = useCallback(
    (spectatorId: string) => {
      if (!isLocalHost) {
        return;
      }
      setSpectators((current) => removeSpectatorById(current, spectatorId));
    },
    [isLocalHost],
  );

  const handleKickPlayer = useCallback(
    (playerId: string) => {
      if (!isLocalHost) {
        return;
      }
      const target = players.find((player) => player.id === playerId);
      if (!target) {
        setActionError("Participant introuvable.");
        return;
      }
      try {
        applyGameAction({
          type: "game/leave",
          payload: { playerId },
        });
        setSpectators((current) => removeSpectatorById(current, playerId));
        toast({
          title: "Joueur retiré",
          description: `${target.name} a été expulsé de la partie.`,
        });
      } catch (error) {
        setActionError(
          error instanceof Error
            ? error.message
            : "Impossible d’expulser ce joueur. Réessayez dans un instant.",
        );
      }
    },
    [applyGameAction, isLocalHost, players, toast],
  );

  const handleStartGame = useCallback(() => {
    if (!canHostStart) {
      return;
    }
    if (!localPlayerId) {
      return;
    }
    if (startDisabled) {
      setActionError(SECRET_SELECTION_REQUIREMENT_MESSAGE);
      return;
    }
    applyGameAction({
      type: "game/start",
      payload: { startingPlayerId: localPlayerId },
    });
  }, [applyGameAction, canHostStart, localPlayerId, startDisabled]);

  const handleEndTurn = useCallback(() => {
    if (!localPlayer) {
      return;
    }
    applyGameAction({
      type: "turn/end",
      payload: { playerId: localPlayer.id },
    });
  }, [applyGameAction, localPlayer]);

  const handleRestartMatch = useCallback(() => {
    if (gameState.status === GameStatus.Idle) {
      return;
    }
    applyGameAction({ type: "game/restart" });
    resetAfterRestart();
  }, [applyGameAction, gameState.status, resetAfterRestart]);

  const boardItems = useMemo(() => {
    if (!grid) {
      return [] as Array<{ key: string; content: ReactNode }>;
    }

    const items: Array<{ key: string; content: ReactNode }> =
      orderedPlayers.map((player) => {
        const isLocal = localPlayer?.id === player.id;
        const accent: PlayerBoardAccent = isLocal
          ? "self"
          : hasLocalPlayer
            ? "opponent"
            : "neutral";
        const hiddenCardIds = new Set(player.flippedCardIds);
        const secretCard = player.secretCardId
          ? (cardLookup.get(player.secretCardId) ?? null)
          : null;
        const allowSecretSelection =
          isLocal && gameState.status === GameStatus.Lobby;
        const allowCardToggle =
          isLocal &&
          gameState.status === GameStatus.Playing &&
          activePlayerId === player.id;
        const showSecretCard = isSpectatorView || isLocal;
        const onRequestSecretSelection = allowSecretSelection
          ? () => setSecretSelectionPlayerId(player.id)
          : undefined;

        return {
          key: `player-${player.id}`,
          content: (
            <PlayerBoard
              player={player}
              grid={grid}
              accent={accent}
              hiddenCardIds={hiddenCardIds}
              secretCard={secretCard}
              showSecretCard={showSecretCard}
              allowSecretSelection={allowSecretSelection}
              allowCardToggle={allowCardToggle}
              onRequestSecretSelection={onRequestSecretSelection}
              onToggleCard={(cardId) => handleToggleCard(player.id, cardId)}
              status={gameState.status}
              isLocal={isLocal}
              isActiveTurn={activePlayerId === player.id}
              isSpectatorView={isSpectatorView}
              ready={Boolean(player.secretCardId)}
            />
          ),
        };
      });

    while (items.length < 2) {
      items.push({
        key: `placeholder-${items.length}`,
        content: <MissingOpponentBoard grid={grid} />,
      });
    }

    return items;
  }, [
    orderedPlayers,
    localPlayer?.id,
    hasLocalPlayer,
    grid,
    cardLookup,
    gameState.status,
    isSpectatorView,
    activePlayerId,
    handleToggleCard,
  ]);

  const [boardsLayout, setBoardsLayout] = useState<BoardsLayout>("horizontal");
  const handleBoardsLayoutChange = useCallback((layout: BoardsLayout) => {
    setBoardsLayout((previous) => (previous === layout ? previous : layout));
  }, []);
  const isBoardsStacked = boardsLayout === "vertical";
  const utilityPanelStyle = isBoardsStacked
    ? { height: "clamp(240px, 35dvh, 360px)" }
    : { width: "clamp(280px, 28vw, 360px)" };

  const guessConfirmationCandidateCard = useMemo(() => {
    if (!guessConfirmationRequest) {
      return null;
    }
    return cardLookup.get(guessConfirmationRequest.candidateCardId) ?? null;
  }, [cardLookup, guessConfirmationRequest]);
  const guessConfirmationTargetPlayer = useMemo(() => {
    if (!guessConfirmationRequest) {
      return null;
    }
    return (
      players.find(
        (player) => player.id === guessConfirmationRequest.targetPlayerId,
      ) ?? null
    );
  }, [guessConfirmationRequest, players]);
  const isGuessConfirmationOpen = Boolean(guessConfirmationRequest);
  const guessConfirmationTargetName =
    guessConfirmationTargetPlayer?.name ?? "l’adversaire";
  const guessConfirmationCandidateLabel =
    guessConfirmationCandidateCard?.label ?? "ce personnage";

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
        canEditExistingPlayerNickname={isLocalHost}
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

  const statusLabel = formatStatusLabel(gameState.status);
  const turnLabel =
    turn !== null
      ? `Tour ${turn}${activePlayerName ? ` — ${activePlayerName}` : ""}`
      : "Préparation en cours";

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
      value: statusLabel,
      icon: <TargetIcon aria-hidden className="size-4" />,
    },
    {
      key: "turn",
      label: "Tour actuel",
      value: turnLabel,
      icon: <TimerIcon aria-hidden className="size-4" />,
    },
    {
      key: "spectators",
      label: "Spectateurs",
      value: `${spectators.length}`,
      icon: <EyeIcon aria-hidden className="size-4" />,
    },
  ];

  const canPromoteSpectators =
    isLocalHost && gameState.status === GameStatus.Lobby && players.length < 2;
  const canKickPlayers = isLocalHost && gameState.status === GameStatus.Lobby;

  const secretSelectionPlayer = secretSelectionPlayerId
    ? (players.find((player) => player.id === secretSelectionPlayerId) ?? null)
    : null;

  const secretSelectionPlayerName = secretSelectionPlayer?.name ?? "ce joueur";
  const secretSelectionCurrentCardId =
    secretSelectionPlayer?.secretCardId ?? null;
  const secretSelectionCards = grid?.cards ?? [];
  const isSecretSelectionOpen = Boolean(
    secretSelectionPlayer && secretSelectionCards.length > 0,
  );

  const canEndTurnButton = !isLocalHost && isLocalTurn && Boolean(localPlayer);
  const hostNextTurnDisabled =
    !isLocalHost ||
    gameState.status !== GameStatus.Playing ||
    !canonicalLocalPlayer ||
    activePlayerId !== canonicalLocalPlayer.id;

  const canRestartMatch =
    isLocalHost && gameState.status === GameStatus.Finished;
  const turnBarHostControls = {
    onNextTurn: isLocalHost ? handleEndTurn : undefined,
    nextTurnDisabled: hostNextTurnDisabled,
    onPause: undefined,
    pauseDisabled: true,
    onRestartMatch: canRestartMatch ? handleRestartMatch : undefined,
    restartDisabled: !canRestartMatch,
  } as const;

  return (
    <div
      className="room-screen full-height-page text-foreground"
      data-boards-layout={boardsLayout}
    >
      <section className="rounded-3xl border border-border/70 bg-background/85 px-5 py-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              <UsersIcon aria-hidden className="size-4" />
              Salle « C ki ? »
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Salle {roomId}
              </h1>
              <p className="text-sm text-muted-foreground sm:text-base">
                {grid.name} — {grid.rows} × {grid.columns} ({grid.cards.length}{" "}
                cartes)
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
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
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="flex items-center gap-2"
              onClick={handleLeave}
            >
              Quitter la salle
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <TargetIcon aria-hidden className="size-4 text-primary" />
            {statusLabel}
          </span>
          <span className="inline-flex items-center gap-2">
            <TimerIcon aria-hidden className="size-4 text-primary" />
            {turnLabel}
          </span>
          <span className="inline-flex items-center gap-2">
            <EyeIcon aria-hidden className="size-4 text-primary" />
            {spectators.length === 1
              ? "1 spectateur"
              : `${spectators.length} spectateurs`}
          </span>
        </div>
      </section>
      {activeTurnNotice ? (
        <ActiveTurnNotice
          title={activeTurnNotice.title}
          description={activeTurnNotice.description}
          className="mt-4"
        />
      ) : null}
      <section
        aria-labelledby="boards-area-title"
        className={cn(
          "flex flex-1 min-h-0 gap-4 transition-[flex-direction] duration-300 ease-out",
          isBoardsStacked ? "flex-col" : "flex-row",
        )}
      >
        <h2 id="boards-area-title" className="sr-only">
          Plateaux des joueurs
        </h2>
        <div className="relative flex flex-1 min-h-0 items-center justify-center overflow-hidden rounded-3xl border border-border/70 bg-muted/20 shadow-inner">
          <BoardsArea
            boards={boardItems}
            className="h-full w-full p-2 sm:p-4"
            onLayoutChange={handleBoardsLayoutChange}
          />
        </div>
        <aside
          className={cn(
            "utility-panel flex shrink-0 flex-col overflow-hidden rounded-3xl border border-border/70 bg-background/90 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/70",
            isBoardsStacked ? "w-full" : undefined,
          )}
          style={utilityPanelStyle}
        >
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
            <div className="space-y-6">
              <section className="space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Accès rapide
                </h2>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={handleOpenRoleSelection}
                  >
                    <UserCogIcon aria-hidden className="mr-2 size-4" />
                    Rôles
                  </Button>
                  <ParticipantsSheet
                    players={playerSummaries}
                    spectators={spectators}
                    statusLabel={statusLabel}
                    turnLabel={turnLabel}
                    isHost={isLocalHost}
                    canPromoteSpectators={canPromoteSpectators}
                    canKickPlayers={canKickPlayers}
                    onPromoteSpectator={
                      isLocalHost ? handlePromoteSpectator : undefined
                    }
                    onKickSpectator={
                      isLocalHost ? handleKickSpectator : undefined
                    }
                    onKickPlayer={isLocalHost ? handleKickPlayer : undefined}
                    triggerClassName="w-full justify-start"
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
                    triggerClassName="w-full justify-start"
                  />
                  <RoomInformationDialog
                    roomId={roomId}
                    grid={grid}
                    status={gameState.status}
                    hostName={hostPlayerName}
                    triggerClassName="w-full justify-start"
                  />
                </div>
              </section>
              <section className="space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Résumé de la salle
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
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
              </section>
              {actionError ? (
                <div
                  className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  role="alert"
                >
                  <AlertCircleIcon aria-hidden className="mt-0.5 size-4" />
                  <span>{actionError}</span>
                </div>
              ) : null}
              {canHostStart ? (
                <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground">
                    {startDisabled
                      ? SECRET_SELECTION_REQUIREMENT_MESSAGE
                      : "Lancez la partie pour démarrer le premier tour."}
                  </p>
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
              {gameState.status === GameStatus.Finished ? (
                <FinalResultCard
                  state={gameState}
                  cardLookup={cardLookup}
                  onRestartMatch={isLocalHost ? handleRestartMatch : undefined}
                />
              ) : null}
            </div>
          </div>
        </aside>
      </section>
      <TurnBar
        turn={turn}
        activePlayerName={activePlayerName}
        status={gameState.status}
        isHost={isLocalHost}
        canEndTurn={canEndTurnButton}
        onEndTurn={canEndTurnButton ? handleEndTurn : undefined}
        hostControls={turnBarHostControls}
        lastGuessFailure={lastGuessFailureSummary}
        className="relative w-full"
      />
      <Dialog
        open={isGuessConfirmationOpen}
        onOpenChange={handleGuessDialogOpenChange}
      >
        <DialogContent className="max-w-md space-y-6">
          <DialogHeader>
            <DialogTitle>Voulez-vous valider ce personnage ?</DialogTitle>
            <DialogDescription>
              Il ne reste qu’une carte visible sur votre plateau. Valider
              l’envoi confirmera « {guessConfirmationCandidateLabel} » comme
              proposition face à {guessConfirmationTargetName}. Sélectionnez «
              Non » pour révéler à nouveau la carte masquée et poursuivre votre
              tri.
            </DialogDescription>
          </DialogHeader>
          {guessConfirmationCandidateCard ? (
            <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Carte pressentie
              </p>
              <p className="text-base font-semibold text-foreground">
                {guessConfirmationCandidateCard.label}
              </p>
              {guessConfirmationCandidateCard.description ? (
                <p className="text-sm text-muted-foreground">
                  {guessConfirmationCandidateCard.description}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Cette carte ne possède pas de description supplémentaire.
                </p>
              )}
            </div>
          ) : null}
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={handleCancelGuess}>
              Non, continuer
            </Button>
            <Button type="button" onClick={handleConfirmGuess}>
              Oui, annoncer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <TargetSelectionModal
        cards={secretSelectionCards}
        isOpen={isSecretSelectionOpen}
        onOpenChange={handleSecretSelectionOpenChange}
        currentCardId={secretSelectionCurrentCardId}
        playerName={secretSelectionPlayerName}
        onConfirm={handleConfirmSecretSelection}
      />
      <DevPanel
        roomId={roomId}
        peerRole={resolvedPeerRole}
        peerState={peerConnection}
        renderMetrics={renderMetrics}
      />
    </div>
  );
}
