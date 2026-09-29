import { surfaceDef } from "../content";
import { Surface, type Element } from "../content/types";
import { CellKind, type FloorLayout } from "../world/layout";

/** The floor-surface layer: a 0.5 m grid of water, oil, blood, ice, fire,
 * webs, acid, spores… Elements react with it, fire spreads through what
 * burns, water can be electrified, and everything standing on a cell feels
 * it (friction, statuses, damage). Changes are collected for replication. */

export const SURF_RES = 2; // cells per metre

export class SurfaceGrid {
  readonly w: number;
  readonly h: number;
  readonly kind: Uint8Array;
  readonly life: Float32Array;
  /** Electrified water: seconds of charge left. */
  readonly charge: Float32Array;
  /** Walkable mask (open cells of the floor grid). */
  private open: Uint8Array;
  /** Permanent pool kind per cell (deep water/lava/acid from the layout). */
  private base: Uint8Array;
  /** Height of the floor under each cell (for fx placement). */
  readonly floorY: Float32Array;
  private changed = new Map<number, Surface>();
  private spreadTimer = 0;
  private random: () => number;
  /** Fire cells as of the last spread pass (cheap "where is fire?" queries). */
  fires: number[] = [];
  /** Cells where spores caught fire since the last drain (they explode). */
  sporeIgnitions: number[] = [];
  /** Cells where water hit lava since the last drain (steam). */
  steam: number[] = [];

  constructor(layout: FloorLayout, random: () => number) {
    const g = layout.grid;
    this.w = g.w * SURF_RES;
    this.h = g.h * SURF_RES;
    const n = this.w * this.h;
    this.kind = new Uint8Array(n);
    this.life = new Float32Array(n);
    this.charge = new Float32Array(n);
    this.open = new Uint8Array(n);
    this.base = new Uint8Array(n);
    this.floorY = new Float32Array(n);
    this.random = random;
    for (let z = 0; z < this.h; z++) {
      for (let x = 0; x < this.w; x++) {
        const gi = Math.floor(z / SURF_RES) * g.w + Math.floor(x / SURF_RES);
        const i = z * this.w + x;
        this.open[i] = g.kind[gi] === CellKind.Open ? 1 : 0;
        this.floorY[i] = g.floor[gi];
        // Deep pools start as permanent water/lava/etc surfaces.
        if (g.liquid[gi] && this.open[i]) {
          this.kind[i] = g.liquid[gi];
          this.base[i] = g.liquid[gi];
          this.life[i] = Infinity;
          this.floorY[i] = g.liquidLevel[gi];
        }
      }
    }
    for (const s of layout.surfaces) {
      for (let dz = 0; dz < SURF_RES; dz++)
        for (let dx = 0; dx < SURF_RES; dx++) this.set(s.x * SURF_RES + dx, s.z * SURF_RES + dz, s.surface, false);
    }
    this.changed.clear();
  }

  index(x: number, z: number): number {
    return z * this.w + x;
  }

  /** Surface kind under a world point. */
  at(px: number, pz: number): Surface {
    const x = Math.floor(px * SURF_RES);
    const z = Math.floor(pz * SURF_RES);
    if (x < 0 || z < 0 || x >= this.w || z >= this.h) return Surface.None;
    return this.kind[z * this.w + x];
  }

  chargedAt(px: number, pz: number): boolean {
    const x = Math.floor(px * SURF_RES);
    const z = Math.floor(pz * SURF_RES);
    if (x < 0 || z < 0 || x >= this.w || z >= this.h) return false;
    return this.charge[z * this.w + x] > 0;
  }

  private set(x: number, z: number, kind: Surface, track = true): void {
    if (x < 0 || z < 0 || x >= this.w || z >= this.h) return;
    const i = z * this.w + x;
    if (!this.open[i]) return;
    if (this.kind[i] === kind) {
      this.life[i] = Math.max(this.life[i], surfaceDef(kind).lifetime || Infinity);
      return;
    }
    // Clearing a permanent pool cell restores the pool.
    if (kind === Surface.None && this.base[i]) kind = this.base[i];
    if (kind === Surface.Fire && this.kind[i] === Surface.Spores && track) this.sporeIgnitions.push(i);
    this.kind[i] = kind;
    this.life[i] = kind === Surface.None ? 0 : kind === this.base[i] ? Infinity : surfaceDef(kind).lifetime || Infinity;
    if (kind !== Surface.Water) this.charge[i] = 0;
    if (track) this.changed.set(i, kind);
  }

