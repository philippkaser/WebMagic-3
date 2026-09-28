import {
  bricks,
  cellular,
  clamp01,
  cracks,
  drips,
  fbm,
  fbmXY,
  field,
  grainNoise,
  lightField,
  moss,
  nail,
  paintTone,
  puddles,
  ramp,
  rampColor,
  relief,
  roughFrom,
  slabs,
  smooth,
  speckle,
  weave,
  woodGrain,
  type Ramp,
} from "../brushes";
import { registerMaterial } from "../library";
import { hex, type Paint } from "../paint";
import {
  SOIL,
  STONE_GREY,
  STONE_WARM,
  WOOD_DARK,
  WOOD_GREY,
  WOOD_MID,
  ironBand,
  paintBoards,
  paintCobbles,
  paintDirt,
  paintGrass,
  paintMasonry,
  rivetRing,
} from "./common";

/** Kneel, the village on the rim: fog-damp stone, lime plaster, dark
 * timber, moss on everything, and the Colossus over it all. Colours are
 * muted and cool; only lit windows are warm. */

export const PLASTER = ramp("#4e4a40", "#716b5e", "#948d7c", "#b3ab98", "#cbc4b0", "#dfd9c6");
const VILLAGE_MOSS = ramp("#101a0c", "#1c2c12", "#2a3e18", "#3b5220", "#4e662a");

registerMaterial("village.cobble", (p) => {
  const L = paintCobbles(p, [STONE_GREY, STONE_WARM, ramp("#161a1c", "#2a3032", "#40484a", "#586062", "#72797a", "#8e9494")], {
    freq: 6,
    gap: 1.6,
    joint: SOIL,
  });
  moss(p, { ramp: VILLAGE_MOSS, coverage: 0.1, crevice: 2, freq: 8, mask: (i) => L.edge[i] < 1.5 });
  puddles(p, { coverage: 0.06, rough: 0.08, darken: 0.3, tint: hex("#1a2026") });
});

registerMaterial("village.dirt_path", (p) => {
  // Cart track: two wheel ruts holding rainwater, hoof and boot prints,
  // pebbles pressed into the mud.
  const s = p.size;
  paintDirt(p, { ramp: ramp("#16110c", "#281e15", "#3b2d1f", "#4f3d2a", "#654f37", "#7c6446"), pebbles: 0.5, roots: 0 });
  const wob = fbmXY(p, 1, 3, 2, 1601);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      for (const rx of [14, 46]) {
        const d = Math.abs(x + 0.5 - rx - (wob[i] - 0.5) * 6);
        if (d < 3) {
          p.height[i] -= (1 - d / 3) * 0.2;
          p.shade(i, 0.85 + d * 0.04);
        }
      }
    }
  for (let k = 0; k < 5; k++) {
    const x = p.rng.range(20, 40);
    const y = p.rng.range(0, s);
    p.disc(x, y, 1.8, (i, d) => (p.height[i] -= (1 - d) * 0.1));
  }
  puddles(p, { coverage: 0.08, rough: 0.06, darken: 0.3, tint: hex("#28302e") });
});

registerMaterial("village.grass", (p) => {
  paintGrass(p, { ramp: ramp("#0a1408", "#14240e", "#1f3614", "#2c4a1a", "#3c5e22", "#4f722a", "#688a36"), flowers: 0.5, density: 1.1 });
  // Clover patches and a bare, trodden spot.
  const n = fbm(p, 3, 2, 1611);
  for (let i = 0; i < n.length; i++) if (n[i] < 0.12) p.mix(i, SOIL[3], 0.5);
});

/** Lime plaster: soft mottle, hairline cracks, whitewash worn off to the
 * grey render in patches, rain streaks and green damp. */
export function paintPlaster(p: Paint, r: Ramp = PLASTER, salt = 0): void {
  const n = fbm(p, 4, 3, 1621 + salt);
  const g = grainNoise(p, 1622 + salt);
  const worn = fbm(p, 3, 3, 1623 + salt);
  for (let i = 0; i < n.length; i++) p.height[i] = 0.55 + (n[i] - 0.5) * 0.08 + (g[i] - 0.5) * 0.03 - (worn[i] > 0.7 ? 0.04 : 0);
  const light = lightField(p, 1.5);
  const tone = field(p);
  for (let i = 0; i < n.length; i++) tone[i] = 0.64 + (n[i] - 0.5) * 0.16 + light[i] + (g[i] - 0.5) * 0.06 - (worn[i] > 0.7 ? 0.2 : 0);
  paintTone(p, r, tone, 0.3);
  cracks(p, { count: 4, length: [6, 18], depth: 0.1, wander: 0.6 });
  const streak = fbmXY(p, 12, 1, 2, 1624 + salt);
  for (let i = 0; i < n.length; i++) {
    if (streak[i] > 0.7) p.mix(i, hex("#5a5646"), (streak[i] - 0.7) * 0.8);
    if (worn[i] < 0.18) p.mix(i, hex("#4a5a3a"), (0.18 - worn[i]) * 1.5);
  }
  roughFrom(p, 0.92, n, 0.03);
}

