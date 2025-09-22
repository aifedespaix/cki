import type { Grid } from "@/lib/game/types";
import type { ImageAssetDraft } from "@/lib/storage/db";

const HOST_SESSION_PREFIX = "cki:host-session:";

const isBrowser = typeof window !== "undefined";

const createStorageKey = (roomId: string): string =>
  `${HOST_SESSION_PREFIX}${roomId}`;

export interface HostPreparationRecord {
  roomId: string;
  nickname: string;
  grid: Grid;
  assets: Record<string, ImageAssetDraft>;
  createdAt: number;
}

export const persistHostPreparation = (
  record: Omit<HostPreparationRecord, "createdAt">,
): void => {
  if (!isBrowser) {
    throw new Error(
      "Persisting a host session is only supported in the browser",
    );
  }

  const payload: HostPreparationRecord = {
    ...record,
    createdAt: Date.now(),
  };

  try {
    const key = createStorageKey(record.roomId);
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch (error) {
    console.error("Impossible d'enregistrer la préparation de partie.", error);
    throw error;
  }
};

export const loadHostPreparation = (
  roomId: string,
): HostPreparationRecord | null => {
  if (!isBrowser) {
    return null;
  }

  const key = createStorageKey(roomId);
  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as HostPreparationRecord;
    if (!parsed || parsed.roomId !== roomId) {
      return null;
    }
    return parsed;
  } catch (error) {
    console.error("Impossible de lire la préparation de partie.", error);
    return null;
  }
};

export const clearHostPreparation = (roomId: string): void => {
  if (!isBrowser) {
    return;
  }

  try {
    const key = createStorageKey(roomId);
    window.localStorage.removeItem(key);
  } catch (error) {
    console.error("Impossible de supprimer la préparation de partie.", error);
  }
};

const NICKNAME_KEY = "cki:nickname:last-used";

export const loadLatestNickname = (): string | null => {
  if (!isBrowser) {
    return null;
  }

  const nickname = window.localStorage.getItem(NICKNAME_KEY);
  return nickname ? nickname : null;
};

export const persistLatestNickname = (nickname: string): void => {
  if (!isBrowser) {
    return;
  }

  try {
    const trimmed = nickname.trim();
    if (trimmed) {
      window.localStorage.setItem(NICKNAME_KEY, trimmed);
    } else {
      window.localStorage.removeItem(NICKNAME_KEY);
    }
  } catch (error) {
    console.error("Impossible d'enregistrer le pseudo localement.", error);
  }
};
