import {
  cellular,
  clamp01,
  fbm,
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
import { hex, type Paint, type RGB } from "../paint";
import { HONEY, ICE, paintLava } from "./common";

/** Floor-surface overlays for the 0.5 m surface grid (water, oil, blood…).
 * Liquids are dark, flat and very smooth: their look comes from SSR
 * mirroring the room, so albedo stays low and roughness near zero; ripples
 * live in the height (normal) channel. worldSize 1 so a cell shows half a
 * repeat and neighbouring cells don't visibly repeat. */

/** Concentric ripple rings from a few drop points plus a slow swell, into
 * height only. Returns the ring mask. */
function ripples(p: Paint, drops: number, amp: number, salt: number): Float32Array {
  const s = p.size;
  const swell = fbm(p, 2, 3, 1801 + salt);
  const ring = field(p);
  const pts: [number, number, number][] = [];
  for (let k = 0; k < drops; k++) pts.push([p.rng.range(0, s), p.rng.range(0, s), p.rng.range(8, 18)]);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      let h = (swell[i] - 0.5) * 0.12;
      for (const [cx, cy, R] of pts) {
        let dx = Math.abs(x + 0.5 - cx);
        let dy = Math.abs(y + 0.5 - cy);
        dx = Math.min(dx, s - dx);
        dy = Math.min(dy, s - dy);
        const d = Math.hypot(dx, dy);
        if (d < R) {
          const w = Math.sin(d * 1.3) * (1 - d / R);
          h += w * amp;
          ring[i] = Math.max(ring[i], w);
        }
      }
      p.height[i] = 0.5 + h;
    }
  return ring;
}

/** A liquid: ramp-toned depth variation, ripples, glossy. */
function liquid(p: Paint, r: Ramp, o: { rough: number; drops?: number; amp?: number; salt: number; tone?: number }): Float32Array {
  const n = fbm(p, 3, 3, 1811 + o.salt);
  const ring = ripples(p, o.drops ?? 3, o.amp ?? 0.08, o.salt);
  const light = lightField(p, 1);
  const tone = field(p);
  for (let i = 0; i < n.length; i++) tone[i] = (o.tone ?? 0.45) + (n[i] - 0.5) * 0.3 + light[i] * 0.5 + ring[i] * 0.08;
  paintTone(p, r, tone, 0.5);
  roughFrom(p, o.rough, n, 0.02);
  return n;
}

registerMaterial("surface.water", (p) => {
  liquid(p, ramp("#050a0c", "#0a1418", "#102026", "#182e36", "#224048"), { rough: 0.03, drops: 3, salt: 0 });
  speckle(p, { density: 0.006, color: hex("#8ab0c0"), amount: 0.6 });
}, { worldSize: 1, normal: 1.5 });

/** Thin-film interference: hue cycles with film thickness. */
function thinFilm(t: number): RGB {
  const a = t * Math.PI * 2;
  return [0.5 + 0.5 * Math.cos(a), 0.5 + 0.5 * Math.cos(a - 2.1), 0.5 + 0.5 * Math.cos(a - 4.2)];
}

registerMaterial("surface.oil", (p) => {
  // Black lamp oil with an iridescent skin: rainbow bands follow the
  // film's thickness contours; almost perfectly smooth.
  const n = liquid(p, ramp("#030303", "#070606", "#0c0a09", "#12100e", "#1a1714"), { rough: 0.03, drops: 1, amp: 0.03, salt: 10 });
  const th = fbm(p, 2, 3, 1821);
  const ph = th.map((v) => v * 4);
  const band = isoLines(p, ph, 3);
  for (let i = 0; i < n.length; i++) {
    const film = thinFilm(th[i] * 4);
    p.mix(i, [film[0] * 0.42, film[1] * 0.36, film[2] * 0.46], 0.2 + band[i] * 0.25);
  }
}, { worldSize: 1, normal: 1 });