registerMaterial("village.plaster", (p) => paintPlaster(p));

registerMaterial("village.timber", (p) => {
  // Tarred oak framing: dark, heavily checked, pinned with wooden pegs.
  const s = p.size;
  const g = woodGrain(p, { rings: 8, warp: 5, knots: 2, salt: 3 });
  const n = fbm(p, 4, 3, 1631);
  for (let i = 0; i < n.length; i++) p.height[i] = 0.55 + (g.tone[i] - 0.5) * 0.08 - g.line[i] * 0.06 - g.knot[i] * 0.1;
  const ck = cracks(p, { count: 4, length: [20, 50], angle: 0, wander: 0.05, branch: 0, depth: 0.3, lip: 0.1 });
  const light = lightField(p, 1.3);
  const tone = field(p);
  for (let i = 0; i < n.length; i++) tone[i] = 0.5 + (g.tone[i] - 0.5) * 0.6 - g.line[i] * 0.22 + light[i] + (n[i] - 0.5) * 0.15 - (g.knot[i] > 0.15 ? 0.35 : 0);
  paintTone(p, WOOD_DARK, tone, 0.3);
  for (let i = 0; i < n.length; i++) if (ck[i]) p.setColor(i, WOOD_DARK[0]);
  for (const [x, y] of [
    [12, 30],
    [44, 34],
  ])
    p.disc(x, y, 2, (i, d) => {
      p.setColor(i, rampColor(WOOD_MID, 0.7 - d * 0.4, i % s, (i / s) | 0));
      p.height[i] = 0.6 - d * 0.05;
    });
  roughFrom(p, 0.8, n, 0.06);
});

registerMaterial("village.shingle", (p) => {
  // Split-oak shakes in overlapping courses: each shake shadowed where the
  // course above covers it, lit along its free lower edge, some mossed.
  const L = bricks(p, { rows: 8, minW: 6, maxW: 11, mortar: 1 });
  const g = woodGrain(p, { vertical: true, rings: 22, knots: 0, salt: 5 });
  const tone = field(p);
  for (let i = 0; i < L.id.length; i++) {
    const c = L.id[i];
    if (c < 0) {
      p.height[i] = 0.15;
      tone[i] = 0;
      continue;
    }
    const r = L.rects[c];
    const v = L.ly[i] / Math.max(1, r.h - 2);
    p.height[i] = 0.3 + v * 0.45;
    tone[i] = 0.2 + v * 0.55 + (L.rnd(c) - 0.5) * 0.2 + (g.tone[i] - 0.5) * 0.25 - g.line[i] * 0.12 + (v > 0.95 ? 0.1 : 0);
  }
  paintTone(p, (i) => (L.id[i] >= 0 && L.rnd(L.id[i], 2) < 0.3 ? WOOD_GREY : ramp("#140e0a", "#261a12", "#3a281a", "#4e3824", "#634a30", "#7a5e40")), tone, 0.3);
  roughFrom(p, 0.9);
  moss(p, { ramp: VILLAGE_MOSS, coverage: 0.12, crevice: 1, freq: 6 });
});

registerMaterial("village.thatch", (p) => {
  // Reed thatch laid in courses: each course is a fringe of straws, lit
  // and golden where it lies on top, grey and shadowed where the next
  // course covers it; ragged butt-ends mark the bottom of every course.
  const s = p.size;
  const strands = fbmXY(p, 32, 2, 2, 1641);
  const fine = grainNoise(p, 1642);
  const clump = fbm(p, 4, 3, 1643);
  const ends = fbmXY(p, 16, 1, 2, 1644);
  const tone = field(p);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      // Course position, with a ragged lower edge per strand bundle.
      const rag = (ends[i] - 0.5) * 5;
      const c = ((((y - rag) % 16) + 16) % 16) / 16;
      const strand = strands[i] * 0.55 + fine[i] * 0.2;
      tone[i] = 0.18 + c * 0.45 + strand * 0.45 + (clump[i] - 0.5) * 0.2 - (c > 0.93 ? 0.35 : 0);
      p.height[i] = 0.3 + c * 0.45 + strand * 0.12;
    }
  const STRAW = ramp("#1e160c", "#382a16", "#554022", "#72582e", "#8c7040", "#a68a54", "#c0a46c");
  paintTone(p, STRAW, tone, 0.35);
  roughFrom(p, 0.95);
  // Weathering: the exposed straw greys, moss takes the damp hollows.
  for (let i = 0; i < tone.length; i++) if (clump[i] > 0.65) p.mix(i, hex("#6a6a5e"), (clump[i] - 0.65) * 1.2);
  moss(p, { ramp: VILLAGE_MOSS, coverage: 0.06, crevice: 1.2, freq: 5 });
});

