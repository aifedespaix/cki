/**
 * Game-specific protocol definitions used on top of the generic peer runtime.
 */

import type {
  GameActionPayload,
  GameErrorPayload,
  GameResyncRequestPayload,
  GameSnapshotAckPayload,
  GameSnapshotPayload,
  SynchronisedAction,
} from "../game/types";

/**
 * Semantic namespace used when negotiating protocol versions.
 */
export const GAME_PROTOCOL_NAMESPACE = "keys.game";

/**
 * Latest version of the synchronisation protocol. Bump the number whenever the
 * wire format or behaviour becomes incompatible with previous releases.
 */
export const GAME_PROTOCOL_VERSION = "1.1.0" as const;

/**
 * Ordered list of protocol versions that the application understands. Earlier
 * entries are preferred when negotiating between peers.
 */
export const SUPPORTED_GAME_PROTOCOL_VERSIONS = [
  GAME_PROTOCOL_VERSION,
  "1.0.0",
] as const;

export type GameProtocolVersion =
  (typeof SUPPORTED_GAME_PROTOCOL_VERSIONS)[number];

/**
 * Literal action types allowed to circulate after the initial snapshot.
 */
export const SYNCHRONISED_ACTION_TYPES: readonly SynchronisedAction["type"][] =
  ["turn/flipCard", "turn/end", "turn/guess", "game/reset"] as const;

export type SynchronisedActionType = (typeof SYNCHRONISED_ACTION_TYPES)[number];

/**
 * Payload contract for each game-specific message travelling on the data
 * channel. The {@link PeerRuntime} implementation automatically wraps the
 * payload into a timestamped envelope.
 */
export interface GameProtocolMessageMap {
  "game/snapshot": GameSnapshotPayload;
  "game/snapshot-ack": GameSnapshotAckPayload;
  "game/action": GameActionPayload;
  "game/resync-request": GameResyncRequestPayload;
  "game/error": GameErrorPayload;
}

export type GameProtocolMessageType = keyof GameProtocolMessageMap;

export type GameProtocolMessage<Type extends GameProtocolMessageType> = {
  type: Type;
  payload: GameProtocolMessageMap[Type];
};
