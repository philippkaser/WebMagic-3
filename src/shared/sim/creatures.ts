import { PLAYER } from "../config";
import { SPELLS, surfaceDef } from "../content";
import type { CreatureDef } from "../content/types";
import { angleDelta, v3dist, yawOf, type V3 } from "../util/math";
import { think } from "./ai/brain";
import { applyStatus, footing, knock, runEffects } from "./combat";
import { Anim, EntityType, Flag, type Entity } from "./entity";
import type { FloorSim } from "./FloorSim";
import { dropGold, dropLootAt } from "./objects";
import { createCapsuleBody, GROUPS, RAPIER } from "./physics";
import { castAt } from "./spells";

/** Creatures as physical bodies: spawning, locomotion (velocity steering
 * on a rotation-locked dynamic capsule, with grid-aware step assist, ice
 * sliding and knockback), attack execution and death. The *decisions* live
 * in ai/brain.ts. */

export function spawnCreature(sim: FloorSim, def: CreatureDef, pos: V3, yaw: number, opts: { warden?: boolean; team?: Entity["team"]; summonedBy?: number; lifeTime?: number } = {}): Entity {
  const e = sim.newEntity(EntityType.Creature, def.id, pos, opts.team ?? def.faction);
  const scale = sim.scale;
  e.yaw = yaw;
  e.radius = def.radius * (def.scale ?? 1);
  e.height = def.height * (def.scale ?? 1);
  e.mass = def.mass;
  e.maxHp = Math.round(def.stats.hp * scale.health);
  e.hp = e.maxHp;
  const flying = def.movement === "fly" || def.movement === "hover";
  const { body, collider } = createCapsuleBody(sim.world, {
    x: pos.x,
    y: pos.y,
    z: pos.z,
    radius: e.radius,
    height: e.height,
    mass: def.mass,
    kind: "dynamic",
    groups: GROUPS.creature,
  });
  if (flying) body.setGravityScale(0, true);
  if (def.movement === "static") body.setBodyType(RAPIER.RigidBodyType.Fixed, true);
  e.body = body;
  sim.bindCollider(e, collider);
  e.creature = {
    def,
    dmgScale: scale.damage,
    behavior: def.behaviors.includes("sleep") && sim.rng.chance(0.3) ? "sleep" : "wander",
    behaviorTime: 0,
    scratch: {},
    targetId: 0,
    attack: null,
    cooldowns: def.attacks.map(() => sim.rng.range(0, 1)),
    stagger: 0,
    grudges: new Map(),
    lastSeen: null,
    noise: null,
    knownTraps: new Set(),
    home: { ...pos },
    path: [],
    pathTime: 0,
    pathGoal: null,
    hunger: sim.rng.range(0, 0.6),
    grounded: false,
    wantVel: { x: 0, y: 0, z: 0 },
    deadTime: 0,
    warden: opts.warden ? { phase: 1 } : null,
    summonedBy: opts.summonedBy ?? 0,
    lifeTime: opts.lifeTime ?? 0,
  };
  if (opts.warden) e.flags |= Flag.Warden;
  if (def.helper) e.flags |= Flag.Helper;
  if (e.creature.behavior === "sleep") e.flags |= Flag.Asleep;
  return e;
}

const downRay = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });

export function updateCreatures(sim: FloorSim, dt: number): void {
  const list = sim.list(EntityType.Creature);
  for (let k = 0; k < list.length; k++) {
    const e = list[k];
    const c = e.creature!;
    if (e.removed) continue;
    if (e.hp <= 0) {
      c.deadTime += dt;
      if (c.deadTime > 30) sim.remove(e);
      continue;
    }
    if (c.lifeTime > 0) {
      c.lifeTime -= dt;
      if (c.lifeTime <= 0) {
        sim.emit({ t: "fx", fx: "dissolve", p: [e.pos.x, e.pos.y, e.pos.z] });
        sim.remove(e);
        continue;
      }
    }
    c.stagger = Math.max(0, c.stagger - dt);
    for (let i = 0; i < c.cooldowns.length; i++) c.cooldowns[i] = Math.max(0, c.cooldowns[i] - dt);
    c.hunger = Math.min(1, c.hunger + dt * 0.004);

    const incapacitated = e.statuses.has("frozen") || e.statuses.has("stunned");
    // Brains think at 10 Hz, staggered across creatures.
    if (!incapacitated && c.stagger <= 0 && (sim.tick + e.id) % 3 === 0) think(sim, e, dt * 3);
    if (!incapacitated && c.attack) updateAttack(sim, e, dt);
    locomote(sim, e, dt, incapacitated);
  }
}