registerMaterial(
  "village.colossus_stone",
  (p) => {
    // The Colossus: vast weathered grey stone. At 6 m per repeat the joints
    // are faint and far apart; rain has cut dark streaks down it, lichen
    // rosettes crust it yellow-green and orange, frost has split it.
    const L = slabs(p, { min: 30, max: 40, gap: 1, warp: 2 });
    relief(p, L, { joint: 0.35, face: 0.6, vary: 0.04, bevel: 3, curve: 0.5 });
    const n = fbm(p, 4, 4, 1651);
    const g = grainNoise(p, 1652);
    for (let i = 0; i < n.length; i++) p.height[i] += (n[i] - 0.5) * 0.25 + (g[i] - 0.5) * 0.04;
    const rain = fbmXY(p, 14, 1, 3, 1653);
    for (let i = 0; i < n.length; i++) p.height[i] -= smooth(0.6, 0.9, rain[i]) * 0.06;
    const light = lightField(p, 1.3);
    const tone = field(p);
    for (let i = 0; i < n.length; i++) tone[i] = 0.52 + (n[i] - 0.5) * 0.3 + light[i] + (g[i] - 0.5) * 0.1 - smooth(0.55, 0.9, rain[i]) * 0.25;
    paintTone(p, ramp("#16171a", "#2a2b2e", "#404145", "#57585b", "#6f6f71", "#8a8a8a", "#a4a3a0"), tone, 0.35);
    cracks(p, { count: 4, length: [14, 36], depth: 0.25, wander: 0.3, branch: 0.05 });
    // Lichen rosettes: rings of crust with a paler rim.
    const c = cellular(p, 7, 1654, 1);
    for (let i = 0; i < n.length; i++) {
      const pick = ((c.id[i] * 2654435761) >>> 0) / 4294967296;
      if (pick > 0.5) continue;
      const r = 2 + pick * 5;
      const d = c.f1[i] + (g[i] - 0.5) * 1.5;
      if (d > r) continue;
      const col = pick < 0.18 ? hex("#b8862a") : pick < 0.4 ? hex("#8a9a50") : hex("#c8c8b0");
      p.mix(i, col, d > r - 1 ? 0.75 : 0.5);
      p.rough[i] = 0.98;
      p.height[i] += 0.02;
    }
    roughFrom(p, 0.9, n, 0.04);
    for (let i = 0; i < n.length; i++) if (rain[i] > 0.8) p.rough[i] = 0.55;
  },
  { worldSize: 6, normal: 2.5 },
);

registerMaterial(
  "village.window_lit",
  (p) => {
    // A leaded casement glowing with hearth light: diamond quarries of
    // bullseye glass in lead came, a timber mullion and transom, a sill.
    const s = p.size;
    const n = fbm(p, 6, 2, 1661);
    const G = ramp("#6a2a08", "#a8500e", "#e08a24", "#ffc050", "#ffe49a", "#fff6d8");
    for (let y = 0; y < s; y++)
      for (let x = 0; x < s; x++) {
        const i = y * s + x;
        const frame = x < 5 || x >= 59 || y < 5 || y >= 57;
        const mullion = Math.abs(x - 31.5) < 2 || Math.abs(y - 26.5) < 1.5;
        if (frame || mullion) {
          const edge = frame ? (x === 4 || x === 59 || y === 4 || y === 57) : false;
          p.setColor(i, rampColor(WOOD_DARK, 0.5 + (n[i] - 0.5) * 0.3 + (edge ? -0.3 : 0) + (y >= 57 && y < 60 ? 0.2 : 0), x, y));
          p.height[i] = frame ? 0.85 : 0.75;
          p.rough[i] = 0.8;
          p.emit[i] = 0;
          continue;
        }
        const u = x + y;
        const v = x - y + 64;
        const lead = u % 8 === 0 || v % 8 === 0;
        if (lead) {
          p.setColor(i, hex("#1a1a1c"));
          p.height[i] = 0.62;
          p.metal[i] = 0.5;
          p.rough[i] = 0.5;
          p.emit[i] = 0;
          continue;
        }
        // Bullseye: each quarry brighter at its heart.
        const cu = (u % 8) - 4;
        const cv = (v % 8) - 4;
        const d = Math.hypot(cu, cv) / 4;
        const pane = ((Math.floor(u / 8) * 7 + Math.floor(v / 8) * 13) % 5) / 5;
        p.setColor(i, rampColor(G, 0.85 - d * 0.4 + (pane - 0.5) * 0.2 + (n[i] - 0.5) * 0.15, x, y, 0.5));
        p.height[i] = 0.5;
        p.rough[i] = 0.1;
        p.emit[i] = 0.75 + (1 - d) * 0.25;
      }
  },
  { glow: 2.5, worldSize: 1.5 },
);

