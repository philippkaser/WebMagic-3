import { ITEMS } from "../../../shared/content/items/bases";
import type { MeshBuilder, T3 } from "./kit";
import { glow, rand, TAU } from "./parts";

/** The spell foci (staffs, wand, rod, orb) — one builder shared by the
 * pickup models, the delver's hand and the first-person viewmodel.
 *
 * Local frame: the grip (where the fist closes) at the origin, the focus
 * rising along +Y, its business end at `tip`. Floating parts (the Hollow
 * staff's shard) go into `float` when given so a rig can animate them. */

export interface FocusInfo {
  /** Where spells leave (crystal/cage/orb centre). */
  tip: T3;
  /** Bottom end (ferrule) and top end along +Y. */
  bottom: number;
  top: number;
  /** Radius of the haft at the grip (for hands wrapping it). */
  grip: number;
  /** Glow colour of the business end. */
  color: string;
}

export const FOCUS_MODELS = ["staff_apprentice", "staff_ember", "wand_rime", "rod_storm", "staff_void", "orb_venom"] as const;

/** Item base id ("ember_staff") or model id ("staff_ember") → model id. */
export function focusModelOf(id: string | undefined): string {
  if (!id) return "staff_apprentice";
  if ((FOCUS_MODELS as readonly string[]).includes(id)) return id;
  const def = ITEMS.find(id);
  return def?.model && (FOCUS_MODELS as readonly string[]).includes(def.model) ? def.model : "staff_apprentice";
}

export function buildFocus(b: MeshBuilder, model: string, float?: MeshBuilder, opts: { finish?: string } = {}): FocusInfo {
  switch (model) {
    case "staff_ember":
      return ember(b);
    case "wand_rime":
      return rime(b);
    case "rod_storm":
      return storm(b);
    case "staff_void":
      return hollow(b, float ?? b);
    case "orb_venom":
      return venom(b);
    default:
      return apprentice(b, opts.finish);
  }
}

/** A slightly crooked haft from y0 to y1 with a few knots. */
function haft(b: MeshBuilder, y0: number, y1: number, r: number, surf: { mat: string; tint?: string; uvm?: number }, seed: number, bend = 0.012): void {
  const R = rand(seed);
  const pts: T3[] = [];
  for (let i = 0; i <= 5; i++) {
    const t = i / 5;
    pts.push([(R() - 0.5) * bend * 2, y0 + (y1 - y0) * t, (R() - 0.5) * bend * 2]);
  }
  b.tube(pts, (t) => r * (1.08 - t * 0.2), { ...surf, radial: 6, segments: 10, flat: true });
  for (let k = 0; k < 3; k++) {
    const y = y0 + (y1 - y0) * (0.25 + R() * 0.6);
    b.sphere(r * 0.7, { ...surf, at: [(R() - 0.5) * r, y, r * 0.7], squash: [1, 1.4, 0.7], segments: 5, rings: 3 });
  }
}

function apprentice(b: MeshBuilder, finish?: string): FocusInfo {
  const ash = finish === "bone" ? { mat: "bone", tint: "#d8ccb0", uvm: 0.5 } : { mat: "wood.plank", tint: "#c4a882", uvm: 0.5 };
  const trim = finish === "gilt" ? { mat: "metal.gold", uvm: 0.3 } : { mat: "metal.iron", tint: "#8a8480", uvm: 0.3 };
  haft(b, -0.55, 0.9, 0.022, ash, 11);
  b.cone(0.024, 0.07, { ...trim, at: [0, -0.58, 0], rot: [Math.PI, 0, 0], segments: 6 });
  b.cylinder(0.027, 0.027, 0.04, { ...trim, at: [0, -0.52, 0], segments: 6 });
  // Leather grip wrap.
  b.cylinder(0.027, 0.027, 0.2, { mat: "leather", tint: "#5a3e28", uvm: 0.2, at: [0, 0, 0], segments: 7 });
  for (let k = 0; k < 5; k++) b.torus(0.027, 0.004, { mat: "leather", tint: "#3a2618", uvm: 0.2, at: [0, -0.08 + k * 0.04, 0], rot: [Math.PI / 2 + 0.25, 0, 0], radial: 3, tubular: 8 });
  // Forked head cradling a cracked crystal.
  b.mirrorX((m) =>
    m.tube(
      [
        [0.005, 0.86, 0],
        [0.04, 0.95, 0.005],
        [0.045, 1.06, 0],
        [0.025, 1.14, 0],
      ],
      (t) => 0.016 - t * 0.01,
      { ...ash, radial: 5, segments: 8 },
    ),
  );
  b.cylinder(0.026, 0.026, 0.05, { mat: "rope", tint: "#8a7450", uvm: 0.15, at: [0, 0.87, 0], segments: 6 });
  b.cylinder(0.028, 0.028, 0.012, { ...trim, at: [0, 0.9, 0], segments: 6 });
  const cr = { mat: "crystal", tint: "#9fdcff", emit: 1.6, uvm: 0.2 };
  b.sphere(0.036, { ...cr, at: [-0.004, 1.05, 0], rot: [0, 0.3, 0.1], squash: [0.8, 1.9, 0.8], segments: 4, rings: 2, flat: true });
  b.sphere(0.03, { ...cr, at: [0.012, 1.06, 0.004], rot: [0, 0.9, -0.2], squash: [0.7, 1.6, 0.7], segments: 4, rings: 2, flat: true });
  b.box([0.004, 0.09, 0.05], { mat: "stone.smooth", tint: "#10141a", at: [0.004, 1.05, 0], rot: [0, 0, -0.15] });
  // A rag tied under the head.
  b.box([0.03, 0.09, 0.005], { mat: "cloth.linen", tint: "#8a3a2a", uvm: 0.2, at: [0.025, 0.8, 0.012], rot: [0, 0.3, -0.25] });
  return { tip: [0, 1.06, 0], bottom: -0.6, top: 1.15, grip: 0.027, color: "#8fd8ff" };
}