function locomote(sim: FloorSim, e: Entity, dt: number, incapacitated: boolean): void {
  const c = e.creature!;
  const b = e.body;
  if (!b || !b.isDynamic()) return;
  const def = c.def;
  const flying = def.movement === "fly" || def.movement === "hover";

  // Ground probe.
  downRay.origin = { x: e.pos.x, y: e.pos.y, z: e.pos.z };
  const reach = e.height / 2 + 0.12;
  const hit = sim.world.castRay(downRay, reach, true, undefined, GROUPS.queryAll, undefined, b);
  c.grounded = flying || !!hit;

  let moveMult = 1;
  for (const [id] of e.statuses) {
    if (id === "chilled") moveMult *= 0.6;
    else if (id === "slowed") moveMult *= 0.5;
    else if (id === "webbed") moveMult *= 0.15;
    else if (id === "shocked") moveMult *= 0.7;
    else if (id === "feared") moveMult *= 1.15;
  }
  const { surface, wading } = footing(sim, e);
  const sdef = surfaceDef(surface);
  moveMult *= sdef.moveMult * (wading ? 0.6 : 1);
  if (incapacitated) moveMult = 0;

  const v = b.linvel();
  const want = c.wantVel;
  const tvx = want.x * moveMult;
  const tvz = want.z * moveMult;
  if (flying) {
    const k = 1 - Math.exp(-4 * dt);
    const tvy = incapacitated ? -6 : want.y * moveMult;
    b.setLinvel({ x: v.x + (tvx - v.x) * k, y: v.y + (tvy - v.y) * k, z: v.z + (tvz - v.z) * k }, true);
  } else if (c.grounded && c.stagger <= 0) {
    // Friction of the surface decides how fast we can change velocity:
    // on ice everything slides.
    const traction = 10 * Math.min(1, sdef.friction * 1.2);
    const k = 1 - Math.exp(-traction * dt);
    let vy = v.y;
    // Step assist: climbing onto a higher cell ahead.
    const speed = Math.hypot(tvx, tvz);
    if (speed > 0.3) {
      const ax = e.pos.x + (tvx / speed) * (e.radius + 0.25);
      const az = e.pos.z + (tvz / speed) * (e.radius + 0.25);
      const here = sim.groundAt(e.pos.x, e.pos.z);
      const ahead = sim.groundAt(ax, az);
      const rise = ahead - here;
      const feet = e.pos.y - e.height / 2;
      if (rise > 0.05 && rise <= PLAYER.stepHeight + 0.05 && feet < ahead + 0.02) vy = Math.max(vy, 3.2 + rise * 4);
    }
    b.setLinvel({ x: v.x + (tvx - v.x) * k, y: vy, z: v.z + (tvz - v.z) * k }, true);
  }

  // Face movement or target.
  const target = c.targetId ? sim.get(c.targetId) : undefined;
  let faceYaw = e.yaw;
  if (c.attack || (target && v3dist(target.pos, e.pos) < 6)) {
    const aim = c.attack?.aim ?? target!.pos;
    faceYaw = yawOf(aim.x - e.pos.x, aim.z - e.pos.z);
  } else if (Math.hypot(want.x, want.z) > 0.2) {
    faceYaw = yawOf(want.x, want.z);
  }
  const maxTurn = ((def.stats.turnRate * Math.PI) / 180) * dt * (incapacitated ? 0 : 1);
  const dy = angleDelta(e.yaw, faceYaw);
  const turn = Math.max(-maxTurn, Math.min(maxTurn, dy));
  if (Math.abs(turn) > 1e-4) {
    e.yaw += turn;
    sim.touch(e);
  }

  // Movement animation (attacks/hurt override).
  if (!c.attack && c.stagger <= 0 && e.anim !== Anim.Feed && e.anim !== Anim.Sleep && e.anim !== Anim.Cast) {
    const sp = Math.hypot(v.x, v.z);
    sim.setAnim(e, incapacitated ? Anim.Idle : sp > def.stats.speed * 1.15 ? Anim.Run : sp > 0.25 ? Anim.Walk : Anim.Idle);
  } else if (e.anim === Anim.Cast && sim.tick - e.animTick > 12) {
    sim.setAnim(e, Anim.Idle);
  } else if ((e.anim === Anim.Hurt || e.anim === Anim.Stagger) && c.stagger <= 0) {
    sim.setAnim(e, Anim.Idle);
  }
}