registerMaterial("village.door", (p) => {
  // Plank door: vertical boards, two strap hinges, clench-nail studs and
  // an iron ring pull.
  const s = p.size;
  paintBoards(p, { ramps: [WOOD_MID, WOOD_DARK], boards: 5, minLen: 64, maxLen: 64, vertical: true, nails: "none", rings: 12, gapTone: 0.02 });
  ironBand(p, 9, 4, 12, 0.25);
  ironBand(p, 49, 4, 12, 0.25);
  for (let y = 22; y < 44; y += 7) for (let x = 6; x < s; x += 13) nail(p, x, y, { big: true });
  rivetRing(p, 50, 32, 4);
});

registerMaterial(
  "village.fence",
  (p) => {
    // Picket fence: weathered pointed pales nailed to two rails behind.
    const s = p.size;
    p.alpha.fill(0);
    const g = woodGrain(p, { vertical: true, rings: 10, knots: 0, salt: 9 });
    const n = fbm(p, 6, 2, 1671);
    const paint = (i: number, t: number, h: number) => {
      p.alpha[i] = 1;
      p.setColor(i, rampColor(WOOD_GREY, t + (g.tone[i] - 0.5) * 0.3 - g.line[i] * 0.15 + (n[i] - 0.5) * 0.15, i % s, (i / s) | 0, 0.3));
      p.height[i] = h;
      p.rough[i] = 0.92;
    };
    for (let y = 0; y < s; y++)
      for (let x = 0; x < s; x++) {
        const i = y * s + x;
        if ((y >= 16 && y < 21) || (y >= 44 && y < 49)) paint(i, 0.35 + (y === 16 || y === 44 ? 0.2 : 0), 0.4);
      }
    for (let k = 0; k < 6; k++) {
      const x0 = Math.round(k * (s / 6)) + 2;
      const w = 7;
      const top = 1 + p.rng.int(0, 2);
      for (let y = top; y < s; y++)
        for (let x = 0; x < w; x++) {
          const tip = y - top < 4 && Math.abs(x - (w - 1) / 2) > (y - top) * 0.9 + 0.2;
          if (tip) continue;
          const i = p.idx(x0 + x, y);
          paint(i, 0.55 + (x === 0 ? 0.2 : x === w - 1 ? -0.25 : 0), 0.7);
        }
      for (const y of [18, 46]) nail(p, x0 + 3, y, { dark: [0.1, 0.08, 0.07], light: [0.4, 0.38, 0.35] });
    }
  },
  { cutout: true },
);

registerMaterial("village.well_stone", (p) => {
  // Rubble-built well wall: rounded field stones, fat mortar, moss and a
  // dark, damp sheen.
  const L = bricks(p, { rows: 5, minW: 10, maxW: 20, warp: 1.8, mortar: 2 });
  paintMasonry(p, L, { ramps: [STONE_GREY, STONE_WARM], mortar: ramp("#1a1814", "#2e2a24", "#443e36", "#5a5248"), chip: 0.2, bevel: 3.5, tint: 0.2, noise: 0.25 });
  moss(p, { ramp: VILLAGE_MOSS, coverage: 0.12, crevice: 1.5, bottom: 0.4, freq: 7 });
  drips(p, { count: 5, color: hex("#1a1c18"), strength: 0.3, minLen: 6, maxLen: 16, wet: 0.3 });
});

registerMaterial("village.market_cloth", (p) => {
  // Striped awning canvas: faded madder red and cream, sagging between
  // the poles, rain-stained along the folds.
  const s = p.size;
  const tone = weave(p, { cell: 2, salt: 3, slub: 0.3 });
  const sag = fbmXY(p, 2, 1, 2, 1681);
  const stain = fbm(p, 4, 3, 1682);
  const RED = ramp("#2a0c0a", "#4e1814", "#72261e", "#94382a", "#b04e3a");
  const CREAM = ramp("#5a5040", "#857a62", "#ab9f84", "#c8bea2", "#ded6be");
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      const fold = Math.sin((x / s) * Math.PI * 2 * 2 + sag[i] * 2);
      tone[i] = clamp01(tone[i] * 0.6 + 0.25 + fold * 0.15);
      p.height[i] += fold * 0.1;
    }
  paintTone(p, (i) => (((i % s) >> 3) & 1 ? CREAM : RED), tone, 0.3);
  for (let i = 0; i < tone.length; i++) if (stain[i] > 0.68) p.mix(i, hex("#4a3a24"), (stain[i] - 0.68) * 1.2);
  roughFrom(p, 0.95);
  speckle(p, { density: 0.01, color: hex("#2a2418"), amount: 0.5 });
});
