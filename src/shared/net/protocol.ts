import type { ItemInstance, Slot } from "../content/types";
import type { SimEvent } from "../sim/events";

/** The wire protocol between a client and a game server (a Bun process
 * online, or the in-browser worker offline — same code, same messages).
 *
 * Control messages are JSON; world snapshots are binary (net/codec.ts).
 * The server is authoritative for everything except the delver's own
 * movement, which the client simulates and reports (validated). */

export const PROTOCOL_VERSION = 1;

export type V3T = [number, number, number];

// ── Client → server ─────────────────────────────────────────────────────────

export type InvLocation =
  | { in: "equip"; slot: Slot }
  | { in: "bag"; index: number }
  | { in: "belt"; index: number }
  | { in: "stash"; index: number };

export type InventoryOp =
  | { op: "move"; from: InvLocation; to: InvLocation }
  | { op: "drop"; from: InvLocation }
  | { op: "split"; from: InvLocation; qty: number };

export type ShopOp =
  | { op: "buy"; shop: string; item: string; qty?: number }
  | { op: "sell"; from: InvLocation }
  | { op: "gamble"; tier: number }
  | { op: "gamble_pick"; index: number }
  | { op: "kit"; kit: string }
  | { op: "craft"; recipe: string; target?: InvLocation }
  | { op: "cosmetic_buy"; id: string }
  | { op: "cosmetic_equip"; id: string | null; kind: string };

export type ClientMsg =
  | { t: "hello"; name: string; token?: string; v: number }
  | { t: "ping"; c: number }
  /** Step into the Godwell (village only). */
  | { t: "enter" }
  /** Movement report (30 Hz): seq, position, velocity, yaw, pitch, grounded. */
  | { t: "in"; s: number; p: V3T; v: V3T; y: number; pi: number; g: 0 | 1 }
  | { t: "cast"; slot: "primary" | "secondary" | "relic"; id: number; o: V3T; d: V3T }
  | { t: "release"; slot: "primary" | "secondary" | "relic" }
  | { t: "interact"; id: number; choice?: "ascend" | "descend" }
  /** Use a belt consumable (throwables carry an aim). */
  | { t: "use"; belt: number; o?: V3T; d?: V3T }
  | { t: "sign" }
  | { t: "inv"; op: InventoryOp }
  | { t: "shop"; op: ShopOp }
  /** Village secrets and NPC talk. */
  | { t: "village"; action: string; arg?: string }
  | { t: "chat"; text: string }
  /** Back to the village after the death screen. */
  | { t: "respawn" };

// ── Server → client ─────────────────────────────────────────────────────────

/** What a client may know about its own account. */
export interface AccountView {
  name: string;
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
  /** True while a Quartermaster kit is equipped (own gear held by Hask). */
  kitted: boolean;
  gearLevel: number;
}

export interface RunView {
  active: boolean;
  startFloor: number;
  floor: number;
  floorsCleared: number;
  canAscend: boolean;
  runGold: number;
  kit: string | null;
}

export interface SelfState {
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  /** spellId → remaining cooldown (s). */
  cd: Record<string, number>;
  /** status id → remaining seconds. */
  st: Record<string, number>;
  /** Knockback to apply to the local controller (velocity change, m/s). */
  imp?: V3T;
  /** Server rejected our movement: snap here. */
  corr?: V3T;
  channel?: string | null;
  grasp?: number;
}

export interface SceneInfo {
  scene: "village" | "floor";
  /** Our entity id in the scene. */
  you: number;
  floor: number;
  seed: number;
  biome: string;
  instance: string;
  arrival: V3T;
  yaw: number;
  /** Full surface state for late joiners ([index, kind, …]). */
  surfaces: number[];
  serverTime: number;
}

export interface EntityInfo {
  id: number;
  /** Display name (players, named creatures, item pickups). */
  name?: string;
  rarity?: string;
  /** Player cosmetics (robe dye, hood, lantern colour…). */
  look?: Record<string, string>;
  oath?: boolean;
  /** A projectile the viewer cast (the client renders its own prediction). */
  own?: boolean;
}

export interface NoteView {
  id: string;
  title: string;
  author?: string;
  text: string;
}

export type ServerMsg =
  | { t: "welcome"; token: string; account: AccountView; serverTime: number; online: boolean }
  | { t: "pong"; c: number; s: number }
  | { t: "account"; account: AccountView }
  | { t: "scene"; info: SceneInfo; run: RunView }
  | { t: "run"; run: RunView }
  | { t: "self"; s: SelfState }
  | { t: "ev"; ev: SimEvent[] }
  | { t: "info"; list: EntityInfo[] }
  | { t: "died"; cause: string; killer: string; lost: ItemInstance[]; floor: number }
  | { t: "ascended"; floor: number; banked: ItemInstance[]; gold: number }
  | { t: "note"; note: NoteView }
  | { t: "toast"; text: string; kind: "info" | "warn" | "lore" | "presence" | "error" }
  | { t: "gamble"; offers: { glyph: string; hint: string }[] }
  | { t: "village"; players: { id: number; name: string; p: V3T; y: number; look?: Record<string, string> }[] }
  | { t: "dialog"; npc: string; line: string };
