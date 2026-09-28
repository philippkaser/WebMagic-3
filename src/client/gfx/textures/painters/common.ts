import {
  blur,
  cellular,
  chipEdges,
  clamp01,
  cobbles,
  cracks,
  dents,
  drips,
  edgeWear,
  fbm,
  fbmXY,
  field,
  grainNoise,
  grime,
  hexes,
  isoLines,
  lightField,
  moss,
  nail,
  paintTone,
  planks,
  puddles,
  ramp,
  rampColor,
  relief,
  rivet,
  roughFrom,
  rune,
  scaleLayout,
  slabs,
  smooth,
  speckle,
  stamp,
  veins,
  weave,
  woodGrain,
  wrapDelta,
  type Field,
  type Layout,
  type Ramp,
} from "../brushes";
import { registerMaterial } from "../library";
import { hex, type Paint, type RGB } from "../paint";

/** Generic materials for props, creatures and items. The exported helpers
 * (boards, plates, marble, cobbles, book rows…) are the shared craft
 * vocabulary biome painters build on, so a crypt door and a village door
 * are made the same way. */

// ─── Wood ───────────────────────────────────────────────────────────────────

export const WOOD_MID = ramp("#1f130b", "#3a2415", "#56351e", "#724728", "#8f5b32", "#ad7440");
export const WOOD_RED = ramp("#221009", "#3f1f13", "#5c2e1b", "#7a4026", "#975532", "#b36b3d");
export const WOOD_DARK = ramp("#0f0907", "#1f130d", "#2f1d14", "#43291b", "#583724", "#71492f");
export const WOOD_GREY = ramp("#1a1816", "#302b26", "#48413a", "#625950", "#7e7466", "#9b8f7e");
export const WOOD_SILVER = ramp("#1d1916", "#352d27", "#50443a", "#6c5d4f", "#8a7866", "#a8957f");
export const WOOD_PALE = ramp("#2a1d10", "#4d371f", "#6e5230", "#8f6d42", "#ae8a58", "#c9a674");
/** Metal albedo doubles as specular colour (metal=1), so metal ramps sit
 * brighter than their "look": iron that reads dark grey under torchlight. */
export const IRON = ramp("#17181b", "#2c2f34", "#44474e", "#5d6169", "#7a7f88", "#a4aab2");
export const RUST = ramp("#1e0d07", "#3b1a0c", "#5e2c12", "#7f4219", "#a05c25", "#bd7a3a");

export interface BoardOpts {
  ramps: Ramp[];
  boards: number;
  minLen: number;
  maxLen: number;
  /** Chance a board runs the full texture length (no butt joint). */
  full?: number;
  vertical?: boolean;
  rings?: number;
  knots?: number;
  /** "ends": nails at butt joints; "studs": also a nail line every 32 px. */
  nails?: "ends" | "studs" | "none";
  /** Grain band contrast (0..1) and latewood line strength. */
  grain?: number;
  lines?: number;
  light?: number;
  rough?: number;
  /** Weathering 0..1: eroded grain, splits, grey fading. */
  weather?: number;
  gap?: number;
  /** Tone of the gap between boards (0 = black void, ~0.15 tight fit). */
  gapTone?: number;
}

/** Plank boards: flowing grain with knots, per-board tint, butt joints and
 * nail heads. Returns the layout for further dressing. */
export function paintBoards(p: Paint, o: BoardOpts): Layout {
  const L = planks(p, { boards: o.boards, minLen: o.minLen, maxLen: o.maxLen, vertical: o.vertical, gap: o.gap, full: o.full });
  relief(p, L, { joint: 0.15, face: 0.6, vary: 0.04, bevel: 1, curve: 1 });
  const g = woodGrain(p, {
    rings: o.rings ?? 12,
    warp: 3,
    knots: o.knots ?? 2,
    vertical: o.vertical,
    phase: (i) => (L.id[i] >= 0 ? L.rnd(L.id[i], 4) * 64 : 0),
  });
  const weather = o.weather ?? 0;
  for (let i = 0; i < p.height.length; i++) {
    if (L.id[i] < 0) continue;
    // Weathered wood: soft earlywood erodes, latewood lines stand in relief.
    p.height[i] += -g.line[i] * (0.03 + weather * 0.08) + (g.tone[i] - 0.5) * 0.04 - g.knot[i] * 0.06;
  }
  const light = lightField(p, o.light ?? 0.8);
  const tone = field(p);
  const grain = o.grain ?? 0.9;
  const lines = o.lines ?? 0.26;
  for (let i = 0; i < tone.length; i++) {
    const c = L.id[i];
    if (c < 0) {
      tone[i] = o.gapTone ?? 0.04;
      continue;
    }
    const k = g.knot[i];
    tone[i] =
      0.52 + (g.tone[i] - 0.5) * grain + (L.rnd(c, 1) - 0.5) * 0.22 + light[i] - g.line[i] * lines - (k > 0.15 ? 0.3 + k * 0.3 : 0);
  }
  paintTone(p, (i) => o.ramps[L.id[i] >= 0 ? Math.floor(L.rnd(L.id[i], 2) * o.ramps.length) : 0], tone, 0.35);
  if (weather > 0) {
    cracks(p, {
      count: Math.round(weather * 5),
      length: [8, 20],
      angle: o.vertical ? Math.PI / 2 : 0,
      wander: 0.08,
      branch: 0,
      depth: 0.15,
      lip: 0.1,
      mask: (i) => L.id[i] >= 0 && L.edge[i] > 1,
    });
  }
  roughFrom(p, o.rough ?? 0.78, g.tone, 0.06);
  const mode = o.nails ?? "ends";
  if (mode !== "none") {
    const put = (x: number, y: number) => nail(p, x, y, { dark: [0.07, 0.06, 0.05], light: [0.44, 0.42, 0.4] });
    for (const r of L.rects) {
      const along = o.vertical ? r.h : r.w;
      const across = o.vertical ? r.w : r.h;
      const spots = across >= 8 ? [2, across - 4] : [Math.floor(across / 2) - 1];
      const stations: number[] = [];
      if (along < p.size) stations.push(1, along - 4);
      if (mode === "studs") {
        const start = o.vertical ? r.y : r.x;
        for (let s = 0; s < along; s++) if ((start + s) % 32 === 15 && s > 3 && s < along - 5) stations.push(s);
      }
      for (const a of spots)
        for (const st of stations) put(o.vertical ? r.x + a : r.x + st, o.vertical ? r.y + st : r.y + a);
    }
  }
  return L;
}

registerMaterial("wood.plank", (p) => {
  paintBoards(p, { ramps: [WOOD_MID, WOOD_RED], boards: 6, minLen: 24, maxLen: 44, full: 0.5, nails: "studs", gapTone: 0.05 });
});

registerMaterial("wood.dark", (p) => {
  paintBoards(p, { ramps: [WOOD_DARK], boards: 7, minLen: 28, maxLen: 40, full: 0.6, rings: 18, grain: 0.7, rough: 0.55, nails: "ends", gapTone: 0.02 });
});

registerMaterial("wood.old", (p) => {
  const L = paintBoards(p, {
    ramps: [WOOD_GREY, WOOD_SILVER],
    boards: 6,
    minLen: 30,
    maxLen: 40,
    full: 0.65,
    rings: 12,
    grain: 1,
    lines: 0.35,
    weather: 1,
    rough: 0.92,
    nails: "studs",
  });
  // Rust bleeding from the nails, lichen in the gaps.
  drips(p, { count: 6, color: hex("#4a2a18"), strength: 0.35, minLen: 3, maxLen: 8 });
  moss(p, { ramp: ramp("#2a3018", "#3d4622", "#56602e"), coverage: 0.05, crevice: 2, freq: 8, mask: (i) => L.edge[i] < 2 });
});

registerMaterial("wood.barrel", (p) => {
  const L = paintBoards(p, {
    ramps: [WOOD_MID, WOOD_RED],
    boards: 8,
    minLen: 64,
    maxLen: 64,
    vertical: true,
    nails: "none",
    rings: 7,
    knots: 1,
    gapTone: 0.12,
  });
  // Staves are convex: darken toward each stave's long edges.
  for (let i = 0; i < L.id.length; i++) if (L.id[i] >= 0 && L.edge[i] < 1.2) p.shade(i, 0.8);
  ironBand(p, 6, 5);
  ironBand(p, 38, 5);
});

/** Horizontal wrought-iron band with rivets (barrel hoops, door straps). */
export function ironBand(p: Paint, y0: number, h: number, rivetEvery = 8, rust = 0.3, r: Ramp = IRON): void {
  const s = p.size;
  const n = fbm(p, 16, 2, 777 + y0);
  const rn = fbm(p, 8, 2, 778 + y0);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < s; x++) {
      const i = p.idx(x, y0 + y);
      const top = y === 0;
      const bot = y === h - 1;
      const rusty = rn[i] > 1 - rust;
      let t = 0.6 + (top ? 0.3 : 0) - (bot ? 0.35 : 0) + (n[i] - 0.5) * 0.35;
      if (rusty) t -= 0.1;
      p.setColor(i, rampColor(rusty ? RUST : r, t, x, y, 0.5));
      p.height[i] = 0.82 - (top || bot ? 0.06 : 0);
      p.metal[i] = rusty ? 0.1 : 1;
      p.rough[i] = rusty ? 0.85 : 0.45;
    }
  // Shadow cast by the band onto what lies below it.
  for (let x = 0; x < s; x++) p.shade(p.idx(x, y0 + h), 0.55);
  for (let x = 3; x < s; x += rivetEvery) rivet(p, x + 0.5, y0 + h / 2, 1.2, { ramp: r, rough: 0.4, h: 0.1 });
}

registerMaterial("wood.beam", (p) => {
  // One massive hewn timber: coarse grain, adze scallops, long checks.
  const g = woodGrain(p, { rings: 8, warp: 6, knots: 3 });
  const s = p.size;
  const adzeN = fbmXY(p, 3, 2, 2, 9);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      const sc = Math.sin(((x + adzeN[i] * 10) / 7) * Math.PI * 2) * 0.5 + 0.5;
      p.height[i] = 0.55 + sc * 0.06 - g.line[i] * 0.05 - g.knot[i] * 0.08 + (adzeN[i] - 0.5) * 0.1;
    }
  const ck = cracks(p, { count: 3, length: [22, 48], angle: 0, wander: 0.05, branch: 0, depth: 0.3, lip: 0.15 });
  const light = lightField(p, 1.2);
  const tone = field(p);
  for (let i = 0; i < tone.length; i++)
    tone[i] = 0.5 + (g.tone[i] - 0.5) * 0.8 + light[i] - g.line[i] * 0.25 - (g.knot[i] > 0.15 ? 0.35 + g.knot[i] * 0.3 : 0);
  paintTone(p, WOOD_MID, tone, 0.35);
  for (let i = 0; i < tone.length; i++) if (ck[i]) p.setColor(i, WOOD_MID[0]);
  roughFrom(p, 0.82, adzeN, 0.06);
  for (const [x, y] of [
    [9, 20],
    [41, 44],
  ])
    nail(p, x, y, { big: true });
});

// ─── Metal ──────────────────────────────────────────────────────────────────

export const BRONZE = ramp("#1d1209", "#3f2812", "#65421d", "#8c602c", "#b3833f", "#d6aa62");
export const PATINA = ramp("#1b2a24", "#2d4a3c", "#3f6b55", "#5a8f72", "#7fb293");
export const GOLD = ramp("#3a2106", "#6b420c", "#9c6a17", "#c99425", "#e8bd45", "#fbe38a");
export const BRASS = ramp("#33240a", "#5e4616", "#8c6c22", "#b89232", "#dab84c", "#f2da84");

