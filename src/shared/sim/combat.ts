import type { TempContactForceEvent } from "@dimforge/rapier3d-compat";
import { STATUSES, surfaceDef } from "../content";
import { isHostile } from "../content/factions";
import { Surface, type EffectSpec, type Element, type FactionId, type StatusId } from "../content/types";
import { v3dist, v3norm, v3sub, type V3 } from "../util/math";
import { Anim, EntityType, Flag, type Entity } from "./entity";
import type { FloorSim } from "./FloorSim";
import { alertByNoise, killCreature } from "./creatures";
import { breakProp } from "./objects";
import { killPlayer } from "./players";

/** Damage, death, effects and statuses: the rules every body obeys. */

export interface DamageOpts {
  source: number;
  element: Element;
  impulse?: V3;
  crit?: boolean;
  pos?: V3;
  fromStatus?: boolean;
  cause?: string;
}

/** Mass used to convert impulses into a delver's velocity change. */
export const PLAYER_MASS = 80;

const P3 = (v: V3): [number, number, number] => [v.x, v.y, v.z];

/** Resistance of an entity to an element (0..1, negative = weakness). */
export function resistance(e: Entity, el: Element): number {
  if (e.creature) return e.creature.def.stats.res?.[el] ?? 0;
  if (e.player) return e.player.stats.res[el] ?? 0;
  return 0;
}

/** Apply damage. Returns the damage actually dealt. */
export function damage(sim: FloorSim, target: Entity, amount: number, opts: DamageOpts): number {
  if (target.removed || target.maxHp <= 0 || target.hp <= 0 || amount <= 0) return 0;
  const src = sim.get(opts.source);

  if (target.player) {
    const p = target.player;
    if (p.dead || p.invuln > 0) return 0;
    if (src?.player && (p.pactWith.has(src.id) || src.id === target.id) && !opts.fromStatus) {
      // Allies can't hurt each other; self-damage from own blasts is small.
      if (src.id !== target.id) return 0;
      amount *= 0.35;
    }
    if (target.statuses.has("blessed") && target.statuses.get("blessed")!.time > 0 && src?.creature) amount *= 0.6;
  }

  let dmg = amount * (1 - Math.max(-1, Math.min(0.9, resistance(target, opts.element))));
  if (opts.element === "physical") {
    const armor = target.creature?.def.stats.armor ?? (target.player ? target.player.stats.armor : 0);
    dmg = Math.max(dmg * 0.3, dmg - armor * 0.6);
  }
  // Elemental combos.
  if (target.statuses.has("frozen")) {
    dmg *= opts.element === "force" || opts.element === "physical" ? 2 : 1.25;
    if (opts.element === "force" || opts.element === "physical") {
      removeStatus(sim, target, "frozen");
      sim.emit({ t: "fx", fx: "ice_shatter", p: P3(target.pos) });
      sim.emit({ t: "sound", id: "shatter_ice", p: P3(target.pos) });
    }
  }
  if (opts.element === "storm" && target.statuses.has("wet")) dmg *= 1.5;
  if (opts.element === "fire" && target.statuses.has("oiled")) {
    applyStatus(sim, target, "burning", 6, 1.5, opts.source);
  }
  for (const [sid] of target.statuses) {
    const m = STATUSES.find(sid)?.damageTakenMult;
    if (m && sid !== "frozen") dmg *= m;
  }
  if (opts.crit) dmg *= src?.player?.stats.critDamage ?? 1.5;
  dmg = Math.round(dmg * 10) / 10;
  if (dmg <= 0) return 0;

  target.hp = Math.max(0, target.hp - dmg);
  sim.touch(target);
  if (!opts.fromStatus || dmg >= 3) {
    sim.emit({ t: "hit", id: target.id, amt: dmg, el: opts.element, crit: !!opts.crit, p: P3(opts.pos ?? target.pos), by: opts.source });
  }

  if (opts.impulse) knock(sim, target, opts.impulse);

  if (target.creature) {
    const c = target.creature;
    if (src && src.id !== target.id) {
      c.grudges.set(src.id, (c.grudges.get(src.id) ?? 0) + dmg);
      c.lastSeen = { id: src.id, pos: { ...src.pos }, time: sim.time };
    }
    if (!opts.fromStatus && dmg >= target.maxHp * 0.12 && !target.creature.warden) {
      c.stagger = Math.max(c.stagger, 0.25 + Math.min(0.4, dmg / target.maxHp));
      c.attack = null;
      sim.setAnim(target, Anim.Hurt);
    }
  }
  if (target.player) {
    target.player.lastDamagedBy = opts.source;
    if (src?.player && src.id !== target.id && src.player.pactWith.has(target.id)) breakPact(sim, src);
  }
  // Thorns.
  if (target.player && src?.creature && target.player.stats.thorns > 0 && !opts.fromStatus && v3dist(src.pos, target.pos) < 3) {
    damage(sim, src, target.player.stats.thorns, { source: target.id, element: "physical" });
  }

  if (target.hp <= 0) kill(sim, target, opts.source, opts.cause ?? opts.element);
  return dmg;
}

