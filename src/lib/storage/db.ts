import {
  type DBSchema,
  type IDBPDatabase,
  type IDBPTransaction,
  openDB,
} from "idb";

import type { GameState, Grid } from "@/lib/game/types";

/**
 * Centralised IndexedDB access layer used to persist editor drafts and local
 * game sessions. The store is intentionally simple and strongly typed to avoid
 * schema drift across migrations.
 */

const DATABASE_NAME = "cki";
const DATABASE_VERSION = 1;

const GRID_DRAFT_KEY = "grid:draft:latest";

const STORE_GRID_DRAFTS = "gridDrafts";
const STORE_IMAGE_ASSETS = "imageAssets";
const STORE_PARTY_SESSIONS = "partySessions";

/**
 * Structured metadata associated with an optimised image stored locally.
 */
export interface ImageAssetDraft {
  cardId: string;
  source: "upload" | "url";
  mimeType: string;
  processedBytes: number;
  originalBytes: number;
  width?: number;
  height?: number;
  originalFileName?: string;
  originalUrl?: string;
  createdAt: number;
}

export interface ImageAssetRecord extends ImageAssetDraft {
  id: string;
  gridId: string;
  dataUrl: string;
  updatedAt: number;
}

/**
 * Share link state persisted alongside the editor draft so that the UI can be
 * restored faithfully after a refresh.
 */
export interface StoredShareState {
  token: string;
  url: string;
}

interface GridDraftRecord {
  id: string;
  grid: Grid;
  shareState: StoredShareState | null;
  lastSharedSignature: string | null;
  assets: Record<string, ImageAssetDraft>;
  updatedAt: number;
}

export interface PartySessionSnapshot {
  id: string;
  state: GameState;
}

export interface PartySessionRecord extends PartySessionSnapshot {
  updatedAt: number;
}

interface CkiDatabaseSchema extends DBSchema {
  [STORE_GRID_DRAFTS]: {
    key: string;
    value: GridDraftRecord;
  };
  [STORE_IMAGE_ASSETS]: {
    key: string;
    value: ImageAssetRecord;
    indexes: {
      "by-grid": string;
      "by-card": string;
    };
  };
  [STORE_PARTY_SESSIONS]: {
    key: string;
    value: PartySessionRecord;
    indexes: {
      "by-updated": number;
    };
  };
}

let databasePromise: Promise<IDBPDatabase<CkiDatabaseSchema>> | null = null;

const openDatabase = async (): Promise<IDBPDatabase<CkiDatabaseSchema>> => {
  if (databasePromise) {
    return databasePromise;
  }

  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB n’est pas disponible dans cet environnement.");
  }

  databasePromise = openDB<CkiDatabaseSchema>(DATABASE_NAME, DATABASE_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_GRID_DRAFTS)) {
        db.createObjectStore(STORE_GRID_DRAFTS, { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains(STORE_IMAGE_ASSETS)) {
        const store = db.createObjectStore(STORE_IMAGE_ASSETS, {
          keyPath: "id",
        });
        store.createIndex("by-grid", "gridId");
        store.createIndex("by-card", "cardId");
      }

      if (!db.objectStoreNames.contains(STORE_PARTY_SESSIONS)) {
        const store = db.createObjectStore(STORE_PARTY_SESSIONS, {
          keyPath: "id",
        });
        store.createIndex("by-updated", "updatedAt");
      }
    },
  });

  return databasePromise;
};

const createImageAssetId = (gridId: string, cardId: string): string =>
  `${gridId}::${cardId}`;

const estimateBase64Bytes = (dataUrl: string): number => {
  const [, base64 = ""] = dataUrl.split(",");
  if (!base64) {
    return 0;
  }
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, (base64.length * 3) / 4 - padding);
};

const extractMimeType = (dataUrl: string): string => {
  const match = /^data:([^;]+);/i.exec(dataUrl);
  return match?.[1] ?? "image/png";
};

