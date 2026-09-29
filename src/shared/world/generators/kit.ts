import { hash01 } from "../../util/rng";
import type { Rng } from "../../util/rng";
import { CellKind, CellTag, type FloorGrid, type Room, type RoomRole } from "../layout";
import { roomCenter, snapH } from "./common";

/** The stratum generators' shared toolkit, one level above common.ts:
 * cell carving that never touches the rock border, value noise, walking
 * distance fields, a slope limiter that makes noisy terrain walkable, an
 * A* corridor router that threads rock between irregular rooms and ramps
 * its floor, arrival/descent selection by walking distance, pads, and
 * whole-layout dihedral transforms. Pure; draws only from the Rng handed in. */

export const DIR4: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Head-room every walkable cell keeps (m). */
export const MIN_HEAD = 2.25;

// ── carving ─────────────────────────────────────────────────────────────────

/** Open a cell. The outermost ring of the grid always stays rock so nothing
 * can leave the world. Returns the cell index or -1. */
export function openCell(g: FloorGrid, x: number, z: number, floor: number, ceil: number, region = -1): number {
  if (x < 1 || z < 1 || x >= g.w - 1 || z >= g.h - 1) return -1;
  const i = z * g.w + x;
  g.kind[i] = CellKind.Open;
  g.floor[i] = floor;
  g.ceil[i] = Math.max(ceil, floor + MIN_HEAD);
  g.region[i] = region;
  g.liquid[i] = 0;
  return i;
}

/** Turn a cell (back) into rock with an optional wall material. */
export function fillCell(g: FloorGrid, x: number, z: number, wallMat?: number): void {
  if (x < 0 || z < 0 || x >= g.w || z >= g.h) return;
  const i = z * g.w + x;
  g.kind[i] = CellKind.Solid;
  g.liquid[i] = 0;
  g.tags[i] = 0;
  if (wallMat !== undefined) g.wallMat[i] = wallMat;
}

/** Sink a cell into a pool: floor `depth` below `base`, liquid surface at
 * `level` (absolute). */
export function poolCell(g: FloorGrid, i: number, liquid: number, floor: number, level: number): void {
  g.floor[i] = snapH(floor);
  g.liquid[i] = liquid;
  g.liquidLevel[i] = level;
}

export function paintCell(g: FloorGrid, i: number, m: { floor?: number; wall?: number; ceil?: number }): void {
  if (m.floor !== undefined) g.floorMat[i] = m.floor;
  if (m.wall !== undefined) g.wallMat[i] = m.wall;
  if (m.ceil !== undefined) g.ceilMat[i] = m.ceil;
}

/** Wall material onto every rock cell touching a region's open cells. */
export function paintRegionWalls(g: FloorGrid, r: Room, wallMat: number, pad = 1): void {
  for (let z = r.z - pad; z < r.z + r.h + pad; z++) {
    for (let x = r.x - pad; x < r.x + r.w + pad; x++) {
      if (x < 0 || z < 0 || x >= g.w || z >= g.h) continue;
      const i = z * g.w + x;
      if (g.kind[i] === CellKind.Solid || g.region[i] !== r.id) continue;
      for (const [dx, dz] of DIR4) {
        const nx = x + dx;
        const nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= g.w || nz >= g.h) continue;
        const j = nz * g.w + nx;
        if (g.kind[j] === CellKind.Solid) g.wallMat[j] = wallMat;
      }
    }
  }
}

/** Is a w×h block (plus `pad` cells around it) entirely unclaimed rock? */
export function blockFree(g: FloorGrid, x: number, z: number, w: number, h: number, pad: number): boolean {
  if (x - pad < 1 || z - pad < 1 || x + w + pad > g.w - 1 || z + h + pad > g.h - 1) return false;
  for (let zz = z - pad; zz < z + h + pad; zz++) {
    for (let xx = x - pad; xx < x + w + pad; xx++) {
      if (g.kind[zz * g.w + xx] !== CellKind.Solid) return false;
    }
  }
  return true;
}

export function newRoom(rooms: Room[], x: number, z: number, w: number, h: number, floor: number, ceil: number, tags: string[] = [], role: RoomRole = "chamber"): Room {
  const r: Room = { id: rooms.length, x, z, w, h, role, floor, ceil, depth: 0, tags };
  rooms.push(r);
  return r;
}

