import type { Collider } from "@dimforge/rapier3d-compat";
import { GRAVITY } from "../config";
import { AMPLIFIERS } from "../content";
import type { AmpEffect, EffectSpec, Element, FactionId, SpellDef } from "../content/types";
import { dirFromAngles, v3dist, v3norm, v3sub, type V3 } from "../util/math";
import { applyStatus, explode, heal, runEffects, addField, type EffectContext } from "./combat";
import { alertByNoise } from "./creatures";
import { Anim, EntityType, type Entity, type ProjectileState } from "./entity";
import type { FloorSim } from "./FloorSim";
import { GROUPS, RAPIER } from "./physics";

/** Spell execution: every delivery kind, and the amplifier system that
 * rewrites deliveries (DESIGN.md §5.2.1). Players, creatures, traps and
 * thrown flasks all cast through here. */

export interface CastOptions {
  caster: Entity | null;
  team: FactionId;
  spell: SpellDef;
  origin: V3;
  dir: V3;
  castId: number;
  /** Damage multiplier. */
  power: number;
  amps?: AmpEffect[];
  critChance?: number;
  statusBonus?: number;
  knockback?: number;
  speedMult?: number;
  extraProjectiles?: number;
  /** Echoed casts don't echo again. */
  echo?: boolean;
}

const P3 = (v: V3): [number, number, number] => [v.x, v.y, v.z];

export function ampsOf(ids: readonly string[]): AmpEffect[] {
  const out: AmpEffect[] = [];
  for (const id of ids) {
    const a = AMPLIFIERS.find(id);
    if (a) out.push(a.effect);
  }
  return out;
}

/** Base damage figure of a spell (for amplifier-derived effects). */
function baseDamage(effects: readonly EffectSpec[]): number {
  let d = 0;
  for (const e of effects) {
    if (e.type === "damage") d += e.amount;
    else if (e.type === "explode") d += e.damage;
  }
  return d || 8;
}

export function castSpell(sim: FloorSim, o: CastOptions): void {
  const { spell } = o;
  const amps = o.amps ?? [];
  const convert = amps.find((a) => a.type === "convert") as Extract<AmpEffect, { type: "convert" }> | undefined;
  const element: Element = convert && spell.element !== "force" ? convert.element : spell.element;
  const casterId = o.caster?.id ?? 0;
  sim.emit({ t: "cast", by: casterId, spell: spell.id, p: P3(o.origin), d: P3(o.dir), castId: o.castId });
  if (spell.noise > 0) alertByNoise(sim, o.origin, spell.noise, casterId);

  const ctxBase = (pos: V3, target?: Entity): EffectContext => ({
    pos,
    target,
    source: casterId,
    sourceTeam: o.team,
    power: o.power,
    dir: o.dir,
    element: convert ? element : undefined,
    statusBonus: o.statusBonus,
    critChance: o.critChance,
    knockback: o.knockback,
  });

  const d = spell.delivery;
  switch (d.kind) {
    case "projectile": {
      let count = (d.count ?? 1) + (o.extraProjectiles ?? 0);
      for (const a of amps) if (a.type === "projectiles") count += a.count;
      const spread = ((d.spread ?? 0) + (count > 1 && !d.spread ? 4 : 0)) * (Math.PI / 180);
      const yaw = Math.atan2(-o.dir.x, -o.dir.z);
      const pitch = Math.asin(Math.max(-1, Math.min(1, o.dir.y)));
      for (let k = 0; k < count; k++) {
        const off = count === 1 ? 0 : (k / (count - 1) - 0.5) * 2 * spread;
        const jitter = d.spread ? (sim.rng.next() - 0.5) * spread * 0.5 : 0;
        const dir = dirFromAngles(yaw + off + jitter, pitch + (d.spread ? (sim.rng.next() - 0.5) * spread * 0.4 : 0));
        spawnProjectile(sim, o, element, dir, amps, false);
      }
      break;
    }
    case "beam":
      beam(sim, o, element);
      break;
    case "cone": {
      const cosA = Math.cos((d.angle * Math.PI) / 180);
      for (const e of sim.bodiesNear(o.origin, d.range)) {
        if (e.id === casterId) continue;
        const to = v3norm(v3sub(e.pos, o.origin));
        if (to.x * o.dir.x + to.y * o.dir.y + to.z * o.dir.z < cosA) continue;
        if (!sim.lineOfSight(o.origin, e.pos)) continue;
        runEffects(sim, d.onHit, { ...ctxBase(e.pos, e), dir: to });
      }
      sim.surfaces.react(o.origin.x + o.dir.x * d.range * 0.5, o.origin.z + o.dir.z * d.range * 0.5, d.range * 0.4, element);
      break;
    }
    case "nova": {
      const center = o.caster ? { x: o.caster.pos.x, y: o.caster.pos.y, z: o.caster.pos.z } : o.origin;
      sim.emit({ t: "explode", p: P3(center), r: d.radius, el: element });
      for (const e of sim.bodiesNear(center, d.radius)) {
        if (e.id === casterId || !sim.lineOfSight(center, e.pos)) continue;
        runEffects(sim, d.onHit.filter((f) => f.type !== "surface"), { ...ctxBase(e.pos, e), dir: v3norm(v3sub(e.pos, center)) });
      }
      runEffects(
        sim,
        d.onHit.filter((f) => f.type === "surface"),
        ctxBase(center),
      );
      sim.surfaces.react(center.x, center.z, d.radius, element);
      break;
    }
    case "self": {
      const pos = o.caster?.pos ?? o.origin;
      runEffects(sim, d.effects, { ...ctxBase({ ...pos }, o.caster ?? undefined), exclude: casterId });
      break;
    }
    case "summon":
    case "wall":
    case "dash":
    case "grasp":
      // Owned by the caster's system (players.ts / creatures.ts).
      break;
  }

  const echo = amps.find((a) => a.type === "echo") as Extract<AmpEffect, { type: "echo" }> | undefined;
  if (echo && !o.echo && d.kind === "projectile") {
    sim.later(echo.delay, () => {
      if (o.caster && (o.caster.removed || o.caster.hp <= 0)) return;
      const origin = o.caster?.player ? eyeOf(o.caster) : o.origin;
      const dir = o.caster?.player ? dirFromAngles(o.caster.player.input.yaw, o.caster.player.input.pitch) : o.dir;
      castSpell(sim, { ...o, origin, dir, echo: true, castId: 0 });
    });
  }
}

