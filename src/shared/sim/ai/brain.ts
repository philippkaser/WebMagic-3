import { isHostile, isPrey, fears } from "../../content/factions";
import { Surface } from "../../content/types";
import { surfaceDef } from "../../content";
import { v3dist, v3distXZ, type V3 } from "../../util/math";
import { startAttack } from "../creatures";
import { Anim, EntityType, Flag, type Entity } from "../entity";
import type { FloorSim } from "../FloorSim";
import { heal } from "../combat";

/** Creature decision making — perception, a small utility selector over
 * behaviours, and steering along grid paths.
 *
 * The same rules apply to every body in the world, which is what produces
 * the unscripted moments: creatures of hostile factions fight each other,
 * predators eat prey corpses, anyone who gets hit holds a grudge (even
 * against its own kind), dumb creatures blunder over pressure plates that
 * clever ones route around, and nothing thinks about traps while it flees. */

export interface Perceived {
  target: Entity | null;
  threat: Entity | null;
  visibleFoes: number;
}

const HARMFUL = new Set<Surface>([Surface.Fire, Surface.Acid, Surface.Lava]);

export function think(sim: FloorSim, e: Entity, dt: number): void {
  const c = e.creature!;
  c.behaviorTime += dt;
  const def = c.def;
  const per = perceive(sim, e);

  const alerted = !!per.target;
  if (alerted !== ((e.flags & Flag.Alerted) !== 0)) sim.setFlag(e, Flag.Alerted, alerted);
  if (per.target && c.targetId !== per.target.id) {
    // Newly spotted: call nearby kin.
    if (def.temperament.callRadius) callAllies(sim, e, per.target, def.temperament.callRadius);
    if (def.voice) sim.emit({ t: "sound", id: `${def.voice}_alert`, p: [e.pos.x, e.pos.y, e.pos.z] });
  }
  c.targetId = per.target?.id ?? 0;
  if (per.target) c.lastSeen = { id: per.target.id, pos: { ...per.target.pos }, time: sim.time };

  const has = (b: string) => def.behaviors.includes(b as never);
  const hpFrac = e.hp / e.maxHp;
  const under = sim.surfaces.at(e.pos.x, e.pos.z);
  const burning = e.statuses.has("burning");
  const feared = e.statuses.has("feared");

  let next: string;
  if (c.behavior === "sleep" && !per.target) next = "sleep";
  else if (has("avoid_hazard") && (burning || HARMFUL.has(under)) && !c.warden) next = "avoid_hazard";
  else if (feared || (has("flee") && hpFrac < def.temperament.courage && per.threat)) next = "flee";
  else if (per.target && !c.warden && fears(e.team, per.target.team) && per.target.hp > e.hp) next = "flee";
  else if (per.target) next = has("kite") && hasRanged(e) ? "kite" : "hunt";
  else if (c.lastSeen && sim.time - c.lastSeen.time < 8 && has("hunt")) next = "search";
  else if (c.noise && sim.time - c.noise.time < 10 && has("investigate")) next = "investigate";
  else if (has("feed") && c.hunger > 0.35 && findFood(sim, e)) next = "feed";
  else if (c.warden || has("guard")) next = "guard";
  else next = has("patrol") ? "patrol" : "wander";

  if (next !== c.behavior) {
    c.behavior = next;
    c.behaviorTime = 0;
    c.scratch = {};
    c.path = [];
    if (next !== "sleep") sim.setFlag(e, Flag.Asleep, false);
    if (next === "feed" || e.anim === Anim.Feed) sim.setAnim(e, Anim.Idle);
  }

  const speed = def.stats.speed;
  const run = speed * (def.stats.runMult ?? 1.3);
  switch (c.behavior) {
    case "sleep":
      c.wantVel = { x: 0, y: 0, z: 0 };
      sim.setAnim(e, Anim.Sleep);
      break;
    case "wander":
    case "patrol":
      wander(sim, e, c.behavior === "patrol" ? 14 : 5, speed * 0.45);
      break;
    case "guard":
      if (v3distXZ(e.pos, c.home) > 2) moveTo(sim, e, c.home, speed * 0.6, true);
      else c.wantVel = { x: 0, y: 0, z: 0 };
      break;
    case "hunt":
      hunt(sim, e, per.target!, run);
      break;
    case "kite":
      kite(sim, e, per.target!, run);
      break;
    case "search":
      if (!moveTo(sim, e, c.lastSeen!.pos, run * 0.8, true) || v3distXZ(e.pos, c.lastSeen!.pos) < 1) c.lastSeen = null;
      break;
    case "investigate":
      if (!moveTo(sim, e, c.noise!.pos, speed * 0.8, true) || v3distXZ(e.pos, c.noise!.pos) < 1.2) c.noise = null;
      break;
    case "flee": {
      const from = per.threat ?? per.target;
      flee(sim, e, from?.pos ?? c.lastSeen?.pos ?? e.pos, run * 1.1);
      if (def.voice && c.behaviorTime < dt * 1.5) sim.emit({ t: "sound", id: `${def.voice}_hurt`, p: [e.pos.x, e.pos.y, e.pos.z] });
      break;
    }
    case "avoid_hazard":
      avoidHazard(sim, e, run, burning);
      break;
    case "feed":
      feed(sim, e, speed, dt);
      break;
  }

  // Wardens change phase below half health.
  if (c.warden && c.warden.phase === 1 && hpFrac < 0.5) {
    c.warden.phase = 2;
    sim.emit({ t: "warden", id: e.id, phase: 2, name: def.name });
    sim.emit({ t: "sound", id: "warden_phase", p: [e.pos.x, e.pos.y, e.pos.z] });
  }
}

