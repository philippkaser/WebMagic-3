import { BufferAttribute, BufferGeometry, Mesh } from "three";
import { hasMaterial, layerOf } from "../gfx/textures/library";
import { surfaceMaterial } from "../render/materials";

/** Cosmetic floor decals — scorch marks where things exploded, blood where
 * things bled, rime, ink, venom. Client-only (the sim's surface grid carries
 * the gameplay-relevant layers); drawn into the G-buffer so they are lit and
 * reflect like the floor they lie on. Each decal is an irregular splat (a
 * fan with jittered rim) so no alpha is needed; oldest overwritten first. */

const MAX = 256;
const RIM = 11;
const VERTS = RIM + 1;

export type DecalKind = "scorch" | "blood" | "frost" | "ink" | "venom";

export class Decals {
  readonly mesh: Mesh;
  private geo = new BufferGeometry();
  private pos = new Float32Array(MAX * VERTS * 3);
  private nrm = new Float32Array(MAX * VERTS * 3);
  private uv = new Float32Array(MAX * VERTS * 2);
  private layer = new Float32Array(MAX * VERTS);
  private tint = new Float32Array(MAX * VERTS * 3);
  private emit = new Float32Array(MAX * VERTS);
  private next = 0;
  private count = 0;

  constructor() {
    const idx = new Uint16Array(MAX * RIM * 3);
    for (let d = 0; d < MAX; d++) {
      const b = d * VERTS;
      for (let k = 0; k < RIM; k++) idx.set([b, b + 1 + ((k + 1) % RIM), b + 1 + k], (d * RIM + k) * 3);
    }
    this.geo.setAttribute("position", new BufferAttribute(this.pos, 3));
    this.geo.setAttribute("normal", new BufferAttribute(this.nrm, 3));
    this.geo.setAttribute("uv", new BufferAttribute(this.uv, 2));
    this.geo.setAttribute("aLayer", new BufferAttribute(this.layer, 1));
    this.geo.setAttribute("aTint", new BufferAttribute(this.tint, 3));
    this.geo.setAttribute("aEmit", new BufferAttribute(this.emit, 1));
    this.geo.setIndex(new BufferAttribute(idx, 1));
    this.geo.setDrawRange(0, 0);
    this.mesh = new Mesh(this.geo, surfaceMaterial());
    this.mesh.frustumCulled = false;
  }

  /** Lay a splat flat on the floor at (x, y, z). */
  add(kind: DecalKind, x: number, y: number, z: number, size: number): void {
    const look = LOOKS[kind];
    const d = this.next;
    this.next = (this.next + 1) % MAX;
    this.count = Math.min(MAX, this.count + 1);
    const L = hasMaterial(look.mat) ? layerOf(look.mat) : 0;
    // Lift decals a hair, staggered so overlapping ones don't z-fight.
    const h = y + 0.006 + (d % 16) * 0.0004;
    const r = size * 0.5;
    const spin = Math.random() * Math.PI * 2;
    for (let k = 0; k <= RIM; k++) {
      let px = x;
      let pz = z;
      let shade = look.core;
      if (k > 0) {
        const a = spin + ((k - 1) / RIM) * Math.PI * 2;
        const rr = r * (0.55 + Math.random() * 0.6);
        px += Math.cos(a) * rr;
        pz += Math.sin(a) * rr;
        shade = look.rim;
      }
      const v = d * VERTS + k;
      this.pos.set([px, h, pz], v * 3);
      this.nrm.set([0, 1, 0], v * 3);
      this.uv.set([px * 0.5, -pz * 0.5], v * 2);
      this.tint.set([look.tint[0] * shade, look.tint[1] * shade, look.tint[2] * shade], v * 3);
      this.layer[v] = L;
      this.emit[v] = look.emit * (k === 0 ? 1 : 0.3);
    }
    for (const name of ["position", "normal", "uv", "aLayer", "aTint", "aEmit"]) (this.geo.getAttribute(name) as BufferAttribute).needsUpdate = true;
    this.geo.setDrawRange(0, this.count * RIM * 3);
  }

  clear(): void {
    this.count = 0;
    this.next = 0;
    this.geo.setDrawRange(0, 0);
  }
}

const LOOKS: Record<DecalKind, { mat: string; tint: [number, number, number]; emit: number; core: number; rim: number }> = {
  scorch: { mat: "surface.ash", tint: [0.5, 0.45, 0.42], emit: 0, core: 0.35, rim: 0.9 },
  blood: { mat: "surface.blood", tint: [1, 1, 1], emit: 0, core: 0.8, rim: 1.1 },
  frost: { mat: "surface.ice", tint: [1, 1.05, 1.1], emit: 0, core: 1.1, rim: 0.9 },
  ink: { mat: "surface.ink", tint: [1, 1, 1], emit: 0, core: 0.8, rim: 1 },
  venom: { mat: "surface.acid", tint: [0.8, 1, 0.7], emit: 0.6, core: 1, rim: 0.7 },
};
