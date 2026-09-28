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
  isoLines,
  lightField,
  moss,
  paintTone,
  puddles,
  ramp,
  rampColor,
  roughFrom,
  smooth,
  speckle,
  woodGrain,
  type Ramp,
} from "../brushes";
import { registerMaterial } from "../library";
import { hex, type Paint } from "../paint";
import { BRASS, WOOD_DARK, WOOD_RED, bookRow, paintMarble, paintMasonry } from "./common";

/** Stratum 2 — the Drowned Archive: flooded libraries of scholars who tried
 * to write God's true name. Dark polished wood, marble, damp plaster,
 * tide-lines and mould; everything low is wet. */

const PANEL = ramp("#120a07", "#22140d", "#341f14", "#482c1c", "#5e3b26", "#784d32");
const ALGAE = ramp("#0a140c", "#132616", "#1e3a1e", "#2e5226", "#446a30");

/** Wet darkening + gloss (flood damage), masked. */
function soak(p: Paint, i: number, k: number): void {
  p.shade(i, 1 - 0.3 * k);
  p.rough[i] = Math.min(p.rough[i], 0.85 - 0.6 * k);
}

registerMaterial("archive.wood_panel", (p) => {
  // Wainscot: 2×2 raised-and-fielded panels. Stiles run vertical grain,
  // rails horizontal; the fielded panel is bevelled down to a quirk.
  const s = p.size;
  const gv = woodGrain(p, { vertical: true, rings: 16, knots: 1, salt: 1 });
  const gh = woodGrain(p, { rings: 16, knots: 0, salt: 2 });
  const tone = field(p);
  const part = new Uint8Array(s * s);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      const lx = x % 32;
      const ly = y % 32;
      const d = Math.min(lx, ly, 31 - lx, 31 - ly);
      let h: number;
      if (d === 0) h = 0.45;
      else if (d < 5) h = 0.74;
      else if (d === 5) h = 0.4;
      else if (d < 9) h = 0.44 + (d - 5) * 0.06;
      else h = 0.66;
      p.height[i] = h;
      // Rails are the horizontal members of the frame.
      const rail = d < 5 && (ly < 5 || ly > 26) && lx >= 5 && lx <= 26;
      part[i] = d < 5 ? (rail ? 2 : 1) : 0;
    }
  const light = lightField(p, 1.4);
  for (let i = 0; i < tone.length; i++) {
    const g = part[i] === 2 ? gh : gv;
    tone[i] = 0.52 + (g.tone[i] - 0.5) * 0.7 - g.line[i] * 0.2 + light[i] + (part[i] === 0 ? 0.06 : 0);
  }
  paintTone(p, PANEL, tone, 0.3);
  roughFrom(p, 0.38, gv.tone, 0.06);
  // Flood damage: dark swollen blotches, pale mould bloom.
  const dmg = fbm(p, 3, 3, 801);
  for (let i = 0; i < tone.length; i++) if (dmg[i] > 0.66) soak(p, i, smooth(0.66, 0.85, dmg[i]));
  speckle(p, { density: 0.025, color: hex("#8a9070"), amount: 0.45, mask: (i) => dmg[i] > 0.7 });
});

registerMaterial("archive.parquet", (p) => {
  // Chevron parquet: 16-texel columns of diagonal slats, alternating lean,
  // each slat its own tint; waxed (fairly glossy), a few water-lifted slats.
  const s = p.size;
  const ramps: Ramp[] = [WOOD_RED, PANEL, ramp("#1e1209", "#3a2414", "#58371e", "#76492a", "#935d36", "#b07444")];
  const id = new Int32Array(s * s);
  const along = field(p);
  const tone = field(p);
  const fib = fbm(p, 16, 2, 811);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      const col = x >> 4;
      const lx = x & 15;
      const lean = col & 1 ? lx : 15 - lx;
      const v = y + lean;
      const slat = Math.floor(v / 8);
      const across = v - slat * 8;
      id[i] = col * 97 + (((slat % 8) + 8) % 8);
      along[i] = lx;
      p.height[i] = across === 7 || lx === 15 ? 0.3 : 0.6;
      tone[i] = across === 7 || lx === 15 ? -1 : across;
    }
  const light = lightField(p, 1);
  const n = fbm(p, 4, 2, 812);
  for (let i = 0; i < tone.length; i++) {
    const c = id[i];
    const r = ((c * 2654435761) >>> 0) / 4294967296;
    if (tone[i] < 0) {
      p.setColor(i, PANEL[0]);
      p.rough[i] = 0.9;
      continue;
    }
    const grain = Math.sin((along[i] + fib[i] * 6) * 1.3) * 0.08;
    const t = 0.5 + (r - 0.5) * 0.22 + grain + light[i] + (tone[i] === 0 ? 0.08 : 0);
    const R = ramps[Math.floor(((r * 7.31) % 1) * ramps.length)];
    p.setColor(i, rampColor(R, t, i % s, (i / s) | 0, 0.3));
    p.rough[i] = 0.34 + n[i] * 0.2;
  }
  // Water damage: a lifted, darkened patch.
  for (let i = 0; i < tone.length; i++) if (n[i] > 0.75) soak(p, i, (n[i] - 0.75) * 3);
});