// ── Perception ──────────────────────────────────────────────────────────────

function perceive(sim: FloorSim, e: Entity): Perceived {
  const c = e.creature!;
  const s = c.def.senses;
  const eye = { x: e.pos.x, y: e.pos.y + e.height * 0.35, z: e.pos.z };
  const fovCos = Math.cos(((c.behavior === "hunt" || c.behavior === "kite" ? 360 : s.fov) * Math.PI) / 360);
  const fx = -Math.sin(e.yaw);
  const fz = -Math.cos(e.yaw);
  let best: Entity | null = null;
  let bestScore = -Infinity;
  let threat: Entity | null = null;
  let threatD = Infinity;
  let count = 0;

  const consider = (o: Entity) => {
    if (o === e || o.removed || o.hp <= 0) return;
    const grudge = c.grudges.get(o.id) ?? 0;
    const hostile = hostileTo(e, o) || grudge > e.maxHp * 0.15;
    if (!hostile) return;
    let range = s.sight * (s.darkvision ? 1 : 0.85);
    if (o.player) range *= 1 - o.player.stats.stealth;
    if (o.statuses.has("invisible")) range *= 0.15;
    if (c.behavior === "sleep") range *= 0.25;
    if (c.behavior === "feed") range *= 0.6;
    const d = v3dist(o.pos, e.pos);
    if (d > range && grudge === 0) return;
    const dx = (o.pos.x - e.pos.x) / (d || 1);
    const dz = (o.pos.z - e.pos.z) / (d || 1);
    if (d > 2.5 && dx * fx + dz * fz < fovCos && grudge === 0) return;
    const oeye = { x: o.pos.x, y: o.pos.y + o.height * 0.3, z: o.pos.z };
    if (!sim.lineOfSight(eye, oeye)) return;
    count++;
    const score = -d + grudge * 0.3 + (o.id === c.targetId ? 3 : 0) + (o.player ? 1 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = o;
    }
    if (d < threatD) {
      threatD = d;
      threat = o;
    }
  };
  for (const o of sim.list(EntityType.Player)) if (!o.player!.dead) consider(o);
  for (const o of sim.list(EntityType.Creature)) consider(o);
  // A grudge target out of sight is still remembered by lastSeen.
  return { target: best, threat, visibleFoes: count };
}

function hostileTo(e: Entity, o: Entity): boolean {
  if (o.player) return e.team !== "helpers" && !(e.flags & Flag.Helper);
  if (e.team === "helpers") return isHostile("helpers", o.team);
  if (o.team === "helpers") return true;
  return isHostile(e.team, o.team);
}

function callAllies(sim: FloorSim, e: Entity, target: Entity, radius: number): void {
  for (const o of sim.list(EntityType.Creature)) {
    if (o === e || o.hp <= 0 || o.team !== e.team) continue;
    if (v3dist(o.pos, e.pos) > radius) continue;
    const oc = o.creature!;
    if (oc.targetId) continue;
    oc.lastSeen = { id: target.id, pos: { ...target.pos }, time: sim.time };
    if (oc.behavior === "sleep") sim.setFlag(o, Flag.Asleep, false);
    oc.behavior = "search";
  }
}

