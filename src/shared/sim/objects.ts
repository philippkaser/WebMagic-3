import { PLAYER } from "../config";
import { ITEMS, SPELLS } from "../content";
import type { PropDef, TrapDef } from "../content/types";
import { Surface } from "../content/types";
import { dirFromAngles, v3dist, v3distXZ, type V3 } from "../util/math";
import { applyStatus, damage, heal, runEffects } from "./combat";
import { Anim, EntityType, Flag, type Entity, type InteractKind } from "./entity";
import type { FloorSim } from "./FloorSim";
import { GROUPS, RAPIER, shapeDesc, shapeVolume } from "./physics";
import { castSpell } from "./spells";

/** The furniture of the dream: physical props, traps, interactables and
 * loot on the floor. */

// ── Props ───────────────────────────────────────────────────────────────────

export function spawnProp(sim: FloorSim, def: PropDef, pos: V3, yaw: number): Entity {
  const e = sim.newEntity(EntityType.Prop, def.id, pos, "wild");
  e.yaw = yaw;
  e.mass = def.mass;
  e.maxHp = def.hp ?? 0;
  e.hp = e.maxHp;
  const s = def.shape;
  e.radius = s.kind === "box" ? Math.max(s.half[0], s.half[2]) : s.radius;
  e.height = s.kind === "box" ? s.half[1] * 2 : s.kind === "cylinder" ? s.halfHeight * 2 : s.radius * 2;
  const q = { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) };
  const bodyDesc = def.mass > 0 ? RAPIER.RigidBodyDesc.dynamic().setCcdEnabled(true).setAngularDamping(0.4).setLinearDamping(0.05) : RAPIER.RigidBodyDesc.fixed();
  bodyDesc.setTranslation(pos.x, pos.y, pos.z).setRotation(q);
  if (def.mass > 0) bodyDesc.setCanSleep(true);
  const body = sim.world.createRigidBody(bodyDesc);
  const cd = shapeDesc(s)
    .setCollisionGroups(GROUPS.prop)
    .setFriction(0.7)
    .setRestitution(def.material === "metal" ? 0.25 : 0.1);
  if (def.mass > 0) cd.setDensity(def.mass / shapeVolume(s)).setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(def.mass * 60);
  const collider = sim.world.createCollider(cd, body);
  e.body = body;
  e.quat = q;
  sim.bindCollider(e, collider);
  e.prop = { def, grabbedBy: 0, thrownBy: 0, thrownTime: 0, ignited: false };
  return e;
}

export function breakProp(sim: FloorSim, e: Entity, killer: number): void {
  if (e.removed) return;
  const def = e.prop!.def;
  const p: [number, number, number] = [e.pos.x, e.pos.y, e.pos.z];
  sim.emit({ t: "break", id: e.id, def: def.id, p });
  sim.remove(e);
  // Effects fire after removal so an exploding keg doesn't hit itself.
  if (def.onBreak) runEffects(sim, def.onBreak, { pos: { ...e.pos }, source: killer, sourceTeam: "wild", power: sim.scale.damage * 0.6 });
  if (def.lootChance && sim.rng.chance(def.lootChance)) {
    const luck = sim.get(killer)?.player?.stats.luck ?? 1;
    if (sim.rng.chance(0.6)) dropGold(sim, e.pos, Math.round(sim.rng.range(2, 8) * sim.scale.damage));
    else dropLootAt(sim, e.pos, 1, luck);
  }
  if (e.statuses.has("burning")) sim.surfaces.paint(e.pos.x, e.pos.z, 0.8, Surface.Fire);
}

// ── Traps ───────────────────────────────────────────────────────────────────

export function spawnTrap(sim: FloorSim, def: TrapDef, pos: V3, yaw: number): Entity {
  const e = sim.newEntity(EntityType.Trap, def.id, pos, "wild");
  e.yaw = yaw;
  e.radius = def.radius;
  e.height = 0.1;
  e.flags |= Flag.Hidden;
  e.trap = { def, armed: true, cooldown: 0, pending: 0, spotted: false, facing: dirFromAngles(yaw, 0) };
  if (def.action === "collapse") {
    // Rotten boards over a drop: a fixed slab that vanishes when sprung.
    const g = sim.layout.grid;
    const cx = Math.floor(pos.x);
    const cz = Math.floor(pos.z);
    const floorY = g.floor[cz * g.w + cx];
    const body = sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(cx + 0.5, floorY + 0.001, cz + 0.5));
    const col = sim.world.createCollider(RAPIER.ColliderDesc.cuboid(0.5, 0.05, 0.5).setTranslation(0, -0.05, 0).setCollisionGroups(GROUPS.world), body);
    e.body = body;
    e.collider = col;
  }
  // Creatures that live here may know about it.
  for (const c of sim.list(EntityType.Creature)) {
    const cs = c.creature!;
    if (v3dist(c.pos, pos) < 14 && sim.rng.chance(cs.def.intelligence)) cs.knownTraps.add(e.id);
  }
  return e;
}

