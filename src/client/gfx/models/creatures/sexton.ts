import { Matrix4, Vector3 } from "three";
import { Anim } from "../../../../shared/sim/entity";
import { turn, type MeshBuilder, type Rig, type RigBuilder, type T3 } from "../kit";
import {
  aimDown,
  attackPose,
  chain,
  deathT,
  easeOut,
  flame,
  flinch,
  Gait,
  glow,
  hand,
  ik2,
  lerp,
  limb,
  node,
  rivets,
  span,
  staggerAmt,
  VOID,
  windupShake,
  wobble,
  type Limb,
} from "../parts";
import { registerModel, rigModel, type AnimInput, type ModelOptions } from "../registry";
import { timing, timings } from "./common";

/** Hollis Crane, the Sexton of Bowe — Warden of the Undercroft. 3.2 m of
 * hunched gravedigger as the village children remembered him: huge hands,
 * a burial shroud for a hood, a lantern at his belt and the shovel he has
 * been digging at his own brickwork with for thirty-one years.
 *
 * The shovel is posed procedurally (a handful of key poses blended by the
 * attack curve) and both arms reach it with two-bone IK, so the hands never
 * leave the haft. Below half health he goes feral: the hood falls back,
 * the eyes kindle, the hunch deepens. */

const T = timings("sexton", [
  { windup: 0.8, recover: 0.7 },
  { windup: 1.2, recover: 1 },
  { windup: 0.9, recover: 0.6 },
]);

const P = {
  hips: [0, 1.42, 0.12] as T3,
  spine: [0, 1.52, 0.12] as T3,
  neck: [0, 2.46, -0.32] as T3,
  shR: [0.56, 2.36, -0.05] as T3,
  elR: [0.7, 1.72, -0.1] as T3,
  wrR: [0.68, 1.1, -0.22] as T3,
  shL: [-0.56, 2.36, -0.05] as T3,
  elL: [-0.7, 1.72, -0.1] as T3,
  wrL: [-0.68, 1.1, -0.22] as T3,
  hipR: [0.27, 1.36, 0.12] as T3,
  kneeR: [0.32, 0.78, -0.04] as T3,
  ankR: [0.34, 0.17, 0.1] as T3,
  hipL: [-0.27, 1.36, 0.12] as T3,
  kneeL: [-0.32, 0.78, -0.04] as T3,
  ankL: [-0.34, 0.17, 0.1] as T3,
  lantern: [-0.5, 1.4, -0.28] as T3,
};
const GRIP_R = new Vector3(0, -0.04, 0);
const GRIP_L = new Vector3(0, -0.85, 0);

const COAT = { mat: "cloth.wool", tint: "#2c2622", uvm: 1.2 };
const COAT2 = { mat: "cloth.wool", tint: "#3a3028", uvm: 1.2 };
const SHROUD = { mat: "cloth.linen", tint: "#6e685a", uvm: 1.2 };
const SKIN = { mat: "flesh.pale", tint: "#8a8074", uvm: 0.6 };
const DIRT = { mat: "dirt", tint: "#6a5a44", uvm: 0.8 };

