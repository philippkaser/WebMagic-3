import {
  bricks,
  cellular,
  clamp01,
  fbm,
  fbmXY,
  field,
  isoLines,
  lightField,
  paintTone,
  ramp,
  rampColor,
  roughFrom,
  smooth,
  stamp,
} from "../brushes";
import { registerMaterial } from "../library";
import { hex } from "../paint";
import { GOLD, paintMasonry } from "./common";
import { paintPlaster } from "./village";

/** Stratum 10 — the Threshold: inside the dreamer, which dreams of Kneel
 * remembered wrong. Soft pastel stone that doesn't quite line up, plaster
 * that watches, gold where the dream has been mended. */

const DREAM = ramp("#3a3444", "#554e62", "#726a80", "#8e879c", "#aaa3b6", "#c6c0cf", "#e0dce6");

registerMaterial(
  "threshold.dream_stone",
  (p) => {
    // Blocks whose joints wander as if half-remembered, faces rippled with
    // slow contour lines, and a faint light leaking from the joints.
    const L = bricks(p, { rows: 6, minW: 12, maxW: 26, warp: 3.5 });
    paintMasonry(p, L, { ramps: [DREAM], mortar: ramp("#6a5a4a", "#9a8460", "#c8aa70"), chip: 0.1, tint: 0.1, noise: 0.15, bevel: 2.5, rough: 0.7 });
    const n = fbm(p, 2, 3, 1701);
    const ph = n.map((v) => v * 6);
    const rip = isoLines(p, ph, 1);
    for (let i = 0; i < n.length; i++) {
      if (L.id[i] < 0) p.emit[i] = 0.35;
      else if (rip[i] > 0.5) p.mix(i, DREAM[DREAM.length - 1], 0.25);
    }
  },
  { glow: 1.5 },
);

/** An almond eye, 9×5: lids (1), white (2), iris (3), glint (4). */
const EYE = ["..11111..", ".1222221.", "12234322.", ".1222221.", "..11111.."];

registerMaterial("threshold.village_plaster", (p) => {
  // Kneel's lime plaster, but wrong: the mottling is a little too warm, and
  // among the cracks and stains there are eyes, half-sunk into the grain.
  // Faint enough that you notice them only after a while.
  paintPlaster(p, ramp("#524a44", "#766a62", "#9a8c82", "#b8aa9e", "#d0c4b8", "#e2d8cc"), 7);
  const s = p.size;
  for (let k = 0; k < 6; k++) {
    const x = p.rng.int(0, s - 1);
    const y = p.rng.int(0, s - 1);
    const strong = k < 2 ? 0.7 : 0.4;
    stamp(p, x, y, EYE, (i, ch) => {
      if (ch === "1") p.mix(i, hex("#3a302a"), strong);
      else if (ch === "2") p.mix(i, hex("#e8e0d4"), strong * 0.5);
      else if (ch === "3") {
        p.mix(i, hex("#2a2622"), strong + 0.2);
        p.rough[i] = 0.25;
      } else p.mix(i, hex("#0a0806"), strong + 0.25);
      p.height[i] -= ch === "1" ? 0.05 : 0.02;
    });
  }
});

registerMaterial(
  "threshold.gold_vein",
  (p) => {
    // Dark stone broken and mended with gold (kintsugi): the seams are
    // real metal and softly luminous, as if the dream bled light.
    const s = p.size;
    const c = cellular(p, 4, 1711, 1);
    const n = fbm(p, 6, 3, 1712);
    const w = fbm(p, 4, 2, 1713);
    const vein = field(p);
    for (let i = 0; i < n.length; i++) {
      const e = c.f2[i] - c.f1[i] + (w[i] - 0.5) * 2.4;
      vein[i] = 1 - smooth(0.4, 1.3, e);
    }
    for (let i = 0; i < n.length; i++) p.height[i] = 0.5 + (n[i] - 0.5) * 0.2 + vein[i] * 0.1;
    const light = lightField(p, 1.6);
    const tone = field(p);
    for (let i = 0; i < n.length; i++) tone[i] = 0.45 + (n[i] - 0.5) * 0.3 + light[i];
    paintTone(p, ramp("#0a090c", "#15131a", "#221f28", "#302b38", "#403a4a"), tone, 0.35);
    roughFrom(p, 0.75, n, 0.1);
    for (let i = 0; i < n.length; i++) {
      if (vein[i] < 0.35) continue;
      const x = i % s;
      const y = (i / s) | 0;
      p.setColor(i, rampColor(GOLD, clamp01(0.45 + vein[i] * 0.4 + light[i] * 2), x, y, 0.4));
      p.metal[i] = 1;
      p.rough[i] = 0.25;
      p.emit[i] = 0.25 + vein[i] * 0.35;
    }
  },
  { glow: 2 },
);

registerMaterial(
  "threshold.sky",
  (p) => {
    // The dreamer's sky: pale, sourceless, fully emissive. Soft banded
    // light with slow wisps of cloud drifting through.
    const s = p.size;
    const n = fbm(p, 2, 3, 1721);
    const wisp = fbmXY(p, 2, 6, 3, 1722);
    const tone = field(p);
    for (let y = 0; y < s; y++)
      for (let x = 0; x < s; x++) {
        const i = y * s + x;
        tone[i] = 0.45 + (n[i] - 0.5) * 0.4 + smooth(0.55, 0.85, wisp[i]) * 0.35;
      }
    paintTone(p, ramp("#8a8298", "#a49cb2", "#bcb6c8", "#d2cdd9", "#e6e2ea", "#f6f3f4", "#fffdf6"), tone, 0.8);
    p.emit.fill(1);
    roughFrom(p, 1);
  },
  { glow: 1.2, worldSize: 8 },
);