/** Recompute a room's bounding box from the cells its region owns. */
export function fitBounds(g: FloorGrid, r: Room): void {
  let x0 = g.w;
  let z0 = g.h;
  let x1 = -1;
  let z1 = -1;
  for (let z = 0; z < g.h; z++) {
    for (let x = 0; x < g.w; x++) {
      if (g.region[z * g.w + x] !== r.id || g.kind[z * g.w + x] === CellKind.Solid) continue;
      if (x < x0) x0 = x;
      if (z < z0) z0 = z;
      if (x > x1) x1 = x;
      if (z > z1) z1 = z;
    }
  }
  if (x1 < 0) return;
  r.x = x0;
  r.z = z0;
  r.w = x1 - x0 + 1;
  r.h = z1 - z0 + 1;
}

/** Visit the cells of a disc (Euclidean radius, cell centres). */
export function forDisc(cx: number, cz: number, r: number, fn: (x: number, z: number, d: number) => void): void {
  const R = Math.ceil(r);
  for (let z = cz - R; z <= cz + R; z++) {
    for (let x = cx - R; x <= cx + R; x++) {
      const d = Math.hypot(x - cx, z - cz);
      if (d <= r) fn(x, z, d);
    }
  }
}

// ── noise ───────────────────────────────────────────────────────────────────

/** Smooth 2D value noise in [0,1) with feature size `scale` (cells). */
export function valueNoise(seed: number, scale: number): (x: number, z: number) => number {
  return (x: number, z: number) => {
    const fx = x / scale;
    const fz = z / scale;
    const x0 = Math.floor(fx);
    const z0 = Math.floor(fz);
    const tx = fx - x0;
    const tz = fz - z0;
    const sx = tx * tx * (3 - 2 * tx);
    const sz = tz * tz * (3 - 2 * tz);
    const a = hash01(x0, z0, 0, seed);
    const b = hash01(x0 + 1, z0, 0, seed);
    const c = hash01(x0, z0 + 1, 0, seed);
    const d = hash01(x0 + 1, z0 + 1, 0, seed);
    return (a + (b - a) * sx) * (1 - sz) + (c + (d - c) * sx) * sz;
  };
}

/** Two octaves of value noise, roughly [0,1). */
export function fbm(seed: number, scale: number): (x: number, z: number) => number {
  const a = valueNoise(seed, scale);
  const b = valueNoise(seed ^ 0x5bd1e995, scale / 2.3);
  return (x, z) => a(x, z) * 0.68 + b(x, z) * 0.32;
}

// ── analysis ────────────────────────────────────────────────────────────────

/** Walking distance (4-connected steps) from a cell over walkable cells
 * whose floors differ by at most `maxStep`; -1 = unreachable. */
export function walkDist(g: FloorGrid, sx: number, sz: number, maxStep = 0.55): Int32Array {
  const n = g.w * g.h;
  const d = new Int32Array(n).fill(-1);
  const s = sz * g.w + sx;
  if (sx < 0 || sz < 0 || sx >= g.w || sz >= g.h || g.kind[s] !== CellKind.Open) return d;
  const q = new Int32Array(n);
  let head = 0;
  let tail = 0;
  d[s] = 0;
  q[tail++] = s;
  while (head < tail) {
    const i = q[head++];
    const x = i % g.w;
    const z = (i / g.w) | 0;
    const f = g.floor[i];
    for (let k = 0; k < 4; k++) {
      const nx = x + DIR4[k][0];
      const nz = z + DIR4[k][1];
      if (nx < 0 || nz < 0 || nx >= g.w || nz >= g.h) continue;
      const j = nz * g.w + nx;
      if (d[j] >= 0 || g.kind[j] !== CellKind.Open || Math.abs(g.floor[j] - f) > maxStep) continue;
      d[j] = d[i] + 1;
      q[tail++] = j;
    }
  }
  return d;
}

/** Lower open cells until no two 4-neighbours (both passing `mask`) differ
 * by more than `maxStep` — noisy terrain becomes walkable everywhere while
 * keeping its shape. Heights stay on the 0.25 m lattice. */