function buildShovel(b: MeshBuilder): void {
  const wood = { mat: "wood.old", tint: "#9a8468", uvm: 0.8 };
  const iron = { mat: "metal.rust", uvm: 0.6 };
  // D-handle.
  b.cylinder(0.035, 0.035, 0.2, { ...wood, rot: [0, 0, Math.PI / 2], segments: 6 });
  b.torus(0.11, 0.022, { ...iron, tint: "#6a5a50", at: [0, -0.1, 0], scale: [1, 1, 1], arc: Math.PI, rot: [0, 0, Math.PI], radial: 4, tubular: 8 });
  b.mirrorX((m) => m.box([0.03, 0.12, 0.05], { ...wood, at: [0.1, -0.1, 0], rot: [0, 0, -0.3] }));
  // Haft, taped where the hands wore it.
  b.cylinder(0.038, 0.044, 1.62, { ...wood, at: [0, -0.98, 0], segments: 7, flat: true });
  b.cylinder(0.047, 0.047, 0.18, { mat: "leather", tint: "#4a3424", uvm: 0.3, at: [0, -0.85, 0], segments: 7 });
  b.cylinder(0.046, 0.046, 0.06, { mat: "rope", tint: "#6a5a40", uvm: 0.2, at: [0, -0.3, 0], segments: 7 });
  // Iron socket and a riveted collar.
  b.cylinder(0.05, 0.08, 0.26, { ...iron, at: [0, -1.86, 0], segments: 7, flat: true });
  rivets(b, [0, -1.8, -0.055], [0, -1.92, -0.07], 2, 0.012, "metal.iron");
  // Blade: a heavy spade, notched and crusted with grave dirt.
  b.extrude(
    [
      [-0.27, 0],
      [0.27, 0],
      [0.285, -0.34],
      [0.21, -0.52],
      [0.06, -0.63],
      [-0.02, -0.6],
      [-0.08, -0.63],
      [-0.22, -0.5],
      [-0.285, -0.32],
    ],
    0.022,
    { ...iron, tint: "#b8a898", at: [0, -1.97, 0.0], bevel: 0.006 },
  );
  b.box([0.58, 0.045, 0.07], { ...iron, tint: "#6a5a50", at: [0, -1.98, 0], bevel: 0.01 });
  b.sphere(0.12, { ...DIRT, at: [0.05, -2.3, -0.03], squash: [1.3, 0.8, 0.35], segments: 7, rings: 4 });
  b.sphere(0.08, { ...DIRT, at: [-0.1, -2.15, 0.025], squash: [1.2, 1, 0.3], segments: 6, rings: 4 });
}