/** Apply a physical shove (impulse in N·s). */
export function knock(sim: FloorSim, e: Entity, impulse: V3): void {
  if (e.player) {
    // Delvers move client-side: the shove is sent as a velocity change.
    e.player.pendingImpulse.x += impulse.x / PLAYER_MASS;
    e.player.pendingImpulse.y += impulse.y / PLAYER_MASS;
    e.player.pendingImpulse.z += impulse.z / PLAYER_MASS;
    return;
  }
  if (!e.body || !e.body.isDynamic()) return;
  e.body.applyImpulse(impulse, true);
  if (e.creature && Math.hypot(impulse.x, impulse.y, impulse.z) / Math.max(e.mass, 1) > 3) {
    e.creature.stagger = Math.max(e.creature.stagger, 0.35);
    sim.setAnim(e, Anim.Stagger);
  }
}

function kill(sim: FloorSim, e: Entity, killer: number, cause: string): void {
  if (e.creature) killCreature(sim, e, killer);
  else if (e.prop) breakProp(sim, e, killer);
  else if (e.player) killPlayer(sim, e, killer, cause);
  const k = sim.get(killer);
  if (k?.player && e.type === EntityType.Creature) {
    const st = k.player.stats;
    if (st.lifeOnKill > 0) heal(sim, k, st.lifeOnKill);
    if (st.manaOnKill > 0) k.player.mana = Math.min(k.player.maxMana, k.player.mana + st.manaOnKill);
    k.player.kills++;
  }
}

export function heal(sim: FloorSim, e: Entity, amount: number): void {
  if (e.hp <= 0 || e.maxHp <= 0) return;
  const before = e.hp;
  e.hp = Math.min(e.maxHp, e.hp + amount);
  if (e.hp !== before) sim.touch(e);
}

function breakPact(sim: FloorSim, oathbreaker: Entity): void {
  const p = oathbreaker.player!;
  for (const other of p.pactWith) {
    const o = sim.get(other);
    o?.player?.pactWith.delete(oathbreaker.id);
    sim.emit({ t: "msg", to: other, text: `${p.name} broke the pact.`, kind: "warn" });
  }
  p.pactWith.clear();
  p.oathbroken = true;
  sim.setFlag(oathbreaker, Flag.Oathbroken, true);
  sim.emit({ t: "sound", id: "oath_broken", p: [oathbreaker.pos.x, oathbreaker.pos.y, oathbreaker.pos.z] });
}

// ── Statuses ─────────────────────────────────────────────────────────────────

