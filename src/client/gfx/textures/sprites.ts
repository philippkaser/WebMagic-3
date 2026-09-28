import { DataTexture, NearestFilter, RGBAFormat, SRGBColorSpace, UnsignedByteType } from "three";
import { Rng, hashString } from "../../../shared/util/rng";

/** Particle sprite atlas: every particle look (embers, smoke, spores, runes,
 * blood…) is a 16×16 pixel-art sprite painted in code at startup and packed
 * into one nearest-sampled RGBA8 texture.
 *
 * Conventions:
 *  - Sprites are authored in canvas order (row 0 = top); the atlas is
 *    uploaded bottom-up so `rects` are plain UVs with v growing upward
 *    (u0,v0 = bottom-left, u1,v1 = top-right) and sprites appear upright.
 *  - Straight (non-premultiplied) alpha, sRGB colour. Most sprites are white
 *    or grey shapes: the particle colour multiplies them. A few are
 *    pre-coloured (ember, flame*, blood, ink, leaf, splinter, bone_chip) and
 *    want a white particle tint. For additive blending use rgb × a.
 *  - Crisp, hand-drawn-looking pixels; only `glow` and `smoke*` use soft
 *    gradients. */

export const SPRITE_SIZE = 16;

export type SpriteRect = [number, number, number, number];

export class SpritePaint {
  readonly size = SPRITE_SIZE;
  /** RGBA floats 0..1, row 0 at the top. */
  readonly rgba = new Float32Array(SPRITE_SIZE * SPRITE_SIZE * 4);
  readonly rng: Rng;

  constructor(id: string) {
    this.rng = new Rng(hashString(id));
    // Transparent white: tinting never picks up dark fringes.
    for (let i = 0; i < SPRITE_SIZE * SPRITE_SIZE; i++) this.rgba.set([1, 1, 1, 0], i * 4);
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.size && y < this.size;
  }

  /** Overwrite a texel (ignores out-of-bounds). */
  set(x: number, y: number, r: number, g: number, b: number, a: number): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (!this.inside(x, y)) return;
    const o = (y * this.size + x) * 4;
    this.rgba[o] = r;
    this.rgba[o + 1] = g;
    this.rgba[o + 2] = b;
    this.rgba[o + 3] = a;
  }

  /** Grey value v with alpha a, only if it raises the existing alpha
   * (shapes can overlap without punching holes). */
  px(x: number, y: number, v: number, a = 1): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (!this.inside(x, y)) return;
    const o = (y * this.size + x) * 4;
    if (a < this.rgba[o + 3]) return;
    this.set(x, y, v, v, v, a);
  }

  /** Colour texel from a hex string, alpha a (raise-only like px). */
  hex(x: number, y: number, h: string, a = 1): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (!this.inside(x, y)) return;
    const o = (y * this.size + x) * 4;
    if (a < this.rgba[o + 3]) return;
    const n = parseInt(h.slice(1), 16);
    this.set(x, y, ((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a);
  }

  alphaAt(x: number, y: number): number {
    return this.inside(x, y) ? this.rgba[(y * this.size + x) * 4 + 3] : 0;
  }

  /** Visit texels within radius r of (cx, cy); fn gets normalised distance. */
  disc(cx: number, cy: number, r: number, fn: (x: number, y: number, d: number) => void): void {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
        if (d <= 1 && this.inside(x, y)) fn(x, y, d);
      }
  }

  /** 1-texel line; fn gets t 0..1 along it. */
  line(x0: number, y0: number, x1: number, y1: number, fn: (x: number, y: number, t: number) => void): void {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      fn(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), t);
    }
  }

  /** Stamp a template: rows of chars, '.' transparent, others mapped by fn. */
  stamp(x0: number, y0: number, art: readonly string[], fn: (x: number, y: number, ch: string) => void): void {
    art.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (row[x] !== "." && row[x] !== " ") fn(x0 + x, y0 + y, row[x]);
    });
  }

  /** Soft 1-texel halo of alpha `a` around every opaque texel. */
  halo(a: number, v = 1): void {
    const s = this.size;
    const src = Float32Array.from(this.rgba);
    for (let y = 0; y < s; y++)
      for (let x = 0; x < s; x++) {
        if (src[(y * s + x) * 4 + 3] > 0.5) continue;
        let near = false;
        for (const [ox, oy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ])
          if (this.inside(x + ox, y + oy) && src[((y + oy) * s + x + ox) * 4 + 3] > 0.5) near = true;
        if (near) this.px(x, y, v, a);
      }
  }
}