export function limitSlopes(g: FloorGrid, maxStep: number, mask: (i: number) => boolean): void {
  const W = g.w;
  const ok = (i: number) => g.kind[i] === CellKind.Open && mask(i);
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    for (let z = 1; z < g.h - 1; z++) {
      for (let x = 1; x < W - 1; x++) {
        const i = z * W + x;
        if (!ok(i)) continue;
        for (const j of [i - 1, i - W]) {
          if (!ok(j)) continue;
          if (g.floor[i] > g.floor[j] + maxStep) {
            g.floor[i] = g.floor[j] + maxStep;
            changed = true;
          } else if (g.floor[j] > g.floor[i] + maxStep) {
            g.floor[j] = g.floor[i] + maxStep;
            changed = true;
          }
        }
      }
    }
    for (let z = g.h - 2; z >= 1; z--) {
      for (let x = W - 2; x >= 1; x--) {
        const i = z * W + x;
        if (!ok(i)) continue;
        for (const j of [i + 1, i + W]) {
          if (!ok(j)) continue;
          if (g.floor[i] > g.floor[j] + maxStep) {
            g.floor[i] = g.floor[j] + maxStep;
            changed = true;
          } else if (g.floor[j] > g.floor[i] + maxStep) {
            g.floor[j] = g.floor[i] + maxStep;
            changed = true;
          }
        }
      }
    }
    if (!changed) break;
  }
}

/** Flag Stair on open cells whose floor differs (walkably) from a neighbour. */
export function tagStairs(g: FloorGrid): void {
  for (let z = 1; z < g.h - 1; z++) {
    for (let x = 1; x < g.w - 1; x++) {
      const i = z * g.w + x;
      if (g.kind[i] !== CellKind.Open || g.liquid[i]) continue;
      for (const [dx, dz] of DIR4) {
        const j = (z + dz) * g.w + x + dx;
        if (g.kind[j] !== CellKind.Open) continue;
        const d = g.floor[j] - g.floor[i];
        if (d > 0.01 && d <= 0.55) g.tags[i] |= CellTag.Stair;
      }
    }
  }
}

// ── corridors ───────────────────────────────────────────────────────────────

/** Rock the router may not cut: room cells and the wall ring around them.
 * 0 = free rock, 1 = forbidden, 2 = existing corridor (crossable). */
export function reserveMap(g: FloorGrid): Uint8Array {
  const res = new Uint8Array(g.w * g.h);
  for (let z = 0; z < g.h; z++) {
    for (let x = 0; x < g.w; x++) {
      const i = z * g.w + x;
      if (x < 1 || z < 1 || x >= g.w - 1 || z >= g.h - 1) {
        res[i] = 1;
        continue;
      }
      if (g.kind[i] !== CellKind.Solid) {
        res[i] = g.region[i] >= 0 || g.liquid[i] || g.kind[i] === CellKind.Pit ? 1 : 2;
        continue;
      }
      for (const [dx, dz] of DIR4) {
        const j = (z + dz) * g.w + x + dx;
        if (g.kind[j] !== CellKind.Solid && g.region[j] >= 0) {
          res[i] = 1;
          break;
        }
      }
    }
  }
  return res;
}

class Heap {
  private items: number[] = [];
  private prio: number[] = [];
  get size() {
    return this.items.length;
  }
  push(item: number, p: number): void {
    const a = this.items;
    const b = this.prio;
    a.push(item);
    b.push(p);
    let i = a.length - 1;
    while (i > 0) {
      const up = (i - 1) >> 1;
      if (b[up] <= b[i]) break;
      [a[i], a[up]] = [a[up], a[i]];
      [b[i], b[up]] = [b[up], b[i]];
      i = up;
    }
  }
  pop(): number {
    const a = this.items;
    const b = this.prio;
    const top = a[0];
    const la = a.pop()!;
    const lb = b.pop()!;
    if (a.length) {
      a[0] = la;
      b[0] = lb;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && b[l] < b[m]) m = l;
        if (r < a.length && b[r] < b[m]) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        [b[i], b[m]] = [b[m], b[i]];
        i = m;
      }
    }
    return top;
  }
}

export interface RouteOpts {
  /** Cost noise for organic, wandering routes (0 = straightest). */
  wiggle?: number;
  wiggleSeed?: number;
  /** Extra cost per change of direction (orthogonal, industrial routes). */
  turnCost?: number;
  /** May cut across existing corridors. */
  cross?: boolean;
  /** Extra cost for running alongside other open cells (keeps corridors apart). */
  hugCost?: number;
}

/** A* through rock from (sx,sz) to (tx,tz); both ends must be unreserved.
 * Returns cell indices from start to target, or null. */
