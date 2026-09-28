import {
  bricks,
  clamp01,
  cracks,
  drips,
  fbm,
  fbmXY,
  field,
  grainNoise,
  grime,
  lightField,
  moss,
  paintTone,
  puddles,
  ramp,
  rampColor,
  rune,
  slabs,
  smooth,
  speckle,
  stamp,
  type Ramp,
} from "../brushes";
import { registerMaterial } from "../library";
import { hex, type Paint } from "../paint";
import { BONE, paintDirt, paintMasonry } from "./common";

/** Stratum 1 — the Undercroft: candlelit catacombs of the first rim
 * villagers, who buried themselves closer to God. Warm tuff and limestone,
 * candle soot, nitre bloom in the mortar, damp and old bone. */

export const CRYPT = ramp("#171310", "#2b241e", "#40362d", "#574a3e", "#6f604f", "#8a7a66");
export const CRYPT_WARM = ramp("#1b140f", "#31251b", "#4a3827", "#624b34", "#7c6143", "#977a56");
export const CRYPT_GREY = ramp("#141315", "#272528", "#3c393b", "#524e4f", "#6a6563", "#858079");
export const CRYPT_MORTAR = ramp("#0b0908", "#1a1613", "#2a241f", "#3b342c");
export const SOOT = hex("#0c0a09");
/** Cellar moss: dark, desaturated — it grows without sun. */
export const CRYPT_MOSS = ramp("#0e120a", "#1a2212", "#28331a", "#384524", "#4a562e");
export const NITRE = hex("#cfc8b4");

/** Nitre (saltpetre) bloom: chalky white crust feathering out of damp
 * mortar joints — the catacomb tell. */
function nitre(p: Paint, amount: number, salt = 0): void {
  const n = fbm(p, 6, 3, 601 + salt);
  const g = grainNoise(p, 602 + salt);
  for (let i = 0; i < n.length; i++) {
    const low = 0.4 - p.height[i];
    const v = n[i] + low * 1.5 + g[i] * 0.25;
    if (v > 1.05 - amount) p.mix(i, NITRE, clamp01((v - (1.05 - amount)) * 3) * 0.7);
  }
}

registerMaterial("crypt.brick", (p) => {
  const L = bricks(p, { rows: 8, minW: 13, maxW: 24, warp: 0.6 });
  paintMasonry(p, L, { ramps: [CRYPT, CRYPT, CRYPT_WARM, CRYPT_GREY], mortar: CRYPT_MORTAR, chip: 0.35, pits: 14, tint: 0.12, noise: 0.22 });
  nitre(p, 0.3);
  cracks(p, { count: 3, length: [6, 16], depth: 0.18, mask: (i) => L.id[i] >= 0 });
  // Candle soot licks up in patches; damp and moss keep to the joints.
  grime(p, { color: SOOT, amount: 0.45, from: "none", freq: 3, salt: 3 });
  moss(p, { ramp: CRYPT_MOSS, coverage: 0.05, crevice: 1.6, bottom: 0.25, freq: 7 });
  const wet = fbm(p, 3, 2, 604);
  for (let i = 0; i < wet.length; i++)
    if (wet[i] > 0.7) {
      p.rough[i] = Math.min(p.rough[i], 0.45);
      p.shade(i, 0.88);
    }
});

registerMaterial("crypt.slab", (p) => {
  // Worn floor flags: smooth-trodden centres, broken edges, water standing
  // in the cracks and joints (mirror-bright under torches), and one tomb
  // slab with a carved border and a line of runes.
  const L = slabs(p, { min: 10, max: 38, gap: 1, warp: 1.2 });
  paintMasonry(p, L, { ramps: [CRYPT, CRYPT_GREY], mortar: CRYPT_MORTAR, chip: 0.3, pits: 10, tint: 0.14, noise: 0.25, bevel: 2 });
  let best = 0;
  for (let k = 1; k < L.rects.length; k++) if (L.rects[k].w * L.rects[k].h > L.rects[best].w * L.rects[best].h) best = k;
  const r = L.rects[best];
  if (r.w >= 16 && r.h >= 14) {
    for (let x = 2; x < r.w - 3; x++)
      for (const y of [2, r.h - 4]) {
        const i = p.idx(r.x + x, r.y + y);
        p.height[i] -= 0.1;
        p.shade(i, 0.6);
      }
    for (let y = 2; y < r.h - 3; y++)
      for (const x of [2, r.w - 4]) {
        const i = p.idx(r.x + x, r.y + y);
        p.height[i] -= 0.1;
        p.shade(i, 0.6);
      }
    const n = Math.floor((r.w - 8) / 5);
    for (let k = 0; k < n; k++)
      rune(p, r.x + 5 + k * 5, r.y + Math.floor(r.h / 2) - 2, 3, 5, 700 + k, (i) => {
        p.height[i] -= 0.08;
        p.shade(i, 0.55);
      });
  }
  cracks(p, { count: 4, length: [8, 22], depth: 0.22, mask: (i) => L.id[i] >= 0 });
  // Foot-polish: the middle of each slab is smoother and a touch lighter.
  for (let i = 0; i < L.id.length; i++)
    if (L.id[i] >= 0 && L.edge[i] > 3) {
      p.rough[i] = Math.min(p.rough[i], 0.62);
      p.mix(i, hex("#8a7a66"), 0.06);
    }
  grime(p, { color: hex("#14100c"), amount: 0.5, cavity: 1.5, from: "none", freq: 4 });
  puddles(p, { coverage: 0.07, rough: 0.1, darken: 0.35, tint: hex("#1a2024") });
});

