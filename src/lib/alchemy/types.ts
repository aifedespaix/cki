export type ShalgemonRarity = "Commun" | "Rare" | "Épique" | "Mythique";

export interface Shalgemon {
  id: string;
  name: string;
  element: string;
  chromaticAffinity: string[];
  odorNotes: string[];
  signatureSkill: string;
  temperament: string;
  rarity: ShalgemonRarity;
  stabilityIndex: number;
}

export type ShalgemonSortKey =
  | "name"
  | "element"
  | "rarity"
  | "stability"
  | "chromatic"
  | "odor";

export type SortDirection = "asc" | "desc";

export interface SortState {
  key: ShalgemonSortKey;
  direction: SortDirection;
}