function hasRanged(e: Entity): boolean {
  return e.creature!.def.attacks.some((a) => a.kind === "ranged" || a.kind === "spell" || a.kind === "breath");
}

// ── Behaviours ──────────────────────────────────────────────────────────────

function hunt(sim: FloorSim, e: Entity, target: Entity, speed: number): void {
  const c = e.creature!;
  const d = v3dist(target.pos, e.pos);
  if (!c.attack) {
    const idx = chooseAttack(sim, e, target, d);
    if (idx >= 0) {
      startAttack(sim, e, idx, target);
      return;
    }
  }
  if (c.attack) return;
  const melee = Math.min(...c.def.attacks.filter((a) => a.kind === "melee" || a.kind === "lunge" || a.kind === "grab" || a.kind === "slam").map((a) => a.range), 99);
  // Swarmers spread around the target instead of queueing behind each other.
  let goal = target.pos;
  if (c.def.behaviors.includes("swarm") && d < 5) {
    const ang = (e.id * 2.39996) % (Math.PI * 2);
    goal = { x: target.pos.x + Math.sin(ang) * 1.1, y: target.pos.y, z: target.pos.z + Math.cos(ang) * 1.1 };
  }
  if (d < Math.min(melee, 99) * 0.8) {
    c.wantVel = { x: 0, y: 0, z: 0 };
    return;
  }
  moveTo(sim, e, goal, speed, true);
}

function kite(sim: FloorSim, e: Entity, target: Entity, speed: number): void {
  const c = e.creature!;
  const d = v3dist(target.pos, e.pos);
  if (!c.attack) {
    const idx = chooseAttack(sim, e, target, d);
    if (idx >= 0) {
      startAttack(sim, e, idx, target);
      return;
    }
  }
  if (c.attack) return;
  const ranged = c.def.attacks.find((a) => a.kind === "ranged" || a.kind === "spell" || a.kind === "breath")!;
  const ideal = (ranged.range + (ranged.minRange ?? 3)) / 2;
  if (d < (ranged.minRange ?? 3) + 0.5) flee(sim, e, target.pos, speed * 0.8);
  else if (d > ideal + 2 || !sim.lineOfSight(e.pos, target.pos)) moveTo(sim, e, target.pos, speed * 0.8, true);
  else {
    // Strafe to stay unpredictable.
    const side = (e.id & 1 ? 1 : -1) * (Math.sin(sim.time * 0.7 + e.id) > 0 ? 1 : -1);
    const dx = (target.pos.x - e.pos.x) / (d || 1);
    const dz = (target.pos.z - e.pos.z) / (d || 1);
    const sv = { x: -dz * side * speed * 0.5, y: 0, z: dx * side * speed * 0.5 };
    const probe = { x: e.pos.x + sv.x * 0.5, y: e.pos.y, z: e.pos.z + sv.z * 0.5 };
    c.wantVel = sim.nav.clearWalk(e.pos, probe) ? sv : { x: 0, y: 0, z: 0 };
  }
}

function chooseAttack(sim: FloorSim, e: Entity, target: Entity, d: number): number {
  const c = e.creature!;
  const eye = { x: e.pos.x, y: e.pos.y + e.height * 0.3, z: e.pos.z };
  const teye = { x: target.pos.x, y: target.pos.y + target.height * 0.2, z: target.pos.z };
  const los = sim.lineOfSight(eye, teye);
  const options: number[] = [];
  c.def.attacks.forEach((a, i) => {
    if (c.cooldowns[i] > 0) return;
    if (d > a.range + target.radius || d < (a.minRange ?? 0)) return;
    if (!los) return;
    // Melee needs to be roughly level with the target.
    if ((a.kind === "melee" || a.kind === "grab") && Math.abs(target.pos.y - e.pos.y) > 1.6) return;
    options.push(i);
  });
  if (!options.length) return -1;
  return sim.rng.weighted(options, (i) => c.def.attacks[i].weight ?? 1);
}

