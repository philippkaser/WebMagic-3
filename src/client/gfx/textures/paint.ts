import { Rng, hashString } from "../../../shared/util/rng";

/** The painting surface every procedural material is drawn on.
 *
 * A material is not just a colour image: painters fill five channels, and
 * the library turns them into three GPU texture arrays —
 *   albedo  (sRGB rgb + alpha for cut-outs)
 *   normal  (tangent-space normal derived from `height`, + height in alpha)
 *   orm     (ambient occlusion, roughness, metalness, emissive mask)
 * so every chunky texel catches light, reflects, or glows correctly.
 *
 * Colours are sRGB in [0,1] (what you'd pick in a colour picker). All
 * coordinates wrap, so anything drawn across an edge tiles seamlessly. */

export type RGB = [number, number, number];

export class Paint {
  readonly size: number;
  readonly rng: Rng;
  readonly seed: number;
  /** sRGB colour, 3 floats per texel. */
  readonly albedo: Float32Array;
  /** 0..1 coverage; < 0.5 is cut out (webs, grates, leaves). */
  readonly alpha: Float32Array;
  /** 0..1 relief. Drives the normal map and baked cavity AO. */
  readonly height: Float32Array;
  readonly rough: Float32Array;
  readonly metal: Float32Array;
  /** 0..1 emissive mask; emitted colour = albedo × mask × material glow. */
  readonly emit: Float32Array;

  constructor(size: number, seedKey: string) {
    this.size = size;
    this.seed = hashString(seedKey);
    this.rng = new Rng(this.seed);
    const n = size * size;
    this.albedo = new Float32Array(n * 3).fill(0.5);
    this.alpha = new Float32Array(n).fill(1);
    this.height = new Float32Array(n).fill(0.5);
    this.rough = new Float32Array(n).fill(0.85);
    this.metal = new Float32Array(n);
    this.emit = new Float32Array(n);
  }

  /** Wrapped texel index. */
  idx(x: number, y: number): number {
    const s = this.size;
    const xi = ((Math.floor(x) % s) + s) % s;
    const yi = ((Math.floor(y) % s) + s) % s;
    return yi * s + xi;
  }

  /** Visit every texel. `u,v` are 0..1 (texel centres). */
  each(fn: (x: number, y: number, i: number, u: number, v: number) => void): void {
    const s = this.size;
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) fn(x, y, y * s + x, (x + 0.5) / s, (y + 0.5) / s);
    }
  }

  setColor(i: number, c: RGB): void {
    this.albedo[i * 3] = c[0];
    this.albedo[i * 3 + 1] = c[1];
    this.albedo[i * 3 + 2] = c[2];
  }

  getColor(i: number): RGB {
    return [this.albedo[i * 3], this.albedo[i * 3 + 1], this.albedo[i * 3 + 2]];
  }

  /** Multiply the colour at i (grime, shading, variation). */
  shade(i: number, k: number): void {
    this.albedo[i * 3] *= k;
    this.albedo[i * 3 + 1] *= k;
    this.albedo[i * 3 + 2] *= k;
  }

  /** Blend colour toward c by t. */
  mix(i: number, c: RGB, t: number): void {
    const a = this.albedo;
    a[i * 3] += (c[0] - a[i * 3]) * t;
    a[i * 3 + 1] += (c[1] - a[i * 3 + 1]) * t;
    a[i * 3 + 2] += (c[2] - a[i * 3 + 2]) * t;
  }

  /** Set several channels of one texel at once. */
  set(
    x: number,
    y: number,
    v: { c?: RGB; h?: number; r?: number; m?: number; e?: number; a?: number },
  ): void {
    const i = this.idx(x, y);
    if (v.c) this.setColor(i, v.c);
    if (v.h !== undefined) this.height[i] = v.h;
    if (v.r !== undefined) this.rough[i] = v.r;
    if (v.m !== undefined) this.metal[i] = v.m;
    if (v.e !== undefined) this.emit[i] = v.e;
    if (v.a !== undefined) this.alpha[i] = v.a;
  }

  fill(c: RGB, h = 0.5, r = 0.85, m = 0): void {
    for (let i = 0; i < this.size * this.size; i++) {
      this.setColor(i, c);
      this.height[i] = h;
      this.rough[i] = r;
      this.metal[i] = m;
    }
  }

  /** Axis-aligned rectangle (wraps). */
  rect(x0: number, y0: number, w: number, h: number, fn: (i: number, lx: number, ly: number) => void): void {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) fn(this.idx(x0 + x, y0 + y), x, y);
  }

  /** Filled disc (wraps). fn gets the normalised distance 0..1 from centre. */
  disc(cx: number, cy: number, r: number, fn: (i: number, d: number) => void): void {
    const r2 = r * r;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const d2 = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2;
        if (d2 <= r2) fn(this.idx(x, y), Math.sqrt(d2) / r);
      }
    }
  }

  /** 1-texel line (Bresenham, wraps). */
  line(x0: number, y0: number, x1: number, y1: number, fn: (i: number, t: number) => void): void {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const steps = Math.max(dx, dy, 1);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      fn(this.idx(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t)), t);
    }
  }

  /** Box-blur the height channel (softens relief without touching colour). */
  blurHeight(radius = 1): void {
    const s = this.size;
    const src = Float32Array.from(this.height);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        let sum = 0;
        let n = 0;
        for (let oy = -radius; oy <= radius; oy++)
          for (let ox = -radius; ox <= radius; ox++) {
            sum += src[this.idx(x + ox, y + oy)];
            n++;
          }
        this.height[y * s + x] = sum / n;
      }
    }
  }
}