function ember(b: MeshBuilder): FocusInfo {
  const wood = { mat: "wood.dark", tint: "#3a2a20", uvm: 0.5 };
  const iron = { mat: "metal.iron", tint: "#4a4440", uvm: 0.3 };
  haft(b, -0.55, 0.92, 0.024, wood, 23, 0.018);
  // Glowing cracks spiralling up the charred wood.
  const R = rand(5);
  for (let k = 0; k < 7; k++) {
    const y = -0.4 + k * 0.19;
    const a = R() * TAU;
    b.box([0.005, 0.06 + R() * 0.05, 0.006], { ...glow("#ff6a1a", 2.5), at: [Math.sin(a) * 0.024, y, Math.cos(a) * 0.024], rot: [0, a, 0.3] });
  }
  b.cone(0.026, 0.08, { ...iron, at: [0, -0.59, 0], rot: [Math.PI, 0, 0], segments: 6 });
  b.cylinder(0.03, 0.03, 0.18, { mat: "leather", tint: "#2a1a12", uvm: 0.2, segments: 7 });
  // Ember cage: iron ribs bowed around a nest of coals.
  b.cylinder(0.04, 0.03, 0.05, { ...iron, at: [0, 0.93, 0], segments: 6 });
  b.radial(5, (m) =>
    m.tube(
      [
        [0.02, 0.94, 0],
        [0.07, 1.0, 0],
        [0.075, 1.1, 0],
        [0.04, 1.2, 0],
        [0.0, 1.23, 0],
      ],
      0.007,
      { ...iron, radial: 4, segments: 8 },
    ),
  );
  b.torus(0.07, 0.008, { ...iron, at: [0, 1.05, 0], rot: [Math.PI / 2, 0, 0], radial: 3, tubular: 12 });
  b.sphere(0.012, { ...iron, at: [0, 1.235, 0], segments: 5, rings: 3 });
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU;
    b.sphere(0.024 + (k % 2) * 0.008, { mat: "lava", emit: 2.5, uvm: 0.15, at: [Math.sin(a) * 0.025, 1.04 + (k % 3) * 0.03, Math.cos(a) * 0.025], segments: 5, rings: 3, flat: true });
  }
  b.sphere(0.03, { ...glow("#ffb040", 5), at: [0, 1.08, 0], segments: 6, rings: 4 });
  return { tip: [0, 1.08, 0], bottom: -0.6, top: 1.24, grip: 0.03, color: "#ff8b3d" };
}