registerMaterial("crypt.ceiling", (p) => {
  // Low vault of small rough-cut stones, blackened by centuries of candle
  // smoke, with calcite straws beading where water seeps through.
  const L = bricks(p, { rows: 10, minW: 7, maxW: 13, warp: 1.2 });
  paintMasonry(p, L, { ramps: [CRYPT_GREY, CRYPT], mortar: CRYPT_MORTAR, chip: 0.45, pits: 18, tint: 0.2, noise: 0.35 });
  const soot = fbm(p, 3, 3, 611);
  for (let i = 0; i < soot.length; i++) p.mix(i, SOOT, clamp01(0.25 + soot[i] * 0.6));
  nitre(p, 0.2, 1);
  for (let k = 0; k < 7; k++) {
    const x = p.rng.int(0, 63);
    const y = p.rng.int(0, 63);
    p.set(x, y, { c: hex("#d8d2c0"), h: 0.9, r: 0.2 });
    p.set(x, y + 1, { c: hex("#a8a090"), h: 0.85, r: 0.2 });
  }
  cracks(p, { count: 3, length: [10, 24], depth: 0.2 });
});

registerMaterial("crypt.trim", (p) => {
  // Carved band: top fillet, a frieze of small memento-mori skulls between
  // bead mouldings, then plain dressed stone with joints, bottom fillet.
  const s = p.size;
  const n = fbm(p, 8, 3, 621);
  const g = grainNoise(p, 622);
  const profile = (y: number): number => {
    if (y < 3) return 0.8 - y * 0.05;
    if (y === 3) return 0.45;
    if (y < 20) return 0.5;
    if (y === 20) return 0.45;
    if (y < 24) return 0.62 + Math.sin(((y - 21) / 3) * Math.PI) * 0.12;
    if (y < 60) return 0.6;
    return 0.78;
  };
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      p.height[i] = profile(y) + (n[i] - 0.5) * 0.06;
      // Beads: little round lumps along the moulding.
      if (y >= 21 && y < 24 && x % 4 === 3) p.height[i] -= 0.1;
      // Block joints in the plain course.
      if (y >= 24 && y < 60 && x % 32 === 31) p.height[i] = 0.3;
    }
  for (let k = 0; k < 4; k++)
    stamp(p, k * 16 + 3, 6, SMALL_SKULL, (i, ch) => {
      p.height[i] = 0.55 + +ch * 0.07;
    });
  const light = lightField(p, 1.6);
  const tone = field(p);
  for (let i = 0; i < n.length; i++) tone[i] = 0.5 + light[i] + (n[i] - 0.5) * 0.25 + (g[i] - 0.5) * 0.1 + (p.height[i] - 0.55) * 0.8;
  paintTone(p, CRYPT_WARM, tone, 0.3);
  cracks(p, { count: 2, length: [6, 12], depth: 0.15 });
  grime(p, { color: SOOT, amount: 0.35, cavity: 2, from: "none" });
  for (let i = 0; i < n.length; i++) p.rough[i] = 0.82;
});

const SMALL_SKULL = [
  ".2332.....",
  "234432....",
  "3444443...",
  "301430....",
  "3443443...",
  ".3232.....",
  ".2121.....",
];

// ─── Ossuary ────────────────────────────────────────────────────────────────

/** Front-facing skull, 11×11. Digits are bone tones (1 dark … 5 light),
 * 0 is a socket or nasal hole (void). */
