import { AFFIXES, AMPLIFIERS, ITEMS } from "../content";
import type { ItemBaseDef, ItemInstance, Rarity, Slot, StatBlock, StatKey } from "../content/types";
import { RARITIES } from "../content/types";
import { clamp, lerp } from "../util/math";
import type { Rng } from "../util/rng";

/** Item rules: rolling instances, naming, value, stat scaling. Pure —
 * the server rolls loot with these, clients use them to display. */

const RARITY_AFFIXES: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 3 };
const RARITY_AMPS: Record<Rarity, [number, number]> = {
  common: [0, 0],
  uncommon: [0, 0.15],
  rare: [0, 0.45],
  epic: [1, 0.35],
  legendary: [1, 0.6],
};
export const RARITY_COLOR: Record<Rarity, string> = {
  common: "#c9c2b4",
  uncommon: "#7fd06a",
  rare: "#5fa8ff",
  epic: "#c07bff",
  legendary: "#ffb83a",
};
const RARITY_VALUE: Record<Rarity, number> = { common: 1, uncommon: 2, rare: 4, epic: 8, legendary: 16 };

let uidCounter = 0;
/** Unique item id. Servers may override with their own generator. */
export let makeUid = (): string => `i${Date.now().toString(36)}${(uidCounter++).toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
export function setUidFactory(fn: () => string): void {
  makeUid = fn;
}

/** Rarity roll; luck (1 = normal) and depth push it upward. */
export function rollRarity(rng: Rng, floor: number, luck = 1): Rarity {
  const depth = clamp(floor / 100, 0, 1);
  const r = rng.next() / luck;
  const legendary = 0.004 + depth * 0.01;
  const epic = legendary + 0.025 + depth * 0.05;
  const rare = epic + 0.1 + depth * 0.12;
  const uncommon = rare + 0.28;
  if (r < legendary) return "legendary";
  if (r < epic) return "epic";
  if (r < rare) return "rare";
  if (r < uncommon) return "uncommon";
  return "common";
}

/** Item level for a drop on `floor`. */
export function rollIlvl(rng: Rng, floor: number): number {
  return clamp(Math.round(floor + rng.range(-1.5, 2.5)), 1, 100);
}

export function basesDroppingOn(floor: number, category?: ItemBaseDef["category"]): ItemBaseDef[] {
  return ITEMS.all().filter((b) => b.weight > 0 && floor >= b.floors[0] && floor <= b.floors[1] && (!category || b.category === category));
}

/** A fully rolled gear instance. */
export function rollGear(rng: Rng, base: ItemBaseDef, ilvl: number, rarity: Rarity): ItemInstance {
  const item: ItemInstance = { uid: makeUid(), base: base.id, ilvl, rarity, affixes: [], qty: 1 };
  if (base.unique) {
    item.affixes = base.unique.affixes.map((a) => ({ ...a }));
    return item;
  }
  const slot = base.slot!;
  const pool = AFFIXES.all().filter((a) => a.slots.includes(slot) && (a.minIlvl ?? 0) <= ilvl);
  const n = RARITY_AFFIXES[rarity];
  const used = new Set<string>();
  for (let k = 0; k < n && pool.length; k++) {
    const choices = pool.filter((a) => !used.has(a.id) && !used.has(a.stat));
    if (!choices.length) break;
    const a = rng.weighted(choices, (x) => x.weight);
    used.add(a.id);
    used.add(a.stat);
    const t = (ilvl - 1) / 99;
    const lo = lerp(a.min[0], a.min[1], t);
    const hi = lerp(a.max[0], a.max[1], t);
    const v = lo + (hi - lo) * rng.next();
    item.affixes.push({ id: a.id, value: Math.round(v * 10) / 10 });
  }
  const [guaranteed, extraChance] = RARITY_AMPS[rarity];
  const ampCount = guaranteed + (rng.chance(extraChance) ? 1 : 0);
  if (ampCount > 0) {
    const ampPool = AMPLIFIERS.all().filter((a) => a.slots.includes(slot) && a.minIlvl <= ilvl);
    const groups = new Set<string>();
    const amps: string[] = [];
    for (let k = 0; k < ampCount && ampPool.length; k++) {
      const choices = ampPool.filter((a) => !amps.includes(a.id) && !(a.group && groups.has(a.group)));
      if (!choices.length) break;
      const a = rng.weighted(choices, (x) => x.weight);
      amps.push(a.id);
      if (a.group) groups.add(a.group);
    }
    if (amps.length) item.amps = amps;
  }
  return item;
}

/** Stackable (consumable/material/treasure) instance. */
export function makeStack(baseId: string, qty: number, ilvl = 1): ItemInstance {
  return { uid: makeUid(), base: baseId, ilvl, rarity: "common", affixes: [], qty };
}

/** Roll one random drop for a floor: mostly gear, some consumables and
 * stratum materials. */
export function rollDrop(rng: Rng, floor: number, luck = 1): ItemInstance {
  const roll = rng.next();
  if (roll < 0.25) {
    const pool = basesDroppingOn(floor, "consumable");
    if (pool.length) return makeStack(rng.weighted(pool, (b) => b.weight).id, 1, floor);
  } else if (roll < 0.45) {
    const pool = basesDroppingOn(floor, "material");
    if (pool.length) return makeStack(rng.weighted(pool, (b) => b.weight).id, rng.int(1, 3), floor);
  }
  const gear = basesDroppingOn(floor, "gear");
  const base = rng.weighted(gear, (b) => b.weight);
  return rollGear(rng, base, rollIlvl(rng, floor), rollRarity(rng, floor, luck));
}

/** Implicit stats of a base, scaled by item level. */
export function implicitStats(item: ItemInstance): StatBlock {
  const base = ITEMS.get(item.base);
  const out: StatBlock = {};
  const scale = 1 + (item.ilvl - 1) * 0.045 + (item.upgrade ?? 0) * 0.08;
  for (const [k, v] of Object.entries(base.stats ?? {}) as [StatKey, number][]) {
    // Counts and flags don't scale.
    out[k] = k === "extraJumps" || k === "glide" || k === "extraProjectiles" ? v : Math.round(v * scale * 10) / 10;
  }
  return out;
}

/** Focus damage multiplier from item level (the main power curve). */
export function focusPower(item: ItemInstance): number {
  const base = ITEMS.get(item.base);
  const p = base.focus?.power ?? 1;
  return p * (1 + (item.ilvl - 1) * 0.085 + (item.upgrade ?? 0) * 0.1) * (item.rarity === "legendary" ? 1.15 : 1);
}

export function itemName(item: ItemInstance): string {
  const base = ITEMS.get(item.base);
  if (base.category !== "gear" || base.unique) return base.name;
  const amp = item.amps?.length ? AMPLIFIERS.find(item.amps[0])?.name : undefined;
  const pre = item.affixes.map((a) => AFFIXES.find(a.id)).find((a) => a?.kind === "prefix");
  const suf = item.affixes.map((a) => AFFIXES.find(a.id)).find((a) => a?.kind === "suffix");
  const parts = [amp, pre?.name, base.name, suf?.name].filter(Boolean);
  return parts.join(" ") + (item.upgrade ? ` +${item.upgrade}` : "");
}

export function itemValue(item: ItemInstance): number {
  const base = ITEMS.get(item.base);
  const lvl = 1 + (item.ilvl - 1) * 0.12;
  return Math.max(1, Math.round(base.value * lvl * RARITY_VALUE[item.rarity])) * (item.qty || 1);
}

export function isGear(item: ItemInstance): boolean {
  return ITEMS.get(item.base).category === "gear";
}

export function slotOf(item: ItemInstance): Slot | null {
  return ITEMS.get(item.base).slot ?? null;
}

export function stackLimit(item: ItemInstance): number {
  return ITEMS.get(item.base).stack ?? 1;
}

export function rarityRank(r: Rarity): number {
  return RARITIES.indexOf(r);
}
