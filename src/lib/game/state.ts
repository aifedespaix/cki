import {
  actionSchema,
  cardSchema,
  gridSchema,
  playerIdentitySchema,
  playerSchema,
} from "./schema";
import {
  type Action,
  type FinishedState,
  GameConclusionReason,
  type GameState,
  GameStatus,
  type Grid,
  type GuessResult,
  type IdleState,
  type LobbyState,
  type Player,
  type PlayerIdentity,
  PlayerRole,
  type PlayingState,
} from "./types";

/**
 * Error thrown when an action cannot be applied on the provided state.
 */
export class InvalidGameActionError extends Error {
  readonly action: Action;

  constructor(action: Action, message: string) {
    super(message);
    this.name = "InvalidGameActionError";
    this.action = action;
  }
}

export const createInitialState = (): IdleState => ({
  status: GameStatus.Idle,
  players: [],
});

const assert = (condition: unknown, action: Action, message: string): void => {
  if (!condition) {
    throw new InvalidGameActionError(action, message);
  }
};

const expectState = <TStatus extends GameState["status"]>(
  state: GameState,
  status: TStatus,
  action: Action,
): Extract<GameState, { status: TStatus }> => {
  assert(
    state.status === status,
    action,
    `Expected state "${status}" but received "${state.status}"`,
  );
  return state as Extract<GameState, { status: TStatus }>;
};

const ensureCardBelongsToGrid = (
  grid: Grid,
  cardId: string,
  action: Action,
): void => {
  const found = grid.cards.some((card) => card.id === cardId);
  assert(found, action, `Card "${cardId}" does not exist in the current grid`);
};

const normalisePlayer = (candidate: Player): Player => {
  const parsed = playerSchema.parse(candidate);
  return {
    ...parsed,
    flippedCardIds: [...parsed.flippedCardIds],
  };
};

const createPlayer = (
  identity: PlayerIdentity,
  role: Player["role"],
): Player => {
  const parsedIdentity = playerIdentitySchema.parse(identity);
  const playerCandidate: Player = {
    id: parsedIdentity.id,
    name: parsedIdentity.name,
    role,
    flippedCardIds: [],
  };
  return normalisePlayer(playerCandidate);
};

const sortFlippedCards = (grid: Grid, flippedCardIds: string[]): string[] => {
  const index = new Map(
    grid.cards.map((card, position) => [card.id, position] as const),
  );
  return [...flippedCardIds].sort((left, right) => {
    const leftIndex = index.get(left);
    const rightIndex = index.get(right);
    if (leftIndex === undefined || rightIndex === undefined) {
      return 0;
    }
    return leftIndex - rightIndex;
  });
};

const requireTwoPlayers = (players: Player[], action: Action): void => {
  assert(
    players.length === 2,
    action,
    "Exactly two players must participate in a match",
  );
};

const clonePlayers = (players: Player[]): Player[] =>
  players.map((player) => ({
    ...player,
    flippedCardIds: [...player.flippedCardIds],
  }));

const parseGrid = (grid: Grid): Grid => {
  const parsed = gridSchema.parse(grid);
  return {
    ...parsed,
    cards: parsed.cards.map((card) => cardSchema.parse(card)),
  };
};

const determineNextPlayerId = (state: PlayingState): string => {
  const currentIndex = state.players.findIndex(
    (player) => player.id === state.activePlayerId,
  );
  if (currentIndex === -1) {
    return state.activePlayerId;
  }
  const nextIndex = (currentIndex + 1) % state.players.length;
  return state.players[nextIndex]?.id ?? state.activePlayerId;
};

const toFinishedState = (
  state: PlayingState,
  winnerId: string,
  reason: FinishedState["reason"],
  finalGuess: GuessResult,
): FinishedState => ({
  status: GameStatus.Finished,
  hostId: state.hostId,
  grid: state.grid,
  players: clonePlayers(state.players),
  turn: state.turn,
  winnerId,
  reason,
  finalGuess,
});