export function route(g: FloorGrid, res: Uint8Array, sx: number, sz: number, tx: number, tz: number, o: RouteOpts = {}): number[] | null {
  const W = g.w;
  const n = W * g.h;
  const start = sz * W + sx;
  const goal = tz * W + tx;
  const cost = new Float32Array(n).fill(Infinity);
  const came = new Int32Array(n).fill(-1);
  const heap = new Heap();
  cost[start] = 0;
  heap.push(start, 0);
  const wiggle = o.wiggle ?? 0;
  const seed = o.wiggleSeed ?? 0;
  const turn = o.turnCost ?? 0.4;
  const hug = o.hugCost ?? 0.6;
  let guard = 0;
  while (heap.size && guard++ < 60000) {
    const cur = heap.pop();
    if (cur === goal) break;
    const cx = cur % W;
    const cz = (cur / W) | 0;
    const prev = came[cur];
    const pdx = prev < 0 ? 0 : cx - (prev % W);
    const pdz = prev < 0 ? 0 : cz - ((prev / W) | 0);
    for (const [dx, dz] of DIR4) {
      const nx = cx + dx;
      const nz = cz + dz;
      if (nx < 1 || nz < 1 || nx >= W - 1 || nz >= g.h - 1) continue;
      const j = nz * W + nx;
      const r = res[j];
      if (j !== goal && (r === 1 || (r === 2 && !o.cross))) continue;
      let c = 1;
      if (r === 2) c += 3;
      if (prev >= 0 && (dx !== pdx || dz !== pdz)) c += turn;
      if (wiggle > 0) c += wiggle * hash01(nx, nz, 7, seed) * 2;
      if (hug > 0 && g.kind[j] === CellKind.Solid) {
        for (const [ex, ez] of DIR4) {
          const k = (nz + ez) * W + nx + ex;
          if (k !== cur && g.kind[k] !== CellKind.Solid && k !== goal) {
            c += hug;
            break;
          }
        }
      }
      const nc = cost[cur] + c;
      if (nc >= cost[j]) continue;
      cost[j] = nc;
      came[j] = cur;
      heap.push(j, nc + Math.abs(nx - tx) + Math.abs(nz - tz));
    }
  }
  if (!Number.isFinite(cost[goal])) return null;
  const path: number[] = [];
  for (let c = goal; c !== -1; c = came[c]) {
    path.push(c);
    if (c === start) break;
  }
  return path.reverse();
}

export interface Door {
  /** Room cell the corridor attaches to. */
  i: number;
  /** First rock cell outside it. */
  o: number;
  dx: number;
  dz: number;
  h: number;
}

/** Room edge cells a corridor may leave from. */
export function doorCandidates(g: FloorGrid, r: Room): Door[] {
  const out: Door[] = [];
  for (let z = r.z; z < r.z + r.h; z++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      const i = z * g.w + x;
      if (g.region[i] !== r.id || g.kind[i] !== CellKind.Open || g.liquid[i]) continue;
      if (g.tags[i] & (CellTag.Stair | CellTag.Bridge | CellTag.NoSpawn)) continue;
      for (const [dx, dz] of DIR4) {
        if (r.entry && (dx !== r.entry[0] || dz !== r.entry[1])) continue;
        const ox = x + dx;
        const oz = z + dz;
        if (ox < 2 || oz < 2 || ox >= g.w - 2 || oz >= g.h - 2) continue;
        const o = oz * g.w + ox;
        if (g.kind[o] !== CellKind.Solid) continue;
        // The rock outside may not breach anything sideways; straight
        // across (a thin wall into the next room) is a doorway.
        let foreign = false;
        for (const [ex, ez] of DIR4) {
          if ((ex === dx && ez === dz) || (ex === -dx && ez === -dz)) continue;
          const k = (oz + ez) * g.w + ox + ex;
          if (g.kind[k] !== CellKind.Solid && g.region[k] !== r.id) foreign = true;
        }
        if (!foreign) out.push({ i, o, dx, dz, h: g.floor[i] });
      }
    }
  }
  return out;
}

export interface LinkOpts extends RouteOpts {
  width?: number;
  /** Corridor ceiling above its floor (m). */
  ceilAbove: number;
  floorMat?: number;
  ceilMat?: number;
  /** Wall material painted onto the corridor's rock sides. */
  wallMat?: number;
  /** Extra CellTag bits for corridor cells. */
  tags?: number;
}

/** Height of each cell of `seq` (door A, path…, door B): ramps of ≤ 0.25 m
 * per cell where the run is long enough, else ≤ 0.5 m, with the steps
 * spread evenly (flat landings at both ends). Fixed heights (crossings of
 * earlier corridors) split the run into independent ramps. */
