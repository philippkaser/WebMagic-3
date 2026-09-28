import { PLAYER } from "../config";
import { AFFIXES, ITEMS } from "../content";
import type { Element, ItemInstance, Slot, StatBlock, StatKey } from "../content/types";
import type { PlayerStats } from "../sim/entity";
import { focusPower, implicitStats } from "./items";

export type Equipment = Partial<Record<Slot, ItemInstance | null>>;

/** Fold equipment into combat stats. Pure; used by the server (truth) and
 * the client (inventory comparisons). */
export function computeStats(eq: Equipment): PlayerStats {
  const sum: StatBlock = {};
  const add = (k: StatKey, v: number) => (sum[k] = (sum[k] ?? 0) + v);
  const amps: string[] = [];
  for (const item of Object.values(eq)) {
    if (!item) continue;
    for (const [k, v] of Object.entries(implicitStats(item)) as [StatKey, number][]) add(k, v);
    for (const a of item.affixes) {
      const def = AFFIXES.find(a.id);
      if (def) add(def.stat, a.value);
    }
    if (item.amps) amps.push(...item.amps);
  }
  const focus = eq.focus ? ITEMS.get(eq.focus.base) : null;
  const relic = eq.relic ? ITEMS.get(eq.relic.base) : null;
  const pct = (k: StatKey) => (sum[k] ?? 0) / 100;
  const res: Partial<Record<Element, number>> = {
    fire: pct("resFire"),
    frost: pct("resFrost"),
    storm: pct("resStorm"),
    venom: pct("resVenom"),
    void: pct("resVoid"),
    arcane: pct("resArcane"),
  };
  return {
    maxHealth: PLAYER.baseHealth + (sum.maxHealth ?? 0),
    maxMana: PLAYER.baseMana + (sum.maxMana ?? 0),
    healthRegen: sum.healthRegen ?? 0,
    manaRegen: PLAYER.baseManaRegen + (sum.manaRegen ?? 0),
    spellPower: 1 + pct("spellPower"),
    castSpeed: 1 + pct("castSpeed"),
    moveSpeed: 1 + pct("moveSpeed"),
    armor: sum.armor ?? 0,
    res,
    critChance: 0.03 + pct("critChance"),
    critDamage: 1.5 + pct("critDamage"),
    lightRadius: 7 + (sum.lightRadius ?? 0),
    stealth: Math.min(0.6, pct("stealth")),
    luck: 1 + pct("luck"),
    jumpPower: 1 + pct("jumpPower"),
    extraJumps: Math.round(sum.extraJumps ?? 0),
    glide: (sum.glide ?? 0) > 0,
    lifeOnKill: sum.lifeOnKill ?? 0,
    manaOnKill: sum.manaOnKill ?? 0,
    projectileSpeed: 1 + pct("projectileSpeed"),
    extraProjectiles: Math.round(sum.extraProjectiles ?? 0),
    statusChance: pct("statusChance"),
    knockback: 1 + pct("knockback"),
    thorns: sum.thorns ?? 0,
    focusPower: eq.focus ? focusPower(eq.focus) : 1,
    primary: focus?.focus?.primary ?? "bolt",
    secondary: focus?.focus?.secondary ?? "force_blast",
    relic: relic?.relic?.ability ?? null,
    amps,
  };
}
