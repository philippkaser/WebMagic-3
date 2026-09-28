import {
  clamp01,
  cracks,
  dents,
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
  smooth,
  speckle,
  veins,
  type Ramp,
} from "../brushes";
import { registerMaterial } from "../library";
import { hex, type Paint } from "../paint";
import { FUNGUS_CAP, SOIL, SPORE_GLOW, glowSpots } from "./common";

/** Stratum 3 — the Mycelial Choir: singing fungal caverns of a people who
 * dissolved into one mind. Natural rock (no masonry), threads of mycelium
 * over everything, and cold bioluminescence. */

export const CAVE = ramp("#100e13", "#1e1b23", "#2e2a35", "#403a48", "#554e5e", "#6d6576");
const MYCELIUM = ramp("#6a6458", "#958d7c", "#bdb4a0", "#dcd4c0", "#f0ead8");
/** Shelf-fungus flesh: tan to pale cream at the growing rim. */
const BRACKET = ramp("#24160e", "#442a16", "#684220", "#8c5e30", "#b08246", "#d0a868", "#ead0a0");
const BARK = ramp("#120c08", "#231710", "#35231a", "#4a3224", "#604330", "#7a563e");

/** Natural cave rock: sediment strata bent by pressure, fracture lines,
 * solution pits and wet streaks. Writes all channels. */
export function paintCaveRock(p: Paint, r: Ramp = CAVE, salt = 0): void {
  const s = p.size;
  const warp = fbm(p, 2, 3, 901 + salt);
  const n = fbm(p, 6, 4, 902 + salt);
  const g = grainNoise(p, 903 + salt);
  const ph = field(p);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      ph[i] = (y / s) * 5 + (warp[i] - 0.5) * 2.2;
    }
  const strata = isoLines(p, ph, 1.2);
  for (let i = 0; i < n.length; i++) {
    const band = ph[i] - Math.floor(ph[i]);
    // Each layer weathers differently: hard bands stand proud.
    const hard = Math.sin(Math.floor(ph[i]) * 12.9898) > 0 ? 1 : 0;
    p.height[i] = 0.5 + (n[i] - 0.5) * 0.35 + hard * 0.06 - strata[i] * 0.12 + (band < 0.3 ? -0.03 : 0);
  }
  dents(p, { count: 16, r: [0.8, 2.2], depth: 0.12 });
  const light = lightField(p, 1.5);
  const tone = field(p);
  for (let i = 0; i < n.length; i++) {
    const layer = Math.floor(ph[i]);
    const lt = ((Math.sin(layer * 78.233) * 43758.5453) % 1 + 1) % 1;
    tone[i] = 0.5 + (lt - 0.5) * 0.18 + (n[i] - 0.5) * 0.3 + light[i] + (g[i] - 0.5) * 0.12 - strata[i] * 0.2;
  }
  paintTone(p, r, tone, 0.35);
  cracks(p, { count: 3, length: [10, 26], depth: 0.2, wander: 0.4 });
  roughFrom(p, 0.85, n, 0.08);
  // Seep streaks: glossy dark runs down the face.
  const seep = fbmXY(p, 10, 1, 2, 904 + salt);
  for (let i = 0; i < n.length; i++)
    if (seep[i] > 0.75) {
      p.rough[i] = 0.3;
      p.shade(i, 0.82);
    }
}

registerMaterial("cave.rock", (p) => paintCaveRock(p));

