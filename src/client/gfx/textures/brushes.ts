import { hash01, hash3 } from "../../../shared/util/rng";
import { hex, type Paint, type RGB } from "./paint";

/** Painting building blocks shared by every material painter.
 *
 * The look is "gritty pixels": a material is built as a scalar *tone* field
 * (shape shading + wear + noise) that is mapped through a short hand-picked
 * colour ramp with ordered dithering, rather than filled with continuous
 * noise. Structure comes from *layouts* (bricks, slabs, planks, cobbles,
 * hexes) which give every texel a cell id and a distance to the nearest
 * joint; relief, per-cell tint, chips and edge wear are all derived from
 * those two arrays. Overlays (grime, moss, drips, cracks, rivets, runes)
 * are stamped last.
 *
 * Conventions: texel row 0 is the TOP of the image (gravity points toward
 * higher rows), everything wraps so it tiles, and all randomness comes from
 * the Paint's seed so painters are deterministic. Fields are Float32Arrays of
 * size×size; noise fields are normalised to exactly 0..1. */

export type Field = Float32Array;
export type Ramp = readonly RGB[];

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export function smooth(e0: number, e1: number, v: number): number {
  const t = clamp01((v - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/** Wrapped signed difference a−b on a ring of length s (shortest way). */
export function wrapDelta(a: number, b: number, s: number): number {
  let d = (a - b) % s;
  if (d > s / 2) d -= s;
  else if (d < -s / 2) d += s;
  return d;
}

/** Stable random in [0,1) for the Paint's seed + any integer key tuple. */
export function rand(p: Paint, a: number, b = 0, c = 0): number {
  return hash01(a, b, c, p.seed);
}

// ─── Fields ─────────────────────────────────────────────────────────────────

let arenaOwner: Paint | null = null;
let arenaNext = 0;
const arena: Float32Array[] = [];

/** A scratch field filled with v. Fields are pooled per Paint: they stay
 * valid while that Paint is being painted and are recycled once the next
 * Paint asks for one — painters never keep fields beyond their own run,
 * and pooling removes most of the GC churn of painting every material at
 * startup. Copy (Float32Array.from) anything that must outlive it. */
export function field(p: Paint, v = 0): Field {
  const n = p.size * p.size;
  if (arenaOwner !== p) {
    arenaOwner = p;
    arenaNext = 0;
  }
  let f = arena[arenaNext];
  if (!f || f.length !== n) {
    f = new Float32Array(n);
    arena[arenaNext] = f;
  }
  arenaNext++;
  return f.fill(v);
}

/** Stretch a field to exactly 0..1 (in place). */
export function normalize(f: Field): Field {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < f.length; i++) {
    if (f[i] < lo) lo = f[i];
    if (f[i] > hi) hi = f[i];
  }
  const k = hi > lo ? 1 / (hi - lo) : 0;
  for (let i = 0; i < f.length; i++) f[i] = (f[i] - lo) * k;
  return f;
}

/** One octave of tiling gradient noise (fx × fy lattice cells across the
 * texture), added into `out` scaled by amp. Lattice work is per axis, so a
 * 64² octave costs a few dozen microseconds. */
const GRAD_X = new Float32Array(32);
const GRAD_Y = new Float32Array(32);
for (let k = 0; k < 32; k++) {
  GRAD_X[k] = Math.cos(((k + 0.5) / 32) * Math.PI * 2);
  GRAD_Y[k] = Math.sin(((k + 0.5) / 32) * Math.PI * 2);
}

interface Axis {
  i0: Int32Array;
  i1: Int32Array;
  d: Float32Array;
  u: Float32Array;
}
const axisCache = new Map<number, Axis>();

/** Per-axis lattice lookup for `f` cells across `s` texels (cached). */
function axisTable(s: number, f: number): Axis {
  const key = s * 4096 + f;
  let a = axisCache.get(key);
  if (!a) {
    a = { i0: new Int32Array(s), i1: new Int32Array(s), d: new Float32Array(s), u: new Float32Array(s) };
    for (let x = 0; x < s; x++) {
      const t = ((x + 0.5) * f) / s;
      const i = Math.floor(t);
      a.i0[x] = i % f;
      a.i1[x] = (i + 1) % f;
      a.d[x] = t - i;
      a.u[x] = fade(t - i);
    }
    axisCache.set(key, a);
  }
  return a;
}

function gradOctave(out: Field, s: number, fx: number, fy: number, seed: number, amp: number, ridge: boolean): void {
  const gx = new Float32Array(fx * fy);
  const gy = new Float32Array(fx * fy);
  for (let j = 0; j < fy; j++)
    for (let i = 0; i < fx; i++) {
      const k = hash3(i, j, 11, seed) & 31;
      gx[j * fx + i] = GRAD_X[k];
      gy[j * fx + i] = GRAD_Y[k];
    }
  const { i0: x0, i1: x1, d: dxs, u: ux } = axisTable(s, fx);
  const { i0: y0, i1: y1, d: dys, u: vy } = axisTable(s, fy);
  for (let y = 0; y < s; y++) {
    const dy = dys[y];
    const dy1 = dy - 1;
    const v = vy[y];
    const r0 = y0[y] * fx;
    const r1 = y1[y] * fx;
    const row = y * s;
    for (let x = 0; x < s; x++) {
      const dx = dxs[x];
      const dx1 = dx - 1;
      const a = r0 + x0[x];
      const b = r0 + x1[x];
      const c = r1 + x0[x];
      const d = r1 + x1[x];
      const n00 = gx[a] * dx + gy[a] * dy;
      const n10 = gx[b] * dx1 + gy[b] * dy;
      const n01 = gx[c] * dx + gy[c] * dy1;
      const n11 = gx[d] * dx1 + gy[d] * dy1;
      const u = ux[x];
      const top = n00 + (n10 - n00) * u;
      out[row + x] += (top + (n01 + (n11 - n01) * u - top) * v) * amp;
    }
  }
  if (ridge) {
    // Ridged octaves fold |noise| (applied to this octave's contribution
    // only, which the caller accumulates into a fresh field).
    for (let i = 0; i < out.length; i++) {
      const n = 1 - Math.abs((out[i] / amp) * 1.4);
      out[i] = n * n * amp;
    }
  }
}

/** Tiling fractal noise, normalised 0..1. `freq` = lattice cells across the
 * texture (integer), doubled each octave. */
export function fbm(p: Paint, freq: number, octaves = 3, salt = 0, gain = 0.5): Field {
  return fbmXY(p, freq, freq, octaves, salt, gain);
}

/** Anisotropic fbm (different lattice counts on x and y) — grain, streaks,
 * strands. Both counts must be integers to tile. */
export function fbmXY(p: Paint, fx: number, fy: number, octaves = 3, salt = 0, gain = 0.5): Field {
  const f = field(p);
  let amp = 1;
  // Octaves finer than 2 texels per lattice cell only add per-texel hash
  // (noise soup) at 64²; they're skipped — use grainNoise for deliberate grit.
  const limit = p.size >> 1;
  for (let o = 0; o < octaves; o++) {
    if ((fx << o) > limit || (fy << o) > limit) break;
    gradOctave(f, p.size, fx << o, fy << o, hash3(p.seed, salt, o, 0x51), amp, false);
    amp *= gain;
  }
  return normalize(f);
}

/** Ridged noise, normalised 0..1, 1 on the ridge lines (cracks, veins, roots). */
export function ridged(p: Paint, freq: number, octaves = 3, salt = 0, gain = 0.5): Field {
  const f = field(p);
  const oct = field(p);
  let amp = 1;
  for (let o = 0; o < octaves; o++) {
    if (freq << o > p.size >> 1) break;
    oct.fill(0);
    gradOctave(oct, p.size, freq << o, freq << o, hash3(p.seed, salt, o, 0x77), amp, true);
    for (let i = 0; i < f.length; i++) f[i] += oct[i];
    amp *= gain;
  }
  return normalize(f);
}

/** Per-texel white noise 0..1 (stable per salt). */
export function grainNoise(p: Paint, salt = 0): Field {
  const f = field(p);
  for (let i = 0; i < f.length; i++) f[i] = hash01(i, salt, 5, p.seed);
  return f;
}

export interface Cellular {
  /** Distance (texels) to the nearest feature point. */
  f1: Field;
  /** Distance to the second nearest; f2 − f1 ≈ 0 on cell borders. */
  f2: Field;
  /** Cell index (0..freq²−1) of the nearest point. */
  id: Int32Array;
  /** Feature point positions (texels), indexed by cell id. */
  px: Float32Array;
  py: Float32Array;
}

/** Tiling Worley / Voronoi cells, freq × freq jittered points. */
export function cellular(p: Paint, freq: number, salt = 0, jitter = 0.85): Cellular {
  const s = p.size;
  const cs = s / freq;
  const n = freq * freq;
  const px = new Float32Array(n);
  const py = new Float32Array(n);
  const seed = hash3(p.seed, salt, 0xce11);
  for (let j = 0; j < freq; j++)
    for (let i = 0; i < freq; i++) {
      px[j * freq + i] = (i + 0.5 + (hash01(i, j, 1, seed) - 0.5) * jitter) * cs;
      py[j * freq + i] = (j + 0.5 + (hash01(i, j, 2, seed) - 0.5) * jitter) * cs;
    }
  const f1 = field(p);
  const f2 = field(p);
  const id = new Int32Array(s * s);
  for (let y = 0; y < s; y++) {
    const cy = Math.floor((y + 0.5) / cs);
    for (let x = 0; x < s; x++) {
      const cx = Math.floor((x + 0.5) / cs);
      let d1 = 1e9;
      let d2 = 1e9;
      let best = 0;
      for (let oy = -1; oy <= 1; oy++) {
        const jy = cy + oy;
        const wy = ((jy % freq) + freq) % freq;
        for (let ox = -1; ox <= 1; ox++) {
          const jx = cx + ox;
          const wx = ((jx % freq) + freq) % freq;
          const k = wy * freq + wx;
          const dx = px[k] + (jx - wx) * cs - (x + 0.5);
          const dy = py[k] + (jy - wy) * cs - (y + 0.5);
          const d = dx * dx + dy * dy;
          if (d < d1) {
            d2 = d1;
            d1 = d;
            best = k;
          } else if (d < d2) d2 = d;
        }
      }
      const i = y * s + x;
      f1[i] = Math.sqrt(d1);
      f2[i] = Math.sqrt(d2);
      id[i] = best;
    }
  }
  return { f1, f2, id, px, py };
}

/** Bilinear wrapped sample of a field at fractional texel coords. */
export function sample(p: Paint, f: Field, x: number, y: number): number {
  const s = p.size;
  const fx = x - 0.5;
  const fy = y - 0.5;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const xa = ((x0 % s) + s) % s;
  const ya = ((y0 % s) + s) % s;
  const xb = (xa + 1) % s;
  const yb = (ya + 1) % s;
  const a = f[ya * s + xa];
  const b = f[ya * s + xb];
  const c = f[yb * s + xa];
  const d = f[yb * s + xb];
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}

/** Wrapped separable box blur (returns a new field). */
export function blur(p: Paint, f: Field, r = 1): Field {
  const s = p.size;
  const tmp = scratch(s, 0);
  const out = field(p);
  const k = 1 / (2 * r + 1);
  // Sliding window sums: O(1) per texel whatever the radius.
  for (let y = 0; y < s; y++) {
    const row = y * s;
    let sum = 0;
    for (let o = -r; o <= r; o++) sum += f[row + ((o + s) % s)];
    for (let x = 0; x < s; x++) {
      tmp[row + x] = sum * k;
      sum += f[row + ((x + r + 1) % s)] - f[row + ((x - r + s) % s)];
    }
  }
  for (let x = 0; x < s; x++) {
    let sum = 0;
    for (let o = -r; o <= r; o++) sum += tmp[((o + s) % s) * s + x];
    for (let y = 0; y < s; y++) {
      out[y * s + x] = sum * k;
      sum += tmp[((y + r + 1) % s) * s + x] - tmp[((y - r + s) % s) * s + x];
    }
  }
  return out;
}

const scratchPool = new Map<number, Float32Array>();

/** Reusable temporary field (slot per caller) for brush internals that
 * never escape — cuts allocation/GC churn when painting 150 materials. */
function scratch(s: number, slot: number): Float32Array {
  const key = s * 16 + slot;
  let f = scratchPool.get(key);
  if (!f) {
    f = new Float32Array(s * s);
    scratchPool.set(key, f);
  }
  return f;
}

/** Value below which a fraction q of the field lies (coverage control). */
export function quantile(f: Field, q: number): number {
  const sorted = Float32Array.from(f).sort();
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * sorted.length)))];
}