function rampHeights(seq: number[], fixed: Map<number, number>): number[] {
  const hs = new Array<number>(seq.length);
  const anchors = [...fixed.keys()].sort((a, b) => a - b);
  for (let a = 0; a < anchors.length - 1; a++) {
    const k0 = anchors[a];
    const k1 = anchors[a + 1];
    const h0 = fixed.get(k0)!;
    const h1 = fixed.get(k1)!;
    const slots = k1 - k0;
    const D = h1 - h0;
    const n = Math.min(slots, Math.max(Math.ceil(Math.abs(D) / 0.25 - 1e-6), 0));
    for (let k = k0; k <= k1; k++) {
      if (n === 0) {
        hs[k] = k === k1 ? h1 : h0;
        continue;
      }
      // Transition j sits at slot floor((j + 0.5) * slots / n); count those before k.
      let cnt = 0;
      for (let j = 0; j < n; j++) if (k0 + Math.floor(((j + 0.5) * slots) / n) < k) cnt++;
      hs[k] = snapH(h0 + (D * cnt) / n);
    }
  }
  return hs;
}

/** Carve a corridor between two rooms: pick facing door cells, route
 * through rock with A*, ramp the floor between the door heights, widen,
 * tag. Returns the carved path (cell indices) or null if no route fits. */
export function link(g: FloorGrid, rng: Rng, a: Room, b: Room, o: LinkOpts, res: Uint8Array): number[] | null {
  const W = g.w;
  const da = doorCandidates(g, a);
  const db = doorCandidates(g, b);
  if (!da.length || !db.length) return null;
  const [ax, az] = roomCenter(a);
  const [bx, bz] = roomCenter(b);
  const near = (list: Door[], tx: number, tz: number) =>
    list
      .map((d) => ({ d, k: Math.abs((d.o % W) - tx) + Math.abs(((d.o / W) | 0) - tz) + rng.next() * 2 }))
      .sort((p, q) => p.k - q.k)
      .slice(0, 10)
      .map((p) => p.d);
  const na = near(da, bx, bz);
  const nb = near(db, ax, az);
  const pairs: { p: Door; q: Door; k: number }[] = [];
  for (const p of na) {
    for (const q of nb) {
      const man = Math.abs((p.o % W) - (q.o % W)) + Math.abs(((p.o / W) | 0) - ((q.o / W) | 0));
      const dh = Math.abs(p.h - q.h);
      // Enough run for 0.5 m steps at worst (the route is ≥ manhattan).
      if (dh > 0.5 * (man + 2) + 1e-6) continue;
      const tight = dh > 0.25 * (man + 2) ? 4 : 0;
      pairs.push({ p, q, k: man + dh * 2 + tight + rng.next() });
    }
  }
  pairs.sort((u, v) => u.k - v.k);
  for (const { p, q } of pairs.slice(0, 4)) {
    const ra = res[p.o];
    const rb = res[q.o];
    res[p.o] = 0;
    res[q.o] = 0;
    const path = route(g, res, p.o % W, (p.o / W) | 0, q.o % W, (q.o / W) | 0, o);
    res[p.o] = ra;
    res[q.o] = rb;
    if (!path) continue;
    carveLink(g, [p.i, ...path, q.i], o, res);
    g.tags[p.i] |= CellTag.Door;
    g.tags[q.i] |= CellTag.Door;
    return path;
  }
  return null;
}