export type SpritePainter = (s: SpritePaint) => void;

const sprites: { id: string; painter: SpritePainter }[] = [];

/** Register a sprite (re-registering an id replaces it). Must happen before
 * buildSpriteAtlas() runs. */
export function registerSprite(id: string, painter: SpritePainter): void {
  const k = sprites.findIndex((s) => s.id === id);
  if (k >= 0) sprites[k] = { id, painter };
  else sprites.push({ id, painter });
}

export interface SpriteAtlas {
  texture: DataTexture;
  /** Atlas width = height in texels. */
  size: number;
  rects: Map<string, SpriteRect>;
  cols: number;
}

let atlas: SpriteAtlas | null = null;

/** Paint every registered sprite into one square power-of-two atlas. */
export function buildSpriteAtlas(): SpriteAtlas {
  if (atlas) return atlas;
  const S = SPRITE_SIZE;
  const cols = 8;
  const rows = Math.max(1, Math.ceil(sprites.length / cols));
  let size = S;
  while (size < Math.max(cols, rows) * S) size *= 2;
  const data = new Uint8Array(size * size * 4);
  const rects = new Map<string, SpriteRect>();
  sprites.forEach((sp, k) => {
    const p = new SpritePaint(sp.id);
    sp.painter(p);
    const col = k % cols;
    const row = Math.floor(k / cols);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        // Bottom-up upload: sprite row 0 (top) → highest data row of its cell.
        const dy = size - 1 - (row * S + y);
        const o = (dy * size + col * S + x) * 4;
        const i = (y * S + x) * 4;
        for (let c = 0; c < 4; c++) data[o + c] = Math.max(0, Math.min(255, Math.round(p.rgba[i + c] * 255)));
      }
    rects.set(sp.id, [(col * S) / size, 1 - ((row + 1) * S) / size, ((col + 1) * S) / size, 1 - (row * S) / size]);
  });
  const texture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  atlas = { texture, size, rects, cols };
  return atlas;
}

/** UV rect of a sprite (builds the atlas on first use). Unknown ids fall
 * back to `glow`. */
export function spriteRect(id: string): SpriteRect {
  const a = buildSpriteAtlas();
  return a.rects.get(id) ?? a.rects.get("glow") ?? [0, 0, 1, 1];
}

export function spriteIds(): string[] {
  return sprites.map((s) => s.id);
}

// ─── Built-in sprites ───────────────────────────────────────────────────────

const C = SPRITE_SIZE / 2;

registerSprite("glow", (s) => {
  // Soft round falloff — the one deliberately smooth sprite (light halos).
  s.disc(C, C, 8, (x, y, d) => s.px(x, y, 1, Math.pow(1 - d, 2.2)));
});

registerSprite("spark", (s) => {
  // Four-point glint centred on texel (7,7): hot plus-shaped core, long
  // tapering cross arms, short diagonals.
  const c = 7;
  for (let k = 1; k <= 7; k++) {
    const a = k <= 2 ? 1 : k <= 4 ? 0.7 : 0.35;
    s.px(c + k, c, 1, a);
    s.px(c - k, c, 1, a);
    s.px(c, c + k, 1, a);
    s.px(c, c - k, 1, a);
  }
  for (let k = 1; k <= 2; k++) {
    const a = k === 1 ? 0.6 : 0.3;
    s.px(c + k, c + k, 1, a);
    s.px(c - k, c + k, 1, a);
    s.px(c + k, c - k, 1, a);
    s.px(c - k, c - k, 1, a);
  }
  s.px(c, c, 1, 1);
});

