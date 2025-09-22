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
import { useRenderMetrics } from "@/lib/debug/renderMetrics";
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
  type GameActionMessagePayload,
  validateGameActionMessage,
} from "@/lib/p2p/protocol";
import { RemoteActionQueue } from "@/lib/p2p/remote-action-queue";
import { decodeGridFromToken } from "@/lib/share/url";
import type { HostPreparationRecord } from "@/lib/storage/session";
import { loadHostPreparation } from "@/lib/storage/session";
import { cn, createRandomId } from "@/lib/utils";
import { analyseGuessConfirmationContext } from "./guessConfirmation";
import {
  type RoomPeerCreationConfig,
  useRoomPeerRuntime,
} from "./hooks/useRoomPeerRuntime";

interface Spectator {
  id: string;
  name: string;
}

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
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState>(() =>
    createInitialState(),
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [spectators, setSpectators] = useState<readonly Spectator[]>([]);
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
  const pendingRemoteActionsRef = useRef<RemoteActionQueue | null>(null);
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
  ]);

  useEffect(() => {
    const runtime = peerConnection.runtime;
    if (!runtime) {
      return;
    }
    const unsubscribe = runtime.onMessage("game/action", (message) => {
      try {
        const payload = validateGameActionMessage(message.payload);
        processRemotePayload(payload);
      } catch (error) {
        handleRemoteProcessingError(error);
      }
    });
    return () => {
      unsubscribe();
    };
  }, [
    peerConnection.runtime,
    processRemotePayload,
    handleRemoteProcessingError,
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
  const isLocalHost = canonicalLocalPlayerRole === PlayerRole.Host;
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
        setSpectators((current) =>
          current.filter((entry) => entry.id !== spectatorId),
        );
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
      setSpectators((current) =>
        current.filter((spectator) => spectator.id !== spectatorId),
      );
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
      setActionError(
        `L’expulsion de ${target.name} n’est pas encore disponible dans cette version de l’application.`,
      );
    },
    [isLocalHost, players],
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

  const turnBarHostControls = {
    onNextTurn: isLocalHost ? handleEndTurn : undefined,
    nextTurnDisabled: hostNextTurnDisabled,
    onPause: undefined,
    pauseDisabled: true,
    onResetRound: undefined,
    resetDisabled: true,
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
      <div
        className={cn(
          "flex flex-1 min-h-0 gap-4 transition-[flex-direction] duration-300 ease-out",
          isBoardsStacked ? "flex-col" : "flex-row",
        )}
      >
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
                      ? "Chaque joueur doit choisir une carte secrète avant de commencer."
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
                <FinalResultCard state={gameState} cardLookup={cardLookup} />
              ) : null}
            </div>
          </div>
        </aside>
      </div>
      <TurnBar
        turn={turn}
        activePlayerName={activePlayerName}
        status={gameState.status}
        isHost={isLocalHost}
        canEndTurn={canEndTurnButton}
        onEndTurn={canEndTurnButton ? handleEndTurn : undefined}
        hostControls={turnBarHostControls}
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
