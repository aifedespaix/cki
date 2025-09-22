import { describe, expect, it } from "bun:test";

import {
  canStartGame,
  createInitialState,
  InvalidGameActionError,
  isPlayerReady,
  reduceGameState,
  selectActivePlayer,
  selectPlayerById,
  selectWinner,
} from "./state";
import {
  type Action,
  GameConclusionReason,
  type GameState,
  GameStatus,
  type Grid,
  PlayerRole,
  type PlayingState,
} from "./types";

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

const hostId = "player-host";
const guestId = "player-guest";

const createLobbyState = (): GameState => {
  const initial = createInitialState();
  const afterCreate = reduceGameState(initial, {
    type: "game/createLobby",
    payload: {
      grid: createGrid(),
      host: { id: hostId, name: "Host", role: PlayerRole.Host },
    },
  });

  return reduceGameState(afterCreate, {
    type: "game/joinLobby",
    payload: {
      player: { id: guestId, name: "Guest", role: PlayerRole.Guest },
    },
  });
};

const asPlayingState = (state: GameState): PlayingState => {
  if (state.status !== GameStatus.Playing) {
    throw new Error("Expected playing state");
  }
  return state;
};

const createPlayingState = (): PlayingState => {
  const lobby = createLobbyState();
  const withHostSecret = reduceGameState(lobby, {
    type: "game/setSecret",
    payload: { playerId: hostId, cardId: "card-a" },
  });
  const withGuestSecret = reduceGameState(withHostSecret, {
    type: "game/setSecret",
    payload: { playerId: guestId, cardId: "card-d" },
  });
  expect(canStartGame(withGuestSecret)).toBe(true);
  const started = reduceGameState(withGuestSecret, {
    type: "game/start",
    payload: { startingPlayerId: hostId },
  });
  return asPlayingState(started);
};