export function eyeOf(e: Entity): V3 {
  return { x: e.pos.x, y: e.pos.y + e.height * 0.36, z: e.pos.z };
}

function spawnProjectile(sim: FloorSim, o: CastOptions, element: Element, dir: V3, amps: AmpEffect[], isChild: boolean, overrides?: Partial<ProjectileState> & { origin?: V3; speedScale?: number }): Entity {
  const d = o.spell.delivery as Extract<SpellDef["delivery"], { kind: "projectile" }>;
  let speed = d.speed * (o.speedMult ?? 1) * (overrides?.speedScale ?? 1);
  let radius = d.radius;
  let gravity = d.gravity;
  let bounces = d.bounces ?? 0;
  let pierce = d.pierce ?? 0;
  let homing = d.homing ?? 0;
  let split: ProjectileState["split"] = null;
  let volatile = 0;
  let chain: ProjectileState["chain"] = null;
  let trail = 0;
  let heavy = false;
  let magnetic = 0;
  let fuse = 0;
  let vampiric = 0;
  let orbit = 0;
  for (const a of amps) {
    switch (a.type) {
      case "speed":
        speed *= a.mult;
        break;
      case "size":
        radius *= a.mult;
        break;
      case "bounces":
        bounces += a.count;
        break;
      case "pierce":
        pierce += a.count;
        break;
      case "homing":
        homing += a.turn;
        break;
      case "split":
        if (!isChild) split = { count: a.count, damage: a.damage };
        break;
      case "volatile":
        volatile = Math.max(volatile, a.radius);
        break;
      case "chain":
        chain = { count: a.count, range: a.range };
        break;
      case "trail":
        trail = a.surface;
        break;
      case "heavy":
        heavy = true;
        gravity = Math.max(gravity, 0.9);
        radius *= 1.25;
        break;
      case "magnetic":
        magnetic = a.strength;
        break;
      case "timed":
        fuse = a.fuse;
        break;
      case "vampiric":
        vampiric += a.fraction;
        break;
      case "orbit":
        if (!isChild) orbit = a.duration;
        break;
    }
  }
  const origin = overrides?.origin ?? o.origin;
  const e = sim.newEntity(EntityType.Projectile, o.spell.id, origin, o.team);
  e.radius = radius;
  e.height = radius * 2;
  e.vel = { x: dir.x * speed, y: dir.y * speed, z: dir.z * speed };
  e.yaw = Math.atan2(-dir.x, -dir.z);
  e.projectile = {
    spell: o.spell,
    owner: o.caster?.id ?? 0,
    ownerTeam: o.team,
    castId: o.castId,
    element,
    damageMult: o.power * (overrides?.damageMult ?? 1),
    radius,
    gravity,
    life: d.lifetime * (orbit ? 1 + orbit / d.lifetime : 1),
    bounces,
    pierce,
    homing,
    hitIds: new Set(),
    split,
    volatile,
    chain,
    trail,
    trailAcc: 0,
    heavy,
    magnetic,
    fuse,
    stuck: false,
    vampiric,
    orbit,
    orbitAngle: Math.atan2(dir.x, dir.z),
    isChild,
    cast: o,
  };
  return e;
}

