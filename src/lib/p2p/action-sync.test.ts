import { describe, expect, it } from "bun:test";

import { createInitialState, reduceGameState } from "../game/state";
import type { Action, GameState, Grid } from "../game/types";
import { GameStatus, PlayerRole } from "../game/types";
import { createActionReplicator } from "./action-sync";
import { PeerRole } from "./peer";
import type { GameActionMessagePayload } from "./protocol";

const hostId = "host-player";
const guestId = "guest-player";

const createGrid = (): Grid => ({
  id: "grid-1",
  name: "Test Grid",
  rows: 2,
  columns: 2,
  cards: [
    { id: "card-a", label: "Alpha" },
    { id: "card-b", label: "Beta" },
    { id: "card-c", label: "Gamma" },
    { id: "card-d", label: "Delta" },
  ],
});

const createHostLobby = (): GameState =>
  reduceGameState(createInitialState(), {
    type: "game/createLobby",
    payload: {
      grid: createGrid(),
      host: { id: hostId, name: "Host", role: PlayerRole.Host },
    },
  });

const createPlayingMatch = (): GameState => {
  const hostLobby = createHostLobby();
  const withGuest = reduceGameState(hostLobby, {
    type: "game/joinLobby",
    payload: { player: { id: guestId, name: "Guest", role: PlayerRole.Guest } },
  });
  const withHostSecret = reduceGameState(withGuest, {
    type: "game/setSecret",
    payload: { playerId: hostId, cardId: "card-a" },
  });
  const withGuestSecret = reduceGameState(withHostSecret, {
    type: "game/setSecret",
    payload: { playerId: guestId, cardId: "card-d" },
  });
  return reduceGameState(withGuestSecret, {
    type: "game/start",
    payload: { startingPlayerId: hostId },
  });
};

describe("createActionReplicator", () => {
  it("applies host actions locally and emits acknowledgements", () => {
    const sent: GameActionMessagePayload[] = [];
    const applied: Action[] = [];

    const replicator = createActionReplicator({
      role: PeerRole.Host,
      localPeerId: "peer-host",
      send: (payload) => {
        sent.push(payload);
      },
      onApply: (action) => {
        applied.push(action);
      },
    });

    const action: Action = { type: "game/reset" };
    const result = replicator.dispatch(action);

    expect(result.appliedLocally).toBe(true);
    expect(result.deferred).toBe(false);
    expect(applied).toHaveLength(1);
    expect(applied[0]).toEqual(action);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      acknowledgedByHost: true,
      issuerPeerId: "peer-host",
      issuerRole: PeerRole.Host,
    });
  });

  it("defers guest lobby joins until the host acknowledges the action", () => {
    const sent: GameActionMessagePayload[] = [];
    const applied: Action[] = [];
    const acknowledgements: string[] = [];

    const replicator = createActionReplicator({
      role: PeerRole.Guest,
      localPeerId: "peer-guest",
      send: (payload) => {
        sent.push(payload);
      },
      shouldDeferLocalApplication: (action) => action.type === "game/joinLobby",
      onApply: (action) => {
        applied.push(action);
      },
      onAcknowledged: (actionId) => {
        acknowledgements.push(actionId);
      },
    });

    const joinAction: Action = {
      type: "game/joinLobby",
      payload: { player: { id: guestId, name: "Guest" } },
    };

    const result = replicator.dispatch(joinAction);
    expect(result.appliedLocally).toBe(false);
    expect(result.deferred).toBe(true);
    expect(applied).toHaveLength(0);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      acknowledgedByHost: false,
      issuerRole: PeerRole.Guest,
    });

    const acknowledgement: GameActionMessagePayload = {
      ...sent[0],
      acknowledgedByHost: true,
      relayedByPeerId: "peer-host",
    };
    const remoteResult = replicator.handleRemote(acknowledgement);

    expect(remoteResult.applied).toBe(true);
    expect(applied).toHaveLength(1);
    expect(acknowledgements).toContain(sent[0].actionId);
    expect(replicator.hasPending(sent[0].actionId)).toBe(false);
  });

  it("acknowledges guest actions exactly once", () => {
    const hostSent: GameActionMessagePayload[] = [];
    const applied: Action[] = [];

    const hostReplicator = createActionReplicator({
      role: PeerRole.Host,
      localPeerId: "peer-host",
      send: (payload) => {
        hostSent.push(payload);
      },
      onApply: (action) => {
        applied.push(action);
      },
    });

    const joinPayload: GameActionMessagePayload = {
      actionId: "action-1",
      action: {
        type: "game/joinLobby",
        payload: { player: { id: guestId, name: "Guest" } },
      },
      issuerPeerId: "peer-guest",
      issuerRole: PeerRole.Guest,
      acknowledgedByHost: false,
    };

    const firstResult = hostReplicator.handleRemote(joinPayload);
    expect(firstResult.applied).toBe(true);
    expect(applied).toHaveLength(1);
    expect(hostSent).toHaveLength(1);
    expect(hostSent[0]).toMatchObject({
      actionId: joinPayload.actionId,
      acknowledgedByHost: true,
      relayedByPeerId: "peer-host",
    });

    const duplicateResult = hostReplicator.handleRemote(joinPayload);
    expect(duplicateResult.applied).toBe(false);
    expect(hostSent).toHaveLength(2);
    expect(hostSent[1]).toMatchObject({
      actionId: joinPayload.actionId,
      acknowledgedByHost: true,
    });
  });
});