function updateTrap(sim: FloorSim, e: Entity, dt: number): void {
  const t = e.trap!;
  const def = t.def;
  t.cooldown = Math.max(0, t.cooldown - dt);
  if (t.pending > 0) {
    t.pending -= dt;
    if (t.pending <= 0) fireTrap(sim, e);
    return;
  }
  if (!t.armed || t.cooldown > 0) return;
  let triggered = false;
  if (def.trigger === "plate") {
    let mass = 0;
    for (const o of sim.bodiesNear(e.pos, def.radius)) {
      const feet = o.pos.y - o.height / 2;
      if (Math.abs(feet - e.pos.y) > 0.35 || v3distXZ(o.pos, e.pos) > def.radius) continue;
      if (o.creature && (o.creature.def.movement === "fly" || o.creature.def.movement === "hover") && o.hp > 0) continue;
      mass += o.player ? 80 : o.mass;
    }
    triggered = mass >= (def.minMass ?? 5);
  } else if (def.trigger === "sight" || def.trigger === "proximity") {
    for (const type of [EntityType.Player, EntityType.Creature]) {
      for (const o of sim.list(type)) {
        if (o.hp <= 0) continue;
        const dx = o.pos.x - e.pos.x;
        const dz = o.pos.z - e.pos.z;
        const along = dx * t.facing.x + dz * t.facing.z;
        if (def.trigger === "proximity") {
          if (Math.hypot(dx, dz) < def.radius) triggered = true;
          continue;
        }
        if (along < 0.3 || along > def.radius) continue;
        const lateral = Math.abs(-dx * t.facing.z + dz * t.facing.x);
        if (lateral > 0.55) continue;
        if (!sim.lineOfSight(e.pos, o.pos)) continue;
        triggered = true;
      }
    }
  }
  if (!triggered) return;
  t.pending = Math.max(0.01, def.delay);
  sim.emit({ t: "sound", id: "pressure_plate_click", p: [e.pos.x, e.pos.y, e.pos.z] });
}

function fireTrap(sim: FloorSim, e: Entity): void {
  const t = e.trap!;
  const def = t.def;
  t.cooldown = def.rearm;
  if (def.rearm <= 0) t.armed = false;
  if (e.flags & Flag.Hidden) sim.setFlag(e, Flag.Hidden, false);
  sim.setAnim(e, Anim.Strike);
  sim.emit({ t: "trap", id: e.id, action: def.action });
  const power = sim.scale.damage;
  switch (def.action) {
    case "spikes":
    case "flame": {
      for (const o of sim.bodiesNear(e.pos, def.radius)) {
        const feet = o.pos.y - o.height / 2;
        if (Math.abs(feet - e.pos.y) > 0.6 || v3distXZ(o.pos, e.pos) > def.radius + o.radius * 0.5) continue;
        damage(sim, o, def.damage * power, { source: e.id, element: def.element, cause: def.id, impulse: def.action === "spikes" ? { x: 0, y: 3 * Math.min(o.mass, 80) * 0.1, z: 0 } : undefined });
        if (def.effects) runEffects(sim, def.effects.filter((f) => f.type !== "surface"), { pos: { ...o.pos }, target: o, source: e.id, sourceTeam: "wild", power });
        if (def.action === "flame") applyStatus(sim, o, "burning", undefined, power, e.id);
      }
      if (def.effects) runEffects(sim, def.effects.filter((f) => f.type === "surface"), { pos: { ...e.pos }, source: e.id, sourceTeam: "wild", power });
      if (def.action === "flame") sim.surfaces.react(e.pos.x, e.pos.z, def.radius, "fire");
      break;
    }
    case "darts": {
      const spell = SPELLS.find("trap_dart");
      if (spell) castSpell(sim, { caster: null, team: "wild", spell, origin: { x: e.pos.x + t.facing.x * 0.3, y: e.pos.y, z: e.pos.z + t.facing.z * 0.3 }, dir: t.facing, castId: 0, power });
      break;
    }
    case "collapse": {
      if (e.body) {
        sim.world.removeRigidBody(e.body);
        e.body = null;
        e.collider = null;
      }
      sim.emit({ t: "fx", fx: "collapse", p: [e.pos.x, e.pos.y, e.pos.z] });
      sim.emit({ t: "sound", id: "crate_break", p: [e.pos.x, e.pos.y, e.pos.z] });
      break;
    }
    default:
      if (def.effects) runEffects(sim, def.effects, { pos: { ...e.pos }, source: e.id, sourceTeam: "wild", power });
  }
  // Everyone who saw it now knows it's there.
  for (const c of sim.list(EntityType.Creature)) {
    if (c.hp > 0 && v3dist(c.pos, e.pos) < 10 && sim.lineOfSight(c.pos, e.pos)) c.creature!.knownTraps.add(e.id);
  }
}

