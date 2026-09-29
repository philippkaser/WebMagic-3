import type { Collider } from "@dimforge/rapier3d-compat";
import { PLAYER, TICK_DT } from "../config";
import { SPELLS } from "../content";
import { dirFromAngles, v3dist, v3sub, type V3 } from "../util/math";
import { heal, runEffects } from "./combat";
import { Anim, EntityType, Flag, type Entity, type PlayerStats } from "./entity";
import type { FloorSim } from "./FloorSim";
import { createCapsuleBody, GROUPS, RAPIER } from "./physics";
import { ampsOf, castSpell, eyeOf } from "./spells";
import { spawnReliquary } from "./objects";
import { CellKind } from "../world/layout";

/** Delvers inside the simulation. Movement is client-authoritative within
 * validated limits (instant, latency-free feel); everything that affects
 * others — casting, damage, pickups, pacts — is decided here. */

export const PLAYER_HEIGHT = (PLAYER.halfHeight + PLAYER.radius) * 2;

export interface PlayerInput {
  seq: number;
  pos: V3;
  vel: V3;
  yaw: number;
  pitch: number;
  grounded: boolean;
}

export function addPlayer(sim: FloorSim, opts: { name: string; pos: V3; yaw: number; stats: PlayerStats; hp?: number; mana?: number }): Entity {
  const e = sim.newEntity(EntityType.Player, "delver", opts.pos, "delvers");
  e.radius = PLAYER.radius;
  e.height = PLAYER_HEIGHT;
  e.mass = 80;
  e.yaw = opts.yaw;
  e.maxHp = opts.stats.maxHealth;
  e.hp = Math.min(e.maxHp, opts.hp ?? e.maxHp);
  const { body, collider } = createCapsuleBody(sim.world, { ...opts.pos, radius: e.radius, height: e.height, mass: 80, kind: "kinematic", groups: GROUPS.player });
  e.body = body;
  sim.bindCollider(e, collider);
  e.player = {
    name: opts.name,
    input: { seq: 0, pos: { ...opts.pos }, vel: { x: 0, y: 0, z: 0 }, yaw: opts.yaw, pitch: 0, grounded: true, time: sim.time },
    mana: Math.min(opts.stats.maxMana, opts.mana ?? opts.stats.maxMana),
    maxMana: opts.stats.maxMana,
    stats: opts.stats,
    cooldowns: {},
    channel: null,
    grasp: null,
    palm: 0,
    pactWith: new Set(),
    oathbroken: false,
    dead: false,
    lastDamagedBy: 0,
    invuln: 1.5,
    pendingImpulse: { x: 0, y: 0, z: 0 },
    kills: 0,
    lastSpotCheck: 0,
    lastPos: { ...opts.pos },
    lastInputTime: sim.time,
  };
  return e;
}

export function setPlayerStats(sim: FloorSim, e: Entity, stats: PlayerStats): void {
  const p = e.player!;
  const hpFrac = e.hp / Math.max(1, e.maxHp);
  p.stats = stats;
  e.maxHp = stats.maxHealth;
  e.hp = Math.max(1, Math.min(e.maxHp, Math.round(hpFrac * e.maxHp)));
  p.maxMana = stats.maxMana;
  p.mana = Math.min(p.mana, p.maxMana);
  sim.touch(e);
}

/** Accept a movement report from the owning client, within limits. Returns
 * a corrected position if the report was rejected. */
export function playerInput(sim: FloorSim, e: Entity, input: PlayerInput): V3 | null {
  const p = e.player!;
  if (p.dead) return null;
  if (input.seq <= p.input.seq) return null;
  const elapsed = Math.max(TICK_DT, sim.time - p.lastInputTime);
  p.lastInputTime = sim.time;
  const maxSpeed = PLAYER.speed * p.stats.moveSpeed * PLAYER.speedTolerance + 26; // dash & blast-jump headroom
  const d = v3dist(input.pos, p.input.pos);
  let pos = input.pos;
  let corrected: V3 | null = null;
  const g = sim.layout.grid;
  const cx = Math.floor(pos.x);
  const cz = Math.floor(pos.z);
  const inside = cx >= 0 && cz >= 0 && cx < g.w && cz < g.h && g.kind[cz * g.w + cx] !== 0;
  if (!Number.isFinite(pos.x + pos.y + pos.z) || !inside || d > maxSpeed * elapsed + 1.5) {
    pos = p.input.pos;
    corrected = { ...pos };
  } else if (g.kind[cz * g.w + cx] === CellKind.Open && pos.y < g.floor[cz * g.w + cx] + e.height / 2 - 1.2) {
    // Sunk through solid ground (a client physics glitch): only pits drop
    // a delver into the abyss, so stand them back up instead.
    pos = { x: pos.x, y: g.floor[cz * g.w + cx] + e.height / 2 + 0.05, z: pos.z };
    corrected = { ...pos };
  }
  p.input = { seq: input.seq, pos: { ...pos }, vel: { ...input.vel }, yaw: input.yaw, pitch: input.pitch, grounded: input.grounded, time: sim.time };
  return corrected;
}