const SKULL = [
  "...23332...",
  "..2344443..",
  ".234555432.",
  ".345555543.",
  "23445554432",
  "30004540003",
  "30001410003",
  "23443034432",
  ".234303432.",
  "..3232323..",
  "..2121212..",
];

/** Skull turned a little to the right: one socket foreshortened. */
const SKULL_TURNED = [
  "...23332...",
  "..2344443..",
  ".234555432.",
  ".345555543.",
  ".3445554432",
  ".3000454003",
  ".3000141003",
  ".2344303442",
  "..23430342.",
  "...3232322.",
  "...2121211.",
];

const OSS_DARK = ramp("#050404", "#0e0b09", "#1a1510");

/** A band of stacked skulls between y0 and y0+h, with bone rubble and
 * deep shadow behind. */
function skullRow(p: Paint, y0: number, h: number, offset: number, bone: Ramp[]): void {
  const s = p.size;
  // Shadowed recess behind the skulls, with a jumble of bone ends.
  for (let y = y0; y < y0 + h; y++)
    for (let x = 0; x < s; x++) {
      const i = p.idx(x, y);
      p.setColor(i, OSS_DARK[(x * 7 + y * 3) % 5 === 0 ? 2 : 1]);
      p.height[i] = 0.12;
      p.rough[i] = 0.95;
    }
  for (let k = 0; k < 10; k++) {
    const cx = p.rng.range(0, s);
    const cy = y0 + p.rng.range(2, h - 2);
    p.disc(cx, cy, 1.5, (i, d) => {
      p.setColor(i, bone[0][d < 0.5 ? 2 : 1]);
      p.height[i] = 0.25;
    });
  }
  for (let k = 0; k < 4; k++) {
    const x0 = offset + k * 16 + p.rng.int(0, 2);
    const yy = y0 + Math.floor((h - 11) / 2) + p.rng.int(0, 1);
    const r = bone[p.rng.int(0, bone.length - 1)];
    const turned = p.rng.chance(0.35);
    const flip = p.rng.chance(0.5);
    const shade = p.rng.range(-0.08, 0.06);
    const art = turned ? SKULL_TURNED : SKULL;
    stamp(
      p,
      x0,
      yy,
      art,
      (i, ch, lx, ly) => {
        const v = +ch;
        if (v === 0) {
          p.setColor(i, OSS_DARK[0]);
          p.height[i] = 0.1;
          return;
        }
        // Dome shading: upper-left of the cranium catches the light.
        const t = clamp01(v / 5.5 + shade - (lx + ly) * 0.012);
        p.setColor(i, rampColor(r, t, i % s, (i / s) | 0, 0.25));
        p.height[i] = 0.45 + v * 0.08;
        p.rough[i] = 0.7;
      },
      flip,
    );
    // A drop shadow under the jaw line sells the stacking.
    for (let x = 2; x < 9; x++) p.shade(p.idx(x0 + x, yy + 11), 0.4);
  }
}

/** A wall of femur heads stacked end-on: knobbly discs (some with the
 * double condyle), packed in offset rows, deep black between. */
function boneEnds(p: Paint, y0: number, h: number, bone: Ramp[]): void {
  const s = p.size;
  for (let y = y0; y < y0 + h; y++)
    for (let x = 0; x < s; x++) {
      const i = p.idx(x, y);
      p.setColor(i, OSS_DARK[0]);
      p.height[i] = 0.08;
      p.rough[i] = 0.95;
    }
  const rows = Math.max(1, Math.round(h / 6.5));
  const rh = h / rows;
  for (let r = 0; r < rows; r++) {
    let x = (r & 1) * 2.5 + p.rng.range(0, 1);
    while (x < s) {
      const rad = p.rng.range(2.3, 3.1);
      const cx = x + rad;
      const cy = y0 + r * rh + rh / 2 + p.rng.range(-0.4, 0.4);
      const R = bone[p.rng.int(0, bone.length - 1)];
      const condyle = p.rng.chance(0.3);
      const shade = p.rng.range(-0.1, 0.08);
      const knob = (kx: number, ky: number, kr: number) =>
        p.disc(kx, ky, kr, (i, d) => {
          const px = i % s;
          const py = (i / s) | 0;
          const dx = ((px + 0.5 - kx + s * 1.5) % s) - s / 2;
          const dy = py + 0.5 - ky;
          const lit = -(dx + dy) / (kr * 2);
          const t = clamp01(0.55 + lit * 0.6 - d * d * 0.35 + shade);
          p.setColor(i, rampColor(R, t, px, py, 0.3));
          p.height[i] = Math.max(p.height[i], 0.35 + (1 - d * d) * 0.4);
          p.rough[i] = 0.72;
        });
      if (condyle) {
        knob(cx - 0.9, cy, rad * 0.75);
        knob(cx + 0.9, cy, rad * 0.75);
      } else {
        knob(cx, cy, rad);
        // The marrow cavity of a snapped bone.
        if (p.rng.chance(0.25)) p.set(cx, cy, { c: OSS_DARK[1], h: 0.3 });
      }
      x += rad * 2 + p.rng.range(0.6, 1.6);
    }
  }
}

