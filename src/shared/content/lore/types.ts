/** Lore text types — local to shared/content/lore. Pure data contracts for
 * in-game writing: notes, NPC barks, strata text, item naming, village
 * secrets. See docs/LORE.md for the world these describe. */

/** 0..9 = stratum index (0 = Undercroft … 9 = Threshold); -1 = Kneel. */
export type StratumIndex = -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** A readable found in the dungeon or the village. 40–160 words. */
export interface LoreNote {
  id: string;
  stratum: StratumIndex;
  title: string;
  author?: string;
  text: string;
}

/** Barks for a village NPC. Every line ≤ 140 characters. */
export interface NpcText {
  name: string;
  title: string;
  /** Shop id if the NPC keeps a shop. */
  shop?: "apothecary" | "artificer" | "wagers" | "tailor" | "quartermaster" | "chandlery";
  greeting: string[];
  idle: string[];
  /** After the delver returns alive from a run. */
  onReturn: string[];
  /** After the delver's last run ended in death. */
  onDeath: string[];
  /** Reactions keyed by the delver's deepest floor (use the highest match). */
  depthLines: { minFloor: number; lines: string[] }[];
  /** Nudges toward village secrets (see village.ts SECRETS). */
  secretHints: string[];
}

export interface StratumText {
  index: number;
  name: string;
  epithet: string;
  /** The rim-village that went down here (docs/LORE.md §1.1). */
  village: string;
  /** The Dreamed Question (never show as a heading; for writers/fx). */
  question: string;
  /** Short lines shown on arriving at a floor — pick one at random. */
  arrival: string[];
  description: string;
  /** materialId → one-line blurb for tooltips / crafting UI. */
  resourceBlurbs: Record<string, string>;
  /** Warden creature id and display name. */
  warden: { id: string; name: string };
}

// ── Item naming ────────────────────────────────────────────────────────────

export type GearSlot = "focus" | "relic" | "hood" | "robe" | "boots" | "amulet" | "ring";
export type FocusKind = "staff" | "wand" | "tome" | "orb";

export interface GearName {
  slot: GearSlot;
  kind?: FocusKind;
  name: string;
  flavor: string;
}

export interface LegendaryName {
  id: string;
  name: string;
  slot: GearSlot;
  kind?: FocusKind;
  flavor: string;
  /** One-line suggested mechanic for the item designer. */
  mechanic: string;
}

export interface MaterialName {
  id: string;
  name: string;
  flavor: string;
  /** What crafting uses it for. */
  use: string;
}

export interface ConsumableName {
  id: string;
  name: string;
  kind: "potion" | "flask" | "scroll" | "salve" | "bell" | "charm" | "food";
  flavor: string;
  /** Suggested effect (one line). */
  effect: string;
}

export interface KitName {
  id: string;
  name: string;
  flavor: string;
}

export interface StratumNaming {
  stratum: number;
  gear: GearName[];
  legendaries: LegendaryName[];
  /** Flavour affix words themed to the stratum ("Tallow-bound …"). */
  prefixes: string[];
  suffixes: string[];
  materials: MaterialName[];
  consumables: ConsumableName[];
  kit: KitName;
}

export interface AffixTheme {
  /** Stat or element theme this word set suits (e.g. "fire", "manaRegen"). */
  theme: string;
  prefixes: string[];
  suffixes: string[];
}

// ── Village ────────────────────────────────────────────────────────────────

export type SecretRewardKind = "lore" | "cosmetic" | "title";

export interface SecretReward {
  kind: SecretRewardKind;
  id: string;
  /** lore: the page text · cosmetic: its description · title: the title. */
  text: string;
}

export interface VillageSecret {
  id: string;
  name: string;
  location: string;
  /** Machine-readable trigger; grammar documented in village.ts. */
  trigger: string;
  reward: SecretReward;
  extraRewards?: SecretReward[];
  /** Shown when the secret is discovered. */
  discoveryText: string;
}

export type DeathCause =
  | "creature"
  | "warden"
  | "trap"
  | "delver"
  | "fall"
  | "fire"
  | "frost"
  | "storm"
  | "venom"
  | "void"
  | "drown"
  | "explosion"
  | "crushed"
  | "bleeding"
  | "self"
  | "unknown";

export interface LoadingQuote {
  text: string;
  source?: string;
}