/** Carve a door-to-door cell sequence as a corridor (see link). */
export function carveLink(g: FloorGrid, seq: number[], o: LinkOpts, res: Uint8Array): void {
  const W = g.w;
  const fixed = new Map<number, number>();
  fixed.set(0, g.floor[seq[0]]);
  fixed.set(seq.length - 1, g.floor[seq[seq.length - 1]]);
  for (let k = 1; k < seq.length - 1; k++) {
    if (g.kind[seq[k]] === CellKind.Open) fixed.set(k, g.floor[seq[k]]);
  }
  const hs = rampHeights(seq, fixed);
  const width = o.width ?? 1;
  for (let k = 1; k < seq.length - 1; k++) {
    const i = seq[k];
    const x = i % W;
    const z = (i / W) | 0;
    const h = hs[k];
    const wasOpen = g.kind[i] === CellKind.Open;
    if (!wasOpen) {
      openCell(g, x, z, h, h + o.ceilAbove, -1);
      if (o.floorMat !== undefined) g.floorMat[i] = o.floorMat;
      if (o.ceilMat !== undefined) g.ceilMat[i] = o.ceilMat;
    }
    g.tags[i] |= CellTag.Corridor | (o.tags ?? 0);
    if (Math.abs(hs[k - 1] - h) > 0.01 || Math.abs(hs[k + 1] - h) > 0.01) g.tags[i] |= CellTag.Stair;
    res[i] = 2;
    // Widen to the side(s), perpendicular to the direction of travel.
    if (width > 1 && !wasOpen) {
      const n = seq[k + 1];
      const tdx = (n % W) - x;
      const tdz = ((n / W) | 0) - z;
      const sides: [number, number][] = width >= 3 ? [[-tdz, tdx], [tdz, -tdx]] : [[-tdz, tdx]];
      for (const [sx, sz] of sides) {
        const wx = x + sx;
        const wz = z + sz;
        if (wx < 2 || wz < 2 || wx >= W - 2 || wz >= g.h - 2) continue;
        const wi = wz * W + wx;
        if (g.kind[wi] !== CellKind.Solid || res[wi] === 1) continue;
        // Don't breach into anything at a different height.
        let clash = false;
        for (const [ex, ez] of DIR4) {
          const j = (wz + ez) * W + wx + ex;
          if (j === i || g.kind[j] === CellKind.Solid) continue;
          if (Math.abs(g.floor[j] - h) > 0.5 || g.liquid[j] || g.kind[j] === CellKind.Pit) clash = true;
        }
        if (clash) continue;
        openCell(g, wx, wz, h, h + o.ceilAbove, -1);
        if (o.floorMat !== undefined) g.floorMat[wi] = o.floorMat;
        if (o.ceilMat !== undefined) g.ceilMat[wi] = o.ceilMat;
        g.tags[wi] |= g.tags[i] & (CellTag.Corridor | CellTag.Stair) | (o.tags ?? 0);
        res[wi] = 2;
      }
    }
  }
  if (o.wallMat !== undefined) {
    for (let k = 1; k < seq.length - 1; k++) {
      const x = seq[k] % W;
      const z = (seq[k] / W) | 0;
      for (let dz = -1; dz <= 1; dz++)
        for (let dx = -1; dx <= 1; dx++) {
          const j = (z + dz) * W + x + dx;
          if (g.kind[j] === CellKind.Solid && res[j] !== 1) g.wallMat[j] = o.wallMat;
        }
    }
  }
}

/** Minimum spanning tree (by anchor distance) plus loop edges between near
 * rooms — the room graph most generators link. */
export function roomGraph(rooms: Room[], rng: Rng, loopChance: number, maxLoop = 36): [number, number][] {
  const n = rooms.length;
  const c = rooms.map(roomCenter);
  const d = (a: number, b: number) => Math.hypot(c[a][0] - c[b][0], c[a][1] - c[b][1]);
  const inTree = new Uint8Array(n);
  inTree[0] = 1;
  const edges: [number, number][] = [];
  const best = new Float64Array(n).fill(Infinity);
  const from = new Int32Array(n).fill(0);
  for (let b = 1; b < n; b++) best[b] = d(0, b);
  for (let it = 1; it < n; it++) {
    let pick = -1;
    for (let b = 0; b < n; b++) if (!inTree[b] && (pick < 0 || best[b] < best[pick])) pick = b;
    if (pick < 0) break;
    inTree[pick] = 1;
    edges.push([from[pick], pick]);
    for (let b = 0; b < n; b++) {
      if (inTree[b]) continue;
      const dd = d(pick, b);
      if (dd < best[b]) {
        best[b] = dd;
        from[b] = pick;
      }
    }
  }
  const has = (a: number, b: number) => edges.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  for (let a = 0; a < n; a++) {
    let bi = -1;
    let bd = Infinity;
    for (let b = 0; b < n; b++) {
      if (a === b || has(a, b)) continue;
      const dd = d(a, b);
      if (dd < bd) {
        bd = dd;
        bi = b;
      }
    }
    if (bi >= 0 && bd < maxLoop && rng.chance(loopChance)) edges.push([a, bi]);
  }
  return edges;
}

/** Link every room of `edges`; failed tree edges are retried allowing
 * crossings so the floor stays one piece. */