/** Begin an attack (the brain decided). */
export function startAttack(sim: FloorSim, e: Entity, index: number, target: Entity): void {
  const c = e.creature!;
  const a = c.def.attacks[index];
  c.attack = { index, phase: "windup", t: a.windup, targetId: target.id, aim: { ...target.pos } };
  c.cooldowns[index] = a.cooldown + a.windup;
  sim.setAnim(e, Anim.Windup, index);
  if (a.kind === "lunge" || a.kind === "slam") sim.emit({ t: "sound", id: `${c.def.voice ?? "bones"}_attack`, p: [e.pos.x, e.pos.y, e.pos.z] });
}

function updateAttack(sim: FloorSim, e: Entity, dt: number): void {
  const c = e.creature!;
  const at = c.attack!;
  const a = c.def.attacks[at.index];
  const target = sim.get(at.targetId);
  at.t -= dt;
  if (at.phase === "windup") {
    // Track the target during windup, but less as it nears the release —
    // that's the dodge window.
    if (target && at.t > a.windup * 0.35) at.aim = { ...target.pos };
    c.wantVel = { x: 0, y: 0, z: 0 };
    if (at.t <= 0) {
      at.phase = "strike";
      at.t = 0.12;
      sim.setAnim(e, Anim.Strike, at.index);
      releaseAttack(sim, e, at.index, target);
    }
  } else if (at.phase === "strike") {
    if (at.t <= 0) {
      at.phase = "recover";
      at.t = a.recover;
      sim.setAnim(e, Anim.Recover, at.index);
    }
  } else if (at.t <= 0) {
    c.attack = null;
    sim.setAnim(e, Anim.Idle);
  }
}

function releaseAttack(sim: FloorSim, e: Entity, index: number, target: Entity | undefined): void {
  const c = e.creature!;
  const a = c.def.attacks[index];
  const power = c.dmgScale * (c.warden && c.warden.phase > 1 ? 1.25 : 1);
  const aim = c.attack!.aim;
  const toAim = { x: aim.x - e.pos.x, y: 0, z: aim.z - e.pos.z };
  const dist = Math.hypot(toAim.x, toAim.z) || 1;
  const dir = { x: toAim.x / dist, y: 0, z: toAim.z / dist };
  switch (a.kind) {
    case "melee":
    case "grab": {
      // Everything in the swing arc gets hit — including other creatures.
      const reach = a.range + 0.3;
      for (const o of sim.bodiesNear(e.pos, reach)) {
        if (o === e || o.hp <= 0) continue;
        const to = { x: o.pos.x - e.pos.x, z: o.pos.z - e.pos.z };
        const d = Math.hypot(to.x, to.z) || 1;
        if ((to.x / d) * dir.x + (to.z / d) * dir.z < 0.35) continue;
        if (o.creature && o.team === e.team && o.id !== c.attack?.targetId) continue;
        hitWith(sim, e, o, a, power, dir);
      }
      break;
    }
    case "lunge": {
      e.body?.applyImpulse({ x: dir.x * (a.leapSpeed ?? 6) * e.mass, y: 2.2 * e.mass, z: dir.z * (a.leapSpeed ?? 6) * e.mass }, true);
      c.stagger = 0.35; // committed: no steering mid-leap
      sim.later(0.18, () => {
        if (e.removed || e.hp <= 0) return;
        for (const o of sim.bodiesNear(e.pos, e.radius + 0.6)) {
          if (o === e || o.hp <= 0 || (o.creature && o.team === e.team)) continue;
          hitWith(sim, e, o, a, power, dir);
          break;
        }
      });
      break;
    }
    case "slam": {
      runEffects(sim, [{ type: "explode", radius: a.range, damage: a.damage, element: a.element, impulse: a.impulse ?? 20, friendlyFactor: 0.5 }, ...(a.effects ?? [])], {
        pos: { x: e.pos.x + dir.x * 0.8, y: e.pos.y - e.height / 2 + 0.2, z: e.pos.z + dir.z * 0.8 },
        source: e.id,
        sourceTeam: e.team,
        power,
        exclude: e.id,
      });
      break;
    }
    case "ranged":
    case "spell":
    case "breath": {
      const spell = a.spell ? SPELLS.find(a.spell) : undefined;
      if (!spell) break;
      // Lead moving targets (intelligence decides how well).
      const lead = target
        ? { x: target.vel.x * c.def.intelligence * 0.35, y: 0, z: target.vel.z * c.def.intelligence * 0.35 }
        : undefined;
      const aimPt = target ? { x: aim.x, y: target.pos.y + target.height * 0.1, z: aim.z } : aim;
      castAt(sim, e, spell, aimPt, power, lead);
      break;
    }
    case "explode": {
      runEffects(sim, [{ type: "explode", radius: a.range, damage: a.damage, element: a.element, impulse: a.impulse ?? 15 }, ...(a.effects ?? [])], {
        pos: { ...e.pos },
        source: e.id,
        sourceTeam: e.team,
        power,
      });
      e.hp = 0;
      killCreature(sim, e, e.id);
      break;
    }
  }
}

