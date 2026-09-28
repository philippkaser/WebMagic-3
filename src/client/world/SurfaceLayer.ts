import { BufferAttribute, BufferGeometry, Mesh } from "three";
import { surfaceDef } from "../../shared/content";
import { Surface } from "../../shared/content/types";
import { SURF_RES } from "../../shared/sim/surfaces";
import { CellKind, type FloorLayout } from "../../shared/world/layout";
import { hasMaterial, layerOf } from "../gfx/textures/library";
import { surfaceMaterial } from "../render/materials";
import type { Particles } from "../fx/particles";

/** Client mirror of the floor-surface grid, rendered as thin lit quads in
 * the G-buffer (so water, oil, blood and ice pick up light and screen-space
 * reflections), plus flame particles over burning cells. */
export class SurfaceLayer {
  readonly mesh: Mesh;
  private kind: Uint8Array;
  private base: Uint8Array;
  private floorY: Float32Array;
  private w: number;
  private h: number;
  private dirty = true;
  private fireCells: number[] = [];
  private geo = new BufferGeometry();

  constructor(layout: FloorLayout) {
    const g = layout.grid;
    this.w = g.w * SURF_RES;
    this.h = g.h * SURF_RES;
    const n = this.w * this.h;
    this.kind = new Uint8Array(n);
    this.base = new Uint8Array(n);
    this.floorY = new Float32Array(n);
    for (let z = 0; z < this.h; z++) {
      for (let x = 0; x < this.w; x++) {
        const gi = Math.floor(z / SURF_RES) * g.w + Math.floor(x / SURF_RES);
        const i = z * this.w + x;
        const open = g.kind[gi] === CellKind.Open;
        this.floorY[i] = g.liquid[gi] ? g.liquidLevel[gi] : g.floor[gi];
        if (open && g.liquid[gi]) {
          this.kind[i] = g.liquid[gi];
          this.base[i] = g.liquid[gi];
        }
      }
    }
    for (const s of layout.surfaces) {
      for (let dz = 0; dz < SURF_RES; dz++) for (let dx = 0; dx < SURF_RES; dx++) this.kind[(s.z * SURF_RES + dz) * this.w + s.x * SURF_RES + dx] = s.surface;
    }
    this.mesh = new Mesh(this.geo, surfaceMaterial());
    this.mesh.frustumCulled = false;
  }

  /** Apply [index, kind, …] changes from the server. */
  apply(cells: number[]): void {
    for (let k = 0; k < cells.length; k += 2) {
      const i = cells[k];
      if (i >= 0 && i < this.kind.length) this.kind[i] = cells[k + 1];
    }
    this.dirty = true;
  }

  at(px: number, pz: number): Surface {
    const x = Math.floor(px * SURF_RES);
    const z = Math.floor(pz * SURF_RES);
    if (x < 0 || z < 0 || x >= this.w || z >= this.h) return Surface.None;
    return this.kind[z * this.w + x];
  }

  update(particles: Particles, dt: number): void {
    if (this.dirty) this.rebuild();
    // Flames over burning cells (throttled by probability per cell).
    const cells = this.fireCells;
    const chance = Math.min(1, dt * 7);
    for (let k = 0; k < cells.length; k++) {
      if (Math.random() > chance) continue;
      const i = cells[k];
      const x = ((i % this.w) + Math.random()) / SURF_RES;
      const z = (((i / this.w) | 0) + Math.random()) / SURF_RES;
      const y = this.floorY[i];
      particles.spawn({ x, y: y + 0.05, z, vy: 1.4 + Math.random(), life: 0.5 + Math.random() * 0.3, size: 0.28, size1: 0.08, r: 3.2, g: 1.2, b: 0.3, sprite: "flame", turb: 2 });
      if (Math.random() < 0.15) particles.spawn({ x, y: y + 0.4, z, vy: 1.2, life: 1.6, size: 0.35, size1: 0.9, r: 0.08, g: 0.07, b: 0.07, alpha: 0.5, sprite: "smoke", additive: false, turb: 1 });
      if (Math.random() < 0.1) particles.spawn({ x, y: y + 0.2, z, vx: (Math.random() - 0.5), vy: 2.5, vz: (Math.random() - 0.5), life: 1.2, size: 0.04, r: 4, g: 1.6, b: 0.4, sprite: "ember", gravity: 0.5, turb: 3 });
    }
  }

  private rebuild(): void {
    this.dirty = false;
    const pos: number[] = [];
    const nrm: number[] = [];
    const uv: number[] = [];
    const layer: number[] = [];
    const tint: number[] = [];
    const emit: number[] = [];
    const idx: number[] = [];
    this.fireCells = [];
    const s = 1 / SURF_RES;
    for (let i = 0; i < this.kind.length; i++) {
      const k = this.kind[i] as Surface;
      if (k === Surface.None) continue;
      if (k === Surface.Fire) this.fireCells.push(i);
      if (k === this.base[i]) continue; // the mesher already drew the pool
      const def = surfaceDef(k);
      const id = `surface.${def.id}`;
      const L = hasMaterial(id) ? layerOf(id) : layerOf("surface.water");
      const x0 = (i % this.w) * s;
      const z0 = ((i / this.w) | 0) * s;
      // Stagger heights a hair per kind so overlapping layers don't z-fight.
      const y = this.floorY[i] + 0.012 + k * 0.0015;
      const b = pos.length / 3;
      pos.push(x0, y, z0 + s, x0 + s, y, z0 + s, x0 + s, y, z0, x0, y, z0);
      for (let v = 0; v < 4; v++) {
        nrm.push(0, 1, 0);
        layer.push(L);
        tint.push(1, 1, 1);
        emit.push(def.emissive ?? 0);
      }
      uv.push(x0, -(z0 + s), x0 + s, -(z0 + s), x0 + s, -z0, x0, -z0);
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    const g = this.geo;
    g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute("normal", new BufferAttribute(new Float32Array(nrm), 3));
    g.setAttribute("uv", new BufferAttribute(new Float32Array(uv), 2));
    g.setAttribute("aLayer", new BufferAttribute(new Float32Array(layer), 1));
    g.setAttribute("aTint", new BufferAttribute(new Float32Array(tint), 3));
    g.setAttribute("aEmit", new BufferAttribute(new Float32Array(emit), 1));
    g.setIndex(idx.length ? new BufferAttribute(new Uint32Array(idx), 1) : null);
    g.setDrawRange(0, idx.length);
    this.mesh.visible = idx.length > 0;
  }

  dispose(): void {
    this.geo.dispose();
  }
}