export const reduceGameState = (
  state: GameState,
  action: Action,
): GameState => {
  actionSchema.parse(action);

  switch (action.type) {
    case "game/createLobby": {
      expectState(state, GameStatus.Idle, action);
      const grid = parseGrid(action.payload.grid);
      const host = createPlayer(action.payload.host, "host");

      return {
        status: GameStatus.Lobby,
        hostId: host.id,
        grid,
        players: [host],
      } satisfies LobbyState;
    }

    case "game/joinLobby": {
      const identity = playerIdentitySchema.parse(action.payload.player);

      if (
        state.status === GameStatus.Playing ||
        state.status === GameStatus.Finished
      ) {
        const alreadyParticipant = state.players.some(
          (player) => player.id === identity.id,
        );
        assert(
          alreadyParticipant,
          action,
          "Cannot join a match that has already started",
        );
        return state;
      }

      const lobbyState = expectState(state, GameStatus.Lobby, action);
      assert(
        lobbyState.players.length < 2,
        action,
        "Lobby already has two players",
      );

      const alreadyJoined = lobbyState.players.some(
        (player) => player.id === identity.id,
      );
      assert(
        !alreadyJoined,
        action,
        `Player "${identity.id}" is already in the lobby`,
      );

      const hostSeatOccupied = lobbyState.players.some(
        (player) => player.role === PlayerRole.Host,
      );
      const joiningAsHost = identity.id === lobbyState.hostId;
      const assignedRole = joiningAsHost ? PlayerRole.Host : PlayerRole.Guest;

      if (joiningAsHost) {
        assert(!hostSeatOccupied, action, "Host seat is already occupied");
      }

      const newPlayer = createPlayer(identity, assignedRole);

      return {
        ...lobbyState,
        players: [...lobbyState.players, newPlayer],
      } satisfies LobbyState;
    }

    case "game/updatePlayerName": {
      assert(
        state.status !== GameStatus.Idle,
        action,
        "Cannot update player name before the lobby is created",
      );

      const playerId = action.payload.playerId;
      const trimmedName = action.payload.name.trim();
      assert(trimmedName.length > 0, action, "Player name is required");

      const renamePlayer = (players: Player[]): Player[] => {
        const index = players.findIndex((player) => player.id === playerId);
        assert(
          index !== -1,
          action,
          `Player "${playerId}" is not part of the match`,
        );

        const updatedPlayers = clonePlayers(players);
        const existing = updatedPlayers[index];
        if (!existing) {
          throw new InvalidGameActionError(
            action,
            `Player "${playerId}" is not part of the match`,
          );
        }

        updatedPlayers[index] = {
          ...existing,
          name: trimmedName,
        };
        return updatedPlayers;
      };

      if (state.status === GameStatus.Lobby) {
        return {
          ...state,
          players: renamePlayer(state.players),
        } satisfies LobbyState;
      }

      if (state.status === GameStatus.Playing) {
        return {
          ...state,
          players: renamePlayer(state.players),
        } satisfies PlayingState;
      }

      if (state.status === GameStatus.Finished) {
        return {
          ...state,
          players: renamePlayer(state.players),
        } satisfies FinishedState;
      }

      return state;
    }

    case "game/setSecret": {
      const { playerId, cardId } = action.payload;

      if (
        state.status === GameStatus.Playing ||
        state.status === GameStatus.Finished
      ) {
        ensureCardBelongsToGrid(state.grid, cardId, action);

        const participant = state.players.find(
          (player) => player.id === playerId,
        );
        assert(
          participant,
          action,
          `Player "${playerId}" is not part of the match`,
        );

        assert(
          typeof participant.secretCardId === "string",
          action,
          `Player "${playerId}" has no secret card assigned`,
        );

        assert(
          participant.secretCardId === cardId,
          action,
          "Cannot change the secret card once the match has started",
        );

        return state;
      }

      const lobbyState = expectState(state, GameStatus.Lobby, action);

      ensureCardBelongsToGrid(lobbyState.grid, cardId, action);

      const playerIndex = lobbyState.players.findIndex(
        (player) => player.id === playerId,
      );
      assert(
        playerIndex !== -1,
        action,
        `Player "${playerId}" is not in the lobby`,
      );

      const player = lobbyState.players[playerIndex];
      if (!player) {
        throw new InvalidGameActionError(
          action,
          `Player "${playerId}" is not in the lobby`,
        );
      }
      if (player.secretCardId === cardId) {
        return lobbyState;
      }

      const updatedPlayer: Player = normalisePlayer({
        ...player,
        secretCardId: cardId,
      });

      const players = lobbyState.players.map((current, index) =>
        index === playerIndex ? updatedPlayer : current,
      );

      return {
        ...lobbyState,
        players,
      } satisfies LobbyState;
    }

    case "game/start": {
      if (state.status === GameStatus.Playing) {
        const requestedStartingPlayerId =
          action.payload.startingPlayerId ?? state.hostId;
        const startingPlayer = state.players.find(
          (player) => player.id === requestedStartingPlayerId,
        );
        assert(
          startingPlayer,
          action,
          `Starting player "${requestedStartingPlayerId}" is not part of the match`,
        );

        assert(
          startingPlayer.id === state.activePlayerId,
          action,
          "Cannot change the starting player once the match has started",
        );

        return state;
      }

      if (state.status === GameStatus.Finished) {
        throw new InvalidGameActionError(
          action,
          "Cannot start a match that has already finished",
        );
      }

      const lobbyState = expectState(state, GameStatus.Lobby, action);
      requireTwoPlayers(lobbyState.players, action);

      const everyoneReady = lobbyState.players.every(
        (player) => typeof player.secretCardId === "string",
      );
      assert(
        everyoneReady,
        action,
        "All players must select a secret card before starting",
      );

      const startingPlayerId =
        action.payload.startingPlayerId ??
        (lobbyState.players.some((player) => player.id === lobbyState.hostId)
          ? lobbyState.hostId
          : (lobbyState.players[0]?.id ?? lobbyState.hostId));
      const startingPlayer = lobbyState.players.find(
        (player) => player.id === startingPlayerId,
      );
      assert(
        startingPlayer,
        action,
        `Starting player "${startingPlayerId}" is not part of the lobby`,
      );

      return {
        status: GameStatus.Playing,
        hostId: lobbyState.hostId,
        grid: lobbyState.grid,
        players: lobbyState.players.map((player) => ({
          ...player,
          flippedCardIds: [],
        })),
        activePlayerId: startingPlayer.id,
        turn: 1,
        lastGuessResult: null,
      } satisfies PlayingState;
    }

    case "turn/flipCard": {
      const playingState = expectState(state, GameStatus.Playing, action);
      const { playerId, cardId } = action.payload;

      assert(
        playingState.activePlayerId === playerId,
        action,
        "Only the active player can flip cards",
      );
      ensureCardBelongsToGrid(playingState.grid, cardId, action);

      const playerIndex = playingState.players.findIndex(
        (player) => player.id === playerId,
      );
      assert(
        playerIndex !== -1,
        action,
        `Player "${playerId}" is not part of the match`,
      );

      const player = playingState.players[playerIndex];
      if (!player) {
        throw new InvalidGameActionError(
          action,
          `Player "${playerId}" is not part of the match`,
        );
      }
      const alreadyHidden = player.flippedCardIds.includes(cardId);
      if (alreadyHidden) {
        const updatedPlayer: Player = {
          ...player,
          flippedCardIds: player.flippedCardIds.filter((id) => id !== cardId),
        };

        const players = playingState.players.map((current, index) =>
          index === playerIndex ? updatedPlayer : current,
        );

        return {
          ...playingState,
          players,
        } satisfies PlayingState;
      }

      // The secret card remains tracked separately, so allow toggling it on the board.
      const updatedPlayer: Player = {
        ...player,
        flippedCardIds: sortFlippedCards(playingState.grid, [
          ...player.flippedCardIds,
          cardId,
        ]),
      };

      const players = playingState.players.map((current, index) =>
        index === playerIndex ? updatedPlayer : current,
      );

      return {
        ...playingState,
        players,
      } satisfies PlayingState;
    }

    case "turn/end": {
      const playingState = expectState(state, GameStatus.Playing, action);
      const { playerId } = action.payload;

      assert(
        playingState.activePlayerId === playerId,
        action,
        "Only the active player can end their turn",
      );
      requireTwoPlayers(playingState.players, action);

      const nextPlayerId = determineNextPlayerId(playingState);
      assert(
        nextPlayerId !== playingState.activePlayerId,
        action,
        "Cannot pass the turn to the same player",
      );

      return {
        ...playingState,
        activePlayerId: nextPlayerId,
        turn: playingState.turn + 1,
      } satisfies PlayingState;
    }

    case "turn/guess": {
      const playingState = expectState(state, GameStatus.Playing, action);
      const { playerId, targetPlayerId, cardId } = action.payload;

      assert(
        playingState.activePlayerId === playerId,
        action,
        "Only the active player can guess the opponent card",
      );
      requireTwoPlayers(playingState.players, action);
      assert(
        playerId !== targetPlayerId,
        action,
        "A player cannot guess their own card",
      );
      ensureCardBelongsToGrid(playingState.grid, cardId, action);

      const guesser = playingState.players.find(
        (player) => player.id === playerId,
      );
      assert(guesser, action, `Player "${playerId}" is not part of the match`);

      const target = playingState.players.find(
        (player) => player.id === targetPlayerId,
      );
      assert(
        target,
        action,
        `Target player "${targetPlayerId}" is not part of the match`,
      );
      assert(
        target.secretCardId,
        action,
        `Target player "${targetPlayerId}" has no secret card`,
      );

      const correct = target.secretCardId === cardId;
      const finalGuess: GuessResult = {
        guesserId: playerId,
        targetPlayerId,
        cardId,
        correct,
      };

      if (correct) {
        return toFinishedState(
          playingState,
          playerId,
          GameConclusionReason.CorrectGuess,
          finalGuess,
        );
      }

      const guesserIndex = playingState.players.findIndex(
        (player) => player.id === playerId,
      );
      assert(
        guesserIndex !== -1,
        action,
        `Player "${playerId}" is not part of the match`,
      );

      const updatedGuesser: Player = {
        ...guesser,
        flippedCardIds: [],
      };

      const players = playingState.players.map((current, index) =>
        index === guesserIndex ? updatedGuesser : current,
      );

      const nextPlayerId = determineNextPlayerId(playingState);
      assert(
        nextPlayerId !== playingState.activePlayerId,
        action,
        "Cannot pass the turn to the same player",
      );

      return {
        ...playingState,
        players,
        activePlayerId: nextPlayerId,
        turn: playingState.turn + 1,
        lastGuessResult: finalGuess,
      } satisfies PlayingState;
    }

    case "game/reset":
      return createInitialState();

    case "game/leave": {
      const { playerId } = action.payload;

      if (state.status === GameStatus.Idle) {
        return state;
      }

      if (state.status === GameStatus.Lobby) {
        const index = state.players.findIndex(
          (player) => player.id === playerId,
        );
        if (index === -1) {
          return state;
        }
        const remaining = state.players.filter(
          (player) => player.id !== playerId,
        );
        return {
          ...state,
          players: clonePlayers(remaining),
        } satisfies LobbyState;
      }

      const resetPlayers = (players: Player[]): Player[] =>
        players.map((player) =>
          normalisePlayer({
            ...player,
            secretCardId: undefined,
            flippedCardIds: [],
          }),
        );

      if (state.status === GameStatus.Playing) {
        const remaining = state.players.filter(
          (player) => player.id !== playerId,
        );
        if (remaining.length === state.players.length) {
          return state;
        }
        return {
          status: GameStatus.Lobby,
          hostId: state.hostId,
          grid: state.grid,
          players: resetPlayers(remaining),
        } satisfies LobbyState;
      }

      if (state.status === GameStatus.Finished) {
        const remaining = state.players.filter(
          (player) => player.id !== playerId,
        );
        if (remaining.length === state.players.length) {
          return state;
        }
        return {
          status: GameStatus.Lobby,
          hostId: state.hostId,
          grid: state.grid,
          players: resetPlayers(remaining),
        } satisfies LobbyState;
      }

      return state;
    }

    default:
      return state;
  }
};

export const selectPlayers = (state: GameState): Player[] => {
  if (state.status === GameStatus.Idle) {
    return [];
  }
  return state.players;
};

export const selectPlayerById = (
  state: GameState,
  playerId: string,
): Player | undefined => {
  return selectPlayers(state).find((player) => player.id === playerId);
};

export const selectActivePlayer = (state: GameState): Player | undefined => {
  if (state.status !== GameStatus.Playing) {
    return undefined;
  }
  return selectPlayerById(state, state.activePlayerId);
};

export const selectWinner = (state: GameState): Player | undefined => {
  if (state.status !== GameStatus.Finished) {
    return undefined;
  }
  return selectPlayerById(state, state.winnerId);
};

export const isPlayerReady = (state: GameState, playerId: string): boolean => {
  const player = selectPlayerById(state, playerId);
  return Boolean(player?.secretCardId);
};

export const canStartGame = (state: GameState): boolean => {
  if (state.status !== GameStatus.Lobby) {
    return false;
  }
  return (
    state.players.length === 2 &&
    state.players.every((player) => Boolean(player.secretCardId))
  );
};
