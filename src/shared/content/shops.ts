import type { CosmeticDef, KitDef, RecipeDef } from "./types";

/** The economy of Kneel — the one balance sheet for every shop. Server
 * validates every transaction against these tables. */

export interface StockEntry {
  item: string;
  price: number;
  /** Only sold once the buyer has reached this depth. */
  minDeepest?: number;
}

/** Mother Sallow's apothecary. */
export const APOTHECARY_STOCK: StockEntry[] = [
  { item: "healing_draught", price: 18 },
  { item: "mana_draught", price: 14 },
  { item: "oil_flask", price: 8 },
  { item: "fire_flask", price: 16, minDeepest: 3 },
  { item: "waking_bell", price: 260, minDeepest: 5 },
];

/** What a gamble tier costs and how generous it is (Mistress Vey). */
export const GAMBLE_TIERS = [
  { tier: 0, name: "A Plain Veil", price: 40, rarityLuck: 1, ilvlBonus: 0 },
  { tier: 1, name: "A Stitched Veil", price: 120, rarityLuck: 1.6, ilvlBonus: 1 },
  { tier: 2, name: "A Veil of Black Silk", price: 380, rarityLuck: 2.6, ilvlBonus: 3 },
];

/** Old Hask's lending kits: full loaner loadouts weighed for a stratum. */
export const KITS: KitDef[] = [
  {
    id: "kit_undercroft",
    name: "Undercroft Kit",
    gearLevel: 3,
    price: 30,
    desc: "Gear weighed light enough for the catacombs. Hask wants it back.",
    items: [
      { base: "apprentice_staff", rarity: "uncommon" },
      { base: "blink_charm", rarity: "common" },
      { base: "delvers_hood", rarity: "common" },
      { base: "delvers_robe", rarity: "uncommon" },
      { base: "worn_boots", rarity: "common" },
      { base: "bone_amulet", rarity: "common" },
      { base: "iron_ring", rarity: "common" },
    ],
  },
  {
    id: "kit_archive",
    name: "Archive Kit",
    gearLevel: 13,
    price: 90,
    desc: "For wading the Drowned Archive without drowning in it.",
    items: [
      { base: "storm_rod", rarity: "uncommon" },
      { base: "grasping_hand", rarity: "common" },
      { base: "chandlers_cowl", rarity: "common" },
      { base: "ossuary_mantle", rarity: "uncommon" },
      { base: "hare_boots", rarity: "common" },
      { base: "tallow_amulet", rarity: "common" },
      { base: "grave_ring", rarity: "common" },
    ],
  },
  {
    id: "kit_choir",
    name: "Choir Kit",
    gearLevel: 23,
    price: 180,
    desc: "Earplugs not included.",
    items: [
      { base: "ember_staff", rarity: "rare" },
      { base: "ward_bell", rarity: "common" },
      { base: "chandlers_cowl", rarity: "uncommon" },
      { base: "ossuary_mantle", rarity: "uncommon" },
      { base: "moth_boots", rarity: "common" },
      { base: "tallow_amulet", rarity: "uncommon" },
      { base: "grave_ring", rarity: "uncommon" },
    ],
  },
];

/** Pell's cosmetics. `value` is consumed by the wizard model. */
export const COSMETICS: CosmeticDef[] = [
  { id: "dye_ash", name: "Ash-grey Dye", kind: "robe_dye", price: 40, value: "#6b6863" },
  { id: "dye_oxblood", name: "Oxblood Dye", kind: "robe_dye", price: 60, value: "#5a1518" },
  { id: "dye_moss", name: "Crypt-moss Dye", kind: "robe_dye", price: 60, value: "#3d5a2a" },
  { id: "dye_ink", name: "Drowned-ink Dye", kind: "robe_dye", price: 90, value: "#1a2240" },
  { id: "dye_tallow", name: "Tallow-white Dye", kind: "robe_dye", price: 120, value: "#d8cfb2" },
  { id: "dye_gilt", name: "Gilt Dye", kind: "robe_dye", price: 400, value: "#b8902a" },
  { id: "hood_pointed", name: "Pointed Hood", kind: "hood", price: 80, value: "pointed" },
  { id: "hood_cowl", name: "Mourner's Cowl", kind: "hood", price: 120, value: "cowl" },
  { id: "hood_brim", name: "Wide Brim", kind: "hood", price: 150, value: "brim" },
  { id: "finish_bone", name: "Bone Staff Finish", kind: "staff_finish", price: 100, value: "bone" },
  { id: "finish_gilt", name: "Gilt Staff Finish", kind: "staff_finish", price: 350, value: "gilt" },
  { id: "lantern_green", name: "Marsh-light Lantern", kind: "lantern", price: 90, value: "#7affb0" },
  { id: "lantern_violet", name: "Violet Lantern", kind: "lantern", price: 90, value: "#b58cff" },
  { id: "lantern_red", name: "Ember Lantern", kind: "lantern", price: 90, value: "#ff6a3a" },
  { id: "trail_embers", name: "Trail of Embers", kind: "trail", price: 200, value: "ember" },
  { id: "trail_moths", name: "Trail of Moths", kind: "trail", price: 260, value: "moth" },
  { id: "sigil_eye", name: "The Closed Eye", kind: "sigil", price: 0, value: "eye", secret: "bell_rung" },
  { id: "dye_dream", name: "Dreamt Dye", kind: "robe_dye", price: 0, value: "#8a7ac8", secret: "colossus_neck" },
];

/** Brannoc's bench. Upgrades need shallow materials at every depth — the
 * reason high-level delvers go back to the Undercroft. */
export const RECIPES: RecipeDef[] = [
  { id: "upgrade", name: "Temper (+1)", desc: "Raise an item's power one step. Grave tallow binds the work.", kind: "upgrade", gold: 40, materials: [{ id: "grave_tallow", qty: 3 }, { id: "ossuary_bone", qty: 2 }] },
  { id: "reforge", name: "Reforge", desc: "Reroll an item's affixes and amplifiers, keeping its level and rarity.", kind: "reforge", gold: 80, materials: [{ id: "ossuary_bone", qty: 4 }] },
  { id: "craft_healing", name: "Distil Healing Draughts", desc: "Two draughts from tallow and bone-ash.", kind: "craft", gold: 6, materials: [{ id: "grave_tallow", qty: 2 }], output: { base: "healing_draught", qty: 2 } },
  { id: "craft_oil", name: "Render Lamp Oil", desc: "Three flasks of oil from grave tallow.", kind: "craft", gold: 2, materials: [{ id: "grave_tallow", qty: 1 }], output: { base: "oil_flask", qty: 3 } },
];
