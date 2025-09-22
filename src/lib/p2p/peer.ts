"use client";

import Peer, {
  type DataConnection,
  type PeerError,
  type PeerJSOption,
} from "peerjs";
import { useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_SUPPORTED_PROTOCOL_VERSIONS = ["1.1.0", "1.0.0"] as const;
const DEFAULT_HANDSHAKE_TIMEOUT_MS = 10000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 5000;
const DEFAULT_HEARTBEAT_TIMEOUT_MS = 12000;
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RETRY_DELAY_MS = 750;
const MAX_RETRY_DELAY_MS = 5000;
const DEFAULT_OUTBOUND_QUEUE_CAPACITY = 200;

type SupportedProtocolVersion = string;

/**
 * Narrower alias used to constraint message maps.
 */
export type MessageRecord = Record<string, unknown>;

/**
 * Envelope exchanged over the PeerJS data channel.
 *
 * @template Type - Discriminant string identifying the message kind.
 * @template Payload - Structured payload associated with the message.
 */
export interface Message<Type extends string = string, Payload = unknown> {
  /** Semantic protocol version associated with the message. */
  version: string;
  /** Unique message type identifier. */
  type: Type;
  /** Structured payload. */
  payload: Payload;
  /** Milliseconds since UNIX epoch when the message was emitted. */
  timestamp: number;
}

/**
 * Roles are explicit to keep negotiation logic simple.
 */
export const PeerRole = {
  Host: "host",
  Guest: "guest",
} as const;

export type PeerRole = (typeof PeerRole)[keyof typeof PeerRole];

/**
 * UI-facing connection phases.
 */
export type ConnectionPhase =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

/**
 * Reason codes describing why a connection closed.
 */
export type DisconnectReason =
  | "remote-closed"
  | "handshake-timeout"
  | "handshake-error"
  | "heartbeat-timeout"
  | "ice-failure"
  | "data-channel-error"
  | "destroyed";

/**
 * Events emitted by {@link PeerRuntime}. The map is intentionally verbose to
 * make downstream consumption explicit.
 */
export interface PeerEvents<AppMessages extends MessageRecord> {
  "peer/open": { peerId: string };
  "peer/close": undefined;
  "connection/phase": {
    phase: ConnectionPhase;
    previous: ConnectionPhase;
  };
  "connection/error": { error: Error };
  "connection/remote": { peerId: string | null };
  "connection/disconnected": {
    reason: DisconnectReason;
    attempt: number;
  };
  "connection/retry": { attempt: number; delay: number };
  message: ApplicationMessage<AppMessages>;
}

/**
 * Configuration shared by hosts and guests.
 */
export interface PeerRuntimeOptions<AppMessages extends MessageRecord> {
  /**
   * Role helps orchestrate negotiation (hosts wait for inbound connections,
   * guests actively connect).
   */
  role: PeerRole;
  /** Preferred identifier when creating the underlying Peer instance. */
  peerId?: string;
  /** Additional metadata sent during {@link Peer.connect}. */
  metadata?: Record<string, unknown>;
  /** Low-level PeerJS options. */
  peerOptions?: PeerJSOption;
  /** Supported protocol versions ordered by preference. */
  supportedProtocolVersions?: readonly SupportedProtocolVersion[];
  /** Maximum amount of automatic reconnection attempts. */
  maxReconnectAttempts?: number;
  /** Handshake timeout in milliseconds. */
  handshakeTimeoutMs?: number;
  /** Interval between heartbeats in milliseconds. */
  heartbeatIntervalMs?: number;
  /** Allowed delay for heartbeat responses in milliseconds. */
  heartbeatTimeoutMs?: number;
  /** Optional logger override; defaults to `console`. */
  logger?: Pick<Console, "error" | "warn" | "info" | "debug">;
  /**
   * Callback executed when application messages are received. Hooks use a
   * higher-level API, but standalone runtime consumers can rely on this.
   */
  onMessage?: (message: ApplicationMessage<AppMessages>) => void;
}

/**
 * Public API exposed to consumers. It purposely hides the underlying PeerJS
 * instance to keep responsibilities separate.
 */
export interface PeerRuntime<AppMessages extends MessageRecord> {
  /** Declared role for this runtime. */
  readonly role: PeerRole;
  /** Active PeerJS identifier, once assigned by the signaling server. */
  readonly peerId: string | null;
  /** Identifier of the currently connected remote peer, if any. */
  readonly remotePeerId: string | null;
  /** Negotiated protocol version, set once the handshake completes. */
  readonly protocolVersion: string | null;
  /** Current UI-facing connection phase. */
  readonly phase: ConnectionPhase;
  /** Last fatal error encountered. */
  readonly error: Error | null;
  /** Typed event emitter for low-level lifecycle events. */
  readonly events: TypedEventEmitter<PeerEvents<AppMessages>>;
  /** Initiates or re-initiates a connection toward a remote peer. */
  connect(remotePeerId: string): Promise<void>;
  /** Closes the current data channel but keeps the PeerJS instance alive. */
  disconnect(): void;
  /** Tears down the PeerJS instance entirely. */
  destroy(): void;
  /**
   * Sends an application-level message. When the data channel is unavailable,
   * the payload is queued and delivered once the handshake completes.
   */
  send<Type extends keyof AppMessages & string>(
    type: Type,
    payload: AppMessages[Type],
  ): void;
  /**
   * Subscribes to application messages of a specific type. Returns an
   * unsubscribe function.
   */
  onMessage<Type extends keyof AppMessages & string>(
    type: Type,
    listener: (message: Message<Type, AppMessages[Type]>) => void,
  ): () => void;
}

/** Convenience type mapping a message map to its discriminated union. */
export type ApplicationMessage<AppMessages extends MessageRecord> = {
  [Type in keyof AppMessages & string]: Message<Type, AppMessages[Type]>;
}[keyof AppMessages & string];

type QueuedApplicationMessage<AppMessages extends MessageRecord> = {
  [Type in keyof AppMessages & string]: {
    type: Type;
    payload: AppMessages[Type];
    queuedAt: number;
    attempts: number;
  };
}[keyof AppMessages & string];

type HeartbeatState = {
  intervalId: number | null;
  pendingPings: Map<string, number>;
};

type HandshakeState = {
  sessionId: string | null;
  ackReceived: boolean;
  completed: boolean;
  negotiatedVersion: string | null;
};

type MessageListener = (message: Message<string, unknown>) => void;

type MessageListenerRegistry = Map<string, Set<MessageListener>>;

/**
 * Typed event emitter implementation backed by `Map`/`Set`.
 */
export interface TypedEventEmitter<EventMap extends Record<string, unknown>> {
  on<Event extends keyof EventMap & string>(
    event: Event,
    listener: (payload: EventMap[Event]) => void,
  ): () => void;
  once<Event extends keyof EventMap & string>(
    event: Event,
    listener: (payload: EventMap[Event]) => void,
  ): () => void;
  off<Event extends keyof EventMap & string>(
    event: Event,
    listener: (payload: EventMap[Event]) => void,
  ): void;
  emit<Event extends keyof EventMap & string>(
    event: Event,
    payload: EventMap[Event],
  ): void;
  listenerCount<Event extends keyof EventMap & string>(event: Event): number;
  clear(): void;
}

const createTypedEventEmitter = <
  EventMap extends Record<string, unknown>,
>(): TypedEventEmitter<EventMap> => {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();

  const emitter: TypedEventEmitter<EventMap> = {
    on<Event extends keyof EventMap & string>(
      event: Event,
      listener: (payload: EventMap[Event]) => void,
    ) {
      const set = listeners.get(event) ?? new Set();
      set.add(listener as (payload: unknown) => void);
      listeners.set(event, set);
      return () => emitter.off(event, listener);
    },
    once<Event extends keyof EventMap & string>(
      event: Event,
      listener: (payload: EventMap[Event]) => void,
    ) {
      const unsubscribe = emitter.on(event, (payload) => {
        unsubscribe();
        listener(payload as EventMap[Event]);
      });
      return unsubscribe;
    },
    off<Event extends keyof EventMap & string>(
      event: Event,
      listener: (payload: EventMap[Event]) => void,
    ) {
      const set = listeners.get(event);
      if (!set) {
        return;
      }
      set.delete(listener as (payload: unknown) => void);
      if (set.size === 0) {
        listeners.delete(event);
      }
    },
    emit<Event extends keyof EventMap & string>(
      event: Event,
      payload: EventMap[Event],
    ) {
      const set = listeners.get(event);
      if (!set) {
        return;
      }
      for (const listener of Array.from(set)) {
        listener(payload);
      }
    },
    listenerCount<Event extends keyof EventMap & string>(event: Event) {
      return listeners.get(event)?.size ?? 0;
    },
    clear() {
      listeners.clear();
    },
  };

  return emitter;
};

class PeerInitializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PeerInitializationError";
  }
}

class ProtocolNegotiationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProtocolNegotiationError";
  }
}

interface SystemMessageMap {
  "system/handshake": {
    sessionId: string;
    supportedVersions: readonly SupportedProtocolVersion[];
    role: PeerRole;
  };
  "system/handshake-ack": {
    handshakeSessionId: string;
    agreedVersion: SupportedProtocolVersion;
    remoteRole: PeerRole;
  };
  "system/handshake-reject": {
    handshakeSessionId: string;
    reason: string;
    supportedVersions: readonly SupportedProtocolVersion[];
  };
  "system/ping": {
    nonce: string;
    sentAt: number;
  };
  "system/pong": {
    nonce: string;
    sentAt: number;
  };
  "system/restart-ice": {
    reason: string;
    requestedAt: number;
  };
}

type SystemMessage = ApplicationMessage<SystemMessageMap>;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isMessage = (value: unknown): value is Message<string, unknown> => {
  if (!isObject(value)) {
    return false;
  }
  return (
    typeof value.type === "string" &&
    typeof value.version === "string" &&
    typeof value.timestamp === "number" &&
    "payload" in value
  );
};

const createNonce = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

const calculateRetryDelay = (attempt: number) =>
  Math.min(
    Math.round(INITIAL_RETRY_DELAY_MS * 2 ** Math.max(0, attempt - 1)),
    MAX_RETRY_DELAY_MS,
  );

const isSystemMessageType = (type: string): type is keyof SystemMessageMap =>
  type.startsWith("system/");