export interface PlateOpts {
  ramp: Ramp;
  min: number;
  max: number;
  /** Rivet spacing along plate edges (0 = none). */
  rivets?: number;
  rough?: number;
  metal?: number;
  brushed?: boolean;
  dents?: number;
  wear?: number;
  light?: number;
}

/** Riveted metal plates: panels with bevelled seams, rivets along the
 * edges, hammer dents, brushed or mottled faces and bright worn edges. */
export function paintPlates(p: Paint, o: PlateOpts): Layout {
  const L = slabs(p, { min: o.min, max: o.max, gap: 1 });
  relief(p, L, { joint: 0.2, face: 0.6, vary: 0.03, bevel: 1.2, curve: 1 });
  if (o.dents) dents(p, { count: o.dents, r: [1.5, 3.5], depth: 0.05 });
  const br = o.brushed ? fbmXY(p, 2, 32, 2, 3) : fbm(p, 16, 2, 3);
  const n = fbm(p, 3, 3, 4);
  const light = lightField(p, o.light ?? 1.2);
  const tone = field(p);
  for (let i = 0; i < tone.length; i++) {
    const c = L.id[i];
    // Plates are lighter toward their upper-left (a broad baked sheen), with
    // only fine mottling — large noise blotches read as camouflage.
    const lx = L.rects[c]?.w ? L.lx[i] / L.rects[c].w : 0.5;
    const ly = L.rects[c]?.h ? L.ly[i] / L.rects[c].h : 0.5;
    const sheen = 0.1 - (lx + ly) * 0.1;
    tone[i] = c < 0 ? 0.02 : 0.5 + sheen + (br[i] - 0.5) * 0.2 + (n[i] - 0.5) * 0.12 + (L.rnd(c) - 0.5) * 0.1 + light[i];
  }
  paintTone(p, o.ramp, tone, 0.25);
  const rough = o.rough ?? 0.45;
  for (let i = 0; i < tone.length; i++) {
    p.metal[i] = L.id[i] < 0 ? 0.2 : (o.metal ?? 1);
    p.rough[i] = L.id[i] < 0 ? 0.9 : clamp01(rough + (n[i] - 0.5) * 0.25 + (br[i] - 0.5) * 0.1);
  }
  if ((o.wear ?? 0.4) > 0) edgeWear(p, L, { color: o.ramp[o.ramp.length - 1], amount: o.wear ?? 0.4, width: 1, rough: rough * 0.6 });
  const every = o.rivets ?? 0;
  if (every > 0) {
    for (const r of L.rects) {
      const pts: [number, number][] = [];
      for (let x = 3; x < r.w - 4; x += every) pts.push([r.x + x + 0.5, r.y + 2.5], [r.x + x + 0.5, r.y + r.h - 3.5]);
      for (let y = 3 + every; y < r.h - 4 - every / 2; y += every) pts.push([r.x + 2.5, r.y + y + 0.5], [r.x + r.w - 3.5, r.y + y + 0.5]);
      for (const [x, y] of pts) rivet(p, x, y, 1.2, { ramp: o.ramp, rough: rough * 0.8, metal: o.metal ?? 1, h: 0.12 });
    }
  }
  return L;
}

registerMaterial("metal.iron", (p) => {
  paintPlates(p, { ramp: IRON, min: 30, max: 64, rivets: 8, rough: 0.5, dents: 8, wear: 0.35 });
});

registerMaterial("metal.rust", (p) => {
  // Corroded plate: rust blooms from the seams and rivets and weeps down
  // in streaks; what bare iron is left is dull. Rust is matte non-metal.
  const L = paintPlates(p, { ramp: IRON, min: 30, max: 64, rivets: 8, rough: 0.6, dents: 10, wear: 0.15, metal: 0.8 });
  const s = p.size;
  const n = fbm(p, 6, 3, 21);
  const streak = fbmXY(p, 12, 2, 2, 23);
  const g = grainNoise(p, 22);
  const score = field(p);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      const seam = L.edge[i] < 5 ? (5 - L.edge[i]) * 0.09 : 0;
      score[i] = n[i] * 0.55 + seam + (streak[i] - 0.5) * 0.5 + g[i] * 0.12;
    }
  const tone = field(p, -1);
  for (let i = 0; i < tone.length; i++) {
    const r = score[i] - 0.45;
    if (r <= 0) continue;
    p.metal[i] = 0;
    p.rough[i] = 0.92;
    p.height[i] -= Math.min(0.1, r * 0.2) + g[i] * 0.02;
    tone[i] = r;
  }
  const light = lightField(p, 1);
  for (let i = 0; i < tone.length; i++)
    if (tone[i] >= 0) tone[i] = L.id[i] < 0 ? 0.1 : clamp01(0.35 + tone[i] * 0.6 + light[i] + (g[i] - 0.5) * 0.35);
  paintTone(p, RUST, tone, 0.6, (i) => tone[i] >= 0);
  for (const r of L.rects)
    for (let x = 3; x < r.w - 4; x += 8)
      if (p.rng.chance(0.5)) drips(p, { count: 1, color: RUST[2], strength: 0.45, minLen: 5, maxLen: 14, start: () => r.y + 4 });
});

registerMaterial("metal.bronze", (p) => {
  // Cast bronze: polished sheen on the high spots, verdigris crusting the
  // hollows and running down in streaks.
  paintSheenMetal(p, BRONZE, { rough: 0.32, facets: 6, bands: 1, salt: 30 });
  dents(p, { count: 16, r: [2, 4], depth: 0.05 });
  const s = p.size;
  const pat = fbm(p, 5, 3, 31);
  const run = fbmXY(p, 10, 2, 2, 32);
  const low = blur(p, p.height, 2);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      const v = pat[i] * 0.55 + (run[i] - 0.5) * 0.6 + (low[i] - p.height[i]) * 10;
      if (v > 0.44) {
        const t = clamp01((v - 0.44) * 3);
        p.setColor(i, rampColor(PATINA, 0.25 + t * 0.7, x, y, 0.6));
        p.metal[i] = 0;
        p.rough[i] = 0.85;
        p.height[i] += 0.02;
      }
    }
});

registerMaterial("metal.gold", (p) => {
  // Burnished gold: broad soft reflections, a few scratches, shallow
  // hammer facets that make the normal map sparkle.
  paintSheenMetal(p, GOLD, { rough: 0.26, facets: 8 });
});

/** Polished metal in the pixel-art idiom: diagonal bands of reflected
 * light (a mirror of the room) over shallow hammer facets, plus fine
 * scratches. Fully metallic. */
export function paintSheenMetal(p: Paint, r: Ramp, o: { rough: number; facets?: number; bands?: number; salt?: number }): void {
  const s = p.size;
  const salt = o.salt ?? 0;
  const c = cellular(p, o.facets ?? 8, 41 + salt, 0.9);
  const n = fbm(p, 2, 3, 42 + salt);
  for (let i = 0; i < n.length; i++) p.height[i] = 0.5 + (1 - clamp01(c.f1[i] / 6)) * 0.05;
  const light = lightField(p, 2.2);
  const tone = field(p);
  const k = o.bands ?? 2;
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      const band = Math.sin(((x + y) / s) * k * Math.PI * 2 + n[i] * 3);
      tone[i] = 0.55 + band * 0.2 + (band > 0.85 ? 0.15 : 0) + light[i];
    }
  paintTone(p, r, tone, 0.3);
  cracks(p, { count: 6, length: [3, 8], depth: 0.01, color: r[r.length - 1], lip: 0, branch: 0, wander: 0.05, angle: -0.6 });
  roughFrom(p, o.rough, n, 0.05);
  p.metal.fill(1);
}

registerMaterial("metal.brass", (p) => {
  paintPlates(p, { ramp: BRASS, min: 30, max: 64, rivets: 8, rough: 0.3, brushed: true, dents: 3, wear: 0.3 });
  const n = fbm(p, 5, 3, 51);
  // Tarnish: dull brown bloom in patches.
  for (let i = 0; i < n.length; i++)
    if (n[i] > 0.66) {
      p.mix(i, hex("#3b2e14"), Math.min(0.6, (n[i] - 0.66) * 2));
      p.rough[i] = Math.max(p.rough[i], 0.5);
    }
});

registerMaterial(
  "metal.chain",
  (p) => {
    // Four hanging chains: face-on oval links alternate with edge-on ones.
    p.alpha.fill(0);
    p.fill(IRON[1], 0.3, 0.5, 1);
    for (let col = 0; col < 4; col++) {
      const cx = col * 16 + 8;
      const off = col & 1 ? 8 : 0;
      for (let k = 0; k < 4; k++) {
        const cy = k * 16 + off;
        // Face-on link: an oval ring.
        for (let y = -7; y <= 7; y++)
          for (let x = -5; x <= 5; x++) {
            const d = Math.sqrt((x / 5) ** 2 + (y / 7.5) ** 2);
            if (d > 1 || d < 0.52) continue;
            const i = p.idx(cx + x, cy + y);
            const ring = (d - 0.52) / 0.48;
            const bulge = 1 - Math.abs(ring - 0.5) * 2;
            p.alpha[i] = 1;
            p.height[i] = 0.4 + bulge * 0.5;
            p.setColor(i, rampColor(IRON, 0.35 + bulge * 0.4 - (x + y) * 0.03, cx + x, cy + y, 0.4));
            p.metal[i] = 1;
            p.rough[i] = 0.42;
          }
        // Edge-on link between them: a bar with a bright spine.
        for (let y = 5; y <= 11; y++)
          for (let x = -1; x <= 1; x++) {
            const i = p.idx(cx + x, cy + y);
            p.alpha[i] = 1;
            p.height[i] = 0.7 - Math.abs(x) * 0.2;
            p.setColor(i, IRON[x === -1 ? 6 : x === 0 ? 5 : 2]);
            p.metal[i] = 1;
            p.rough[i] = 0.4;
          }
      }
    }
  },
  { cutout: true, worldSize: 1 },
);

// ─── Stone ──────────────────────────────────────────────────────────────────

export const STONE_GREY = ramp("#131318", "#27272e", "#3d3d45", "#56565d", "#727178", "#918f95");
export const STONE_WARM = ramp("#1a1612", "#302a23", "#4a4137", "#655a4c", "#827563", "#a0927c");
export const STONE_BLUE = ramp("#10131a", "#1f2530", "#323a47", "#48525f", "#626c78", "#838b95");
export const MARBLE = ramp("#8a8a92", "#a9a8ae", "#c4c2c4", "#d9d5d2", "#e9e4de", "#f6f2ec");

/** Quarry-faced stone surface: flat chisel facets tilted at random, pits
 * and a few cracks. Writes height and tone, returns the tone field. */
export function hewnStone(p: Paint, facets = 7, salt = 0): Field {
  const s = p.size;
  const c = cellular(p, facets, 61 + salt, 1);
  const n = fbm(p, 8, 4, 62 + salt);
  for (let i = 0; i < n.length; i++) {
    const r = c.id[i];
    const sx = (((r * 13) % 7) / 7 - 0.5) * 0.05;
    const sy = (((r * 29) % 5) / 5 - 0.5) * 0.05;
    const dx = wrapDelta(i % s, c.px[r], s);
    const dy = wrapDelta((i / s) | 0, c.py[r], s);
    p.height[i] = 0.5 + sx * dx + sy * dy + (n[i] - 0.5) * 0.18 - (c.f2[i] - c.f1[i] < 1.2 ? 0.06 : 0);
  }
  dents(p, { count: 14, r: [0.8, 1.8], depth: 0.08 });
  const light = lightField(p, 1.5);
  const tone = field(p);
  for (let i = 0; i < n.length; i++) tone[i] = 0.5 + (n[i] - 0.5) * 0.45 + light[i];
  return tone;
}

