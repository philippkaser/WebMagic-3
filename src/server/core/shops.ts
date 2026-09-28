import { ITEMS } from "../../shared/content";
import { APOTHECARY_STOCK, COSMETICS, GAMBLE_TIERS, KITS, RECIPES } from "../../shared/content/shops";
import type { ItemInstance, Slot } from "../../shared/content/types";
import { SLOTS } from "../../shared/content/types";
import { basesDroppingOn, makeStack, rollGear, rollIlvl, rollRarity, itemValue, isGear } from "../../shared/game/items";
import { emptyEquipment, gearLevel } from "../../shared/game/rules";
import type { ShopOp } from "../../shared/net/protocol";
import type { Rng } from "../../shared/util/rng";
import type { Account } from "./account";
import { addToBag, consume, countOf, getAt, takeItem } from "./inventory";

/** Village transactions. Pure functions over an Account; each returns an
 * error string or null, mutating only on success. */

export function shopOp(a: Account, op: ShopOp, rng: Rng): string | null {
  switch (op.op) {
    case "buy": {
      const entry = APOTHECARY_STOCK.find((s) => s.item === op.item);
      if (!entry) return "Not for sale.";
      if ((entry.minDeepest ?? 0) > a.stats.deepest) return "Mother Sallow doesn't sell that to someone who hasn't been down far enough.";
      const qty = Math.max(1, Math.min(10, Math.floor(op.qty ?? 1)));
      const cost = entry.price * qty;
      if (a.gold < cost) return "Not enough gold.";
      const item = makeStack(entry.item, qty);
      if (!addToBag(a, item)) return "Your pack is full.";
      a.gold -= cost;
      return null;
    }
    case "sell": {
      const it = getAt(a, op.from);
      if (!it) return "Nothing there.";
      if (it.kit) return "That belongs to Old Hask.";
      if (op.from.in === "equip" && op.from.slot === "focus") return "You'd sell your only focus?";
      const value = Math.max(1, Math.floor(itemValue(it) * 0.3));
      takeItem(a, op.from);
      a.gold += value;
      return null;
    }
    case "gamble": {
      const tier = GAMBLE_TIERS[op.tier];
      if (!tier) return "No such wager.";
      if (a.gold < tier.price) return "Not enough gold.";
      a.gold -= tier.price;
      const gl = Math.max(1, gearLevel(a.equipment));
      const floor = Math.max(1, Math.round(gl + tier.ilvlBonus));
      a.gambleOffers = [0, 1, 2].map(() => {
        const pool = basesDroppingOn(floor, "gear");
        const base = rng.weighted(pool, (b) => b.weight);
        return rollGear(rng, base, rollIlvl(rng, floor), rollRarity(rng, floor, tier.rarityLuck));
      });
      return null;
    }
    case "gamble_pick": {
      const offers = a.gambleOffers;
      if (!offers || !offers[op.index]) return "Nothing on the table.";
      const item = offers[op.index];
      if (!addToBag(a, item)) return "Your pack is full.";
      a.gambleOffers = undefined;
      return null;
    }
    case "kit": {
      const kit = KITS.find((k) => k.id === op.kit);
      if (!kit) return "Hask doesn't have that one.";
      if (a.heldGear) return "You're already wearing one of Hask's kits.";
      if (a.gold < kit.price) return "Not enough gold.";
      a.gold -= kit.price;
      a.heldGear = { ...a.equipment };
      const eq = emptyEquipment();
      for (const k of kit.items) {
        const base = ITEMS.get(k.base);
        const item = rollGear(rng, base, kit.gearLevel, k.rarity);
        item.kit = true;
        eq[base.slot!] = item;
      }
      a.equipment = eq;
      return null;
    }
    case "craft": {
      const r = RECIPES.find((x) => x.id === op.recipe);
      if (!r) return "Brannoc squints at you.";
      if (a.gold < r.gold) return "Not enough gold.";
      for (const m of r.materials) if (countOf(a, m.id, true) < m.qty) return `You need ${m.qty}× ${ITEMS.get(m.id).name}.`;
      if (r.kind === "craft") {
        const out = makeStack(r.output!.base, r.output!.qty);
        if (!addToBag(a, out)) return "Your pack is full.";
      } else {
        if (!op.target) return "Put the item on the bench first.";
        const it = getAt(a, op.target);
        if (!it || !isGear(it)) return "That can't be worked.";
        if (it.kit) return "Hask would notice.";
        if (r.kind === "upgrade") {
          if ((it.upgrade ?? 0) >= 5) return "It won't take any more.";
          it.upgrade = (it.upgrade ?? 0) + 1;
        } else if (r.kind === "reforge") {
          const fresh = rollGear(rng, ITEMS.get(it.base), it.ilvl, it.rarity);
          it.affixes = fresh.affixes;
          it.amps = fresh.amps;
        }
      }
      a.gold -= r.gold;
      for (const m of r.materials) consume(a, m.id, m.qty, true);
      return null;
    }
    case "cosmetic_buy": {
      const c = COSMETICS.find((x) => x.id === op.id);
      if (!c) return "Pell has never heard of it.";
      if (a.cosmetics.owned.includes(c.id)) return "You already own that.";
      if (c.secret && !a.secrets.includes(c.secret)) return "Pell smiles and says nothing.";
      if (a.gold < c.price) return "Not enough gold.";
      a.gold -= c.price;
      a.cosmetics.owned.push(c.id);
      a.cosmetics.equipped[c.kind] = c.id;
      return null;
    }
    case "cosmetic_equip": {
      if (op.id === null) {
        delete a.cosmetics.equipped[op.kind];
        return null;
      }
      const c = COSMETICS.find((x) => x.id === op.id);
      if (!c || !a.cosmetics.owned.includes(c.id)) return "You don't own that.";
      a.cosmetics.equipped[c.kind] = c.id;
      return null;
    }
  }
}

/** End of a kitted run: give Hask his gear back, restore the delver's own.
 * Anything non-kit that was equipped mid-run goes to the bag. */
export function returnKit(a: Account): void {
  if (!a.heldGear) return;
  const overflow: ItemInstance[] = [];
  for (const s of SLOTS as readonly Slot[]) {
    const cur = a.equipment[s];
    if (cur && !cur.kit) overflow.push(cur);
  }
  a.equipment = a.heldGear;
  a.heldGear = null;
  for (const list of [a.bag, a.belt]) for (let i = 0; i < list.length; i++) if (list[i]?.kit) list[i] = null;
  for (const it of overflow) {
    if (addToBag(a, it)) continue;
    const free = a.stash.indexOf(null);
    if (free >= 0) a.stash[free] = it;
  }
}

export { makeStack };