/** Long bones laid lengthwise: shafts with knobbed ends, end to end. */
function longBones(p: Paint, y0: number, bone: Ramp[]): void {
  const s = p.size;
  for (let y = y0; y < y0 + 5; y++) for (let x = 0; x < s; x++) p.set(x, y, { c: OSS_DARK[0], h: 0.1, r: 0.95 });
  let x = p.rng.int(0, 5);
  const end = x + s;
  while (x < end - 6) {
    const len = Math.min(p.rng.int(14, 22), end - x);
    const R = bone[p.rng.int(0, bone.length - 1)];
    for (let t = 0; t < len; t++) {
      const knobby = t < 2 || t >= len - 2;
      for (let yy = knobby ? 0 : 1; yy < (knobby ? 5 : 4); yy++) {
        const across = knobby ? yy / 4 : (yy - 1) / 2;
        const tone = 0.75 - across * 0.5 + (t === 0 || t === len - 1 ? -0.15 : 0);
        const i = p.idx(x + t, y0 + yy);
        p.setColor(i, rampColor(R, tone, x + t, y0 + yy, 0.3));
        p.height[i] = 0.55 - Math.abs(across - 0.3) * 0.25;
        p.rough[i] = 0.7;
      }
    }
    x += len + p.rng.int(0, 1);
  }
}

registerMaterial(
  "crypt.ossuary",
  (p) => {
    // The bone walls: courses of skulls, femurs laid lengthwise, and packed
    // femur heads, as the first villagers stacked their dead.
    const bone = [BONE, ramp("#342a1e", "#5c4c38", "#857156", "#a99474", "#c7b594", "#ddd0ae"), ramp("#2c2822", "#4c463c", "#6e665a", "#8e867a", "#aca698", "#c8c2b4")];
    skullRow(p, 0, 14, 0, bone);
    longBones(p, 14, bone);
    boneEnds(p, 19, 13, bone);
    skullRow(p, 32, 14, 8, bone);
    longBones(p, 46, bone);
    boneEnds(p, 51, 13, bone);
    // Age: dust settles on every upper surface, soot darkens patches,
    // a few skulls are stained brown.
    const n = fbm(p, 4, 3, 631);
    for (let i = 0; i < n.length; i++) {
      if (n[i] > 0.62) p.mix(i, hex("#3a2a18"), (n[i] - 0.62) * 0.9);
      if (n[i] < 0.25) p.mix(i, hex("#0c0a08"), (0.25 - n[i]) * 1.2);
    }
    speckle(p, { density: 0.03, color: hex("#1a140e"), amount: 0.5, mask: (i) => p.height[i] > 0.3 });
  },
  { normal: 2.2, ao: 1.4 },
);

registerMaterial("crypt.dirt_floor", (p) => {
  // Packed grave earth with bone chips, a buried slab corner, footprints.
  paintDirt(p, { ramp: ramp("#120d0a", "#211811", "#322419", "#443222", "#57412d", "#6d5439"), pebbles: 0.35, roots: 2 });
  const s = p.size;
  for (let k = 0; k < 16; k++) {
    const x = p.rng.int(0, s - 1);
    const y = p.rng.int(0, s - 1);
    const len = p.rng.int(1, 3);
    const dir = p.rng.chance(0.5);
    for (let t = 0; t < len; t++) p.set(dir ? x + t : x, dir ? y : y + t, { c: rampColor(BONE, 0.7 - t * 0.1, x, y), h: 0.6, r: 0.7 });
    p.set(dir ? x : x + 1, dir ? y + 1 : y, { c: hex("#0e0a07") });
  }
  // Boot prints: pairs of shallow ovals.
  for (let k = 0; k < 3; k++) {
    const x = p.rng.range(0, s);
    const y = p.rng.range(0, s);
    for (const [ox, oy, r] of [
      [0, 0, 2.2],
      [0.5, 4.5, 1.6],
    ] as const)
      p.disc(x + ox, y + oy, r, (i, d) => {
        p.height[i] -= (1 - d) * 0.08;
        p.shade(i, 0.88);
      });
  }
  grime(p, { color: hex("#0a0806"), amount: 0.3, cavity: 1.5, from: "none" });
});