registerMaterial("archive.tile", (p) => {
  // Worn marble checker: pale veined marble against green-black serpentine,
  // polished to a mirror except where feet have dulled it.
  const s = p.size;
  const white = paintMarble(p, ramp("#8a8680", "#a8a49c", "#c2bdb2", "#d6d0c4", "#e6e0d4", "#f2ede2"), ramp("#4e4c48", "#6c6962", "#8a867e"), { salt: 3 });
  const light = Float32Array.from(p.albedo);
  const dark = paintMarble(p, ramp("#050807", "#0a110e", "#101a16", "#17241f", "#1f302a", "#2a3e36"), ramp("#4a6a5a", "#6e8e7c", "#9ab4a2"), { salt: 9, veins: 3 });
  const wear = fbm(p, 3, 3, 821);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      const lx = x & 15;
      const ly = y & 15;
      const isWhite = ((x >> 4) + (y >> 4)) & 1;
      const grout = lx === 15 || ly === 15;
      if (isWhite && !grout) {
        p.albedo[i * 3] = light[i * 3];
        p.albedo[i * 3 + 1] = light[i * 3 + 1];
        p.albedo[i * 3 + 2] = light[i * 3 + 2];
      }
      const edge = Math.min(lx, ly, 14 - lx, 14 - ly);
      p.height[i] = grout ? 0.3 : 0.6 - (edge === 0 ? 0.06 : 0) - (isWhite ? white[i] : dark[i]) * 0.02;
      p.rough[i] = grout ? 0.9 : 0.12 + smooth(0.55, 0.85, wear[i]) * 0.35;
      if (grout) p.setColor(i, hex("#2a2620"));
      else if (edge === 0) p.shade(i, 0.85);
      // Scuffs dull and lighten the polish.
      if (!grout && wear[i] > 0.7) p.mix(i, hex("#b8b0a0"), (wear[i] - 0.7) * 0.4);
    }
  // A chipped corner or two, and a hairline crack.
  for (let k = 0; k < 3; k++) {
    const tx = p.rng.int(0, 3) * 16 + (p.rng.chance(0.5) ? 0 : 12);
    const ty = p.rng.int(0, 3) * 16 + (p.rng.chance(0.5) ? 0 : 12);
    p.disc(tx + 1.5, ty + 1.5, 2.2, (i) => {
      p.height[i] -= 0.15;
      p.setColor(i, hex("#3a3630"));
      p.rough[i] = 0.9;
    });
  }
  cracks(p, { count: 2, length: [8, 16], depth: 0.1, color: hex("#3a3832") });
});

registerMaterial("archive.shelves", (p) => {
  // A bookcase wall: two shelves of mixed spines between thick uprights.
  // The lower shelf took the flood: swollen, darkened, mouldy spines.
  bookRow(p, 0, 32, { shelf: PANEL });
  bookRow(p, 32, 32, { shelf: PANEL });
  const s = p.size;
  const g = woodGrain(p, { vertical: true, rings: 10, knots: 0, salt: 5 });
  for (let y = 0; y < s; y++)
    for (let x = 0; x < 5; x++) {
      const i = y * s + x;
      const t = 0.55 + (g.tone[i] - 0.5) * 0.5 - g.line[i] * 0.2 + (x === 0 ? 0.25 : x === 4 ? -0.3 : 0);
      p.setColor(i, rampColor(PANEL, t, x, y, 0.3));
      p.height[i] = 0.92 - (x === 4 ? 0.1 : 0);
      p.rough[i] = 0.5;
      p.metal[i] = 0;
    }
  for (let y = 0; y < s; y++) p.shade(p.idx(5, y), 0.5);
  const dmg = fbm(p, 4, 2, 831);
  for (let y = 40; y < 60; y++)
    for (let x = 5; x < s; x++) {
      const i = y * s + x;
      if (dmg[i] > 0.55) soak(p, i, clamp01((dmg[i] - 0.55) * 3));
    }
  speckle(p, { density: 0.02, color: hex("#9aa080"), amount: 0.5, mask: (i) => i > 44 * s && dmg[i] > 0.6 });
});