function hitWith(sim: FloorSim, e: Entity, o: Entity, a: CreatureDef["attacks"][number], power: number, dir: V3): void {
  const imp = (a.impulse ?? 3) * Math.min(Math.max(o.mass, 5), 120) * 0.1;
  runEffects(sim, [{ type: "damage", amount: a.damage, element: a.element }, ...(a.effects ?? [])], {
    pos: { ...o.pos },
    target: o,
    source: e.id,
    sourceTeam: e.team,
    power,
    dir,
  });
  if (imp > 0) knock(sim, o, { x: dir.x * imp, y: imp * 0.3, z: dir.z * imp });
  sim.emit({ t: "sound", id: o.creature?.def.id.includes("shambler") ? "hit_bone" : "hit_flesh", p: [o.pos.x, o.pos.y, o.pos.z] });
}

export function killCreature(sim: FloorSim, e: Entity, killer: number): void {
  const c = e.creature!;
  if (c.deadTime > 0 || (e.flags & Flag.Corpse) !== 0) return;
  e.hp = 0;
  c.attack = null;
  sim.setAnim(e, Anim.Dead);
  sim.setFlag(e, Flag.Corpse, true);
  sim.setFlag(e, Flag.Alerted, false);
  const p: [number, number, number] = [e.pos.x, e.pos.y, e.pos.z];
  sim.emit({ t: "death", id: e.id, by: killer, p });
  // Corpses keep their body, but fall over and stop blocking the living.
  if (e.body && e.body.isDynamic()) {
    e.body.setEnabledRotations(true, true, true, true);
    e.body.setGravityScale(1, true);
    e.body.applyTorqueImpulse({ x: (sim.rng.next() - 0.5) * e.mass * 0.6, y: 0, z: (sim.rng.next() - 0.5) * e.mass * 0.6 }, true);
    e.collider?.setCollisionGroups(GROUPS.corpse);
    const r = e.body.rotation();
    e.quat = { x: r.x, y: r.y, z: r.z, w: r.w };
  }
  if (c.def.onDeath) runEffects(sim, c.def.onDeath, { pos: { ...e.pos }, source: e.id, sourceTeam: e.team, power: c.dmgScale });
  if (!c.summonedBy) {
    const drop = { x: e.pos.x, y: e.pos.y + 0.3, z: e.pos.z };
    const killerEnt = sim.get(killer);
    const luck = killerEnt?.player?.stats.luck ?? 1;
    if (sim.rng.chance(c.def.drops.goldChance)) dropGold(sim, drop, Math.max(1, Math.round(c.def.drops.gold * sim.scale.damage * sim.rng.range(0.6, 1.4))));
    if (sim.rng.chance(c.def.drops.lootChance * luck)) dropLootAt(sim, drop, c.warden ? 3 : 1, luck);
    for (const m of c.def.drops.materials ?? []) if (sim.rng.chance(m.chance)) dropLootAt(sim, drop, 1, luck, m.id);
  }
  if (c.warden) {
    sim.emit({ t: "warden", id: e.id, phase: 0, name: c.def.name });
    for (const i of sim.list(EntityType.Interactable)) {
      if (i.interact?.kind === "descent") sim.setFlag(i, Flag.Sealed, false);
    }
    sim.emit({ t: "sound", id: "warden_phase", p });
  }
  if (e.statuses.has("burning")) applyStatus(sim, e, "burning", 3, 1, killer);
  sim.hooks.onKill?.(killer, e);
  alertByNoise(sim, e.pos, 6, killer);
}

/** A sound happened: creatures that can hear it remember where. */
export function alertByNoise(sim: FloorSim, pos: V3, loudness: number, source: number): void {
  if (loudness <= 0) return;
  for (const e of sim.list(EntityType.Creature)) {
    const c = e.creature!;
    if (e.hp <= 0 || e.id === source) continue;
    const d = v3dist(e.pos, pos);
    const range = c.def.senses.hearing * (loudness / 10);
    if (d > range) continue;
    c.noise = { pos: { ...pos }, time: sim.time, loudness };
    if (c.behavior === "sleep" && d < range * 0.7) {
      c.behavior = "investigate";
      sim.setFlag(e, Flag.Asleep, false);
    }
  }
}