  /** Paint a disc of `kind`, respecting what's already there: fire can't
   * burn on water, water puts out fire, frost on water makes ice, water on
   * lava cools it to a crust. `life` overrides the surface's own lifetime
   * (poured lava that cools, timed webs). */
  paint(px: number, pz: number, radius: number, kind: Surface, life?: number): void {
    this.forDisc(px, pz, radius, (x, z, i) => {
      const cur = this.kind[i] as Surface;
      let next = kind;
      if (kind === Surface.Fire) {
        if (cur === Surface.Water || cur === Surface.Ice || cur === Surface.Lava) return;
        if (cur !== Surface.None && !surfaceDef(cur).flammable && cur !== Surface.Fire && cur !== Surface.Blood && cur !== Surface.Ash) return;
      } else if (kind === Surface.Ice) {
        if (cur === Surface.Lava) return;
        next = Surface.Ice;
      } else if (kind === Surface.Water && cur === Surface.Lava) {
        // Quenched: a steaming crust you can cross for a while.
        this.set(x, z, Surface.Ash);
        this.life[i] = 15;
        this.steam.push(i);
        return;
      } else if (kind === Surface.Water && cur === Surface.Fire) {
        next = Surface.None;
      } else if (this.base[i] && cur === this.base[i]) {
        return; // deep pools can't be painted over except by freezing
      } else if (kind === Surface.Lava && (cur === Surface.Water || cur === Surface.Ice)) {
        this.set(x, z, Surface.Ash);
        this.life[i] = 10;
        this.steam.push(i);
        return;
      }
      this.set(x, z, next);
      if (life !== undefined && this.kind[i] === next && next !== Surface.None) this.life[i] = life;
    });
  }

  /** Replace `from` with `to` inside a disc (beating out fires, drying ink). */
  replace(px: number, pz: number, radius: number, from: Surface, to: Surface): number {
    let n = 0;
    this.forDisc(px, pz, radius, (x, z, i) => {
      if (this.kind[i] !== from) return;
      this.set(x, z, to);
      n++;
    });
    return n;
  }

  /** Is the cell under a world point open floor? */
  openAt(px: number, pz: number): boolean {
    const x = Math.floor(px * SURF_RES);
    const z = Math.floor(pz * SURF_RES);
    if (x < 0 || z < 0 || x >= this.w || z >= this.h) return false;
    return this.open[z * this.w + x] === 1;
  }

  /** World-space centre of a surface cell index. */
  cellCenter(i: number): { x: number; z: number } {
    return { x: ((i % this.w) + 0.5) / SURF_RES, z: (((i / this.w) | 0) + 0.5) / SURF_RES };
  }

  /** Electrify the connected water under a world point. */
  electrifyAt(px: number, pz: number, seconds = 1.2): boolean {
    const x = Math.floor(px * SURF_RES);
    const z = Math.floor(pz * SURF_RES);
    if (x < 0 || z < 0 || x >= this.w || z >= this.h) return false;
    if (this.kind[z * this.w + x] !== Surface.Water) return false;
    this.electrify(x, z, seconds);
    return true;
  }

  /** An element touches the floor: run surface reactions (fire ignites
   * oil/webs/spores, frost freezes water, storm electrifies it…). */
  react(px: number, pz: number, radius: number, element: Element): void {
    this.forDisc(px, pz, radius, (x, z, i) => {
      const cur = this.kind[i] as Surface;
      if (cur === Surface.None) return;
      if (element === "storm" && cur === Surface.Water) {
        this.electrify(x, z);
        return;
      }
      const into = surfaceDef(cur).reactions?.[element];
      if (into === undefined || into === cur) return;
      if (this.base[i] && cur === this.base[i] && into === Surface.Ice) {
        this.set(x, z, Surface.Ice);
        this.life[i] = 25; // frozen pools thaw back
        return;
      }
      this.set(x, z, into);
    });
  }

