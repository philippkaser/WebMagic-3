import {
  bricks,
  cellular,
  clamp01,
  cracks,
  dents,
  drips,
  fbm,
  fbmXY,
  field,
  grainNoise,
  lightField,
  paintTone,
  ramp,
  rampColor,
  relief,
  rivet,
  roughFrom,
  slabs,
  smooth,
  speckle,
} from "../brushes";
import { registerMaterial } from "../library";
import { hex, type Paint } from "../paint";
import { BRASS, IRON, LAVA, RUST, paintMasonry, paintPlates } from "./common";

/** Stratum 4 — the Cinder Foundry: smiths who tried to forge a god they
 * could hold. Refractory brick under soot, tread plate, riveted girders,
 * brass fittings and seams still glowing with heat. */

const FIREBRICK = ramp("#1e140e", "#3a2618", "#583a24", "#795232", "#9a6c44", "#b88a5c");
const FIREBRICK_RED = ramp("#1e0e0a", "#3a1a12", "#58281a", "#783a26", "#984e34", "#b46646");
const SOOT = hex("#0a0908");
const HOT = ramp("#1a0604", "#4a0e04", "#8a1c04", "#d04208", "#ff8a1c", "#ffd060", "#fff4c0");

registerMaterial("foundry.brick_soot", (p) => {
  // Refractory brick in a tight bond, pale mortar, blackened by soot that
  // rolls up the wall in plumes; some bricks glazed glassy by the heat.
  const L = bricks(p, { rows: 8, minW: 14, maxW: 18 });
  paintMasonry(p, L, { ramps: [FIREBRICK, FIREBRICK, FIREBRICK_RED], mortar: ramp("#2a2622", "#4a453e", "#6a6358", "#857d70"), chip: 0.25, tint: 0.14, bevel: 1.2 });
  const plume = fbmXY(p, 5, 2, 3, 1001);
  const n = fbm(p, 4, 3, 1002);
  for (let i = 0; i < n.length; i++) {
    const k = clamp01(plume[i] * 0.9 + n[i] * 0.6 - 0.3);
    p.mix(i, SOOT, 0.15 + k * 0.8);
    if (k > 0.5) p.rough[i] = 0.95;
  }
  for (let i = 0; i < L.id.length; i++) {
    const c = L.id[i];
    if (c >= 0 && L.rnd(c, 9) < 0.12) {
      p.rough[i] = 0.3;
      p.mix(i, hex("#2a1a14"), 0.4);
    }
  }
  cracks(p, { count: 3, length: [6, 14], depth: 0.15, mask: (i) => L.id[i] >= 0 });
});

registerMaterial("foundry.iron_plate", (p) => {
  // Tread plate: raised lozenges alternating diagonal, tops worn bright,
  // plate seams with bolts, oil and rust in the low spots.
  const s = p.size;
  const L = slabs(p, { min: 32, max: 32, gap: 1 });
  relief(p, L, { joint: 0.2, face: 0.5, vary: 0.02, bevel: 1 });
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      if (L.id[i] < 0) continue;
      const cx = Math.floor(x / 8);
      const cy = Math.floor(y / 8);
      const lx = (x % 8) - 3.5;
      const ly = (y % 8) - 3.5;
      const dir = (cx + cy) & 1 ? 1 : -1;
      const u = (lx + dir * ly) * 0.7071;
      const v = (lx - dir * ly) * 0.7071;
      if (Math.abs(u) < 3.2 && Math.abs(v) < 0.9 - Math.abs(u) * 0.08) p.height[i] = 0.72 - Math.abs(u) * 0.03;
    }
  const n = fbm(p, 4, 3, 1011);
  const light = lightField(p, 1.8);
  const tone = field(p);
  for (let i = 0; i < n.length; i++) tone[i] = L.id[i] < 0 ? 0.05 : 0.42 + (n[i] - 0.5) * 0.16 + light[i] + (p.height[i] > 0.65 ? 0.18 : 0);
  paintTone(p, IRON, tone, 0.3);
  for (let i = 0; i < n.length; i++) {
    p.metal[i] = 0.9;
    p.rough[i] = p.height[i] > 0.65 ? 0.3 : 0.55;
  }
  for (const r of L.rects)
    for (const [ox, oy] of [
      [3, 3],
      [r.w - 4, 3],
      [3, r.h - 4],
      [r.w - 4, r.h - 4],
    ])
      rivet(p, r.x + ox + 0.5, r.y + oy + 0.5, 1.6, { ramp: IRON, h: 0.2, rough: 0.4, metal: 0.9 });
  const oil = fbm(p, 3, 2, 1012);
  for (let i = 0; i < n.length; i++) {
    if (oil[i] > 0.72) {
      p.mix(i, hex("#0a0806"), 0.5);
      p.rough[i] = 0.1;
    }
    if (L.edge[i] < 2 && n[i] > 0.62) {
      p.setColor(i, rampColor(RUST, 0.1 + (n[i] - 0.62) * 1.2, i % s, (i / s) | 0));
      p.metal[i] = 0;
      p.rough[i] = 0.9;
    }
  }
});