const ballCache = new Map<number, InstanceType<typeof RAPIER.Ball>>();
function ball(r: number) {
  const key = Math.round(r * 100);
  let b = ballCache.get(key);
  if (!b) ballCache.set(key, (b = new RAPIER.Ball(key / 100)));
  return b;
}
const ROT = { x: 0, y: 0, z: 0, w: 1 };

export function updateProjectiles(sim: FloorSim, dt: number): void {
  for (const e of sim.list(EntityType.Projectile)) {
    if (e.removed) continue;
    const p = e.projectile!;
    const o = p.cast;
    p.life -= dt;

    if (p.stuck) {
      p.fuse -= dt;
      if (p.fuse <= 0) impact(sim, e, o, null, e.pos, { x: 0, y: 1, z: 0 });
      continue;
    }

    if (p.orbit > 0) {
      // Circle the caster, then fly out along their current aim.
      const caster = sim.get(p.owner);
      p.orbit -= dt;
      if (caster && p.orbit > 0) {
        p.orbitAngle += dt * 7;
        const r = 1.2;
        e.pos = { x: caster.pos.x + Math.sin(p.orbitAngle) * r, y: caster.pos.y + 0.3, z: caster.pos.z + Math.cos(p.orbitAngle) * r };
        sim.touch(e);
        continue;
      }
      if (caster?.player) {
        const dir = dirFromAngles(caster.player.input.yaw, caster.player.input.pitch);
        const sp = Math.hypot(e.vel.x, e.vel.y, e.vel.z);
        e.vel = { x: dir.x * sp, y: dir.y * sp, z: dir.z * sp };
      }
      p.orbit = 0;
    }

    if (p.homing > 0) steerHoming(sim, e, p, dt);
    e.vel.y += GRAVITY * p.gravity * dt;

    const hit = sim.world.castShape(
      e.pos,
      ROT,
      e.vel,
      ball(p.radius),
      0,
      dt,
      true,
      undefined,
      GROUPS.queryAll,
      undefined,
      undefined,
      (c: Collider) => {
        const t = sim.entityOfCollider(c);
        if (!t) return true;
        if (t.id === p.owner && p.life > (o.spell.delivery as { lifetime: number }).lifetime - 0.25) return false;
        if (t.id === p.owner && t.player) return false;
        if (p.hitIds.has(t.id)) return false;
        if (t.creature && t.hp <= 0) return false;
        return true;
      },
    );

    if (hit) {
      const toi = hit.time_of_impact;
      const pos = { x: e.pos.x + e.vel.x * toi, y: e.pos.y + e.vel.y * toi, z: e.pos.z + e.vel.z * toi };
      const n = hit.normal1;
      const target = sim.entityOfCollider(hit.collider);
      if (target) {
        if (p.pierce > 0) {
          p.pierce--;
          p.hitIds.add(target.id);
          applyHit(sim, e, o, target, pos);
          e.pos = { x: pos.x + e.vel.x * dt * 0.3, y: pos.y + e.vel.y * dt * 0.3, z: pos.z + e.vel.z * dt * 0.3 };
          sim.touch(e);
          continue;
        }
        impact(sim, e, o, target, pos, n);
        continue;
      }
      if (p.bounces > 0) {
        p.bounces--;
        const dot = e.vel.x * n.x + e.vel.y * n.y + e.vel.z * n.z;
        e.vel = { x: (e.vel.x - 2 * dot * n.x) * 0.85, y: (e.vel.y - 2 * dot * n.y) * 0.85, z: (e.vel.z - 2 * dot * n.z) * 0.85 };
        e.pos = { x: pos.x + n.x * 0.02, y: pos.y + n.y * 0.02, z: pos.z + n.z * 0.02 };
        sim.emit({ t: "fx", fx: "bounce", p: P3(e.pos), c: o.spell.vfx.color });
        sim.touch(e);
        continue;
      }
      if (p.fuse > 0) {
        p.stuck = true;
        e.pos = pos;
        e.vel = { x: 0, y: 0, z: 0 };
        sim.touch(e);
        continue;
      }
      impact(sim, e, o, null, pos, n);
      continue;
    }

    const step = Math.hypot(e.vel.x, e.vel.y, e.vel.z) * dt;
    e.pos = { x: e.pos.x + e.vel.x * dt, y: e.pos.y + e.vel.y * dt, z: e.pos.z + e.vel.z * dt };
    sim.touch(e);
    if (p.trail) {
      p.trailAcc += step;
      if (p.trailAcc > 0.5) {
        p.trailAcc = 0;
        const ground = sim.groundAt(e.pos.x, e.pos.z);
        if (e.pos.y - ground < 1.6) sim.surfaces.paint(e.pos.x, e.pos.z, 0.45, p.trail);
      }
    }
    if (p.life <= 0) {
      const d = o.spell.delivery as { detonateOnExpire?: boolean };
      if (d.detonateOnExpire || p.fuse > 0) impact(sim, e, o, null, e.pos, { x: 0, y: 1, z: 0 });
      else sim.remove(e);
    }
  }
}

