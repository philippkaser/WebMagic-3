import { floorScale, isWardenFloor } from "../config";
import { CREATURES, PROPS, TRAPS } from "../content";
import { Surface, type BiomeDef } from "../content/types";
import { yawOf } from "../util/math";
import type { Rng } from "../util/rng";
import { cellPos, roomCells, wallDirs } from "./generators/common";
import { CellKind, CellTag, type DecorSpec, type FixtureSpec, type FloorGrid, type Room, type SpawnSpec } from "./layout";

/** Fills a carved floor with life and dressing according to its biome:
 * light fixtures, props in believable clusters, creatures in groups by room
 * depth, traps where feet go, and the floor's interactables. Each phase
 * draws from its own Rng fork so tuning one never reshuffles the others. */

export interface Population {
  spawns: SpawnSpec[];
  fixtures: FixtureSpec[];
  decor: DecorSpec[];
  surfaces: { x: number; z: number; surface: Surface }[];
}

const FIXTURE_LIGHT: Record<string, { color: string; intensity: number; radius: number; flicker: number; height: number }> = {
  wall_torch: { color: "#ff9a40", intensity: 2.6, radius: 8.5, flicker: 1, height: 2.1 },
  candles: { color: "#ffb35a", intensity: 1.3, radius: 5, flicker: 0.6, height: 0.3 },
  brazier: { color: "#ff7a2a", intensity: 3.2, radius: 10, flicker: 0.9, height: 1.1 },
  glow_fungus: { color: "#7ae0c8", intensity: 1.2, radius: 5, flicker: 0.1, height: 0.4 },
  forge_glow: { color: "#ff5a1a", intensity: 3, radius: 9, flicker: 0.5, height: 0.6 },
  cold_lantern: { color: "#9fd8ff", intensity: 2, radius: 8, flicker: 0.2, height: 2.2 },
};

export function populate(g: FloorGrid, rooms: Room[], rng: Rng, floor: number, biome: BiomeDef): Population {
  const pop: Population = { spawns: [], fixtures: [], decor: [], surfaces: [] };
  const occupied = new Set<number>();
  const take = (x: number, z: number) => {
    const i = z * g.w + x;
    if (occupied.has(i)) return false;
    occupied.add(i);
    return true;
  };

  placeFixtures(g, rooms, rng.fork("fixtures"), biome, pop);
  placeInteractables(g, rooms, rng.fork("interactables"), floor, biome, pop, take);
  placeProps(g, rooms, rng.fork("props"), biome, pop, take);
  placeCreatures(g, rooms, rng.fork("creatures"), floor, biome, pop, take);
  placeTraps(g, rooms, rng.fork("traps"), floor, biome, pop, take);
  placeDressing(g, rooms, rng.fork("dressing"), biome, pop);
  return pop;
}

function placeFixtures(g: FloorGrid, rooms: Room[], rng: Rng, biome: BiomeDef, pop: Population): void {
  const kind = biome.lighting.fixture;
  const L = FIXTURE_LIGHT[kind] ?? FIXTURE_LIGHT.wall_torch;
  const hung = new Set<number>();
  for (const r of rooms) {
    const perimeter = 2 * (r.w + r.h);
    const count = Math.max(1, Math.round((perimeter / 9) * biome.lighting.fixtureDensity * rng.range(0.6, 1.3)));
    const edge = rng.shuffle(roomCells(g, r, { edge: true }));
    let placed = 0;
    for (const [x, z] of edge) {
      if (placed >= count) break;
      const dirs = wallDirs(g, x, z);
      if (dirs.length === 0) continue;
      const i = z * g.w + x;
      // Space torches apart.
      let near = false;
      for (const h of hung) {
        const hx = h % g.w;
        const hz = (h / g.w) | 0;
        if (Math.abs(hx - x) + Math.abs(hz - z) < 4) near = true;
      }
      if (near) continue;
      hung.add(i);
      const [dx, dz] = dirs[0];
      const p = cellPos(g, x, z, L.height);
      p.x += dx * 0.42;
      p.z += dz * 0.42;
      pop.fixtures.push({
        def: kind,
        pos: p,
        yaw: yawOf(-dx, -dz),
        light: { color: L.color, intensity: L.intensity, radius: L.radius, flicker: L.flicker },
        burning: kind !== "glow_fungus" && kind !== "cold_lantern",
      });
      placed++;
    }
  }
  // Candles on the floor of shrines and arrival rooms.
  for (const r of rooms) {
    if (r.role !== "shrine" && r.role !== "arrival") continue;
    const C = FIXTURE_LIGHT.candles;
    for (const [x, z] of rng.shuffle(roomCells(g, r, { edge: true })).slice(0, 3)) {
      pop.fixtures.push({ def: "candles", pos: cellPos(g, x, z, 0), yaw: rng.range(0, Math.PI * 2), light: { ...C }, burning: true });
    }
  }
}