registerSprite("ember", (s) => {
  // A glowing coal fleck: yellow heart, orange body, red rim, pre-coloured.
  const art = ["..rr..", ".roor.", "royyor", "royyor", ".roor.", "..rr.."];
  s.stamp(5, 5, art, (x, y, ch) => s.hex(x, y, ch === "y" ? "#fff2a0" : ch === "o" ? "#ff8a20" : "#c02808", ch === "r" ? 0.85 : 1));
  s.halo(0.3);
});

/** Soft smoke puff built from overlapping soft discs; darker underneath. */
function smoke(s: SpritePaint, puffs: number): void {
  const pts: [number, number, number][] = [];
  for (let k = 0; k < puffs; k++) pts.push([C + s.rng.range(-3.5, 3.5), C + s.rng.range(-3, 3), s.rng.range(3, 5.5)]);
  for (let y = 0; y < SPRITE_SIZE; y++)
    for (let x = 0; x < SPRITE_SIZE; x++) {
      let a = 0;
      for (const [cx, cy, r] of pts) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
        if (d < 1) a = Math.max(a, (1 - d * d) * 0.75);
      }
      if (a <= 0.02) continue;
      // Posterise the density into 4 levels so it stays pixel-art-ish.
      const q = Math.ceil(a * 4) / 4;
      const shade = 0.55 + (1 - (y + 0.5) / SPRITE_SIZE) * 0.35 + (s.rng.next() - 0.5) * 0.08;
      s.px(x, y, shade, q * 0.8);
    }
}

registerSprite("smoke0", (s) => smoke(s, 3));
registerSprite("smoke1", (s) => smoke(s, 4));
registerSprite("smoke2", (s) => smoke(s, 5));

registerSprite("dust", (s) => {
  // A drifting mote: bright 2×2 with a faint plus-shaped halo.
  for (let y = C - 1; y <= C; y++) for (let x = C - 1; x <= C; x++) s.px(x, y, 0.9, 1);
  s.halo(0.35, 0.8);
});

/** Flame tongue frames: a teardrop whose tip sways and splits a little
 * differently per frame; white-yellow core, orange body, red tips. */
function flame(s: SpritePaint, frame: number): void {
  const sway = [0, 1, 0, -1][frame];
  const hgt = [12, 13, 11, 13][frame];
  for (let y = 0; y < SPRITE_SIZE; y++)
    for (let x = 0; x < SPRITE_SIZE; x++) {
      const up = (15.5 - y) / hgt; // 0 at the base, 1 at the tip
      if (up < 0 || up > 1) continue;
      const cx = C + sway * up * up * 2 + Math.sin(up * 6 + frame) * up * 0.8;
      const w = 4.2 * Math.sin(Math.min(1, up * 1.15 + 0.15) * Math.PI) * (1 - up * 0.35);
      const d = Math.abs(x + 0.5 - cx) / Math.max(0.6, w);
      if (d > 1) continue;
      const heat = (1 - d) * (1 - up * 0.8);
      const col = heat > 0.55 ? "#fff6c8" : heat > 0.35 ? "#ffd050" : heat > 0.18 ? "#ff8a1c" : "#d83408";
      s.hex(x, y, col, d > 0.85 && (x + y) & 1 ? 0.6 : 1);
    }
  // A detached lick of flame above the tip on some frames.
  if (frame & 1) {
    s.hex(C + sway * 2, 1, "#d83408", 0.8);
    s.hex(C + sway * 2, 2, "#ff8a1c", 1);
  }
}

for (let f = 0; f < 4; f++) registerSprite(`flame${f}`, (s) => flame(s, f));

registerSprite("spore", (s) => {
  // Round spore with a bright rim and a pale nucleus; glows when tinted.
  s.disc(C, C, 3, (x, y, d) => s.px(x, y, d > 0.7 ? 1 : 0.75, 1));
  s.px(C - 1, C - 1, 1, 1);
  s.halo(0.4);
});