function rime(b: MeshBuilder): FocusInfo {
  const ice = { mat: "ice", tint: "#c8f4ff", emit: 0.5, uvm: 0.2 };
  // Bone handle, silver-wire wrapped.
  b.cylinder(0.018, 0.016, 0.16, { mat: "bone", tint: "#e0e4e8", uvm: 0.2, at: [0, -0.02, 0], segments: 6 });
  b.sphere(0.022, { mat: "metal.iron", tint: "#c0ccd8", uvm: 0.2, at: [0, -0.105, 0], segments: 6, rings: 4 });
  for (let k = 0; k < 4; k++) b.torus(0.019, 0.003, { mat: "metal.iron", tint: "#d0dce8", uvm: 0.2, at: [0, -0.07 + k * 0.035, 0], rot: [Math.PI / 2, 0, 0], radial: 3, tubular: 8 });
  b.cylinder(0.024, 0.02, 0.02, { mat: "metal.iron", tint: "#c0ccd8", uvm: 0.2, at: [0, 0.07, 0], segments: 6 });
  // Ice blade tapering to a needle, frost spurs along it.
  b.cone(0.02, 0.3, { ...ice, at: [0, 0.23, 0], segments: 5, flat: true });
  const R = rand(9);
  for (let k = 0; k < 6; k++) {
    const a = R() * TAU;
    const y = 0.1 + k * 0.035;
    b.cone(0.008, 0.05 - k * 0.005, { ...ice, emit: 0.9, at: [Math.sin(a) * 0.015, y, Math.cos(a) * 0.015], rot: [Math.cos(a) * 0.9, 0, -Math.sin(a) * 0.9], segments: 3, flat: true });
  }
  b.sphere(0.012, { ...glow("#dff8ff", 4), at: [0, 0.37, 0], segments: 5, rings: 3 });
  return { tip: [0, 0.37, 0], bottom: -0.12, top: 0.38, grip: 0.018, color: "#bfefff" };
}

function storm(b: MeshBuilder): FocusInfo {
  const iron = { mat: "metal.iron", tint: "#6a6a78", uvm: 0.3 };
  const brass = { mat: "metal.brass", uvm: 0.25 };
  b.cylinder(0.016, 0.016, 0.72, { ...iron, at: [0, 0.16, 0], segments: 7 });
  b.cylinder(0.022, 0.022, 0.16, { mat: "leather", tint: "#2a2a30", uvm: 0.2, segments: 7 });
  b.sphere(0.026, { ...brass, at: [0, -0.2, 0], segments: 6, rings: 4 });
  // Copper-brass coils climbing the rod.
  for (let k = 0; k < 9; k++) b.torus(0.024, 0.006, { ...brass, tint: k % 2 ? "#c07840" : "#d8a050", at: [0, 0.14 + k * 0.03, 0], rot: [Math.PI / 2 + 0.15, 0, 0], radial: 3, tubular: 8 });
  b.cylinder(0.03, 0.03, 0.02, { ...iron, at: [0, 0.12, 0], segments: 6 });
  b.cylinder(0.03, 0.03, 0.02, { ...iron, at: [0, 0.42, 0], segments: 6 });
  // Terminal: a brass ball held between two prongs with a spark gap.
  b.mirrorX((m) =>
    m.tube(
      [
        [0.0, 0.44, 0],
        [0.045, 0.5, 0],
        [0.05, 0.56, 0],
        [0.02, 0.62, 0],
      ],
      0.006,
      { ...iron, radial: 4, segments: 6 },
    ),
  );
  b.sphere(0.03, { ...brass, at: [0, 0.5, 0], segments: 7, rings: 5 });
  b.sphere(0.014, { ...glow("#f8ffc0", 6), at: [0, 0.59, 0], segments: 5, rings: 3 });
  b.box([0.004, 0.04, 0.004], { ...glow("#ffffe0", 5), at: [0.01, 0.56, 0], rot: [0, 0, 0.6] });
  b.box([0.004, 0.035, 0.004], { ...glow("#ffffe0", 5), at: [-0.008, 0.55, 0.006], rot: [0.5, 0, -0.4] });
  return { tip: [0, 0.58, 0], bottom: -0.22, top: 0.63, grip: 0.022, color: "#f4f7a0" };
}

function hollow(b: MeshBuilder, f: MeshBuilder): FocusInfo {
  const wood = { mat: "wood.dark", tint: "#16121c", uvm: 0.5 };
  const bone = { mat: "bone", tint: "#8a8098", uvm: 0.3 };
  haft(b, -0.55, 0.95, 0.021, wood, 31, 0.006);
  b.cylinder(0.026, 0.026, 0.2, { mat: "cloth.velvet", tint: "#3a2050", uvm: 0.2, segments: 7 });
  b.cone(0.022, 0.1, { ...bone, at: [0, -0.6, 0], rot: [Math.PI, 0, 0], segments: 5 });
  // Three curved claws holding nothing — the shard hovers above.
  b.radial(3, (m) =>
    m.tube(
      [
        [0.0, 0.92, 0],
        [0.05, 0.98, 0],
        [0.06, 1.08, 0],
        [0.03, 1.16, 0],
      ],
      (t) => 0.014 - t * 0.011,
      { ...bone, radial: 4, segments: 8 },
    ),
  );
  b.sphere(0.03, { ...bone, at: [0, 0.94, 0], segments: 6, rings: 4 });
  for (let k = 0; k < 3; k++) b.sphere(0.006, { ...glow("#b27cff", 3), at: [Math.sin(k * 2.1) * 0.022, 0.3 + k * 0.2, Math.cos(k * 2.1) * 0.022], segments: 4, rings: 2 });
  // The floating shard: black glass with a violet heart, and a thin halo.
  f.sphere(0.04, { mat: "glass", tint: "#1a0a2a", uvm: 0.2, at: [0, 1.1, 0], rot: [0.2, 0.5, 0.1], squash: [0.7, 1.9, 0.7], segments: 4, rings: 2, flat: true });
  f.sphere(0.018, { ...glow("#b27cff", 5), at: [0, 1.1, 0], squash: [1, 1.8, 1], segments: 5, rings: 3 });
  f.torus(0.07, 0.004, { ...glow("#8a4aff", 3), at: [0, 1.1, 0], rot: [1.2, 0.3, 0], radial: 3, tubular: 16 });
  return { tip: [0, 1.1, 0], bottom: -0.65, top: 1.18, grip: 0.026, color: "#b27cff" };
}