registerMaterial(
  "cave.mycelium_floor",
  (p) => {
    // Dark humus webbed with pale mycelium, tiny mushroom caps pushing up,
    // a few of them glowing.
    const s = p.size;
    const n = fbm(p, 4, 3, 911);
    const g = grainNoise(p, 912);
    for (let i = 0; i < n.length; i++) p.height[i] = 0.4 + (n[i] - 0.5) * 0.2;
    const tone = field(p);
    const light = lightField(p, 1.4);
    for (let i = 0; i < n.length; i++) tone[i] = 0.35 + (n[i] - 0.5) * 0.4 + light[i] + (g[i] - 0.5) * 0.2;
    paintTone(p, SOIL, tone, 0.4);
    const v1 = veins(p, 4, 1.1, 913, 0.25);
    const v2 = veins(p, 8, 0.9, 914, 0.3);
    const mat = fbm(p, 3, 2, 915);
    for (let y = 0; y < s; y++)
      for (let x = 0; x < s; x++) {
        const i = y * s + x;
        const v = Math.max(v1[i], v2[i] * 0.8);
        // Mats: where threads crowd, they felt into a pale crust.
        const felt = smooth(0.7, 0.95, mat[i]);
        if (v > 0.35 || felt * g[i] > 0.55) {
          p.setColor(i, rampColor(MYCELIUM, clamp01(v * 0.8 + felt * 0.3 + (g[i] - 0.5) * 0.3), x, y, 0.5));
          p.height[i] += 0.05;
          p.rough[i] = 0.95;
        } else p.rough[i] = 0.9;
      }
    for (let k = 0; k < 14; k++) {
      const x = p.rng.int(0, s - 1);
      const y = p.rng.int(0, s - 1);
      const glow = p.rng.chance(0.4);
      const cap: Ramp = glow ? SPORE_GLOW : FUNGUS_CAP;
      p.set(x, y + 1, { c: MYCELIUM[3], h: 0.6 });
      p.set(x - 1, y, { c: rampColor(cap, 0.4, x, y), h: 0.75, e: glow ? 0.6 : 0 });
      p.set(x, y, { c: rampColor(cap, 0.9, x, y), h: 0.8, e: glow ? 1 : 0 });
      p.set(x + 1, y, { c: rampColor(cap, 0.55, x, y), h: 0.75, e: glow ? 0.7 : 0 });
    }
    speckle(p, { density: 0.01, color: SPORE_GLOW[2], amount: 0.8 });
  },
  { glow: 2.5 },
);

/** Shelf (bracket) fungus: a half-disc lip lit on top, dark gills below
 * with a glowing seam where the gills meet the rim. */
function bracket(p: Paint, cx: number, cy: number, w: number, h: number, glow: boolean): void {
  const s = p.size;
  for (let dy = -h; dy <= 2; dy++)
    for (let dx = -w; dx <= w; dx++) {
      const nx = dx / w;
      const ny = dy / h;
      const inCap = dy <= 0 && nx * nx + ny * ny <= 1;
      const inGill = dy > 0 && dy <= 2 && Math.abs(nx) < 1 - dy * 0.25;
      if (!inCap && !inGill) continue;
      const i = p.idx(cx + dx, cy + dy);
      const x = (((cx + dx) % s) + s) % s;
      const y = (((cy + dy) % s) + s) % s;
      if (inCap) {
        // Concentric growth bands, pale growing rim, lit from the upper left.
        const r2 = nx * nx + ny * ny;
        const band = Math.floor(Math.sqrt(r2) * 4) & 1 ? 0.1 : 0;
        const t = 0.35 + (1 - r2) * 0.25 + band - nx * 0.15 + (r2 > 0.8 ? 0.3 : 0);
        p.setColor(i, rampColor(BRACKET, t, x, y, 0.4));
        p.height[i] = 0.7 + (1 - ny * ny) * 0.2;
        p.rough[i] = 0.55;
        if (dy === 0 && glow) {
          p.setColor(i, SPORE_GLOW[SPORE_GLOW.length - 2]);
          p.emit[i] = 1;
        }
      } else {
        p.setColor(i, dy === 1 && glow ? SPORE_GLOW[1] : hex("#140a14"));
        p.emit[i] = dy === 1 && glow ? 0.6 : 0;
        p.height[i] = 0.55 - dy * 0.1;
      }
    }
}

registerMaterial(
  "cave.fungal_wall",
  (p) => {
    paintCaveRock(p, ramp("#0f0d13", "#1c1822", "#2a2532", "#3a3444", "#4c4556"), 3);
    const s = p.size;
    // Crusts of threads and luminous spots creep over the stone first…
    const v = veins(p, 5, 1.6, 921);
    for (let i = 0; i < v.length; i++) if (v[i] > 0.4) p.mix(i, MYCELIUM[1], v[i] * 0.5);
    glowSpots(p, { count: 26, r: [0.7, 1.6], ramp: SPORE_GLOW, emit: 0.9 });
    // …then the bracket shelves stack up the wall.
    for (let k = 0; k < 6; k++) {
      const w = p.rng.int(5, 8);
      bracket(p, p.rng.int(0, s - 1), p.rng.int(0, s - 1), w, p.rng.int(5, 6), p.rng.chance(0.7));
    }
  },
  { glow: 2.5 },
);

