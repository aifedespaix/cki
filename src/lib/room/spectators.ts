const spectatorCollator = new Intl.Collator("fr", {
  sensitivity: "base",
  usage: "sort",
});

/** Maximum number of characters allowed in a spectator display name. */
const MAX_SPECTATOR_NAME_LENGTH = 80;

/**
 * Minimal representation of a spectator used across the room UI and protocol.
 */
export interface SpectatorProfile {
  /** Identifier of the spectator, reused if they promote to player. */
  id: string;
  /** Human friendly display name surfaced in the UI. */
  name: string;
}

const trimSpectatorId = (candidate: string): string => candidate.trim();

const sliceName = (name: string): string => {
  if (name.length <= MAX_SPECTATOR_NAME_LENGTH) {
    return name;
  }
  return name.slice(0, MAX_SPECTATOR_NAME_LENGTH);
};

/**
 * Generates a stable fallback name derived from the spectator identifier.
 */
export const createDefaultSpectatorName = (spectatorId: string): string => {
  const trimmed = trimSpectatorId(spectatorId);
  if (!trimmed) {
    return "Spectateur";
  }
  const lastToken = trimmed.split("-").filter(Boolean).pop() ?? trimmed;
  const suffix = lastToken.slice(-6).toUpperCase();
  return suffix ? `Spectateur ${suffix}` : "Spectateur";
};

/**
 * Normalises the spectator name by trimming whitespace, enforcing a maximum
 * length and falling back to a deterministic placeholder when empty.
 */
export const normaliseSpectatorName = (
  rawName: string,
  spectatorId: string,
): string => {
  const trimmed = rawName.trim();
  if (trimmed.length === 0) {
    return createDefaultSpectatorName(spectatorId);
  }
  return sliceName(trimmed);
};

/**
 * Creates a new spectator profile with a predictable identifier and name.
 */
export const normaliseSpectatorProfile = (
  candidate: SpectatorProfile,
): SpectatorProfile => ({
  id: trimSpectatorId(candidate.id),
  name: normaliseSpectatorName(candidate.name, candidate.id),
});

const compareSpectators = (left: SpectatorProfile, right: SpectatorProfile) => {
  const nameComparison = spectatorCollator.compare(left.name, right.name);
  if (nameComparison !== 0) {
    return nameComparison;
  }
  return spectatorCollator.compare(left.id, right.id);
};

/**
 * Returns a sorted copy of the provided spectator list.
 */
export const sortSpectators = (
  spectators: readonly SpectatorProfile[],
): SpectatorProfile[] => [...spectators].sort(compareSpectators);

/**
 * Upserts a spectator into the list, ensuring normalisation and ordering.
 */
export const addOrUpdateSpectator = (
  spectators: readonly SpectatorProfile[],
  candidate: SpectatorProfile,
): SpectatorProfile[] => {
  const normalised = normaliseSpectatorProfile(candidate);
  const existingIndex = spectators.findIndex(
    (spectator) => spectator.id === normalised.id,
  );
  if (existingIndex === -1) {
    return sortSpectators([...spectators, normalised]);
  }
  const next = [...spectators];
  next[existingIndex] = normalised;
  return sortSpectators(next);
};

/**
 * Removes a spectator from the list by identifier.
 */
export const removeSpectatorById = (
  spectators: readonly SpectatorProfile[],
  spectatorId: string,
): SpectatorProfile[] =>
  spectators.filter((spectator) => spectator.id !== spectatorId);

/**
 * Normalises a roster received over the network before storing it locally.
 */
export const normaliseSpectatorRoster = (
  spectators: readonly SpectatorProfile[],
): SpectatorProfile[] => {
  const registry = new Map<string, SpectatorProfile>();
  spectators.forEach((entry) => {
    const normalised = normaliseSpectatorProfile(entry);
    registry.set(normalised.id, normalised);
  });
  return sortSpectators(Array.from(registry.values()));
};
