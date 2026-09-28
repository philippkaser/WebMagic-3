import { CELL, HEIGHT_STEP } from "../../config";
import type { Rng } from "../../util/rng";
import { CellKind, CellTag, createGrid, type FloorGrid, type Room, type RoomRole } from "../layout";

/** Shared building blocks for the per-biome generators: room placement,
 * spanning-tree connectivity with loops, stepped corridors, pillars, pits,
 * flooding, and graph analysis. Biome generators compose these with their
 * own shapes and dressing. Everything here is pure and draws only from the
 * Rng it is handed. */

export interface RoomPlan {
  count: number;
  minSize: number;
  maxSize: number;
  /** Gap kept between rooms (cells). */
  padding: number;
  /** Possible floor heights for rooms (m). */
  heights: number[];
  ceiling: [number, number];
}

export const snapH = (h: number) => Math.round(h / HEIGHT_STEP) * HEIGHT_STEP;

export function newGrid(w: number, h: number): FloorGrid {
  return createGrid(w, h);
}

/** Place non-overlapping rectangular rooms by rejection sampling. */
export function placeRooms(g: FloorGrid, rng: Rng, plan: RoomPlan): Room[] {
  const rooms: Room[] = [];
  for (let tries = 0; tries < plan.count * 40 && rooms.length < plan.count; tries++) {
    const w = rng.int(plan.minSize, plan.maxSize);
    const h = rng.int(plan.minSize, plan.maxSize);
    const x = rng.int(2, g.w - w - 3);
    const z = rng.int(2, g.h - h - 3);
    if (rooms.some((r) => x - plan.padding < r.x + r.w && x + w + plan.padding > r.x && z - plan.padding < r.z + r.h && z + h + plan.padding > r.z)) continue;
    const floor = snapH(rng.pick(plan.heights));
    const ceil = snapH(floor + rng.range(plan.ceiling[0], plan.ceiling[1]));
    rooms.push({ id: rooms.length, x, z, w, h, role: "chamber", floor, ceil, depth: 0, tags: [] });
  }
  return rooms;
}

export function carveRoom(g: FloorGrid, r: Room, mats: { floor?: number; wall?: number; ceil?: number } = {}): void {
  for (let z = r.z; z < r.z + r.h; z++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      const i = z * g.w + x;
      g.kind[i] = CellKind.Open;
      g.floor[i] = r.floor;
      g.ceil[i] = r.ceil;
      g.region[i] = r.id;
      if (mats.floor !== undefined) g.floorMat[i] = mats.floor;
      if (mats.ceil !== undefined) g.ceilMat[i] = mats.ceil;
    }
  }
  if (mats.wall !== undefined) {
    // Wall material belongs to the solid ring around the room.
    for (let z = r.z - 1; z <= r.z + r.h; z++) {
      for (let x = r.x - 1; x <= r.x + r.w; x++) {
        if (x < 0 || z < 0 || x >= g.w || z >= g.h) continue;
        const i = z * g.w + x;
        if (g.kind[i] === CellKind.Solid) g.wallMat[i] = mats.wall;
      }
    }
  }
}

export const roomCenter = (r: Room): [number, number] => [Math.floor(r.x + r.w / 2), Math.floor(r.z + r.h / 2)];

/** Minimum spanning tree over room centres plus `loopChance` of the
 * remaining short edges — loops make chases and flanking possible. */
