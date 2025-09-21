import { z } from "zod";

import {
  type Action,
  type Card,
  type FinishedState,
  GameConclusionReason,
  type GameState,
  GameStatus,
  type Grid,
  type GuessResult,
  type IdleState,
  type LobbyState,
  type Message,
  type Player,
  type PlayerIdentity,
  PlayerRole,
  type PlayingState,
} from "./types";

/**
 * Runtime schemas used to validate any data coming from the network or storage.
 */
export const cardSchema: z.ZodType<Card> = z
  .object({
    id: z.string().min(1, "Card identifier is required"),
    label: z.string().min(1, "Card label is required"),
    imageUrl: z.string().url().optional(),
    description: z.string().max(280).optional(),
  })
  .strict();

export const gridSchema: z.ZodType<Grid> = z
  .object({
    id: z.string().min(1, "Grid identifier is required"),
    name: z.string().min(1, "Grid name is required"),
    rows: z.number().int().positive(),
    columns: z.number().int().positive(),
    cards: z.array(cardSchema).min(1, "A grid requires at least one card"),
  })
  .strict()
  .superRefine((grid, ctx) => {
    const capacity = grid.rows * grid.columns;
    if (grid.cards.length > capacity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Grid capacity cannot be smaller than the number of cards",
        path: ["cards"],
      });
    }
    const uniqueIds = new Set(grid.cards.map((card) => card.id));
    if (uniqueIds.size !== grid.cards.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Card identifiers must be unique within the grid",
        path: ["cards"],
      });
    }
  });

export const playerRoleSchema = z.nativeEnum(PlayerRole);

export const playerIdentitySchema: z.ZodType<PlayerIdentity> = z
  .object({
    id: z.string().min(1, "Player identifier is required"),
    name: z.string().min(1, "Player name is required"),
    role: playerRoleSchema.optional(),
  })
  .strict();

export const playerSchema: z.ZodType<Player> = z
  .object({
    id: z.string().min(1, "Player identifier is required"),
    name: z.string().min(1, "Player name is required"),
    role: playerRoleSchema,
    secretCardId: z.string().optional(),
    flippedCardIds: z
      .array(z.string().min(1))
      .default([])
      .superRefine((ids, ctx) => {
        const unique = new Set(ids);
        if (unique.size !== ids.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Flipped card identifiers must be unique",
            path: ["flippedCardIds"],
          });
        }
      }),
  })
  .strict();

export const guessResultSchema: z.ZodType<GuessResult> = z
  .object({
    guesserId: z.string().min(1),
    targetPlayerId: z.string().min(1),
    cardId: z.string().min(1),
    correct: z.boolean(),
  })
  .strict();

const idleStateSchemaInternal: z.ZodType<IdleState> = z
  .object({
    status: z.literal(GameStatus.Idle),
    players: z.array(playerSchema).length(0),
  })
  .strict();

const lobbyStateSchemaInternal: z.ZodType<LobbyState> = z
  .object({
    status: z.literal(GameStatus.Lobby),
    hostId: z.string().min(1),
    grid: gridSchema,
    players: z.array(playerSchema).min(1).max(2),
  })
  .strict()
  .superRefine((state, ctx) => {
    if (!state.players.some((player) => player.id === state.hostId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Host player must be present in the lobby",
        path: ["hostId"],
      });
    }
  });

const playingStateSchemaInternal: z.ZodType<PlayingState> = z
  .object({
    status: z.literal(GameStatus.Playing),
    hostId: z.string().min(1),
    grid: gridSchema,
    players: z.array(playerSchema).length(2),
    activePlayerId: z.string().min(1),
    turn: z.number().int().positive(),
  })
  .strict()
  .superRefine((state, ctx) => {
    if (!state.players.some((player) => player.id === state.hostId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Host player must be part of the match",
        path: ["hostId"],
      });
    }
    if (!state.players.some((player) => player.id === state.activePlayerId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Active player must be one of the players in the match",
        path: ["activePlayerId"],
      });
    }
  });

