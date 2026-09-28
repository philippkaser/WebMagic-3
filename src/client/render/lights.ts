import { Color, DataTexture, FloatType, NearestFilter, RGBAFormat, type Frustum, type Vector3 } from "three";

/** Point lights for the deferred pipeline.
 *
 * Unlike forward rendering, a light here costs a few ALU ops per pixel it
 * touches — so *everything* that glows can emit real light: torches,
 * candles, fungus, projectiles, spells, explosions, eyes of the thing in the
 * dark. Owners create a `PointLight` handle and mutate it freely; each frame
 * the manager culls to the frustum, ranks by importance and packs the best
 * MAX_LIGHTS into a float texture the lighting shader loops over.
 *
 * Flags:
 *   shadow  — trace the dungeon grid for occlusion (walls block light)
 *   haze    — contributes volumetric in-scattering (halo in dusty air)
 */

export const MAX_LIGHTS = 192;

export interface PointLight {
  x: number;
  y: number;
  z: number;
  /** Linear RGB, already multiplied by intensity. */
  r: number;
  g: number;
  b: number;
  radius: number;
  /** Multiplier animated by the manager (flicker) — owners set `intensity`. */
  intensity: number;
  /** 0 = steady, 1 = wild torch flicker. */
  flicker: number;
  shadow: boolean;
  /** Volumetric halo strength multiplier (0 disables). */
  haze: number;
  /** Ranking weight: explosions > projectiles > fixtures. */
  priority: number;
  enabled: boolean;
  /** Seconds to live (transient flashes); Infinity for persistent. */
  ttl: number;
  /** Intensity decay per second for flashes (fraction of initial). */
  decay: number;
  /** @internal */ _id: number;
  /** @internal */ _phase: number;
  /** @internal */ _score: number;
  /** @internal */ _base: number;
}

const tmpColor = new Color();
let nextId = 1;

export class LightManager {
  private lights = new Set<PointLight>();
  readonly texture: DataTexture;
  private data: Float32Array;
  count = 0;
  /** Visibility hook: returns 0..1 how visible a light is from the camera
   * (grid line-of-sight) — used to suppress halos behind walls. */
  visibility: ((l: PointLight) => number) | null = null;

  constructor() {
    this.data = new Float32Array(MAX_LIGHTS * 3 * 4);
    this.texture = new DataTexture(this.data, MAX_LIGHTS, 3, RGBAFormat, FloatType);
    this.texture.minFilter = NearestFilter;
    this.texture.magFilter = NearestFilter;
    this.texture.needsUpdate = true;
  }

  add(opts: {
    position: { x: number; y: number; z: number } | [number, number, number];
    color: string | [number, number, number];
    intensity?: number;
    radius?: number;
    flicker?: number;
    shadow?: boolean;
    haze?: number;
    priority?: number;
    ttl?: number;
  }): PointLight {
    const p = Array.isArray(opts.position) ? { x: opts.position[0], y: opts.position[1], z: opts.position[2] } : opts.position;
    if (typeof opts.color === "string") tmpColor.set(opts.color);
    else tmpColor.setRGB(opts.color[0], opts.color[1], opts.color[2]);
    const l: PointLight = {
      x: p.x,
      y: p.y,
      z: p.z,
      r: tmpColor.r,
      g: tmpColor.g,
      b: tmpColor.b,
      radius: opts.radius ?? 8,
      intensity: opts.intensity ?? 1,
      flicker: opts.flicker ?? 0,
      shadow: opts.shadow ?? true,
      haze: opts.haze ?? 1,
      priority: opts.priority ?? 1,
      enabled: true,
      ttl: opts.ttl ?? Infinity,
      decay: 0,
      _id: nextId++,
      _phase: Math.random() * 100,
      _score: 0,
      _base: opts.intensity ?? 1,
    };
    this.lights.add(l);
    return l;
  }

  setColor(l: PointLight, color: string): void {
    tmpColor.set(color);
    l.r = tmpColor.r;
    l.g = tmpColor.g;
    l.b = tmpColor.b;
  }

  remove(l: PointLight | null | undefined): void {
    if (l) this.lights.delete(l);
  }

  clear(): void {
    this.lights.clear();
  }

  /** Transient flash (explosions, impacts, lightning). */
  flash(position: { x: number; y: number; z: number }, color: string, intensity = 6, radius = 9, duration = 0.35): void {
    const l = this.add({ position, color, intensity, radius, ttl: duration, priority: 4, haze: 1.5 });
    l.decay = 1 / duration;
  }

  get size(): number {
    return this.lights.size;
  }

  /** Cull, rank and pack. Called once per frame by the renderer. */
  update(dt: number, time: number, cam: Vector3, frustum: Frustum, maxDistance: number): void {
    const candidates: PointLight[] = [];
    const sphere = { center: { x: 0, y: 0, z: 0 }, radius: 0 };
    for (const l of this.lights) {
      if (l.ttl !== Infinity) {
        l.ttl -= dt;
        if (l.ttl <= 0) {
          this.lights.delete(l);
          continue;
        }
        if (l.decay > 0) l.intensity = Math.max(0, l.intensity - l._base * l.decay * dt);
      }
      if (!l.enabled || l.intensity <= 0.001) continue;
      const dx = l.x - cam.x;
      const dy = l.y - cam.y;
      const dz = l.z - cam.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d - l.radius > maxDistance) continue;
      sphere.center.x = l.x;
      sphere.center.y = l.y;
      sphere.center.z = l.z;
      sphere.radius = l.radius;
      // Halos extend a little beyond the lit radius — keep lights slightly
      // outside the frustum so their glow doesn't pop.
      if (d > l.radius && !frustum.intersectsSphere(sphere as never)) continue;
      l._score = (l.priority * 4 + l.intensity * l.radius * 0.2) / (1 + d * 0.15);
      candidates.push(l);
    }
    candidates.sort((a, b) => b._score - a._score);
    const n = Math.min(MAX_LIGHTS, candidates.length);
    const D = this.data;
    const row = MAX_LIGHTS * 4;
    for (let i = 0; i < n; i++) {
      const l = candidates[i];
      let k = l.intensity;
      if (l.flicker > 0) {
        const t = time * 9 + l._phase;
        const f = Math.sin(t) * 0.5 + Math.sin(t * 2.31 + 1.7) * 0.3 + Math.sin(t * 5.13 + 0.3) * 0.2;
        k *= 1 + f * 0.18 * l.flicker;
      }
      const vis = this.visibility && l.haze > 0 ? this.visibility(l) : 1;
      const o = i * 4;
      D[o] = l.x;
      D[o + 1] = l.y;
      D[o + 2] = l.z;
      D[o + 3] = l.radius;
      D[row + o] = l.r * k;
      D[row + o + 1] = l.g * k;
      D[row + o + 2] = l.b * k;
      D[row + o + 3] = l.shadow ? 1 : 0;
      D[row * 2 + o] = l.haze * vis;
      D[row * 2 + o + 1] = 0;
      D[row * 2 + o + 2] = 0;
      D[row * 2 + o + 3] = 0;
    }
    this.count = n;
    this.texture.needsUpdate = true;
  }
}
