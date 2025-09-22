import { base, en, Faker } from "@faker-js/faker";

import type { Card } from "./types";

/** Supported genders for the random avatar generator. */
export type RandomAvatarGender = "male" | "female";

const AVATAR_BASE_URL = "https://xsgames.co/randomusers/assets/avatars";
const MIN_AVATAR_ID = 1;
const MAX_AVATAR_ID = 60;

const createSeededFaker = (seed: number): Faker => {
  const fakerInstance = new Faker({
    locale: [en, base],
  });
  fakerInstance.seed(seed);
  return fakerInstance;
};

const createDeterministicRng = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let result = Math.imul(state ^ (state >>> 15), state | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
};

const normaliseSeed = (seed: number): number => {
  if (!Number.isFinite(seed)) {
    return 1;
  }
  const normalised = Math.abs(Math.floor(seed)) >>> 0;
  return normalised === 0 ? 1 : normalised;
};

const pickAvatarId = (random: () => number): number => {
  const span = MAX_AVATAR_ID - MIN_AVATAR_ID + 1;
  return MIN_AVATAR_ID + Math.floor(random() * span);
};

const pickAvatarGender = (random: () => number): RandomAvatarGender =>
  random() < 0.5 ? "male" : "female";

const buildAvatarUrl = (gender: RandomAvatarGender, avatarId: number): string =>
  `${AVATAR_BASE_URL}/${gender}/${avatarId}.jpg`;

/**
 * Generates a cryptographically strong seed when available, falling back to a
 * Math.random-based value otherwise. The returned number is normalised to be
 * strictly positive because the deterministic generator does not accept 0.
 */
export const createRandomSeed = (): number => {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    const [value] = buffer;
    return normaliseSeed(value);
  }
  return normaliseSeed(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
};

export interface GenerateRandomCardsOptions {
  cards: ReadonlyArray<Card>;
  seed: number;
}

/**
 * Produces a new set of cards with randomised avatars and first names.
 *
 * The randomness is deterministic for a given seed: invoking the function
 * twice with the same arguments will yield identical results. Each card keeps
 * its original identifier so that downstream references remain stable.
 */
export const generateRandomCards = ({
  cards,
  seed,
}: GenerateRandomCardsOptions): Card[] => {
  if (cards.length === 0) {
    return [];
  }

  const normalisedSeed = normaliseSeed(seed);
  const fakerInstance = createSeededFaker(normalisedSeed);
  const random = createDeterministicRng(normalisedSeed);

  return cards.map((card) => {
    const gender = pickAvatarGender(random);
    const avatarId = pickAvatarId(random);
    const name = fakerInstance.person.firstName(gender);

    return {
      ...card,
      label: name,
      imageUrl: buildAvatarUrl(gender, avatarId),
      description: undefined,
    } satisfies Card;
  });
};