const finishedStateSchemaInternal: z.ZodType<FinishedState> = z
  .object({
    status: z.literal(GameStatus.Finished),
    hostId: z.string().min(1),
    grid: gridSchema,
    players: z.array(playerSchema).length(2),
    turn: z.number().int().positive(),
    winnerId: z.string().min(1),
    reason: z.nativeEnum(GameConclusionReason),
    finalGuess: guessResultSchema,
  })
  .strict()
  .superRefine((state, ctx) => {
    if (!state.players.some((player) => player.id === state.winnerId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Winner must be included in the final player list",
        path: ["winnerId"],
      });
    }
    if (
      !state.players.some(
        (player) => player.id === state.finalGuess.targetPlayerId,
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Final guess must target a player from the match",
        path: ["finalGuess", "targetPlayerId"],
      });
    }
    if (
      !state.players.some((player) => player.id === state.finalGuess.guesserId)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Final guess must originate from a player in the match",
        path: ["finalGuess", "guesserId"],
      });
    }
  });

export const gameStateSchema: z.ZodType<GameState> = z.discriminatedUnion(
  "status",
  [
    idleStateSchemaInternal,
    lobbyStateSchemaInternal,
    playingStateSchemaInternal,
    finishedStateSchemaInternal,
  ],
);

export const createLobbyActionSchema = z
  .object({
    type: z.literal<"game/createLobby">("game/createLobby"),
    payload: z.object({
      grid: gridSchema,
      host: playerIdentitySchema,
    }),
  })
  .strict();

export const joinLobbyActionSchema = z
  .object({
    type: z.literal<"game/joinLobby">("game/joinLobby"),
    payload: z.object({
      player: playerIdentitySchema,
    }),
  })
  .strict();

export const setSecretActionSchema = z
  .object({
    type: z.literal<"game/setSecret">("game/setSecret"),
    payload: z.object({
      playerId: z.string().min(1),
      cardId: z.string().min(1),
    }),
  })
  .strict();

export const startGameActionSchema = z
  .object({
    type: z.literal<"game/start">("game/start"),
    payload: z.object({
      startingPlayerId: z.string().min(1).optional(),
    }),
  })
  .strict();

export const flipCardActionSchema = z
  .object({
    type: z.literal<"turn/flipCard">("turn/flipCard"),
    payload: z.object({
      playerId: z.string().min(1),
      cardId: z.string().min(1),
    }),
  })
  .strict();

export const endTurnActionSchema = z
  .object({
    type: z.literal<"turn/end">("turn/end"),
    payload: z.object({
      playerId: z.string().min(1),
    }),
  })
  .strict();

export const guessActionSchema = z
  .object({
    type: z.literal<"turn/guess">("turn/guess"),
    payload: z.object({
      playerId: z.string().min(1),
      targetPlayerId: z.string().min(1),
      cardId: z.string().min(1),
    }),
  })
  .strict();

export const resetActionSchema = z
  .object({
    type: z.literal<"game/reset">("game/reset"),
  })
  .strict();

export const synchronisedActionSchema = z.discriminatedUnion("type", [
  flipCardActionSchema,
  endTurnActionSchema,
  guessActionSchema,
  resetActionSchema,
]);

export const actionSchema: z.ZodType<Action> = z.discriminatedUnion("type", [
  createLobbyActionSchema,
  joinLobbyActionSchema,
  setSecretActionSchema,
  startGameActionSchema,
  flipCardActionSchema,
  endTurnActionSchema,
  guessActionSchema,
  resetActionSchema,
]);

export const messageSchema: z.ZodType<Message> = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal<"game/snapshot">("game/snapshot"),
      snapshotId: z.string().min(1),
      state: gameStateSchema,
      issuedAt: z.number().int().nonnegative(),
      lastActionId: z.string().min(1).nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal<"game/action">("game/action"),
      actionId: z.string().min(1),
      action: synchronisedActionSchema,
      issuerId: z.string().min(1),
      issuedAt: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      type: z.literal<"game/snapshot-ack">("game/snapshot-ack"),
      snapshotId: z.string().min(1),
      receivedAt: z.number().int().nonnegative(),
      lastActionId: z.string().min(1).nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal<"game/resync-request">("game/resync-request"),
      requestedAt: z.number().int().nonnegative(),
      lastActionId: z.string().min(1).nullable(),
      reason: z.string().min(1).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal<"game/error">("game/error"),
      code: z.string().min(1),
      message: z.string().min(1),
      issuedAt: z.number().int().nonnegative(),
    })
    .strict(),
]);

export type CardSchema = typeof cardSchema;
export type GridSchema = typeof gridSchema;
export type PlayerSchema = typeof playerSchema;
export type GameStateSchema = typeof gameStateSchema;
export type ActionSchema = typeof actionSchema;
export type MessageSchema = typeof messageSchema;
export type SynchronisedActionSchema = typeof synchronisedActionSchema;
