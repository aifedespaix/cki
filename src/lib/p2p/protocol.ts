import { z } from "zod";

import { actionSchema } from "@/lib/game/schema";

import { PeerRole } from "./peer";

export const GAME_PROTOCOL_NAMESPACE = "keys.game.actions";

export const GAME_PROTOCOL_VERSION = "1.1.0" as const;

export const SUPPORTED_GAME_PROTOCOL_VERSIONS = [
  GAME_PROTOCOL_VERSION,
  "1.0.0",
] as const;

export type GameProtocolVersion =
  (typeof SUPPORTED_GAME_PROTOCOL_VERSIONS)[number];

const peerRoleSchema = z.union([
  z.literal(PeerRole.Host),
  z.literal(PeerRole.Guest),
]);

export const gameActionMessageSchema = z
  .object({
    actionId: z.string().min(1),
    action: actionSchema,
    issuerPeerId: z.string().min(1),
    issuerRole: peerRoleSchema,
    acknowledgedByHost: z.boolean().default(false),
    relayedByPeerId: z.string().min(1).optional(),
  })
  .strict();

export type GameActionMessagePayload = z.infer<typeof gameActionMessageSchema>;

const spectatorProfileSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1).max(80),
  })
  .strict();

const spectatorUpdateMessageSchema = z
  .object({
    spectator: spectatorProfileSchema,
    present: z.boolean(),
    issuedAt: z.number().int().nonnegative(),
  })
  .strict();

export type SpectatorUpdateMessagePayload = z.infer<
  typeof spectatorUpdateMessageSchema
>;

const spectatorRosterMessageSchema = z
  .object({
    spectators: z.array(spectatorProfileSchema),
    issuedAt: z.number().int().nonnegative(),
  })
  .strict();

export type SpectatorRosterMessagePayload = z.infer<
  typeof spectatorRosterMessageSchema
>;

export interface GameProtocolMessageMap {
  "game/action": GameActionMessagePayload;
  "spectator/update": SpectatorUpdateMessagePayload;
  "spectator/roster": SpectatorRosterMessagePayload;
}

export type GameProtocolMessageType = keyof GameProtocolMessageMap;

export type GameProtocolMessage<Type extends GameProtocolMessageType> =
  Type extends keyof GameProtocolMessageMap
    ? {
        type: Type;
        payload: GameProtocolMessageMap[Type];
      }
    : never;

export const validateGameActionMessage = (
  payload: unknown,
): GameActionMessagePayload => {
  const result = gameActionMessageSchema.safeParse(payload);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
};

export const validateSpectatorUpdateMessage = (
  payload: unknown,
): SpectatorUpdateMessagePayload => {
  const result = spectatorUpdateMessageSchema.safeParse(payload);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
};

export const validateSpectatorRosterMessage = (
  payload: unknown,
): SpectatorRosterMessagePayload => {
  const result = spectatorRosterMessageSchema.safeParse(payload);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
};