function wander(sim: FloorSim, e: Entity, radius: number, speed: number): void {
  const c = e.creature!;
  const sc = c.scratch;
  if (!sc.gx || sim.time > sc.until || v3distXZ(e.pos, { x: sc.gx, y: 0, z: sc.gz }) < 0.8) {
    // Pick a nearby walkable point, then idle a while.
    for (let tries = 0; tries < 8; tries++) {
      const gx = c.home.x + sim.rng.range(-radius, radius);
      const gz = c.home.z + sim.rng.range(-radius, radius);
      if (sim.nav.walkable(Math.floor(gx), Math.floor(gz), c.def.movement === "fly")) {
        sc.gx = gx;
        sc.gz = gz;
        break;
      }
    }
    sc.until = sim.time + sim.rng.range(4, 9);
    sc.rest = sim.time + sim.rng.range(0, 3);
  }
  if (sim.time < sc.rest) {
    c.wantVel = { x: 0, y: 0, z: 0 };
    return;
  }
  moveTo(sim, e, { x: sc.gx, y: e.pos.y, z: sc.gz }, speed, true);
}

function flee(sim: FloorSim, e: Entity, from: V3, speed: number): void {
  const c = e.creature!;
  const sc = c.scratch;
  if (!sc.fx || sim.time > sc.until) {
    // Pick the walkable point that is furthest from the threat among a few.
    let best: V3 | null = null;
    let bestD = -1;
    for (let tries = 0; tries < 10; tries++) {
      const gx = e.pos.x + sim.rng.range(-12, 12);
      const gz = e.pos.z + sim.rng.range(-12, 12);
      if (!sim.nav.walkable(Math.floor(gx), Math.floor(gz), c.def.movement === "fly")) continue;
      const d = Math.hypot(gx - from.x, gz - from.z);
      if (d > bestD) {
        bestD = d;
        best = { x: gx, y: e.pos.y, z: gz };
      }
    }
    if (best) {
      sc.fx = best.x;
      sc.fz = best.z;
    }
    sc.until = sim.time + 2.5;
  }
  sim.setAnim(e, Anim.Flee);
  // Panic: no trap or hazard costs — fleeing things blunder.
  moveTo(sim, e, { x: sc.fx ?? e.pos.x, y: e.pos.y, z: sc.fz ?? e.pos.z }, speed, false);
}

function avoidHazard(sim: FloorSim, e: Entity, speed: number, burning: boolean): void {
  const c = e.creature!;
  // Burning and clever: run for water first. Otherwise any safe cell.
  const goals: Surface[] = burning && c.def.intelligence > 0.4 ? [Surface.Water, Surface.None] : [Surface.None];
  for (const want of goals) {
    let best: V3 | null = null;
    for (let r = 1; r <= 8 && !best; r++) {
      for (let a = 0; a < 12 && !best; a++) {
        const ang = (a / 12) * Math.PI * 2;
        const x = e.pos.x + Math.sin(ang) * r;
        const z = e.pos.z + Math.cos(ang) * r;
        if (!sim.nav.walkable(Math.floor(x), Math.floor(z))) continue;
        const s = sim.surfaces.at(x, z);
        const safe = !HARMFUL.has(s) && !(burning && s !== Surface.None && surfaceDef(s).flammable);
        if (want === Surface.Water ? s === Surface.Water : safe) best = { x, y: e.pos.y, z };
      }
    }
    if (best) {
      sim.setAnim(e, Anim.Flee);
      moveTo(sim, e, best, speed, false);
      return;
    }
  }
  wander(sim, e, 6, speed);
}