function buildSexton(r: RigBuilder): void {
  // ── hips: coat skirt, apron, belt and its burdens ──
  const hips = r.joint("hips", "root", P.hips);
  hips.lathe(
    [
      [0.62, 0.52],
      [0.58, 0.8],
      [0.5, 1.2],
      [0.45, 1.5],
      [0.001, 1.52],
    ],
    { ...COAT, segments: 12, flat: true },
  );
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * 0.35 + (i / 8) * Math.PI * 1.3;
    hips.cone(0.12, 0.22, { ...COAT, tint: i % 2 ? "#241e1a" : "#2c2622", at: [Math.sin(a) * 0.58, 0.44, Math.cos(a) * 0.58], rot: [Math.PI, a, 0], segments: 3, flat: true });
  }
  hips.box([0.62, 0.95, 0.04], { mat: "leather", tint: "#5a4230", uvm: 0.9, at: [0, 1.0, -0.5], rot: [0.12, 0, 0], bevel: 0.015 });
  hips.box([0.64, 0.22, 0.05], { ...DIRT, at: [0, 0.62, -0.555], rot: [0.12, 0, 0], flat: true });
  hips.box([0.2, 0.2, 0.03], { mat: "leather", tint: "#4a3424", uvm: 0.5, at: [0.14, 1.12, -0.53], rot: [0.12, 0, 0.05], bevel: 0.01 });
  hips.cylinder(0.49, 0.49, 0.1, { mat: "leather", tint: "#3a2a1e", uvm: 0.6, at: [0, 1.46, 0.02], segments: 12 });
  hips.box([0.14, 0.12, 0.05], { mat: "metal.brass", uvm: 0.3, at: [0, 1.46, -0.49], bevel: 0.01 });
  // Key ring at the right hip.
  hips.torus(0.07, 0.01, { mat: "metal.iron", uvm: 0.3, at: [0.46, 1.3, -0.22], rot: [0, 1.2, 0], radial: 3, tubular: 10 });
  for (let k = 0; k < 3; k++)
    hips.group({ at: [0.47, 1.22 - k * 0.02, -0.22 + (k - 1) * 0.04], rot: [0, 1.2, 0.2 * (k - 1)] }, (g) => {
      g.box([0.012, 0.14, 0.012], { mat: "metal.iron", uvm: 0.3, at: [0, -0.05, 0] });
      g.box([0.012, 0.03, 0.04], { mat: "metal.iron", uvm: 0.3, at: [0, -0.1, -0.02] });
    });
  // A bundle of stair candles tied at the back.
  hips.group({ at: [0.32, 1.25, 0.45], rot: [0.3, 0.4, -0.3] }, (g) => {
    for (let k = 0; k < 5; k++) {
      const x = (k % 3) * 0.045 - 0.045;
      const z = Math.floor(k / 3) * 0.045;
      g.cylinder(0.022, 0.024, 0.4 - (k % 2) * 0.05, { mat: "wax", tint: "#e8d8b0", uvm: 0.3, at: [x, -0.02, z], segments: 5 });
      g.cylinder(0.004, 0.004, 0.03, { mat: "rope", tint: "#2a2018", at: [x, 0.19 - (k % 2) * 0.05, z], segments: 3 });
    }
    g.torus(0.08, 0.012, { mat: "rope", uvm: 0.2, at: [0, 0.05, 0.02], rot: [Math.PI / 2, 0, 0], radial: 3, tubular: 10 });
  });
  // Mortar trowel tucked at the back.
  hips.group({ at: [-0.3, 1.35, 0.46], rot: [0.2, 0, 0.4] }, (g) => {
    g.cylinder(0.02, 0.02, 0.14, { mat: "wood.dark", uvm: 0.3, at: [0, 0.12, 0], segments: 5 });
    g.extrude([[0, 0], [0.09, -0.12], [0, -0.3], [-0.09, -0.12]], 0.01, { mat: "metal.iron", uvm: 0.3, at: [0, 0.02, 0] });
  });

  // Lantern hanging from a hook at the left hip.
  const lan = r.joint("lantern", "hips", P.lantern);
  const L = P.lantern;
  chain(lan, L, [L[0], L[1] - 0.14, L[2]], 0.04);
  lan.group({ at: [L[0], L[1] - 0.34, L[2]] }, (g) => {
    const iron = { mat: "metal.iron", tint: "#5a5450", uvm: 0.3 };
    g.cone(0.13, 0.1, { ...iron, at: [0, 0.18, 0], segments: 6, flat: true });
    g.torus(0.03, 0.008, { ...iron, at: [0, 0.25, 0], radial: 3, tubular: 8 });
    g.cylinder(0.11, 0.11, 0.03, { ...iron, at: [0, 0.12, 0], segments: 6 });
    g.cylinder(0.12, 0.12, 0.04, { ...iron, at: [0, -0.12, 0], segments: 6 });
    g.cylinder(0.09, 0.09, 0.22, { ...glow("#ffb050", 1.6), segments: 6 });
    g.radial(6, (h) => h.box([0.015, 0.24, 0.015], { ...iron, at: [0, 0, -0.1] }), Math.PI / 6);
  });
  flame(lan, [L[0], L[1] - 0.4, L[2]], 0.09, 0.03, 5);

  // ── spine: the great hunched back under the shroud ──
  const sp = r.joint("spine", "hips", P.spine);
  sp.group({ at: [0, 1.5, 0.12], rot: [-0.42, 0, 0] }, (g) => {
    g.lathe(
      [
        [0.44, -0.02],
        [0.5, 0.25],
        [0.55, 0.55],
        [0.56, 0.76],
        [0.44, 0.94],
        [0.2, 1.04],
        [0.001, 1.05],
      ],
      { ...COAT2, segments: 11, flat: true },
    );
    // Hump.
    g.sphere(0.34, { ...COAT2, at: [0, 0.74, 0.18], squash: [1.15, 0.8, 0.9], segments: 9, rings: 6, flat: true });
    // Coat buttons and lapels.
    for (let k = 0; k < 4; k++) g.sphere(0.03, { mat: "metal.brass", tint: "#7a6a40", uvm: 0.2, at: [0.02, 0.12 + k * 0.17, -0.53 + k * 0.01], segments: 5, rings: 3 });
    g.mirrorX((m) => m.box([0.14, 0.5, 0.04], { ...COAT, at: [0.13, 0.55, -0.52], rot: [0.05, 0.3, 0.2], flat: true }));
    // Shroud capelet over the shoulders, hanging in tatters.
    g.lathe(
      [
        [0.6, 0.5],
        [0.6, 0.62],
        [0.52, 0.86],
        [0.3, 1.02],
        [0.16, 1.07],
      ],
      { ...SHROUD, segments: 11, flat: true },
    );
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2 + 0.2;
      const len = 0.18 + ((i * 7) % 5) * 0.05;
      g.cone(0.13, len, { ...SHROUD, tint: i % 2 ? "#5e584c" : "#6e685a", at: [Math.sin(a) * 0.58, 0.5 - len / 2, Math.cos(a) * 0.58], rot: [Math.PI, a, 0], segments: 3, flat: true });
    }
    g.sphere(0.18, { ...DIRT, at: [0.28, 0.25, -0.5], squash: [1, 1.4, 0.2], segments: 6, rings: 4 });
  });

  // ── head: a long grey face in the shroud's shadow ──
  const head = r.joint("head", "spine", P.neck);
  const hc: T3 = [0, 2.62, -0.52];
  head.sphere(0.2, { ...SKIN, at: hc, squash: [0.85, 1.1, 1], segments: 10, rings: 7 });
  head.box([0.3, 0.06, 0.1], { ...SKIN, at: [0, hc[1] + 0.06, hc[2] - 0.15], bevel: 0.025 });
  head.box([0.24, 0.2, 0.16], { ...SKIN, at: [0, hc[1] - 0.12, hc[2] - 0.08], bevel: 0.05 });
  head.cone(0.045, 0.16, { ...SKIN, tint: "#9a8a7c", at: [0, hc[1] - 0.02, hc[2] - 0.22], rot: [-1.2, 0, 0], segments: 5 });
  head.mirrorX((m) => {
    m.sphere(0.045, { ...VOID, at: [0.075, hc[1] + 0.01, hc[2] - 0.16], squash: [1.1, 0.8, 0.6], segments: 6, rings: 4 });
    m.sphere(0.05, { ...SKIN, at: [0.19, hc[1] - 0.02, hc[2]], squash: [0.4, 1.2, 0.8], segments: 6, rings: 4 });
  });
  // Beard: a long grey wedge down onto the chest.
  head.cone(0.14, 0.5, { mat: "fur", tint: "#8a8680", uvm: 0.5, at: [0, hc[1] - 0.38, hc[2] - 0.08], rot: [Math.PI + 0.35, 0, 0], segments: 7, flat: true });
  head.cone(0.08, 0.3, { mat: "fur", tint: "#a09a92", uvm: 0.5, at: [0.07, hc[1] - 0.32, hc[2] - 0.1], rot: [Math.PI + 0.2, 0, 0.2], segments: 5 });
  // Phase-1 eyes: dim embers. Phase-2: burning.
  const eyesDim = r.joint("eyesDim", "head", hc);
  eyesDim.mirrorX((m) => m.sphere(0.018, { ...glow("#d8c8a0", 2), at: [0.075, hc[1] + 0.01, hc[2] - 0.185], segments: 5, rings: 3 }));
  const eyesHot = r.joint("eyesHot", "head", hc);
  eyesHot.mirrorX((m) => m.sphere(0.026, { ...glow("#ff7a2a", 6), at: [0.075, hc[1] + 0.01, hc[2] - 0.19], segments: 5, rings: 3 }));
  // Bald, liver-spotted crown with lank hair (seen once the hood falls).
  for (let k = 0; k < 7; k++) {
    const a = -1.3 + k * 0.45;
    head.tube(
      [
        [Math.sin(a) * 0.15, hc[1] + 0.12, hc[2] + Math.cos(a) * 0.12],
        [Math.sin(a) * 0.2, hc[1] - 0.05, hc[2] + Math.cos(a) * 0.16],
        [Math.sin(a) * 0.22, hc[1] - 0.25, hc[2] + Math.cos(a) * 0.16],
      ],
      (t) => 0.02 - t * 0.012,
      { mat: "fur", tint: "#7a766e", uvm: 0.3, radial: 3, segments: 4 },
    );
  }
  // The shroud worn as a cowl: open at the face, peaked, falling to the back.
  const hood = r.joint("hood", "head", P.neck);
  hood.sphere(0.25, { ...SHROUD, at: [0, hc[1] + 0.07, hc[2] + 0.1], squash: [1, 1.08, 1.12], segments: 10, rings: 7, flat: true });
  hood.cone(0.16, 0.32, { ...SHROUD, at: [0, hc[1] + 0.26, hc[2] + 0.24], rot: [-1.0, 0, 0.08], segments: 6, flat: true });
  hood.torus(0.19, 0.045, { ...SHROUD, tint: "#5e584c", at: [0, hc[1] + 0.0, hc[2] - 0.12], rot: [0.3, 0, 0], scale: [1, 1.3, 1], radial: 4, tubular: 12, flat: true });
  hood.cone(0.26, 0.5, { ...SHROUD, at: [0, hc[1] - 0.2, hc[2] + 0.3], rot: [0.55, 0, 0], segments: 7, flat: true });

  // ── arms: coat sleeves, huge grey hands ──
  for (const [side, sh, el, wr] of [
    ["R", P.shR, P.elR, P.wrR],
    ["L", P.shL, P.elL, P.wrL],
  ] as const) {
    const sx = side === "R" ? 1 : -1;
    const a = r.joint(`arm${side}`, "spine", sh);
    a.sphere(0.16, { ...COAT2, at: [sh[0] - 0.03 * sx, sh[1], sh[2]], squash: [1, 0.85, 1.1], segments: 7, rings: 5, flat: true });
    a.tube([sh, el], (t) => 0.15 - t * 0.03, { ...COAT, radial: 7, segments: 3 });
    const f = r.joint(`fore${side}`, `arm${side}`, el);
    f.sphere(0.12, { ...COAT, at: el, segments: 7, rings: 5 });
    f.tube([el, wr], (t) => 0.12 - t * 0.02, { ...COAT, radial: 7, segments: 3 });
    f.cylinder(0.13, 0.12, 0.12, { ...COAT2, tint: "#4a3a2c", at: [wr[0], wr[1] + 0.1, wr[2]], rot: [0.15, 0, 0], segments: 7, flat: true });
    f.sphere(0.07, { ...DIRT, at: [wr[0] + 0.06 * sx, wr[1] + 0.25, wr[2] - 0.08], squash: [0.6, 1.3, 0.6], segments: 5, rings: 3 });
    const h = r.joint(`hand${side}`, `fore${side}`, wr);
    h.group({ scale: [sx, 1, 1] }, (m) => hand(m, { at: [Math.abs(wr[0]), wr[1], wr[2]], s: 2.3, mat: "flesh.pale", tint: "#7a7066", curl: 0.75, spread: 0.1, gaunt: true, uvm: 0.5 }));
  }

  // ── legs: patched breeches, iron-shod boots caked in dirt ──
  for (const [side, hip, knee, ank] of [
    ["R", P.hipR, P.kneeR, P.ankR],
    ["L", P.hipL, P.kneeL, P.ankL],
  ] as const) {
    const th = r.joint(`thigh${side}`, "hips", hip);
    th.tube([hip, knee], (t) => 0.17 - t * 0.04, { mat: "cloth.wool", tint: "#3a3024", uvm: 0.8, radial: 7, segments: 3 });
    const shn = r.joint(`shin${side}`, `thigh${side}`, knee);
    shn.sphere(0.13, { mat: "leather", tint: "#4a3a2a", uvm: 0.5, at: [knee[0], knee[1], knee[2] - 0.03], segments: 7, rings: 5 });
    shn.sphere(0.12, { ...DIRT, at: [knee[0], knee[1] - 0.02, knee[2] - 0.08], squash: [1, 1, 0.5], segments: 6, rings: 4 });
    shn.tube([knee, ank], (t) => 0.12 + t * 0.02, { mat: "leather", tint: "#2e241c", uvm: 0.6, radial: 7, segments: 3 });
    shn.cylinder(0.16, 0.15, 0.12, { mat: "leather", tint: "#3a2c20", uvm: 0.5, at: [knee[0] * 0.95 + ank[0] * 0.05, knee[1] - 0.14, knee[2] + 0.02], segments: 8, flat: true });
    const ft = r.joint(`foot${side}`, `shin${side}`, ank);
    ft.box([0.28, 0.2, 0.52], { mat: "leather", tint: "#2a2018", uvm: 0.5, at: [ank[0], 0.1, ank[2] - 0.12], bevel: 0.07 });
    ft.sphere(0.15, { mat: "leather", tint: "#2a2018", uvm: 0.5, at: [ank[0], 0.1, ank[2] - 0.34], squash: [1, 0.7, 0.9], segments: 8, rings: 5 });
    ft.box([0.3, 0.05, 0.56], { mat: "metal.iron", uvm: 0.4, at: [ank[0], 0.025, ank[2] - 0.14], bevel: 0.015 });
    ft.sphere(0.13, { ...DIRT, at: [ank[0] + 0.05, 0.08, ank[2] - 0.3], squash: [1.3, 0.6, 1.2], segments: 6, rings: 4 });
  }

  // ── the shovel (child of the root; the arms reach it by IK) ──
  const sv = r.joint("shovel", "root", [0, 2, -0.8]);
  sv.group({ at: [0, 2, -0.8] }, buildShovel);
}