registerSprite("droplet", (s) => {
  // Teardrop: pointed top, round belly, highlight on the upper left.
  for (let y = 3; y < 14; y++) {
    const t = (y - 3) / 10;
    const w = t < 0.55 ? t * 5.2 : Math.sqrt(Math.max(0, 1 - ((t - 0.62) / 0.4) ** 2)) * 3.4;
    for (let x = 0; x < SPRITE_SIZE; x++) {
      const d = Math.abs(x + 0.5 - C) / Math.max(0.5, w);
      if (d <= 1) s.px(x, y, d > 0.75 || y === 13 ? 0.7 : 0.9, 1);
    }
  }
  s.px(C - 2, 9, 1, 1);
  s.px(C - 2, 10, 1, 1);
});

registerSprite("snowflake", (s) => {
  // Six arms with side barbs.
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + Math.PI / 2;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    for (let r = 0; r <= 6; r++) s.px(C - 0.5 + dx * r + 0.5, C - 0.5 + dy * r + 0.5, 1, r < 5 ? 1 : 0.6);
    for (const side of [-1, 1]) {
      const b = a + side * 0.8;
      for (let r = 1; r <= 2; r++) s.px(C + dx * 3.5 + Math.cos(b) * r, C + dy * 3.5 + Math.sin(b) * r, 0.9, 0.9);
    }
  }
});

/** A rune on a 3×3 node lattice: a vertical stave plus 2–3 strokes. */
function runeSprite(s: SpritePaint): void {
  const nodes: [number, number][] = [];
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) nodes.push([4 + i * 4, 2 + j * 6]);
  const spine = s.rng.int(0, 2);
  const strokes: [number, number][] = [[spine, spine + 6]];
  for (let k = 0; k < s.rng.int(2, 3); k++) {
    const a = s.rng.int(0, 8);
    let b = s.rng.int(0, 8);
    if (a === b) b = (a + 4) % 9;
    strokes.push([a, b]);
  }
  for (const [a, b] of strokes) s.line(nodes[a][0], nodes[a][1], nodes[b][0], nodes[b][1], (x, y) => s.px(x, y, 1, 1));
  s.halo(0.35);
}

for (let r = 0; r < 4; r++) registerSprite(`rune${r}`, runeSprite);

registerSprite("star", (s) => {
  // Twinkle: long vertical, shorter horizontal, bright core.
  for (let k = -6; k <= 6; k++) s.px(C - 1, C - 1 + k, 1, Math.abs(k) < 3 ? 1 : 0.55);
  for (let k = -4; k <= 4; k++) s.px(C - 1 + k, C - 1, 1, Math.abs(k) < 2 ? 1 : 0.55);
  s.px(C - 2, C - 2, 1, 0.5);
  s.px(C, C - 2, 1, 0.5);
  s.px(C - 2, C, 1, 0.5);
  s.px(C, C, 1, 0.5);
});

registerSprite("shard", (s) => {
  // Angular glass/ice splinter: lit facet, shadow facet, bright edge.
  const art = ["......1", ".....12", "....122", "...1222", "..12233", ".122333", "1223330", "..3330.", "...30..."];
  s.stamp(4, 3, art, (x, y, ch) => s.px(x, y, ch === "1" ? 1 : ch === "2" ? 0.85 : ch === "3" ? 0.6 : 0.45, 1));
});

registerSprite("blood", (s) => {
  // Splat: irregular body with satellite drops, dark arterial red.
  s.disc(C, C, 3.4, (x, y, d) => s.hex(x, y, d > 0.75 ? "#5a0408" : "#8a0c12", 1));
  for (let k = 0; k < 7; k++) {
    const a = s.rng.range(0, Math.PI * 2);
    const r = s.rng.range(4, 7);
    const x = C + Math.cos(a) * r;
    const y = C + Math.sin(a) * r;
    s.hex(x, y, "#7a0a10", 1);
    if (s.rng.chance(0.5)) s.hex(x + Math.sign(Math.cos(a)), y, "#5a0408", 1);
  }
  s.hex(C - 2, C - 2, "#c83a3a", 1);
});

registerSprite("splinter", (s) => {
  // Wood sliver on a diagonal, pale split face and dark bark side.
  for (let k = 0; k < 10; k++) {
    s.hex(3 + k, 12 - k, k === 0 || k === 9 ? "#6a4424" : "#b8864c", 1);
    s.hex(4 + k, 12 - k, "#5a3a1c", 1);
    if (k > 2 && k < 7) s.hex(3 + k, 11 - k, "#d8a868", 1);
  }
});

