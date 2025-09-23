/**
 * Core domain types for the Guess Who-style « C ki ? » game.
 *
 * The goal is to keep the data contracts explicit, serialisable and easy to validate.
 * Each exported type is paired with a runtime schema in {@link schema.ts}.
 */
export const GameStatus = {
  Idle: "idle",
  Lobby: "lobby",
  Playing: "playing",
  Finished: "finished",
} as const;

export type GameStatus = (typeof GameStatus)[keyof typeof GameStatus];

export interface Card {
  /** Unique identifier for a card. */
  id: string;
  /** Display label shown to players. */
  label: string;
  /** Optional URL to render the card artwork. */
  imageUrl?: string;
  /** Optional short description or hint. */
  description?: string;
}

export interface Grid {
  /** Identifier for the grid configuration. */
  id: string;
  /** Human friendly name, e.g. "Classic 4x4". */
  name: string;
  /** Number of rows in the layout. */
  rows: number;
  /** Number of columns in the layout. */
  columns: number;
  /** Cards placed on the grid in reading order. */
  cards: Card[];
}

export const PlayerRole = {
  Host: "host",
  Guest: "guest",
} as const;

export type PlayerRole = (typeof PlayerRole)[keyof typeof PlayerRole];

export interface Player {
  /** Player identifier (shared across peers). */
  id: string;
  /** Friendly display name for the UI. */
  name: string;
  /** Role of the participant, primarily used for permissions. */
  role: PlayerRole;
  /** Identifier of the opponent card this player protects. */
  secretCardId?: string;
  /** Ordered list of card identifiers that the player flipped down. */
  flippedCardIds: string[];
}

export interface PlayerIdentity {
  /** Player identifier to associate with a connection. */
  id: string;
  /** Preferred display name. */
  name: string;
  /** Optional requested role; defaults to guest for joiners. */
  role?: PlayerRole;
}

export const GameConclusionReason = {
  CorrectGuess: "guess-correct",
  IncorrectGuess: "guess-incorrect",
} as const;

export type GameConclusionReason =
  (typeof GameConclusionReason)[keyof typeof GameConclusionReason];

export interface GuessResult {
  /** Player who attempted the guess. */
  guesserId: string;
  /** Opponent targeted by the guess. */
  targetPlayerId: string;
  /** Card identifier that was guessed. */
  cardId: string;
  /** Whether the guess matched the opponent secret. */
  correct: boolean;
}

export interface IdleState {
  status: typeof GameStatus.Idle;
  players: [];
}

export interface LobbyState {
  status: typeof GameStatus.Lobby;
  hostId: string;
  grid: Grid;
  players: Player[];
}

export interface PlayingState {
  status: typeof GameStatus.Playing;
  hostId: string;
  grid: Grid;
  players: Player[];
  /** Identifier of the player allowed to act. */
  activePlayerId: string;
  /** Sequential turn counter starting at 1. */
  turn: number;
  /** Result of the most recent guess attempt while the match is active. */
  lastGuessResult: GuessResult | null;
}

export interface FinishedState {
  status: typeof GameStatus.Finished;
  hostId: string;
  grid: Grid;
  players: Player[];
  /** Turn counter frozen at the moment the match ended. */
  turn: number;
  /** Identifier of the player that won the match. */
  winnerId: string;
  /** Reason describing why the match ended. */
  reason: GameConclusionReason;
  /** Details about the final guess that ended the match. */
  finalGuess: GuessResult;
}

export type GameState = IdleState | LobbyState | PlayingState | FinishedState;

export type CreateLobbyAction = {
  type: "game/createLobby";
  payload: {
    grid: Grid;
    host: PlayerIdentity;
  };
};

export type JoinLobbyAction = {
  type: "game/joinLobby";
  payload: {
    player: PlayerIdentity;
  };
};

export type UpdatePlayerNameAction = {
  type: "game/updatePlayerName";
  payload: {
    playerId: string;
    name: string;
  };
};

export type SetSecretAction = {
  type: "game/setSecret";
  payload: {
    playerId: string;
    cardId: string;
  };
};

export type StartGameAction = {
  type: "game/start";
  payload: {
    startingPlayerId?: string;
  };
};

export type FlipCardAction = {
  type: "turn/flipCard";
  payload: {
    playerId: string;
    cardId: string;
  };
};

export type EndTurnAction = {
  type: "turn/end";
  payload: {
    playerId: string;
  };
};

export type GuessAction = {
  type: "turn/guess";
  payload: {
    playerId: string;
    targetPlayerId: string;
    cardId: string;
  };
};

export type ResetAction = {
  type: "game/reset";
};

export type RestartAction = {
  type: "game/restart";
};

export type LeaveGameAction = {
  type: "game/leave";
  payload: {
    playerId: string;
  };
};

export type Action =
  | CreateLobbyAction
  | JoinLobbyAction
  | UpdatePlayerNameAction
  | SetSecretAction
  | StartGameAction
  | FlipCardAction
  | EndTurnAction
  | GuessAction
  | ResetAction
  | RestartAction
  | LeaveGameAction;

/**
 * Actions that are synchronised through the peer-to-peer channel after the
 * initial snapshot has been exchanged.
 */
export type SynchronisedAction =
  | Extract<Action, { type: "game/updatePlayerName" }>
  | Extract<Action, { type: "turn/flipCard" }>
  | Extract<Action, { type: "turn/end" }>
  | Extract<Action, { type: "turn/guess" }>
  | Extract<Action, { type: "game/reset" }>
  | Extract<Action, { type: "game/restart" }>
  | Extract<Action, { type: "game/leave" }>;

/**
 * Snapshot sent by the host to initialise or resynchronise the guest state.
 */
export interface GameSnapshotMessage {
  type: "game/snapshot";
  snapshotId: string;
  issuedAt: number;
  state: GameState;
  /** Identifier of the last action applied on top of the snapshot. */
  lastActionId: string | null;
}

/**
 * Envelope describing a turn-level action applied after the initial snapshot.
 */
export interface GameActionMessage {
  type: "game/action";
  actionId: string;
  action: SynchronisedAction;
  issuerId: string;
  issuedAt: number;
}

/**
 * Acknowledgement sent by a guest after applying a snapshot.
 */
export interface GameSnapshotAckMessage {
  type: "game/snapshot-ack";
  snapshotId: string;
  receivedAt: number;
  /** Identifier of the last action known to the acknowledging peer. */
  lastActionId: string | null;
}

/**
 * Request emitted when a peer detects a divergence and needs a fresh snapshot.
 */
export interface GameResyncRequestMessage {
  type: "game/resync-request";
  requestedAt: number;
  /** Identifier of the last action successfully applied by the requester. */
  lastActionId: string | null;
  /** Optional human-readable description to assist debugging. */
  reason?: string;
}

/**
 * Error message used for non-recoverable synchronisation failures.
 */
export interface GameErrorMessage {
  type: "game/error";
  code: string;
  message: string;
  issuedAt: number;
}

export type Message =
  | GameSnapshotMessage
  | GameActionMessage
  | GameSnapshotAckMessage
  | GameResyncRequestMessage
  | GameErrorMessage;

export type GameSnapshotPayload = Omit<GameSnapshotMessage, "type">;
export type GameActionPayload = Omit<GameActionMessage, "type">;
export type GameSnapshotAckPayload = Omit<GameSnapshotAckMessage, "type">;
export type GameResyncRequestPayload = Omit<GameResyncRequestMessage, "type">;
export type GameErrorPayload = Omit<GameErrorMessage, "type">;