registerMaterial("stone.rough", (p) => {
  const tone = hewnStone(p);
  paintTone(p, STONE_WARM, tone, 0.4);
  cracks(p, { count: 2, length: [10, 22], depth: 0.2 });
  roughFrom(p, 0.9, tone, 0.05);
});

registerMaterial("stone.smooth", (p) => {
  // Dressed stone: fine granular speckle over very soft mottling.
  const n = fbm(p, 3, 3, 71);
  const g = grainNoise(p, 72);
  for (let i = 0; i < n.length; i++) p.height[i] = 0.5 + (n[i] - 0.5) * 0.05 + (g[i] - 0.5) * 0.03;
  const light = lightField(p, 1);
  const tone = field(p);
  for (let i = 0; i < n.length; i++) tone[i] = 0.5 + (n[i] - 0.5) * 0.16 + light[i] + (g[i] > 0.88 ? 0.2 : g[i] < 0.1 ? -0.2 : 0);
  paintTone(p, STONE_GREY, tone, 0.1);
  cracks(p, { count: 1, length: [8, 16], depth: 0.12, lip: 0.15 });
  roughFrom(p, 0.62, n, 0.08);
});

/** Polished marble: soft cloudy base with thin, continuous, forking
 * veins. Returns the vein mask (1 on vein). */
export function paintMarble(p: Paint, r: Ramp, veinCol: Ramp, o: { salt?: number; veins?: number; angle?: number } = {}): Field {
  const s = p.size;
  const salt = o.salt ?? 0;
  const base = fbm(p, 2, 3, 81 + salt);
  const turb = fbm(p, 2, 3, 82 + salt, 0.45);
  const turb2 = fbm(p, 3, 3, 83 + salt, 0.5);
  const ph1 = field(p);
  const ph2 = field(p);
  const fade = fbm(p, 3, 2, 84 + salt);
  const k = o.veins ?? 2;
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      // Veins are iso-lines of a diagonal gradient bent by turbulence; the
      // gradient must dominate or the lines close into contour loops.
      ph1[i] = ((x + y) / s) * k + (turb[i] - 0.5) * 1.3;
      ph2[i] = ((x - 2 * y) / s) * (k + 1) + (turb2[i] - 0.5) * 1.6;
    }
  const main = isoLines(p, ph1, 1.3);
  const thin = isoLines(p, ph2, 0.8);
  const vein = field(p);
  for (let i = 0; i < vein.length; i++) vein[i] = Math.max(main[i] * smooth(0.2, 0.45, fade[i]), thin[i] * (fade[i] < 0.4 ? 0.7 : 0));
  // A soft grey halo along the main veins, like mineral bleeding.
  const halo = blur(p, main, 2);
  const tone = field(p);
  for (let i = 0; i < tone.length; i++) tone[i] = 0.66 + (base[i] - 0.5) * 0.35 - halo[i] * 0.5;
  paintTone(p, r, tone, 0.35);
  for (let i = 0; i < tone.length; i++)
    if (vein[i] > 0.4) p.setColor(i, veinCol[Math.min(veinCol.length - 1, Math.floor((1 - vein[i]) * 1.7 * veinCol.length))]);
  return vein;
}

registerMaterial("stone.marble", (p) => {
  const vein = paintMarble(p, MARBLE, ramp("#4a4c56", "#6a6c76", "#8e9098"));
  for (let i = 0; i < vein.length; i++) {
    p.height[i] = 0.5 - vein[i] * 0.02;
    p.rough[i] = 0.14 + vein[i] * 0.12;
  }
});

/** Rounded cobbles with soil in the joints. */
export function paintCobbles(p: Paint, r: Ramp[], o: { freq: number; gap: number; joint?: Ramp; rough?: number; salt?: number }): Layout {
  const L = cobbles(p, { freq: o.freq, gap: o.gap, salt: o.salt });
  relief(p, L, { joint: 0.12, face: 0.72, vary: 0.08, bevel: 3.5, curve: 0.55 });
  chipEdges(p, L, { amount: 0.18, depth: 0.08 });
  const n = fbm(p, 8, 3, 91);
  const light = lightField(p, 1.5);
  const tone = field(p);
  for (let i = 0; i < tone.length; i++) {
    const c = L.id[i];
    tone[i] = c < 0 ? 0.15 + n[i] * 0.5 : 0.48 + (L.rnd(c) - 0.5) * 0.3 + (n[i] - 0.5) * 0.25 + light[i];
  }
  const joint = o.joint ?? ramp("#0f0c0a", "#1f1812", "#30251b");
  paintTone(p, (i) => (L.id[i] < 0 ? joint : r[Math.floor(L.rnd(L.id[i], 3) * r.length)]), tone, 0.4);
  for (let i = 0; i < tone.length; i++) p.rough[i] = L.id[i] < 0 ? 0.95 : (o.rough ?? 0.72) + (n[i] - 0.5) * 0.2;
  return L;
}

registerMaterial("stone.cobble", (p) => {
  paintCobbles(p, [STONE_GREY, STONE_WARM, STONE_BLUE], { freq: 5, gap: 2 });
});

// ─── Organic hard ───────────────────────────────────────────────────────────

export const BONE = ramp("#3b3226", "#655843", "#8f8065", "#b5a585", "#d2c4a2", "#ebe0c2");

registerMaterial("bone", (p) => {
  // Long-bone surface: fine lengthwise striations, pores, hairline cracks,
  // brown staining in the lows.
  const fib = fbmXY(p, 1, 16, 2, 101);
  const n = fbm(p, 3, 3, 102);
  for (let i = 0; i < n.length; i++) p.height[i] = 0.5 + (fib[i] - 0.5) * 0.05 + (n[i] - 0.5) * 0.08;
  dents(p, { count: 24, r: [0.5, 1.1], depth: 0.12 });
  const light = lightField(p, 1.3);
  const tone = field(p);
  for (let i = 0; i < n.length; i++) tone[i] = 0.66 + (fib[i] - 0.5) * 0.14 + (n[i] - 0.5) * 0.14 + light[i];
  paintTone(p, BONE, tone, 0.25);
  cracks(p, { count: 3, length: [6, 14], depth: 0.1, color: BONE[1], angle: 0, wander: 0.25, lip: 0.1, branch: 0.03 });
  grime(p, { color: hex("#5a4020"), amount: 0.5, cavity: 1.2, from: "none", freq: 3 });
  roughFrom(p, 0.58, n, 0.08);
});

// ─── Cloth ──────────────────────────────────────────────────────────────────

registerMaterial("cloth.linen", (p) => {
  const tone = weave(p, { cell: 2, salt: 1, slub: 0.3 });
  const st = fbm(p, 4, 3, 111);
  const folds = fbmXY(p, 3, 1, 2, 112);
  for (let i = 0; i < tone.length; i++) {
    tone[i] += (folds[i] - 0.5) * 0.25;
    p.height[i] += (folds[i] - 0.5) * 0.25;
  }
  paintTone(p, ramp("#4f493d", "#7a7262", "#a39a85", "#c4bba3", "#ddd5bd", "#eee8d6"), tone, 0.3);
  // Old stains: faint tea-coloured blooms.
  for (let i = 0; i < tone.length; i++) if (st[i] > 0.72) p.mix(i, hex("#8a6a3a"), (st[i] - 0.72) * 1.2);
  roughFrom(p, 0.92);
});

registerMaterial("cloth.wool", (p) => {
  // 2/2 twill: diagonal ribs; felted fuzz breaks up the regularity.
  const s = p.size;
  const fuzz = grainNoise(p, 121);
  const n = fbm(p, 4, 3, 122);
  const tone = field(p);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      const rib = ((x + y) >> 1) & 1;
      const edge = (x + y) & 1;
      tone[i] = 0.42 + rib * 0.2 - edge * 0.06 + (fuzz[i] - 0.5) * 0.22 + (n[i] - 0.5) * 0.3;
      p.height[i] = 0.45 + rib * 0.12 + (fuzz[i] - 0.5) * 0.05;
    }
  paintTone(p, ramp("#1d1b1f", "#322e33", "#4a444a", "#635a5e", "#7e7274"), tone, 0.4);
  roughFrom(p, 1);
});

registerMaterial("cloth.velvet", (p) => {
  // Deep crimson pile: soft drape folds, crushed patches, no hard texels.
  const folds = fbmXY(p, 3, 1, 3, 131);
  const crush = fbm(p, 5, 3, 132);
  const pile = grainNoise(p, 133);
  const tone = field(p);
  for (let i = 0; i < tone.length; i++) {
    const f = Math.sin(folds[i] * Math.PI * 2) * 0.5 + 0.5;
    tone[i] = 0.3 + f * 0.36 + (crush[i] - 0.5) * 0.14 + (pile[i] - 0.5) * 0.1;
    p.height[i] = 0.5 + (f - 0.5) * 0.3;
  }
  paintTone(p, ramp("#16040a", "#330812", "#530f1e", "#76182c", "#9a2a3c", "#bf4a55"), tone, 0.7);
  roughFrom(p, 0.95);
});

registerMaterial("cloth.burlap", (p) => {
  // Coarse open weave: 3-texel threads with dark holes at the crossings.
  const s = p.size;
  const c = 4;
  const warpN = fbmXY(p, 1, 16, 1, 141);
  const weftN = fbmXY(p, 16, 1, 1, 142);
  const g = grainNoise(p, 143);
  const tone = field(p);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      const lx = x % c;
      const ly = y % c;
      const over = ((x / c) | 0) + ((y / c) | 0);
      const inWarp = lx < 3;
      const inWeft = ly < 3;
      let t: number;
      let h: number;
      if (!inWarp && !inWeft) {
        t = 0;
        h = 0.1;
      } else if (inWarp && inWeft) {
        const warpOnTop = over & 1;
        t = warpOnTop ? 0.55 + (lx === 1 ? 0.12 : 0) + (warpN[i] - 0.5) * 0.4 : 0.55 + (ly === 1 ? 0.12 : 0) + (weftN[i] - 0.5) * 0.4;
        h = 0.7;
      } else {
        t = 0.28 + (inWarp ? warpN[i] : weftN[i]) * 0.25;
        h = 0.45;
      }
      tone[i] = t + (g[i] - 0.5) * 0.15;
      p.height[i] = h;
    }
  paintTone(p, ramp("#1c150c", "#3f3019", "#624c2b", "#82673c", "#a0824f", "#bda068"), tone, 0.3);
  roughFrom(p, 1);
});

registerMaterial("leather", (p) => {
  // Pebbled hide with creases and rubbed, lighter high points.
  const c = cellular(p, 16, 151, 1);
  const cr = veins(p, 3, 1.2, 152);
  const n = fbm(p, 4, 3, 153);
  for (let i = 0; i < n.length; i++) p.height[i] = 0.5 + clamp01(c.f2[i] - c.f1[i]) * 0.08 - cr[i] * 0.12 + (n[i] - 0.5) * 0.1;
  const light = lightField(p, 1.5);
  const tone = field(p);
  for (let i = 0; i < n.length; i++) tone[i] = 0.45 + (n[i] - 0.5) * 0.45 + light[i] - cr[i] * 0.25 + clamp01(c.f2[i] - c.f1[i]) * 0.06;
  paintTone(p, ramp("#1a0e07", "#331d0e", "#4f2e16", "#6c4020", "#89552d", "#a66e40"), tone, 0.35);
  for (let i = 0; i < n.length; i++) p.rough[i] = 0.62 - (n[i] > 0.7 ? 0.18 : 0);
});

// ─── Ceramic, wax, glass ────────────────────────────────────────────────────

export const TERRACOTTA = ramp("#3a160b", "#632814", "#8a3d20", "#a8522c", "#c26a3c", "#d88a58");

