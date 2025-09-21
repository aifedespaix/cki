import { describe, expect, it } from "bun:test";

import { createInitialState, reduceGameState } from "./state";
import {
  applyAction,
  applySnapshot,
  createGameJournal,
  GameSyncError,
} from "./sync";
import {
  type GameState,
  GameStatus,
  PlayerRole,
  type PlayingState,
} from "./types";

const hostId = "player-host";
const guestId = "player-guest";

const createGrid = () => ({
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

const transitionToLobby = (): GameState => {
  const initial = createInitialState();
  const grid = createGrid();
  const afterCreate = reduceGameState(initial, {
    type: "game/createLobby",
    payload: {
      grid,
      host: { id: hostId, name: "Host", role: PlayerRole.Host },
    },
  });

  return reduceGameState(afterCreate, {
    type: "game/joinLobby",
    payload: { player: { id: guestId, name: "Guest", role: PlayerRole.Guest } },
  });
};

const transitionToPlaying = (): PlayingState => {
  const lobby = transitionToLobby();
  const withHostSecret = reduceGameState(lobby, {
    type: "game/setSecret",
    payload: { playerId: hostId, cardId: "card-a" },
  });
  const withGuestSecret = reduceGameState(withHostSecret, {
    type: "game/setSecret",
    payload: { playerId: guestId, cardId: "card-d" },
  });
  const started = reduceGameState(withGuestSecret, {
    type: "game/start",
    payload: { startingPlayerId: hostId },
  });
  if (started.status !== GameStatus.Playing) {
    throw new Error("Expected playing state");
  }
  return started;
};

describe("game sync", () => {
  it("applies actions once and deduplicates duplicates", () => {
    const journal = createGameJournal();
    const playing = transitionToPlaying();

    const action = {
      actionId: "action-1",
      action: {
        type: "turn/flipCard" as const,
        payload: { playerId: hostId, cardId: "card-b" },
      },
      issuerId: hostId,
      issuedAt: 1,
    };

    const first = applyAction(playing, action, journal);
    expect(first.applied).toBe(true);
    expect(first.entry?.actionId).toBe("action-1");
    const host = first.state.players.find((player) => player.id === hostId);
    expect(host?.flippedCardIds).toEqual(["card-b"]);
    expect(journal.size).toBe(1);

    const duplicate = applyAction(first.state, action, journal);
    expect(duplicate.applied).toBe(false);
    expect(duplicate.reason).toBe("duplicate");
    expect(duplicate.state).toBe(first.state);
    expect(journal.size).toBe(1);
  });

  it("replays outstanding actions after receiving a snapshot", () => {
    const journal = createGameJournal();
    const playing = transitionToPlaying();

    const flip = {
      actionId: "flip-1",
      action: {
        type: "turn/flipCard" as const,
        payload: { playerId: hostId, cardId: "card-b" },
      },
      issuerId: hostId,
      issuedAt: 1,
    };

    const endTurn = {
      actionId: "end-1",
      action: {
        type: "turn/end" as const,
        payload: { playerId: hostId },
      },
      issuerId: hostId,
      issuedAt: 2,
    };

    const afterFlip = applyAction(playing, flip, journal).state;
    const afterEnd = applyAction(afterFlip, endTurn, journal).state;

    const snapshot = {
      snapshotId: "snapshot-1",
      state: afterFlip,
      issuedAt: 10,
      lastActionId: "flip-1",
    } as const;

    const result = applySnapshot(snapshot, journal);
    expect(result.replayedActions.map((entry) => entry.actionId)).toEqual([
      "end-1",
    ]);
    expect(result.state).toEqual(afterEnd);
    expect(journal.size).toBe(1);
    expect(journal.lastKnownActionId).toBe("end-1");
  });

  it("drops unknown journal entries when the snapshot cannot align", () => {
    const journal = createGameJournal();
    const playing = transitionToPlaying();

    const flip = {
      actionId: "flip-2",
      action: {
        type: "turn/flipCard" as const,
        payload: { playerId: hostId, cardId: "card-b" },
      },
      issuerId: hostId,
      issuedAt: 1,
    };

    const afterFlip = applyAction(playing, flip, journal).state;

    const snapshot = {
      snapshotId: "snapshot-unknown",
      state: afterFlip,
      issuedAt: 20,
      lastActionId: "remote-action",
    } as const;

    const result = applySnapshot(snapshot, journal);
    expect(result.replayedActions).toHaveLength(0);
    expect(result.state).toEqual(afterFlip);
    expect(journal.size).toBe(0);
  });

  it("signals a resynchronisation error when outstanding actions cannot replay", () => {
    const journal = createGameJournal();
    const playing = transitionToPlaying();

    const flip = {
      actionId: "flip-3",
      action: {
        type: "turn/flipCard" as const,
        payload: { playerId: hostId, cardId: "card-b" },
      },
      issuerId: hostId,
      issuedAt: 1,
    };

    applyAction(playing, flip, journal);

    const snapshot = {
      snapshotId: "snapshot-reset",
      state: createInitialState(),
      issuedAt: 30,
      lastActionId: null,
    } as const;

    expect(() => applySnapshot(snapshot, journal)).toThrow(GameSyncError);
    expect(journal.size).toBe(0);
  });
});