registerMaterial("cave.root", (p) => {
  // A tangle of roots breaking through: thick cords with bark shading,
  // overlapping with cast shadows, fine rootlets between.
  const s = p.size;
  const n = fbm(p, 4, 3, 931);
  for (let i = 0; i < n.length; i++) {
    p.setColor(i, rampColor(SOIL, 0.2 + n[i] * 0.3, i % s, (i / s) | 0));
    p.height[i] = 0.2 + n[i] * 0.1;
    p.rough[i] = 0.95;
  }
  const ridge = grainNoise(p, 932);
  const root = (x: number, y: number, a: number, r: number, len: number, depth: number) => {
    for (let t = 0; t < len; t++) {
      const rr = r * (1 - (t / len) * 0.5);
      const z = 0.45 + depth * 0.12;
      // Shadow first (offset down-right), then the cord itself.
      p.disc(x + 1.2, y + 1.2, rr, (i) => {
        if (p.height[i] < z) p.shade(i, 0.75);
      });
      p.disc(x, y, rr, (i, d) => {
        if (p.height[i] > z + 0.1) return;
        const px = i % s;
        const py = (i / s) | 0;
        const side = ((px + 0.5 - x) * Math.cos(a + Math.PI / 2) + (py + 0.5 - y) * Math.sin(a + Math.PI / 2)) / rr;
        const t2 = 0.55 - side * 0.35 - d * 0.2 + (ridge[i] - 0.5) * 0.25;
        p.setColor(i, rampColor(BARK, t2, px, py, 0.3));
        p.height[i] = z + (1 - d * d) * 0.15;
        p.rough[i] = 0.85;
      });
      a += p.rng.gauss() * 0.18;
      x += Math.cos(a) * 0.8;
      y += Math.sin(a) * 0.8;
      if (rr > 1.2 && p.rng.chance(0.03)) root(x, y, a + p.rng.sign() * 0.9, rr * 0.55, Math.floor(len * 0.4), depth + 1);
    }
  };
  for (let k = 0; k < 9; k++) root((k * 23) % s + p.rng.range(0, 8), p.rng.range(0, s), p.rng.range(-0.6, 0.6) + (k & 1 ? Math.PI / 2 : 0), p.rng.range(1.4, 2.8), p.rng.int(40, 80), k % 3);
  for (let k = 0; k < 12; k++) {
    let x = p.rng.range(0, s);
    let y = p.rng.range(0, s);
    let a = p.rng.range(0, Math.PI * 2);
    for (let t = 0; t < 12; t++) {
      if (p.height[p.idx(x, y)] < 0.4) p.set(x, y, { c: BARK[4], h: 0.35 });
      a += p.rng.gauss() * 0.5;
      x += Math.cos(a);
      y += Math.sin(a);
    }
  }
});

registerMaterial(
  "cave.ceiling_spore",
  (p) => {
    // Dark rock hung with clusters of spore pods: round sacs whose tips
    // glow, trailing sticky strands downward, fuzz of threads between.
    paintCaveRock(p, ramp("#0b0a0e", "#16141b", "#221f28", "#302b37", "#3f3947"), 7);
    const s = p.size;
    const v = veins(p, 6, 1.4, 941);
    for (let i = 0; i < v.length; i++) if (v[i] > 0.45) p.mix(i, MYCELIUM[0], 0.4);
    const POD = ramp("#1e0e22", "#3a1a40", "#5a2c5e", "#7a4478", "#9a6292");
    for (let c = 0; c < 6; c++) {
      const cx = p.rng.range(0, s);
      const cy = p.rng.range(0, s);
      for (let k = 0; k < 5; k++) {
        const x = cx + p.rng.range(-5, 5);
        const y = cy + p.rng.range(-4, 4);
        const r = p.rng.range(1.5, 3);
        const lit = p.rng.chance(0.6);
        for (let t = 1; t < p.rng.int(3, 8); t++) p.set(x, y + r + t, { c: MYCELIUM[0], e: 0, h: 0.5 });
        p.disc(x, y, r, (i, d) => {
          const px = i % s;
          const py = (i / s) | 0;
          const dy = py + 0.5 - y;
          p.setColor(i, rampColor(POD, 0.75 - d * 0.5 - dy * 0.08, px, py, 0.4));
          p.height[i] = 0.6 + (1 - d * d) * 0.3;
          p.rough[i] = 0.4;
          if (lit && dy > r * 0.3) {
            p.setColor(i, rampColor(SPORE_GLOW, 1 - d * 0.5, px, py, 0.4));
            p.emit[i] = 1 - d * 0.4;
          }
        });
      }
    }
    speckle(p, { density: 0.012, color: SPORE_GLOW[2], amount: 1 });
    for (let k = 0; k < 24; k++) p.set(p.rng.int(0, s - 1), p.rng.int(0, s - 1), { c: SPORE_GLOW[1], e: 0.7 });
  },
  { glow: 2.5 },
);