export type CastSlot = "primary" | "secondary" | "relic";

/** A cast request. Returns false (and nothing happens) if not allowed. */
export function playerCast(sim: FloorSim, e: Entity, slot: CastSlot, castId: number, origin: V3, dir: V3): boolean {
  const p = e.player!;
  if (p.dead || e.statuses.has("frozen") || e.statuses.has("stunned")) return false;
  const st = p.stats;
  const spellId = slot === "primary" ? st.primary : slot === "secondary" ? st.secondary : st.relic;
  if (!spellId) return false;
  const spell = SPELLS.find(spellId);
  if (!spell) return false;
  if ((p.cooldowns[spellId] ?? 0) > 0) return false;
  const eye = eyeOf(e);
  // The claimed origin must be near the delver's eye.
  const o = v3dist(origin, eye) < 1.6 ? origin : eye;
  const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
  const d = { x: dir.x / len, y: dir.y / len, z: dir.z / len };
  const del = spell.delivery;

  if (spell.channeled) {
    if (p.mana < spell.mana * 0.15) return false;
    p.channel = { spell: spellId, castId, tickAcc: 0, dir: d };
    return true;
  }
  if (p.mana < spell.mana) return false;
  p.mana -= spell.mana;
  p.cooldowns[spellId] = spell.cooldown;
  sim.touch(e);

  if (del.kind === "dash") {
    // The client moves itself; the server grants a moment of grace.
    p.invuln = Math.max(p.invuln, del.duration + 0.05);
    sim.emit({ t: "cast", by: e.id, spell: spell.id, p: [e.pos.x, e.pos.y, e.pos.z], d: [d.x, d.y, d.z], castId });
    return true;
  }
  if (del.kind === "grasp") {
    grab(sim, e, o, d, del.range, del.maxMass);
    return true;
  }
  const isFocus = slot !== "relic";
  castSpell(sim, {
    caster: e,
    team: "delvers",
    spell,
    origin: o,
    dir: d,
    castId,
    power: st.spellPower * (isFocus ? st.focusPower : 1),
    amps: isFocus ? ampsOf(st.amps) : [],
    critChance: st.critChance,
    statusBonus: st.statusChance,
    knockback: st.knockback,
    speedMult: st.projectileSpeed,
    extraProjectiles: isFocus ? st.extraProjectiles : 0,
  });
  return true;
}

/** Button released: end channels, throw grasped things. */
export function playerRelease(sim: FloorSim, e: Entity, slot: CastSlot): void {
  const p = e.player!;
  const st = p.stats;
  const spellId = slot === "primary" ? st.primary : slot === "secondary" ? st.secondary : st.relic;
  if (p.channel && p.channel.spell === spellId) p.channel = null;
  if (slot === "relic" && p.grasp) throwGrasped(sim, e);
}

const graspRay = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });

