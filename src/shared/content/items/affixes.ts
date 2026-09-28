import { Registry } from "../registry";
import type { AffixDef, Slot } from "../types";

/** Stat affixes. Values interpolate between the [min,max] ranges at ilvl 1
 * and ilvl 100 (game/items.ts). */
export const AFFIXES = new Registry<AffixDef>("affix");

const ALL: Slot[] = ["focus", "relic", "hood", "robe", "boots", "amulet", "ring"];
const ARMOR: Slot[] = ["hood", "robe", "boots"];
const JEWEL: Slot[] = ["amulet", "ring"];

AFFIXES.register(
  { id: "vigor", kind: "prefix", name: "Hale", slots: ALL, stat: "maxHealth", min: [6, 60], max: [14, 140], weight: 10 },
  { id: "depth", kind: "prefix", name: "Deep-drawn", slots: ALL, stat: "maxMana", min: [6, 50], max: [14, 110], weight: 8 },
  { id: "power", kind: "prefix", name: "Searing", slots: ["focus", ...JEWEL], stat: "spellPower", min: [4, 20], max: [10, 45], weight: 10 },
  { id: "haste", kind: "prefix", name: "Hasty", slots: ["focus", "ring", "hood"], stat: "castSpeed", min: [3, 8], max: [8, 18], weight: 7 },
  { id: "stride", kind: "prefix", name: "Fleet", slots: ["boots", "amulet"], stat: "moveSpeed", min: [3, 6], max: [7, 14], weight: 7 },
  { id: "ward", kind: "prefix", name: "Warded", slots: ARMOR, stat: "armor", min: [1, 10], max: [3, 30], weight: 9 },
  { id: "keen", kind: "prefix", name: "Keen", slots: ["focus", ...JEWEL, "hood"], stat: "critChance", min: [2, 5], max: [5, 12], weight: 6 },
  { id: "cruel", kind: "prefix", name: "Cruel", slots: ["focus", ...JEWEL], stat: "critDamage", min: [10, 30], max: [25, 80], weight: 5 },
  { id: "force", kind: "prefix", name: "Forceful", slots: ["focus", "robe", ...JEWEL], stat: "knockback", min: [10, 25], max: [25, 60], weight: 5 },
  { id: "wild", kind: "prefix", name: "Wild", slots: ["focus", ...JEWEL], stat: "statusChance", min: [5, 12], max: [12, 30], weight: 5 },
  { id: "tides", kind: "suffix", name: "of Tides", slots: ALL, stat: "manaRegen", min: [1, 4], max: [3, 10], weight: 8 },
  { id: "mending", kind: "suffix", name: "of Mending", slots: ["robe", "hood", ...JEWEL], stat: "healthRegen", min: [0.3, 2], max: [0.8, 5], weight: 6 },
  { id: "hearth", kind: "suffix", name: "of the Hearth", slots: ALL, stat: "resFire", min: [5, 20], max: [12, 40], weight: 6 },
  { id: "thaw", kind: "suffix", name: "of Thaw", slots: ALL, stat: "resFrost", min: [5, 20], max: [12, 40], weight: 6 },
  { id: "ground", kind: "suffix", name: "of Grounding", slots: ALL, stat: "resStorm", min: [5, 20], max: [12, 40], weight: 6 },
  { id: "antidote", kind: "suffix", name: "of Bitter Roots", slots: ALL, stat: "resVenom", min: [5, 20], max: [12, 40], weight: 6 },
  { id: "lamp", kind: "suffix", name: "of the Lamp", slots: ["hood", "amulet", "relic"], stat: "lightRadius", min: [0.5, 1.5], max: [1.5, 4], weight: 5 },
  { id: "hush", kind: "suffix", name: "of Hush", slots: ["robe", "boots", "hood"], stat: "stealth", min: [5, 12], max: [12, 30], weight: 5 },
  { id: "fortune", kind: "suffix", name: "of Fortune", slots: [...JEWEL, "hood"], stat: "luck", min: [4, 10], max: [10, 30], weight: 4 },
  { id: "leap", kind: "suffix", name: "of the Hare", slots: ["boots"], stat: "jumpPower", min: [5, 10], max: [12, 25], weight: 5 },
  { id: "harvest", kind: "suffix", name: "of Harvest", slots: ["focus", ...JEWEL], stat: "lifeOnKill", min: [2, 10], max: [5, 25], weight: 4 },
  { id: "thorns", kind: "suffix", name: "of Thorns", slots: ["robe"], stat: "thorns", min: [3, 20], max: [8, 50], weight: 3 },
);