/** Distance (texels, 8-connected chamfer, capped) from every texel to the
 * nearest texel where `seedMask` is set. Wrapped. */
export function distanceTo(p: Paint, seedMask: (i: number) => boolean, cap = 8): Field {
  const s = p.size;
  const d = field(p, cap);
  for (let i = 0; i < d.length; i++) if (seedMask(i)) d[i] = 0;
  const D = 1.41;
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < s; y++)
      for (let x = 0; x < s; x++) {
        const i = y * s + x;
        const xm = (x - 1 + s) % s;
        const xp = (x + 1) % s;
        const ym = ((y - 1 + s) % s) * s;
        let v = d[i];
        v = Math.min(v, d[y * s + xm] + 1, d[ym + x] + 1, d[ym + xm] + D, d[ym + xp] + D);
        d[i] = v;
      }
    for (let y = s - 1; y >= 0; y--)
      for (let x = s - 1; x >= 0; x--) {
        const i = y * s + x;
        const xm = (x - 1 + s) % s;
        const xp = (x + 1) % s;
        const yp = ((y + 1) % s) * s;
        let v = d[i];
        v = Math.min(v, d[y * s + xp] + 1, d[yp + x] + 1, d[yp + xm] + D, d[yp + xp] + D);
        d[i] = v;
      }
  }
  return d;
}

/** Crisp lines along the integer iso-contours of a phase field (marble
 * veins, grain lines, strata, contour rings). Uses the phase gradient so a
 * line stays `width` texels wide however much the field is warped — no
 * dotted breakups where the phase changes fast. Phase may jump by whole
 * integers at the texture edge (e.g. k·x/size + noise), it still tiles. */