registerSprite("ink", (s) => {
  // Ink blot: blue-black body, violet sheen, a thrown tail of droplets.
  s.disc(C, C + 1, 3.2, (x, y, d) => s.hex(x, y, d > 0.7 ? "#0a0a1a" : "#141430", 1));
  s.hex(C - 1, C, "#4a3a7a", 1);
  for (let k = 0; k < 4; k++) s.hex(C + 3 + k, C - 2 - k, "#141430", 1 - k * 0.15);
});

registerSprite("bubble", (s) => {
  // Thin ring, faint fill, a highlight arc upper-left.
  s.disc(C, C, 5.5, (x, y, d) => (d > 0.78 ? s.px(x, y, 0.9, 0.9) : s.px(x, y, 1, 0.12)));
  for (const [x, y] of [
    [5, 5],
    [5, 6],
    [6, 4],
  ])
    s.px(x, y, 1, 1);
});

registerSprite("ring", (s) => {
  // Shockwave ring: one crisp texel wide, a dimmer inner echo.
  s.disc(C, C, 7, (x, y, d) => {
    if (d > 0.86) s.px(x, y, 1, 1);
    else if (d > 0.72 && d < 0.8) s.px(x, y, 1, 0.35);
  });
});

registerSprite("ash", (s) => {
  // Curled grey flake with a darker edge and one glowing speck.
  const art = ["..21...", ".2332..", "233332.", ".23332.", "..222.."];
  s.stamp(5, 6, art, (x, y, ch) => s.px(x, y, ch === "3" ? 0.55 : ch === "2" ? 0.4 : 0.3, 1));
});

registerSprite("leaf", (s) => {
  // Small leaf: pointed oval, midrib, stem; autumn green-brown.
  const art = [".......gG", ".....gGGg", "...gGGGg.", "..gGGmGg.", ".gGGmGGg.", ".gGmGGg..", "gGmGgg...", "gmgg.....", "s........", "s........"];
  s.stamp(3, 3, art, (x, y, ch) => s.hex(x, y, ch === "G" ? "#6a8a2a" : ch === "g" ? "#4a6a1a" : ch === "m" ? "#a0b050" : "#5a3a1a", 1));
});

registerSprite("bone_chip", (s) => {
  // A fragment of bone: knobbed end, broken shaft, ivory shading.
  const art = [".11....", "1332...", "13432..", ".23432.", "..2343.", "...232.", "....2.."];
  s.stamp(4, 4, art, (x, y, ch) => s.hex(x, y, ch === "4" ? "#efe4c6" : ch === "3" ? "#d2c4a2" : ch === "2" ? "#a89878" : "#6e604a", 1));
});

registerSprite("note", (s) => {
  // A sung note (the Choir): eighth note with a flag.
  s.disc(6, 12, 2.2, (x, y) => s.px(x, y, 1, 1));
  for (let y = 3; y <= 12; y++) s.px(8, y, 1, 1);
  for (const [x, y] of [
    [9, 3],
    [10, 4],
    [11, 5],
    [11, 6],
    [10, 7],
  ])
    s.px(x, y, 1, 1);
});

registerSprite("feather", (s) => {
  // Drifting feather: curved shaft with barbs to either side.
  for (let k = 0; k < 11; k++) {
    const x = 4 + k * 0.8;
    const y = 13 - k;
    s.px(x, y, 1, 1);
    if (k > 1 && k < 10) {
      s.px(x - 1, y - 1, 0.8, 1);
      s.px(x - 2, y - 1, 0.7, k > 3 && k < 8 ? 1 : 0.6);
      s.px(x + 1, y + 1, 0.75, 1);
      s.px(x + 2, y + 1, 0.65, k > 3 && k < 8 ? 1 : 0.6);
    }
  }
});

registerSprite("pebble", (s) => {
  // Grit/rubble chunk: faceted grey stone, lit upper-left.
  s.disc(C, C + 1, 3.3, (x, y, d) => s.px(x, y, d > 0.8 ? 0.35 : x + y < C * 2 ? 0.75 : 0.55, 1));
});
