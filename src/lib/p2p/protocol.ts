import { z } from "zod";

import { actionSchema } from "@/lib/game/schema";

import { PeerRole } from "./peer";

export const GAME_PROTOCOL_NAMESPACE = "keys.game.actions";

export const GAME_PROTOCOL_VERSION = "1.0.0" as const;

export const SUPPORTED_GAME_PROTOCOL_VERSIONS = [
  GAME_PROTOCOL_VERSION,
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

export interface GameProtocolMessageMap {
  "game/action": GameActionMessagePayload;
}

export type GameProtocolMessageType = keyof GameProtocolMessageMap;

export type GameProtocolMessage<
  Type extends GameProtocolMessageType,
> = Type extends keyof GameProtocolMessageMap
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

