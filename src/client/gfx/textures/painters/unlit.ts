import {
  bricks,
  cracks,
  fbm,
  field,
  grainNoise,
  hexes,
  isoLines,
  lightField,
  paintTone,
  ramp,
  roughFrom,
  slabs,
  relief,
  speckle,
} from "../brushes";
import { registerMaterial } from "../library";
import { hex } from "../paint";
import { paintMasonry } from "./common";

/** Stratum 9 — the Unlit: lightless mirror-halls of those who put out
 * every light so God would have to come looking. Near-black polished
 * stone that only shows up in reflections, and mirrors that do. */

const BASALT = ramp("#040405", "#08080a", "#0e0e12", "#15151a", "#1e1e25", "#2a2a33");
const SILVER = ramp("#6a6e76", "#8a8e96", "#a8acb4", "#c4c8ce", "#dcdfe4", "#f0f2f4");

registerMaterial("unlit.black_stone", (p) => {
  // Polished basalt blocks: black, glossy, with a faint crystalline
  // glitter and hairline pale veins you only catch at an angle.
  const L = bricks(p, { rows: 4, minW: 20, maxW: 36 });
  paintMasonry(p, L, { ramps: [BASALT], mortar: ramp("#010101", "#040405", "#08080a"), chip: 0.12, tint: 0.1, noise: 0.15, bevel: 1.2, rough: 0.28 });
  const v = fbm(p, 2, 3, 1501);
  const ph = v.map((x) => x * 6);
  const vein = isoLines(p, ph, 0.8);
  const g = grainNoise(p, 1502);
  for (let i = 0; i < v.length; i++) {
    if (L.id[i] < 0) continue;
    if (vein[i] > 0.5 && v[i] > 0.45) p.mix(i, hex("#34343e"), 0.6);
    if (g[i] > 0.99) p.setColor(i, hex("#4a4a58"));
  }
});

registerMaterial("unlit.mirror", (p) => {
  // Silvered mirror panels in thin black frames. Almost perfectly smooth;
  // desilvered blooms and cracks break the reflection.
  const L = slabs(p, { min: 32, max: 32, gap: 2 });
  relief(p, L, { joint: 0.3, face: 0.6, vary: 0, bevel: 1, curve: 1 });
  const n = fbm(p, 3, 3, 1511);
  const tone = field(p);
  for (let i = 0; i < n.length; i++) tone[i] = L.id[i] < 0 ? 0 : 0.62 + (n[i] - 0.5) * 0.1;
  paintTone(p, (i) => (L.id[i] < 0 ? BASALT : SILVER), tone, 0.3);
  for (let i = 0; i < n.length; i++) {
    p.metal[i] = L.id[i] < 0 ? 0.2 : 1;
    p.rough[i] = L.id[i] < 0 ? 0.4 : 0.05;
  }
  // Desilvering: dark, dull blotches creeping in from panel edges.
  const d = fbm(p, 6, 3, 1512);
  for (let i = 0; i < n.length; i++) {
    if (L.id[i] < 0) continue;
    const v = d[i] * 0.8 + (L.edge[i] < 5 ? (5 - L.edge[i]) * 0.07 : 0);
    if (v > 0.82) {
      p.mix(i, hex("#1a1a1e"), 0.8);
      p.rough[i] = 0.6;
      p.metal[i] = 0.3;
    }
  }
  const ck = cracks(p, { count: 3, length: [10, 26], depth: 0.05, color: hex("#e8ecf0"), lip: 0, branch: 0.12, mask: (i) => L.id[i] >= 0 });
  for (let i = 0; i < ck.length; i++) if (ck[i]) p.rough[i] = 0.4;
});

registerMaterial("unlit.floor", (p) => {
  // Black obsidian hexes, polished, a film of dust in the seams.
  const H = hexes(p, { cols: 5, gap: 1.2 });
  const n = fbm(p, 4, 2, 1521);
  for (let i = 0; i < n.length; i++) p.height[i] = H.id[i] < 0 ? 0.3 : 0.6 + (1 - H.d[i]) * 0.02;
  const light = lightField(p, 1.2);
  const tone = field(p);
  for (let i = 0; i < n.length; i++) tone[i] = H.id[i] < 0 ? 0.2 : 0.4 + (H.rnd(H.id[i]) - 0.5) * 0.2 + light[i] + (n[i] - 0.5) * 0.1;
  paintTone(p, (i) => (H.id[i] < 0 ? ramp("#141416", "#222226", "#303036") : BASALT), tone, 0.3);
  roughFrom(p, 0.14, n, 0.06);
  for (let i = 0; i < n.length; i++) if (H.id[i] < 0) p.rough[i] = 0.9;
  speckle(p, { density: 0.01, color: hex("#3a3a44"), amount: 0.6 });
});

registerMaterial("unlit.trim", (p) => {
  // Black stone band with a thin silver inlay line and lozenge studs.
  const s = p.size;
  const n = fbm(p, 6, 2, 1531);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      let h = 0.6;
      if (y < 4 || y >= 60) h = 0.8;
      if (y === 4 || y === 59) h = 0.45;
      p.height[i] = h + (n[i] - 0.5) * 0.02;
    }
  const light = lightField(p, 1.6);
  const tone = field(p);
  for (let i = 0; i < n.length; i++) tone[i] = 0.45 + light[i] + (n[i] - 0.5) * 0.15;
  paintTone(p, BASALT, tone, 0.3);
  roughFrom(p, 0.25, n, 0.05);
  for (let x = 0; x < s; x++)
    for (const y of [20, 43]) p.set(x, y, { c: SILVER[4], m: 1, r: 0.1, h: 0.62 });
  for (let k = 0; k < 4; k++) {
    const cx = k * 16 + 8;
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.abs(dx) + Math.abs(dy);
        if (d > 4) continue;
        p.set(cx + dx, 32 + dy, { c: SILVER[Math.max(0, 5 - d - (dx + dy > 0 ? 1 : 0))], m: 1, r: 0.12, h: 0.75 - d * 0.03 });
      }
  }
});