registerMaterial("surface.blood", (p) => {
  // A pool of blood: near-black red at the deep middle, brighter at thin
  // edges, clotting into darker, duller skins.
  const n = liquid(p, ramp("#120104", "#260308", "#40060e", "#5e0c14", "#7e1a1e"), { rough: 0.08, drops: 1, amp: 0.03, salt: 20, tone: 0.5 });
  const clot = fbm(p, 6, 3, 1831);
  for (let i = 0; i < n.length; i++)
    if (clot[i] > 0.66) {
      p.mix(i, hex("#1a0204"), 0.6);
      p.rough[i] = 0.45;
      p.height[i] += 0.03;
    }
}, { worldSize: 1, normal: 1.2 });

registerMaterial("surface.ice", (p) => {
  // Frozen puddle: clear dark ice, white fracture lines, trapped bubbles.
  const s = p.size;
  liquid(p, ramp("#0c1c28", "#16303e", "#244a5a", "#3a6a7a", "#5a8e9c"), { rough: 0.04, drops: 0, salt: 30 });
  const c = cellular(p, 4, 1841, 1);
  for (let i = 0; i < c.f1.length; i++)
    if (c.f2[i] - c.f1[i] < 0.8) {
      p.setColor(i, ICE[ICE.length - 2]);
      p.rough[i] = 0.3;
      p.height[i] -= 0.03;
    }
  for (let k = 0; k < 12; k++) p.set(p.rng.int(0, s - 1), p.rng.int(0, s - 1), { c: ICE[ICE.length - 1] });
}, { worldSize: 1 });

registerMaterial("surface.lava", (p) => paintLava(p, { freq: 4, open: 3.5, salt: 5 }), { glow: 4, worldSize: 1 });

registerMaterial(
  "surface.acid",
  (p) => {
    // Bubbling acid: poisonous green, lit from within, frothy bubble rims.
    const s = p.size;
    const n = liquid(p, ramp("#0a2a04", "#185808", "#2c8a0e", "#52b81a", "#8ae43a", "#d4ff8a"), { rough: 0.05, drops: 2, salt: 40, tone: 0.5 });
    for (let k = 0; k < 22; k++) {
      const x = p.rng.range(0, s);
      const y = p.rng.range(0, s);
      const r = p.rng.range(0.8, 2.4);
      p.disc(x, y, r, (i, d) => {
        p.height[i] += (1 - d * d) * 0.12;
        if (d > 0.6) p.setColor(i, hex("#d8ff9a"));
      });
    }
    for (let i = 0; i < n.length; i++) p.emit[i] = 0.35 + n[i] * 0.4;
  },
  { glow: 2.5, worldSize: 1 },
);

registerMaterial("surface.honey", (p) => {
  // Spilled honey: thick golden swirls, glossy, slowly folding over itself.
  const n = liquid(p, HONEY, { rough: 0.1, drops: 0, salt: 50, tone: 0.55 });
  const sw = fbm(p, 2, 3, 1851);
  const fold = isoLines(p, sw.map((v) => v * 3), 1.2);
  for (let i = 0; i < n.length; i++) {
    if (fold[i] > 0.4) p.mix(i, HONEY[HONEY.length - 2], 0.25);
    p.height[i] += fold[i] * 0.05;
    p.emit[i] = 0.05;
  }
}, { worldSize: 1 });

registerMaterial(
  "surface.web",
  (p) => {
    // Web sheeted across the floor: dense criss-cross strands, clumped.
    const s = p.size;
    p.alpha.fill(0);
    const n = fbm(p, 6, 2, 1861);
    const W = ramp("#7a7a74", "#a8a8a0", "#d0d0c8", "#f0f0ea");
    for (let k = 0; k < 40; k++) {
      const x = p.rng.range(0, s);
      const y = p.rng.range(0, s);
      const a = p.rng.range(0, Math.PI);
      const len = p.rng.range(10, 40);
      p.line(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len, (i) => {
        if (n[i] < 0.2) return;
        p.alpha[i] = 1;
        p.setColor(i, rampColor(W, 0.3 + n[i] * 0.6, i % s, (i / s) | 0));
        p.rough[i] = 0.7;
        p.height[i] = 0.6;
      });
    }
    for (let i = 0; i < n.length; i++)
      if (n[i] > 0.8) {
        p.alpha[i] = 1;
        p.setColor(i, W[1]);
      }
  },
  { cutout: true, worldSize: 1 },
);

