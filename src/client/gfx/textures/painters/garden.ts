import {
  cellular,
  clamp01,
  fbm,
  fbmXY,
  field,
  grainNoise,
  isoLines,
  lightField,
  paintTone,
  puddles,
  ramp,
  rampColor,
  roughFrom,
  smooth,
  speckle,
  veins,
} from "../brushes";
import { registerMaterial } from "../library";
import { hex, type Paint } from "../paint";
import { BONE, FLESH } from "./common";

/** Stratum 7 — the Red Garden: the grown place, of those who tried to grow
 * a body worthy of godhood. Muscle folds, veins, wet membranes, bone
 * breaking through. Everything glistens. */

const DEEP_FLESH = ramp("#1a0206", "#34060e", "#520c16", "#721622", "#922832", "#b04446");
const VEIN = hex("#2a0a2a");

/** Wet muscle-fold relief: long rounded ridges running mostly one way,
 * bent by noise. Returns the fold phase. */
function folds(p: Paint, k: number, vertical: boolean, salt: number): Float32Array {
  const s = p.size;
  const w = fbm(p, 2, 3, 1301 + salt);
  const ph = field(p);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      ph[i] = ((vertical ? x : y) / s) * k + (w[i] - 0.5) * 1.6;
      p.height[i] = 0.5 + Math.cos(ph[i] * Math.PI * 2) * 0.18;
    }
  return ph;
}

/** Glistening highlights on the tops of wet relief. */
function wetSheen(p: Paint, light: Float32Array, c = hex("#ffc8c0")): void {
  for (let i = 0; i < light.length; i++) if (light[i] > 0.16) p.mix(i, c, 0.3);
}

registerMaterial("flesh.wall", (p) => {
  const ph = folds(p, 5, true, 0);
  const n = fbm(p, 6, 3, 1311);
  const v = veins(p, 3, 1.2, 1312);
  const valley = isoLines(p, ph.map((x) => x + 0.5), 1.2);
  for (let i = 0; i < n.length; i++) p.height[i] += (n[i] - 0.5) * 0.08 + v[i] * 0.05;
  // Pores: dark pits with swollen rims.
  const c = cellular(p, 7, 1313, 0.9);
  for (let i = 0; i < n.length; i++) {
    if (((c.id[i] * 2654435761) >>> 0) / 4294967296 > 0.4) continue;
    if (c.f1[i] < 1) p.height[i] -= 0.2;
    else if (c.f1[i] < 2) p.height[i] += 0.06;
  }
  const light = lightField(p, 1.5);
  const tone = field(p);
  for (let i = 0; i < n.length; i++) tone[i] = 0.5 + light[i] + (n[i] - 0.5) * 0.2 - valley[i] * 0.3 + (c.f1[i] < 1 ? -0.4 : 0);
  paintTone(p, DEEP_FLESH, tone, 0.35);
  for (let i = 0; i < n.length; i++) if (v[i] > 0.4) p.mix(i, VEIN, v[i] * 0.7);
  wetSheen(p, light);
  roughFrom(p, 0.3, n, 0.1);
});

registerMaterial("flesh.floor", (p) => {
  // Wrinkled, stepped-on flesh: tight folds, pooled fluids, knuckles of
  // bone pushing through.
  const s = p.size;
  const n = fbm(p, 3, 3, 1321);
  const ph = field(p);
  for (let i = 0; i < n.length; i++) ph[i] = n[i] * 7;
  const wr = isoLines(p, ph, 1.2);
  const g = grainNoise(p, 1322);
  for (let i = 0; i < n.length; i++) p.height[i] = 0.5 + (n[i] - 0.5) * 0.35 - wr[i] * 0.08;
  const light = lightField(p, 1.6);
  const tone = field(p);
  for (let i = 0; i < n.length; i++) tone[i] = 0.5 + light[i] - wr[i] * 0.25 + (g[i] - 0.5) * 0.1;
  paintTone(p, FLESH, tone, 0.35);
  for (let k = 0; k < 6; k++) {
    const x = p.rng.range(0, s);
    const y = p.rng.range(0, s);
    const r = p.rng.range(1.2, 2.2);
    p.disc(x, y, r, (i, d) => {
      p.setColor(i, rampColor(BONE, 0.85 - d * 0.5, i % s, (i / s) | 0, 0.3));
      p.height[i] += (1 - d * d) * 0.2;
      p.rough[i] = 0.5;
    });
  }
  wetSheen(p, light);
  roughFrom(p, 0.35, n, 0.1);
  puddles(p, { coverage: 0.12, rough: 0.05, darken: 0.2, tint: hex("#5a0a12") });
});