export function isoLines(p: Paint, phase: Field, width = 1): Field {
  const s = p.size;
  const n = s * s;
  const sn = scratch(s, 1);
  const cs = scratch(s, 2);
  const TAU = Math.PI * 2;
  for (let i = 0; i < n; i++) {
    sn[i] = Math.sin(phase[i] * TAU);
    cs[i] = Math.cos(phase[i] * TAU);
  }
  const out = field(p);
  const hw = width * 0.5;
  for (let y = 0; y < s; y++) {
    const ym = ((y - 1 + s) % s) * s;
    const yp = ((y + 1) % s) * s;
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      const xm = y * s + ((x - 1 + s) % s);
      const xp = y * s + ((x + 1) % s);
      const a = (sn[xp] - sn[xm]) * 0.5;
      const b = (cs[xp] - cs[xm]) * 0.5;
      const c = (sn[yp + x] - sn[ym + x]) * 0.5;
      const d = (cs[yp + x] - cs[ym + x]) * 0.5;
      const g = Math.sqrt(a * a + b * b + c * c + d * d) / TAU + 1e-4;
      const f = phase[i] - Math.round(phase[i]);
      const dist = Math.abs(f) / g;
      out[i] = 1 - smooth(hw - 0.35, hw + 0.35, dist);
    }
  }
  return out;
}

// ─── Palette ramps (the pixel-art core) ─────────────────────────────────────

/** A dark→light colour ramp from hex strings. 4–7 hand-picked steps with a
 * hue shift (cool/saturated shadows, warm highlights) read as pixel art;
 * mapping tone through a ramp is what keeps materials out of "noise soup".
 *
 * Ramps are always odd-length: an even list gets its two middle colours'
 * blend inserted, so tone 0.5 — where painters centre their surfaces —
 * lands on the middle of a step instead of on a dithered boundary (which
 * turns subtle variation into camouflage blotches). Index from the ends
 * (`r[0]`, `top(r)`) rather than by fixed middle positions. */
export function ramp(...hexes: string[]): Ramp {
  const cols = hexes.map(hex);
  if (cols.length % 2 === 0) {
    const m = cols.length / 2;
    const a = cols[m - 1];
    const b = cols[m];
    cols.splice(m, 0, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]);
  }
  return cols;
}

/** Brightest colour of a ramp. */
export function top(r: Ramp): RGB {
  return r[r.length - 1];
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

/** Ordered-dither threshold 0..1 at a texel. */
export function bayer(x: number, y: number): number {
  return BAYER4[(y & 3) * 4 + (x & 3)];
}

/** Quantise t (0..1) to a ramp step. Between two steps the choice is
 * dithered with a Bayer pattern; `dither` 0 = hard posterise, 1 = full
 * ordered dither across the whole step. */
export function rampIndex(n: number, t: number, x: number, y: number, dither = 0.5): number {
  const f = clamp01(t) * (n - 1);
  const lo = Math.floor(f);
  if (lo >= n - 1) return n - 1;
  const th = 0.5 + (bayer(x, y) - 0.5) * dither;
  return f - lo > th ? lo + 1 : lo;
}

export function rampColor(r: Ramp, t: number, x: number, y: number, dither = 0.5): RGB {
  return r[rampIndex(r.length, t, x, y, dither)];
}

/** Paint albedo from a tone field through a ramp (or a per-texel ramp
 * chooser for per-cell hue variation). Texels where `mask` is given and
 * returns false are skipped. */
export function paintTone(
  p: Paint,
  r: Ramp | ((i: number) => Ramp),
  tone: Field,
  dither = 0.5,
  mask?: (i: number) => boolean,
): void {
  const s = p.size;
  const pick = typeof r === "function" ? r : null;
  const fixed = pick ? null : (r as Ramp);
  const a = p.albedo;
  for (let y = 0; y < s; y++) {
    const by = (y & 3) * 4;
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      if (mask && !mask(i)) continue;
      const rr = fixed ?? pick!(i);
      const n = rr.length;
      let t = tone[i];
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const f = t * (n - 1);
      let k = Math.floor(f);
      if (k < n - 1 && f - k > 0.5 + (BAYER4[by + (x & 3)] - 0.5) * dither) k++;
      const c = rr[k];
      a[i * 3] = c[0];
      a[i * 3 + 1] = c[1];
      a[i * 3 + 2] = c[2];
    }
  }
}

/** Multiply every texel's colour by a (tint) colour — cheap hue variation. */
export function tintColor(p: Paint, i: number, c: RGB, t: number): void {
  const a = p.albedo;
  a[i * 3] *= 1 + (c[0] - 1) * t;
  a[i * 3 + 1] *= 1 + (c[1] - 1) * t;
  a[i * 3 + 2] *= 1 + (c[2] - 1) * t;
}

// ─── Layouts: cells + joints ────────────────────────────────────────────────

export const JOINT = -1;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A tiling of the texture into cells separated by joints (mortar, seams,
 * gaps). Every structured material starts from one. */
export interface Layout {
  /** Cell index per texel, JOINT (−1) in joints. */
  id: Int32Array;
  /** Texel distance to the nearest joint (0 on joints), capped at 8. */
  edge: Field;
  count: number;
  /** Cell rectangles for rect-based layouts (bricks, slabs, planks). */
  rects: Rect[];
  /** Local texel coords inside the texel's rect (rect layouts), else 0. */
  lx: Float32Array;
  ly: Float32Array;
  /** Stable per-cell random in [0,1), k selects an independent value. */
  rnd(cell: number, k?: number): number;
}

function makeLayout(p: Paint, id: Int32Array, count: number, rects: Rect[], lx: Float32Array, ly: Float32Array): Layout {
  const seed = hash3(p.seed, count, 0x1a70);
  const edge = distanceTo(p, (i) => id[i] < 0 || isBorder(p, id, i), 8);
  // 16 stable randoms per cell, looked up (painters call rnd per texel).
  const table = new Float32Array(count * 16);
  for (let c = 0; c < count; c++) for (let k = 0; k < 16; k++) table[c * 16 + k] = hash01(c, k, 3, seed);
  return {
    id,
    edge,
    count,
    rects,
    lx,
    ly,
    rnd: (cell, k = 0) => table[cell * 16 + (k & 15)],
  };
}

/** Texel whose right or lower neighbour belongs to a different cell (for
 * gapless layouts the border itself acts as the joint for edge distance). */
function isBorder(p: Paint, id: Int32Array, i: number): boolean {
  const s = p.size;
  const x = i % s;
  const y = (i / s) | 0;
  const a = id[i];
  return id[y * s + ((x + 1) % s)] !== a || id[((y + 1) % s) * s + x] !== a;
}

/** Rasterise wrapped rects: the last `gap` texels on each rect's right and
 * bottom are joint. `warp` (texels) wobbles the joints with smooth noise so
 * hand-laid stone doesn't look ruled. */
