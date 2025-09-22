import type { Grid } from "@/lib/game/types";
import type { ImageAssetDraft } from "@/lib/storage/db";
import { createRandomId } from "@/lib/utils";

const HOST_SESSION_PREFIX = "cki:host-session:";

const isBrowser = typeof window !== "undefined";

const createStorageKey = (roomId: string): string =>
  `${HOST_SESSION_PREFIX}${roomId}`;

export interface HostPreparationRecord {
  roomId: string;
  nickname: string;
  hostId: string;
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
    const parsed = JSON.parse(raw) as Partial<HostPreparationRecord> | null;
    if (
      !parsed ||
      parsed.roomId !== roomId ||
      typeof parsed.nickname !== "string" ||
      !parsed.grid
    ) {
      return null;
    }
    const normalised: HostPreparationRecord = {
      roomId: parsed.roomId,
      nickname: parsed.nickname,
      hostId:
        typeof parsed.hostId === "string" && parsed.hostId
          ? parsed.hostId
          : createRandomId("player"),
      grid: parsed.grid as Grid,
      assets: parsed.assets ?? {},
      createdAt:
        typeof parsed.createdAt === "number" &&
        Number.isFinite(parsed.createdAt)
          ? parsed.createdAt
          : Date.now(),
    };

    if (!parsed.hostId) {
      try {
        const key = createStorageKey(roomId);
        window.localStorage.setItem(key, JSON.stringify(normalised));
      } catch (writeError) {
        console.warn(
          "Impossible de normaliser les données de préparation de salle.",
          writeError,
        );
      }
    }

    return normalised;
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

const GUEST_SESSION_PREFIX = "cki:guest-session:";

const createGuestStorageKey = (roomId: string): string =>
  `${GUEST_SESSION_PREFIX}${roomId}`;

export interface GuestSessionRecord {
  roomId: string;
  guestId: string;
  nickname: string | null;
  viewAsSpectator: boolean;
  roleSelectionCompleted: boolean;
  createdAt: number;
  updatedAt: number;
}

interface GuestSessionPayload {
  roomId: string;
  guestId: string;
  nickname: string | null;
  viewAsSpectator: boolean;
  roleSelectionCompleted: boolean;
}

export const persistGuestSession = (payload: GuestSessionPayload): void => {
  if (!isBrowser) {
    return;
  }

  const key = createGuestStorageKey(payload.roomId);
  const now = Date.now();
  let createdAt = now;

  try {
    const existing = window.localStorage.getItem(key);
    if (existing) {
      const parsed = JSON.parse(existing) as Partial<GuestSessionRecord> | null;
      if (
        parsed &&
        typeof parsed.createdAt === "number" &&
        Number.isFinite(parsed.createdAt)
      ) {
        createdAt = parsed.createdAt;
      }
    }
  } catch (error) {
    console.warn(
      "Impossible de lire la session joueur existante avant mise à jour.",
      error,
    );
  }

  const trimmedNickname =
    typeof payload.nickname === "string" ? payload.nickname.trim() : "";

  const record: GuestSessionRecord = {
    roomId: payload.roomId,
    guestId: payload.guestId,
    nickname: trimmedNickname ? trimmedNickname : null,
    viewAsSpectator: Boolean(payload.viewAsSpectator),
    roleSelectionCompleted: Boolean(payload.roleSelectionCompleted),
    createdAt,
    updatedAt: now,
  };

  try {
    window.localStorage.setItem(key, JSON.stringify(record));
  } catch (error) {
    console.error("Impossible d'enregistrer la session joueur.", error);
  }
};

export const loadGuestSession = (roomId: string): GuestSessionRecord | null => {
  if (!isBrowser) {
    return null;
  }

  const key = createGuestStorageKey(roomId);
  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<GuestSessionRecord> | null;
    if (!parsed) {
      return null;
    }

    const guestId =
      typeof parsed.guestId === "string" && parsed.guestId.trim()
        ? parsed.guestId.trim()
        : null;
    if (!guestId) {
      return null;
    }

    const nickname =
      typeof parsed.nickname === "string" && parsed.nickname.trim()
        ? parsed.nickname.trim()
        : null;

    const viewAsSpectator = Boolean(parsed.viewAsSpectator);
    const roleSelectionCompleted = Boolean(parsed.roleSelectionCompleted);

    const createdAt =
      typeof parsed.createdAt === "number" && Number.isFinite(parsed.createdAt)
        ? parsed.createdAt
        : Date.now();
    const updatedAt =
      typeof parsed.updatedAt === "number" && Number.isFinite(parsed.updatedAt)
        ? parsed.updatedAt
        : createdAt;

    return {
      roomId,
      guestId,
      nickname,
      viewAsSpectator,
      roleSelectionCompleted,
      createdAt,
      updatedAt,
    } satisfies GuestSessionRecord;
  } catch (error) {
    console.error("Impossible de lire la session joueur locale.", error);
    return null;
  }
};

export const clearGuestSession = (roomId: string): void => {
  if (!isBrowser) {
    return;
  }

  try {
    const key = createGuestStorageKey(roomId);
    window.localStorage.removeItem(key);
  } catch (error) {
    console.error("Impossible de supprimer la session joueur.", error);
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