describe("reduceGameState", () => {
  it("creates a lobby from the idle state", () => {
    const initial = createInitialState();
    const lobby = reduceGameState(initial, {
      type: "game/createLobby",
      payload: { grid: createGrid(), host: { id: hostId, name: "Host" } },
    });

    expect(lobby.status).toBe(GameStatus.Lobby);
    expect(lobby.players).toHaveLength(1);
    expect(lobby.players[0]).toMatchObject({
      id: hostId,
      role: PlayerRole.Host,
    });
  });

  it("prevents joining a lobby more than once per player", () => {
    const lobby = createLobbyState();
    expect(() =>
      reduceGameState(lobby, {
        type: "game/joinLobby",
        payload: { player: { id: guestId, name: "Guest Again" } },
      }),
    ).toThrow(InvalidGameActionError);
  });

  it("rejects identical join lobby payloads applied twice", () => {
    const lobby = reduceGameState(createInitialState(), {
      type: "game/createLobby",
      payload: {
        grid: createGrid(),
        host: { id: hostId, name: "Host", role: PlayerRole.Host },
      },
    });
    const joinAction = {
      type: "game/joinLobby" as const,
      payload: {
        player: { id: guestId, name: "Guest", role: PlayerRole.Guest },
      },
    } satisfies Extract<Action, { type: "game/joinLobby" }>;

    const withGuest = reduceGameState(lobby, joinAction);

    expect(() => reduceGameState(withGuest, joinAction)).toThrow(
      InvalidGameActionError,
    );
  });

  it("rejects more than two players in a lobby", () => {
    const lobby = createLobbyState();
    expect(() =>
      reduceGameState(lobby, {
        type: "game/joinLobby",
        payload: { player: { id: "third", name: "Third Player" } },
      }),
    ).toThrow(InvalidGameActionError);
  });

  it("enforces secret selection before starting the game", () => {
    const lobby = createLobbyState();
    const withHostSecret = reduceGameState(lobby, {
      type: "game/setSecret",
      payload: { playerId: hostId, cardId: "card-a" },
    });

    expect(() =>
      reduceGameState(withHostSecret, {
        type: "game/start",
        payload: { startingPlayerId: hostId },
      }),
    ).toThrow(InvalidGameActionError);
  });

  it("allows updating a secret and remains idempotent when unchanged", () => {
    const lobby = createLobbyState();
    const updated = reduceGameState(lobby, {
      type: "game/setSecret",
      payload: { playerId: hostId, cardId: "card-a" },
    });
    const same = reduceGameState(updated, {
      type: "game/setSecret",
      payload: { playerId: hostId, cardId: "card-a" },
    });

    expect(same).toBe(updated);
    expect(isPlayerReady(updated, hostId)).toBe(true);
  });

  it("rejects selecting a secret that is not part of the grid", () => {
    const lobby = createLobbyState();
    expect(() =>
      reduceGameState(lobby, {
        type: "game/setSecret",
        payload: { playerId: hostId, cardId: "unknown" },
      }),
    ).toThrow(InvalidGameActionError);
  });

  it("starts the game once both players are ready", () => {
    const playing = createPlayingState();

    expect(playing.status).toBe(GameStatus.Playing);
    expect(playing.activePlayerId).toBe(hostId);
    expect(playing.turn).toBe(1);
    expect(selectActivePlayer(playing)?.id).toBe(hostId);
  });

  it("prevents flipping cards when not the active player", () => {
    const playing = createPlayingState();

    expect(() =>
      reduceGameState(playing, {
        type: "turn/flipCard",
        payload: { playerId: guestId, cardId: "card-b" },
      }),
    ).toThrow(InvalidGameActionError);
  });

  it("allows toggling the secret card on the player board", () => {
    const playing = createPlayingState();
    const action = {
      type: "turn/flipCard" as const,
      payload: { playerId: hostId, cardId: "card-a" },
    };

    const afterFirstFlip = reduceGameState(playing, action);
    expect(selectActivePlayer(afterFirstFlip)?.flippedCardIds).toEqual([
      "card-a",
    ]);

    const afterSecondFlip = reduceGameState(afterFirstFlip, action);
    expect(selectActivePlayer(afterSecondFlip)?.flippedCardIds).toEqual([]);
  });

  it("allows toggling cards on repeated flips", () => {
    const playing = createPlayingState();
    const action = {
      type: "turn/flipCard" as const,
      payload: { playerId: hostId, cardId: "card-b" },
    };

    const afterFirstFlip = reduceGameState(playing, action);
    expect(selectActivePlayer(afterFirstFlip)?.flippedCardIds).toEqual([
      "card-b",
    ]);

    const afterSecondFlip = reduceGameState(afterFirstFlip, action);
    expect(selectActivePlayer(afterSecondFlip)?.flippedCardIds).toEqual([]);

    const afterThirdFlip = reduceGameState(afterSecondFlip, action);
    expect(selectActivePlayer(afterThirdFlip)?.flippedCardIds).toEqual([
      "card-b",
    ]);
  });

  it("changes the active player when ending a turn", () => {
    const playing = createPlayingState();
    const afterEndTurn = reduceGameState(playing, {
      type: "turn/end",
      payload: { playerId: hostId },
    });

    expect(afterEndTurn.status).toBe(GameStatus.Playing);
    expect(asPlayingState(afterEndTurn).activePlayerId).toBe(guestId);
    expect(asPlayingState(afterEndTurn).turn).toBe(2);
  });

  it("does not allow ending the turn out of turn order", () => {
    const playing = createPlayingState();

    expect(() =>
      reduceGameState(playing, {
        type: "turn/end",
        payload: { playerId: guestId },
      }),
    ).toThrow(InvalidGameActionError);
  });

  it("wins the match on a correct guess", () => {
    const playing = createPlayingState();
    const finished = reduceGameState(playing, {
      type: "turn/guess",
      payload: { playerId: hostId, targetPlayerId: guestId, cardId: "card-d" },
    });

    expect(finished.status).toBe(GameStatus.Finished);
    expect(finished.winnerId).toBe(hostId);
    expect(finished.reason).toBe(GameConclusionReason.CorrectGuess);
    expect(finished.finalGuess).toMatchObject({ correct: true });
    expect(selectWinner(finished)?.id).toBe(hostId);
  });

  it("declares the opponent as winner on an incorrect guess", () => {
    const playing = createPlayingState();
    const finished = reduceGameState(playing, {
      type: "turn/guess",
      payload: { playerId: hostId, targetPlayerId: guestId, cardId: "card-b" },
    });

    expect(finished.status).toBe(GameStatus.Finished);
    expect(finished.winnerId).toBe(guestId);
    expect(finished.reason).toBe(GameConclusionReason.IncorrectGuess);
    expect(finished.finalGuess).toMatchObject({
      correct: false,
      cardId: "card-b",
    });
  });

  it("prevents guessing outside of a turn", () => {
    const playing = createPlayingState();

    expect(() =>
      reduceGameState(playing, {
        type: "turn/guess",
        payload: {
          playerId: guestId,
          targetPlayerId: hostId,
          cardId: "card-a",
        },
      }),
    ).toThrow(InvalidGameActionError);
  });

  it("resets back to the idle state", () => {
    const playing = createPlayingState();
    const finished = reduceGameState(playing, {
      type: "turn/guess",
      payload: { playerId: hostId, targetPlayerId: guestId, cardId: "card-d" },
    });

    const reset = reduceGameState(finished, { type: "game/reset" });
    expect(reset.status).toBe(GameStatus.Idle);
    expect(reset.players).toEqual([]);
  });
});

describe("selectors", () => {
  it("returns players and readiness flags", () => {
    const lobby = createLobbyState();
    expect(selectPlayerById(lobby, hostId)?.role).toBe(PlayerRole.Host);
    expect(isPlayerReady(lobby, hostId)).toBe(false);

    const updated = reduceGameState(lobby, {
      type: "game/setSecret",
      payload: { playerId: hostId, cardId: "card-a" },
    });

    expect(isPlayerReady(updated, hostId)).toBe(true);
  });

  it("provides the active player only while playing", () => {
    const idle = createInitialState();
    expect(selectActivePlayer(idle)).toBeUndefined();

    const playing = createPlayingState();
    expect(selectActivePlayer(playing)?.id).toBe(hostId);
  });
});