export function rasterRects(p: Paint, rects: Rect[], gap = 1, warp = 0, salt = 0): Layout {
  const s = p.size;
  let id = new Int32Array(s * s).fill(JOINT);
  let lx = new Float32Array(s * s);
  let ly = new Float32Array(s * s);
  for (let k = 0; k < rects.length; k++) {
    const r = rects[k];
    // A rect spanning the whole torus has no joint in that direction.
    const w = r.w >= s ? s : r.w - gap;
    const h = r.h >= s ? s : r.h - gap;
    for (let yy = 0; yy < h; yy++)
      for (let xx = 0; xx < w; xx++) {
        const i = p.idx(r.x + xx, r.y + yy);
        id[i] = k;
        lx[i] = xx;
        ly[i] = yy;
      }
  }
  if (warp > 0) {
    // Nearest-sample the ruled layout through a smooth displacement.
    const wx = fbm(p, 4, 2, salt + 901);
    const wy = fbm(p, 4, 2, salt + 902);
    const id2 = new Int32Array(s * s);
    const lx2 = new Float32Array(s * s);
    const ly2 = new Float32Array(s * s);
    for (let y = 0; y < s; y++)
      for (let x = 0; x < s; x++) {
        const i = y * s + x;
        const j = p.idx(Math.round(x + (wx[i] - 0.5) * 2 * warp), Math.round(y + (wy[i] - 0.5) * 2 * warp));
        id2[i] = id[j];
        lx2[i] = lx[j];
        ly2[i] = ly[j];
      }
    id = id2;
    lx = lx2;
    ly = ly2;
  }
  return makeLayout(p, id, rects.length, rects, lx, ly);
}

/** Split a length into random segments within [min,max] that sum exactly. */
export function segments(p: Paint, total: number, min: number, max: number): number[] {
  const out: number[] = [];
  let left = total;
  while (left > 0) {
    if (left <= max) {
      if (left >= min || out.length === 0) {
        out.push(left);
      } else {
        const last = out.pop()!;
        const sum = last + left;
        if (sum <= max) out.push(sum);
        else {
          const a = Math.ceil(sum / 2);
          out.push(a, sum - a);
        }
      }
      break;
    }
    const w = p.rng.int(min, Math.min(max, left - min));
    out.push(w);
    left -= w;
  }
  return out;
}

export interface BrickOpts {
  /** Brick courses across the texture (must divide the size nicely). */
  rows: number;
  minW: number;
  maxW: number;
  mortar?: number;
  /** Joint wobble in texels. */
  warp?: number;
  /** 0 = stack bond, 1 = random per-row offset (running bond). */
  stagger?: number;
}

/** Running-bond bricks with random widths per course. */
export function bricks(p: Paint, o: BrickOpts): Layout {
  const s = p.size;
  const rh = s / o.rows;
  const rects: Rect[] = [];
  let prevOff = 0;
  for (let r = 0; r < o.rows; r++) {
    const widths = segments(p, s, o.minW, o.maxW);
    let off = o.stagger === 0 ? 0 : p.rng.int(0, s - 1);
    if (Math.abs(off - prevOff) < 3) off = (off + Math.floor(o.minW / 2)) % s;
    prevOff = off;
    let x = off;
    for (const w of widths) {
      rects.push({ x, y: Math.round(r * rh), w, h: Math.round((r + 1) * rh) - Math.round(r * rh) });
      x += w;
    }
  }
  return rasterRects(p, rects, o.mortar ?? 1, o.warp ?? 0, 1);
}

/** Irregular flagstones: a random binary partition of the (randomly offset)
 * torus into slabs between min and max size. */
export function slabs(p: Paint, o: { min: number; max: number; gap?: number; warp?: number }): Layout {
  const s = p.size;
  const rects: Rect[] = [];
  const ox = p.rng.int(0, s - 1);
  const oy = p.rng.int(0, s - 1);
  const split = (x: number, y: number, w: number, h: number, depth: number) => {
    const canV = w >= o.min * 2;
    const canH = h >= o.min * 2;
    const mustV = w > o.max;
    const mustH = h > o.max;
    // Early splits are forced; later ones are a coin toss, so slab sizes
    // vary instead of converging on a grid.
    if ((mustV || mustH || ((canV || canH) && p.rng.chance(depth < 1 ? 0.9 : 0.4))) && (canV || canH)) {
      const vert = canV && (!canH || (mustV && !mustH) || (!(mustH && !mustV) && (w > h ? p.rng.chance(0.75) : p.rng.chance(0.25))));
      if (vert) {
        const c = p.rng.int(o.min, w - o.min);
        split(x, y, c, h, depth + 1);
        split(x + c, y, w - c, h, depth + 1);
      } else {
        const c = p.rng.int(o.min, h - o.min);
        split(x, y, w, c, depth + 1);
        split(x, y + c, w, h - c, depth + 1);
      }
      return;
    }
    rects.push({ x: x % s, y: y % s, w, h });
  };
  split(ox, oy, s, s, 0);
  return rasterRects(p, rects, o.gap ?? 1, o.warp ?? 0, 2);
}

/** Boards. Horizontal boards (rows) unless `vertical`; each board is cut
 * into lengths between minLen and maxLen (butt joints). */
export function planks(
  p: Paint,
  o: { boards: number; minLen: number; maxLen: number; gap?: number; vertical?: boolean; full?: number },
): Layout {
  const s = p.size;
  const bw = s / o.boards;
  const rects: Rect[] = [];
  for (let b = 0; b < o.boards; b++) {
    const full = o.minLen >= s || p.rng.chance(o.full ?? 0);
    const lens = full ? [s] : segments(p, s, o.minLen, o.maxLen);
    let t = p.rng.int(0, s - 1);
    const y0 = Math.round(b * bw);
    const hh = Math.round((b + 1) * bw) - y0;
    for (const l of lens) {
      rects.push(o.vertical ? { x: y0, y: t, w: hh, h: l } : { x: t, y: y0, w: l, h: hh });
      t += l;
    }
  }
  return rasterRects(p, rects, o.gap ?? 1, 0, 3);
}

/** Cobbles / river stones: Voronoi cells separated by `gap`-wide joints. */
export function cobbles(p: Paint, o: { freq: number; gap?: number; jitter?: number; round?: number; salt?: number }): Layout {
  const s = p.size;
  const c = cellular(p, o.freq, o.salt ?? 0, o.jitter ?? 0.9);
  const gap = o.gap ?? 1.5;
  const id = new Int32Array(s * s);
  for (let i = 0; i < id.length; i++) id[i] = c.f2[i] - c.f1[i] < gap ? JOINT : c.id[i];
  const lay = makeLayout(p, id, o.freq * o.freq, [], new Float32Array(s * s), new Float32Array(s * s));
  return lay;
}

/** Hexagonal cells (honeycomb, hex tiles). `cols` hexes across; rows are
 * chosen so the tiling wraps (7 cols → nearly regular hexes). */