const resolveProtocolVersion = (
  localVersions: readonly SupportedProtocolVersion[],
  remoteVersions: readonly SupportedProtocolVersion[],
): SupportedProtocolVersion | null => {
  for (const version of localVersions) {
    if (remoteVersions.includes(version)) {
      return version;
    }
  }
  return null;
};

type Logger = Required<Pick<Console, "debug" | "info" | "warn" | "error">>;

const defaultLogger: Logger = {
  debug: (...args) => console.debug(...args),
  info: (...args) => console.info(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};

class PeerConnectionManager<AppMessages extends MessageRecord>
  implements PeerRuntime<AppMessages>
{
  public readonly role: PeerRole;
  public get peerId(): string | null {
    return this._peerId;
  }

  public get remotePeerId(): string | null {
    return this._remotePeerId;
  }

  public get protocolVersion(): string | null {
    return this.handshake.negotiatedVersion;
  }

  public get phase(): ConnectionPhase {
    return this._phase;
  }

  public get error(): Error | null {
    return this._error;
  }

  public readonly events: TypedEventEmitter<PeerEvents<AppMessages>>;

  private readonly logger: Logger;
  private readonly supportedVersions: readonly SupportedProtocolVersion[];
  private readonly handshakeTimeout: number;
  private readonly heartbeatInterval: number;
  private readonly heartbeatTimeout: number;
  private readonly maxReconnectAttempts: number;
  private readonly metadata: Record<string, unknown> | undefined;
  private readonly peerOptions: PeerJSOption | undefined;
  private readonly onMessageCallback?: (
    message: ApplicationMessage<AppMessages>,
  ) => void;

  private peer: Peer | null = null;
  private dataConnection: DataConnection | null = null;
  private _peerId: string | null = null;
  private _remotePeerId: string | null = null;
  private _phase: ConnectionPhase = "idle";
  private _error: Error | null = null;
  private readonly heartbeat: HeartbeatState = {
    intervalId: null,
    pendingPings: new Map(),
  };
  private readonly outboundQueue: QueuedApplicationMessage<AppMessages>[] = [];
  private readonly messageListeners: MessageListenerRegistry = new Map();
  private handshake: HandshakeState = {
    sessionId: null,
    ackReceived: false,
    completed: false,
    negotiatedVersion: null,
  };
  private handshakeTimer: number | null = null;
  private retryAttempt = 0;
  private targetPeerId: string | null = null;
  private destroyed = false;
  private awaitingPeerOpen = false;

  constructor(options: PeerRuntimeOptions<AppMessages>) {
    if (typeof window === "undefined") {
      throw new PeerInitializationError(
        "Peer connections require a browser environment.",
      );
    }

    this.role = options.role;
    this.logger = options.logger
      ? {
          debug: options.logger.debug ?? defaultLogger.debug,
          info: options.logger.info ?? defaultLogger.info,
          warn: options.logger.warn ?? defaultLogger.warn,
          error: options.logger.error ?? defaultLogger.error,
        }
      : defaultLogger;
    this.supportedVersions =
      options.supportedProtocolVersions ?? DEFAULT_SUPPORTED_PROTOCOL_VERSIONS;
    this.handshakeTimeout =
      options.handshakeTimeoutMs ?? DEFAULT_HANDSHAKE_TIMEOUT_MS;
    this.heartbeatInterval =
      options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;
    this.heartbeatTimeout =
      options.heartbeatTimeoutMs ?? DEFAULT_HEARTBEAT_TIMEOUT_MS;
    this.maxReconnectAttempts =
      options.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS;
    this.metadata = options.metadata;
    this.peerOptions = options.peerOptions;
    this.onMessageCallback = options.onMessage;
    this.events = createTypedEventEmitter();
    this.setPhase("connecting");

    this.initializePeer(options.peerId);
  }

  public connect(remotePeerId: string): Promise<void> {
    if (!remotePeerId) {
      return Promise.reject(
        new Error("A remote peer identifier is required to connect."),
      );
    }
    if (this.destroyed) {
      return Promise.reject(
        new Error("Cannot connect because the runtime has been destroyed."),
      );
    }
    const currentConnection = this.dataConnection;
    if (
      currentConnection?.open &&
      currentConnection.peer === remotePeerId &&
      this.handshake.completed
    ) {
      this.logger.debug(
        `[p2p:${this.role}] Connection to ${remotePeerId} already established.`,
      );
      return Promise.resolve();
    }

    this._error = null;
    this.targetPeerId = remotePeerId;
    this.retryAttempt = 0;

    if (currentConnection && currentConnection.peer !== remotePeerId) {
      this.logger.info(
        `[p2p:${this.role}] Closing previous connection to ${currentConnection.peer} before dialing ${remotePeerId}.`,
      );
      this.disconnect();
    }

    const waitForPeerReady = () => {
      if (this.peerId) {
        this.openDataConnection();
        return;
      }
      if (this.awaitingPeerOpen) {
        this.logger.debug(
          `[p2p:${this.role}] Already waiting for peer identifier before connecting to ${remotePeerId}.`,
        );
        return;
      }
      this.awaitingPeerOpen = true;
      this.logger.debug(
        `[p2p:${this.role}] Waiting for peer identifier before connecting to ${remotePeerId}.`,
      );
      this.events.once("peer/open", () => {
        this.awaitingPeerOpen = false;
        this.openDataConnection();
      });
    };

    waitForPeerReady();

    return new Promise((resolve, reject) => {
      const offPhase = this.events.on("connection/phase", ({ phase }) => {
        if (phase === "connected") {
          cleanup();
          resolve();
        }
      });
      const offError = this.events.on("connection/error", ({ error }) => {
        cleanup();
        reject(error);
      });
      const offDisconnected = this.events.on(
        "connection/disconnected",
        ({ reason }) => {
          if (reason === "destroyed" && this.targetPeerId === null) {
            cleanup();
            reject(new Error("Connection attempt cancelled."));
          }
        },
      );
      const cleanup = () => {
        offPhase();
        offError();
        offDisconnected();
      };
    });
  }

  public disconnect(): void {
    this.logger.info(`[p2p:${this.role}] Disconnect requested.`);
    this.clearHeartbeat();
    this.clearHandshakeTimer();
    this.targetPeerId = null;
    if (this.dataConnection) {
      this.detachConnectionListeners(this.dataConnection);
    }
    this.dataConnection = null;
    this.setRemotePeerId(null);
    this.handshake = {
      sessionId: null,
      ackReceived: false,
      completed: false,
      negotiatedVersion: null,
    };
    this._error = null;
    this.events.emit("connection/disconnected", {
      reason: "destroyed",
      attempt: this.retryAttempt,
    });
    this.retryAttempt = 0;
    this.setPhase("connecting");
  }

  public destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.logger.info(`[p2p:${this.role}] Destroying runtime.`);
    this.disconnect();
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch (error) {
        this.logger.warn(`[p2p:${this.role}] Failed to destroy peer:`, error);
      }
    }
    this.events.emit("peer/close", undefined);
    this.peer = null;
    this._peerId = null;
    this._remotePeerId = null;
    this._phase = "idle";
    this.outboundQueue.length = 0;
    this.messageListeners.clear();
    this.events.clear();
  }

  public send<Type extends keyof AppMessages & string>(
    type: Type,
    payload: AppMessages[Type],
  ): void {
    const entry = {
      type,
      payload,
      queuedAt: Date.now(),
      attempts: 0,
    } as QueuedApplicationMessage<AppMessages>;

    this.flushOutboundQueue();

    if (this.trySendQueuedMessage(entry)) {
      return;
    }

    this.logger.debug(
      `[p2p:${this.role}] Queueing ${type} because the data channel is not ready.`,
      payload,
    );
    this.enqueueOutboundMessage(entry);
  }

  private enqueueOutboundMessage(
    message: QueuedApplicationMessage<AppMessages>,
  ): void {
    if (this.outboundQueue.length >= DEFAULT_OUTBOUND_QUEUE_CAPACITY) {
      const dropped = this.outboundQueue.shift();
      this.logger.warn(
        `[p2p:${this.role}] Outbound queue capacity reached (${DEFAULT_OUTBOUND_QUEUE_CAPACITY}). Dropping oldest message ${dropped?.type ?? "unknown"}.`,
      );
    }
    this.outboundQueue.push(message);
  }

  private flushOutboundQueue(): boolean {
    if (this.outboundQueue.length === 0) {
      return true;
    }

    while (this.outboundQueue.length > 0) {
      const next = this.outboundQueue[0];
      if (!next) {
        break;
      }
      if (!this.trySendQueuedMessage(next)) {
        return false;
      }
      this.outboundQueue.shift();
    }

    return true;
  }

  private trySendQueuedMessage(
    message: QueuedApplicationMessage<AppMessages>,
  ): boolean {
    const connection = this.dataConnection;
    const negotiatedVersion = this.handshake.negotiatedVersion;

    if (
      !connection ||
      !connection.open ||
      !this.handshake.completed ||
      !negotiatedVersion
    ) {
      return false;
    }

    message.attempts += 1;
    const envelope = {
      type: message.type,
      payload: message.payload,
      version: negotiatedVersion,
      timestamp: message.queuedAt,
    } satisfies Message<typeof message.type, AppMessages[typeof message.type]>;

    try {
      this.logger.debug(
        `[p2p:${this.role}] → ${connection.peer}: ${message.type}`,
        message.payload,
      );
      connection.send(envelope);
      return true;
    } catch (error) {
      this.logger.warn(
        `[p2p:${this.role}] Failed to send ${message.type} (attempt ${message.attempts}), retrying when possible.`,
        error,
      );
      return false;
    }
  }

  public onMessage<Type extends keyof AppMessages & string>(
    type: Type,
    listener: (message: Message<Type, AppMessages[Type]>) => void,
  ): () => void {
    const registry = this.messageListeners.get(type) ?? new Set();
    const wrapped = listener as MessageListener;
    registry.add(wrapped);
    this.messageListeners.set(type, registry);
    return () => {
      const set = this.messageListeners.get(type);
      if (!set) {
        return;
      }
      set.delete(wrapped);
      if (set.size === 0) {
        this.messageListeners.delete(type);
      }
    };
  }

  private initializePeer(preferredId?: string) {
    this.logger.info(`[p2p:${this.role}] Initialising PeerJS instance.`);
    const peer = new Peer(preferredId ?? undefined, {
      debug: 0,
      ...this.peerOptions,
    });
    this.peer = peer;

    peer.on("open", (id) => {
      this.logger.info(`[p2p:${this.role}] Peer ready with id ${id}.`);
      this._peerId = id;
      this.awaitingPeerOpen = false;
      this.events.emit("peer/open", { peerId: id });
    });

    peer.on("connection", (connection) => {
      this.logger.info(
        `[p2p:${this.role}] Incoming data connection from ${connection.peer}.`,
      );
      this.setRemotePeerId(connection.peer);
      this.bindConnection(connection);
    });

    peer.on("disconnected", () => {
      this.logger.warn(
        `[p2p:${this.role}] Lost connection to signaling server, attempting reconnection...`,
      );
      this.awaitingPeerOpen = true;
      try {
        peer.reconnect();
      } catch (error) {
        this.logger.error(
          `[p2p:${this.role}] Failed to request peer reconnection:`,
          error,
        );
      }
    });

    peer.on("error", (error) => {
      this.logger.error(`[p2p:${this.role}] Peer error`, error);
      const peerError =
        error instanceof Error ? error : new Error(String(error));
      this.events.emit("connection/error", { error: peerError });
      this._error = peerError;
      this.setPhase("error");
    });

    peer.on("close", () => {
      this.logger.warn(`[p2p:${this.role}] Peer closed.`);
      this.events.emit("peer/close", undefined);
    });
  }

  private openDataConnection() {
    const peer = this.peer;
    const targetPeerId = this.targetPeerId;
    if (!peer || !targetPeerId) {
      return;
    }
    if (this.destroyed) {
      return;
    }
    const attempt = ++this.retryAttempt;
    const delay = attempt === 1 ? 0 : calculateRetryDelay(attempt);
    const scheduledPhase = attempt === 1 ? "connecting" : "reconnecting";
    this.logger.info(
      `[p2p:${this.role}] Scheduling connection attempt ${attempt} to ${this.targetPeerId} in ${delay}ms.`,
    );
    this.events.emit("connection/retry", { attempt, delay });
    this.setPhase(scheduledPhase);

    window.setTimeout(() => {
      if (this.destroyed) {
        return;
      }
      this.logger.info(
        `[p2p:${this.role}] Dialling ${targetPeerId} (attempt ${attempt}).`,
      );
      const connection = peer.connect(targetPeerId, {
        reliable: true,
        metadata: this.metadata,
      });
      this.bindConnection(connection);
    }, delay);
  }

  private bindConnection(connection: DataConnection) {
    if (this.dataConnection) {
      this.logger.warn(
        `[p2p:${this.role}] Replacing existing data connection with ${connection.peer}.`,
      );
      this.detachConnectionListeners(this.dataConnection);
    }

    this.dataConnection = connection;
    this.setRemotePeerId(connection.peer);

    const handshakeSessionId = createNonce();
    const handleOpen = () => {
      this.logger.info(
        `[p2p:${this.role}] Data channel open with ${connection.peer}.`,
      );
      this.startHandshake(handshakeSessionId);
      this.sendSystemMessage("system/handshake", {
        sessionId: handshakeSessionId,
        supportedVersions: this.supportedVersions,
        role: this.role,
      });
    };

    const handleData = (raw: unknown) => {
      if (!isMessage(raw)) {
        this.logger.warn(
          `[p2p:${this.role}] Received malformed payload from ${connection.peer}.`,
          raw,
        );
        return;
      }
      if (isSystemMessageType(raw.type)) {
        this.handleSystemMessage(raw as SystemMessage);
        return;
      }
      if (!this.handshake.completed) {
        this.logger.warn(
          `[p2p:${this.role}] Ignoring application message before handshake completion.`,
          raw,
        );
        return;
      }
      if (
        this.handshake.negotiatedVersion &&
        raw.version !== this.handshake.negotiatedVersion
      ) {
        this.logger.warn(
          `[p2p:${this.role}] Ignoring message ${raw.type} with mismatched protocol version ${raw.version}.`,
        );
        return;
      }
      this.logger.debug(
        `[p2p:${this.role}] ← ${connection.peer}: ${raw.type}`,
        raw.payload,
      );
      this.dispatchApplicationMessage(raw as ApplicationMessage<AppMessages>);
    };

    const handleClose = () => {
      this.logger.warn(
        `[p2p:${this.role}] Data channel closed by ${connection.peer}.`,
      );
      this.handleConnectionClosed("remote-closed");
    };

    const handleError = (error: PeerError<string>) => {
      this.logger.error(
        `[p2p:${this.role}] Data channel error from ${connection.peer}:`,
        error,
      );
      this.handleConnectionClosed("data-channel-error");
    };

    const handleIceState = (state: RTCIceConnectionState) => {
      this.logger.debug(
        `[p2p:${this.role}] ICE state changed to ${state} for ${connection.peer}.`,
      );
      if (state === "failed" || state === "disconnected") {
        this.requestIceRestart(state);
      }
    };

    connection.on("open", handleOpen);
    connection.on("data", handleData);
    connection.on("close", handleClose);
    connection.on("error", handleError);
    connection.on("iceStateChanged", handleIceState);
  }

  private detachConnectionListeners(connection: DataConnection) {
    connection.off("open");
    connection.off("data");
    connection.off("close");
    connection.off("error");
    connection.off("iceStateChanged");
    try {
      connection.close();
    } catch (error) {
      this.logger.warn(
        `[p2p:${this.role}] Error while closing old data connection:`,
        error,
      );
    }
  }

  private startHandshake(sessionId: string) {
    this._error = null;
    this.handshake = {
      sessionId,
      ackReceived: false,
      completed: false,
      negotiatedVersion: null,
    };
    this.setPhase("connecting");
    this.clearHandshakeTimer();
    this.handshakeTimer = window.setTimeout(() => {
      this.logger.error(
        `[p2p:${this.role}] Handshake timed out for session ${sessionId}.`,
      );
      this.handleConnectionClosed("handshake-timeout");
    }, this.handshakeTimeout);
  }

  private completeHandshake(version: SupportedProtocolVersion) {
    if (this.handshake.completed) {
      return;
    }
    this.logger.info(
      `[p2p:${this.role}] Handshake completed with protocol ${version}.`,
    );
    this.handshake.completed = true;
    this.handshake.negotiatedVersion = version;
    this.retryAttempt = 0;
    this.clearHandshakeTimer();
    this.setPhase("connected");
    this.events.emit("connection/remote", { peerId: this._remotePeerId });
    this.startHeartbeat();
    this.flushOutboundQueue();
  }

  private handleSystemMessage(message: SystemMessage) {
    switch (message.type) {
      case "system/handshake": {
        const acceptedVersion = resolveProtocolVersion(
          this.supportedVersions,
          message.payload.supportedVersions,
        );
        if (!acceptedVersion) {
          this.logger.error(
            `[p2p:${this.role}] Protocol negotiation failed with ${this._remotePeerId}.`,
          );
          const error = new ProtocolNegotiationError(
            "No compatible protocol version found.",
          );
          this.sendSystemMessage("system/handshake-reject", {
            handshakeSessionId: message.payload.sessionId,
            reason: "unsupported-version",
            supportedVersions: this.supportedVersions,
          });
          this._error = error;
          this.events.emit("connection/error", { error });
          this.handleConnectionClosed("handshake-error");
          return;
        }
        this.handshake.negotiatedVersion = acceptedVersion;
        this.sendSystemMessage("system/handshake-ack", {
          handshakeSessionId: message.payload.sessionId,
          agreedVersion: acceptedVersion,
          remoteRole: this.role,
        });
        if (this.handshake.ackReceived) {
          this.completeHandshake(acceptedVersion);
        }
        return;
      }
      case "system/handshake-ack": {
        if (message.payload.handshakeSessionId !== this.handshake.sessionId) {
          this.logger.debug(
            `[p2p:${this.role}] Ignoring handshake ack for stale session ${message.payload.handshakeSessionId}.`,
          );
          return;
        }
        if (!this.supportedVersions.includes(message.payload.agreedVersion)) {
          const error = new ProtocolNegotiationError(
            `Remote acknowledged unsupported protocol version ${message.payload.agreedVersion}.`,
          );
          this._error = error;
          this.events.emit("connection/error", { error });
          this.handleConnectionClosed("handshake-error");
          return;
        }
        this.handshake.ackReceived = true;
        this.handshake.negotiatedVersion = message.payload.agreedVersion;
        if (this.handshake.negotiatedVersion) {
          this.completeHandshake(
            this.handshake.negotiatedVersion as SupportedProtocolVersion,
          );
        }
        return;
      }
      case "system/handshake-reject": {
        if (message.payload.handshakeSessionId !== this.handshake.sessionId) {
          return;
        }
        const error = new ProtocolNegotiationError(
          `Remote peer rejected handshake: ${message.payload.reason}.`,
        );
        this.events.emit("connection/error", { error });
        this._error = error;
        this.handleConnectionClosed("handshake-error");
        return;
      }
      case "system/ping": {
        this.sendSystemMessage("system/pong", {
          nonce: message.payload.nonce,
          sentAt: Date.now(),
        });
        return;
      }
      case "system/pong": {
        const timeoutId = this.heartbeat.pendingPings.get(
          message.payload.nonce,
        );
        if (typeof timeoutId !== "number") {
          return;
        }
        window.clearTimeout(timeoutId);
        this.heartbeat.pendingPings.delete(message.payload.nonce);
        return;
      }
      case "system/restart-ice": {
        this.logger.warn(
          `[p2p:${this.role}] ICE restart requested by remote: ${message.payload.reason}.`,
        );
        this.performIceRestart();
        return;
      }
      default:
        return;
    }
  }

  private dispatchApplicationMessage(message: ApplicationMessage<AppMessages>) {
    const listeners = this.messageListeners.get(message.type);
    if (listeners) {
      for (const listener of Array.from(listeners)) {
        try {
          listener(message);
        } catch (error) {
          this.logger.error(
            `[p2p:${this.role}] Error in message listener for ${message.type}:`,
            error,
          );
        }
      }
    }
    this.onMessageCallback?.(message);
    this.events.emit("message", message);
  }

  private startHeartbeat() {
    this.clearHeartbeat();
    const sendPing = () => {
      if (!this.dataConnection || !this.dataConnection.open) {
        return;
      }
      const nonce = createNonce();
      const timeoutId = window.setTimeout(() => {
        this.logger.error(
          `[p2p:${this.role}] Heartbeat timeout for nonce ${nonce}.`,
        );
        this.handleConnectionClosed("heartbeat-timeout");
      }, this.heartbeatTimeout);
      this.heartbeat.pendingPings.set(nonce, timeoutId);
      this.sendSystemMessage("system/ping", {
        nonce,
        sentAt: Date.now(),
      });
    };
    sendPing();
    this.heartbeat.intervalId = window.setInterval(
      sendPing,
      this.heartbeatInterval,
    );
  }

  private clearHeartbeat() {
    if (this.heartbeat.intervalId) {
      window.clearInterval(this.heartbeat.intervalId);
    }
    for (const timeoutId of this.heartbeat.pendingPings.values()) {
      window.clearTimeout(timeoutId);
    }
    this.heartbeat.pendingPings.clear();
    this.heartbeat.intervalId = null;
  }

  private clearHandshakeTimer() {
    if (this.handshakeTimer) {
      window.clearTimeout(this.handshakeTimer);
      this.handshakeTimer = null;
    }
  }

  private sendSystemMessage<Type extends keyof SystemMessageMap>(
    type: Type,
    payload: SystemMessageMap[Type],
  ) {
    if (!this.dataConnection) {
      return;
    }
    const version =
      this.handshake.negotiatedVersion ?? this.supportedVersions[0];
    const message: Message<Type, SystemMessageMap[Type]> = {
      type,
      payload,
      version,
      timestamp: Date.now(),
    };
    try {
      this.dataConnection.send(message);
    } catch (error) {
      this.logger.error(
        `[p2p:${this.role}] Failed to send system message ${type}:`,
        error,
      );
    }
  }

  private handleConnectionClosed(reason: DisconnectReason) {
    this.logger.warn(`[p2p:${this.role}] Connection closed (${reason}).`);
    this.clearHeartbeat();
    this.clearHandshakeTimer();
    if (this.dataConnection) {
      this.dataConnection.off("open");
      this.dataConnection.off("data");
      this.dataConnection.off("close");
      this.dataConnection.off("error");
      this.dataConnection.off("iceStateChanged");
    }
    this.dataConnection = null;
    this.events.emit("connection/disconnected", {
      reason,
      attempt: this.retryAttempt,
    });
    this.setRemotePeerId(null);
    this.handshake = {
      sessionId: null,
      ackReceived: false,
      completed: false,
      negotiatedVersion: null,
    };
    if (this.destroyed) {
      return;
    }
    if (reason === "destroyed") {
      this.setPhase("connecting");
      return;
    }
    if (reason === "handshake-error") {
      this.targetPeerId = null;
      this.setPhase("error");
      return;
    }
    if (this.role === PeerRole.Guest && this.targetPeerId) {
      if (this.retryAttempt >= this.maxReconnectAttempts) {
        const error = new Error(
          `Failed to reconnect after ${this.maxReconnectAttempts} attempts.`,
        );
        this.logger.error(`[p2p:${this.role}] ${error.message}`);
        this._error = error;
        this.events.emit("connection/error", { error });
        this.setPhase("error");
        return;
      }
      this.openDataConnection();
    } else {
      this.setPhase("reconnecting");
    }
  }

  private requestIceRestart(state: RTCIceConnectionState) {
    this.logger.warn(
      `[p2p:${this.role}] ICE state ${state} detected, requesting restart.`,
    );
    this.sendSystemMessage("system/restart-ice", {
      reason: `ice-state-${state}`,
      requestedAt: Date.now(),
    });
    this.performIceRestart();
  }

  private performIceRestart() {
    if (!this.dataConnection || !this.dataConnection.peerConnection) {
      return;
    }
    const pc = this.dataConnection.peerConnection;
    if (typeof pc.restartIce === "function") {
      try {
        pc.restartIce();
      } catch (error) {
        this.logger.warn(`[p2p:${this.role}] Failed to restart ICE:`, error);
      }
    } else {
      this.logger.debug(
        `[p2p:${this.role}] PeerConnection.restartIce is not supported in this browser.`,
      );
    }
  }

  private setPhase(phase: ConnectionPhase) {
    if (this._phase === phase) {
      return;
    }
    const previous = this._phase;
    this._phase = phase;
    this.logger.debug(`[p2p:${this.role}] Phase ${previous} → ${phase}.`);
    this.events.emit("connection/phase", { phase, previous });
  }

  private setRemotePeerId(peerId: string | null) {
    this._remotePeerId = peerId;
    this.events.emit("connection/remote", { peerId });
  }
}