export function connectRooms(rooms: Room[], rng: Rng, loopChance: number): [number, number][] {
  const n = rooms.length;
  if (n < 2) return [];
  const d = (a: number, b: number) => {
    const [ax, az] = roomCenter(rooms[a]);
    const [bx, bz] = roomCenter(rooms[b]);
    return Math.hypot(ax - bx, az - bz);
  };
  const inTree = new Set<number>([0]);
  const edges: [number, number][] = [];
  while (inTree.size < n) {
    let best: [number, number] | null = null;
    let bestD = Infinity;
    for (const a of inTree) {
      for (let b = 0; b < n; b++) {
        if (inTree.has(b)) continue;
        const dist = d(a, b);
        if (dist < bestD) {
          bestD = dist;
          best = [a, b];
        }
      }
    }
    if (!best) break;
    inTree.add(best[1]);
    edges.push(best);
  }
  const has = (a: number, b: number) => edges.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  for (let a = 0; a < n; a++) {
    // Candidate loop: the nearest room not already linked.
    let best = -1;
    let bestD = Infinity;
    for (let b = 0; b < n; b++) {
      if (a === b || has(a, b)) continue;
      const dist = d(a, b);
      if (dist < bestD) {
        bestD = dist;
        best = b;
      }
    }
    if (best >= 0 && bestD < 40 && rng.chance(loopChance)) edges.push([a, best]);
  }
  return edges;
}

/** Carve an L-shaped corridor between two rooms. Its floor ramps between
 * the two room heights in steps of at most `maxStep` per cell, so creatures
 * and delvers can climb it; steps are tagged Stair. */
export function carveCorridor(
  g: FloorGrid,
  rng: Rng,
  a: Room,
  b: Room,
  opts: { width: number; ceilAbove: number; floorMat?: number; maxStep?: number },
): { x: number; z: number }[] {
  const [ax, az] = roomCenter(a);
  const [bx, bz] = roomCenter(b);
  const path: { x: number; z: number }[] = [];
  const horizontalFirst = rng.chance(0.5);
  let x = ax;
  let z = az;
  const push = () => path.push({ x, z });
  push();
  const stepX = () => {
    while (x !== bx) {
      x += Math.sign(bx - x);
      push();
    }
  };
  const stepZ = () => {
    while (z !== bz) {
      z += Math.sign(bz - z);
      push();
    }
  };
  if (horizontalFirst) {
    stepX();
    stepZ();
  } else {
    stepZ();
    stepX();
  }

  // Only the part of the path outside both rooms gets a ramp; inside rooms
  // the room floor stands.
  const outside = path.map((p) => g.region[p.z * g.w + p.x] < 0 || g.kind[p.z * g.w + p.x] === CellKind.Solid);
  const firstOut = outside.indexOf(true);
  const lastOut = outside.lastIndexOf(true);
  const maxStep = opts.maxStep ?? 0.25;
  const span = Math.max(1, lastOut - firstOut + 1);
  const needed = Math.abs(b.floor - a.floor);
  const steps = Math.ceil(needed / maxStep);
  const w = opts.width;
  path.forEach((p, k) => {
    if (!outside[k]) return;
    const t = span <= 1 ? 1 : (k - firstOut) / (span - 1);
    // Ramp in the middle of the corridor with flat landings at the ends.
    const stepIdx = steps === 0 ? 0 : Math.min(steps, Math.floor(t * (steps + 1)));
    const h = snapH(a.floor + Math.sign(b.floor - a.floor) * Math.min(needed, stepIdx * maxStep));
    for (let ox = 0; ox < w; ox++) {
      for (let oz = 0; oz < w; oz++) {
        const cx = p.x + ox - Math.floor((w - 1) / 2);
        const cz = p.z + oz - Math.floor((w - 1) / 2);
        if (cx < 1 || cz < 1 || cx >= g.w - 1 || cz >= g.h - 1) continue;
        const i = cz * g.w + cx;
        if (g.region[i] >= 0 && g.kind[i] !== CellKind.Solid) continue; // don't overwrite rooms
        const wasSolid = g.kind[i] === CellKind.Solid;
        if (!wasSolid && g.tags[i] & CellTag.Corridor) {
          // Crossing corridors: keep the lower floor so both stay walkable.
          g.floor[i] = Math.min(g.floor[i], h);
          continue;
        }
        g.kind[i] = CellKind.Open;
        g.floor[i] = h;
        g.ceil[i] = snapH(h + opts.ceilAbove);
        g.tags[i] |= CellTag.Corridor;
        if (steps > 0) g.tags[i] |= CellTag.Stair;
        if (opts.floorMat !== undefined) g.floorMat[i] = opts.floorMat;
      }
    }
  });
  return path;
}