function steerHoming(sim: FloorSim, e: Entity, p: ProjectileState, dt: number): void {
  const speed = Math.hypot(e.vel.x, e.vel.y, e.vel.z);
  if (speed < 0.1) return;
  const fwd = { x: e.vel.x / speed, y: e.vel.y / speed, z: e.vel.z / speed };
  let best: Entity | null = null;
  let bestScore = -Infinity;
  for (const type of [EntityType.Creature, EntityType.Player]) {
    for (const t of sim.list(type)) {
      if (t.id === p.owner || t.hp <= 0 || p.hitIds.has(t.id)) continue;
      if (p.ownerTeam === "delvers" ? t.player || t.team === "helpers" : t.team === p.ownerTeam) continue;
      const d = v3dist(t.pos, e.pos);
      if (d > 14) continue;
      const to = v3norm(v3sub(t.pos, e.pos));
      const facing = to.x * fwd.x + to.y * fwd.y + to.z * fwd.z;
      if (facing < 0.3) continue;
      const score = facing * 2 - d * 0.1;
      if (score > bestScore && sim.lineOfSight(e.pos, t.pos)) {
        bestScore = score;
        best = t;
      }
    }
  }
  if (!best) return;
  const to = v3norm(v3sub({ x: best.pos.x, y: best.pos.y + best.height * 0.15, z: best.pos.z }, e.pos));
  const k = Math.min(1, p.homing * dt);
  const nx = fwd.x + (to.x - fwd.x) * k;
  const ny = fwd.y + (to.y - fwd.y) * k;
  const nz = fwd.z + (to.z - fwd.z) * k;
  const l = Math.hypot(nx, ny, nz) || 1;
  e.vel = { x: (nx / l) * speed, y: (ny / l) * speed, z: (nz / l) * speed };
}

/** Per-body hit (pierce keeps flying after this). */
function applyHit(sim: FloorSim, e: Entity, o: CastOptions, target: Entity, pos: V3): void {
  const p = e.projectile!;
  const d = o.spell.delivery as Extract<SpellDef["delivery"], { kind: "projectile" }>;
  const dir = v3norm(e.vel);
  const hpBefore = target.hp;
  runEffects(
    sim,
    d.onHit.filter((f) => f.type !== "explode" && f.type !== "surface" && f.type !== "pull"),
    {
      pos,
      target,
      source: p.owner,
      sourceTeam: p.ownerTeam,
      power: p.damageMult,
      dir,
      element: p.element !== o.spell.element ? p.element : undefined,
      statusBonus: o.statusBonus,
      critChance: o.critChance,
      knockback: (o.knockback ?? 1) * (p.heavy ? 3 : 1),
    },
  );
  if (p.vampiric > 0 && hpBefore > target.hp) {
    const caster = sim.get(p.owner);
    if (caster) heal(sim, caster, (hpBefore - target.hp) * p.vampiric);
  }
  if (p.element === "fire" && (target.prop?.def.flammable || target.statuses.has("oiled"))) applyStatus(sim, target, "burning", undefined, 1, p.owner);
}