registerMaterial("ceramic.clay", (p) => {
  const s = p.size;
  const n = fbm(p, 4, 3, 161);
  const wob = fbmXY(p, 2, 1, 2, 162);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      // Throwing rings from the wheel.
      const ring = Math.sin(((y + wob[i] * 3) / 5) * Math.PI * 2);
      p.height[i] = 0.5 + ring * 0.035 + (n[i] - 0.5) * 0.06;
    }
  const light = lightField(p, 1.6);
  const tone = field(p);
  for (let i = 0; i < n.length; i++) tone[i] = 0.5 + (n[i] - 0.5) * 0.4 + light[i];
  paintTone(p, TERRACOTTA, tone, 0.3);
  speckle(p, { density: 0.03, color: hex("#e0b090"), amount: 0.35, salt: 3 });
  speckle(p, { density: 0.03, color: hex("#2a1008"), amount: 0.4, salt: 4 });
  roughFrom(p, 0.85, n, 0.05);
});

registerMaterial("ceramic.glazed", (p) => {
  // Deep teal glaze pooling darker in runs, fine crackle, very glossy.
  const run = fbmXY(p, 8, 1, 3, 171);
  const n = fbm(p, 3, 3, 172);
  const c = cellular(p, 12, 173, 1);
  for (let i = 0; i < n.length; i++) p.height[i] = 0.5 + (run[i] - 0.5) * 0.06;
  const tone = field(p);
  for (let i = 0; i < n.length; i++) tone[i] = 0.55 + (run[i] - 0.5) * 0.5 + (n[i] - 0.5) * 0.3;
  paintTone(p, ramp("#08161e", "#0f2c3c", "#184658", "#236276", "#378294", "#6aaeb8"), tone, 0.35);
  for (let i = 0; i < n.length; i++) {
    if (c.f2[i] - c.f1[i] < 0.55) p.mix(i, hex("#a8d0d0"), 0.3);
    p.rough[i] = 0.1 + (1 - run[i]) * 0.06;
  }
});

registerMaterial("wax", (p) => {
  // Tallow: smooth, with rounded rivulets that wander down and bead at
  // their ends (domed in height so they catch light like real drips).
  const s = p.size;
  const n = fbm(p, 3, 3, 181);
  for (let i = 0; i < n.length; i++) p.height[i] = 0.45 + (n[i] - 0.5) * 0.05;
  const drip = field(p);
  const bump = (cx: number, cy: number, w: number) => {
    for (let dy = -Math.ceil(w); dy <= Math.ceil(w); dy++)
      for (let dx = -Math.ceil(w); dx <= Math.ceil(w); dx++) {
        const px = Math.floor(cx) + dx;
        const py = Math.floor(cy) + dy;
        const d = Math.hypot(px + 0.5 - cx, (py + 0.5 - cy) * 1.6) / w;
        if (d >= 1) continue;
        const i = p.idx(px, py);
        const dome = Math.sqrt(1 - d * d);
        p.height[i] = Math.max(p.height[i], 0.5 + 0.16 * dome);
        drip[i] = Math.max(drip[i], dome);
      }
  };
  for (let k = 0; k < 7; k++) {
    let x = p.rng.range(0, s);
    const y0 = p.rng.int(0, s - 1);
    const len = p.rng.int(10, 34);
    const w0 = p.rng.range(1.8, 3);
    for (let t = 0; t <= len; t++) {
      x += p.rng.gauss() * 0.2;
      bump(x, y0 + t, w0 * (0.92 + 0.08 * Math.sin(t * 0.25 + k)) * (1 - (t / len) * 0.25));
    }
    bump(x, y0 + len + 0.5, w0 + 0.9);
  }
  const light = lightField(p, 1.8);
  const tone = field(p);
  for (let i = 0; i < n.length; i++) tone[i] = 0.58 + (n[i] - 0.5) * 0.18 + light[i] + drip[i] * 0.08;
  paintTone(p, ramp("#4a3c28", "#7e6b4d", "#ab9670", "#ccb994", "#e2d3b2", "#f3ead4"), tone, 0.3);
  roughFrom(p, 0.42, n, 0.05);
});

registerMaterial("glass", (p) => {
  // Old bottle glass: green, wavy streaks, trapped bubbles, bright glints.
  const s = p.size;
  const st = fbmXY(p, 6, 1, 3, 191);
  const n = fbm(p, 3, 2, 192);
  for (let i = 0; i < n.length; i++) p.height[i] = 0.5 + (st[i] - 0.5) * 0.08;
  const tone = field(p);
  for (let i = 0; i < n.length; i++) tone[i] = 0.35 + (st[i] - 0.5) * 0.5 + (n[i] - 0.5) * 0.3;
  const G = ramp("#07140f", "#0e2620", "#183d33", "#26594b", "#3f7a68", "#77ab98", "#c8eadc");
  paintTone(p, G, tone, 0.3);
  for (let k = 0; k < 14; k++) {
    const x = p.rng.int(0, s - 1);
    const y = p.rng.int(0, s - 1);
    const big = p.rng.chance(0.3);
    if (big) {
      p.disc(x + 0.5, y + 0.5, 1.6, (i, d) => {
        if (d > 0.6) p.setColor(i, G[4]);
      });
      p.set(x - 1, y - 1, { c: G[6] });
    } else p.set(x, y, { c: G[5] });
  }
  for (let k = 0; k < 3; k++) {
    const x = p.rng.int(0, s - 1);
    const y = p.rng.int(0, s - 1);
    p.line(x, y, x + 3, y - 3, (i) => p.setColor(i, G[6]));
  }
  roughFrom(p, 0.05);
});

// ─── Arcane, gems ───────────────────────────────────────────────────────────

/** Faceted crystal: flat facets (tilted planes per Voronoi cell) so the
 * normal map sparkles; bright facet edges and a glowing core. */
export function paintFacets(p: Paint, r: Ramp, o: { freq: number; glowEdges?: number; core?: number; salt?: number }): void {
  const s = p.size;
  const c = cellular(p, o.freq, 201 + (o.salt ?? 0), 1);
  const n = fbm(p, 3, 3, 202 + (o.salt ?? 0));
  const tone = field(p);
  for (let i = 0; i < n.length; i++) {
    const id = c.id[i];
    const sx = ((id * 7919) % 13) / 13 - 0.5;
    const sy = ((id * 104729) % 11) / 11 - 0.5;
    const dx = wrapDelta(i % s, c.px[id], s);
    const dy = wrapDelta((i / s) | 0, c.py[id], s);
    p.height[i] = 0.5 + (sx * dx + sy * dy) * 0.03;
    const facet = 0.45 + (sx - sy) * 0.6;
    const edge = c.f2[i] - c.f1[i] < 0.9;
    tone[i] = facet + (n[i] - 0.5) * 0.35 + (edge ? 0.35 : 0);
    if (edge) p.emit[i] = o.glowEdges ?? 0;
    const core = o.core ?? 0;
    if (core > 0) p.emit[i] = Math.max(p.emit[i], smooth(0.55, 1, n[i]) * core);
  }
  paintTone(p, r, tone, 0.35);
  roughFrom(p, 0.08);
}

registerMaterial(
  "crystal",
  (p) => {
    paintFacets(p, ramp("#120a2a", "#2a1655", "#46248a", "#6a3cc0", "#9a6ae6", "#d2b8ff", "#f4ecff"), { freq: 5, glowEdges: 0.8, core: 0.6 });
  },
  { glow: 3 },
);

registerMaterial(
  "gem",
  (p) => {
    paintFacets(p, ramp("#1a0206", "#420812", "#72101f", "#a51c2e", "#d8384a", "#ff8a8a", "#ffe0e0"), { freq: 4, glowEdges: 0.35, core: 0.4, salt: 5 });
    speckle(p, { density: 0.015, color: [1, 1, 1], amount: 1 });
  },
  { glow: 2 },
);

// ─── Flesh & creatures ──────────────────────────────────────────────────────

export const FLESH = ramp("#26040a", "#4a0a12", "#721420", "#9a222c", "#bc4244", "#dc7468");

registerMaterial("flesh", (p) => {
  // Raw, wet meat: muscle fibre bundles, fat marbling, dark veins,
  // glistening highlights on the wet high points.
  const fib = fbmXY(p, 2, 10, 3, 210);
  const n = fbm(p, 3, 3, 211);
  const fat = fbm(p, 2, 3, 212);
  const v = veins(p, 3, 1.2, 213);
  for (let i = 0; i < n.length; i++) p.height[i] = 0.5 + (fib[i] - 0.5) * 0.2 + (n[i] - 0.5) * 0.15 + v[i] * 0.06;
  const light = lightField(p, 1.6);
  const tone = field(p);
  for (let i = 0; i < n.length; i++) tone[i] = 0.5 + (fib[i] - 0.5) * 0.4 + (n[i] - 0.5) * 0.15 + light[i];
  paintTone(p, FLESH, tone, 0.3);
  // Fat streaks: wavy lines running with the muscle, fading in and out.
  const fatLine = field(p);
  for (let i = 0; i < n.length; i++) fatLine[i] = (((i / p.size) | 0) / p.size) * 3 + (fat[i] - 0.5) * 1.2;
  const marb = isoLines(p, fatLine, 1.6);
  for (let i = 0; i < n.length; i++) marb[i] *= n[i] > 0.35 ? 1 : 0;
  for (let i = 0; i < n.length; i++) {
    if (marb[i] > 0.5) p.mix(i, hex("#e8cdb0"), 0.8);
    if (v[i] > 0.4) p.mix(i, hex("#3a0620"), v[i] * 0.7);
    p.rough[i] = 0.28 + (1 - n[i]) * 0.2;
    if (light[i] > 0.12) p.mix(i, hex("#ffd0c8"), 0.35);
  }
});

registerMaterial("flesh.pale", (p) => {
  // Grave-pale skin: grey-green, bruise-purple lividity, blue veins.
  const n = fbm(p, 4, 3, 221);
  const liv = fbm(p, 3, 3, 222);
  const v = veins(p, 2, 1, 223);
  for (let i = 0; i < n.length; i++) p.height[i] = 0.5 + (n[i] - 0.5) * 0.08 + v[i] * 0.05;
  const light = lightField(p, 1.2);
  const tone = field(p);
  for (let i = 0; i < n.length; i++) tone[i] = 0.58 + (n[i] - 0.5) * 0.18 + light[i];
  paintTone(p, ramp("#2a2e2a", "#474f48", "#687064", "#899083", "#a9ae9e", "#c9cbb9"), tone, 0.3);
  for (let i = 0; i < n.length; i++) {
    if (liv[i] > 0.66) p.mix(i, hex("#5a3a58"), Math.min(0.5, (liv[i] - 0.66) * 1.5));
    if (v[i] > 0.35) p.mix(i, hex("#3c4a6a"), v[i] * 0.55);
  }
  speckle(p, { density: 0.02, color: hex("#2a2a26"), amount: 0.4, h: -0.04 });
  roughFrom(p, 0.66, n, 0.06);
});

registerMaterial("chitin", (p) => {
  // Overlapping carapace plates: dark under the lip of the plate above,
  // bright rim on each free edge, oily green-violet sheen.
  const s = p.size;
  const bands = [0, 11, 22, 32, 43, 54];
  const n = fbm(p, 4, 3, 231);
  const pits = grainNoise(p, 232);
  const tone = field(p);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      const yy = (((y + (n[i] - 0.5) * 4) % s) + s) % s;
      let k = 0;
      for (let b = 0; b < bands.length; b++) if (yy >= bands[b]) k = b;
      const top = bands[k];
      const bot = k + 1 < bands.length ? bands[k + 1] : s;
      const t = clamp01((yy - top) / (bot - top));
      p.height[i] = 0.3 + t * 0.55 + (pits[i] < 0.03 ? -0.1 : 0);
      tone[i] = 0.15 + t * 0.7 + (t > 0.85 ? 0.2 : 0) + (n[i] - 0.5) * 0.2;
    }
  paintTone(p, ramp("#050507", "#110f16", "#1e1b28", "#2d283d", "#433a5a", "#5f5480", "#8a86b0"), tone, 0.4);
  for (let i = 0; i < n.length; i++) {
    if (n[i] > 0.6 && tone[i] > 0.5) p.mix(i, hex("#3c6a52"), (n[i] - 0.6) * 1.2);
    p.rough[i] = 0.22 + (pits[i] < 0.03 ? 0.4 : 0);
  }
});