export function hexes(p: Paint, o: { cols: number; gap?: number }): Layout & { cx: Float32Array; cy: Float32Array; d: Field } {
  const s = p.size;
  const w = s / o.cols;
  let rows = Math.round((o.cols * 2) / Math.sqrt(3));
  if (rows % 2) rows++;
  const vs = s / rows;
  const gap = o.gap ?? 1;
  const id = new Int32Array(s * s);
  const cxs = new Float32Array(o.cols * rows);
  const cys = new Float32Array(o.cols * rows);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < o.cols; c++) {
      cxs[r * o.cols + c] = (c + 0.5 + (r & 1 ? 0.5 : 0)) * w;
      cys[r * o.cols + c] = (r + 0.5) * vs;
    }
  const d = field(p);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      let d1 = 1e9;
      let d2 = 1e9;
      let best = 0;
      const r0 = Math.floor((y + 0.5) / vs);
      for (let dr = -1; dr <= 1; dr++) {
        const r = (((r0 + dr) % rows) + rows) % rows;
        const c0 = Math.floor((x + 0.5) / w - (r & 1 ? 0.5 : 0));
        for (let dc = -1; dc <= 1; dc++) {
          const c = (((c0 + dc) % o.cols) + o.cols) % o.cols;
          const k = r * o.cols + c;
          const dx = wrapDelta(x + 0.5, cxs[k], s);
          const dy = wrapDelta(y + 0.5, cys[k], s);
          const dd = Math.sqrt(dx * dx + dy * dy);
          if (dd < d1) {
            d2 = d1;
            d1 = dd;
            best = k;
          } else if (dd < d2) d2 = dd;
        }
      }
      const i = y * s + x;
      id[i] = d2 - d1 < gap ? JOINT : best;
      d[i] = d1 / (w * 0.5);
    }
  const lay = makeLayout(p, id, o.cols * rows, [], new Float32Array(s * s), new Float32Array(s * s));
  return { ...lay, cx: cxs, cy: cys, d };
}

/** Overlapping scales / feathers: circles on offset rows, upper rows lying
 * on top so each scale shows a U-shaped exposed part with a rounded free
 * lower edge. `d` is the normalised distance from the scale's centre (0
 * centre, 1 rim), `v` 0..1 down the exposed part, `u` −1..1 across. Rows
 * are derived from cols (and stretch) so the pattern wraps. */
export function scaleLayout(
  p: Paint,
  o: { cols: number; stretch?: number; overlap?: number },
): { id: Int32Array; d: Field; v: Field; u: Field; count: number; rnd: (c: number, k?: number) => number } {
  const s = p.size;
  const w = s / o.cols;
  const R = w * 0.6;
  const st = o.stretch ?? 1;
  const Ry = R * st;
  let rows = Math.max(2, Math.round(s / (Ry * (o.overlap ?? 0.85))));
  if (rows % 2) rows++;
  const vs = s / rows;
  const id = new Int32Array(s * s);
  const d = field(p);
  const v = field(p);
  const u = field(p);
  const reach = Math.ceil(Ry / vs) + 1;
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      let found = false;
      const rBase = Math.floor((y + 0.5) / vs);
      // Upper rows on top: scan from the highest candidate row downward.
      for (let dr = -reach; dr <= 0 && !found; dr++) {
        const rr = rBase + dr;
        const r = ((rr % rows) + rows) % rows;
        const cy = rr * vs;
        const dy = (y + 0.5 - cy) / st;
        if (dy < -R * 0.25) continue;
        const c0 = Math.floor((x + 0.5) / w - (r & 1 ? 0.5 : 0));
        for (let dc = 0; dc <= 1 && !found; dc++) {
          const c = (((c0 + dc) % o.cols) + o.cols) % o.cols;
          const cx = (c + 0.5 + (r & 1 ? 0.5 : 0)) * w;
          const dx = wrapDelta(x + 0.5, cx, s);
          const dd = Math.sqrt(dx * dx + dy * dy) / R;
          if (dd <= 1) {
            id[i] = r * o.cols + c;
            d[i] = dd;
            v[i] = clamp01(dy / R);
            u[i] = dx / R;
            found = true;
          }
        }
      }
      if (!found) {
        id[i] = JOINT;
        d[i] = 1;
      }
    }
  const seed = hash3(p.seed, 0x5ca1e, 0);
  return { id, d, v, u, count: o.cols * rows, rnd: (c, k = 0) => hash01(c, k, 9, seed) };
}

// ─── Relief ─────────────────────────────────────────────────────────────────

export interface ReliefOpts {
  /** Height of joint texels. */
  joint?: number;
  /** Height of cell faces. */
  face?: number;
  /** ± random per-cell height offset. */
  vary?: number;
  /** Bevel width in texels (rounded shoulder from joint up to face). */
  bevel?: number;
  /** Bevel profile: 1 = linear chamfer, <1 = pillowy, >1 = sharp. */
  curve?: number;
}

/** Emboss a layout into the height channel: joints low, faces raised with a
 * bevelled shoulder and per-cell variation. Adds to nothing — overwrites. */
export function relief(p: Paint, L: Layout, o: ReliefOpts = {}): void {
  const joint = o.joint ?? 0.2;
  const face = o.face ?? 0.62;
  const vary = o.vary ?? 0.06;
  const bev = o.bevel ?? 1.5;
  const curve = o.curve ?? 0.6;
  for (let i = 0; i < L.id.length; i++) {
    const c = L.id[i];
    if (c < 0) {
      p.height[i] = joint;
      continue;
    }
    const t = Math.pow(clamp01(L.edge[i] / bev), curve);
    const top = face + (L.rnd(c, 7) - 0.5) * 2 * vary;
    p.height[i] = joint + (top - joint) * (0.35 + 0.65 * t);
  }
}

/** Add a field (centred at 0.5) into the height channel. */
export function addHeight(p: Paint, f: Field, amount: number, mask?: (i: number) => boolean): void {
  for (let i = 0; i < f.length; i++) if (!mask || mask(i)) p.height[i] += (f[i] - 0.5) * amount;
}

/** Baked light from the upper-left derived from the height field, roughly
 * −1..1 × strength. Pixel artists shade every bevel this way; a modest
 * amount keeps texels crisp even under flat or dim lighting. */
export function lightField(p: Paint, strength = 1): Field {
  const s = p.size;
  const h = p.height;
  const f = field(p);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const gx = h[y * s + ((x + 1) % s)] - h[y * s + ((x - 1 + s) % s)];
      const gy = h[((y + 1) % s) * s + x] - h[((y - 1 + s) % s) * s + x];
      f[y * s + x] = (gx + gy) * strength;
    }
  return f;
}

/** Height minus its local mean (negative in cavities, positive on ridges). */
export function cavity(p: Paint, r = 2): Field {
  const b = blur(p, p.height, r);
  const f = field(p);
  for (let i = 0; i < f.length; i++) f[i] = p.height[i] - b[i];
  return f;
}

/** Chip cell edges: texels near joints with high noise lose their face and
 * become lower, rougher broken stone. Returns the chip mask. */
export function chipEdges(p: Paint, L: Layout, o: { amount?: number; depth?: number; reach?: number; salt?: number } = {}): Uint8Array {
  const amount = o.amount ?? 0.35;
  const depth = o.depth ?? 0.18;
  const reach = o.reach ?? 2.2;
  const n = fbm(p, 16, 2, (o.salt ?? 0) + 311);
  const m = new Uint8Array(L.id.length);
  // Corner chips: texels near two joints at once chip more readily. Joint
  // density over a 5×5 window says how "cornered" a texel is.
  const joints = field(p);
  for (let i = 0; i < joints.length; i++) joints[i] = L.id[i] < 0 ? 1 : 0;
  const density = blur(p, joints, 2);
  for (let i = 0; i < L.id.length; i++) {
    if (L.id[i] < 0) continue;
    const e = L.edge[i];
    if (e > reach) continue;
    const corner = density[i] * 25 > 9 ? 0.25 : 0;
    const score = n[i] + corner - (e - 1) * 0.18;
    if (score > 1 - amount) {
      m[i] = 1;
      p.height[i] -= depth * (0.6 + 0.4 * n[i]);
    }
  }
  return m;
}