/**
 * Runtime factory ensuring a single point of instantiation.
 */
export const createPeer = <AppMessages extends MessageRecord>(
  options: PeerRuntimeOptions<AppMessages>,
): PeerRuntime<AppMessages> => new PeerConnectionManager(options);

/**
 * Helper exported for API symmetry.
 */
export const connect = <AppMessages extends MessageRecord>(
  runtime: PeerRuntime<AppMessages>,
  remotePeerId: string,
) => runtime.connect(remotePeerId);

/**
 * Returns the runtime event emitter.
 */
export const events = <AppMessages extends MessageRecord>(
  runtime: PeerRuntime<AppMessages>,
) => runtime.events;

interface UsePeerState {
  peerId: string | null;
  remotePeerId: string | null;
  phase: ConnectionPhase;
  error: Error | null;
}

const initialPeerState: UsePeerState = {
  peerId: null,
  remotePeerId: null,
  phase: "connecting",
  error: null,
};

/**
 * Return type shared by {@link usePeerHost} and {@link usePeerGuest}. It
 * exposes the currently negotiated peer identifiers, the connection phase and
 * helper methods to interact with the underlying data channel.
 */
export interface UsePeerResult<AppMessages extends MessageRecord>
  extends UsePeerState {
  controller: PeerRuntime<AppMessages> | null;
  sendMessage: <Type extends keyof AppMessages & string>(
    type: Type,
    payload: AppMessages[Type],
  ) => void;
  onMessage: <Type extends keyof AppMessages & string>(
    type: Type,
    listener: (message: Message<Type, AppMessages[Type]>) => void,
  ) => () => void;
  disconnect: () => void;
}

