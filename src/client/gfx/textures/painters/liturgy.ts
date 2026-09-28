import {
  bricks,
  cellular,
  clamp01,
  fbm,
  fbmXY,
  field,
  grainNoise,
  isoLines,
  lightField,
  paintTone,
  ramp,
  rampColor,
  roughFrom,
  speckle,
  top,
  type Ramp,
} from "../brushes";
import { registerMaterial } from "../library";
import { hex, type Paint } from "../paint";
import { ICE, paintIce, paintMasonry } from "./common";

/** Stratum 6 — the Frozen Liturgy: a mass that swore never to end its
 * prayer; time froze to keep the promise. Glacial ice with shapes inside,
 * hoarfrost on stone, and stained glass that still burns with light. */

const FROST = ramp("#8aa4b4", "#b0c8d4", "#d4e6ee", "#eef8fc", "#ffffff");
const FROST_STONE = ramp("#141820", "#242a34", "#363e4a", "#4a5462", "#606c7a", "#7a8694");

/** Hoarfrost: feathery white crystals growing on raised edges and tops
 * of blocks (they catch the moisture), glittering, rough. */
function hoarfrost(p: Paint, amount: number, salt = 0): void {
  const s = p.size;
  const n = fbm(p, 8, 2, 1201 + salt);
  const g = grainNoise(p, 1202 + salt);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      // Upward-facing edges: higher than the texel above.
      const up = p.height[i] - p.height[p.idx(x, y - 1)];
      const v = up * 3 + n[i] * 0.6 + g[i] * 0.4;
      if (v > 1.15 - amount) {
        p.setColor(i, rampColor(FROST, clamp01((v - (1.15 - amount)) * 2 + g[i] * 0.3), x, y, 0.6));
        p.rough[i] = 0.75;
        p.height[i] += 0.03;
      }
    }
}

/** Icicles hanging from a row: tapering white/blue spikes. */
function icicles(p: Paint, y0: number, count: number, maxLen: number): void {
  for (let k = 0; k < count; k++) {
    const x = p.rng.int(0, p.size - 1);
    const len = p.rng.int(Math.max(2, maxLen >> 1), maxLen);
    const w = len > 5 ? 2 : 1;
    for (let t = 0; t < len; t++)
      for (let dx = 0; dx < (t < len * 0.6 ? w : 1); dx++) {
        const i = p.idx(x + dx, y0 + t);
        p.setColor(i, dx === 0 ? FROST[3] : ICE[3]);
        p.height[i] = 0.75;
        p.rough[i] = 0.08;
      }
  }
}

registerMaterial("frost.ice_wall", (p) => {
  // Glacial ice with things inside: dark shapes of kneeling pilgrims deep
  // in the blue, softened by the depth.
  paintIce(p, { cracks: 4, cloud: 0.4, salt: 5 });
  const shape = field(p);
  for (let k = 0; k < 2; k++) {
    const cx = k * 32 + p.rng.range(8, 24);
    const cy = p.rng.range(16, 48);
    // Head, hunched back, folded knees — a praying figure, frozen.
    const parts: [number, number, number][] = [
      [cx, cy - 9, 3],
      [cx + 1, cy - 2, 6],
      [cx + 3, cy + 6, 5],
      [cx - 3, cy + 9, 4],
    ];
    for (const [x, y, r] of parts) p.disc(x, y, r, (i, d) => (shape[i] = Math.max(shape[i], 1 - d * d)));
  }
  for (let i = 0; i < shape.length; i++) if (shape[i] > 0) p.mix(i, hex("#0c1a28"), shape[i] * 0.55);
  for (let i = 0; i < shape.length; i++) p.rough[i] = 0.05;
});

registerMaterial("frost.snow_floor", (p) => {
  // Packed snow: wind ripples, a trail of footprints, glittering crystals
  // (tiny glossy texels that catch the torch).
  const s = p.size;
  const n = fbm(p, 4, 3, 1211);
  const w = fbmXY(p, 2, 3, 2, 1212);
  const ph = field(p);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      ph[i] = (y / s) * 6 + (w[i] - 0.5) * 2;
    }
  const ripple = isoLines(p, ph, 1.5);
  for (let i = 0; i < n.length; i++) p.height[i] = 0.5 + (n[i] - 0.5) * 0.12 - ripple[i] * 0.05;
  for (let k = 0; k < 4; k++) {
    const x = 20 + k * 3 + (k & 1) * 5;
    const y = k * 16 + 4;
    p.disc(x, y, 2.2, (i, d) => (p.height[i] -= (1 - d) * 0.12));
    p.disc(x, y + 4, 1.6, (i, d) => (p.height[i] -= (1 - d) * 0.12));
  }
  const light = lightField(p, 1.5);
  const tone = field(p);
  for (let i = 0; i < n.length; i++) tone[i] = 0.62 + (n[i] - 0.5) * 0.14 + light[i];
  paintTone(p, ramp("#5a6e80", "#8098ac", "#a6bccc", "#c8dae4", "#e2eef4", "#f6fbfd"), tone, 0.35);
  roughFrom(p, 0.72, n, 0.05);
  const g = grainNoise(p, 1213);
  for (let i = 0; i < n.length; i++)
    if (g[i] > 0.985) {
      p.setColor(i, [1, 1, 1]);
      p.rough[i] = 0.05;
    }
});

