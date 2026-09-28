import {
  fbm,
  fbmXY,
  field,
  grainNoise,
  lightField,
  paintTone,
  ramp,
  rivet,
  roughFrom,
  wrapDelta,
} from "../brushes";
import { registerMaterial } from "../library";
import { hex, type Paint } from "../paint";
import { BRASS, GOLD, paintPlates } from "./common";

/** Stratum 8 — the Orrery: the machine built to turn the dreamer in its
 * sleep; it still turns. Polished brass, engraved dials, gear inlays, and
 * a ceiling that is a star chart. */

/** Raise a gear (teeth, rim, spokes, hub) into the height field; returns
 * nothing, marks texels in `mask` with 1 (gear) or 2 (hub hole). */
function gear(p: Paint, mask: Uint8Array, cx: number, cy: number, r: number, teeth: number, spokes: number): void {
  const R = r + 2;
  for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++)
    for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      const tooth = Math.cos(a * teeth) > 0.1;
      const outer = r + (tooth ? 2 : 0);
      if (d > outer) continue;
      const i = p.idx(x, y);
      const hub = r * 0.22;
      let on = false;
      let h = 0.7;
      if (d < hub) {
        mask[i] = 2;
        p.height[i] = 0.3;
        continue;
      }
      if (d < hub + 2) on = true;
      else if (d > r - 2.5) on = true;
      else {
        // Spokes: thin radial arms.
        const sa = ((a / (Math.PI * 2)) * spokes + 100) % 1;
        if (Math.abs(sa - 0.5) * (Math.PI * 2 * d) / spokes < 1.3) on = true;
      }
      if (!on) continue;
      if (Math.abs(d - (r - 2.5)) < 0.7 || Math.abs(d - (hub + 2)) < 0.7) h = 0.62;
      mask[i] = 1;
      p.height[i] = h;
    }
}

registerMaterial("orrery.brass_panel", (p) => {
  // Polished brass plates; one is engraved as an astrolabe dial (rings,
  // ticks, a pointer), the rest carry fine rulings.
  const s = p.size;
  const L = paintPlates(p, { ramp: BRASS, min: 32, max: 64, rivets: 8, rough: 0.24, brushed: true, dents: 2, wear: 0.3 });
  const big = L.rects.reduce((a, r) => (r.w * r.h > a.w * a.h ? r : a), L.rects[0]);
  const cx = big.x + big.w / 2;
  const cy = big.y + big.h / 2;
  const R = Math.min(big.w, big.h) / 2 - 5;
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      if (L.id[i] < 0) continue;
      const dx = wrapDelta(x + 0.5, cx, s);
      const dy = wrapDelta(y + 0.5, cy, s);
      const d = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      const ring = Math.abs(d - R) < 0.6 || Math.abs(d - R * 0.62) < 0.5;
      const tick = d > R - 3 && d < R && Math.abs(((a / (Math.PI * 2)) * 24 + 100) % 1 - 0.5) > 0.44;
      const pointer = Math.abs(dy * Math.cos(0.7) - dx * Math.sin(0.7)) < 0.6 && d < R * 0.9 && dx * Math.cos(0.7) + dy * Math.sin(0.7) > 0;
      if (ring || tick || pointer) {
        p.height[i] -= 0.08;
        p.mix(i, hex("#2a1e08"), 0.6);
        p.rough[i] = 0.5;
      }
    }
  rivet(p, cx, cy, 2, { ramp: BRASS, h: 0.2, rough: 0.2 });
});

registerMaterial("orrery.cog_floor", (p) => {
  // Dark iron floor inlaid with brass gears that mesh across tile edges.
  const s = p.size;
  const n = fbm(p, 6, 3, 1401);
  const g = grainNoise(p, 1402);
  for (let i = 0; i < n.length; i++) p.height[i] = 0.45 + (n[i] - 0.5) * 0.04;
  const mask = new Uint8Array(s * s);
  gear(p, mask, 26, 26, 17, 18, 6);
  gear(p, mask, 56, 54, 8, 10, 4);
  gear(p, mask, 58, 12, 6, 8, 3);
  gear(p, mask, 10, 58, 5, 7, 3);
  const light = lightField(p, 1.8);
  const tone = field(p);
  for (let i = 0; i < n.length; i++) tone[i] = 0.5 + light[i] + (n[i] - 0.5) * 0.2 + (g[i] - 0.5) * 0.05;
  const DARK = ramp("#0b0b0d", "#16161a", "#222228", "#303038", "#40404a");
  paintTone(p, (i) => (mask[i] === 1 ? BRASS : DARK), tone, 0.3);
  for (let i = 0; i < n.length; i++) {
    const brass = mask[i] === 1;
    p.metal[i] = brass ? 1 : 0.7;
    p.rough[i] = brass ? 0.26 : 0.5;
    if (mask[i] === 2) p.setColor(i, hex("#050506"));
    // Shadow ring where the inlay meets the floor.
    if (!mask[i] && (mask[p.idx((i % s) - 1, ((i / s) | 0) - 1)] === 1)) p.shade(i, 0.5);
  }
});