function center(r: Room): [number, number] {
  return [Math.floor(r.x + r.w / 2), Math.floor(r.z + r.h / 2)];
}

function placeInteractables(
  g: FloorGrid,
  rooms: Room[],
  rng: Rng,
  floor: number,
  biome: BiomeDef,
  pop: Population,
  take: (x: number, z: number) => boolean,
): void {
  for (const r of rooms) {
    const [cx, cz] = center(r);
    if (r.role === "arrival") {
      take(cx, cz);
      pop.spawns.push({ kind: "interactable", def: "arrival", pos: cellPos(g, cx, cz), yaw: 0 });
    } else if (r.role === "descent") {
      take(cx, cz);
      const warden = isWardenFloor(floor);
      pop.spawns.push({ kind: "interactable", def: "descent", pos: cellPos(g, cx, cz), yaw: 0, data: { sealed: warden } });
      if (warden && CREATURES.has(biome.warden)) {
        // The warden waits between the descent and the way in.
        const wz = cz + (r.h > 6 ? 2 : 1);
        take(cx, wz);
        pop.spawns.push({ kind: "creature", def: biome.warden, pos: cellPos(g, cx, wz, 0.1), yaw: 0, data: { warden: true } });
      }
    } else if (r.role === "treasure") {
      take(cx, cz);
      pop.spawns.push({ kind: "interactable", def: "chest", pos: cellPos(g, cx, cz), yaw: rng.range(0, 6.28), data: { tier: 2 } });
    } else if (r.role === "shrine") {
      take(cx, cz);
      pop.spawns.push({ kind: "interactable", def: "mercy_candle", pos: cellPos(g, cx, cz), yaw: 0 });
    }
  }
  // Lore notes: one or two per floor, in quiet corners.
  const noteRooms = rng.shuffle(rooms.filter((r) => r.role !== "arrival" && r.role !== "descent")).slice(0, rng.int(1, 2));
  for (const r of noteRooms) {
    const cells = rng.shuffle(roomCells(g, r, { edge: true }));
    const c = cells.find(([x, z]) => take(x, z));
    if (c) pop.spawns.push({ kind: "interactable", def: "note", pos: cellPos(g, c[0], c[1]), yaw: 0, data: { stratum: biome.index, pick: rng.int(0, 9999) } });
  }
}

function placeProps(
  g: FloorGrid,
  rooms: Room[],
  rng: Rng,
  biome: BiomeDef,
  pop: Population,
  take: (x: number, z: number) => boolean,
): void {
  const table = biome.props.filter((p) => PROPS.has(p.id));
  if (table.length === 0) return;
  for (const r of rooms) {
    if (r.role === "arrival") continue;
    const clusters = rng.int(1, Math.max(1, Math.round((r.w * r.h) / 30)));
    const edge = rng.shuffle(roomCells(g, r, { edge: true }));
    for (let c = 0; c < clusters && edge.length; c++) {
      const [x0, z0] = edge.pop()!;
      const n = rng.int(1, 4);
      for (let k = 0; k < n; k++) {
        const x = x0 + (k === 0 ? 0 : rng.int(-1, 1));
        const z = z0 + (k === 0 ? 0 : rng.int(-1, 1));
        const i = z * g.w + x;
        if (g.kind[i] !== CellKind.Open || g.liquid[i] || g.tags[i] & (CellTag.NoSpawn | CellTag.Door | CellTag.Bridge)) continue;
        if (!take(x, z)) continue;
        const def = rng.weighted(table, (p) => p.weight).id;
        const shape = PROPS.get(def).shape;
        const halfH = shape.kind === "box" ? shape.half[1] : shape.kind === "cylinder" ? shape.halfHeight : shape.radius;
        const p = cellPos(g, x, z, halfH + 0.02);
        p.x += rng.range(-0.2, 0.2);
        p.z += rng.range(-0.2, 0.2);
        pop.spawns.push({ kind: "prop", def, pos: p, yaw: rng.range(0, Math.PI * 2) });
        // Occasionally stack a small prop on a crate.
        if (def === "crate" && rng.chance(0.25)) {
          pop.spawns.push({ kind: "prop", def: rng.chance(0.5) ? "crate_small" : "urn", pos: { x: p.x, y: p.y + 0.72, z: p.z }, yaw: rng.range(0, 6.28) });
        }
      }
    }
  }
}