registerMaterial("frost.frozen_stone", (p) => {
  // Cathedral stone under a skin of frost: hoarfrost on every upper edge,
  // a glassy glaze of ice in patches, icicles under the joints.
  const L = bricks(p, { rows: 6, minW: 14, maxW: 26, warp: 0.5 });
  paintMasonry(p, L, { ramps: [FROST_STONE], mortar: ramp("#0c0e12", "#1a1e24", "#2a3038"), chip: 0.3, pits: 10, tint: 0.12 });
  hoarfrost(p, 0.35);
  const glaze = fbm(p, 3, 3, 1221);
  for (let i = 0; i < glaze.length; i++)
    if (glaze[i] > 0.62) {
      p.mix(i, ICE[4], 0.25);
      p.rough[i] = 0.08;
    }
  for (const r of L.rects) if (p.rng.chance(0.5)) icicles(p, r.y + r.h, 2, 5);
  speckle(p, { density: 0.01, color: [1, 1, 1], amount: 0.9 });
});

/** Stained-glass palette: each piece is a flat emissive colour with a
 * little density variation (thicker glass is darker). */
const GLASS: Ramp[] = [
  ramp("#0a1440", "#16287a", "#2a44b0", "#4a6ad8"),
  ramp("#400808", "#781410", "#b02418", "#d84830"),
  ramp("#3a2a04", "#7a5a0a", "#b88a18", "#e8c040"),
  ramp("#082a14", "#145028", "#26783c", "#48a058"),
  ramp("#2a0a3a", "#4a1868", "#6a2a98", "#9048c0"),
];

registerMaterial(
  "frost.stained_glass",
  (p) => {
    // A lancet of leaded glass: a robed saint with a gold halo and a pale,
    // blank oval where the face should be. Background pieces are Voronoi
    // shards; every piece glows, the lead came does not.
    const s = p.size;
    const c = cellular(p, 5, 1231, 0.9);
    const n = fbm(p, 8, 2, 1232);
    const cx = s / 2;
    const region = new Int32Array(s * s);
    for (let y = 0; y < s; y++)
      for (let x = 0; x < s; x++) {
        const i = y * s + x;
        const dx = x + 0.5 - cx;
        const hr = Math.hypot(dx, y + 0.5 - 16);
        let r = 0;
        if (hr < 6) r = 1;
        else if (hr < 9) r = 2;
        else if (y > 22 && y < 62 && Math.abs(dx) < 6 + (y - 22) * 0.22) r = 3 + (Math.floor((dx + 20) / 5) & 1);
        region[i] = r;
      }
    const pieceRamp = (i: number): Ramp => {
      const r = region[i];
      if (r === 1) return ramp("#8a8078", "#b8aea2", "#dcd4c8", "#f0ebe2");
      if (r === 2) return GLASS[2];
      if (r >= 3) return r === 3 ? GLASS[1] : GLASS[4];
      return GLASS[c.id[i] % 3 === 0 ? 3 : 0];
    };
    for (let y = 0; y < s; y++)
      for (let x = 0; x < s; x++) {
        const i = y * s + x;
        const rg = region[i];
        // Lead where pieces meet: region borders, shard borders, robe folds.
        const border =
          rg !== region[p.idx(x + 1, y)] ||
          rg !== region[p.idx(x, y + 1)] ||
          (rg === 0 && c.f2[i] - c.f1[i] < 1) ||
          (rg >= 3 && y % 11 === 0);
        if (border) {
          p.setColor(i, hex("#14151a"));
          p.height[i] = 0.75;
          p.metal[i] = 0.6;
          p.rough[i] = 0.5;
          p.emit[i] = 0;
          continue;
        }
        const R = pieceRamp(i);
        p.setColor(i, rampColor(R, 0.55 + (n[i] - 0.5) * 0.5, x, y, 0.5));
        p.height[i] = 0.5 + (n[i] - 0.5) * 0.04;
        p.rough[i] = 0.1;
        p.emit[i] = rg === 1 ? 0.55 : 0.9;
      }
    // Frame of the lancet: stone mullions at the texture edges.
    for (let y = 0; y < s; y++)
      for (const x of [0, 1, 62, 63]) p.set(x, y, { c: FROST_STONE[x === 1 || x === 63 ? 2 : 4], h: 0.9, e: 0, r: 0.8, m: 0 });
    for (let i = 0; i < n.length; i++) if (p.emit[i] > 0 && n[i] > 0.8) p.mix(i, top(FROST), 0.5);
  },
  { glow: 2.5, worldSize: 2 },
);

registerMaterial("frost.trim", (p) => {
  // Frosted cornice: a stone moulding whose lower lip grows icicles.
  const s = p.size;
  const n = fbm(p, 8, 3, 1241);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      let h: number;
      if (y < 4) h = 0.85;
      else if (y < 12) h = 0.8 - ((y - 4) / 8) * 0.25;
      else if (y < 16) h = 0.62 + Math.sin(((y - 12) / 4) * Math.PI) * 0.1;
      else if (y < 44) h = 0.6 - (x % 16 === 15 ? 0.25 : 0);
      else if (y < 50) h = 0.8;
      else h = 0.3;
      p.height[i] = h + (n[i] - 0.5) * 0.04;
    }
  const light = lightField(p, 1.6);
  const tone = field(p);
  for (let i = 0; i < n.length; i++) tone[i] = (p.height[i] < 0.35 ? 0.1 : 0.5) + light[i] + (n[i] - 0.5) * 0.2;
  paintTone(p, FROST_STONE, tone, 0.3);
  roughFrom(p, 0.8, n, 0.05);
  hoarfrost(p, 0.22, 3);
  icicles(p, 50, 9, 13);
});