// ─── Overlays ───────────────────────────────────────────────────────────────

/** Soft darkening/tinting from the bottom ("bottom") or top ("top"),
 * favouring cavities, with a noisy front. Keep `reach` modest on walls —
 * the texture repeats vertically. */
export function grime(
  p: Paint,
  o: { color: RGB; amount: number; from?: "bottom" | "top" | "none"; reach?: number; cavity?: number; salt?: number; freq?: number },
): void {
  const s = p.size;
  const n = fbm(p, o.freq ?? 4, 3, (o.salt ?? 0) + 41);
  const cav = o.cavity ? cavity(p, 2) : null;
  const reach = o.reach ?? 0.4;
  for (let y = 0; y < s; y++) {
    const gy = o.from === "top" ? 1 - (y + 0.5) / s : (y + 0.5) / s;
    const g = !o.from || o.from === "none" ? 0.5 : smooth(1 - reach, 1, gy);
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      let t = g * 0.7 + (n[i] - 0.5) * 0.9;
      if (cav) t += -cav[i] * (o.cavity ?? 0) * 3;
      t = clamp01(t) * o.amount;
      if (t > 0) p.mix(i, o.color, t);
    }
  }
}

export interface MossOpts {
  ramp: Ramp;
  /** Fraction of texels covered (0..1). */
  coverage: number;
  /** Weight of cavities / low texels (moss lives in joints). */
  crevice?: number;
  /** Weight of gravity (grows from the bottom rows). */
  bottom?: number;
  /** Clump size: lattice frequency of the growth noise. */
  freq?: number;
  salt?: number;
  /** Raise height of moss texels. */
  lift?: number;
  /** Don't grow where this returns false. */
  mask?: (i: number) => boolean;
}

/** Moss / lichen / mould growth with a broken pixel-clump edge. Returns the
 * coverage mask (0 or 0..1 density). */
export function moss(p: Paint, o: MossOpts): Field {
  const s = p.size;
  const n = fbm(p, o.freq ?? 6, 3, (o.salt ?? 0) + 71);
  const g = grainNoise(p, (o.salt ?? 0) + 72);
  const score = field(p);
  const hMean = blur(p, p.height, 2);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      let sc = n[i] + g[i] * 0.22;
      sc += (0.5 - p.height[i]) * (o.crevice ?? 0.8) + (hMean[i] - p.height[i]) * (o.crevice ?? 0.8);
      sc += Math.pow((y + 0.5) / s, 2) * (o.bottom ?? 0);
      if (o.mask && !o.mask(i)) sc = -9;
      score[i] = sc;
    }
  const th = quantile(score, 1 - o.coverage);
  const out = field(p);
  const lift = o.lift ?? 0.04;
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      const d = score[i] - th;
      if (d < -0.04 || score[i] < -5) continue;
      if (d < 0 && bayer(x, y) > 0.35) continue;
      const t = clamp01(0.25 + d * 3 + (g[i] - 0.5) * 0.5);
      p.setColor(i, rampColor(o.ramp, t, x, y, 0.8));
      p.height[i] += lift * (0.5 + t);
      p.rough[i] = 0.95;
      p.metal[i] = 0;
      out[i] = 0.3 + t * 0.7;
    }
  return out;
}

/** Vertical runs of stain (water, rust, soot, blood) that start at random
 * points and trickle downward, thinning out. Optionally wet (low rough). */
export function drips(
  p: Paint,
  o: { count: number; color: RGB; strength?: number; minLen?: number; maxLen?: number; wet?: number; start?: (x: number) => number; darkenOnly?: boolean },
): void {
  const s = p.size;
  const str = o.strength ?? 0.5;
  for (let k = 0; k < o.count; k++) {
    const x0 = p.rng.int(0, s - 1);
    const y0 = o.start ? o.start(x0) : p.rng.int(0, s - 1);
    const len = p.rng.int(o.minLen ?? 6, o.maxLen ?? 24);
    let x = x0;
    const w = p.rng.chance(0.3) ? 2 : 1;
    for (let t = 0; t < len; t++) {
      const fall = 1 - t / len;
      const a = str * (0.4 + 0.6 * fall);
      for (let ww = 0; ww < w; ww++) {
        const i = p.idx(x + ww, y0 + t);
        p.mix(i, o.color, a * (ww ? 0.6 : 1));
        if (o.wet !== undefined) p.rough[i] = Math.min(p.rough[i], lerp(p.rough[i], o.wet, fall));
      }
      if (p.rng.chance(0.08)) x += p.rng.sign();
    }
    // Bead at the bottom end of longer drips.
    if (len > 10 && p.rng.chance(0.5)) p.mix(p.idx(x, y0 + len), o.color, str * 0.8);
  }
}

export interface CrackOpts {
  count: number;
  length?: [number, number];
  depth?: number;
  /** Colour of the crack core. */
  color?: RGB;
  /** Probability per step of forking a side branch. */
  branch?: number;
  /** Lighten the texel below-right of a crack (its lit lip). */
  lip?: number;
  /** Only crack where this returns true (e.g. inside cells). */
  mask?: (i: number) => boolean;
  /** Mean direction (radians); random if omitted. */
  angle?: number;
  wander?: number;
}

/** Random-walk cracks with forks, carved into height with a dark core and a
 * light lip. Returns the crack mask. */
export function cracks(p: Paint, o: CrackOpts): Uint8Array {
  const s = p.size;
  const m = new Uint8Array(s * s);
  const [lmin, lmax] = o.length ?? [8, 24];
  const walk = (x: number, y: number, a: number, len: number, gen: number) => {
    for (let t = 0; t < len; t++) {
      const i = p.idx(x, y);
      if (o.mask && !o.mask(i)) {
        if (t > 2) return;
      } else m[i] = gen === 0 && t < len - 2 ? 2 : 1;
      a += p.rng.gauss() * (o.wander ?? 0.5);
      x += Math.cos(a);
      y += Math.sin(a);
      if (gen < 2 && p.rng.chance(o.branch ?? 0.06)) walk(x, y, a + p.rng.sign() * p.rng.range(0.5, 1.2), Math.floor(len * 0.4), gen + 1);
    }
  };
  for (let k = 0; k < o.count; k++) {
    const a = o.angle !== undefined ? o.angle + p.rng.gauss() * 0.4 : p.rng.range(0, Math.PI * 2);
    walk(p.rng.range(0, s), p.rng.range(0, s), a, p.rng.int(lmin, lmax), 0);
  }
  const depth = o.depth ?? 0.2;
  const col = o.color ?? ([0.05, 0.04, 0.04] as RGB);
  const lip = o.lip ?? 0.25;
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      if (!m[i]) continue;
      p.height[i] -= depth * (m[i] === 2 ? 1 : 0.6);
      p.mix(i, col, m[i] === 2 ? 0.85 : 0.6);
      const j = p.idx(x + 1, y + 1);
      if (!m[j] && lip > 0) p.mix(j, [1, 1, 1], lip * 0.35);
    }
  return m;
}

/** Brighten (or recolour) texels on cell shoulders where noise says the
 * edge has been rubbed: exposed metal, worn paint, polished stone. */
