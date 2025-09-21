import { gameStateSchema, synchronisedActionSchema } from "./schema";
import { reduceGameState } from "./state";
import type {
  GameActionPayload,
  GameSnapshotPayload,
  GameState,
} from "./types";

const clone = <T>(value: T): T => {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
};

const areJournalEntriesEqual = (
  left: GameJournalEntry,
  right: GameJournalEntry,
): boolean =>
  left.actionId === right.actionId &&
  left.issuerId === right.issuerId &&
  left.issuedAt === right.issuedAt &&
  JSON.stringify(left.action) === JSON.stringify(right.action);

const isSynchronisedActionPayload = (
  value: GameActionPayload["action"],
): boolean => {
  const result = synchronisedActionSchema.safeParse(value);
  return result.success;
};

/**
 * Error thrown whenever synchronisation between peers fails.
 */
export class GameSyncError extends Error {
  public readonly cause?: unknown;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "GameSyncError";
    this.cause = options?.cause;
  }
}

/**
 * Action entry stored in the journal to support replays after resynchronisation.
 */
export type GameJournalEntry = GameActionPayload;

/**
 * Minimal snapshot metadata stored in the journal for bookkeeping purposes.
 */
export type GameJournalSnapshot = Pick<
  GameSnapshotPayload,
  "snapshotId" | "issuedAt" | "lastActionId"
>;

/**
 * Configuration options for the in-memory journal implementation.
 */
export interface GameJournalOptions {
  processedRetentionLimit?: number;
}

/**
 * Persistent log used to replay actions on top of a known-good snapshot.
 */
export interface GameJournal {
  readonly snapshot: GameJournalSnapshot | null;
  readonly lastKnownActionId: string | null;
  readonly size: number;
  hasProcessed(actionId: string): boolean;
  get(actionId: string): GameJournalEntry | undefined;
  append(entry: GameJournalEntry): void;
  remove(actionId: string): void;
  reconcileWithSnapshot(
    snapshot: GameJournalSnapshot,
  ): readonly GameJournalEntry[];
  getOutstandingActions(): readonly GameJournalEntry[];
  clear(): void;
}

class InMemoryGameJournal implements GameJournal {
  private readonly entries = new Map<string, GameJournalEntry>();
  private orderedIds: string[] = [];
  private readonly processedIds = new Set<string>();
  private processedOrder: string[] = [];
  private readonly retentionLimit: number;
  private _snapshot: GameJournalSnapshot | null = null;
  private _lastKnownActionId: string | null = null;

  constructor(options?: GameJournalOptions) {
    this.retentionLimit = Math.max(1, options?.processedRetentionLimit ?? 512);
  }

  public get snapshot(): GameJournalSnapshot | null {
    return this._snapshot ? { ...this._snapshot } : null;
  }

  public get lastKnownActionId(): string | null {
    return this._lastKnownActionId;
  }

  public get size(): number {
    return this.entries.size;
  }

  public hasProcessed(actionId: string): boolean {
    return this.processedIds.has(actionId) || this.entries.has(actionId);
  }

  public get(actionId: string): GameJournalEntry | undefined {
    const entry = this.entries.get(actionId);
    return entry ? clone(entry) : undefined;
  }

  public append(entry: GameJournalEntry): void {
    const existing = this.entries.get(entry.actionId);
    if (existing) {
      if (!areJournalEntriesEqual(existing, entry)) {
        throw new GameSyncError(
          `Conflicting payload for action "${entry.actionId}" detected in journal.`,
        );
      }
      return;
    }
    if (this.processedIds.has(entry.actionId)) {
      return;
    }
    if (!isSynchronisedActionPayload(entry.action)) {
      throw new GameSyncError(
        `Action "${entry.actionId}" with type "${entry.action.type}" is not synchronisable.`,
      );
    }
    const stored = clone(entry);
    this.entries.set(entry.actionId, stored);
    const index = this.findInsertionIndex(stored);
    this.orderedIds.splice(index, 0, entry.actionId);
    this.markProcessed(entry.actionId);
    this._lastKnownActionId = entry.actionId;
  }

  public remove(actionId: string): void {
    if (!this.entries.delete(actionId)) {
      return;
    }
    const index = this.orderedIds.indexOf(actionId);
    if (index !== -1) {
      this.orderedIds.splice(index, 1);
    }
  }