registerMaterial("crypt.plaster_old", (p) => {
  // Lime plaster over the brick, flaking away in islands; what remains
  // keeps ghosts of a fresco — a border band and a robed figure's folds —
  // stained by damp tide-lines and speckled with mould.
  const s = p.size;
  const L = bricks(p, { rows: 8, minW: 10, maxW: 18 });
  paintMasonry(p, L, { ramps: [CRYPT_WARM, CRYPT], mortar: CRYPT_MORTAR, chip: 0.3, tint: 0.15 });
  const brickCol = Float32Array.from(p.albedo);
  const brickH = Float32Array.from(p.height);
  const brickR = Float32Array.from(p.rough);
  const flake = fbm(p, 3, 3, 641);
  const n = fbm(p, 8, 3, 642);
  const fresco = fbmXY(p, 1, 3, 2, 643);
  const PLASTER = ramp("#4c4436", "#6f6552", "#91866e", "#b0a58a", "#c8bea2", "#dcd3b8");
  const tone = field(p);
  const on = new Uint8Array(s * s);
  for (let i = 0; i < n.length; i++) on[i] = flake[i] < 0.7 ? 1 : 0;
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      if (!on[i]) continue;
      // Plaster edge: a raised lip casting a shadow onto the brick.
      const edge = flake[i] > 0.66;
      p.height[i] = 0.78 + (n[i] - 0.5) * 0.04 - (edge ? 0.04 : 0);
      tone[i] = 0.62 + (n[i] - 0.5) * 0.2 + (edge ? 0.12 : 0);
    }
  const light = lightField(p, 1.2);
  for (let i = 0; i < n.length; i++) if (on[i]) tone[i] += light[i] * 0.5;
  paintTone(p, PLASTER, tone, 0.3, (i) => on[i] === 1);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = y * s + x;
      if (!on[i]) {
        p.albedo[i * 3] = brickCol[i * 3];
        p.albedo[i * 3 + 1] = brickCol[i * 3 + 1];
        p.albedo[i * 3 + 2] = brickCol[i * 3 + 2];
        p.height[i] = brickH[i];
        p.rough[i] = brickR[i];
        // Shadow from the plaster lip above-left.
        if (on[p.idx(x - 1, y - 1)]) p.shade(i, 0.55);
        continue;
      }
      p.rough[i] = 0.9;
      // Fresco ghosts, faded and rubbed: an ochre-red border band, a saint's
      // gilt halo, and the blue-green folds of a robe below it.
      const worn = smooth(0.2, 0.55, n[i]);
      if (y >= 5 && y < 9) p.mix(i, hex("#8a3a24"), 0.35 * worn);
      if (y === 10) p.mix(i, hex("#a8823a"), 0.3 * worn);
      const hr = Math.hypot(x + 0.5 - 22, y + 0.5 - 24);
      if (hr > 7 && hr < 9) p.mix(i, hex("#b89448"), 0.4 * worn);
      if (hr <= 7) p.mix(i, hex("#c8a88a"), 0.15 * worn);
      const fold = Math.sin((x / s) * Math.PI * 2 * 4 + fresco[i] * 5);
      if (y > 33 && Math.abs(x + 0.5 - 22) < 13 && fold > 0.2) p.mix(i, hex("#3e5a58"), 0.3 * smooth(0.2, 0.9, fold) * worn);
    }
  // Damp tide-lines and black mould.
  const damp = fbm(p, 3, 2, 644);
  for (let i = 0; i < n.length; i++) if (on[i] && Math.abs(damp[i] - 0.62) < 0.012) p.mix(i, hex("#5a4a30"), 0.5);
  speckle(p, { density: 0.04, color: hex("#1a1c14"), amount: 0.7, mask: (i) => on[i] === 1 && damp[i] > 0.62 });
  cracks(p, { count: 3, length: [8, 20], depth: 0.1, mask: (i) => on[i] === 1 });
  drips(p, { count: 4, color: hex("#3a3020"), strength: 0.25, minLen: 10, maxLen: 24 });
});