export function applyStatus(sim: FloorSim, e: Entity, id: StatusId, duration: number | undefined, power: number, source: number): void {
  if (e.removed || (e.maxHp <= 0 && !e.prop)) return;
  if (e.creature?.def.immune?.includes(id)) return;
  const def = STATUSES.get(id);
  // Wet douses fire instead of both existing.
  if (id === "burning" && e.statuses.has("wet")) {
    removeStatus(sim, e, "wet");
    sim.emit({ t: "fx", fx: "steam", p: P3(e.pos) });
    return;
  }
  for (const combo of def.combos ?? []) {
    if (e.statuses.has(combo.when)) {
      removeStatus(sim, e, combo.when);
      applyStatus(sim, e, combo.into, undefined, power, source);
      return;
    }
  }
  for (const r of def.removes ?? []) removeStatus(sim, e, r);
  const cur = e.statuses.get(id);
  const time = duration ?? def.duration;
  if (cur) {
    cur.time = Math.max(cur.time, time);
    cur.power = Math.max(cur.power, power);
    return;
  }
  e.statuses.set(id, { time, power, source });
  if (id === "burning") sim.setFlag(e, Flag.Burning, true);
  sim.touch(e);
  sim.emit({ t: "status", id: e.id, status: id });
  if (id === "frozen" && e.creature) e.creature.attack = null;
}

export function removeStatus(sim: FloorSim, e: Entity, id: StatusId): void {
  if (!e.statuses.delete(id)) return;
  if (id === "burning") sim.setFlag(e, Flag.Burning, false);
  sim.touch(e);
}

export function tickStatuses(sim: FloorSim, dt: number): void {
  for (const type of [EntityType.Player, EntityType.Creature, EntityType.Prop]) {
    for (const e of sim.list(type)) {
      if (e.statuses.size === 0 || e.removed) continue;
      for (const [id, st] of e.statuses) {
        st.time -= dt;
        const def = STATUSES.get(id);
        if (def.dps && e.hp > 0) {
          if (def.dps < 0) heal(sim, e, -def.dps * dt);
          else damage(sim, e, def.dps * st.power * dt * (e.prop ? 3 : 1), { source: st.source, element: def.element ?? "physical", fromStatus: true, cause: id });
        }
        if (id === "burning") spreadFireFrom(sim, e);
        if (st.time <= 0) removeStatus(sim, e, id);
      }
    }
  }
  updateFields(sim, dt);
}

/** A burning body sets fire to what it touches: flammable floor surfaces
 * under it and flammable props/creatures right next to it. */
function spreadFireFrom(sim: FloorSim, e: Entity): void {
  if (sim.tick % 5 !== e.id % 5) return;
  const under = sim.surfaces.at(e.pos.x, e.pos.z);
  if (under !== Surface.None && surfaceDef(under).flammable) sim.surfaces.paint(e.pos.x, e.pos.z, 0.5, Surface.Fire);
  for (const o of sim.bodiesNear(e.pos, 0.6)) {
    if (o === e || o.statuses.has("burning")) continue;
    const flammable = o.prop?.def.flammable || o.creature?.def.flammable || o.statuses.has("oiled");
    if (flammable && sim.rng.chance(0.25)) applyStatus(sim, o, "burning", undefined, 1, e.statuses.get("burning")!.source);
  }
}

// ── Floor surfaces under bodies ─────────────────────────────────────────────

/** Surface kind and pool depth under an entity's feet. */
export function footing(sim: FloorSim, e: Entity): { surface: Surface; wading: boolean } {
  const feet = e.pos.y - e.height / 2;
  const g = sim.layout.grid;
  const cx = Math.floor(e.pos.x);
  const cz = Math.floor(e.pos.z);
  const inGrid = cx >= 0 && cz >= 0 && cx < g.w && cz < g.h;
  const i = inGrid ? cz * g.w + cx : 0;
  const onGround = inGrid && feet - g.floor[i] < 0.35;
  const wading = inGrid && g.liquid[i] !== 0 && feet < g.liquidLevel[i];
  return { surface: onGround || wading ? sim.surfaces.at(e.pos.x, e.pos.z) : Surface.None, wading };
}