function grab(sim: FloorSim, e: Entity, origin: V3, dir: V3, range: number, maxMass: number): void {
  const p = e.player!;
  graspRay.origin = origin;
  graspRay.dir = dir;
  const hit = sim.world.castRay(graspRay, range, true, undefined, GROUPS.queryAll, undefined, e.body ?? undefined, (c: Collider) => {
    const t = sim.entityOfCollider(c);
    return !t || t.id !== e.id;
  });
  const t = hit ? sim.entityOfCollider(hit.collider) : undefined;
  if (!t || !t.body || !t.body.isDynamic() || t.mass > maxMass || t.flags & Flag.Warden || t.player) {
    sim.emit({ t: "fx", fx: "grasp_fail", p: [origin.x + dir.x * 2, origin.y + dir.y * 2, origin.z + dir.z * 2] });
    return;
  }
  p.grasp = { targetId: t.id, dist: Math.min(2.4, Math.max(1.6, t.radius + 1.3)) };
  sim.setFlag(t, Flag.Grasped, true);
  if (t.prop) t.prop.grabbedBy = e.id;
  if (t.creature) {
    t.creature.stagger = Math.max(t.creature.stagger, 1);
    t.creature.grudges.set(e.id, (t.creature.grudges.get(e.id) ?? 0) + 5);
  }
  sim.emit({ t: "sound", id: "cast_force", p: [t.pos.x, t.pos.y, t.pos.z] });
}

function holdGrasped(sim: FloorSim, e: Entity, dt: number): void {
  const p = e.player!;
  const t = sim.get(p.grasp!.targetId);
  const spell = p.stats.relic ? SPELLS.find(p.stats.relic) : undefined;
  if (!t || !t.body || t.hp <= 0 && t.creature || !spell) {
    p.grasp = null;
    return;
  }
  // Holding costs mana over time.
  p.mana -= spell.mana * 0.5 * dt;
  if (p.mana <= 0) {
    p.mana = 0;
    throwGrasped(sim, e, 0.2);
    return;
  }
  const dir = dirFromAngles(p.input.yaw, p.input.pitch);
  const eye = eyeOf(e);
  const hold = { x: eye.x + dir.x * p.grasp!.dist, y: eye.y + dir.y * p.grasp!.dist - 0.1, z: eye.z + dir.z * p.grasp!.dist };
  const delta = v3sub(hold, t.pos);
  const k = 12;
  t.body.setLinvel({ x: delta.x * k, y: delta.y * k, z: delta.z * k }, true);
  t.body.setAngvel({ x: t.body.angvel().x * 0.9, y: t.body.angvel().y * 0.9, z: t.body.angvel().z * 0.9 }, true);
  if (t.creature) t.creature.stagger = Math.max(t.creature.stagger, 0.3);
}

function throwGrasped(sim: FloorSim, e: Entity, strength = 1): void {
  const p = e.player!;
  const t = sim.get(p.grasp?.targetId ?? 0);
  p.grasp = null;
  if (!t || !t.body) return;
  const spell = p.stats.relic ? SPELLS.find(p.stats.relic) : undefined;
  const speed = (spell?.delivery.kind === "grasp" ? spell.delivery.throwSpeed : 20) * strength * p.stats.knockback;
  const dir = dirFromAngles(p.input.yaw, p.input.pitch);
  t.body.setLinvel({ x: dir.x * speed, y: dir.y * speed + 1.5, z: dir.z * speed }, true);
  sim.setFlag(t, Flag.Grasped, false);
  if (t.prop) {
    t.prop.grabbedBy = 0;
    t.prop.thrownBy = e.id;
    t.prop.thrownTime = sim.time;
  }
  if (t.creature) t.creature.stagger = Math.max(t.creature.stagger, 0.8);
  sim.emit({ t: "sound", id: "dash", p: [t.pos.x, t.pos.y, t.pos.z] });
}

/** Raise the Open Palm. Two delvers raising it near each other form a pact. */
export function playerSign(sim: FloorSim, e: Entity): void {
  const p = e.player!;
  if (p.dead) return;
  p.palm = 3;
  sim.setFlag(e, Flag.Palm, true);
  sim.emit({ t: "fx", fx: "palm", p: [e.pos.x, e.pos.y + 0.9, e.pos.z] });
  if (p.oathbroken) return;
  for (const o of sim.list(EntityType.Player)) {
    if (o === e || o.player!.dead || o.player!.palm <= 0 || o.player!.oathbroken) continue;
    if (v3dist(o.pos, e.pos) > 14 || !sim.lineOfSight(eyeOf(e), eyeOf(o))) continue;
    if (p.pactWith.has(o.id)) continue;
    p.pactWith.add(o.id);
    o.player!.pactWith.add(e.id);
    sim.emit({ t: "msg", to: e.id, text: `You and ${o.player!.name} are bound by pact for this floor.`, kind: "info" });
    sim.emit({ t: "msg", to: o.id, text: `You and ${p.name} are bound by pact for this floor.`, kind: "info" });
    sim.emit({ t: "sound", id: "pact_formed", p: [e.pos.x, e.pos.y, e.pos.z] });
  }
}