/** Parse "#rrggbb" into sRGB floats. */
export function hex(h: string): RGB {
  const n = parseInt(h.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function mixRGB(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function scaleRGB(a: RGB, k: number): RGB {
  return [a[0] * k, a[1] * k, a[2] * k];
}

/** Wrapped neighbour tables per texture size: index ± 1 with wrap. Painting
 * runs for every material at startup, so the per-texel loops below avoid
 * modulo arithmetic. */
const wrapTables = new Map<number, { m1: Int32Array; p1: Int32Array; m2: Int32Array; p2: Int32Array }>();
function wraps(s: number) {
  let t = wrapTables.get(s);
  if (!t) {
    const mk = (o: number) => Int32Array.from({ length: s }, (_, k) => (((k + o) % s) + s) % s);
    t = { m1: mk(-1), p1: mk(1), m2: mk(-2), p2: mk(2) };
    wrapTables.set(s, t);
  }
  return t;
}

/** Wrapped Sobel: height → tangent-space normal (+Y up in texture space is
 * "v increasing", matching three.js UV conventions). Returns RGBA8. */
export function heightToNormal(p: Paint, strength: number): Uint8Array {
  const s = p.size;
  const hf = p.height;
  const { m1, p1 } = wraps(s);
  const out = new Uint8Array(s * s * 4);
  for (let y = 0; y < s; y++) {
    const rm = m1[y] * s;
    const r0 = y * s;
    const rp = p1[y] * s;
    for (let x = 0; x < s; x++) {
      const xm = m1[x];
      const xp = p1[x];
      const dx = (hf[rm + xp] + 2 * hf[r0 + xp] + hf[rp + xp] - hf[rm + xm] - 2 * hf[r0 + xm] - hf[rp + xm]) * strength;
      const dy = (hf[rp + xm] + 2 * hf[rp + x] + hf[rp + xp] - hf[rm + xm] - 2 * hf[rm + x] - hf[rm + xp]) * strength;
      // Canvas rows go down while v goes up, hence +dy.
      const nx = -dx;
      const ny = dy;
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1);
      const o = (r0 + x) * 4;
      out[o] = (nx * inv * 0.5 + 0.5) * 255 + 0.5;
      out[o + 1] = (ny * inv * 0.5 + 0.5) * 255 + 0.5;
      out[o + 2] = (inv * 0.5 + 0.5) * 255 + 0.5;
      const h = hf[r0 + x];
      out[o + 3] = (h < 0 ? 0 : h > 1 ? 1 : h) * 255 + 0.5;
    }
  }
  return out;
}

/** Cheap cavity occlusion from the height field: texels lower than their
 * neighbourhood (5×5 mean, wrapped) get darker. */
export function cavityAO(p: Paint, amount: number): Float32Array {
  const s = p.size;
  const hf = p.height;
  const { m1, p1, m2, p2 } = wraps(s);
  const rows = new Float32Array(s * s);
  for (let y = 0; y < s; y++) {
    const r0 = y * s;
    for (let x = 0; x < s; x++) rows[r0 + x] = hf[r0 + m2[x]] + hf[r0 + m1[x]] + hf[r0 + x] + hf[r0 + p1[x]] + hf[r0 + p2[x]];
  }
  const out = new Float32Array(s * s);
  const k = amount * 4;
  for (let y = 0; y < s; y++) {
    const a = m2[y] * s;
    const b = m1[y] * s;
    const c = y * s;
    const d = p1[y] * s;
    const e = p2[y] * s;
    for (let x = 0; x < s; x++) {
      const mean = (rows[a + x] + rows[b + x] + rows[c + x] + rows[d + x] + rows[e + x]) / 25;
      const v = 1 + (hf[c + x] - mean) * k;
      out[c + x] = v < 0 ? 0 : v > 1 ? 1 : v;
    }
  }
  return out;
}