export function updateSurfaceContact(sim: FloorSim, dt: number): void {
  if (sim.tick % 3 !== 0) return;
  const step = dt * 3;
  for (const type of [EntityType.Player, EntityType.Creature]) {
    for (const e of sim.list(type)) {
      if (e.hp <= 0 || e.creature?.def.movement === "fly" || e.creature?.def.movement === "hover") continue;
      const { surface } = footing(sim, e);
      if (surface === Surface.None) continue;
      const def = surfaceDef(surface);
      if (def.applies) applyStatus(sim, e, def.applies, Math.max(1.5, STATUSES.get(def.applies).duration * 0.5), 1, 0);
      if (def.dps) damage(sim, e, def.dps * step, { source: 0, element: def.dpsElement ?? "physical", fromStatus: true, cause: def.id });
      if (surface === Surface.Water && sim.surfaces.chargedAt(e.pos.x, e.pos.z)) {
        damage(sim, e, 14 * step, { source: 0, element: "storm", fromStatus: true, cause: "lightning" });
        applyStatus(sim, e, "shocked", 0.6, 1, 0);
      }
    }
  }
}

// ── Physical impacts ────────────────────────────────────────────────────────

/** Hard contacts hurt: bodies slammed into walls, thrown barrels, falling
 * crates. Driven by Rapier contact-force events. */
export function applyContactForces(sim: FloorSim, ev: TempContactForceEvent): void {
  const a = sim.byCollider.get(ev.collider1());
  const b = sim.byCollider.get(ev.collider2());
  const force = ev.totalForceMagnitude();
  for (const [e, other] of [
    [a, b],
    [b, a],
  ] as const) {
    if (!e || e.removed || e.maxHp <= 0) continue;
    const accel = force / Math.max(1, e.mass);
    // Thrown props hurt what they hit.
    if (other?.prop && other.prop.thrownBy && sim.time - other.prop.thrownTime < 2.5 && e !== other) {
      const speed = Math.hypot(other.vel.x, other.vel.y, other.vel.z);
      if (speed > 4) {
        damage(sim, e, other.mass * speed * 0.05, { source: other.prop.thrownBy, element: "physical", pos: other.pos, cause: "thrown" });
        if (other.prop.def.hp) damage(sim, other, other.prop.def.hp, { source: other.prop.thrownBy, element: "physical" });
        continue;
      }
    }
    const threshold = e.prop ? 900 : 1400;
    if (accel > threshold) {
      const dmg = (accel - threshold) * (e.prop ? 0.02 : 0.006);
      if (dmg >= 1) damage(sim, e, dmg, { source: e.creature?.grudges.keys().next().value ?? 0, element: "physical", cause: "impact" });
    }
  }
}

// ── Force fields (singularities, magnetic impacts) ─────────────────────────

export interface ForceField {
  pos: V3;
  radius: number;
  strength: number;
  time: number;
  source: number;
}

const fieldsOf = new WeakMap<FloorSim, ForceField[]>();

export function addField(sim: FloorSim, f: ForceField): void {
  let l = fieldsOf.get(sim);
  if (!l) fieldsOf.set(sim, (l = []));
  l.push(f);
  sim.emit({ t: "fx", fx: "singularity", p: P3(f.pos), s: f.radius });
}

function updateFields(sim: FloorSim, dt: number): void {
  const l = fieldsOf.get(sim);
  if (!l?.length) return;
  for (const f of l) {
    f.time -= dt;
    for (const e of sim.bodiesNear(f.pos, f.radius)) {
      const d = v3sub(f.pos, e.pos);
      const dist = Math.max(0.4, Math.hypot(d.x, d.y, d.z));
      const k = (f.strength * (1 - dist / f.radius) * dt) / 1;
      const imp = { x: (d.x / dist) * k * Math.max(e.mass, 1) * 0.35, y: (d.y / dist + 0.15) * k * Math.max(e.mass, 1) * 0.35, z: (d.z / dist) * k * Math.max(e.mass, 1) * 0.35 };
      knock(sim, e, imp);
    }
  }
  fieldsOf.set(
    sim,
    l.filter((f) => f.time > 0),
  );
}