const deleteAssetsForGrid = async (
  database: IDBPDatabase<CkiDatabaseSchema>,
  gridId: string,
) => {
  const transaction = database.transaction(STORE_IMAGE_ASSETS, "readwrite");
  const store = transaction.store;
  const index = store.index("by-grid");
  let cursor = await index.openKeyCursor(gridId);

  while (cursor) {
    const primaryKey = cursor.primaryKey;
    if (typeof primaryKey === "string") {
      await store.delete(primaryKey);
    }
    cursor = await cursor.continue();
  }

  await transaction.done;
};

const putAssetRecords = async (
  transaction: IDBPTransaction<
    CkiDatabaseSchema,
    [typeof STORE_GRID_DRAFTS, typeof STORE_IMAGE_ASSETS],
    "readwrite"
  >,
  grid: Grid,
  assets: Record<string, ImageAssetDraft>,
) => {
  const assetStore = transaction.objectStore(STORE_IMAGE_ASSETS);
  const now = Date.now();
  const activeAssetIds = new Set<string>();

  for (const card of grid.cards) {
    if (!card.imageUrl) {
      continue;
    }
    if (!card.imageUrl.startsWith("data:")) {
      continue;
    }

    const metadata = assets[card.id];
    const assetId = createImageAssetId(grid.id, card.id);
    activeAssetIds.add(assetId);

    const record: ImageAssetRecord = {
      id: assetId,
      gridId: grid.id,
      cardId: card.id,
      dataUrl: card.imageUrl,
      mimeType: metadata?.mimeType ?? extractMimeType(card.imageUrl),
      processedBytes:
        metadata?.processedBytes ?? estimateBase64Bytes(card.imageUrl),
      originalBytes: metadata?.originalBytes ?? metadata?.processedBytes ?? 0,
      width: metadata?.width,
      height: metadata?.height,
      originalFileName: metadata?.originalFileName,
      originalUrl: metadata?.originalUrl,
      source: metadata?.source ?? "upload",
      createdAt: metadata?.createdAt ?? now,
      updatedAt: now,
    };

    await assetStore.put(record);
  }

  const index = assetStore.index("by-grid");
  let cursor = await index.openKeyCursor(grid.id);
  while (cursor) {
    const primaryKey = cursor.primaryKey;
    if (typeof primaryKey === "string" && !activeAssetIds.has(primaryKey)) {
      await assetStore.delete(primaryKey);
    }
    cursor = await cursor.continue();
  }
};

export interface GridDraftSnapshot {
  grid: Grid;
  shareState: StoredShareState | null;
  lastSharedSignature: string | null;
  assets: Record<string, ImageAssetDraft>;
}

export interface PersistedGridDraft extends GridDraftSnapshot {
  updatedAt: number;
}

/**
 * Retrieve the last saved grid editor draft if it exists.
 */
export const loadGridDraft = async (): Promise<PersistedGridDraft | null> => {
  try {
    const database = await openDatabase();
    const record = await database
      .transaction(STORE_GRID_DRAFTS)
      .store.get(GRID_DRAFT_KEY);
    if (!record) {
      return null;
    }
    return {
      grid: record.grid,
      shareState: record.shareState,
      lastSharedSignature: record.lastSharedSignature,
      assets: record.assets ?? {},
      updatedAt: record.updatedAt,
    };
  } catch (error) {
    console.error("Échec du chargement du brouillon de grille.", error);
    return null;
  }
};

/**
 * Persist the current grid draft as well as any processed image assets.
 */