registerMaterial(
  "foundry.grate",
  (p) => {
    // Heavy floor grate: square holes between thick bars, bar tops polished
    // by boots, rust in the corners.
    const s = p.size;
    p.alpha.fill(0);
    const n = fbm(p, 8, 3, 1021);
    for (let y = 0; y < s; y++)
      for (let x = 0; x < s; x++) {
        const i = y * s + x;
        const lx = x % 8;
        const ly = y % 8;
        const barX = lx < 3;
        const barY = ly < 3;
        if (!barX && !barY) continue;
        p.alpha[i] = 1;
        const across = barX && barY ? 1 : barX ? lx : ly;
        const t = [0.75, 0.55, 0.25][Math.min(2, across)] + (n[i] - 0.5) * 0.25 + (barX && barY ? 0.1 : 0);
        const rusty = n[i] > 0.68 && across !== 0;
        p.setColor(i, rampColor(rusty ? RUST : IRON, t, x, y, 0.3));
        p.height[i] = 0.8 - across * 0.12;
        p.metal[i] = rusty ? 0.1 : 0.9;
        p.rough[i] = rusty ? 0.9 : across === 0 ? 0.3 : 0.55;
      }
  },
  { cutout: true, worldSize: 1 },
);

/** Riveted I-beam seen from below: flanges with rivet rows, a web between. */
function girder(p: Paint, y0: number): void {
  const s = p.size;
  const n = fbm(p, 16, 2, 1031 + y0);
  for (let y = 0; y < 14; y++)
    for (let x = 0; x < s; x++) {
      const i = p.idx(x, y0 + y);
      const flange = y < 4 || y >= 10;
      const edge = y === 0 || y === 13;
      const inner = y === 3 || y === 10;
      let t = flange ? 0.55 : 0.3;
      if (edge) t += y === 0 ? 0.25 : -0.2;
      if (inner) t -= 0.15;
      t += (n[i] - 0.5) * 0.25;
      const rusty = n[i] > 0.7;
      p.setColor(i, rampColor(rusty ? RUST : IRON, t, x, y0 + y, 0.3));
      p.height[i] = flange ? 0.9 : 0.7;
      p.metal[i] = rusty ? 0.1 : 0.85;
      p.rough[i] = rusty ? 0.9 : 0.5;
    }
  for (let x = 3; x < s; x += 6) {
    rivet(p, x + 0.5, y0 + 2, 1.1, { ramp: IRON, h: 0.08, metal: 0.85, rough: 0.4 });
    rivet(p, x + 0.5, y0 + 12, 1.1, { ramp: IRON, h: 0.08, metal: 0.85, rough: 0.4 });
  }
  for (let x = 0; x < s; x++) p.shade(p.idx(x, y0 + 14), 0.4);
}

registerMaterial("foundry.ceiling_beams", (p) => {
  // Soot-black brick vault crossed by two riveted girders.
  const L = bricks(p, { rows: 8, minW: 12, maxW: 20 });
  paintMasonry(p, L, { ramps: [FIREBRICK], mortar: ramp("#0e0c0a", "#1c1814", "#2a241e"), chip: 0.3 });
  for (let i = 0; i < L.id.length; i++) p.mix(i, SOOT, 0.7);
  girder(p, 4);
  girder(p, 36);
  drips(p, { count: 5, color: RUST[2], strength: 0.4, minLen: 4, maxLen: 10, start: () => 18 });
});

registerMaterial("foundry.trim_brass", (p) => {
  // Polished brass band: rolled edges, a rivet line and an engraved
  // key-pattern (meander) running along it.
  const s = p.size;
  const n = fbmXY(p, 2, 16, 2, 1041);
  const key = (x: number, y: number): boolean => {
    const lx = x % 16;
    const ly = y - 22;
    if (ly < 0 || ly > 19) return false;
    // A square meander: hooks built from 2-texel lines.
    if (ly === 0 || ly === 19) return true;
    if (lx === 0 && ly < 15) return true;
    if (ly === 14 && lx < 11) return true;
    if (lx === 10 && ly > 4 && ly < 15) return true;
    if (ly === 5 && lx > 4 && lx < 11) return true;
    if (lx === 5 && ly > 4 && ly < 10) return true;
    return false;
  };
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      let h = 0.6;
      if (y < 4) h = 0.7 + Math.sin((y / 4) * Math.PI) * 0.15;
      else if (y >= 60) h = 0.7 + Math.sin(((y - 60) / 4) * Math.PI) * 0.15;
      else if (y === 4 || y === 59) h = 0.45;
      if (key(x, y)) h -= 0.12;
      p.height[i] = h;
    }
  const light = lightField(p, 1.8);
  const tone = field(p);
  for (let i = 0; i < tone.length; i++) tone[i] = 0.58 + (n[i] - 0.5) * 0.2 + light[i] + (p.height[i] < 0.5 ? -0.25 : 0);
  paintTone(p, BRASS, tone, 0.3);
  for (let x = 4; x < s; x += 8) {
    rivet(p, x + 0.5, 12.5, 1.4, { ramp: BRASS, h: 0.14, rough: 0.25 });
    rivet(p, x + 0.5, 51.5, 1.4, { ramp: BRASS, h: 0.14, rough: 0.25 });
  }
  roughFrom(p, 0.24, n, 0.05);
  p.metal.fill(1);
  const tarnish = fbm(p, 4, 2, 1042);
  for (let i = 0; i < tone.length; i++)
    if (tarnish[i] > 0.7 || p.height[i] < 0.5) {
      p.mix(i, hex("#3a2a10"), p.height[i] < 0.5 ? 0.4 : (tarnish[i] - 0.7) * 1.5);
      p.rough[i] = 0.45;
    }
});