const createNoopUnsubscribe = () => () => {
  /* noop */
};

const canUseDOM = typeof window !== "undefined";

/** Shared hook setup logic. */
const usePeerRuntime = <AppMessages extends MessageRecord>(
  options: PeerRuntimeOptions<AppMessages>,
  autoConnectTarget?: string | null,
): UsePeerResult<AppMessages> => {
  const runtimeRef = useRef<PeerRuntime<AppMessages> | null>(null);
  const initialOptionsRef = useRef(options);
  const [state, setState] = useState<UsePeerState>(initialPeerState);

  useEffect(() => {
    initialOptionsRef.current = options;
  }, [options]);

  useEffect(() => {
    if (!canUseDOM) {
      setState((previous) => ({
        ...previous,
        phase: "error",
        error: new PeerInitializationError(
          "Peer connections require a browser environment.",
        ),
      }));
      return;
    }
    const runtime = createPeer<AppMessages>(initialOptionsRef.current);
    runtimeRef.current = runtime;
    const offPeerOpen = runtime.events.on("peer/open", ({ peerId }) => {
      setState((previous) => ({ ...previous, peerId }));
    });
    const offRemote = runtime.events.on("connection/remote", ({ peerId }) => {
      setState((previous) => ({ ...previous, remotePeerId: peerId }));
    });
    const offPhase = runtime.events.on("connection/phase", ({ phase }) => {
      setState((previous) => ({
        ...previous,
        phase,
        error: phase === "error" ? previous.error : null,
      }));
    });
    const offError = runtime.events.on("connection/error", ({ error }) => {
      setState((previous) => ({ ...previous, error, phase: "error" }));
    });

    return () => {
      offPeerOpen();
      offRemote();
      offPhase();
      offError();
      runtime.destroy();
      runtimeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (initialOptionsRef.current.role !== PeerRole.Guest) {
      return;
    }
    if (!autoConnectTarget) {
      runtimeRef.current?.disconnect();
      return;
    }
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }
    runtime.connect(autoConnectTarget).catch((error) => {
      setState((previous) => ({ ...previous, error, phase: "error" }));
    });
  }, [autoConnectTarget]);

  const sendMessage = useMemo(() => {
    return <Type extends keyof AppMessages & string>(
      type: Type,
      payload: AppMessages[Type],
    ) => {
      runtimeRef.current?.send(type, payload);
    };
  }, []);

  const onMessage = useMemo(() => {
    return <Type extends keyof AppMessages & string>(
      type: Type,
      listener: (message: Message<Type, AppMessages[Type]>) => void,
    ) => {
      if (!runtimeRef.current) {
        return createNoopUnsubscribe;
      }
      return runtimeRef.current.onMessage(type, listener);
    };
  }, []);

  const disconnect = useMemo(() => {
    return () => {
      runtimeRef.current?.disconnect();
      setState((previous) => ({
        ...previous,
        remotePeerId: null,
        phase: "connecting",
      }));
    };
  }, []);

  return {
    controller: runtimeRef.current,
    sendMessage,
    onMessage,
    disconnect,
    ...state,
  };
};