  /** Flood-fill charge through connected water (lightning in a pool hits
   * everyone standing in it). */
  electrify(x0: number, z0: number, seconds = 1.2, maxCells = 900): void {
    const stack = [z0 * this.w + x0];
    const seen = new Set<number>(stack);
    let n = 0;
    while (stack.length && n < maxCells) {
      const i = stack.pop()!;
      if (this.kind[i] !== Surface.Water) continue;
      this.charge[i] = Math.max(this.charge[i], seconds);
      n++;
      const x = i % this.w;
      const z = (i / this.w) | 0;
      for (const j of [i - 1, i + 1, i - this.w, i + this.w]) {
        const jx = j % this.w;
        if (j < 0 || j >= this.kind.length || Math.abs(jx - x) > 1 || seen.has(j)) continue;
        if (Math.abs(((j / this.w) | 0) - z) > 1) continue;
        seen.add(j);
        stack.push(j);
      }
    }
  }

  update(dt: number): void {
    const n = this.kind.length;
    for (let i = 0; i < n; i++) {
      if (this.charge[i] > 0) this.charge[i] = Math.max(0, this.charge[i] - dt);
      const k = this.kind[i];
      if (k === Surface.None) continue;
      const life = this.life[i];
      if (life !== Infinity) {
        this.life[i] = life - dt;
        if (this.life[i] <= 0) {
          const x = i % this.w;
          const z = (i / this.w) | 0;
          // Burnt-out fire leaves ash; thawed ice leaves water puddles;
          // poured lava cools to a crust.
          this.set(x, z, k === Surface.Fire || k === Surface.Lava ? Surface.Ash : k === Surface.Ice ? Surface.Water : Surface.None);
          if (k === Surface.Ice && !this.base[i]) this.life[i] = 20;
        }
      }
    }
    // Fire spreads a few times per second.
    this.spreadTimer += dt;
    if (this.spreadTimer >= 0.25) {
      this.spreadTimer = 0;
      const ignite: number[] = [];
      this.fires.length = 0;
      for (let i = 0; i < n; i++) {
        if (this.kind[i] !== Surface.Fire) continue;
        this.fires.push(i);
        for (const j of [i - 1, i + 1, i - this.w, i + this.w]) {
          if (j < 0 || j >= n) continue;
          const kj = this.kind[j] as Surface;
          if (kj !== Surface.None && surfaceDef(kj).flammable && this.random() < 0.55) ignite.push(j);
        }
      }
      for (const j of ignite) this.set(j % this.w, (j / this.w) | 0, Surface.Fire);
    }
  }

  forDisc(px: number, pz: number, radius: number, fn: (x: number, z: number, i: number) => void): void {
    const r = radius * SURF_RES;
    const cx = px * SURF_RES;
    const cz = pz * SURF_RES;
    // Always include the cells around the point itself, however small r is.
    const r2 = Math.max(r * r, 0.5);
    for (let z = Math.floor(cz - r - 1); z <= Math.ceil(cz + r); z++) {
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r); x++) {
        if (x < 0 || z < 0 || x >= this.w || z >= this.h) continue;
        if ((x + 0.5 - cx) ** 2 + (z + 0.5 - cz) ** 2 > r2) continue;
        fn(x, z, z * this.w + x);
      }
    }
  }

  /** Changes since the last drain, as [index, kind, …]. */
  drainChanges(): number[] {
    if (this.changed.size === 0) return [];
    const out: number[] = [];
    for (const [i, k] of this.changed) out.push(i, k);
    this.changed.clear();
    return out;
  }

  /** Full state for late joiners, as [index, kind, …] of non-empty cells. */
  snapshot(): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.kind.length; i++) if (this.kind[i] !== Surface.None && this.life[i] !== Infinity) out.push(i, this.kind[i]);
    return out;
  }
}