registerMaterial(
  "foundry.hazard",
  (p) => {
    // Plates over the fire: seams and cracks glow white-hot, the iron
    // around them fades through cherry red to heat-tinted black.
    const s = p.size;
    const L = paintPlates(p, { ramp: ramp("#0c0b0b", "#181616", "#252120", "#34302c", "#46403a"), min: 16, max: 32, rivets: 0, rough: 0.6, dents: 6, wear: 0 });
    const ck = cracks(p, { count: 5, length: [6, 18], depth: 0.1, color: HOT[5], lip: 0, mask: (i) => L.id[i] >= 0 });
    const n = fbm(p, 8, 2, 1051);
    const g = grainNoise(p, 1052);
    // Heat = distance to the nearest seam or crack.
    const heat = field(p);
    for (let i = 0; i < n.length; i++) heat[i] = L.id[i] < 0 || ck[i] ? 1 : 0;
    for (let pass = 0; pass < 4; pass++) {
      const prev = Float32Array.from(heat);
      for (let y = 0; y < s; y++)
        for (let x = 0; x < s; x++) {
          const i = y * s + x;
          const m = Math.max(prev[p.idx(x + 1, y)], prev[p.idx(x - 1, y)], prev[p.idx(x, y + 1)], prev[p.idx(x, y - 1)]);
          heat[i] = Math.max(prev[i], m * 0.62);
        }
    }
    for (let i = 0; i < n.length; i++) {
      const h = clamp01(heat[i] + (n[i] - 0.5) * 0.25 + (g[i] - 0.5) * 0.08);
      if (h > 0.3) {
        const x = i % s;
        const y = (i / s) | 0;
        p.setColor(i, rampColor(HOT, h, x, y, 0.5));
        p.emit[i] = smooth(0.3, 0.9, h);
        p.metal[i] = h > 0.8 ? 0 : 0.6;
        p.rough[i] = 0.55;
      } else if (h > 0.18) p.mix(i, hex("#2a1a30"), 0.35);
    }
  },
  { glow: 3.5 },
);

registerMaterial(
  "foundry.slag",
  (p) => {
    // Cooled slag heap: glassy black-brown lumps, gas vesicles, rust-orange
    // oxide skins, and a few pockets still glowing.
    const s = p.size;
    const c = cellular(p, 6, 1061, 1);
    const n = fbm(p, 8, 3, 1062);
    for (let i = 0; i < n.length; i++) p.height[i] = 0.3 + (1 - clamp01(c.f1[i] / 7)) * 0.5 + (n[i] - 0.5) * 0.15;
    dents(p, { count: 40, r: [0.6, 1.4], depth: 0.15, darken: 0.3 });
    const light = lightField(p, 1.8);
    const tone = field(p);
    for (let i = 0; i < n.length; i++) tone[i] = 0.4 + light[i] + (n[i] - 0.5) * 0.3;
    const SLAG = ramp("#070605", "#13100d", "#221c17", "#342a22", "#4a3c30", "#62503e");
    paintTone(p, SLAG, tone, 0.35);
    for (let i = 0; i < n.length; i++) {
      p.rough[i] = light[i] > 0.05 ? 0.25 : 0.7;
      if (n[i] > 0.72) {
        p.mix(i, RUST[3], 0.5);
        p.rough[i] = 0.9;
      }
    }
    for (let k = 0; k < 5; k++) {
      const x = p.rng.range(0, s);
      const y = p.rng.range(0, s);
      const r = p.rng.range(1.2, 2.4);
      p.disc(x, y, r, (i, d) => {
        p.setColor(i, rampColor(LAVA, 1 - d * 0.7, i % s, (i / s) | 0, 0.4));
        p.emit[i] = 1 - d * 0.5;
        p.height[i] -= 0.1;
      });
    }
    speckle(p, { density: 0.015, color: hex("#8a8078"), amount: 0.5 });
  },
  { glow: 3 },
);