// ── Effects ──────────────────────────────────────────────────────────────────

export interface EffectContext {
  pos: V3;
  source: number;
  sourceTeam: FactionId;
  target?: Entity;
  /** Damage multiplier (spell power × item power × floor scale for creatures). */
  power: number;
  /** Direction of travel (impulses push along it). */
  dir?: V3;
  /** Element override (amplifier conversion). */
  element?: Element;
  statusBonus?: number;
  critChance?: number;
  knockback?: number;
  /** Ids to exclude from area effects (e.g. the caster for nova). */
  exclude?: number;
}

export function runEffects(sim: FloorSim, effects: readonly EffectSpec[], ctx: EffectContext): void {
  for (const fx of effects) runEffect(sim, fx, ctx);
}

function isFoe(sim: FloorSim, team: FactionId, e: Entity, source: number): boolean {
  if (e.id === source) return false;
  if (e.type === EntityType.Prop) return true;
  if (team === "delvers") {
    if (e.player) {
      const src = sim.get(source);
      return !src?.player?.pactWith.has(e.id);
    }
    return !(e.flags & Flag.Helper);
  }
  return e.team !== team || isHostile(team, e.team);
}

function runEffect(sim: FloorSim, fx: EffectSpec, ctx: EffectContext): void {
  const el = (e: Element) => (ctx.element && e !== "force" ? ctx.element : e);
  switch (fx.type) {
    case "damage": {
      if (!ctx.target) return;
      const crit = sim.rng.chance(ctx.critChance ?? 0);
      damage(sim, ctx.target, fx.amount * ctx.power, { source: ctx.source, element: el(fx.element), crit, pos: ctx.pos });
      return;
    }
    case "explode": {
      explode(sim, ctx.pos, fx.radius, fx.damage * ctx.power, el(fx.element), fx.impulse * (ctx.knockback ?? 1), ctx.source, ctx.sourceTeam, fx.friendlyFactor ?? 1, ctx.exclude);
      return;
    }
    case "impulse": {
      const t = ctx.target;
      if (!t || !ctx.dir) return;
      const s = fx.strength * (ctx.knockback ?? 1) * Math.max(1, Math.min(t.mass, 120)) * 0.08;
      knock(sim, t, { x: ctx.dir.x * s, y: (ctx.dir.y + (fx.up ?? 0.2)) * s, z: ctx.dir.z * s });
      return;
    }
    case "status": {
      if (!ctx.target) return;
      if (sim.rng.next() > (fx.chance ?? 1) + (ctx.statusBonus ?? 0)) return;
      applyStatus(sim, ctx.target, fx.status, fx.duration, ctx.power, ctx.source);
      return;
    }
    case "surface": {
      sim.surfaces.paint(ctx.pos.x, ctx.pos.z, fx.radius, fx.surface);
      return;
    }
    case "pull":
      addField(sim, { pos: { ...ctx.pos }, radius: fx.radius, strength: fx.strength, time: fx.duration, source: ctx.source });
      return;
    case "chain": {
      const from = ctx.target ?? null;
      const pts: number[] = [ctx.pos.x, ctx.pos.y, ctx.pos.z];
      const hit = new Set<number>([from?.id ?? -1, ctx.source]);
      let cur = ctx.pos;
      for (let k = 0; k < fx.count; k++) {
        let best: Entity | null = null;
        let bestD = fx.range;
        for (const type of [EntityType.Creature, EntityType.Player]) {
          for (const e of sim.list(type)) {
            if (hit.has(e.id) || e.hp <= 0 || !isFoe(sim, ctx.sourceTeam, e, ctx.source)) continue;
            // Wet things conduct further.
            const d = v3dist(e.pos, cur) * (e.statuses.has("wet") ? 0.6 : 1);
            if (d < bestD && sim.lineOfSight(cur, e.pos)) {
              bestD = d;
              best = e;
            }
          }
        }
        if (!best) break;
        hit.add(best.id);
        damage(sim, best, fx.damage * ctx.power, { source: ctx.source, element: el(fx.element), pos: best.pos });
        pts.push(best.pos.x, best.pos.y + best.height * 0.2, best.pos.z);
        cur = best.pos;
      }
      if (pts.length > 3) sim.emit({ t: "chain", pts, el: el(fx.element) });
      if (el(fx.element) === "storm") sim.surfaces.react(ctx.pos.x, ctx.pos.z, 0.8, "storm");
      return;
    }
    case "heal":
      if (ctx.target) heal(sim, ctx.target, fx.amount);
      return;
    case "mana":
      if (ctx.target?.player) ctx.target.player.mana = Math.min(ctx.target.player.maxMana, ctx.target.player.mana + fx.amount);
      return;
    case "noise":
      alertByNoise(sim, ctx.pos, fx.loudness, ctx.source);
      return;
    case "fx":
      sim.emit({ t: "fx", fx: fx.fx, p: P3(ctx.pos) });
      return;
    case "light":
      sim.emit({ t: "fx", fx: "light", p: P3(ctx.pos), c: fx.color, s: fx.radius });
      return;
    case "spawn":
    case "teleport":
      // Handled by spell/creature code that owns the context.
      return;
  }
}