registerMaterial(
  "orrery.star_ceiling",
  (p) => {
    // A painted firmament: deep lapis, stars of several magnitudes (the
    // bright ones cross-shaped), gold constellation lines and orbit arcs,
    // all gently emissive so the chart reads in the dark.
    const s = p.size;
    const n = fbm(p, 3, 3, 1411);
    const tone = field(p);
    for (let i = 0; i < n.length; i++) tone[i] = 0.35 + (n[i] - 0.5) * 0.3;
    paintTone(p, ramp("#03040c", "#070a1c", "#0c1230", "#141c44", "#1e2a5a"), tone, 0.5);
    roughFrom(p, 0.6);
    for (let i = 0; i < n.length; i++) p.emit[i] = 0.12;
    const stars: [number, number][] = [];
    for (let k = 0; k < 40; k++) {
      const x = p.rng.int(0, s - 1);
      const y = p.rng.int(0, s - 1);
      const mag = p.rng.next();
      stars.push([x, y]);
      const c = mag > 0.8 ? hex("#fff4d0") : mag > 0.4 ? hex("#c8d4ff") : hex("#7080b0");
      p.set(x, y, { c, e: 1, h: 0.55 });
      if (mag > 0.85) for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.set(x + ox, y + oy, { c: hex("#a0a8d0"), e: 0.8 });
    }
    // Constellations: chains of nearby stars joined by gilt lines.
    for (let k = 0; k < 3; k++) {
      let a = stars[p.rng.int(0, stars.length - 1)];
      for (let j = 0; j < 3; j++) {
        const b: [number, number] = [a[0] + p.rng.int(-7, 7), a[1] + p.rng.int(-7, 7)];
        p.line(a[0], a[1], b[0], b[1], (i) => {
          if (p.emit[i] < 0.9) p.set(i % s, (i / s) | 0, { c: GOLD[3], m: 1, r: 0.3, e: 0.35 });
        });
        p.set(b[0], b[1], { c: hex("#fff4d0"), e: 1 });
        a = b;
      }
    }
    // Orbit arcs.
    for (const [r, cx, cy] of [
      [26, 32, 32],
      [40, 20, 44],
    ])
      for (let t = 0; t < 400; t++) {
        const a = (t / 400) * Math.PI * 2;
        if (Math.sin(a * 5) > 0.6) continue;
        const i = p.idx(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        if (p.emit[i] < 0.9) {
          p.setColor(i, GOLD[2]);
          p.metal[i] = 1;
          p.rough[i] = 0.3;
          p.emit[i] = 0.25;
        }
      }
  },
  { glow: 2.5 },
);

registerMaterial("orrery.trim", (p) => {
  // Brass rack: a toothed upper edge, a rivet line, a recessed channel
  // with an engraved scale of ticks.
  const s = p.size;
  const n = fbmXY(p, 2, 16, 2, 1421);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      let h: number;
      const tooth = x % 8;
      if (y < 8) h = tooth >= 2 && tooth <= 5 && y >= (tooth === 2 || tooth === 5 ? 2 : 0) ? 0.85 : 0.2;
      else if (y < 26) h = 0.7;
      else if (y < 30) h = 0.5;
      else if (y < 46) h = 0.4 + (y === 30 || y === 45 ? 0.05 : 0) - (y > 36 && x % 4 === 0 && y < (x % 16 === 0 ? 44 : 41) ? 0.1 : 0);
      else if (y < 50) h = 0.5;
      else h = 0.72;
      p.height[i] = h;
    }
  const light = lightField(p, 1.6);
  const tone = field(p);
  for (let i = 0; i < n.length; i++) tone[i] = 0.55 + light[i] + (n[i] - 0.5) * 0.2 + (p.height[i] < 0.3 ? -0.5 : p.height[i] < 0.45 ? -0.15 : 0);
  paintTone(p, BRASS, tone, 0.3);
  p.metal.fill(1);
  roughFrom(p, 0.25, n, 0.05);
  for (let x = 4; x < s; x += 8) rivet(p, x + 0.5, 17.5, 1.5, { ramp: BRASS, h: 0.15, rough: 0.22 });
  for (let i = 0; i < n.length; i++) if (p.height[i] < 0.3) {
    p.setColor(i, hex("#0a0806"));
    p.metal[i] = 0;
  }
});