function venom(b: MeshBuilder): FocusInfo {
  const chitin = { mat: "chitin", tint: "#4a5a30", uvm: 0.2 };
  // Short handle ending in a knuckled claw that cages the orb.
  b.cylinder(0.022, 0.018, 0.2, { mat: "leather", tint: "#3a3020", uvm: 0.2, at: [0, -0.02, 0], segments: 7 });
  b.sphere(0.028, { ...chitin, at: [0, -0.13, 0], segments: 6, rings: 4 });
  b.cylinder(0.03, 0.024, 0.05, { ...chitin, at: [0, 0.1, 0], segments: 6, flat: true });
  b.radial(4, (m) => {
    m.tube(
      [
        [0.015, 0.11, 0],
        [0.07, 0.15, 0],
        [0.09, 0.22, 0],
        [0.06, 0.29, 0],
        [0.025, 0.31, 0],
      ],
      (t) => 0.014 - t * 0.01,
      { ...chitin, radial: 4, segments: 8 },
    );
    m.sphere(0.012, { ...chitin, at: [0.088, 0.2, 0], segments: 4, rings: 3 });
  });
  b.sphere(0.075, { mat: "glass", tint: "#8cff5a", emit: 1.2, uvm: 0.2, at: [0, 0.21, 0], segments: 10, rings: 7 });
  b.sphere(0.045, { mat: "slime", tint: "#b0ff70", emit: 2.5, uvm: 0.15, at: [0, 0.2, 0], segments: 7, rings: 5 });
  return { tip: [0, 0.21, 0], bottom: -0.15, top: 0.31, grip: 0.022, color: "#8cff5a" };
}

/** A fist closed around a haft of radius `r` along +Y at the origin:
 * fingers are arcs wrapping the far side, the thumb locks the near side. */
export function gripHand(b: MeshBuilder, r: number, skinTint?: string): void {
  const skin = { mat: "skin.wizard", tint: skinTint, uvm: 0.25 };
  const R = r + 0.01;
  // Back of the hand on the outside (+X), knuckles forward.
  b.box([0.03, 0.09, 0.07], { ...skin, at: [R + 0.012, -0.005, 0.012], rot: [0, -0.35, 0.08], bevel: 0.012 });
  b.sphere(0.026, { ...skin, at: [R + 0.01, -0.055, 0.03], squash: [0.9, 1.1, 1], segments: 7, rings: 5 });
  const ys = [0.028, 0.006, -0.016, -0.036];
  const arcs = [4.1, 4.3, 4.2, 3.9];
  ys.forEach((y, i) => {
    b.torus(R, 0.0095 - i * 0.0006, { ...skin, at: [0, y, 0], rot: [-Math.PI / 2, 0, -0.35], arc: arcs[i], radial: 5, tubular: 10 });
    b.sphere(0.012, { ...skin, at: [Math.cos(0.35) * R * 1.05, y, -Math.sin(0.35) * R * 1.05 - 0.005], segments: 5, rings: 3 });
    const e = arcs[i] - 0.35;
    b.sphere(0.0085, { ...skin, tint: "#d8a890", at: [Math.cos(e) * R, y, -Math.sin(-e) * R * -1], segments: 4, rings: 3 });
  });
  // Thumb over the near side.
  b.capsule(0.011, 0.045, { ...skin, at: [0.004, 0.012, R + 0.004], rot: [0, 0, 1.1], segments: 6 });
  b.sphere(0.012, { ...skin, at: [R * 0.7, -0.015, R * 0.8], segments: 5, rings: 3 });
}

