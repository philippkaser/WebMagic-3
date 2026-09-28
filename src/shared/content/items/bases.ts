import { Registry } from "../registry";
import type { ItemBaseDef } from "../types";

/** Item bases. game/items.ts rolls instances (ilvl, rarity, affixes,
 * amplifiers) from these. */
export const ITEMS = new Registry<ItemBaseDef>("item");

export const STARTER_FOCUS = "apprentice_staff";
export const STARTER_ROBE = "delvers_robe";
export const STARTER_BOOTS = "worn_boots";

ITEMS.register(
  // ── Foci ────────────────────────────────────────────────────────────────
  {
    id: "apprentice_staff",
    name: "Apprentice Staff",
    category: "gear",
    slot: "focus",
    glyph: "⚚",
    color: "#8fd8ff",
    floors: [1, 12],
    weight: 3,
    value: 8,
    flavor: "Ash wood, a cracked crystal, somebody's initials scratched out.",
    model: "staff_apprentice",
    focus: { primary: "bolt", secondary: "force_blast", power: 1 },
  },
  {
    id: "ember_staff",
    name: "Ember Staff",
    category: "gear",
    slot: "focus",
    glyph: "⚚",
    color: "#ff8b3d",
    floors: [2, 40],
    weight: 4,
    value: 14,
    flavor: "Still warm. It is always still warm.",
    model: "staff_ember",
    focus: { primary: "ember_scatter", secondary: "fireball", power: 1 },
  },
  {
    id: "rime_wand",
    name: "Rime Wand",
    category: "gear",
    slot: "focus",
    glyph: "⟋",
    color: "#bfefff",
    floors: [3, 60],
    weight: 3,
    value: 16,
    model: "wand_rime",
    focus: { primary: "frost_shard", secondary: "frost_nova", power: 1 },
  },
  {
    id: "storm_rod",
    name: "Storm Rod",
    category: "gear",
    slot: "focus",
    glyph: "ϟ",
    color: "#f4f7a0",
    floors: [5, 70],
    weight: 3,
    value: 18,
    model: "rod_storm",
    focus: { primary: "spark", secondary: "chain_lightning", power: 1 },
  },
  {
    id: "hollow_staff",
    name: "Staff of the Hollow",
    category: "gear",
    slot: "focus",
    glyph: "⚚",
    color: "#b27cff",
    floors: [8, 100],
    weight: 2,
    value: 26,
    model: "staff_void",
    focus: { primary: "void_lance", secondary: "singularity", power: 1.05 },
  },
  {
    id: "bitter_orb",
    name: "Bitter Orb",
    category: "gear",
    slot: "focus",
    glyph: "◉",
    color: "#8cff5a",
    floors: [6, 80],
    weight: 2,
    value: 20,
    model: "orb_venom",
    focus: { primary: "venom_glob", secondary: "force_blast", power: 1 },
  },
  // ── Relics ──────────────────────────────────────────────────────────────
  { id: "blink_charm", name: "Blink Charm", category: "gear", slot: "relic", glyph: "✧", color: "#d8c8ff", floors: [1, 100], weight: 4, value: 14, model: "relic_blink", relic: { ability: "blink" } },
  { id: "grasping_hand", name: "Grasping Hand", category: "gear", slot: "relic", glyph: "✋", color: "#bfa8ff", floors: [1, 100], weight: 4, value: 14, model: "relic_grasp", relic: { ability: "grasp" }, flavor: "A mummified hand that still wants to hold things." },
  { id: "ward_bell", name: "Ward Bell", category: "gear", slot: "relic", glyph: "🔔", color: "#e6d9ff", floors: [4, 100], weight: 3, value: 18, model: "relic_ward", relic: { ability: "ward" } },
  // ── Armour ──────────────────────────────────────────────────────────────
  { id: "delvers_hood", name: "Delver's Hood", category: "gear", slot: "hood", glyph: "▲", color: "#8a7a6a", floors: [1, 100], weight: 6, value: 6, stats: { armor: 1, lightRadius: 0.5 }, model: "hood_plain" },
  { id: "chandlers_cowl", name: "Chandler's Cowl", category: "gear", slot: "hood", glyph: "▲", color: "#e8d8a8", floors: [4, 100], weight: 3, value: 12, stats: { lightRadius: 2, manaRegen: 1 }, model: "hood_chandler" },
  { id: "delvers_robe", name: "Delver's Robe", category: "gear", slot: "robe", glyph: "▣", color: "#6a5a4a", floors: [1, 100], weight: 6, value: 6, stats: { maxHealth: 10, armor: 1 }, model: "robe_plain" },
  { id: "ossuary_mantle", name: "Ossuary Mantle", category: "gear", slot: "robe", glyph: "▣", color: "#d8ccb0", floors: [3, 100], weight: 3, value: 14, stats: { armor: 4, maxHealth: 16 }, model: "robe_bone" },
  { id: "worn_boots", name: "Worn Boots", category: "gear", slot: "boots", glyph: "⬢", color: "#7a6048", floors: [1, 100], weight: 6, value: 4, stats: { moveSpeed: 0 }, model: "boots_plain" },
  { id: "hare_boots", name: "Harefoot Boots", category: "gear", slot: "boots", glyph: "⬢", color: "#a8e0a0", floors: [2, 100], weight: 3, value: 14, stats: { extraJumps: 1, moveSpeed: 3 }, model: "boots_hare" },
  { id: "moth_boots", name: "Mothwing Boots", category: "gear", slot: "boots", glyph: "⬢", color: "#d8d0ff", floors: [6, 100], weight: 2, value: 18, stats: { glide: 1 }, model: "boots_moth" },
  // ── Jewellery ───────────────────────────────────────────────────────────
  { id: "bone_amulet", name: "Knucklebone Amulet", category: "gear", slot: "amulet", glyph: "◈", color: "#e8dcc0", floors: [1, 100], weight: 5, value: 10, stats: { maxHealth: 12 }, model: "amulet_bone" },
  { id: "tallow_amulet", name: "Tallow Locket", category: "gear", slot: "amulet", glyph: "◈", color: "#ffe9a8", floors: [2, 100], weight: 4, value: 12, stats: { manaRegen: 2 }, model: "amulet_tallow" },
  { id: "iron_ring", name: "Iron Ring", category: "gear", slot: "ring", glyph: "○", color: "#9a9aa8", floors: [1, 100], weight: 6, value: 8, stats: { spellPower: 4 }, model: "ring_iron" },
  { id: "grave_ring", name: "Gravedigger's Ring", category: "gear", slot: "ring", glyph: "○", color: "#b0a080", floors: [3, 100], weight: 4, value: 12, stats: { critChance: 3 }, model: "ring_grave" },
  // ── Consumables ─────────────────────────────────────────────────────────
  { id: "healing_draught", name: "Healing Draught", category: "consumable", glyph: "⚗", color: "#ff5d5d", floors: [1, 100], weight: 8, value: 12, stack: 5, use: [{ type: "heal", amount: 45 }], model: "potion_red", flavor: "Mother Sallow's. Tastes of iron and honey." },
  { id: "mana_draught", name: "Mana Draught", category: "consumable", glyph: "⚗", color: "#5db9ff", floors: [1, 100], weight: 6, value: 10, stack: 5, use: [{ type: "mana", amount: 60 }], model: "potion_blue" },
  { id: "oil_flask", name: "Oil Flask", category: "consumable", glyph: "⚱", color: "#6a5230", floors: [1, 100], weight: 5, value: 6, stack: 5, action: "throw", throwSpell: "thrown_oil_flask", model: "flask_oil" },
  { id: "fire_flask", name: "Fire Flask", category: "consumable", glyph: "⚱", color: "#ff7a2a", floors: [2, 100], weight: 4, value: 10, stack: 5, action: "throw", throwSpell: "thrown_fire_flask", model: "flask_fire" },
  { id: "waking_bell", name: "Waking Bell", category: "consumable", glyph: "🔔", color: "#ffe9a8", floors: [1, 100], weight: 0, value: 220, stack: 1, action: "ascend", model: "bell_small", flavor: "Ring it and the dreamer stirs. For one breath, you can slip out." },
  // ── Materials (stratum resources) ───────────────────────────────────────
  { id: "grave_tallow", name: "Grave Tallow", category: "material", glyph: "✦", color: "#f0e0b0", floors: [1, 10], weight: 5, value: 3, stack: 50, stratum: 0, model: "mat_tallow" },
  { id: "ossuary_bone", name: "Ossuary Bone", category: "material", glyph: "✦", color: "#e8dcc0", floors: [1, 10], weight: 5, value: 3, stack: 50, stratum: 0, model: "mat_bone" },
  { id: "gold_coin", name: "Gold", category: "treasure", glyph: "●", color: "#ffd24a", floors: [1, 100], weight: 0, value: 1, stack: 99999, model: "coin" },
);