function findFood(sim: FloorSim, e: Entity): Entity | null {
  const c = e.creature!;
  let best: Entity | null = null;
  let bestD = 14;
  for (const o of sim.list(EntityType.Creature)) {
    if (o === e || o.hp > 0 || !(o.flags & Flag.Corpse)) continue;
    // Vermin eat anything dead; predators eat their prey.
    const edible = e.team === "vermin" || e.team === "carrion" || isPrey(e.team, o.team);
    if (!edible) continue;
    const d = v3dist(o.pos, e.pos);
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  if (best) c.scratch.food = best.id;
  return best;
}

function feed(sim: FloorSim, e: Entity, speed: number, dt: number): void {
  const c = e.creature!;
  const food = sim.get(c.scratch.food ?? 0);
  if (!food || food.hp > 0) {
    c.behavior = "wander";
    return;
  }
  if (v3distXZ(food.pos, e.pos) > e.radius + 0.7) {
    moveTo(sim, e, food.pos, speed, true);
    return;
  }
  c.wantVel = { x: 0, y: 0, z: 0 };
  sim.setAnim(e, Anim.Feed);
  c.hunger = Math.max(0, c.hunger - dt * 0.08);
  heal(sim, e, e.maxHp * 0.02 * dt);
  if (sim.rng.chance(0.05)) sim.emit({ t: "sound", id: `${c.def.voice ?? "rat"}_idle`, p: [e.pos.x, e.pos.y, e.pos.z] });
  // Feeding things gnaw corpses down.
  if (food.creature) food.creature.deadTime += dt * 0.5;
}

// ── Steering ────────────────────────────────────────────────────────────────

/** Steer toward `goal` along a grid path. `careful` makes the path avoid
 * known traps and visible hazards (clever creatures only). Returns false
 * when the goal is unreachable. */
export function moveTo(sim: FloorSim, e: Entity, goal: V3, speed: number, careful: boolean): boolean {
  const c = e.creature!;
  const flying = c.def.movement === "fly" || c.def.movement === "hover";
  const direct = v3distXZ(goal, e.pos) < 10 && sim.nav.clearWalk(e.pos, goal, flying) && !pathCrossesKnownTrap(sim, e, goal, careful);
  let waypoint: V3 | null = null;
  if (direct) {
    waypoint = goal;
    c.path = [];
  } else {
    const stale = !c.pathGoal || v3distXZ(c.pathGoal, goal) > 1.5 || sim.time - c.pathTime > 1.2 || c.path.length === 0;
    if (stale) {
      const cost = careful ? costFn(sim, e) : undefined;
      c.path = sim.nav.find(e.pos, goal, { cost, flying, maxNodes: 2500 }) ?? [];
      c.pathGoal = { ...goal };
      c.pathTime = sim.time;
      if (!c.path.length) {
        c.wantVel = { x: 0, y: 0, z: 0 };
        return false;
      }
    }
    while (c.path.length && v3distXZ(c.path[0], e.pos) < 0.45) c.path.shift();
    waypoint = c.path[0] ?? goal;
  }
  const dx = waypoint.x - e.pos.x;
  const dz = waypoint.z - e.pos.z;
  const d = Math.hypot(dx, dz) || 1;
  let vx = (dx / d) * speed;
  let vz = (dz / d) * speed;
  // Separation from kin so groups don't stack into one column.
  for (const o of sim.list(EntityType.Creature)) {
    if (o === e || o.hp <= 0 || o.team !== e.team) continue;
    const ox = e.pos.x - o.pos.x;
    const oz = e.pos.z - o.pos.z;
    const od = Math.hypot(ox, oz);
    const min = e.radius + o.radius + 0.25;
    if (od > 0.01 && od < min) {
      vx += (ox / od) * speed * 0.6 * (1 - od / min);
      vz += (oz / od) * speed * 0.6 * (1 - od / min);
    }
  }
  let vy = 0;
  if (flying) {
    const floor = sim.groundAt(e.pos.x, e.pos.z);
    const wantY = Math.max(floor + 1.4, Math.min(goal.y + 0.6, floor + 3));
    vy = (wantY - e.pos.y) * 2;
  }
  c.wantVel = { x: vx, y: vy, z: vz };
  return true;
}

function pathCrossesKnownTrap(sim: FloorSim, e: Entity, goal: V3, careful: boolean): boolean {
  const c = e.creature!;
  if (!careful || c.knownTraps.size === 0) return false;
  for (const id of c.knownTraps) {
    const t = sim.get(id);
    if (!t) continue;
    // Distance from trap to the segment e→goal.
    const ax = goal.x - e.pos.x;
    const az = goal.z - e.pos.z;
    const len2 = ax * ax + az * az || 1;
    const u = Math.max(0, Math.min(1, ((t.pos.x - e.pos.x) * ax + (t.pos.z - e.pos.z) * az) / len2));
    const px = e.pos.x + ax * u;
    const pz = e.pos.z + az * u;
    if (Math.hypot(px - t.pos.x, pz - t.pos.z) < 1) return true;
  }
  return false;
}

function costFn(sim: FloorSim, e: Entity): (x: number, z: number) => number {
  const c = e.creature!;
  const trapCells = new Set<number>();
  const w = sim.layout.grid.w;
  for (const id of c.knownTraps) {
    const t = sim.get(id);
    if (t) trapCells.add(Math.floor(t.pos.z) * w + Math.floor(t.pos.x));
  }
  const smart = c.def.intelligence > 0.3;
  return (x, z) => {
    let cost = 0;
    if (trapCells.has(z * w + x)) cost += 25;
    if (smart) {
      const s = sim.surfaces.at(x + 0.5, z + 0.5);
      if (HARMFUL.has(s)) cost += 15;
    }
    return cost;
  };
}