registerMaterial(
  "surface.ash",
  (p) => {
    // Grey ash drift with charcoal flecks and a few embers still alive.
    const s = p.size;
    const n = fbm(p, 4, 3, 1871);
    const g = grainNoise(p, 1872);
    for (let i = 0; i < n.length; i++) p.height[i] = 0.5 + (n[i] - 0.5) * 0.15 + (g[i] - 0.5) * 0.04;
    const light = lightField(p, 1.2);
    const tone = field(p);
    for (let i = 0; i < n.length; i++) tone[i] = 0.55 + (n[i] - 0.5) * 0.3 + light[i] + (g[i] - 0.5) * 0.2;
    paintTone(p, ramp("#1a1918", "#2e2c2a", "#454240", "#5e5a56", "#7a7570", "#96918a"), tone, 0.5);
    speckle(p, { density: 0.04, color: hex("#0a0908"), amount: 0.8 });
    roughFrom(p, 1);
    for (let k = 0; k < 7; k++) {
      const x = p.rng.int(0, s - 1);
      const y = p.rng.int(0, s - 1);
      p.set(x, y, { c: hex("#ff7a20"), e: 1 });
      if (p.rng.chance(0.5)) p.set(x + 1, y, { c: hex("#b02a08"), e: 0.6 });
    }
  },
  { glow: 3, worldSize: 1 },
);

registerMaterial(
  "surface.spores",
  (p) => {
    // A settled carpet of spores: velvety, clumped, faintly luminous.
    const c = cellular(p, 10, 1881, 1);
    const n = fbm(p, 5, 3, 1882);
    const g = grainNoise(p, 1883);
    for (let i = 0; i < n.length; i++) p.height[i] = 0.4 + (1 - clamp01(c.f1[i] / 4)) * 0.25 + (g[i] - 0.5) * 0.06;
    const light = lightField(p, 1.2);
    const tone = field(p);
    for (let i = 0; i < n.length; i++) tone[i] = 0.45 + light[i] + (n[i] - 0.5) * 0.3 + (g[i] - 0.5) * 0.25;
    paintTone(p, ramp("#101a16", "#1c2e28", "#2a443a", "#3a5c4c", "#4e7662", "#68927a"), tone, 0.6);
    roughFrom(p, 1);
    for (let i = 0; i < n.length; i++) {
      p.emit[i] = 0.12 * smooth(0.4, 0.9, n[i]);
      if (g[i] > 0.975) {
        p.setColor(i, hex("#a0ffe0"));
        p.emit[i] = 1;
      }
    }
  },
  { glow: 2, worldSize: 1 },
);

registerMaterial("surface.slime", (p) => {
  // Creeping slime: thick glossy green with bubbles and darker streaks.
  const s = p.size;
  const n = liquid(p, ramp("#061404", "#0e2a0a", "#1a4a12", "#2c6e1c", "#46922a", "#72b844"), { rough: 0.1, drops: 0, salt: 60, tone: 0.5 });
  const v = veins(p, 3, 1.4, 1891);
  for (let i = 0; i < n.length; i++) {
    p.height[i] = 0.45 + n[i] * 0.2;
    if (v[i] > 0.4) p.mix(i, hex("#0a1a06"), v[i] * 0.5);
  }
  for (let k = 0; k < 12; k++) {
    const x = p.rng.range(0, s);
    const y = p.rng.range(0, s);
    p.disc(x, y, p.rng.range(1, 2.4), (i, d) => {
      p.height[i] += (1 - d * d) * 0.12;
      if (d > 0.65) p.setColor(i, hex("#a8e070"));
    });
  }
  for (let i = 0; i < n.length; i++) p.emit[i] = 0.04;
}, { worldSize: 1 });

registerMaterial("surface.ink", (p) => {
  // Spilled ink: blue-black, glossy, with a violet sheen where it thins.
  const n = liquid(p, ramp("#020206", "#05050e", "#090a18", "#0e1024", "#161834"), { rough: 0.05, drops: 2, amp: 0.05, salt: 70 });
  for (let i = 0; i < n.length; i++) if (n[i] > 0.7) p.mix(i, hex("#3a1a5a"), (n[i] - 0.7) * 1.2);
}, { worldSize: 1 });