function impact(sim: FloorSim, e: Entity, o: CastOptions, target: Entity | null, pos: V3, normal: V3): void {
  const p = e.projectile!;
  const d = o.spell.delivery as Extract<SpellDef["delivery"], { kind: "projectile" }>;
  if (target) applyHit(sim, e, o, target, pos);
  const ctx: EffectContext = {
    pos,
    target: undefined,
    source: p.owner,
    sourceTeam: p.ownerTeam,
    power: p.damageMult,
    dir: v3norm(e.vel),
    element: p.element !== o.spell.element ? p.element : undefined,
    statusBonus: o.statusBonus,
    critChance: o.critChance,
    knockback: (o.knockback ?? 1) * (p.heavy ? 3 : 1),
  };
  runEffects(
    sim,
    d.onHit.filter((f) => f.type === "explode" || f.type === "surface" || f.type === "pull"),
    ctx,
  );
  const base = baseDamage(d.onHit);
  if (p.volatile > 0) explode(sim, pos, p.volatile, base * 0.6 * p.damageMult, p.element, 10, p.owner, p.ownerTeam, 0.25);
  if (p.chain) runEffects(sim, [{ type: "chain", count: p.chain.count, range: p.chain.range, damage: base * 0.5, element: p.element }], { ...ctx, target: target ?? undefined });
  if (p.magnetic > 0) addField(sim, { pos: { ...pos }, radius: 4, strength: p.magnetic, time: 0.8, source: p.owner });
  if (p.split) {
    const n = normal;
    const v = v3norm(e.vel);
    const dot = v.x * n.x + v.y * n.y + v.z * n.z;
    const refl = target ? v : { x: v.x - 2 * dot * n.x, y: v.y - 2 * dot * n.y, z: v.z - 2 * dot * n.z };
    const yaw = Math.atan2(-refl.x, -refl.z);
    const pitch = Math.asin(Math.max(-1, Math.min(1, refl.y)));
    for (let k = 0; k < p.split.count; k++) {
      const off = (k / Math.max(1, p.split.count - 1) - 0.5) * 1.1;
      const dir = dirFromAngles(yaw + off, pitch + 0.1);
      const child = spawnProjectile(sim, o, p.element, dir, [], true, {
        origin: { x: pos.x + n.x * 0.15, y: pos.y + n.y * 0.15, z: pos.z + n.z * 0.15 },
        damageMult: p.split.damage,
        speedScale: 0.8,
      });
      if (target) child.projectile!.hitIds.add(target.id);
    }
  }
  sim.surfaces.react(pos.x, pos.z, 0.7, p.element);
  sim.emit({ t: "impact", spell: o.spell.id, p: P3(pos), n: [normal.x, normal.y, normal.z], el: p.element, by: p.owner, castId: p.castId, proj: e.id });
  alertByNoise(sim, pos, o.spell.noise * 0.8, p.owner);
  sim.remove(e);
}

// ── Beams (channeled) ────────────────────────────────────────────────────────

const ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });

function beam(sim: FloorSim, o: CastOptions, element: Element): void {
  const d = o.spell.delivery as Extract<SpellDef["delivery"], { kind: "beam" }>;
  ray.origin = o.origin;
  ray.dir = o.dir;
  const casterId = o.caster?.id ?? 0;
  const hit = sim.world.castRayAndGetNormal(ray, d.range, true, undefined, GROUPS.queryAll, undefined, undefined, (c: Collider) => sim.entityOfCollider(c)?.id !== casterId);
  const toi = hit ? hit.timeOfImpact : d.range;
  const end = { x: o.origin.x + o.dir.x * toi, y: o.origin.y + o.dir.y * toi, z: o.origin.z + o.dir.z * toi };
  const target = hit ? sim.entityOfCollider(hit.collider) : undefined;
  runEffects(sim, d.onHit, {
    pos: end,
    target,
    source: casterId,
    sourceTeam: o.team,
    power: o.power,
    dir: o.dir,
    element: element !== o.spell.element ? element : undefined,
    statusBonus: o.statusBonus,
    critChance: o.critChance,
    knockback: o.knockback,
  });
  if (hit) sim.surfaces.react(end.x, end.z, 0.5, element);
  sim.emit({ t: "beam", by: casterId, from: P3(o.origin), to: P3(end), el: element, dur: d.tick + 0.05 });
}

/** Creature/trap convenience: cast a spell by id-less def at a target. */
export function castAt(sim: FloorSim, caster: Entity, spell: SpellDef, target: V3, power: number, lead?: V3): void {
  const origin = eyeOf(caster);
  const aim = lead ? { x: target.x + lead.x, y: target.y + lead.y, z: target.z + lead.z } : target;
  let dir = v3norm(v3sub(aim, origin));
  const d = spell.delivery;
  if (d.kind === "projectile" && d.gravity > 0) {
    // Lob: add loft proportional to distance.
    const dist = v3dist(aim, origin);
    const loft = Math.min(0.6, (dist * -GRAVITY * d.gravity) / (2 * d.speed * d.speed));
    dir = v3norm({ x: dir.x, y: dir.y + loft, z: dir.z });
  }
  sim.setAnim(caster, Anim.Cast);
  castSpell(sim, { caster, team: caster.team, spell, origin, dir, castId: 0, power });
}