// ── shovel poses ─────────────────────────────────────────────────────────────

/** Shovel pose: `b`/`R`/`H` place the D-handle around the chest (yaw,
 * reach, height); `a`/`p` aim the haft (yaw, pitch below horizontal). */
interface Pose {
  a: number;
  p: number;
  b: number;
  R: number;
  H: number;
  roll: number;
}
const POSES = {
  lean: { a: 0, p: 1.1, b: 0.05, R: 0.8, H: 2.05, roll: 0 },
  ready: { a: 0.55, p: 0.85, b: -0.45, R: 0.65, H: 1.8, roll: 0.3 },
  sweepBack: { a: -2.2, p: 0.15, b: -1.3, R: 0.8, H: 1.85, roll: 1.4 },
  sweepEnd: { a: 1.6, p: 0.3, b: 1.0, R: 0.85, H: 1.7, roll: 1.4 },
  slamUp: { a: 0, p: -2.0, b: 0, R: 0.35, H: 2.95, roll: 0 },
  slamDown: { a: 0, p: 0.72, b: 0, R: 0.95, H: 1.45, roll: 0 },
  scoop: { a: 0.25, p: 0.6, b: -0.3, R: 0.85, H: 1.35, roll: 0 },
  fling: { a: 0.1, p: -0.7, b: 0.1, R: 0.95, H: 2.3, roll: 0 },
  dropped: { a: 1.2, p: 0.02, b: 0.4, R: 1.3, H: 0.08, roll: 1.5 },
} satisfies Record<string, Pose>;

