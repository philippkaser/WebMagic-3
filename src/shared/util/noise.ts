import { hash01, hash3 } from "./rng";

/** Seeded procedural noise. All functions are pure and stateless; the
 * `period` variants tile seamlessly, which is what texture painters need. */

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const wrap = (v: number, p: number) => (p > 0 ? ((v % p) + p) % p : v);

/** Value noise in [0, 1]. `period` (in lattice units) makes it tile. */
export function valueNoise2(x: number, y: number, seed = 0, period = 0): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = fade(x - x0);
  const fy = fade(y - y0);
  const xa = wrap(x0, period);
  const xb = wrap(x0 + 1, period);
  const ya = wrap(y0, period);
  const yb = wrap(y0 + 1, period);
  const a = hash01(xa, ya, 0, seed);
  const b = hash01(xb, ya, 0, seed);
  const c = hash01(xa, yb, 0, seed);
  const d = hash01(xb, yb, 0, seed);
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
}

function grad2(ix: number, iy: number, seed: number, dx: number, dy: number): number {
  const h = hash3(ix, iy, 7, seed) & 7;
  const gx = [1, -1, 1, -1, 1.41, -1.41, 0, 0][h];
  const gy = [1, 1, -1, -1, 0, 0, 1.41, -1.41][h];
  return gx * dx + gy * dy;
}

/** Gradient (Perlin-style) noise in roughly [-1, 1]. */
export function perlin2(x: number, y: number, seed = 0, period = 0): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const dx = x - x0;
  const dy = y - y0;
  const u = fade(dx);
  const v = fade(dy);
  const xa = wrap(x0, period);
  const xb = wrap(x0 + 1, period);
  const ya = wrap(y0, period);
  const yb = wrap(y0 + 1, period);
  const n00 = grad2(xa, ya, seed, dx, dy);
  const n10 = grad2(xb, ya, seed, dx - 1, dy);
  const n01 = grad2(xa, yb, seed, dx, dy - 1);
  const n11 = grad2(xb, yb, seed, dx - 1, dy - 1);
  return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v) * 0.9;
}

/** Fractal sum of perlin2 octaves, normalised to roughly [-1, 1]. With a
 * period the base period doubles per octave so the result still tiles. */
export function fbm2(
  x: number,
  y: number,
  opts: { seed?: number; octaves?: number; lacunarity?: number; gain?: number; period?: number } = {},
): number {
  const { seed = 0, octaves = 4, lacunarity = 2, gain = 0.5, period = 0 } = opts;
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * perlin2(x * freq, y * freq, seed + i * 131, period ? period * freq : 0);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

/** Ridged fbm in [0, 1] — cracks, veins, roots. */
export function ridged2(
  x: number,
  y: number,
  opts: { seed?: number; octaves?: number; period?: number } = {},
): number {
  const { seed = 0, octaves = 4, period = 0 } = opts;
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(perlin2(x * freq, y * freq, seed + i * 71, period ? period * freq : 0));
    sum += amp * n * n;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

export interface WorleyResult {
  /** Distance to the nearest feature point (lattice units). */
  f1: number;
  /** Distance to the second nearest. f2 - f1 ≈ 0 on cell borders. */
  f2: number;
  /** Stable id of the nearest cell (for per-cell colour variation). */
  id: number;
}

/** Cellular (Worley) noise. Cobblestones, scales, cracked earth, cells. */
export function worley2(x: number, y: number, seed = 0, period = 0, jitter = 0.9): WorleyResult {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let f1 = 1e9;
  let f2 = 1e9;
  let id = 0;
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const cx = xi + ox;
      const cy = yi + oy;
      const hx = wrap(cx, period);
      const hy = wrap(cy, period);
      const px = cx + 0.5 + (hash01(hx, hy, 1, seed) - 0.5) * jitter;
      const py = cy + 0.5 + (hash01(hx, hy, 2, seed) - 0.5) * jitter;
      const d = Math.hypot(px - x, py - y);
      if (d < f1) {
        f2 = f1;
        f1 = d;
        id = hash3(hx, hy, 3, seed);
      } else if (d < f2) {
        f2 = d;
      }
    }
  }
  return { f1, f2, id };
}

/** 3D value noise in [0,1] — for animated/volumetric effects. */
export function valueNoise3(x: number, y: number, z: number, seed = 0): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);
  const fx = fade(x - x0);
  const fy = fade(y - y0);
  const fz = fade(z - z0);
  const h = (i: number, j: number, k: number) => hash01(x0 + i, y0 + j, z0 + k, seed);
  const x00 = lerp(h(0, 0, 0), h(1, 0, 0), fx);
  const x10 = lerp(h(0, 1, 0), h(1, 1, 0), fx);
  const x01 = lerp(h(0, 0, 1), h(1, 0, 1), fx);
  const x11 = lerp(h(0, 1, 1), h(1, 1, 1), fx);
  return lerp(lerp(x00, x10, fy), lerp(x01, x11, fy), fz);
}