/** Consumable effects (potions) applied by the host after it spent the item. */
export function playerUseEffects(sim: FloorSim, e: Entity, effects: Parameters<typeof runEffects>[1]): void {
  runEffects(sim, effects, { pos: { ...e.pos }, target: e, source: e.id, sourceTeam: "delvers", power: 1 });
  sim.touch(e);
}

/** Throwables (flasks) the host already took from the bag. */
export function playerThrow(sim: FloorSim, e: Entity, spellId: string, origin: V3, dir: V3): void {
  const spell = SPELLS.find(spellId);
  if (!spell) return;
  const eye = eyeOf(e);
  castSpell(sim, { caster: e, team: "delvers", spell, origin: v3dist(origin, eye) < 1.6 ? origin : eye, dir, castId: 0, power: e.player!.stats.spellPower });
}

export function killPlayer(sim: FloorSim, e: Entity, killer: number, cause: string): void {
  const p = e.player!;
  if (p.dead) return;
  p.dead = true;
  p.channel = null;
  p.grasp = null;
  e.hp = 0;
  sim.setAnim(e, Anim.Dead);
  sim.emit({ t: "death", id: e.id, by: killer, p: [e.pos.x, e.pos.y, e.pos.z] });
  e.collider?.setCollisionGroups(GROUPS.corpse);
  const contents = sim.hooks.onPlayerDeath(e.id, killer, cause);
  if (contents.length) spawnReliquary(sim, e.pos, p.name, contents);
}

export function updatePlayers(sim: FloorSim, dt: number): void {
  for (const e of sim.list(EntityType.Player)) {
    const p = e.player!;
    if (p.dead) continue;
    const st = p.stats;
    const target = p.input.pos;
    e.body?.setNextKinematicTranslation(target);
    const moved = Math.abs(target.x - e.pos.x) + Math.abs(target.y - e.pos.y) + Math.abs(target.z - e.pos.z) > 0.002;
    e.pos = { ...target };
    e.vel = { ...p.input.vel };
    if (Math.abs(e.yaw - p.input.yaw) > 0.002) {
      e.yaw = p.input.yaw;
      sim.touch(e);
    }
    if (moved) sim.touch(e);

    p.invuln = Math.max(0, p.invuln - dt);
    p.mana = Math.min(p.maxMana, p.mana + st.manaRegen * dt);
    if (st.healthRegen > 0) heal(sim, e, st.healthRegen * dt);
    for (const k in p.cooldowns) p.cooldowns[k] = Math.max(0, p.cooldowns[k] - dt * st.castSpeed);
    if (p.palm > 0) {
      p.palm -= dt;
      if (p.palm <= 0) sim.setFlag(e, Flag.Palm, false);
    }

    if (p.channel) {
      const spell = SPELLS.find(p.channel.spell);
      if (!spell || spell.delivery.kind !== "beam") p.channel = null;
      else {
        p.mana -= spell.mana * dt;
        if (p.mana <= 0) {
          p.mana = 0;
          p.channel = null;
        } else {
          p.channel.tickAcc += dt;
          if (p.channel.tickAcc >= spell.delivery.tick) {
            p.channel.tickAcc = 0;
            castSpell(sim, {
              caster: e,
              team: "delvers",
              spell,
              origin: eyeOf(e),
              dir: dirFromAngles(p.input.yaw, p.input.pitch),
              castId: p.channel.castId,
              power: st.spellPower * st.focusPower,
              amps: ampsOf(st.amps).filter((a) => a.type === "convert" || a.type === "chain" || a.type === "vampiric"),
              critChance: st.critChance,
              statusBonus: st.statusChance,
              knockback: st.knockback,
            });
          }
        }
      }
    }
    if (p.grasp) holdGrasped(sim, e, dt);

    // Standing in fire while wet etc. is handled by combat; burning delvers
    // who walk into water are put out by the surface layer.
    if (e.statuses.has("frozen")) sim.setAnim(e, Anim.Idle);
  }
}