export function linkAll(g: FloorGrid, rng: Rng, rooms: Room[], edges: [number, number][], opts: (a: Room, b: Room, k: number) => LinkOpts): void {
  const res = reserveMap(g);
  edges.forEach(([a, b], k) => {
    const o = opts(rooms[a], rooms[b], k);
    if (!link(g, rng, rooms[a], rooms[b], o, res)) link(g, rng, rooms[a], rooms[b], { ...o, cross: true, hugCost: 0 }, res);
  });
}

/** Last-resort repair: link every room whose anchor can't be walked to from
 * the arrival to the nearest room that can. */
export function ensureConnected(g: FloorGrid, rng: Rng, rooms: Room[], arrival: Room, o: LinkOpts, must: (r: Room) => boolean = () => true): void {
  for (let pass = 0; pass < 6; pass++) {
    const [sx, sz] = roomCenter(arrival);
    const dist = walkDist(g, sx, sz);
    const lost = rooms.filter((r) => must(r) && dist[roomCenter(r)[1] * g.w + roomCenter(r)[0]] < 0);
    if (!lost.length) return;
    const res = reserveMap(g);
    for (const r of lost) {
      const [rx, rz] = roomCenter(r);
      const targets = rooms
        .filter((t) => t !== r && dist[roomCenter(t)[1] * g.w + roomCenter(t)[0]] >= 0)
        .sort((p, q) => Math.hypot(roomCenter(p)[0] - rx, roomCenter(p)[1] - rz) - Math.hypot(roomCenter(q)[0] - rx, roomCenter(q)[1] - rz));
      for (const t of targets.slice(0, 3)) {
        if (link(g, rng, r, t, { ...o, cross: true, hugCost: 0 }, res)) break;
      }
    }
  }
}

// ── roles ───────────────────────────────────────────────────────────────────

/** Choose arrival and descent at the two ends of the floor's longest walk
 * (double sweep over walking distance), then set room depths from it. */
export function pickEnds(
  g: FloorGrid,
  rooms: Room[],
  rng: Rng,
  o: { arrivalOk?: (r: Room) => boolean; descentOk?: (r: Room) => boolean; descent?: Room } = {},
): { arrival: Room; descent: Room } {
  const aOk = o.arrivalOk ?? (() => true);
  const dOk = o.descentOk ?? (() => true);
  const distOf = (d: Int32Array, r: Room) => {
    const [x, z] = roomCenter(r);
    return d[z * g.w + x];
  };
  const farthest = (d: Int32Array, ok: (r: Room) => boolean, not?: Room) => {
    const cands = rooms.filter((r) => r !== not && ok(r) && distOf(d, r) >= 0);
    if (!cands.length) return null;
    const max = Math.max(...cands.map((r) => distOf(d, r)));
    const top = cands.filter((r) => distOf(d, r) >= max * 0.86);
    return rng.pick(top);
  };
  let descent: Room;
  let arrival: Room;
  if (o.descent) {
    descent = o.descent;
    const [dx, dz] = roomCenter(descent);
    arrival = farthest(walkDist(g, dx, dz), aOk, descent) ?? rooms.find((r) => r !== descent)!;
  } else {
    const seed = rng.pick(rooms.filter(aOk).length ? rooms.filter(aOk) : rooms);
    const [sx, sz] = roomCenter(seed);
    arrival = farthest(walkDist(g, sx, sz), aOk) ?? seed;
    const [ax, az] = roomCenter(arrival);
    descent = farthest(walkDist(g, ax, az), dOk, arrival) ?? rooms.find((r) => r !== arrival)!;
  }
  arrival.role = "arrival";
  descent.role = "descent";
  setDepths(g, rooms, arrival);
  return { arrival, descent };
}

/** Room depth = walking distance from the arrival in ~10 m bands. */
export function setDepths(g: FloorGrid, rooms: Room[], arrival: Room): void {
  const [ax, az] = roomCenter(arrival);
  const d = walkDist(g, ax, az);
  for (const r of rooms) {
    if (r === arrival) {
      r.depth = 0;
      continue;
    }
    const [x, z] = roomCenter(r);
    const v = d[z * g.w + x];
    r.depth = v < 0 ? 3 : Math.max(1, Math.round(v / 10));
  }
}

/** Hand out extra roles (treasure, shrine, lair…) among ordinary rooms,
 * preferring the deeper half for treasure and lairs. */