describe("action replication integration", () => {
  it("synchronises a join action between host and guest", () => {
    let hostState = createHostLobby();
    let guestState = hostState;

    const hostOutbox: GameActionMessagePayload[] = [];
    const guestOutbox: GameActionMessagePayload[] = [];
    const acknowledgements = new Set<string>();

    const hostReplicator = createActionReplicator({
      role: PeerRole.Host,
      localPeerId: "peer-host",
      send: (payload) => {
        hostOutbox.push(payload);
      },
      onApply: (action) => {
        hostState = reduceGameState(hostState, action);
      },
    });

    const guestReplicator = createActionReplicator({
      role: PeerRole.Guest,
      localPeerId: "peer-guest",
      send: (payload) => {
        guestOutbox.push(payload);
      },
      shouldDeferLocalApplication: (action) => action.type === "game/joinLobby",
      onApply: (action) => {
        guestState = reduceGameState(guestState, action);
      },
      onAcknowledged: (actionId) => {
        acknowledgements.add(actionId);
      },
    });

    const joinAction: Action = {
      type: "game/joinLobby",
      payload: { player: { id: guestId, name: "Guest" } },
    };

    const dispatchResult = guestReplicator.dispatch(joinAction);
    expect(dispatchResult.deferred).toBe(true);
    expect(guestOutbox).toHaveLength(1);
    expect(guestState.players).toHaveLength(1);

    const guestMessage = guestOutbox.shift();
    expect(guestMessage).toBeDefined();
    if (!guestMessage) {
      throw new Error("Guest message was not produced");
    }

    const hostResult = hostReplicator.handleRemote(guestMessage);
    expect(hostResult.applied).toBe(true);
    expect(hostState.status).toBe(GameStatus.Lobby);
    expect(hostState.players).toHaveLength(2);
    expect(hostOutbox).toHaveLength(1);

    const acknowledgement = hostOutbox.shift();
    expect(acknowledgement).toBeDefined();
    if (!acknowledgement) {
      throw new Error("Host acknowledgement missing");
    }

    const guestResult = guestReplicator.handleRemote(acknowledgement);
    expect(guestResult.applied).toBe(true);
    expect(guestState.players).toHaveLength(2);
    expect(acknowledgements.has(acknowledgement.actionId)).toBe(true);

    const duplicateAck = guestReplicator.handleRemote(acknowledgement);
    expect(duplicateAck.applied).toBe(false);
  });

  it("propagates a restart so that both peers return to a fresh lobby", () => {
    const initialPlaying = createPlayingMatch();
    let hostState = initialPlaying;
    let guestState = initialPlaying;

    const hostOutbox: GameActionMessagePayload[] = [];

    const hostReplicator = createActionReplicator({
      role: PeerRole.Host,
      localPeerId: "peer-host",
      send: (payload) => {
        hostOutbox.push(payload);
      },
      onApply: (action) => {
        hostState = reduceGameState(hostState, action);
      },
    });

    const guestReplicator = createActionReplicator({
      role: PeerRole.Guest,
      localPeerId: "peer-guest",
      send: () => {
        /* Restart actions are already acknowledged by the host. */
      },
      onApply: (action) => {
        guestState = reduceGameState(guestState, action);
      },
    });

    const dispatchResult = hostReplicator.dispatch({ type: "game/restart" });
    expect(dispatchResult.appliedLocally).toBe(true);
    expect(hostState.status).toBe(GameStatus.Lobby);
    expect(hostState.players).toHaveLength(1);
    expect(hostState.players[0]?.id).toBe(hostId);

    expect(hostOutbox).toHaveLength(1);
    const restartPayload = hostOutbox[0];
    expect(restartPayload).toBeDefined();
    if (!restartPayload) {
      throw new Error("Expected restart payload to be emitted");
    }

    const remoteResult = guestReplicator.handleRemote(restartPayload);
    expect(remoteResult.applied).toBe(true);
    expect(guestState.status).toBe(GameStatus.Lobby);
    expect(guestState.players).toHaveLength(1);
    expect(guestState.players[0]?.id).toBe(hostId);
  });

  it("propagates leave actions from the host to the guest", () => {
    let hostState = createHostLobby();
    let guestState = hostState;

    const hostOutbox: GameActionMessagePayload[] = [];
    const guestOutbox: GameActionMessagePayload[] = [];

    const hostReplicator = createActionReplicator({
      role: PeerRole.Host,
      localPeerId: "peer-host",
      send: (payload) => {
        hostOutbox.push(payload);
      },
      onApply: (action) => {
        hostState = reduceGameState(hostState, action);
      },
    });

    const guestReplicator = createActionReplicator({
      role: PeerRole.Guest,
      localPeerId: "peer-guest",
      send: (payload) => {
        guestOutbox.push(payload);
      },
      shouldDeferLocalApplication: (action) => action.type === "game/joinLobby",
      onApply: (action) => {
        guestState = reduceGameState(guestState, action);
      },
    });

    const joinAction: Action = {
      type: "game/joinLobby",
      payload: { player: { id: guestId, name: "Guest" } },
    };

    guestReplicator.dispatch(joinAction);
    const joinMessage = guestOutbox.shift();
    if (!joinMessage) {
      throw new Error("Expected join message to be sent");
    }
    hostReplicator.handleRemote(joinMessage);
    const joinAck = hostOutbox.shift();
    if (!joinAck) {
      throw new Error("Expected join acknowledgement");
    }
    guestReplicator.handleRemote(joinAck);

    const leaveAction: Action = {
      type: "game/leave",
      payload: { playerId: guestId },
    };

    const dispatchResult = hostReplicator.dispatch(leaveAction);
    expect(dispatchResult.appliedLocally).toBe(true);
    expect(hostState.status).toBe(GameStatus.Lobby);
    expect(hostState.players.some((player) => player.id === guestId)).toBe(
      false,
    );

    const leaveMessage = hostOutbox.shift();
    expect(leaveMessage).toBeDefined();
    if (!leaveMessage) {
      throw new Error("Leave message missing");
    }

    const guestResult = guestReplicator.handleRemote(leaveMessage);
    expect(guestResult.applied).toBe(true);
    expect(guestState.players.some((player) => player.id === guestId)).toBe(
      false,
    );
  });
});