registerMaterial("archive.plaster_mold", (p) => {
  // Damp ceiling plaster: tide rings from old leaks, colonies of black
  // mould spreading from their centres, cracks and a peeled patch.
  const n = fbm(p, 4, 3, 841);
  const g = grainNoise(p, 842);
  for (let i = 0; i < n.length; i++) p.height[i] = 0.55 + (n[i] - 0.5) * 0.06 + (g[i] - 0.5) * 0.02;
  const light = lightField(p, 1.2);
  const tone = field(p);
  for (let i = 0; i < n.length; i++) tone[i] = 0.62 + (n[i] - 0.5) * 0.18 + light[i];
  paintTone(p, ramp("#48463c", "#6a665a", "#8c877a", "#aaa596", "#c4bfae", "#d8d3c2"), tone, 0.3);
  const leak = fbm(p, 2, 3, 843);
  const ringPh = field(p);
  for (let i = 0; i < n.length; i++) ringPh[i] = leak[i] * 5;
  const rings = isoLines(p, ringPh, 1);
  for (let i = 0; i < n.length; i++) {
    if (leak[i] > 0.55) p.mix(i, hex("#8a7a58"), (leak[i] - 0.55) * 0.6);
    if (rings[i] > 0.5 && leak[i] > 0.35) p.mix(i, hex("#6a5a3a"), 0.45);
  }
  // Mould colonies: dense dark cores, stippled halos.
  const c = cellular(p, 4, 844, 0.9);
  for (let i = 0; i < n.length; i++) {
    const colony = ((c.id[i] * 2654435761) >>> 0) / 4294967296 < 0.6;
    if (!colony) continue;
    const d = c.f1[i] + (g[i] - 0.5) * 3 + (n[i] - 0.5) * 4;
    if (d < 3) {
      p.mix(i, hex("#15180f"), 0.85);
      p.height[i] += 0.03;
      p.rough[i] = 0.98;
    } else if (d < 6 && g[i] > 0.55) p.mix(i, hex("#2a3020"), 0.6);
    else if (d < 8 && g[i] > 0.85) p.mix(i, hex("#3a4030"), 0.5);
  }
  cracks(p, { count: 3, length: [10, 24], depth: 0.12 });
  drips(p, { count: 5, color: hex("#5a5040"), strength: 0.2, minLen: 4, maxLen: 10 });
  roughFrom(p, 0.9, n, 0.04);
  for (let i = 0; i < n.length; i++) if (leak[i] > 0.7) p.rough[i] = 0.5;
});

registerMaterial("archive.trim", (p) => {
  // Carved moulding in dark wood: fillet, cove, dentil course, bead, a
  // rope-twist, a broad fascia with an inlaid brass line, fillet.
  const s = p.size;
  const g = woodGrain(p, { rings: 14, knots: 0, salt: 7 });
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      let h: number;
      if (y < 3) h = 0.85;
      else if (y < 9) h = 0.8 - Math.sin(((y - 3) / 6) * Math.PI) * 0.18;
      else if (y < 17) h = x % 6 < 4 ? 0.78 : 0.45;
      else if (y === 17) h = 0.5;
      else if (y < 21) h = 0.62 + Math.sin(((y - 18) / 3) * Math.PI) * 0.12 - (x % 3 === 2 ? 0.06 : 0);
      else if (y < 29) h = 0.55 + Math.sin(((x + (y - 21) * 1) / 8) * Math.PI * 2) * 0.12;
      else if (y === 29) h = 0.45;
      else if (y < 60) h = 0.66;
      else h = 0.82;
      p.height[i] = h;
    }
  const light = lightField(p, 1.6);
  const tone = field(p);
  for (let i = 0; i < tone.length; i++) tone[i] = 0.5 + (g.tone[i] - 0.5) * 0.5 - g.line[i] * 0.15 + light[i];
  paintTone(p, WOOD_DARK, tone, 0.3);
  roughFrom(p, 0.42, g.tone, 0.06);
  for (let x = 0; x < s; x++) {
    for (const [y, t] of [
      [44, 0.8],
      [45, 0.45],
    ] as const) {
      const i = p.idx(x, y);
      p.setColor(i, rampColor(BRASS, t, x, y, 0.3));
      p.metal[i] = 1;
      p.rough[i] = 0.3;
      p.height[i] = 0.64;
    }
  }
});

registerMaterial("archive.flooded_stone", (p) => {
  // Big blocks at the waterline: dry and pale above, a crust of salts and
  // green algae at the tide mark, dark, slick and slimed below. Authored
  // for one repeat per wall height (texel row 63 at the floor).
  const s = p.size;
  const L = bricks(p, { rows: 5, minW: 16, maxW: 30, warp: 0.8 });
  paintMasonry(p, L, {
    ramps: [ramp("#171a1c", "#2a2f31", "#3f4547", "#565d5e", "#6f7676", "#8a908e")],
    mortar: ramp("#0a0c0c", "#161a1a", "#242828"),
    chip: 0.3,
    pits: 12,
  });
  const tide = 38;
  const wob = fbmXY(p, 6, 1, 2, 851);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      const line = tide + (wob[i] - 0.5) * 4;
      if (y > line) {
        const k = clamp01((y - line) / 10);
        soak(p, i, 0.6 + k * 0.4);
        p.mix(i, ALGAE[2], 0.25 + k * 0.35);
      } else if (y > line - 3) {
        p.mix(i, hex("#b8b4a0"), 0.35);
        p.rough[i] = 0.95;
      }
    }
  moss(p, { ramp: ALGAE, coverage: 0.14, crevice: 1.2, bottom: 2.5, freq: 8, mask: (i) => ((i / s) | 0) > tide - 4 });
  drips(p, { count: 6, color: hex("#1a2a1a"), strength: 0.35, minLen: 6, maxLen: 14, wet: 0.2, start: () => tide + 2 });
  puddles(p, { coverage: 0.04, rough: 0.08, darken: 0.2 });
});
