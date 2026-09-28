import { STARTER_BOOTS, STARTER_FOCUS, STARTER_ROBE, ITEMS } from "../../shared/content";
import type { ItemInstance, Slot } from "../../shared/content/types";
import { SLOTS } from "../../shared/content/types";
import { rollGear } from "../../shared/game/items";
import { emptyEquipment, gearLevel } from "../../shared/game/rules";
import type { AccountView } from "../../shared/net/protocol";
import { Rng } from "../../shared/util/rng";

/** Server-side accounts. The client never owns item state: it sends
 * intentions (move, buy, cast) and receives views. */

export const BAG_SLOTS = 16;
export const BELT_SLOTS = 4;
export const STASH_SLOTS = 48;

export interface RunState {
  startFloor: number;
  floor: number;
  floorsCleared: number;
  runGold: number;
  kit: string | null;
  startedAt: number;
}

export interface Account {
  id: string;
  token: string;
  name: string;
  created: number;
  gold: number;
  equipment: Record<Slot, ItemInstance | null>;
  bag: (ItemInstance | null)[];
  belt: (ItemInstance | null)[];
  stash: (ItemInstance | null)[];
  cosmetics: { owned: string[]; equipped: Record<string, string> };
  stats: { deepest: number; deaths: number; kills: number; runs: number; ascents: number };
  lore: string[];
  secrets: string[];
  titles: string[];
  /** The delver's own gear, held by the Quartermaster while kitted. */
  heldGear: Record<Slot, ItemInstance | null> | null;
  /** Persisted so a crash/disconnect mid-run can't be used to escape. */
  run: RunState | null;
  lastEncounter: number;
  /** Pending gamble offers (Wagers). */
  gambleOffers?: ItemInstance[];
}

export interface AccountStore {
  byToken(token: string): Promise<Account | null>;
  save(account: Account): void;
  /** Recent deaths for the Memorial Wall. */
  memorial?(): { name: string; floor: number; cause: string; at: number }[];
  addMemorial?(entry: { name: string; floor: number; cause: string; at: number }): void;
}

export class MemoryStore implements AccountStore {
  private accounts = new Map<string, Account>();
  private wall: { name: string; floor: number; cause: string; at: number }[] = [];
  async byToken(token: string): Promise<Account | null> {
    return this.accounts.get(token) ?? null;
  }
  save(account: Account): void {
    this.accounts.set(account.token, account);
  }
  memorial() {
    return this.wall;
  }
  addMemorial(entry: { name: string; floor: number; cause: string; at: number }) {
    this.wall.unshift(entry);
    this.wall.length = Math.min(this.wall.length, 40);
  }
}

export function newAccount(name: string, token: string, id: string): Account {
  const rng = new Rng((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
  const eq = emptyEquipment();
  eq.focus = rollGear(rng, ITEMS.get(STARTER_FOCUS), 1, "common");
  eq.robe = rollGear(rng, ITEMS.get(STARTER_ROBE), 1, "common");
  eq.boots = rollGear(rng, ITEMS.get(STARTER_BOOTS), 1, "common");
  const belt: (ItemInstance | null)[] = new Array(BELT_SLOTS).fill(null);
  belt[0] = { uid: `starter-${id}-0`, base: "healing_draught", ilvl: 1, rarity: "common", affixes: [], qty: 2 };
  belt[1] = { uid: `starter-${id}-1`, base: "oil_flask", ilvl: 1, rarity: "common", affixes: [], qty: 2 };
  return {
    id,
    token,
    name: cleanName(name),
    created: Date.now(),
    gold: 25,
    equipment: eq,
    bag: new Array(BAG_SLOTS).fill(null),
    belt,
    stash: new Array(STASH_SLOTS).fill(null),
    cosmetics: { owned: [], equipped: {} },
    stats: { deepest: 0, deaths: 0, kills: 0, runs: 0, ascents: 0 },
    lore: [],
    secrets: [],
    titles: [],
    heldGear: null,
    run: null,
    lastEncounter: Date.now(),
  };
}

export function cleanName(name: string): string {
  const n = String(name ?? "")
    .replace(/[^\p{L}\p{N} _'-]/gu, "")
    .trim()
    .slice(0, 20);
  return n || "Nameless";
}

/** Repair shape after loading (older saves, corrupt data). */
export function normalizeAccount(a: Account): Account {
  a.equipment = { ...emptyEquipment(), ...(a.equipment ?? {}) };
  const fit = (arr: (ItemInstance | null)[] | undefined, n: number) => {
    const out = (arr ?? []).slice(0, n);
    while (out.length < n) out.push(null);
    return out;
  };
  a.bag = fit(a.bag, BAG_SLOTS);
  a.belt = fit(a.belt, BELT_SLOTS);
  a.stash = fit(a.stash, STASH_SLOTS);
  a.cosmetics ??= { owned: [], equipped: {} };
  a.stats ??= { deepest: 0, deaths: 0, kills: 0, runs: 0, ascents: 0 };
  a.lore ??= [];
  a.secrets ??= [];
  a.titles ??= [];
  a.heldGear ??= null;
  a.run ??= null;
  a.lastEncounter ??= Date.now();
  return a;
}

export function accountView(a: Account): AccountView {
  return {
    name: a.name,
    gold: a.gold,
    equipment: a.equipment,
    bag: a.bag,
    belt: a.belt,
    stash: a.stash,
    cosmetics: a.cosmetics,
    stats: a.stats,
    lore: a.lore,
    secrets: a.secrets,
    titles: a.titles,
    kitted: !!a.heldGear,
    gearLevel: Math.round(gearLevel(a.equipment) * 10) / 10,
  };
}

export function allCarried(a: Account): (ItemInstance | null)[] {
  return [...SLOTS.map((s) => a.equipment[s]), ...a.bag, ...a.belt];
}