/** Radial damage + shove, blocked by walls, reacting with surfaces. */
export function explode(
  sim: FloorSim,
  pos: V3,
  radius: number,
  dmg: number,
  element: Element,
  impulse: number,
  source: number,
  team: FactionId,
  friendlyFactor = 1,
  exclude?: number,
): void {
  sim.emit({ t: "explode", p: P3(pos), r: radius, el: element });
  sim.emit({ t: "shake", p: P3(pos), amount: Math.min(1, radius / 5) });
  const probe = { x: pos.x, y: pos.y + 0.2, z: pos.z };
  for (const e of sim.bodiesNear(pos, radius)) {
    if (e.id === exclude) continue;
    const center = { x: e.pos.x, y: e.pos.y, z: e.pos.z };
    if (!sim.lineOfSight(probe, center)) continue;
    const d = v3dist(pos, center);
    const fall = Math.max(0, 1 - d / (radius + e.radius));
    const foe = isFoe(sim, team, e, source) || e.id === source;
    const k = foe ? 1 : friendlyFactor;
    const dir = v3norm(v3sub(center, pos));
    const shove = impulse * fall * Math.min(Math.max(e.mass, 4), 150) * 0.12;
    if (dmg > 0 && k > 0) {
      damage(sim, e, dmg * fall * k, {
        source,
        element,
        impulse: { x: dir.x * shove, y: (dir.y + 0.45) * shove, z: dir.z * shove },
        pos: center,
        cause: "explosion",
      });
    } else if (shove > 0) {
      knock(sim, e, { x: dir.x * shove, y: (dir.y + 0.45) * shove, z: dir.z * shove });
    }
    if (element === "fire" && (e.prop?.def.flammable || e.statuses.has("oiled")) && fall > 0.2) applyStatus(sim, e, "burning", undefined, 1, source);
  }
  sim.surfaces.react(pos.x, pos.z, radius * 0.7, element);
  if (element === "fire") {
    // Explosions light nearby flammable surfaces directly.
    sim.surfaces.forDisc(pos.x, pos.z, radius * 0.5, (x, z, i) => {
      const k = sim.surfaces.kind[i] as Surface;
      if (k !== Surface.None && surfaceDef(k).flammable) sim.surfaces.paint((x + 0.5) / 2, (z + 0.5) / 2, 0.3, Surface.Fire);
    });
  }
  alertByNoise(sim, pos, 10 + radius * 5, source);
}