registerMaterial("fur", (p) => {
  // Hundreds of short strands, clumped, dark roots and light tips.
  const s = p.size;
  const clump = fbm(p, 6, 3, 241);
  p.fill(hex("#140c07"), 0.3, 0.95);
  const tone = field(p, 0.1);
  for (let k = 0; k < 900; k++) {
    const x = p.rng.range(0, s);
    const y = p.rng.range(0, s);
    const len = p.rng.int(3, 7);
    const lean = p.rng.range(-0.35, 0.35) + (clump[p.idx(x, y)] - 0.5) * 0.8;
    const base = 0.25 + clump[p.idx(x, y)] * 0.45;
    for (let t = 0; t < len; t++) {
      const i = p.idx(x + lean * t, y + t);
      const v = base + (t / len) * 0.35;
      if (v > tone[i]) {
        tone[i] = v;
        p.height[i] = 0.35 + (t / len) * 0.5;
      }
    }
  }
  paintTone(p, ramp("#120a06", "#26180d", "#3e2a17", "#5a4024", "#775834", "#957448"), tone, 0.3);
});

registerMaterial("feathers", (p) => {
  const L = scaleLayout(p, { cols: 4, stretch: 1.8 });
  const tone = field(p);
  for (let i = 0; i < tone.length; i++) {
    if (L.id[i] < 0) {
      tone[i] = 0;
      continue;
    }
    const u = L.u[i];
    const v = L.v[i];
    // Rachis down the middle, barbs angled off it.
    const rachis = Math.abs(u) < 0.1;
    const barb = Math.sin((v * 9 - Math.abs(u) * 5) * Math.PI) > 0.6;
    tone[i] = 0.25 + v * 0.4 + (barb ? 0.1 : 0) + (rachis ? 0.35 : 0) - L.d[i] * 0.15 + (L.rnd(L.id[i]) - 0.5) * 0.15;
    p.height[i] = 0.3 + v * 0.4 + (rachis ? 0.1 : 0) + (barb ? 0.03 : 0);
  }
  paintTone(p, ramp("#050609", "#0e1119", "#181e2c", "#253047", "#384868", "#56688c"), tone, 0.3);
  for (let i = 0; i < tone.length; i++) {
    if (tone[i] > 0.55) p.mix(i, hex("#3a6a6a"), 0.25);
    p.rough[i] = 0.6;
  }
});

/** Reptile / fish scales, lit rims on each free edge. */
export function paintScales(p: Paint, r: Ramp, o: { cols: number; stretch?: number; rough?: number }): void {
  const L = scaleLayout(p, { cols: o.cols, stretch: o.stretch });
  const n = fbm(p, 6, 2, 251);
  const tone = field(p);
  for (let i = 0; i < tone.length; i++) {
    if (L.id[i] < 0) {
      tone[i] = 0;
      p.height[i] = 0.2;
      continue;
    }
    const rim = L.d[i] > 0.8 && L.v[i] > 0.4;
    tone[i] = 0.2 + L.v[i] * 0.5 + (rim ? 0.25 : 0) + (L.rnd(L.id[i]) - 0.5) * 0.2 + (n[i] - 0.5) * 0.15;
    p.height[i] = 0.3 + L.v[i] * 0.45 - (L.d[i] > 0.92 ? 0.08 : 0);
  }
  paintTone(p, r, tone, 0.3);
  roughFrom(p, o.rough ?? 0.4, n, 0.08);
}

registerMaterial("scales", (p) => {
  paintScales(p, ramp("#07130a", "#112a16", "#1e4424", "#305f32", "#4a7e44", "#6fa05c"), { cols: 6 });
});

registerMaterial("slime", (p) => {
  const s = p.size;
  const n = fbm(p, 3, 4, 261);
  for (let i = 0; i < n.length; i++) p.height[i] = 0.5 + (n[i] - 0.5) * 0.25;
  const light = lightField(p, 1.5);
  const tone = field(p);
  for (let i = 0; i < n.length; i++) tone[i] = 0.5 + (n[i] - 0.5) * 0.25 + light[i];
  const R = ramp("#061a06", "#0f3410", "#1f5a18", "#38862a", "#62b242", "#a8e27a", "#e4ffc8");
  paintTone(p, R, tone, 0.4);
  for (let k = 0; k < 16; k++) {
    const x = p.rng.range(0, s);
    const y = p.rng.range(0, s);
    const r = p.rng.range(1.2, 3);
    p.disc(x, y, r, (i, d) => {
      p.height[i] += (1 - d) * 0.15;
      if (d > 0.7) p.setColor(i, R[5]);
      else p.setColor(i, R[3]);
    });
    p.set(x - r * 0.4, y - r * 0.4, { c: R[6] });
  }
  roughFrom(p, 0.08);
  for (let i = 0; i < n.length; i++) p.emit[i] = 0.06;
});

// ─── Fungus, moss ───────────────────────────────────────────────────────────

export const FUNGUS_CAP = ramp("#140814", "#2c1230", "#471d4a", "#632b64", "#80407e", "#9e5a98");
export const SPORE_GLOW = ramp("#1a6e6a", "#2fb0a4", "#62e8d4", "#c8fff4");

/** Glowing spots on a surface: raised round warts with an emissive core. */
export function glowSpots(p: Paint, o: { count: number; r: [number, number]; ramp: Ramp; emit?: number; mask?: (i: number) => boolean }): void {
  for (let k = 0; k < o.count; k++) {
    const x = p.rng.range(0, p.size);
    const y = p.rng.range(0, p.size);
    if (o.mask && !o.mask(p.idx(x, y))) continue;
    const r = p.rng.range(o.r[0], o.r[1]);
    p.disc(x, y, r, (i, d) => {
      p.height[i] += (1 - d * d) * 0.12;
      p.setColor(i, rampColor(o.ramp, 1 - d + 0.15, i % p.size, (i / p.size) | 0, 0.5));
      p.emit[i] = Math.max(p.emit[i], (o.emit ?? 1) * (1 - d * 0.6));
      p.rough[i] = 0.4;
    });
  }
}

registerMaterial(
  "fungus.cap",
  (p) => {
    const n = fbm(p, 3, 4, 271);
    const streak = fbmXY(p, 1, 8, 2, 272);
    for (let i = 0; i < n.length; i++) p.height[i] = 0.45 + (n[i] - 0.5) * 0.15;
    const light = lightField(p, 1.4);
    const tone = field(p);
    for (let i = 0; i < n.length; i++) tone[i] = 0.5 + (n[i] - 0.5) * 0.45 + (streak[i] - 0.5) * 0.25 + light[i];
    paintTone(p, FUNGUS_CAP, tone, 0.4);
    roughFrom(p, 0.5, n, 0.1);
    glowSpots(p, { count: 16, r: [1.2, 3], ramp: SPORE_GLOW, emit: 0.9 });
  },
  { glow: 3 },
);

registerMaterial("fungus.stem", (p) => {
  const s = p.size;
  const fib = fbmXY(p, 12, 1, 3, 281);
  const n = fbm(p, 3, 3, 282);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      p.height[i] = 0.5 + (fib[i] - 0.5) * 0.15;
    }
  const light = lightField(p, 1.2);
  const tone = field(p);
  for (let i = 0; i < n.length; i++) tone[i] = 0.55 + (fib[i] - 0.5) * 0.5 + (n[i] - 0.5) * 0.25 + light[i];
  paintTone(p, ramp("#2e2820", "#584e3e", "#83775e", "#ab9f82", "#cdc3a6", "#e6ddc4"), tone, 0.3);
  roughFrom(p, 0.72, fib, 0.06);
});

export const MOSS = ramp("#0b1407", "#18280c", "#273e13", "#3b581b", "#537326", "#739334");

registerMaterial("moss", (p) => {
  // Deep cushion moss: lumpy clumps, each lit on top, speckled tips.
  const c = cellular(p, 9, 291, 0.9);
  const n = fbm(p, 6, 3, 292);
  const g = grainNoise(p, 293);
  for (let i = 0; i < n.length; i++) p.height[i] = 0.35 + (1 - clamp01(c.f1[i] / 5)) * 0.35 + (g[i] - 0.5) * 0.1;
  const light = lightField(p, 1.4);
  const tone = field(p);
  for (let i = 0; i < n.length; i++) tone[i] = 0.45 + (n[i] - 0.5) * 0.4 + light[i] + (g[i] - 0.5) * 0.25;
  paintTone(p, MOSS, tone, 0.6);
  speckle(p, { density: 0.02, color: hex("#a0b848"), amount: 0.7 });
  roughFrom(p, 1);
});

// ─── Paper & books ──────────────────────────────────────────────────────────

export const PARCHMENT = ramp("#4f412a", "#806c4a", "#a8946c", "#c9b78e", "#e0d2ae", "#f0e7cc");
export const INK: RGB = hex("#1c1612");

registerMaterial("paper", (p) => {
  const s = p.size;
  const n = fbm(p, 3, 4, 301);
  const fib = fbm(p, 16, 2, 302);
  const tone = field(p);
  for (let i = 0; i < n.length; i++) {
    tone[i] = 0.62 + (n[i] - 0.5) * 0.35 + (fib[i] - 0.5) * 0.12;
    p.height[i] = 0.5 + (fib[i] - 0.5) * 0.03;
  }
  paintTone(p, PARCHMENT, tone, 0.3);
  // Faded lines of handwriting: word-length dashes on ruled rows.
  for (let y = 4; y < s; y += 5) {
    let x = 3;
    while (x < s - 4) {
      const w = p.rng.int(2, 7);
      for (let k = 0; k < w && x + k < s - 3; k++) {
        const up = p.rng.chance(0.25) ? -1 : 0;
        p.mix(p.idx(x + k, y + up), INK, 0.55);
      }
      x += w + p.rng.int(1, 2);
    }
  }
  // Foxing spots and a water stain ring.
  for (let i = 0; i < n.length; i++) if (n[i] < 0.12) p.mix(i, hex("#7a5a30"), 0.4);
  speckle(p, { density: 0.01, color: hex("#6a4a24"), amount: 0.5 });
  roughFrom(p, 0.85);
});

export const SPINE_RAMPS: Ramp[] = [
  ramp("#1c0608", "#3a0c10", "#5c1a1a", "#7e2c26"),
  ramp("#081408", "#132a16", "#224426", "#355e34"),
  ramp("#070a18", "#111a32", "#1e2c4e", "#304268"),
  ramp("#140c06", "#2c1a0c", "#472b16", "#643e22"),
  ramp("#0a0808", "#191414", "#2a2220", "#3c3230"),
  ramp("#2a1a0c", "#4e3418", "#765028", "#9c6e3c"),
  ramp("#1a0a18", "#321430", "#4c2248", "#683462"),
];

/** A shelf row of book spines between y0 and y0+h (the bottom 4 texels are
 * the shelf board). Gold bands are real metal; spines bulge. */
