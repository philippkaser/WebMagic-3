import { ITEMS } from "../../shared/content";
import type { ItemInstance, Slot } from "../../shared/content/types";
import { SLOTS } from "../../shared/content/types";
import type { InvLocation } from "../../shared/net/protocol";
import type { Account } from "./account";

/** Pure inventory rules over an Account. Every operation validates fully
 * and either applies atomically or returns an error string. */

export type Where = "village" | "dungeon";

export function getAt(a: Account, loc: InvLocation): ItemInstance | null {
  switch (loc.in) {
    case "equip":
      return SLOTS.includes(loc.slot) ? a.equipment[loc.slot] : null;
    case "bag":
      return a.bag[loc.index] ?? null;
    case "belt":
      return a.belt[loc.index] ?? null;
    case "stash":
      return a.stash[loc.index] ?? null;
  }
}

function validLoc(a: Account, loc: InvLocation): boolean {
  switch (loc.in) {
    case "equip":
      return SLOTS.includes(loc.slot);
    case "bag":
      return Number.isInteger(loc.index) && loc.index >= 0 && loc.index < a.bag.length;
    case "belt":
      return Number.isInteger(loc.index) && loc.index >= 0 && loc.index < a.belt.length;
    case "stash":
      return Number.isInteger(loc.index) && loc.index >= 0 && loc.index < a.stash.length;
  }
}

function setAt(a: Account, loc: InvLocation, item: ItemInstance | null): void {
  switch (loc.in) {
    case "equip":
      a.equipment[loc.slot] = item;
      return;
    case "bag":
      a.bag[loc.index] = item;
      return;
    case "belt":
      a.belt[loc.index] = item;
      return;
    case "stash":
      a.stash[loc.index] = item;
      return;
  }
}

/** Can `item` live at `loc`? */
function accepts(loc: InvLocation, item: ItemInstance | null, where: Where): string | null {
  if (!item) return null;
  const base = ITEMS.get(item.base);
  if (loc.in === "equip") {
    if (base.category !== "gear" || base.slot !== loc.slot) return "That doesn't go there.";
  }
  if (loc.in === "belt" && base.category !== "consumable") return "Only consumables fit on the belt.";
  if (loc.in === "stash") {
    if (where !== "village") return "Your stash is in Kneel.";
    if (item.kit) return "Old Hask wants his gear back, not stored.";
  }
  return null;
}

export function moveItem(a: Account, from: InvLocation, to: InvLocation, where: Where): string | null {
  if (!validLoc(a, from) || !validLoc(a, to)) return "Invalid slot.";
  if ((from.in === "stash" || to.in === "stash") && where !== "village") return "Your stash is in Kneel.";
  const src = getAt(a, from);
  if (!src) return null;
  const dst = getAt(a, to);
  if (from.in === "equip" && from.slot === "focus" && (!dst || ITEMS.get(dst.base).slot !== "focus")) return "A delver without a focus is just a person in a hole.";
  // Stack onto the same consumable/material.
  if (dst && dst.base === src.base && dst.uid !== src.uid && (ITEMS.get(src.base).stack ?? 1) > 1 && !!dst.run === !!src.run) {
    const max = ITEMS.get(src.base).stack ?? 1;
    const moved = Math.min(src.qty, max - dst.qty);
    if (moved <= 0) return "That stack is full.";
    dst.qty += moved;
    src.qty -= moved;
    if (src.qty <= 0) setAt(a, from, null);
    return null;
  }
  const e1 = accepts(to, src, where);
  if (e1) return e1;
  const e2 = accepts(from, dst, where);
  if (e2) return e2;
  setAt(a, to, src);
  setAt(a, from, dst);
  return null;
}

/** Remove the item at `loc` (for dropping or selling). */
export function takeItem(a: Account, loc: InvLocation, qty?: number): ItemInstance | null {
  if (!validLoc(a, loc)) return null;
  const it = getAt(a, loc);
  if (!it) return null;
  if (loc.in === "equip" && loc.slot === "focus") return null;
  if (qty !== undefined && qty < it.qty) {
    it.qty -= qty;
    return { ...it, uid: `${it.uid}-s${Date.now().toString(36)}`, qty };
  }
  setAt(a, loc, null);
  return it;
}

/** Put an item into the bag (stacking first). Returns false when full. */
export function addToBag(a: Account, item: ItemInstance): boolean {
  const base = ITEMS.get(item.base);
  const max = base.stack ?? 1;
  if (max > 1) {
    for (const list of [a.belt, a.bag]) {
      for (const s of list) {
        if (s && s.base === item.base && !!s.run === !!item.run && s.qty < max) {
          const moved = Math.min(item.qty, max - s.qty);
          s.qty += moved;
          item.qty -= moved;
          if (item.qty <= 0) return true;
        }
      }
    }
  }
  // Consumables go to an empty belt slot first.
  if (base.category === "consumable") {
    const b = a.belt.indexOf(null);
    if (b >= 0) {
      a.belt[b] = item;
      return true;
    }
  }
  // Gear auto-equips into an empty slot.
  if (base.category === "gear" && base.slot && !a.equipment[base.slot]) {
    a.equipment[base.slot] = item;
    return true;
  }
  const i = a.bag.indexOf(null);
  if (i < 0) return false;
  a.bag[i] = item;
  return true;
}

export function addToStash(a: Account, item: ItemInstance): boolean {
  const i = a.stash.indexOf(null);
  if (i < 0) return false;
  a.stash[i] = item;
  return true;
}

/** Visit every carried item slot (equipment, bag, belt). */
export function forEachCarried(a: Account, fn: (item: ItemInstance, remove: () => void) => void): void {
  for (const s of SLOTS as readonly Slot[]) {
    const it = a.equipment[s];
    if (it) fn(it, () => (a.equipment[s] = null));
  }
  a.bag.forEach((it, i) => it && fn(it, () => (a.bag[i] = null)));
  a.belt.forEach((it, i) => it && fn(it, () => (a.belt[i] = null)));
}

/** Count of a material across bag, belt and (in the village) stash. */
export function countOf(a: Account, base: string, includeStash: boolean): number {
  let n = 0;
  const lists = includeStash ? [a.bag, a.belt, a.stash] : [a.bag, a.belt];
  for (const l of lists) for (const it of l) if (it && it.base === base && !it.run) n += it.qty;
  return n;
}

/** Consume `qty` of a base from bag/belt/stash. Assumes countOf checked. */
export function consume(a: Account, base: string, qty: number, includeStash: boolean): void {
  const lists = includeStash ? [a.bag, a.belt, a.stash] : [a.bag, a.belt];
  for (const l of lists) {
    for (let i = 0; i < l.length && qty > 0; i++) {
      const it = l[i];
      if (!it || it.base !== base || it.run) continue;
      const k = Math.min(qty, it.qty);
      it.qty -= k;
      qty -= k;
      if (it.qty <= 0) l[i] = null;
    }
  }
}