function placeCreatures(
  g: FloorGrid,
  rooms: Room[],
  rng: Rng,
  floor: number,
  biome: BiomeDef,
  pop: Population,
  take: (x: number, z: number) => boolean,
): void {
  const depth = (floor - 1) % 10;
  const table = biome.creatures.filter((c) => CREATURES.has(c.id) && (c.minDepth ?? 0) <= depth);
  if (table.length === 0) return;
  let budget = floorScale(floor).creatureBudget;
  const candidates = rooms.filter((r) => r.role !== "arrival" && r.depth >= 1);
  // Deeper rooms (from the arrival) hold more.
  const order = rng.shuffle([...candidates]).sort((a, b) => b.depth - a.depth);
  let guard = 0;
  while (budget > 0 && guard++ < 200 && order.length) {
    const r = order[guard % order.length];
    const entry = rng.weighted(table, (c) => c.weight);
    const [gmin, gmax] = entry.group ?? [1, 1];
    const n = Math.min(budget, rng.int(gmin, gmax));
    const cells = rng.shuffle(roomCells(g, r, { inset: 1 }));
    let placed = 0;
    for (const [x, z] of cells) {
      if (placed >= n) break;
      if (!take(x, z)) continue;
      const def = CREATURES.get(entry.id);
      const lift = def.movement === "fly" || def.movement === "hover" ? 1.4 : def.height / 2 + 0.05;
      pop.spawns.push({ kind: "creature", def: entry.id, pos: cellPos(g, x, z, lift), yaw: rng.range(0, Math.PI * 2) });
      placed++;
    }
    budget -= Math.max(1, placed);
  }
}

function placeTraps(
  g: FloorGrid,
  rooms: Room[],
  rng: Rng,
  floor: number,
  biome: BiomeDef,
  pop: Population,
  take: (x: number, z: number) => boolean,
): void {
  const table = biome.traps.filter((t) => TRAPS.has(t.id));
  if (!table.length) return;
  const count = Math.min(3 + Math.floor(((floor - 1) % 10) * 0.8), 12);
  // Doorways and corridors are where feet go.
  const hot: [number, number][] = [];
  for (let z = 1; z < g.h - 1; z++) {
    for (let x = 1; x < g.w - 1; x++) {
      const i = z * g.w + x;
      if (g.kind[i] !== CellKind.Open || g.liquid[i] || g.tags[i] & (CellTag.NoSpawn | CellTag.Bridge)) continue;
      const room = g.region[i] >= 0 ? rooms[g.region[i]] : null;
      if (room && room.role === "arrival") continue;
      if (g.tags[i] & (CellTag.Door | CellTag.Corridor) || rng.chance(0.03)) hot.push([x, z]);
    }
  }
  rng.shuffle(hot);
  let placed = 0;
  for (const [x, z] of hot) {
    if (placed >= count) break;
    const def = TRAPS.get(rng.weighted(table, (t) => t.weight).id);
    if (def.mount === "wall") {
      const dirs = wallDirs(g, x, z);
      if (!dirs.length || !take(x, z)) continue;
      const [dx, dz] = dirs[0];
      const p = cellPos(g, x, z, 1.1);
      p.x += dx * 0.48;
      p.z += dz * 0.48;
      pop.spawns.push({ kind: "trap", def: def.id, pos: p, yaw: yawOf(-dx, -dz) });
    } else {
      if (!take(x, z)) continue;
      pop.spawns.push({ kind: "trap", def: def.id, pos: cellPos(g, x, z, 0), yaw: 0 });
    }
    placed++;
  }
}

function placeDressing(g: FloorGrid, rooms: Room[], rng: Rng, biome: BiomeDef, pop: Population): void {
  for (const r of rooms) {
    // Puddles and old blood; webs in corners.
    const cells = roomCells(g, r);
    for (const [x, z] of cells) {
      const roll = rng.next();
      if (roll < 0.02) pop.surfaces.push({ x, z, surface: Surface.Blood });
      else if (roll < 0.035 && biome.liquids?.some((l) => l.surface === Surface.Water)) pop.surfaces.push({ x, z, surface: Surface.Water });
    }
    for (const [x, z] of roomCells(g, r, { edge: true })) {
      if (wallDirs(g, x, z).length >= 2 && rng.chance(0.3)) pop.surfaces.push({ x, z, surface: Surface.Web });
      else if (rng.chance(0.06)) pop.decor.push({ def: "rubble", pos: cellPos(g, x, z), yaw: rng.range(0, 6.28), scale: rng.range(0.7, 1.2) });
    }
    // Niches hold bones.
    for (let z = r.z - 1; z <= r.z + r.h; z++) {
      for (let x = r.x - 1; x <= r.x + r.w; x++) {
        if (x < 0 || z < 0 || x >= g.w || z >= g.h) continue;
        const i = z * g.w + x;
        if (g.region[i] === r.id && g.tags[i] & CellTag.NoSpawn && g.kind[i] === CellKind.Open && (x < r.x || z < r.z || x >= r.x + r.w || z >= r.z + r.h)) {
          pop.decor.push({ def: rng.chance(0.4) ? "skull" : "bones_niche", pos: cellPos(g, x, z), yaw: rng.range(0, 6.28), scale: 1 });
        }
      }
    }
  }
}