export function edgeWear(
  p: Paint,
  L: Layout,
  o: { color: RGB; amount?: number; width?: number; salt?: number; metal?: number; rough?: number },
): void {
  const n = fbm(p, 12, 2, (o.salt ?? 0) + 55);
  const w = o.width ?? 1.5;
  const amt = o.amount ?? 0.6;
  for (let i = 0; i < L.id.length; i++) {
    if (L.id[i] < 0) continue;
    const e = L.edge[i];
    if (e > w + 0.5) continue;
    const t = n[i] - (e - 1) * 0.25;
    if (t > 1 - amt) {
      p.mix(i, o.color, 0.7);
      if (o.metal !== undefined) p.metal[i] = o.metal;
      if (o.rough !== undefined) p.rough[i] = o.rough;
    }
  }
}

/** Scattered single-texel specks (grit, pores, sparkle). */
export function speckle(p: Paint, o: { density: number; color: RGB; amount?: number; h?: number; salt?: number; mask?: (i: number) => boolean }): void {
  const n = p.size * p.size;
  for (let i = 0; i < n; i++) {
    if (hash01(i, o.salt ?? 0, 13, p.seed) > o.density) continue;
    if (o.mask && !o.mask(i)) continue;
    p.mix(i, o.color, o.amount ?? 0.6);
    if (o.h) p.height[i] += o.h;
  }
}

/** Wet the low parts: texels below `level` (after local-mean comparison)
 * become glossy, slightly darker — puddles in slab cracks mirror torches. */
export function puddles(p: Paint, o: { coverage: number; rough?: number; darken?: number; tint?: RGB; salt?: number; flatten?: boolean }): Field {
  const s = p.size;
  const n = fbm(p, 4, 2, (o.salt ?? 0) + 61);
  // Water collects where the ground is low over an area (joints meeting,
  // dips), not in single low texels: score by the blurred height.
  const low = blur(p, p.height, 2);
  const score = field(p);
  for (let i = 0; i < score.length; i++) score[i] = -low[i] * 3 - p.height[i] + n[i] * 0.5;
  const th = quantile(score, 1 - o.coverage);
  const out = field(p);
  let level = 0;
  let cnt = 0;
  for (let i = 0; i < score.length; i++)
    if (score[i] > th) {
      level += p.height[i];
      cnt++;
    }
  level = cnt ? level / cnt : 0.3;
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      if (score[i] <= th) continue;
      out[i] = 1;
      p.rough[i] = o.rough ?? 0.12;
      p.shade(i, 1 - (o.darken ?? 0.3));
      if (o.tint) p.mix(i, o.tint, 0.35);
      if (o.flatten !== false) p.height[i] = Math.min(p.height[i], level);
    }
  return out;
}

/** Round rivet / bolt head: domed height, lit upper-left, dark lower-right. */
export function rivet(
  p: Paint,
  cx: number,
  cy: number,
  r: number,
  o: { ramp: Ramp; metal?: number; rough?: number; h?: number; ring?: boolean },
): void {
  const base = p.height[p.idx(cx, cy)];
  p.disc(cx, cy, r + 0.6, (i, d) => {
    // Dark ring where the head meets the plate.
    if (d > r / (r + 0.6)) {
      p.shade(i, 0.55);
      return;
    }
    const x = i % p.size;
    const y = (i / p.size) | 0;
    const dx = wrapDelta(x + 0.5, cx, p.size) / r;
    const dy = wrapDelta(y + 0.5, cy, p.size) / r;
    const dome = Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy));
    p.height[i] = Math.max(p.height[i], base + (o.h ?? 0.25) * dome);
    const t = clamp01(0.45 + dome * 0.25 - (dx + dy) * 0.45);
    p.setColor(i, rampColor(o.ramp, t, x, y, 0.3));
    p.metal[i] = o.metal ?? 1;
    p.rough[i] = o.rough ?? 0.4;
  });
}

/** Square nail head (2×2 or 1×1): dark rim, one bright texel. */
export function nail(p: Paint, x: number, y: number, o: { dark?: RGB; light?: RGB; big?: boolean } = {}): void {
  const dark = o.dark ?? ([0.12, 0.11, 0.1] as RGB);
  const light = o.light ?? ([0.55, 0.53, 0.5] as RGB);
  if (o.big) {
    p.set(x, y, { c: light, h: 0.8, m: 1, r: 0.45 });
    p.set(x + 1, y, { c: dark, h: 0.75, m: 1, r: 0.5 });
    p.set(x, y + 1, { c: dark, h: 0.75, m: 1, r: 0.5 });
    p.set(x + 1, y + 1, { c: scaleDark(dark), h: 0.7, m: 1, r: 0.5 });
  } else {
    p.set(x, y, { c: light, h: 0.75, m: 1, r: 0.45 });
    p.set(x + 1, y + 1, { c: dark, h: 0.5 });
  }
}

function scaleDark(c: RGB): RGB {
  return [c[0] * 0.6, c[1] * 0.6, c[2] * 0.6];
}

/** Shallow round depressions (dents, pits, pockmarks) in the height field. */
export function dents(p: Paint, o: { count: number; r: [number, number]; depth: number; darken?: number }): void {
  for (let k = 0; k < o.count; k++) {
    const cx = p.rng.range(0, p.size);
    const cy = p.rng.range(0, p.size);
    const r = p.rng.range(o.r[0], o.r[1]);
    p.disc(cx, cy, r, (i, d) => {
      const f = 1 - d * d;
      p.height[i] -= o.depth * f;
      if (o.darken) p.shade(i, 1 - o.darken * f);
    });
  }
}

// ─── Stamps & glyphs ────────────────────────────────────────────────────────

/** Stamp a hand-drawn pixel template. Each string is a row; '.' and ' ' are
 * transparent, any other char is passed to fn (use digits as tone indices,
 * letters as roles). Wraps. */
export function stamp(
  p: Paint,
  x0: number,
  y0: number,
  art: readonly string[],
  fn: (i: number, ch: string, lx: number, ly: number) => void,
  flipX = false,
): void {
  for (let ly = 0; ly < art.length; ly++) {
    const row = art[ly];
    for (let lx = 0; lx < row.length; lx++) {
      const ch = row[flipX ? row.length - 1 - lx : lx];
      if (ch === "." || ch === " ") continue;
      fn(p.idx(x0 + lx, y0 + ly), ch, lx, ly);
    }
  }
}

/** A procedural rune on a small grid: 2–4 strokes between nodes of a 3×3
 * lattice spanning w×h texels. Deterministic per `key`. Calls fn for each
 * stroke texel. The same key always yields the same glyph, so a painter can
 * write "words". */
export function rune(p: Paint, x0: number, y0: number, w: number, h: number, key: number, fn: (i: number) => void): void {
  const nodes: [number, number][] = [];
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) nodes.push([Math.round((i * (w - 1)) / 2), Math.round((j * (h - 1)) / 2)]);
  const r = (k: number) => hash01(key, k, 21, p.seed);
  // A spine (vertical stave) is what makes random strokes read as runes.
  const spine = Math.floor(r(0) * 3);
  const strokes: [number, number][] = [[spine, spine + 6]];
  const count = 2 + Math.floor(r(1) * 3);
  for (let k = 0; k < count; k++) {
    const a = Math.floor(r(2 + k * 2) * 9);
    let b = Math.floor(r(3 + k * 2) * 9);
    if (b === a) b = (a + 4) % 9;
    strokes.push([a, b]);
  }
  const seen = new Set<number>();
  for (const [a, b] of strokes) {
    p.line(x0 + nodes[a][0], y0 + nodes[a][1], x0 + nodes[b][0], y0 + nodes[b][1], (i) => {
      if (seen.has(i)) return;
      seen.add(i);
      fn(i);
    });
  }
}