export type UsePeerHostOptions<AppMessages extends MessageRecord> = Omit<
  PeerRuntimeOptions<AppMessages>,
  "role"
>;

/**
 * Host-side convenience hook. It instantiates a {@link PeerRuntime} in "host"
 * mode and exposes connection state for UI bindings. The returned controller
 * can be used to subscribe to custom messages or to manually terminate the
 * data channel.
 */
export const usePeerHost = <AppMessages extends MessageRecord>(
  options?: UsePeerHostOptions<AppMessages>,
): UsePeerResult<AppMessages> =>
  usePeerRuntime<AppMessages>({
    role: PeerRole.Host,
    ...options,
  });

export interface UsePeerGuestOptions<AppMessages extends MessageRecord>
  extends Omit<PeerRuntimeOptions<AppMessages>, "role"> {}

/**
 * Guest-side hook. Whenever a host identifier is provided it attempts to dial
 * the remote peer and keeps retrying until a stable data channel is
 * negotiated. Consumers can listen to message events or leverage the
 * connection state for UI feedback.
 */
export const usePeerGuest = <AppMessages extends MessageRecord>(
  hostPeerId: string | null,
  options?: UsePeerGuestOptions<AppMessages>,
): UsePeerResult<AppMessages> =>
  usePeerRuntime<AppMessages>(
    {
      role: PeerRole.Guest,
      ...options,
    },
    hostPeerId,
  );