registerMaterial("flesh.bone_rib", (p) => {
  // A ribcage wall: four bowed ribs, bone-white and shaded round, with
  // stretched membrane and veins between them.
  const s = p.size;
  const n = fbm(p, 6, 3, 1331);
  const v = veins(p, 4, 1.2, 1332);
  const bow = fbmXY(p, 1, 1, 2, 1333);
  const tone = field(p);
  const isBone = new Uint8Array(s * s);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      const yy = (y + Math.sin((x / s) * Math.PI * 2) * 2 + (bow[i] - 0.5) * 3 + s) % 16;
      if (yy < 7) {
        const a = (yy - 3) / 3.5;
        isBone[i] = 1;
        p.height[i] = 0.55 + Math.sqrt(Math.max(0, 1 - a * a)) * 0.35;
        tone[i] = 0.62 - a * 0.35 + (n[i] - 0.5) * 0.15;
      } else {
        const m = (yy - 11.5) / 4.5;
        p.height[i] = 0.25 + m * m * 0.12 + v[i] * 0.05;
        tone[i] = 0.35 + (n[i] - 0.5) * 0.3 - (1 - Math.abs(m)) * 0.1;
      }
    }
  const light = lightField(p, 0.8);
  for (let i = 0; i < n.length; i++) tone[i] += light[i];
  paintTone(p, (i) => (isBone[i] ? BONE : DEEP_FLESH), tone, 0.3);
  for (let i = 0; i < n.length; i++) {
    if (!isBone[i] && v[i] > 0.4) p.mix(i, VEIN, v[i] * 0.7);
    p.rough[i] = isBone[i] ? 0.55 : 0.25;
    // Flesh gripping the bone edges.
    if (isBone[i] && n[i] > 0.7) p.mix(i, FLESH[2], 0.5);
  }
  speckle(p, { density: 0.02, color: hex("#e8a0a0"), amount: 0.5, mask: (i) => !isBone[i] });
});

registerMaterial(
  "flesh.membrane",
  (p) => {
    // Taut translucent membrane lit from behind: pale rose skin with a
    // branching net of veins that glow hot red.
    const s = p.size;
    const n = fbm(p, 3, 3, 1341);
    const v1 = veins(p, 3, 1.4, 1342);
    const v2 = veins(p, 6, 1.2, 1343);
    for (let i = 0; i < n.length; i++) p.height[i] = 0.5 + (n[i] - 0.5) * 0.1 + v1[i] * 0.08 + v2[i] * 0.04;
    const light = lightField(p, 1.2);
    const tone = field(p);
    for (let i = 0; i < n.length; i++) tone[i] = 0.55 + (n[i] - 0.5) * 0.3 + light[i];
    paintTone(p, ramp("#3a0c14", "#6a1a24", "#9a3438", "#c05a54", "#dc8878", "#f0b8a4"), tone, 0.4);
    const HOTVEIN = ramp("#6a0404", "#b01008", "#e8401a", "#ff8a40", "#ffd090");
    for (let y = 0; y < s; y++)
      for (let x = 0; x < s; x++) {
        const i = y * s + x;
        const v = Math.max(v1[i], v2[i] * 0.75);
        if (v > 0.3) {
          p.setColor(i, rampColor(HOTVEIN, clamp01(v), x, y, 0.5));
          p.emit[i] = smooth(0.3, 0.9, v);
        } else p.emit[i] = 0.08;
      }
    roughFrom(p, 0.2, n, 0.05);
  },
  { glow: 2.5 },
);
