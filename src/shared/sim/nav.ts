import { CELL, PLAYER } from "../config";
import type { V3 } from "../util/math";
import { CellKind, type FloorGrid } from "../world/layout";

/** Grid navigation for creatures: A* over walkable cells with step-height
 * limits and per-caller cell costs (so a clever creature routes around the
 * trap it knows about and the fire it can see, while a panicking one
 * doesn't), plus fast grid line-of-sight. Pure logic. */

export interface PathOptions {
  maxStep?: number;
  /** Extra cost for entering a cell (Infinity = forbidden). */
  cost?: (x: number, z: number) => number;
  maxNodes?: number;
  /** Flyers ignore floors and pits. */
  flying?: boolean;
}

class MinHeap {
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
      const parent = (i - 1) >> 1;
      if (b[parent] <= b[i]) break;
      [a[i], a[parent]] = [a[parent], a[i]];
      [b[i], b[parent]] = [b[parent], b[i]];
      i = parent;
    }
  }
  pop(): number {
    const a = this.items;
    const b = this.prio;
    const top = a[0];
    const lastA = a.pop()!;
    const lastB = b.pop()!;
    if (a.length) {
      a[0] = lastA;
      b[0] = lastB;
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

const DIRS: [number, number, number][] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, 1.414],
  [1, -1, 1.414],
  [-1, 1, 1.414],
  [-1, -1, 1.414],
];

export class NavGrid {
  private g: FloorGrid;
  private gScore: Float32Array;
  private came: Int32Array;
  private stamp: Uint32Array;
  private gen = 1;

  constructor(grid: FloorGrid) {
    this.g = grid;
    const n = grid.w * grid.h;
    this.gScore = new Float32Array(n);
    this.came = new Int32Array(n);
    this.stamp = new Uint32Array(n);
  }

  walkable(x: number, z: number, flying = false): boolean {
    const g = this.g;
    if (x < 0 || z < 0 || x >= g.w || z >= g.h) return false;
    const k = g.kind[z * g.w + x];
    return flying ? k !== CellKind.Solid : k === CellKind.Open;
  }

  /** A* from world point a to b. Returns world waypoints (cell centres at
   * floor height) excluding the start, or null if unreachable. */
  find(a: V3, b: V3, opts: PathOptions = {}): V3[] | null {
    const g = this.g;
    const maxStep = opts.maxStep ?? PLAYER.stepHeight;
    const flying = !!opts.flying;
    const sx = Math.floor(a.x / CELL);
    const sz = Math.floor(a.z / CELL);
    let tx = Math.floor(b.x / CELL);
    let tz = Math.floor(b.z / CELL);
    if (!this.walkable(sx, sz, flying)) return null;
    if (!this.walkable(tx, tz, flying)) {
      // Target stands somewhere odd (on a prop, in a niche): aim next to it.
      const alt = this.nearestWalkable(tx, tz, flying);
      if (!alt) return null;
      [tx, tz] = alt;
    }
    const start = sz * g.w + sx;
    const goal = tz * g.w + tx;
    if (start === goal) return [{ x: b.x, y: g.floor[goal], z: b.z }];
    this.gen++;
    const gen = this.gen;
    const open = new MinHeap();
    this.gScore[start] = 0;
    this.stamp[start] = gen;
    this.came[start] = -1;
    open.push(start, 0);
    const maxNodes = opts.maxNodes ?? 4000;
    let expanded = 0;
    while (open.size) {
      const cur = open.pop();
      if (cur === goal) break;
      if (++expanded > maxNodes) return null;
      const cx = cur % g.w;
      const cz = (cur / g.w) | 0;
      const cf = g.floor[cur];
      for (const [dx, dz, base] of DIRS) {
        const nx = cx + dx;
        const nz = cz + dz;
        if (!this.walkable(nx, nz, flying)) continue;
        // No corner cutting.
        if (dx !== 0 && dz !== 0 && (!this.walkable(cx + dx, cz, flying) || !this.walkable(cx, cz + dz, flying))) continue;
        const ni = nz * g.w + nx;
        if (!flying && Math.abs(g.floor[ni] - cf) > maxStep) continue;
        const extra = opts.cost ? opts.cost(nx, nz) : 0;
        if (extra === Infinity) continue;
        const cost = this.gScore[cur] + base + extra;
        if (this.stamp[ni] === gen && cost >= this.gScore[ni]) continue;
        this.stamp[ni] = gen;
        this.gScore[ni] = cost;
        this.came[ni] = cur;
        const h = Math.hypot(nx - tx, nz - tz);
        open.push(ni, cost + h);
      }
    }
    if (this.stamp[goal] !== gen) return null;
    const cells: number[] = [];
    for (let c = goal; c !== -1 && c !== start; c = this.came[c]) cells.push(c);
    cells.reverse();
    return this.smooth(a, cells.map((c) => ({ x: ((c % g.w) + 0.5) * CELL, y: g.floor[c], z: (((c / g.w) | 0) + 0.5) * CELL })), flying);
  }

  /** Drop waypoints that are directly reachable (string-pulling lite). */
  private smooth(from: V3, pts: V3[], flying: boolean): V3[] {
    if (pts.length <= 2) return pts;
    const out: V3[] = [];
    let anchor = from;
    let i = 0;
    while (i < pts.length) {
      let j = Math.min(pts.length - 1, i + 6);
      while (j > i && !this.clearWalk(anchor, pts[j], flying)) j--;
      out.push(pts[j]);
      anchor = pts[j];
      i = j + 1;
    }
    return out;
  }

  /** Straight-line walkability (same-ish heights, no walls/pits). */
  clearWalk(a: V3, b: V3, flying = false): boolean {
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / (CELL * 0.35));
    let prevF = NaN;
    for (let s = 0; s <= steps; s++) {
      const t = steps === 0 ? 0 : s / steps;
      const x = Math.floor((a.x + (b.x - a.x) * t) / CELL);
      const z = Math.floor((a.z + (b.z - a.z) * t) / CELL);
      if (!this.walkable(x, z, flying)) return false;
      if (!flying) {
        const f = this.g.floor[z * this.g.w + x];
        if (!Number.isNaN(prevF) && Math.abs(f - prevF) > PLAYER.stepHeight) return false;
        prevF = f;
      }
    }
    return true;
  }

  nearestWalkable(x: number, z: number, flying = false): [number, number] | null {
    for (let r = 1; r <= 3; r++) {
      for (let dz = -r; dz <= r; dz++)
        for (let dx = -r; dx <= r; dx++) if (this.walkable(x + dx, z + dz, flying)) return [x + dx, z + dz];
    }
    return null;
  }

  /** Line of sight through the height grid (walls and floor steps block;
   * dynamic bodies don't). */
  lineOfSight(a: V3, b: V3): boolean {
    const g = this.g;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const dist = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(dist / (CELL * 0.4)));
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const x = Math.floor((a.x + dx * t) / CELL);
      const z = Math.floor((a.z + dz * t) / CELL);
      if (x < 0 || z < 0 || x >= g.w || z >= g.h) return false;
      const i = z * g.w + x;
      if (g.kind[i] === CellKind.Solid) return false;
      const y = a.y + (b.y - a.y) * t;
      if (g.kind[i] === CellKind.Open && y < g.floor[i]) return false;
      if (y > g.ceil[i]) return false;
    }
    return true;
  }
}
