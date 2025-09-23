"use client";

import { useEffect, useRef, useState } from "react";

import {
  type ConnectionPhase,
  createPeer,
  type DisconnectReason,
  PeerRole,
  type PeerRuntime,
} from "@/lib/p2p/peer";
import {
  type GameProtocolMessageMap,
  SUPPORTED_GAME_PROTOCOL_VERSIONS,
} from "@/lib/p2p/protocol";

export interface RoomPeerCreationConfig {
  role: PeerRole;
  peerId: string;
  metadata: Record<string, unknown>;
}

export interface RoomPeerRuntimeState {
  runtime: PeerRuntime<GameProtocolMessageMap> | null;
  peerId: string | null;
  remotePeerId: string | null;
  phase: ConnectionPhase;
  error: Error | null;
}

export interface RoomPeerRuntimeOptions {
  onRemoteDisconnect?: (event: {
    peerId: string | null;
    reason: DisconnectReason;
    attempt: number;
  }) => void;
}

const createInitialPeerState = (): Omit<RoomPeerRuntimeState, "runtime"> => ({
  peerId: null,
  remotePeerId: null,
  phase: "idle",
  error: null,
});

/**
 * Initializes and maintains the lifecycle of the peer runtime used within a room page.
 * It automatically wires the peer event listeners and exposes the latest connection state.
 */
export const useRoomPeerRuntime = (
  config: RoomPeerCreationConfig | null,
  remotePeerId: string | null,
  options?: RoomPeerRuntimeOptions,
): RoomPeerRuntimeState => {
  const runtimeRef = useRef<PeerRuntime<GameProtocolMessageMap> | null>(null);
  const [state, setState] = useState<Omit<RoomPeerRuntimeState, "runtime">>(
    createInitialPeerState,
  );
  const lastRemotePeerIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!config) {
      if (runtimeRef.current) {
        runtimeRef.current.destroy();
        runtimeRef.current = null;
      }
      setState(createInitialPeerState());
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const runtime = createPeer<GameProtocolMessageMap>({
      role: config.role,
      peerId: config.peerId,
      metadata: config.metadata,
      supportedProtocolVersions: SUPPORTED_GAME_PROTOCOL_VERSIONS,
    });
    runtimeRef.current = runtime;
    setState({
      peerId: runtime.peerId,
      remotePeerId: runtime.remotePeerId,
      phase: runtime.phase,
      error: null,
    });
    lastRemotePeerIdRef.current = runtime.remotePeerId;

    const offPeerOpen = runtime.events.on("peer/open", ({ peerId }) => {
      setState((previous) => ({ ...previous, peerId }));
    });
    const offRemote = runtime.events.on("connection/remote", ({ peerId }) => {
      lastRemotePeerIdRef.current = peerId;
      setState((previous) => ({ ...previous, remotePeerId: peerId }));
    });
    const offPhase = runtime.events.on("connection/phase", ({ phase }) => {
      setState((previous) => ({ ...previous, phase }));
    });
    const offError = runtime.events.on("connection/error", ({ error }) => {
      setState((previous) => ({ ...previous, error, phase: "error" }));
    });
    const offDisconnected = runtime.events.on(
      "connection/disconnected",
      ({ reason, attempt }) => {
        const disconnectedPeerId = lastRemotePeerIdRef.current;
        setState((previous) => ({
          ...previous,
          remotePeerId: null,
          phase: "reconnecting",
        }));
        lastRemotePeerIdRef.current = null;
        options?.onRemoteDisconnect?.({
          peerId: disconnectedPeerId,
          reason,
          attempt,
        });
      },
    );
    const offPeerClose = runtime.events.on("peer/close", () => {
      setState(createInitialPeerState());
    });

    return () => {
      offPeerOpen();
      offRemote();
      offPhase();
      offError();
      offDisconnected();
      offPeerClose();
      runtime.destroy();
      runtimeRef.current = null;
      setState(createInitialPeerState());
    };
  }, [config, options?.onRemoteDisconnect]);

  useEffect(() => {
    if (!config || config.role !== PeerRole.Guest) {
      return;
    }
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }
    if (!remotePeerId) {
      runtime.disconnect();
      return;
    }
    runtime.connect(remotePeerId).catch((error) => {
      setState((previous) => ({ ...previous, error, phase: "error" }));
    });
  }, [config, remotePeerId]);

  return {
    runtime: runtimeRef.current,
    peerId: state.peerId,
    remotePeerId: state.remotePeerId,
    phase: state.phase,
    error: state.error,
  };
};