export function bookRow(p: Paint, y0: number, h: number, o: { shelf?: Ramp; back?: RGB; salt?: number } = {}): void {
  const s = p.size;
  const shelf = o.shelf ?? WOOD_DARK;
  const back = o.back ?? hex("#0a0706");
  const boardH = 4;
  const booksBottom = y0 + h - boardH;
  for (let y = y0; y < y0 + h; y++) for (let x = 0; x < s; x++) p.set(x, y, { c: back, h: 0.05, r: 0.95, m: 0 });
  let x = p.rng.int(0, 3);
  const startX = x;
  while (x < startX + s) {
    const w = Math.min(p.rng.int(3, 7), startX + s - x);
    if (w < 2) break;
    const gapAfter = p.rng.chance(0.15) ? 1 : 0;
    const bh = p.rng.int(Math.floor((h - boardH) * 0.6), h - boardH - 1);
    const r = SPINE_RAMPS[p.rng.int(0, SPINE_RAMPS.length - 1)];
    const top = booksBottom - bh;
    const bandY = [top + 2, booksBottom - 3];
    const hasTitle = w >= 4 && p.rng.chance(0.6);
    const titleY = top + Math.floor(bh * 0.3);
    const worn = p.rng.next();
    for (let yy = top; yy < booksBottom; yy++)
      for (let xx = 0; xx < w; xx++) {
        const across = w === 1 ? 0.5 : xx / (w - 1);
        const bulge = 1 - Math.abs(across - 0.4) * 1.6;
        let t = 0.3 + bulge * 0.5 + (yy === top ? 0.2 : 0);
        if (xx === w - 1) t -= 0.25;
        const i = p.idx(x + xx, yy);
        p.setColor(i, rampColor(r, t, x + xx, yy, 0.4));
        p.height[i] = 0.55 + bulge * 0.15;
        p.rough[i] = 0.7 - worn * 0.15;
        p.metal[i] = 0;
        const isBand = bandY.includes(yy) && xx < w - 1;
        const isTitle = hasTitle && yy >= titleY && yy < titleY + 3 && xx > 0 && xx < w - 2;
        if (isBand || (isTitle && (yy === titleY + 1 || (xx + yy) & 1))) {
          p.setColor(i, GOLD[xx === 0 ? 6 : 4 + (bulge > 0.6 ? 1 : 0)]);
          p.metal[i] = 1;
          p.rough[i] = 0.35;
          p.height[i] += 0.04;
        }
      }
    x += w + gapAfter;
  }
  // Shelf board with a lit front lip.
  for (let yy = 0; yy < boardH; yy++)
    for (let xx = 0; xx < s; xx++) {
      const i = p.idx(xx, booksBottom + yy);
      p.setColor(i, shelf[yy === 0 ? shelf.length - 1 : yy === boardH - 1 ? 1 : shelf.length - 3 - (((xx * 7) >> 3) % 2)]);
      p.height[i] = 0.9 - yy * 0.05;
      p.rough[i] = 0.7;
      p.metal[i] = 0;
    }
  // Shadow under each book top / behind books.
  for (let xx = 0; xx < s; xx++) p.shade(p.idx(xx, booksBottom - 1), 0.8);
}

registerMaterial("book.spines", (p) => {
  bookRow(p, 0, 32);
  bookRow(p, 32, 32);
});

// ─── Hive, amber, ice ───────────────────────────────────────────────────────

export const WAX = ramp("#3a2406", "#6a4410", "#9a6a1a", "#c69228", "#e2b84a", "#f4dc88");
export const HONEY = ramp("#2a0e00", "#5c2400", "#8c4200", "#bc6a08", "#e69a20", "#ffcc58");

/** Honeycomb cells: raised wax walls; cells empty, capped or full of honey.
 * `glowing` honey cells emit. */
export function paintHoneycomb(p: Paint, o: { cols: number; filled?: number; capped?: number; glowing?: number }): void {
  const L = hexes(p, { cols: o.cols, gap: 1.6 });
  const n = fbm(p, 6, 2, 311);
  const tone = field(p);
  for (let i = 0; i < tone.length; i++) {
    const c = L.id[i];
    if (c < 0) {
      p.height[i] = 0.85;
      tone[i] = 0.62 + (n[i] - 0.5) * 0.3;
      continue;
    }
    const kind = L.rnd(c);
    const d = L.d[i];
    if (kind < (o.capped ?? 0.25)) {
      // Wax cap: pale shallow dome.
      p.height[i] = 0.6 + (1 - d * d) * 0.12;
      tone[i] = 0.72 - d * 0.2;
    } else if (kind < (o.capped ?? 0.25) + (o.filled ?? 0.4)) {
      p.height[i] = 0.45;
      tone[i] = -1 - d;
    } else {
      p.height[i] = 0.15 + d * 0.3;
      tone[i] = 0.08 + d * 0.3;
    }
  }
  const light = lightField(p, 1.2);
  for (let i = 0; i < tone.length; i++) if (tone[i] >= 0) tone[i] += light[i];
  paintTone(p, WAX, tone, 0.4, (i) => tone[i] >= 0);
  const s = p.size;
  for (let i = 0; i < tone.length; i++) {
    p.rough[i] = 0.55;
    if (tone[i] < 0) {
      const d = -tone[i] - 1;
      const x = i % s;
      const y = (i / s) | 0;
      p.setColor(i, rampColor(HONEY, 0.95 - d * 0.6 + (n[i] - 0.5) * 0.2, x, y, 0.5));
      p.rough[i] = 0.08;
      const c = L.id[i];
      if (L.rnd(c, 5) < (o.glowing ?? 0)) p.emit[i] = 0.7 - d * 0.4;
    }
  }
}

registerMaterial("honeycomb", (p) => paintHoneycomb(p, { cols: 7 }), { glow: 2 });

export const AMBER = ramp("#240c02", "#4e1e04", "#7c3606", "#aa540c", "#d27a1a", "#eea43a", "#fcd27a");

registerMaterial(
  "amber",
  (p) => {
    const s = p.size;
    const flow = fbm(p, 2, 4, 321, 0.6);
    const n = fbm(p, 5, 2, 322);
    const tone = field(p);
    for (let i = 0; i < n.length; i++) {
      const band = Math.sin(flow[i] * Math.PI * 6) * 0.5 + 0.5;
      tone[i] = 0.4 + band * 0.25 + (n[i] - 0.5) * 0.3;
      p.height[i] = 0.5 + (n[i] - 0.5) * 0.04;
    }
    paintTone(p, AMBER, tone, 0.45);
    // Inclusions: bubbles and a couple of trapped gnats.
    for (let k = 0; k < 8; k++) {
      const x = p.rng.int(0, s - 1);
      const y = p.rng.int(0, s - 1);
      p.set(x, y, { c: AMBER[6] });
      p.set(x + 1, y + 1, { c: AMBER[2] });
    }
    for (let k = 0; k < 2; k++) insect(p, p.rng.int(0, s - 1), p.rng.int(0, s - 1), hex("#1a0a02"));
    roughFrom(p, 0.08);
    for (let i = 0; i < n.length; i++) p.emit[i] = 0.12 + tone[i] * 0.15;
  },
  { glow: 1.5 },
);

/** A 5×5 pixel insect silhouette (gnat, ant) — amber inclusions, hive. */
export function insect(p: Paint, x: number, y: number, c: RGB): void {
  stamp(p, x, y, ["#.#.#", ".###.", "#.#.#", ".###.", "#...#"], (i) => p.setColor(i, c));
}

export const ICE = ramp("#10283a", "#1e4660", "#346e8a", "#5a9ab2", "#8cc4d6", "#c4e6ee", "#f0fcff");

/** Clear ice: cloudy depths, white fracture planes, bubble strings. */
export function paintIce(p: Paint, o: { cracks?: number; cloud?: number; salt?: number } = {}): void {
  const s = p.size;
  const salt = o.salt ?? 0;
  const n = fbm(p, 3, 4, 331 + salt);
  const cl = fbm(p, 4, 3, 332 + salt);
  for (let i = 0; i < n.length; i++) p.height[i] = 0.5 + (n[i] - 0.5) * 0.05;
  const tone = field(p);
  for (let i = 0; i < n.length; i++) tone[i] = 0.42 + (n[i] - 0.5) * 0.2 + smooth(0.6, 0.95, cl[i]) * (o.cloud ?? 0.3);
  paintTone(p, ICE, tone, 0.3);
  const m = cracks(p, { count: o.cracks ?? 5, length: [10, 30], depth: 0.04, color: ICE[6], branch: 0.1, lip: 0, wander: 0.35 });
  for (let i = 0; i < m.length; i++) if (m[i]) p.mix(p.idx((i % s) + 1, (i / s) | 0), ICE[2], 0.4);
  for (let k = 0; k < 5; k++) {
    let x = p.rng.int(0, s - 1);
    let y = p.rng.int(0, s - 1);
    for (let t = 0; t < 6; t++) {
      p.set(x, y, { c: ICE[5] });
      y -= 2;
      x += p.rng.int(-1, 1);
    }
  }
  roughFrom(p, 0.06);
}

registerMaterial("ice", (p) => paintIce(p));

// ─── Fire, lava, runes ──────────────────────────────────────────────────────

export const LAVA = ramp("#3a0600", "#7a1400", "#c03000", "#f06010", "#ffa030", "#ffd870", "#fff6c0");
export const CRUST = ramp("#0a0605", "#17100c", "#241913", "#33241a", "#453222");

/** Lava: dark crust plates floating on glowing melt; the glow is widest
 * where plates part. Emissive in the melt only. */
export function paintLava(p: Paint, o: { freq?: number; open?: number; salt?: number } = {}): void {
  const c = cellular(p, o.freq ?? 5, 341 + (o.salt ?? 0), 0.9);
  const n = fbm(p, 6, 3, 342 + (o.salt ?? 0));
  const g = grainNoise(p, 343);
  const open = o.open ?? 2.2;
  const melt = field(p);
  for (let i = 0; i < n.length; i++) {
    const e = c.f2[i] - c.f1[i] + (n[i] - 0.5) * 2.2;
    melt[i] = 1 - smooth(0, open, e);
  }
  const light = (() => {
    for (let i = 0; i < n.length; i++) p.height[i] = 0.3 + (1 - melt[i]) * 0.4 + (n[i] - 0.5) * 0.1;
    return lightField(p, 1.4);
  })();
  const s = p.size;
  for (let i = 0; i < n.length; i++) {
    const x = i % s;
    const y = (i / s) | 0;
    if (melt[i] > 0.12) {
      p.setColor(i, rampColor(LAVA, melt[i] * 0.95 + (n[i] - 0.5) * 0.2, x, y, 0.6));
      p.emit[i] = clamp01(0.35 + melt[i] * 0.8);
      p.rough[i] = 0.35;
    } else {
      p.setColor(i, rampColor(CRUST, 0.4 + light[i] + (g[i] - 0.5) * 0.3 + (n[i] - 0.5) * 0.3, x, y, 0.5));
      p.rough[i] = 0.9;
    }
  }
}

registerMaterial("lava", (p) => paintLava(p), { glow: 4 });

/** Carved glowing runes on a stone block: carved lines (lowered), emissive,
 * with a dim halo bleeding onto the stone around them. */
export function carveRunes(
  p: Paint,
  o: { x: number; y: number; cols: number; rows: number; w: number; h: number; gap: number; glow: Ramp; key?: number; emit?: number },
): void {
  const halo = field(p);
  const marks = new Uint8Array(p.size * p.size);
  for (let r = 0; r < o.rows; r++)
    for (let c = 0; c < o.cols; c++) {
      const key = (o.key ?? 0) + r * 31 + c * 7 + p.rng.int(0, 999);
      rune(p, o.x + c * (o.w + o.gap), o.y + r * (o.h + o.gap + 1), o.w, o.h, key, (i) => (marks[i] = 1));
    }
  const s = p.size;
  for (let i = 0; i < marks.length; i++) {
    if (!marks[i]) continue;
    const x = i % s;
    const y = (i / s) | 0;
    for (let oy = -2; oy <= 2; oy++)
      for (let ox = -2; ox <= 2; ox++) {
        const j = p.idx(x + ox, y + oy);
        halo[j] = Math.max(halo[j], 1 - Math.hypot(ox, oy) / 2.9);
      }
  }
  for (let i = 0; i < marks.length; i++) {
    if (marks[i]) {
      p.setColor(i, o.glow[o.glow.length - 1 - ((i * 7) % 2)]);
      p.height[i] -= 0.18;
      p.emit[i] = o.emit ?? 1;
      p.rough[i] = 0.6;
    } else if (halo[i] > 0) {
      p.mix(i, o.glow[1], halo[i] * 0.45);
      p.emit[i] = Math.max(p.emit[i], halo[i] * 0.25);
    }
  }
}