/** Mark room-edge cells adjacent to corridors as doors. */
export function markDoors(g: FloorGrid, rooms: Room[]): void {
  for (const r of rooms) {
    const edge = (x: number, z: number) => {
      const i = z * g.w + x;
      const around = [
        [x + 1, z],
        [x - 1, z],
        [x, z + 1],
        [x, z - 1],
      ];
      for (const [nx, nz] of around) {
        const j = nz * g.w + nx;
        if (g.tags[j] & CellTag.Corridor && g.region[j] < 0) {
          g.tags[i] |= CellTag.Door;
        }
      }
    };
    for (let x = r.x; x < r.x + r.w; x++) {
      edge(x, r.z);
      edge(x, r.z + r.h - 1);
    }
    for (let z = r.z; z < r.z + r.h; z++) {
      edge(r.x, z);
      edge(r.x + r.w - 1, z);
    }
  }
}

/** Breadth-first room depth from the arrival room over corridor edges. */
export function computeRoomDepths(rooms: Room[], edges: [number, number][], start: number): void {
  const adj = rooms.map(() => [] as number[]);
  for (const [a, b] of edges) {
    adj[a].push(b);
    adj[b].push(a);
  }
  for (const r of rooms) r.depth = -1;
  rooms[start].depth = 0;
  const q = [start];
  while (q.length) {
    const a = q.shift()!;
    for (const b of adj[a]) {
      if (rooms[b].depth >= 0) continue;
      rooms[b].depth = rooms[a].depth + 1;
      q.push(b);
    }
  }
}

/** Assign roles: arrival (given), descent = deepest, then treasure/vault/
 * shrine/lair among the rest. */
export function assignRoles(rooms: Room[], rng: Rng, arrival: number, extra: RoomRole[]): void {
  rooms[arrival].role = "arrival";
  const rest = rooms.filter((r) => r.id !== arrival).sort((a, b) => b.depth - a.depth || b.w * b.h - a.w * a.h);
  if (rest.length === 0) return;
  rest[0].role = "descent";
  const pool = rng.shuffle(rest.slice(1));
  extra.forEach((role, i) => {
    if (pool[i]) pool[i].role = role;
  });
  for (const r of rooms) if (r.role === "chamber" && r.w * r.h >= 90) r.role = "hall";
}

/** Grid of pillars inside large rooms (leaves a clear border). */
export function addPillars(g: FloorGrid, r: Room, spacing: number, wallMat?: number): void {
  if (r.w < 7 || r.h < 7) return;
  for (let z = r.z + 2; z < r.z + r.h - 2; z += spacing) {
    for (let x = r.x + 2; x < r.x + r.w - 2; x += spacing) {
      const i = z * g.w + x;
      if (g.tags[i] & (CellTag.Door | CellTag.NoSpawn)) continue;
      g.kind[i] = CellKind.Solid;
      if (wallMat !== undefined) g.wallMat[i] = wallMat;
    }
  }
}

/** Sink the middle of a room into a flooded pool. */
export function floodRoom(g: FloorGrid, r: Room, liquid: number, depth: number, level: number): void {
  for (let z = r.z + 1; z < r.z + r.h - 1; z++) {
    for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
      const i = z * g.w + x;
      if (g.kind[i] !== CellKind.Open) continue;
      g.floor[i] = snapH(r.floor - depth);
      g.liquid[i] = liquid;
      g.liquidLevel[i] = r.floor - level;
    }
  }
}

