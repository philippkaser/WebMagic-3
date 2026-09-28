import {
  clamp01,
  fbm,
  fbmXY,
  field,
  grainNoise,
  hexes,
  lightField,
  paintTone,
  ramp,
  rampColor,
  relief,
  roughFrom,
  slabs,
  speckle,
} from "../brushes";
import { registerMaterial } from "../library";
import { hex } from "../paint";
import { AMBER, GOLD, HONEY, WAX, insect, paintHoneycomb } from "./common";

/** Stratum 5 — the Gilded Hive: a cathedral of wax and amber built by
 * worshippers who became a hive. Everything is glossy, warm and sticky;
 * honey cells glow like stained glass. */

registerMaterial("hive.wax_wall", (p) => paintHoneycomb(p, { cols: 7, filled: 0.45, capped: 0.25, glowing: 0.55 }), { glow: 2.5 });

registerMaterial(
  "hive.amber_floor",
  (p) => {
    // Poured amber in great polished slabs: flow banding, bubbles, and the
    // dark shapes of insects caught forever in it. Glossy and faintly lit
    // from within.
    const s = p.size;
    const L = slabs(p, { min: 20, max: 40, gap: 1, warp: 1.5 });
    relief(p, L, { joint: 0.3, face: 0.6, vary: 0.02, bevel: 2, curve: 0.5 });
    const flow = fbm(p, 2, 4, 1101, 0.6);
    const n = fbm(p, 6, 2, 1102);
    const light = lightField(p, 1);
    const tone = field(p);
    for (let i = 0; i < n.length; i++) {
      const band = Math.sin(flow[i] * Math.PI * 7) * 0.5 + 0.5;
      const c = L.id[i];
      tone[i] = c < 0 ? 0.05 : 0.42 + band * 0.18 + (n[i] - 0.5) * 0.12 + (L.rnd(c) - 0.5) * 0.15 + light[i];
    }
    paintTone(p, AMBER, tone, 0.45);
    for (let k = 0; k < 7; k++) insect(p, p.rng.int(0, s - 1), p.rng.int(0, s - 1), hex("#2a1004"));
    for (let k = 0; k < 18; k++) {
      const x = p.rng.int(0, s - 1);
      const y = p.rng.int(0, s - 1);
      p.set(x, y, { c: AMBER[AMBER.length - 1] });
      p.set(x + 1, y + 1, { c: AMBER[2] });
    }
    roughFrom(p, 0.07);
    for (let i = 0; i < n.length; i++) {
      if (L.id[i] < 0) p.rough[i] = 0.6;
      p.emit[i] = L.id[i] < 0 ? 0 : 0.1 + clamp01(tone[i]) * 0.15;
    }
  },
  { glow: 1.5 },
);

registerMaterial("hive.resin", (p) => {
  // Secreted resin: slow sticky flows running down, thick at the lips,
  // dark-red where deep, orange where thin, with trapped bubbles.
  const s = p.size;
  const flow = fbmXY(p, 6, 1, 3, 1111);
  const n = fbm(p, 4, 3, 1112);
  const g = grainNoise(p, 1113);
  for (let i = 0; i < n.length; i++) p.height[i] = 0.4 + flow[i] * 0.35 + (n[i] - 0.5) * 0.1;
  const light = lightField(p, 1.8);
  const tone = field(p);
  for (let i = 0; i < n.length; i++) tone[i] = 0.3 + flow[i] * 0.4 + light[i] + (n[i] - 0.5) * 0.15;
  const RESIN = ramp("#140402", "#300a04", "#521606", "#78280a", "#a04410", "#c86a20", "#eca048");
  paintTone(p, RESIN, tone, 0.4);
  for (let k = 0; k < 20; k++) {
    const x = p.rng.int(0, s - 1);
    const y = p.rng.int(0, s - 1);
    p.set(x, y, { c: RESIN[RESIN.length - 1] });
    if (p.rng.chance(0.5)) p.set(x + 1, y, { c: RESIN[4] });
  }
  roughFrom(p, 0.12, g, 0.04);
  for (let i = 0; i < n.length; i++) p.emit[i] = flow[i] < 0.25 ? 0.12 : 0;
});

registerMaterial(
  "hive.gilded_trim",
  (p) => {
    // Gold band embossed with a hex lattice, wax dribbling over its edge.
    const s = p.size;
    const H = hexes(p, { cols: 7, gap: 1.2 });
    const n = fbm(p, 4, 2, 1121);
    for (let y = 0; y < s; y++)
      for (let x = 0; x < s; x++) {
        const i = y * s + x;
        let h: number;
        if (y < 5 || y >= 59) h = 0.8 - (y === 4 || y === 59 ? 0.2 : 0);
        else h = H.id[i] < 0 ? 0.72 : 0.5 + (1 - H.d[i]) * 0.06;
        p.height[i] = h;
      }
    const light = lightField(p, 2);
    const tone = field(p);
    for (let i = 0; i < n.length; i++) tone[i] = 0.55 + light[i] + (n[i] - 0.5) * 0.2 + (p.height[i] > 0.7 ? 0.15 : -0.05);
    paintTone(p, GOLD, tone, 0.3);
    p.metal.fill(1);
    roughFrom(p, 0.28, n, 0.05);
    // Wax runs from the upper edge.
    for (let k = 0; k < 6; k++) {
      const x = p.rng.int(0, s - 1);
      const len = p.rng.int(4, 12);
      for (let t = 0; t < len; t++)
        for (let w = 0; w < 2; w++) {
          const i = p.idx(x + w, 5 + t);
          p.setColor(i, rampColor(WAX, 0.8 - w * 0.25 - t * 0.02, x + w, 5 + t));
          p.metal[i] = 0;
          p.rough[i] = 0.4;
          p.height[i] = 0.78;
        }
    }
    speckle(p, { density: 0.01, color: HONEY[HONEY.length - 1], amount: 0.6 });
  },
  { glow: 2 },
);