  public reconcileWithSnapshot(
    snapshot: GameJournalSnapshot,
  ): readonly GameJournalEntry[] {
    this._snapshot = { ...snapshot };
    const { lastActionId } = snapshot;
    if (lastActionId !== null) {
      this.markProcessed(lastActionId);
      const index = this.orderedIds.indexOf(lastActionId);
      if (index === -1) {
        this.entries.clear();
        this.orderedIds = [];
      } else {
        const appliedIds = this.orderedIds.slice(0, index + 1);
        for (const id of appliedIds) {
          this.entries.delete(id);
        }
        this.orderedIds = this.orderedIds.slice(index + 1);
      }
    }
    this._lastKnownActionId =
      this.orderedIds.length > 0
        ? this.orderedIds[this.orderedIds.length - 1]
        : snapshot.lastActionId;
    return this.getOutstandingActions();
  }

  public getOutstandingActions(): readonly GameJournalEntry[] {
    return this.orderedIds.map((id) => {
      const entry = this.entries.get(id);
      if (!entry) {
        throw new GameSyncError(
          `Journal is inconsistent: action "${id}" is missing from storage.`,
        );
      }
      return clone(entry);
    });
  }

  public clear(): void {
    this.entries.clear();
    this.orderedIds = [];
    this.processedIds.clear();
    this.processedOrder = [];
    this._snapshot = null;
    this._lastKnownActionId = null;
  }

  private markProcessed(actionId: string): void {
    if (this.processedIds.has(actionId)) {
      return;
    }
    this.processedIds.add(actionId);
    this.processedOrder.push(actionId);
    this.trimProcessedRetention();
  }

  private trimProcessedRetention(): void {
    if (this.processedOrder.length <= this.retentionLimit) {
      return;
    }
    const seen = new Set<string>();
    while (this.processedOrder.length > this.retentionLimit) {
      const candidate = this.processedOrder.shift();
      if (!candidate) {
        break;
      }
      if (this.entries.has(candidate)) {
        if (seen.has(candidate)) {
          this.processedOrder.push(candidate);
          break;
        }
        this.processedOrder.push(candidate);
        seen.add(candidate);
        continue;
      }
      this.processedIds.delete(candidate);
    }
  }

  private findInsertionIndex(entry: GameJournalEntry): number {
    for (let index = 0; index < this.orderedIds.length; index += 1) {
      const candidate = this.entries.get(this.orderedIds[index]);
      if (!candidate) {
        continue;
      }
      if (entry.issuedAt < candidate.issuedAt) {
        return index;
      }
      if (
        entry.issuedAt === candidate.issuedAt &&
        entry.actionId.localeCompare(candidate.actionId) < 0
      ) {
        return index;
      }
    }
    return this.orderedIds.length;
  }
}

export const createGameJournal = (options?: GameJournalOptions): GameJournal =>
  new InMemoryGameJournal(options);

/**
 * Outcome returned when applying a network action to the local state.
 */
export interface ApplyActionResult {
  state: GameState;
  applied: boolean;
  reason?: "duplicate";
  entry?: GameJournalEntry;
}

/**
 * Applies a synchronised action to the provided state while keeping the journal
 * up to date. Duplicate actions are ignored but do not throw.
 */
export const applyAction = (
  state: GameState,
  payload: GameActionPayload,
  journal: GameJournal,
): ApplyActionResult => {
  if (journal.hasProcessed(payload.actionId)) {
    return { state, applied: false, reason: "duplicate" };
  }

  const parsedAction = synchronisedActionSchema.parse(payload.action);

  let nextState: GameState;
  try {
    nextState = reduceGameState(state, parsedAction);
  } catch (error) {
    throw new GameSyncError(
      `Failed to apply action "${payload.actionId}" (${payload.action.type}).`,
      { cause: error instanceof Error ? error : undefined },
    );
  }

  const entry = clone({ ...payload, action: parsedAction });
  journal.append(entry);

  return { state: nextState, applied: true, entry };
};

export interface ApplySnapshotResult {
  state: GameState;
  replayedActions: readonly GameJournalEntry[];
}

/**
 * Replaces the local state with the snapshot payload and replays any
 * outstanding actions recorded in the journal.
 */
export const applySnapshot = (
  snapshot: GameSnapshotPayload,
  journal: GameJournal,
): ApplySnapshotResult => {
  const state = gameStateSchema.parse(snapshot.state);
  const outstanding = journal.reconcileWithSnapshot({
    snapshotId: snapshot.snapshotId,
    issuedAt: snapshot.issuedAt,
    lastActionId: snapshot.lastActionId,
  });

  let nextState = state;
  const replayed: GameJournalEntry[] = [];

  for (const entry of outstanding) {
    try {
      nextState = reduceGameState(nextState, entry.action);
      replayed.push(entry);
    } catch (error) {
      journal.remove(entry.actionId);
      throw new GameSyncError(
        `Failed to replay action "${entry.actionId}" while applying snapshot "${snapshot.snapshotId}".`,
        { cause: error instanceof Error ? error : undefined },
      );
    }
  }

  return { state: nextState, replayedActions: replayed };
};