export function giveRoles(rooms: Room[], rng: Rng, roles: RoomRole[], ok: (r: Room) => boolean = () => true): void {
  const pool = rng.shuffle(rooms.filter((r) => (r.role === "chamber" || r.role === "hall") && ok(r)));
  const maxDepth = Math.max(1, ...rooms.map((r) => r.depth));
  for (const role of roles) {
    const deep = role === "treasure" || role === "lair";
    let idx = deep ? pool.findIndex((r) => r.depth >= maxDepth / 2) : 0;
    if (idx < 0) idx = 0;
    const r = pool.splice(idx, 1)[0];
    if (r) r.role = role;
  }
}

/** Keep a 3×3 pad around a room's anchor clear, flat-ish and spawn-free. */
export function clearPad(g: FloorGrid, r: Room): void {
  const [cx, cz] = roomCenter(r);
  const ci = cz * g.w + cx;
  for (let z = cz - 1; z <= cz + 1; z++) {
    for (let x = cx - 1; x <= cx + 1; x++) {
      const i = z * g.w + x;
      if (g.region[i] !== r.id && i !== ci) continue;
      if (g.kind[i] === CellKind.Solid && (x === 0 || z === 0 || x === g.w - 1 || z === g.h - 1)) continue;
      if (g.kind[i] !== CellKind.Open || g.liquid[i]) {
        g.kind[i] = CellKind.Open;
        g.liquid[i] = 0;
        g.floor[i] = g.floor[ci];
        g.ceil[i] = Math.max(g.ceil[i], g.floor[ci] + MIN_HEAD);
        g.region[i] = r.id;
      }
      g.tags[i] |= CellTag.NoSpawn;
    }
  }
}

// ── transforms ──────────────────────────────────────────────────────────────

/** Apply one of the 8 symmetries of the square (bit 4 transpose, then bit 1
 * mirror x, bit 2 mirror z) to a whole layout, so a generator can author in
 * one canonical orientation. */
export function transformLayout(g: FloorGrid, rooms: Room[], t: number): FloorGrid {
  if (!t) return g;
  const tr = (t & 4) !== 0;
  const W = tr ? g.h : g.w;
  const H = tr ? g.w : g.h;
  const map = (x: number, z: number): [number, number] => {
    let X = tr ? z : x;
    let Z = tr ? x : z;
    if (t & 1) X = W - 1 - X;
    if (t & 2) Z = H - 1 - Z;
    return [X, Z];
  };
  const dir = (dx: number, dz: number): [number, number] => {
    let X = tr ? dz : dx;
    let Z = tr ? dx : dz;
    if (t & 1) X = -X;
    if (t & 2) Z = -Z;
    return [X, Z];
  };
  const out: FloorGrid = {
    w: W,
    h: H,
    kind: new Uint8Array(W * H),
    floor: new Float32Array(W * H),
    ceil: new Float32Array(W * H),
    liquid: new Uint8Array(W * H),
    liquidLevel: new Float32Array(W * H),
    floorMat: new Uint8Array(W * H),
    wallMat: new Uint8Array(W * H),
    ceilMat: new Uint8Array(W * H),
    region: new Int16Array(W * H),
    tags: new Uint8Array(W * H),
  };
  for (let z = 0; z < g.h; z++) {
    for (let x = 0; x < g.w; x++) {
      const i = z * g.w + x;
      const [X, Z] = map(x, z);
      const j = Z * W + X;
      out.kind[j] = g.kind[i];
      out.floor[j] = g.floor[i];
      out.ceil[j] = g.ceil[i];
      out.liquid[j] = g.liquid[i];
      out.liquidLevel[j] = g.liquidLevel[i];
      out.floorMat[j] = g.floorMat[i];
      out.wallMat[j] = g.wallMat[i];
      out.ceilMat[j] = g.ceilMat[i];
      out.region[j] = g.region[i];
      out.tags[j] = g.tags[i];
    }
  }
  for (const r of rooms) {
    const [x0, z0] = map(r.x, r.z);
    const [x1, z1] = map(r.x + r.w - 1, r.z + r.h - 1);
    r.x = Math.min(x0, x1);
    r.z = Math.min(z0, z1);
    r.w = Math.abs(x1 - x0) + 1;
    r.h = Math.abs(z1 - z0) + 1;
    if (r.anchor) r.anchor = map(r.anchor[0], r.anchor[1]);
    if (r.entry) r.entry = dir(r.entry[0], r.entry[1]);
    if (r.marks) for (const m of r.marks) [m.x, m.z] = map(m.x, m.z);
  }
  return out;
}