export const RUNE_CYAN = ramp("#0a2a3a", "#1a6a8a", "#40b8d8", "#a0f0ff", "#e8ffff");
export const DARK_STONE = ramp("#0b0b0f", "#15151b", "#202028", "#2c2c36", "#3a3a46", "#4c4c5a");

registerMaterial(
  "rune.glow",
  (p) => {
    const L = slabs(p, { min: 32, max: 32, gap: 1 });
    relief(p, L, { joint: 0.2, face: 0.62, bevel: 1.5 });
    const n = fbm(p, 6, 3, 351);
    const light = lightField(p, 1.2);
    const tone = field(p);
    for (let i = 0; i < n.length; i++) tone[i] = L.id[i] < 0 ? 0 : 0.5 + (n[i] - 0.5) * 0.4 + light[i];
    paintTone(p, DARK_STONE, tone, 0.35);
    roughFrom(p, 0.8, n, 0.1);
    for (const r of L.rects) carveRunes(p, { x: r.x + 4, y: r.y + 5, cols: 3, rows: 2, w: 5, h: 7, gap: 3, glow: RUNE_CYAN });
  },
  { glow: 3 },
);

registerMaterial(
  "flame",
  (p) => {
    // Rising tongues; white-hot at the root, red at the tips, cut out above.
    const s = p.size;
    const n = fbmXY(p, 4, 2, 3, 361);
    const fine = fbm(p, 8, 2, 362);
    const R = ramp("#6a0c02", "#b02406", "#e8500e", "#ff8a1e", "#ffc446", "#fff09a", "#ffffff");
    for (let y = 0; y < s; y++)
      for (let x = 0; x < s; x++) {
        const i = y * s + x;
        const up = 1 - (y + 0.5) / s;
        const tongue = 0.5 + 0.5 * Math.sin((x / s) * Math.PI * 2 * 4 + n[i] * 5);
        const heat = 1 - up / (0.45 + tongue * 0.5 + (n[i] - 0.5) * 0.4) + (fine[i] - 0.5) * 0.25;
        if (heat < 0.05) {
          p.alpha[i] = 0;
          p.setColor(i, R[0]);
          continue;
        }
        p.setColor(i, rampColor(R, heat * 1.05, x, y, 0.7));
        p.emit[i] = 1;
        p.height[i] = 0.5;
        p.rough[i] = 1;
      }
  },
  { glow: 4, cutout: true, worldSize: 1 },
);

registerMaterial(
  "eye.glow",
  (p) => {
    // One great eye filling the texture: lid skin, veined sclera, burning
    // iris with radial striations and a slit pupil.
    const s = p.size;
    const c = s / 2;
    const n = fbm(p, 6, 2, 371);
    const IRIS = ramp("#3a0800", "#8a2000", "#d85a00", "#ffa020", "#ffe070", "#fffbd0");
    for (let y = 0; y < s; y++)
      for (let x = 0; x < s; x++) {
        const i = y * s + x;
        const dx = x + 0.5 - c;
        const dy = y + 0.5 - c;
        const lid = Math.abs(dy) / (28 * Math.sqrt(Math.max(0, 1 - (dx / 31) ** 2)) + 0.01);
        const r = Math.hypot(dx, dy);
        const a = Math.atan2(dy, dx);
        if (lid > 1) {
          p.setColor(i, rampColor(ramp("#140a0a", "#2a1614", "#40241e", "#583428"), 0.5 + (n[i] - 0.5) * 0.6 - (lid < 1.15 ? 0.4 : 0), x, y));
          p.height[i] = lid < 1.15 ? 0.75 : 0.55;
          p.rough[i] = 0.7;
          continue;
        }
        p.height[i] = 0.6;
        p.rough[i] = 0.1;
        if (r < 17) {
          const stri = Math.sin(a * 14 + n[i] * 4) * 0.5 + 0.5;
          const pupil = Math.abs(dx) < 2.5 * Math.sqrt(Math.max(0, 1 - (dy / 15) ** 2));
          if (pupil) {
            p.setColor(i, [0.02, 0, 0]);
            p.emit[i] = 0;
            p.height[i] = 0.5;
          } else {
            const t = 0.35 + (r / 17) * 0.5 * (r > 14 ? -1 : 1) + stri * 0.3 + (r < 5 ? 0.3 : 0);
            p.setColor(i, rampColor(IRIS, t, x, y, 0.5));
            p.emit[i] = r > 15.5 ? 0.3 : 1;
          }
        } else {
          const vein = n[i] > 0.62 && Math.sin(a * 9) > 0.2;
          p.setColor(i, vein ? hex("#6a1a14") : rampColor(ramp("#3a1a14", "#6a4034", "#9a7a6a", "#c0a898"), 0.9 - (r - 17) / 16 - (lid > 0.85 ? 0.4 : 0), x, y));
          p.emit[i] = 0.05;
        }
      }
    p.set(c - 6, c - 7, { c: [1, 1, 0.9], e: 1 });
    p.set(c - 5, c - 7, { c: [1, 1, 0.9], e: 1 });
    p.set(c - 6, c - 6, { c: [1, 1, 0.9], e: 1 });
  },
  { glow: 3, worldSize: 0.5 },
);

registerMaterial("skin.wizard", (p) => {
  // Weathered hands: warm skin, pores, knuckle creases, bluish veins.
  const s = p.size;
  const n = fbm(p, 4, 3, 381);
  const v = veins(p, 2, 1, 382);
  for (let i = 0; i < n.length; i++) p.height[i] = 0.5 + (n[i] - 0.5) * 0.05 + v[i] * 0.06;
  for (let k = 0; k < 8; k++) {
    const x = p.rng.int(0, s - 1);
    const y = p.rng.int(0, s - 1);
    const len = p.rng.int(3, 6);
    for (let t = 0; t < len; t++) p.height[p.idx(x + t, y + (t % 3 === 2 ? 1 : 0))] -= 0.08;
  }
  const light = lightField(p, 1.3);
  const tone = field(p);
  for (let i = 0; i < n.length; i++) tone[i] = 0.6 + (n[i] - 0.5) * 0.16 + light[i];
  paintTone(p, ramp("#3a2016", "#65392a", "#8e5a44", "#b07a60", "#cc9a7e", "#e2baa0"), tone, 0.3);
  for (let i = 0; i < n.length; i++) if (v[i] > 0.4) p.mix(i, hex("#6a6a8a"), v[i] * 0.3);
  speckle(p, { density: 0.03, color: hex("#6a3a2a"), amount: 0.25, h: -0.03 });
  roughFrom(p, 0.55, n, 0.08);
});

registerMaterial(
  "coin.gold",
  (p) => {
    // A Kneel crown-piece: raised rim, bead ring, and the Godwell struck in
    // the field — a sunken pit ringed by a raised lip and eight rays.
    const s = p.size;
    const c = s / 2;
    const n = fbm(p, 4, 2, 391);
    for (let y = 0; y < s; y++)
      for (let x = 0; x < s; x++) {
        const i = y * s + x;
        const dx = x + 0.5 - c;
        const dy = y + 0.5 - c;
        const r = Math.hypot(dx, dy);
        const a = Math.atan2(dy, dx);
        let h: number;
        if (r > 30.5) h = 0.62;
        else if (r > 27) h = 0.82 - Math.abs(r - 28.8) * 0.07;
        else if (r > 23.5 && r < 25.5 && (Math.round(a * (16 / Math.PI)) & 1) === 0) h = 0.68;
        else if (r < 5) h = 0.34 + r * 0.02;
        else if (r < 8) h = 0.72 - Math.abs(r - 6.5) * 0.08;
        else if (r > 10 && r < 19 && Math.abs(Math.sin(a * 4)) < 0.16 + (19 - r) * 0.012) h = 0.7;
        else h = 0.48;
        p.height[i] = h + (n[i] - 0.5) * 0.02;
      }
    const light = lightField(p, 2.4);
    const tone = field(p);
    for (let i = 0; i < n.length; i++) tone[i] = 0.52 + light[i] + (n[i] - 0.5) * 0.15 + (p.height[i] > 0.65 ? 0.14 : 0);
    paintTone(p, GOLD, tone, 0.3);
    for (let i = 0; i < n.length; i++) {
      p.metal[i] = 1;
      p.rough[i] = p.height[i] > 0.6 ? 0.22 : 0.36;
      if (p.height[i] < 0.42) p.shade(i, 0.7);
    }
  },
  { normal: 2.5, worldSize: 0.1 },
);

// ─── Rope, web, grate ───────────────────────────────────────────────────────

registerMaterial("rope", (p) => {
  // Three-strand lay running along u: diagonal strands with dark grooves.
  const s = p.size;
  const fib = fbmXY(p, 16, 4, 2, 401);
  const tone = field(p);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      const ph = ((x + y * 0.75) / 8) % 1;
      const strand = Math.sin(ph * Math.PI);
      tone[i] = 0.15 + strand * 0.65 + (fib[i] - 0.5) * 0.3;
      p.height[i] = 0.2 + strand * 0.6;
      if (((x * 3 + y) >> 1) % 5 === 0) tone[i] += 0.08;
    }
  paintTone(p, ramp("#1c150c", "#3a2c18", "#5c4626", "#7c6236", "#9a7e4a", "#b89c64"), tone, 0.35);
  roughFrom(p, 0.95);
});

registerMaterial(
  "web",
  (p) => {
    // A torn net: cell outlines of a coarse Voronoi plus sagging cross
    // threads, with dusty clumps where threads meet.
    const s = p.size;
    p.alpha.fill(0);
    p.fill(hex("#c8c8c0"), 0.5, 0.6);
    const c = cellular(p, 3, 411, 0.95);
    const n = fbm(p, 8, 2, 412);
    for (let i = 0; i < n.length; i++) {
      if (c.f2[i] - c.f1[i] < 0.9 && n[i] > 0.18) {
        p.alpha[i] = 1;
        p.setColor(i, rampColor(ramp("#6a6a66", "#9a9a94", "#d8d8d0", "#f4f4ee"), 0.5 + (n[i] - 0.5), i % s, (i / s) | 0));
      }
    }
    // Radial-ish threads from each cell centre toward its edge.
    for (let k = 0; k < c.px.length; k++) {
      for (let a = 0; a < 5; a++) {
        const ang = (a / 5) * Math.PI * 2 + k;
        p.line(c.px[k], c.py[k], c.px[k] + Math.cos(ang) * 14, c.py[k] + Math.sin(ang) * 14, (i) => {
          if (n[i] > 0.3) {
            p.alpha[i] = 1;
            p.setColor(i, hex("#b8b8b0"));
          }
        });
      }
    }
    for (let i = 0; i < n.length; i++) if (p.alpha[i] > 0 && n[i] > 0.85) p.setColor(i, hex("#8a8478"));
  },
  { cutout: true, worldSize: 1.5 },
);