function mix(a: Pose, b: Pose, t: number, out: Pose): Pose {
  out.a = lerp(a.a, b.a, t);
  out.p = lerp(a.p, b.p, t);
  out.b = lerp(a.b, b.b, t);
  out.R = lerp(a.R, b.R, t);
  out.H = lerp(a.H, b.H, t);
  out.roll = lerp(a.roll, b.roll, t);
  return out;
}

const tmpDir = new Vector3();
const mSpine = new Matrix4();
const mInv = new Matrix4();
const gR = new Vector3();
const gL = new Vector3();
const poleR = new Vector3(1, -0.6, 0.4);
const poleL = new Vector3(-1, -0.6, 0.4);

interface SextonState {
  g: Gait;
  arms: [Limb, Limb] | null;
  pose: Pose;
  base: Pose;
}

function animateSexton(rig: Rig, s: AnimInput, st: SextonState): void {
  const n = rig.nodes;
  const [root, hips, spine, head, hood, eyesDim, eyesHot, lantern, shovel] = ["root", "hips", "spine", "head", "hood", "eyesDim", "eyesHot", "lantern", "shovel"].map((k) => node(n, k));
  const [thL, shL, ftL, thR, shR, ftR] = ["thighL", "shinL", "footL", "thighR", "shinR", "footR"].map((k) => node(n, k));
  const [armR, armL, handR, handL] = ["armR", "armL", "handR", "handL"].map((k) => node(n, k));
  st.arms ??= [limb(n, "armR", "foreR", P.shR, P.elR, P.wrR), limb(n, "armL", "foreL", P.shL, P.elL, P.wrL)];
  const g = st.g;
  g.update(s, s.anim === Anim.Run ? 2.4 : 1.7);
  const t = s.time;
  const w = g.amt;
  const feral = s.hp < 0.5 && s.anim !== Anim.Dead;
  const fr = feral ? 1 : 0;

  // Heavy, stomping gait.
  const pL = g.sin(0);
  const pR = g.sin(0.5);
  turn(thL, pL * 0.4 * w);
  turn(shL, -Math.max(0, g.cos(0)) * 0.6 * w);
  turn(ftL, -pL * 0.15 * w);
  turn(thR, pR * 0.4 * w);
  turn(shR, -Math.max(0, g.cos(0.5)) * 0.6 * w);
  turn(ftR, -pR * 0.15 * w);
  hips.position.y += (Math.abs(g.cos(0)) * 0.06 - 0.04) * w - 0.14 * fr;
  turn(hips, 0, g.sin(0) * 0.08 * w, g.sin(0.25) * 0.05 * w);
  turn(thL, 0.25 * fr);
  turn(shL, -0.45 * fr);
  turn(thR, 0.25 * fr);
  turn(shR, -0.45 * fr);
  // Breath: slow and bellows-deep; ragged when feral.
  const br = Math.sin(t * (feral ? 3.2 : 1.1));
  turn(spine, -0.05 + br * 0.025 - 0.28 * fr - 0.06 * w, -g.sin(0) * 0.06 * w, g.sin(0.25) * 0.04 * w);
  turn(head, 0.1 + wobble(t * 0.4, 7) * 0.08 + 0.25 * fr, wobble(t * 0.3, 2) * 0.25 + (feral ? Math.sin(t * 9) * Math.max(0, Math.sin(t * 1.3)) * 0.15 : 0), wobble(t * 0.35, 9) * 0.1);
  hood.visible = !feral;
  eyesDim.visible = !feral;
  eyesHot.visible = feral;
  // Lantern swings on its chain.
  turn(lantern, g.sin(0.2) * 0.35 * w + Math.sin(t * 1.3) * 0.08, 0, g.sin(0.45) * 0.2 * w);

  // Shovel pose: leaning on it at rest, carried low when moving or roused.
  const alert = w > 0.1 || feral || s.anim !== Anim.Idle;
  mix(POSES.lean, POSES.ready, alert ? 1 : 0, st.base);
  st.base.H += Math.abs(g.cos(0)) * 0.05 * w;
  let pose = st.base;
  let twist = 0;
  let lean = 0;
  if (s.anim === Anim.Windup || s.anim === Anim.Strike || s.anim === Anim.Recover) {
    const tm = timing(T, s.variant);
    const p = attackPose(s, tm.windup, tm.recover);
    const shake = windupShake(s, tm.windup);
    const [coil, hit] =
      s.variant === 1 ? [POSES.slamUp, POSES.slamDown] : s.variant === 2 ? [POSES.scoop, POSES.fling] : [POSES.sweepBack, POSES.sweepEnd];
    if (s.anim === Anim.Windup) pose = mix(st.base, coil, -p, st.pose);
    else if (s.anim === Anim.Strike) pose = mix(coil, hit, (p + 1) / 2, st.pose);
    else pose = mix(st.base, hit, p, st.pose);
    pose.H += shake * 0.02;
    twist = pose.b * 0.5;
    if (s.variant === 1) lean = p < 0 ? 0.3 * -p : -0.5 * p;
    else if (s.variant === 2) lean = p < 0 ? -0.35 * -p : 0.15 * p;
    else lean = -0.1 * Math.abs(p);
    // Wide stance for the big swings.
    turn(thL, -0.2 * Math.abs(p), 0, -0.12 * Math.abs(p));
    turn(thR, 0.1 * Math.abs(p), 0, 0.12 * Math.abs(p));
    turn(shR, -0.25 * Math.abs(p));
    hips.position.y -= 0.12 * Math.abs(p);
  }
  if (s.anim === Anim.Cast || s.anim === Anim.Special) twist = Math.sin(t * 6) * 0.1;
  turn(spine, lean, twist);
  turn(head, -lean * 0.6, -twist * 0.5);

  const f = flinch(s) * 0.7 + staggerAmt(s);
  if (f) {
    turn(spine, f * 0.3, 0, f * 0.1);
    turn(head, f * 0.35, f * 0.2);
    hips.position.y -= f * 0.08;
  }
  const d = deathT(s, 0.8);
  if (d > 0) pose = mix(pose, POSES.dropped, easeOut(d * 1.5), st.pose);

  // Place the shovel.
  const tipY = pose.H;
  shovel.position.set(-Math.sin(pose.b) * pose.R, tipY, -0.15 - Math.cos(pose.b) * pose.R);
  tmpDir.set(-Math.sin(pose.a) * Math.cos(pose.p), -Math.sin(pose.p), -Math.cos(pose.a) * Math.cos(pose.p));
  aimDown(shovel, tmpDir, pose.roll + pose.a);

  if (d > 0) {
    // Down on his knees, then forward onto his face.
    const kneel = span(d, 0, 0.45);
    const fall = span(d, 0.35, 1);
    hips.position.y -= 0.6 * kneel;
    turn(thL, 1.3 * kneel);
    turn(shL, -1.9 * kneel);
    turn(thR, 1.2 * kneel);
    turn(shR, -1.8 * kneel);
    turn(spine, -0.3 * kneel);
    root.position.y += 0.35 * fall;
    root.position.z -= 0.4 * fall;
    turn(root, -1.42 * easeOut(fall));
    turn(armR, 1.9 * fall, 0, 0.4);
    turn(armL, 1.2 * fall, 0, -0.5);
    turn(head, -0.3 * fall, 1.0 * fall);
    return;
  }

  // Both hands on the haft: IK in the spine's frame.
  hips.updateMatrix();
  spine.updateMatrix();
  shovel.updateMatrix();
  mSpine.multiplyMatrices(hips.matrix, spine.matrix);
  mInv.copy(mSpine).invert();
  gR.copy(GRIP_R).applyMatrix4(shovel.matrix).applyMatrix4(mInv);
  gL.copy(GRIP_L).applyMatrix4(shovel.matrix).applyMatrix4(mInv);
  // Wrist sits a hand-length above the grip.
  gR.y += 0.2;
  gL.y += 0.2;
  ik2(st.arms[0], gR, poleR);
  ik2(st.arms[1], gL, poleL);
  turn(handR, -0.3, 0, 0.2);
  turn(handL, -0.3, 0, -0.2);
  void armR;
  void armL;
}

registerModel("sexton", (opts: ModelOptions) => {
  const st: SextonState = { g: new Gait(), arms: null, pose: { ...POSES.ready }, base: { ...POSES.ready } };
  return rigModel(buildSexton, (rig, s) => animateSexton(rig, s, st), opts, (rig) => ({
    head: node(rig.nodes, "head"),
    light: node(rig.nodes, "lantern"),
    weapon: node(rig.nodes, "shovel"),
  }));
});