// ─── Material-specific fields ───────────────────────────────────────────────

export interface GrainOpts {
  /** Grain lines across the texture (perpendicular to the boards). */
  rings?: number;
  /** How far (texels) the grain wanders across the board. */
  warp?: number;
  /** Knots per texture. */
  knots?: number;
  vertical?: boolean;
  salt?: number;
  /** Per-texel phase offset in texels (e.g. per plank) — boards differ. */
  phase?: (i: number) => number;
}

export interface Grain {
  /** 0..1 tone: broad early/late-wood bands + lengthwise fibre streaks. */
  tone: Field;
  /** 1 on the thin dark latewood lines (broken, like hand-drawn grain). */
  line: Field;
  /** 0..1 knot core mask. */
  knot: Field;
}

/** Wood grain in the pixel-art idiom: long thin dark lines that wander,
 * fade out and bow into eye shapes around knots, over broad soft bands. */
export function woodGrain(p: Paint, o: GrainOpts = {}): Grain {
  const s = p.size;
  const vert = !!o.vertical;
  const salt = o.salt ?? 0;
  const aw = (along: number, across: number, oct: number, k: number) =>
    vert ? fbmXY(p, across, along, oct, salt + k) : fbmXY(p, along, across, oct, salt + k);
  const wander = aw(1, 3, 2, 81);
  const breaks = aw(3, 16, 2, 82);
  const fibre = aw(1, 32, 2, 83);
  const rings = o.rings ?? 12;
  const warp = o.warp ?? 3;
  const knots: [number, number, number][] = [];
  for (let k = 0; k < (o.knots ?? 2); k++) knots.push([p.rng.range(0, s), p.rng.range(0, s), p.rng.range(1.6, 2.8)]);
  const tone = field(p);
  const phase = field(p);
  const knot = field(p);
  const bend = field(p);
  // Knots only bend the grain nearby: visit each knot's window, not the
  // whole texture per knot.
  for (const [kx, ky, kr] of knots) {
    const ra = Math.ceil(kr * 8);
    const rb = Math.ceil(kr * 2.2);
    for (let a = -ra; a <= ra; a++)
      for (let b = -rb; b <= rb; b++) {
        const x = Math.floor(vert ? kx + b : kx + a);
        const y = Math.floor(vert ? ky + a : ky + b);
        const dx = x + 0.5 - kx;
        const dy = y + 0.5 - ky;
        const da = vert ? dy : dx;
        const db = vert ? dx : dy;
        const i = p.idx(x, y);
        // Lines are pushed away from the knot's centre line → eye shape.
        const push = Math.max(0, kr * 2.2 - Math.abs(db)) * Math.exp(-(da * da) / (kr * kr * 7));
        bend[i] += (db >= 0 ? 1 : -1) * push;
        const e = Math.sqrt((da * da) / 2.2 + db * db) / kr;
        if (e < 1) knot[i] = Math.max(knot[i], 1 - e);
      }
  }
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      const b = (vert ? x : y) + (wander[i] - 0.5) * 2 * warp + (o.phase ? o.phase(i) : 0) + bend[i];
      const ph = (b / s) * rings;
      phase[i] = ph;
      const band = Math.sin(ph * Math.PI) * 0.5 + 0.5;
      tone[i] = clamp01(0.5 + (band - 0.5) * 0.3 + (fibre[i] - 0.5) * 0.45);
    }
  const line = isoLines(p, phase, 1);
  for (let i = 0; i < line.length; i++) line[i] *= breaks[i] > 0.3 ? 1 : 0.4;
  return { tone, line, knot };
}

/** Woven cloth: over/under threads on a `cell`-texel grid. Returns tone
 * (thread shading, 0..1) and writes gentle weave relief into height. */
export function weave(p: Paint, o: { cell?: number; salt?: number; slub?: number; gapTone?: number }): Field {
  const s = p.size;
  const c = o.cell ?? 2;
  const warpN = fbmXY(p, 1, 32, 1, (o.salt ?? 0) + 91);
  const weftN = fbmXY(p, 32, 1, 1, (o.salt ?? 0) + 92);
  const tone = field(p);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      const cx = Math.floor(x / c);
      const cy = Math.floor(y / c);
      const over = (cx + cy) & 1;
      const lx = (x % c) / (c - 1 || 1);
      const ly = (y % c) / (c - 1 || 1);
      // Thread crown across its width; the over-thread sits higher.
      const across = over ? ly : lx;
      const crown = 1 - Math.abs(across - 0.5) * 2 * (c > 2 ? 1 : 0.5);
      const thread = over ? weftN[i] : warpN[i];
      const slub = (thread - 0.5) * (o.slub ?? 0.5);
      tone[i] = clamp01(0.35 + crown * 0.35 + over * 0.12 + slub);
      p.height[i] = 0.45 + over * 0.12 + crown * 0.1;
    }
  return tone;
}

/** Vein / vessel network mask (0..1, 1 on the centre line): the zero
 * crossings of smooth noise give continuous winding vessels; a second
 * noise fades some runs out so they read as branching rather than a maze.
 * `width` is in texels. */
export function veins(p: Paint, freq: number, width = 1.2, salt = 0, fade = 0.35): Field {
  const n = fbm(p, freq, 2, salt + 17, 0.4);
  for (let i = 0; i < n.length; i++) n[i] -= 0.5;
  const out = isoLines(p, n, width);
  if (fade > 0) {
    const f = fbm(p, Math.max(2, freq), 2, salt + 18);
    for (let i = 0; i < out.length; i++) out[i] *= smooth(fade - 0.15, fade + 0.1, f[i]);
  }
  return out;
}

/** Apply per-texel roughness from a base ± noise field. */
export function roughFrom(p: Paint, base: number, f?: Field, amount = 0.1, mask?: (i: number) => boolean): void {
  for (let i = 0; i < p.rough.length; i++) {
    if (mask && !mask(i)) continue;
    p.rough[i] = clamp01(base + (f ? (f[i] - 0.5) * 2 * amount : 0));
  }
}

/** Fill the metal channel (optionally masked). */
export function metalFrom(p: Paint, v: number, mask?: (i: number) => boolean): void {
  for (let i = 0; i < p.metal.length; i++) if (!mask || mask(i)) p.metal[i] = v;
}

/** Copy tone+ramp into albedo with an emissive mask for texels above
 * `from` — lava, glowing fungus, runes. */
export function glowFrom(p: Paint, f: Field, from: number, to = 1, mask?: (i: number) => boolean): void {
  for (let i = 0; i < f.length; i++) {
    if (mask && !mask(i)) continue;
    const e = smooth(from, to, f[i]);
    if (e > p.emit[i]) p.emit[i] = e;
  }
}

/** Clamp height to 0..1 (call after stacking relief brushes). */
export function clampHeight(p: Paint): void {
  for (let i = 0; i < p.height.length; i++) p.height[i] = clamp01(p.height[i]);
}
