import { createRandomId } from "@/lib/utils";

import type { Action } from "../game/types";
import { PeerRole } from "./peer";
import type { GameActionMessagePayload } from "./protocol";

type ActionSource = "local" | "remote";

export interface ActionApplicationMetadata {
  source: ActionSource;
  acknowledgedByHost: boolean;
}

export interface ActionErrorContext {
  action: Action;
  source: ActionSource;
}

export interface ActionReplicatorOptions {
  role: PeerRole;
  localPeerId: string;
  send: (payload: GameActionMessagePayload) => void;
  shouldDeferLocalApplication?: (action: Action) => boolean;
  onApply: (action: Action, metadata: ActionApplicationMetadata) => void;
  onError?: (error: Error, context: ActionErrorContext) => void;
  onAcknowledged?: (actionId: string, payload: GameActionMessagePayload) => void;
  generateActionId?: () => string;
}

export interface DispatchResult {
  actionId: string;
  appliedLocally: boolean;
  deferred: boolean;
}

export interface RemoteProcessResult {
  actionId: string;
  applied: boolean;
  wasDuplicate: boolean;
  acknowledgedByHost: boolean;
}

export interface ActionReplicator {
  dispatch(action: Action): DispatchResult;
  handleRemote(payload: GameActionMessagePayload): RemoteProcessResult;
  hasPending(actionId: string): boolean;
  pendingActionIds(): readonly string[];
}

const toError = (candidate: unknown): Error => {
  if (candidate instanceof Error) {
    return candidate;
  }
  return new Error(typeof candidate === "string" ? candidate : "Unknown error");
};

export const createActionReplicator = (
  options: ActionReplicatorOptions,
): ActionReplicator => {
  const processedIds = new Set<string>();
  const pending = new Map<string, Action>();
  const generateActionId =
    options.generateActionId ?? (() => createRandomId("action"));

  const notifyError = (error: unknown, context: ActionErrorContext) => {
    const normalised = toError(error);
    options.onError?.(normalised, context);
    return normalised;
  };

  const sendAcknowledgement = (payload: GameActionMessagePayload) => {
    const acknowledgement: GameActionMessagePayload = {
      ...payload,
      acknowledgedByHost: true,
      relayedByPeerId: options.localPeerId,
    };

    try {
      options.send(acknowledgement);
    } catch (error) {
      throw notifyError(error, {
        action: payload.action,
        source: "remote",
      });
    }

    options.onAcknowledged?.(payload.actionId, acknowledgement);
  };

  const dispatch = (action: Action): DispatchResult => {
    const actionId = generateActionId();
    const defer = options.shouldDeferLocalApplication?.(action) ?? false;
    const acknowledgedByHost = !defer && options.role === PeerRole.Host;

    if (!defer) {
      try {
        options.onApply(action, {
          source: "local",
          acknowledgedByHost,
        });
        processedIds.add(actionId);
      } catch (error) {
        throw notifyError(error, { action, source: "local" });
      }
    } else {
      pending.set(actionId, action);
    }

    const payload: GameActionMessagePayload = {
      actionId,
      action,
      issuerPeerId: options.localPeerId,
      issuerRole: options.role,
      acknowledgedByHost,
    };

    try {
      options.send(payload);
    } catch (error) {
      if (!defer) {
        processedIds.delete(actionId);
      } else {
        pending.delete(actionId);
      }
      throw notifyError(error, { action, source: "local" });
    }

    return { actionId, appliedLocally: !defer, deferred: defer };
  };

  const handleRemote = (
    payload: GameActionMessagePayload,
  ): RemoteProcessResult => {
    const { actionId, action, acknowledgedByHost } = payload;
    const alreadyProcessed = processedIds.has(actionId);

    if (alreadyProcessed) {
      if (acknowledgedByHost) {
        pending.delete(actionId);
        options.onAcknowledged?.(actionId, payload);
      } else if (options.role === PeerRole.Host) {
        sendAcknowledgement(payload);
      }

      return {
        actionId,
        applied: false,
        wasDuplicate: true,
        acknowledgedByHost,
      };
    }

    try {
      options.onApply(action, {
        source: "remote",
        acknowledgedByHost,
      });
      processedIds.add(actionId);
    } catch (error) {
      throw notifyError(error, { action, source: "remote" });
    }

    if (acknowledgedByHost) {
      pending.delete(actionId);
      options.onAcknowledged?.(actionId, payload);
    } else if (options.role === PeerRole.Host) {
      sendAcknowledgement(payload);
    }

    return {
      actionId,
      applied: true,
      wasDuplicate: false,
      acknowledgedByHost,
    };
  };

  const hasPending = (actionId: string): boolean => pending.has(actionId);

  const pendingActionIds = (): readonly string[] => Array.from(pending.keys());

  return {
    dispatch,
    handleRemote,
    hasPending,
    pendingActionIds,
  };
};