// ── Interactables ───────────────────────────────────────────────────────────

export function spawnInteractable(sim: FloorSim, kind: string, pos: V3, yaw: number, data: Record<string, string | number | boolean>): Entity {
  const e = sim.newEntity(EntityType.Interactable, kind, pos, "wild");
  e.yaw = yaw;
  e.radius = kind === "descent" || kind === "arrival" ? 1.2 : 0.5;
  e.height = 1;
  e.interact = { kind: kind as InteractKind, data, contents: [], usedBy: new Set() };
  if (data.sealed) e.flags |= Flag.Sealed;
  if (kind === "chest" || kind === "reliquary") {
    const body = sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y + 0.3, pos.z).setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }));
    const col = sim.world.createCollider(RAPIER.ColliderDesc.cuboid(0.45, 0.3, 0.3).setCollisionGroups(GROUPS.world), body);
    e.body = body;
    sim.bindCollider(e, col);
  }
  return e;
}

/** A player pressed interact on `target`. `choice` selects ascend/descend. */
export function interact(sim: FloorSim, player: Entity, target: Entity, choice?: string): void {
  const p = player.player!;
  if (p.dead) return;
  if (v3distXZ(player.pos, target.pos) > PLAYER.interactRange + target.radius) return;
  if (target.pickup) {
    takePickup(sim, player, target);
    return;
  }
  const it = target.interact;
  if (!it) return;
  switch (it.kind) {
    case "descent":
      if (target.flags & Flag.Sealed) {
        sim.emit({ t: "msg", to: player.id, text: "The way down is sealed while the warden stands.", kind: "warn" });
        return;
      }
      sim.hooks.onDescent(player.id, choice === "ascend" && sim.hooks.canAscend(player.id));
      return;
    case "chest":
      if (target.flags & Flag.Opened) return;
      sim.setFlag(target, Flag.Opened, true);
      sim.setAnim(target, Anim.Open);
      sim.emit({ t: "open", id: target.id });
      dropGold(sim, { x: target.pos.x, y: target.pos.y + 0.6, z: target.pos.z }, Math.round(sim.rng.range(10, 30) * sim.scale.damage));
      dropLootAt(sim, { x: target.pos.x, y: target.pos.y + 0.6, z: target.pos.z }, Number(it.data.tier ?? 1) + 1, p.stats.luck);
      return;
    case "reliquary": {
      if (it.contents.length === 0) return;
      sim.setAnim(target, Anim.Open);
      sim.emit({ t: "open", id: target.id });
      const items = it.contents.splice(0);
      items.forEach((item, k) => spawnPickup(sim, { x: target.pos.x, y: target.pos.y + 0.7, z: target.pos.z }, item, 0, k));
      sim.setFlag(target, Flag.Opened, true);
      return;
    }
    case "note":
      if (it.usedBy.has(player.id)) return;
      it.usedBy.add(player.id);
      sim.hooks.onNote(player.id, Number(it.data.stratum ?? 0), Number(it.data.pick ?? 0));
      return;
    case "mercy_candle":
      if (it.usedBy.has(player.id)) {
        sim.emit({ t: "msg", to: player.id, text: "The candle has already given you what it had.", kind: "info" });
        return;
      }
      it.usedBy.add(player.id);
      heal(sim, player, player.maxHp * 0.5);
      applyStatus(sim, player, "blessed", 10, 1, target.id);
      sim.emit({ t: "fx", fx: "blessing", p: [player.pos.x, player.pos.y, player.pos.z] });
      sim.emit({ t: "sound", id: "heal", p: [target.pos.x, target.pos.y, target.pos.z] });
      return;
    default:
      return;
  }
}

/** Spawn a Reliquary holding a dead delver's run loot. */
export function spawnReliquary(sim: FloorSim, pos: V3, owner: string, contents: unknown[]): Entity {
  const ground = sim.groundAt(pos.x, pos.z);
  const e = spawnInteractable(sim, "reliquary", { x: pos.x, y: ground > -50 ? ground : pos.y, z: pos.z }, sim.rng.range(0, 6.28), { owner });
  e.interact!.contents = contents;
  sim.emit({ t: "fx", fx: "reliquary_rise", p: [e.pos.x, e.pos.y, e.pos.z] });
  return e;
}

// ── Pickups ─────────────────────────────────────────────────────────────────

export function dropGold(sim: FloorSim, pos: V3, amount: number): void {
  if (amount <= 0) return;
  const e = spawnPickup(sim, pos, null, amount, 0);
  e.pickup!.auto = true;
}