/** Cut a chasm across a room, leaving a one-cell bridge. */
export function chasm(g: FloorGrid, rng: Rng, r: Room): void {
  if (r.w < 6 || r.h < 6) return;
  const vertical = rng.chance(0.5);
  const thickness = rng.int(2, Math.max(2, Math.floor((vertical ? r.w : r.h) / 3)));
  const start = vertical ? rng.int(r.x + 2, r.x + r.w - 2 - thickness) : rng.int(r.z + 2, r.z + r.h - 2 - thickness);
  const bridge = vertical ? rng.int(r.z + 1, r.z + r.h - 2) : rng.int(r.x + 1, r.x + r.w - 2);
  for (let k = 0; k < thickness; k++) {
    for (let t = vertical ? r.z : r.x; t < (vertical ? r.z + r.h : r.x + r.w); t++) {
      const x = vertical ? start + k : t;
      const z = vertical ? t : start + k;
      const i = z * g.w + x;
      if (g.tags[i] & CellTag.Door) continue;
      if (t === bridge) {
        g.tags[i] |= CellTag.Bridge | CellTag.NoSpawn;
        continue;
      }
      g.kind[i] = CellKind.Pit;
    }
  }
  r.tags.push("chasm");
}

/** Room cells (x,z) that are walkable, optionally only along the walls. */
export function roomCells(g: FloorGrid, r: Room, opts: { edge?: boolean; inset?: number } = {}): [number, number][] {
  const out: [number, number][] = [];
  const inset = opts.inset ?? 0;
  for (let z = r.z + inset; z < r.z + r.h - inset; z++) {
    for (let x = r.x + inset; x < r.x + r.w - inset; x++) {
      const i = z * g.w + x;
      if (g.kind[i] !== CellKind.Open || g.tags[i] & (CellTag.NoSpawn | CellTag.Door | CellTag.Bridge)) continue;
      if (g.liquid[i]) continue;
      if (opts.edge) {
        const nearWall =
          g.kind[i - 1] === CellKind.Solid ||
          g.kind[i + 1] === CellKind.Solid ||
          g.kind[i - g.w] === CellKind.Solid ||
          g.kind[i + g.w] === CellKind.Solid;
        if (!nearWall) continue;
      }
      out.push([x, z]);
    }
  }
  return out;
}

/** World position of a cell centre at its floor height. */
export function cellPos(g: FloorGrid, x: number, z: number, lift = 0) {
  return { x: (x + 0.5) * CELL, y: g.floor[z * g.w + x] + lift, z: (z + 0.5) * CELL };
}

/** Faces of solid neighbours of an open cell: returns directions (dx,dz)
 * where a wall is — used to hang torches and dart traps. */
export function wallDirs(g: FloorGrid, x: number, z: number): [number, number][] {
  const dirs: [number, number][] = [];
  for (const [dx, dz] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as [number, number][]) {
    const nx = x + dx;
    const nz = z + dz;
    if (nx < 0 || nz < 0 || nx >= g.w || nz >= g.h || g.kind[nz * g.w + nx] === CellKind.Solid) dirs.push([dx, dz]);
  }
  return dirs;
}

/** Flood-fill walkability check from one cell to another (tests + sanity). */
export function reachable(g: FloorGrid, from: [number, number], to: [number, number], maxStep = 0.55): boolean {
  const seen = new Uint8Array(g.w * g.h);
  const q: number[] = [from[1] * g.w + from[0]];
  seen[q[0]] = 1;
  while (q.length) {
    const i = q.pop()!;
    const x = i % g.w;
    const z = (i / g.w) | 0;
    if (x === to[0] && z === to[1]) return true;
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= g.w || nz >= g.h) continue;
      const j = nz * g.w + nx;
      if (seen[j] || g.kind[j] !== CellKind.Open) continue;
      if (Math.abs(g.floor[j] - g.floor[i]) > maxStep) continue;
      seen[j] = 1;
      q.push(j);
    }
  }
  return false;
}
