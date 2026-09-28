import { RUN } from "../config";
import type { ItemInstance, Slot } from "../content/types";
import { SLOTS } from "../content/types";
import { clamp } from "../util/math";
import type { Rng } from "../util/rng";
import type { Equipment } from "./stats";

/** The run rules of the Godwell (DESIGN.md §3). Pure and shared. */

/** Average item level over all equipment slots (empty = 0). */
export function gearLevel(eq: Equipment): number {
  let sum = 0;
  for (const s of SLOTS) sum += eq[s]?.ilvl ?? 0;
  return sum / SLOTS.length;
}

/** "The Well takes you as deep as you are heavy": the floor a delver is
 * thrown to. Near the gear level, with a little randomness. */
export function entryFloor(gl: number, rng: Rng): number {
  if (gl < 2) return 1;
  const target = Math.round(gl * 0.95 + rng.range(-1.5, 1.5));
  return clamp(target, 1, RUN.maxFloor);
}

/** Descents offer Ascend once enough floors were cleared this run. */
export function canAscend(floorsCleared: number): boolean {
  return floorsCleared + 1 >= RUN.floorsBeforeExit;
}

/** Items lost on death: everything marked as run loot. */
export function runLoot(items: (ItemInstance | null)[]): ItemInstance[] {
  return items.filter((i): i is ItemInstance => !!i && !!i.run);
}

export function emptyEquipment(): Record<Slot, ItemInstance | null> {
  return { focus: null, relic: null, hood: null, robe: null, boots: null, amulet: null, ring: null };
}