/** Roll loot and scatter it as pickups. `baseId` forces a material. */
export function dropLootAt(sim: FloorSim, pos: V3, count: number, luck = 1, baseId?: string): void {
  const items = baseId ? [sim.hooks.makeStack(baseId, 1)] : sim.hooks.rollLoot(sim.rng, luck, count);
  items.forEach((item, k) => spawnPickup(sim, pos, item, 0, k));
}

export function spawnPickup(sim: FloorSim, pos: V3, item: unknown, gold: number, k: number): Entity {
  const base = gold > 0 ? "gold_coin" : ((item as { base?: string })?.base ?? "gold_coin");
  const e = sim.newEntity(EntityType.Pickup, base, pos, "wild");
  e.radius = 0.25;
  e.height = 0.3;
  const ang = sim.rng.range(0, Math.PI * 2) + k * 2.1;
  const sp = sim.rng.range(1.2, 2.6);
  e.vel = { x: Math.sin(ang) * sp, y: sim.rng.range(3, 5), z: Math.cos(ang) * sp };
  const cat = ITEMS.find(base)?.category;
  const auto = gold > 0 || cat === "material" || cat === "treasure";
  e.pickup = { item, gold, ownerOnlyUntil: 0, owner: 0, auto, life: 600 };
  if (item) {
    const info = sim.hooks.describeItem(item);
    if (info.rare) e.flags |= Flag.Rare;
  }
  return e;
}

function updatePickup(sim: FloorSim, e: Entity, dt: number): void {
  const pk = e.pickup!;
  pk.life -= dt;
  if (pk.life <= 0) {
    sim.remove(e);
    return;
  }
  // Tiny ballistic hop onto the grid floor (no rigid body needed).
  const ground = sim.groundAt(e.pos.x, e.pos.z) + 0.18;
  if (e.pos.y > ground + 0.001 || e.vel.y > 0) {
    e.vel.y -= 18 * dt;
    let nx = e.pos.x + e.vel.x * dt;
    let nz = e.pos.z + e.vel.z * dt;
    // Don't fly into walls.
    if (!sim.nav.walkable(Math.floor(nx), Math.floor(nz))) {
      nx = e.pos.x;
      nz = e.pos.z;
      e.vel.x *= -0.3;
      e.vel.z *= -0.3;
    }
    e.pos = { x: nx, y: Math.max(ground, e.pos.y + e.vel.y * dt), z: nz };
    if (e.pos.y <= ground) {
      e.vel = { x: 0, y: 0, z: 0 };
      e.pos.y = ground;
    }
    sim.touch(e);
  }
  if (!pk.auto) return;
  for (const p of sim.list(EntityType.Player)) {
    if (p.player!.dead) continue;
    if (v3dist(p.pos, e.pos) < 1.3) {
      takePickup(sim, p, e);
      break;
    }
  }
}

function takePickup(sim: FloorSim, player: Entity, e: Entity): void {
  const pk = e.pickup!;
  if (e.removed) return;
  if (pk.gold > 0) {
    sim.hooks.onGold(player.id, pk.gold);
    sim.emit({ t: "pickup", by: player.id, id: e.id, name: "Gold", rarity: "common", gold: pk.gold });
    sim.remove(e);
    return;
  }
  if (!sim.hooks.onPickup(player.id, pk.item)) {
    sim.emit({ t: "msg", to: player.id, text: "Your pack is full.", kind: "warn" });
    return;
  }
  const info = sim.hooks.describeItem(pk.item);
  sim.emit({ t: "pickup", by: player.id, id: e.id, name: info.name, rarity: info.rarity, gold: 0 });
  sim.remove(e);
}

// ── Update ──────────────────────────────────────────────────────────────────

export function updateObjects(sim: FloorSim, dt: number): void {
  for (const e of sim.list(EntityType.Trap)) updateTrap(sim, e, dt);
  for (const e of sim.list(EntityType.Pickup)) if (!e.removed) updatePickup(sim, e, dt);
  for (const e of sim.list(EntityType.Prop)) {
    const pr = e.prop!;
    if (pr.thrownBy && sim.time - pr.thrownTime > 2.5) pr.thrownBy = 0;
  }
  // Delvers notice hidden traps near them.
  if (sim.tick % 15 === 0) {
    for (const p of sim.list(EntityType.Player)) {
      for (const t of sim.list(EntityType.Trap)) {
        if (!(t.flags & Flag.Hidden)) continue;
        const d = v3dist(p.pos, t.pos);
        if (d > 5) continue;
        if (sim.rng.chance(t.trap!.def.visibility * (1 - d / 6) * 0.5)) {
          sim.setFlag(t, Flag.Hidden, false);
          sim.emit({ t: "msg", to: p.id, text: `You notice a ${t.trap!.def.name.toLowerCase()}.`, kind: "info" });
        }
      }
    }
  }
}