export const saveGridDraft = async (
  draft: GridDraftSnapshot,
): Promise<void> => {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(
      [STORE_GRID_DRAFTS, STORE_IMAGE_ASSETS],
      "readwrite",
    );

    const gridStore = transaction.objectStore(STORE_GRID_DRAFTS);
    const previousRecord = await gridStore.get(GRID_DRAFT_KEY);

    const now = Date.now();
    const filteredAssets: Record<string, ImageAssetDraft> = {};
    for (const card of draft.grid.cards) {
      const metadata = draft.assets[card.id];
      if (metadata) {
        filteredAssets[card.id] = metadata;
      }
    }

    const record: GridDraftRecord = {
      id: GRID_DRAFT_KEY,
      grid: draft.grid,
      shareState: draft.shareState,
      lastSharedSignature: draft.lastSharedSignature,
      assets: filteredAssets,
      updatedAt: now,
    };

    await gridStore.put(record);
    await putAssetRecords(transaction, draft.grid, filteredAssets);
    await transaction.done;

    if (previousRecord && previousRecord.grid.id !== draft.grid.id) {
      await deleteAssetsForGrid(database, previousRecord.grid.id);
    }
  } catch (error) {
    console.error("Échec de l’enregistrement du brouillon de grille.", error);
  }
};

/**
 * Remove the persisted grid draft and any associated assets.
 */
export const clearGridDraft = async (): Promise<void> => {
  try {
    const database = await openDatabase();
    const record = await database
      .transaction(STORE_GRID_DRAFTS)
      .store.get(GRID_DRAFT_KEY);
    const transaction = database.transaction(
      [STORE_GRID_DRAFTS, STORE_IMAGE_ASSETS],
      "readwrite",
    );
    await transaction.objectStore(STORE_GRID_DRAFTS).delete(GRID_DRAFT_KEY);
    await transaction.done;
    if (record) {
      await deleteAssetsForGrid(database, record.grid.id);
    }
  } catch (error) {
    console.error("Impossible de supprimer le brouillon enregistré.", error);
  }
};

/**
 * Retrieve all stored assets for the provided grid identifier.
 */
export const loadImageAssetsForGrid = async (
  gridId: string,
): Promise<ImageAssetRecord[]> => {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(STORE_IMAGE_ASSETS);
    const index = transaction.store.index("by-grid");
    return await index.getAll(gridId);
  } catch (error) {
    console.error("Échec du chargement des images locales.", error);
    return [];
  }
};

/**
 * Persist a full party session state so that a host can resume after a
 * disconnection or refresh.
 */
export const savePartySession = async (
  session: PartySessionSnapshot,
): Promise<void> => {
  try {
    const database = await openDatabase();
    await database.transaction(STORE_PARTY_SESSIONS, "readwrite").store.put({
      ...session,
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.error("Échec de l’enregistrement de la session de partie.", error);
  }
};

/**
 * Retrieve a previously stored party session.
 */
export const loadPartySession = async (
  sessionId: string,
): Promise<PartySessionRecord | null> => {
  try {
    const database = await openDatabase();
    const record = await database
      .transaction(STORE_PARTY_SESSIONS)
      .store.get(sessionId);
    return record ?? null;
  } catch (error) {
    console.error(
      "Impossible de charger la session de partie demandée.",
      error,
    );
    return null;
  }
};

/**
 * Remove a stored party session and free up the associated storage.
 */
export const deletePartySession = async (sessionId: string): Promise<void> => {
  try {
    const database = await openDatabase();
    await database
      .transaction(STORE_PARTY_SESSIONS, "readwrite")
      .store.delete(sessionId);
  } catch (error) {
    console.error("Impossible de supprimer la session de partie.", error);
  }
};

/**
 * List stored party sessions ordered by last update descending.
 */
export const listPartySessions = async (): Promise<PartySessionRecord[]> => {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(STORE_PARTY_SESSIONS);
    const index = transaction.store.index("by-updated");
    const sessions: PartySessionRecord[] = [];
    let cursor = await index.openCursor(null, "prev");
    while (cursor) {
      sessions.push(cursor.value);
      cursor = await cursor.continue();
    }
    return sessions;
  } catch (error) {
    console.error("Échec de la récupération des sessions enregistrées.", error);
    return [];
  }
};