registerMaterial(
  "grate",
  (p) => {
    const s = p.size;
    p.alpha.fill(0);
    const n = fbm(p, 8, 3, 421);
    const bar = (i: number, t: number) => {
      p.alpha[i] = 1;
      const rusty = n[i] > 0.62;
      p.setColor(i, rampColor(rusty ? RUST : IRON, t + (n[i] - 0.5) * 0.3, i % s, (i / s) | 0, 0.4));
      p.metal[i] = rusty ? 0.2 : 1;
      p.rough[i] = rusty ? 0.85 : 0.5;
    };
    // Flat horizontal straps behind, round vertical bars in front.
    for (let y = 0; y < s; y++)
      for (let x = 0; x < s; x++) {
        const i = y * s + x;
        const ly = y % 16;
        const lx = x % 16;
        if (ly >= 6 && ly <= 9) {
          bar(i, ly === 6 ? 0.8 : ly === 9 ? 0.2 : 0.5);
          p.height[i] = 0.5;
        }
        if (lx >= 6 && lx <= 9) {
          bar(i, [0.75, 0.95, 0.5, 0.25][lx - 6]);
          p.height[i] = [0.7, 0.85, 0.8, 0.65][lx - 6];
        }
      }
    for (let y = 7.5; y < s; y += 16) for (let x = 7.5; x < s; x += 16) rivet(p, x + 0.5, y + 0.5, 1.5, { ramp: IRON, h: 0.1 });
  },
  { cutout: true, worldSize: 1 },
);

// ─── Ground ─────────────────────────────────────────────────────────────────

export const SOIL = ramp("#130d09", "#231911", "#352619", "#493522", "#5e462e", "#77593b");

/** Packed earth with pebbles and root threads. */
export function paintDirt(p: Paint, o: { ramp?: Ramp; pebbles?: number; roots?: number; salt?: number } = {}): void {
  const s = p.size;
  const salt = o.salt ?? 0;
  const n = fbm(p, 4, 4, 431 + salt);
  const g = grainNoise(p, 432 + salt);
  for (let i = 0; i < n.length; i++) p.height[i] = 0.45 + (n[i] - 0.5) * 0.2 + (g[i] - 0.5) * 0.05;
  // Pebbles of varied size, scattered (not on a lattice).
  const pebMask = new Uint8Array(n.length);
  const pebTone = field(p);
  const count = Math.round((o.pebbles ?? 0.4) * 50);
  for (let k = 0; k < count; k++) {
    const r = p.rng.chance(0.2) ? p.rng.range(1.6, 2.6) : p.rng.range(0.7, 1.5);
    const tint = p.rng.next();
    p.disc(p.rng.range(0, s), p.rng.range(0, s), r, (i, d) => {
      pebMask[i] = 1;
      pebTone[i] = tint;
      p.height[i] += (1 - d * d) * 0.14;
    });
  }
  const light = lightField(p, 1.4);
  const tone = field(p);
  for (let i = 0; i < n.length; i++) tone[i] = 0.45 + (n[i] - 0.5) * 0.45 + light[i] + (g[i] - 0.5) * 0.2;
  paintTone(p, o.ramp ?? SOIL, tone, 0.45);
  const PEB = ramp("#2a2622", "#4a4440", "#6e6760", "#958d84");
  for (let i = 0; i < n.length; i++) if (pebMask[i]) p.setColor(i, rampColor(PEB, 0.3 + light[i] * 1.5 + pebTone[i] * 0.35, i % s, (i / s) | 0));
  for (let k = 0; k < (o.roots ?? 3); k++) {
    let x = p.rng.range(0, s);
    let y = p.rng.range(0, s);
    let a = p.rng.range(0, Math.PI * 2);
    const len = p.rng.int(8, 20);
    for (let t = 0; t < len; t++) {
      p.set(x, y, { c: hex("#5a4230") });
      p.set(x + 1, y + 1, { c: hex("#1a120c") });
      a += p.rng.gauss() * 0.6;
      x += Math.cos(a);
      y += Math.sin(a);
    }
  }
  roughFrom(p, 0.95);
}

registerMaterial("dirt", (p) => paintDirt(p));

export const GRASS = ramp("#0b1606", "#16290b", "#223f10", "#325716", "#46711e", "#5f8c28", "#80a838");

/** Grass: dense blades over dark soil; each blade darker at the root. */
export function paintGrass(p: Paint, o: { ramp?: Ramp; density?: number; flowers?: number; salt?: number } = {}): void {
  const s = p.size;
  const r = o.ramp ?? GRASS;
  const clump = fbm(p, 5, 3, 441 + (o.salt ?? 0));
  p.fill(hex("#10120a"), 0.25, 0.95);
  const tone = field(p, -1);
  const blades = Math.round((o.density ?? 1) * 1100);
  for (let k = 0; k < blades; k++) {
    const x = p.rng.range(0, s);
    const y = p.rng.range(0, s);
    const len = p.rng.int(3, 7);
    const lean = p.rng.range(-0.5, 0.5);
    const base = clump[p.idx(x, y)] * 0.5;
    for (let t = 0; t < len; t++) {
      const i = p.idx(x + lean * t, y - t);
      const v = base + (t / len) * 0.5;
      if (v > tone[i]) {
        tone[i] = v;
        p.height[i] = 0.3 + (t / len) * 0.5;
      }
    }
  }
  paintTone(p, r, tone, 0.4, (i) => tone[i] >= 0);
  for (let k = 0; k < Math.round((o.flowers ?? 0) * 12); k++) {
    const x = p.rng.int(0, s - 1);
    const y = p.rng.int(0, s - 1);
    const c = p.rng.chance(0.5) ? hex("#e8e0a0") : hex("#c8c8e8");
    p.set(x, y, { c, h: 0.8 });
    p.set(x + 1, y, { c: scale(c, 0.7), h: 0.75 });
  }
}

function scale(c: RGB, k: number): RGB {
  return [c[0] * k, c[1] * k, c[2] * k];
}

registerMaterial("grass", (p) => paintGrass(p, { flowers: 0.3 }));

registerMaterial("mud", (p) => {
  const s = p.size;
  const n = fbm(p, 3, 4, 451);
  const g = grainNoise(p, 452);
  for (let i = 0; i < n.length; i++) p.height[i] = 0.5 + (n[i] - 0.5) * 0.35;
  // Boot prints pressed into it.
  for (let k = 0; k < 2; k++) {
    const x = p.rng.range(0, s);
    const y = p.rng.range(0, s);
    p.disc(x, y, 3, (i, d) => (p.height[i] -= (1 - d) * 0.15));
    p.disc(x + 1, y + 6, 2.2, (i, d) => (p.height[i] -= (1 - d) * 0.15));
  }
  const light = lightField(p, 1.8);
  const tone = field(p);
  for (let i = 0; i < n.length; i++) tone[i] = 0.45 + (n[i] - 0.5) * 0.35 + light[i] + (g[i] - 0.5) * 0.1;
  paintTone(p, ramp("#140e09", "#261a10", "#382818", "#4b3622", "#5f462e", "#76593c"), tone, 0.35);
  roughFrom(p, 0.55, n, 0.15);
  puddles(p, { coverage: 0.22, rough: 0.08, darken: 0.25, tint: hex("#2a2418") });
});

registerMaterial("gravel", (p) => {
  const L = cobbles(p, { freq: 10, gap: 1.2, jitter: 1 });
  relief(p, L, { joint: 0.15, face: 0.65, vary: 0.15, bevel: 2, curve: 0.6 });
  const light = lightField(p, 1.8);
  const n = grainNoise(p, 461);
  const tone = field(p);
  for (let i = 0; i < n.length; i++) tone[i] = L.id[i] < 0 ? 0.05 : 0.45 + (L.rnd(L.id[i]) - 0.5) * 0.5 + light[i] + (n[i] - 0.5) * 0.1;
  const R = [STONE_GREY, STONE_WARM, ramp("#221a14", "#43362a", "#665442", "#8a765e", "#ad987c")];
  paintTone(p, (i) => (L.id[i] < 0 ? SOIL : R[Math.floor(L.rnd(L.id[i], 2) * R.length)]), tone, 0.3);
  roughFrom(p, 0.85);
});

// ─── Masonry (shared by every biome's walls and floors) ─────────────────────

export interface MasonryOpts {
  /** Ramps picked per block (hue variety); mortar ramp for joints. */
  ramps: Ramp[];
  mortar: Ramp;
  /** Edge chipping amount 0..1. */
  chip?: number;
  /** Per-block tone spread. */
  tint?: number;
  /** Surface noise amplitude and lattice frequency. */
  noise?: number;
  freq?: number;
  /** Pockmarks per texture. */
  pits?: number;
  light?: number;
  bevel?: number;
  rough?: number;
  salt?: number;
}

/** Stone blocks on a layout: bevelled faces with per-block ramp and tint,
 * chipped corners exposing paler broken stone, recessed uneven mortar,
 * pits. Returns the chip mask. */
export function paintMasonry(p: Paint, L: Layout, o: MasonryOpts): Uint8Array {
  const salt = o.salt ?? 0;
  relief(p, L, { joint: 0.14, face: 0.66, vary: 0.05, bevel: o.bevel ?? 1.6, curve: 0.7 });
  const chips = chipEdges(p, L, { amount: o.chip ?? 0.3, depth: 0.16, salt });
  const n = fbm(p, o.freq ?? 8, 3, 501 + salt);
  const g = grainNoise(p, 502 + salt);
  for (let i = 0; i < n.length; i++) {
    if (L.id[i] < 0) p.height[i] = 0.1 + n[i] * 0.12 + g[i] * 0.03;
    else p.height[i] += (n[i] - 0.5) * 0.1 + (g[i] - 0.5) * 0.02;
  }
  if (o.pits) dents(p, { count: o.pits, r: [0.6, 1.4], depth: 0.1 });
  const light = lightField(p, o.light ?? 1.2);
  const tone = field(p);
  const tint = o.tint ?? 0.2;
  const amp = o.noise ?? 0.3;
  for (let i = 0; i < n.length; i++) {
    const c = L.id[i];
    if (c < 0) {
      tone[i] = 0.3 + (n[i] - 0.5) * 0.5 + (g[i] - 0.5) * 0.2;
      continue;
    }
    tone[i] = 0.5 + (L.rnd(c) - 0.5) * tint * 2 + (n[i] - 0.5) * amp + (g[i] - 0.5) * 0.1 + light[i] + (chips[i] ? 0.1 : 0);
  }
  const R = o.ramps;
  paintTone(p, (i) => (L.id[i] < 0 ? o.mortar : R[Math.floor(L.rnd(L.id[i], 3) * R.length)]), tone, 0.3);
  const rough = o.rough ?? 0.86;
  for (let i = 0; i < n.length; i++) p.rough[i] = L.id[i] < 0 ? 0.96 : chips[i] ? 0.95 : clamp01(rough + (n[i] - 0.5) * 0.12);
  return chips;
}

/** Iron ring pull hanging from a square back-plate (doors, chests,
 * trapdoors). The ring hangs below (cx, cy). */
export function rivetRing(p: Paint, cx: number, cy: number, r: number): void {
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) {
      const edge = Math.abs(dx) === 2 || Math.abs(dy) === 2;
      p.set(cx + dx, cy + dy, { c: IRON[edge ? 2 : 4 - ((dx + dy) > 0 ? 1 : 0)], h: 0.75, m: 1, r: 0.5 });
    }
  const ry = cy + r;
  for (let t = 0; t < 64; t++) {
    const a = (t / 64) * Math.PI * 2;
    const x = cx + Math.cos(a) * r;
    const y = ry + Math.sin(a) * r;
    const lit = Math.cos(a + 2.3) > 0.2;
    p.set(x, y, { c: IRON[lit ? 6 : 3], h: 0.85, m: 1, r: 0.4 });
    p.set(x + 1, y + 1, { c: hex("#0a0908") });
  }
}
