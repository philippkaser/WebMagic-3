import { Euler, Vector3 } from "three";
import { Anim, Flag } from "../../../../shared/sim/entity";
import { turn, type RigBuilder, type Rig, type T3 } from "../kit";
import {
  attackPose,
  bone,
  candle,
  clamp01,
  deathT,
  easeOut,
  flame,
  flinch,
  Gait,
  glow,
  hand,
  lerp,
  node,
  rand,
  skull,
  smooth,
  span,
  staggerAmt,
  TAU,
  VOID,
  windupShake,
  wobble,
} from "../parts";
import { registerModel, rigModel, type AnimInput, type ModelOptions } from "../registry";
import { timing, timings } from "./common";
import "./sexton";

/** Stratum 1 — the Undercroft's creatures: the grave rat, the ossuary
 * shambler and the candle wight. (The Sexton lives in ./sexton.ts.) */

// ── Grave rat ────────────────────────────────────────────────────────────────

const RAT_T = timings("rat", [{ windup: 0.25, recover: 0.4 }]);

function buildRat(r: RigBuilder, seed: number): void {
  const R = rand(seed);
  const furTint = ["#5a4c40", "#4a4038", "#62544a", "#3e3630"][Math.floor(R() * 4)];
  const fur = { mat: "fur", tint: furTint, uvm: 0.35 };
  const furDark = { mat: "fur", tint: "#2e2620", uvm: 0.3 };
  const pink = { mat: "flesh.pale", tint: "#c89088", uvm: 0.25 };
  const mange = { mat: "flesh.pale", tint: "#8a6a64", uvm: 0.3 };

  const body = r.joint("body", "root", [0, 0.13, 0]);
  // Hunched, pear-shaped body: fat rump, high back, narrow shoulders.
  body.sphere(0.115, { ...fur, at: [0, 0.14, 0.08], squash: [1, 0.86, 1.15], segments: 10, rings: 7 });
  body.sphere(0.1, { ...fur, at: [0, 0.155, -0.02], squash: [0.92, 0.9, 1.2], segments: 10, rings: 7 });
  body.sphere(0.075, { ...fur, at: [0, 0.125, -0.11], squash: [1, 0.95, 1.1], segments: 8, rings: 6 });
  body.sphere(0.08, { mat: "fur", tint: "#7a6a5a", uvm: 0.3, at: [0, 0.095, 0], squash: [0.9, 0.7, 1.45], segments: 8, rings: 5 });
  // Mange and scars.
  body.sphere(0.035, { ...mange, at: [0.085, 0.17, 0.05], squash: [0.4, 1, 1.3], segments: 6, rings: 4 });
  body.sphere(0.025, { ...mange, at: [-0.05, 0.225, -0.03], squash: [1, 0.4, 1.4], segments: 6, rings: 4 });
  // Bristling spine tufts.
  for (let i = 0; i < 6; i++) {
    const z = -0.1 + i * 0.045;
    const y = 0.23 + Math.sin((i / 5) * Math.PI) * 0.03;
    body.cone(0.018, 0.05, { ...furDark, at: [(R() - 0.5) * 0.02, y, z], rot: [1.1 + R() * 0.3, 0, (R() - 0.5) * 0.5], segments: 4 });
  }
  body.mirrorX((m) => m.cone(0.02, 0.045, { ...furDark, at: [0.07, 0.19, 0.1], rot: [1.3, 0, -0.9], segments: 4 }));

  const head = r.joint("head", "body", [0, 0.14, -0.15]);
  head.sphere(0.056, { ...fur, at: [0, 0.155, -0.2], squash: [0.95, 0.85, 1.25], segments: 9, rings: 6 });
  head.cone(0.037, 0.085, { ...fur, at: [0, 0.14, -0.27], rot: [-Math.PI / 2 - 0.12, 0, 0], segments: 7 });
  head.sphere(0.013, { ...pink, tint: "#b86a6a", at: [0, 0.133, -0.312], segments: 6, rings: 4 });
  head.mirrorX((m) => {
    // Beady eyes with a red glint.
    m.sphere(0.012, { ...VOID, at: [0.032, 0.168, -0.235], segments: 6, rings: 4 });
    m.sphere(0.006, { ...glow("#ff4028", 2.5), at: [0.036, 0.17, -0.244], segments: 4, rings: 3 });
    // Big translucent-pink ears.
    m.sphere(0.033, { ...fur, at: [0.045, 0.205, -0.17], rot: [0.2, 0.5, 0.35], squash: [1, 1.05, 0.3], segments: 8, rings: 5 });
    m.sphere(0.026, { ...pink, tint: "#d89898", at: [0.046, 0.205, -0.176], rot: [0.2, 0.5, 0.35], squash: [1, 1.05, 0.25], segments: 7, rings: 4 });
    // Whiskers fanning back.
    for (let k = 0; k < 3; k++)
      m.box([0.004, 0.004, 0.1], { mat: "bone", tint: "#d8d0c0", at: [0.05, 0.14 + (k - 1) * 0.01, -0.275], rot: [(k - 1) * 0.2, 0.9 + k * 0.25, 0] });
  });
  head.mirrorX((m) => m.box([0.009, 0.022, 0.006], { mat: "bone", tint: "#d8b050", at: [0.006, 0.112, -0.297] }));
  const jaw = r.joint("jaw", "head", [0, 0.125, -0.2]);
  jaw.sphere(0.03, { ...fur, tint: "#6a5a4a", at: [0, 0.113, -0.245], squash: [0.9, 0.5, 1.5], segments: 7, rings: 4 });
  jaw.mirrorX((m) => m.box([0.008, 0.016, 0.006], { mat: "bone", tint: "#d8b050", at: [0.005, 0.117, -0.285] }));

  // Legs: fur-sleeved upper, pink bare lower, long hind feet.
  r.joint("legFL", "body", [0.05, 0.12, -0.1]);
  r.joint("legFR", "body", [-0.05, 0.12, -0.1]);
  for (const [n, sx] of [
    ["legFL", 1],
    ["legFR", -1],
  ] as const) {
    const g = r.part(n);
    g.capsule(0.022, 0.05, { ...fur, at: [0.055 * sx, 0.075, -0.115], rot: [0.2, 0, 0], segments: 6 });
    g.capsule(0.011, 0.045, { ...pink, at: [0.057 * sx, 0.035, -0.13], segments: 5 });
    g.sphere(0.017, { ...pink, at: [0.057 * sx, 0.01, -0.145], squash: [1, 0.45, 1.4], segments: 6, rings: 3 });
    for (let k = 0; k < 3; k++) g.cone(0.004, 0.018, { ...pink, tint: "#e0c0b0", at: [0.057 * sx + (k - 1) * 0.008, 0.008, -0.165], rot: [-Math.PI / 2, 0, 0], segments: 3 });
  }
  r.joint("legHL", "body", [0.07, 0.13, 0.08]);
  r.joint("legHR", "body", [-0.07, 0.13, 0.08]);
  for (const [n, sx] of [
    ["legHL", 1],
    ["legHR", -1],
  ] as const) {
    const g = r.part(n);
    g.sphere(0.052, { ...fur, at: [0.078 * sx, 0.095, 0.09], squash: [0.65, 1, 1.15], segments: 8, rings: 5 });
    g.capsule(0.011, 0.04, { ...pink, at: [0.085 * sx, 0.04, 0.135], rot: [-0.5, 0, 0], segments: 5 });
    g.capsule(0.012, 0.06, { ...pink, at: [0.085 * sx, 0.012, 0.11], rot: [Math.PI / 2, 0, 0], segments: 5 });
    for (let k = 0; k < 3; k++) g.cone(0.004, 0.02, { ...pink, tint: "#e0c0b0", at: [0.085 * sx + (k - 1) * 0.009, 0.008, 0.06], rot: [-Math.PI / 2, 0, 0], segments: 3 });
  }

  // Tail: three tapering segments so it can whip and curl.
  const tail: [string, string, T3, T3, number, number][] = [
    ["tail0", "body", [0, 0.13, 0.19], [0, 0.075, 0.34], 0.02, 0.014],
    ["tail1", "tail0", [0, 0.075, 0.34], [0.03, 0.03, 0.49], 0.014, 0.009],
    ["tail2", "tail1", [0.03, 0.03, 0.49], [0.09, 0.015, 0.63], 0.009, 0.003],
  ];
  for (const [n, parent, a, c, r0, r1] of tail) {
    r.joint(n, parent, a).tube([a, [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2 + 0.005, (a[2] + c[2]) / 2], c], (t) => lerp(r0, r1, t), {
      mat: "flesh.pale",
      tint: "#a07a72",
      uvm: 0.08,
      radial: 5,
      segments: 5,
    });
  }
}

function animateRat(rig: Rig, s: AnimInput, g: Gait): void {
  const n = rig.nodes;
  const body = node(n, "body");
  const head = node(n, "head");
  const jaw = node(n, "jaw");
  const legs = ["legFL", "legFR", "legHL", "legHR"].map((k) => node(n, k));
  const tail = ["tail0", "tail1", "tail2"].map((k) => node(n, k));
  const run = s.anim === Anim.Run || s.anim === Anim.Flee || s.speed > 4.8;
  g.update(s, run ? 0.7 : 0.42);
  const t = s.time;
  const w = g.amt;

  // Gait: trot (diagonal pairs) when walking, bounding gallop when running.
  const phases = run ? [0, 0.08, 0.5, 0.58] : [0, 0.5, 0.5, 0];
  legs.forEach((leg, i) => {
    const ph = g.sin(phases[i]);
    const lift = Math.max(0, g.cos(phases[i]));
    turn(leg, ph * 0.75 * w * (i < 2 ? 1 : 1.1));
    leg.position.y += lift * 0.018 * w;
  });
  const bob = Math.abs(g.sin(0.25)) * 0.012 * w;
  body.position.y += bob;
  turn(body, run ? g.sin(0.3) * 0.12 * w : 0, 0, run ? 0 : g.sin() * 0.07 * w);
  // Idle: breathe, sniff, glance.
  const idle = 1 - w;
  const sniff = Math.sin(t * 1.3) > 0.2 ? Math.sin(t * 22) * 0.04 : 0;
  body.position.y += Math.sin(t * 5) * 0.003;
  turn(head, (sniff + Math.sin(t * 0.9) * 0.12) * idle - g.sin(0.25) * 0.05 * w, wobble(t * 0.6, 3) * 0.5 * idle);
  tail.forEach((seg, i) => turn(seg, i === 0 ? 0.1 * w : 0, (Math.sin(t * 2 - i * 0.9) * 0.2 + g.sin(-0.2 * i) * 0.25 * w) * (1 + i * 0.3)));

  if (s.anim === Anim.Flee) {
    // Belly to the floor, tail streaming.
    body.position.y -= 0.03;
    turn(head, 0.1);
    turn(tail[0], -0.15);
  }
  if (s.anim === Anim.Windup || s.anim === Anim.Strike || s.anim === Anim.Recover) {
    const tm = timing(RAT_T, s.variant);
    const p = attackPose(s, tm.windup, tm.recover);
    const coil = Math.max(0, -p);
    const lunge = Math.max(0, p);
    // Coil: rear back onto the haunches, head up, jaws wide.
    body.position.z += coil * 0.06 - lunge * 0.14;
    body.position.y += lunge * 0.03;
    turn(body, coil * 0.35 - lunge * 0.15);
    turn(head, -coil * 0.1 - lunge * 0.3);
    turn(jaw, -coil * 0.7 - (s.anim === Anim.Strike ? 0.4 * (1 - s.animTime / 0.12) : 0));
    turn(legs[0], -coil * 0.6 + lunge * 0.9);
    turn(legs[1], -coil * 0.6 + lunge * 0.9);
    turn(legs[2], coil * 0.5 - lunge * 0.7);
    turn(legs[3], coil * 0.5 - lunge * 0.7);
    turn(tail[0], coil * 0.4);
    head.position.x += windupShake(s, tm.windup) * 0.004;
  }
  if (s.anim === Anim.Feed) {
    // Head down, gnawing, the odd tearing yank.
    body.position.y -= 0.02;
    turn(body, -0.2);
    const yank = Math.max(0, Math.sin(t * 2.3)) ** 8;
    turn(head, -0.55 + yank * 0.35 + Math.sin(t * 17) * 0.05, Math.sin(t * 3) * 0.15);
    turn(jaw, -0.25 - Math.max(0, Math.sin(t * 19)) * 0.3);
    turn(legs[0], 0.5);
    turn(legs[1], 0.4);
  }
  const f = flinch(s) + staggerAmt(s);
  if (f) {
    body.position.z += f * 0.04;
    turn(body, f * 0.3, 0, f * 0.3);
    turn(head, f * 0.4, f * 0.3);
    turn(jaw, -f * 0.5);
  }
  if (s.anim === Anim.Sleep || s.flags & Flag.Asleep) {
    // Curled nose-to-tail.
    body.position.y -= 0.05;
    turn(body, -0.05, 0, 0.05 + Math.sin(t * 1.5) * 0.02);
    turn(head, -0.3, 1.1);
    legs.forEach((l, i) => turn(l, i < 2 ? 1.1 : -1.0));
    tail.forEach((seg) => turn(seg, 0, -1.0));
    turn(jaw, 0);
  }
  const d = deathT(s, 0.35);
  if (d > 0) {
    // Flipped onto its back, legs stiff in the air.
    body.position.y -= 0.02 * d;
    turn(body, 0, 0, 2.5 * d);
    legs.forEach((l, i) => turn(l, (i < 2 ? 0.5 : -0.4) * d, 0, (i % 2 ? -0.5 : 0.5) * d));
    turn(head, 0.3 * d, 0.4 * d);
    turn(jaw, -0.4 * d);
    tail.forEach((seg, i) => turn(seg, 0, (0.3 - i * 0.2) * d));
  }
}

registerModel("rat", (opts: ModelOptions) => {
  const g = new Gait();
  return rigModel(
    (r) => buildRat(r, opts.seed ?? 3),
    (rig, s) => animateRat(rig, s, g),
    opts,
    (rig) => ({ head: node(rig.nodes, "head") }),
  );
});

// ── Ossuary shambler ─────────────────────────────────────────────────────────

const SHAMBLER_T = timings("shambler", [
  { windup: 0.55, recover: 0.6 },
  { windup: 0.7, recover: 0.8 },
]);
const BONE_TINTS = ["#e6dcc4", "#d4c49c", "#c8b488", "#b8a078", "#ddd2b8", "#a89068"];

// Joint pivots (model space). The right arm is a stranger's: too long.
const SH = {
  hips: [0, 0.95, 0.02] as T3,
  spine: [0, 1.02, 0.04] as T3,
  neck: [0.01, 1.5, -0.09] as T3,
  shR: [0.2, 1.44, -0.03] as T3,
  elR: [0.25, 1.02, 0.0] as T3,
  wrR: [0.27, 0.62, -0.06] as T3,
  shL: [-0.19, 1.43, -0.03] as T3,
  elL: [-0.22, 1.16, 0.0] as T3,
  wrL: [-0.23, 0.9, -0.08] as T3,
  hipL: [-0.11, 0.92, 0.02] as T3,
  kneeL: [-0.13, 0.5, -0.03] as T3,
  ankL: [-0.13, 0.07, 0.02] as T3,
  hipR: [0.11, 0.92, 0.02] as T3,
  kneeR: [0.14, 0.46, -0.05] as T3,
  ankR: [0.14, 0.07, 0.03] as T3,
};

function buildShambler(r: RigBuilder, seed: number): void {
  const R = rand(seed);
  const tint = () => BONE_TINTS[Math.floor(R() * BONE_TINTS.length)];
  const rag = { mat: "cloth.linen", tint: "#6a5e4c", uvm: 0.6 };
  const twine = { mat: "rope", tint: "#6a5a40", uvm: 0.15 };
  const tag = (b: ReturnType<RigBuilder["part"]>, at: T3, rot: T3) => {
    b.box([0.035, 0.05, 0.004], { mat: "paper", tint: "#c8b890", at, rot, uvm: 0.2 });
    b.box([0.003, 0.03, 0.003], { ...twine, at: [at[0], at[1] + 0.035, at[2]], rot });
  };

  // Pelvis: iliac wings, sacrum, a rag loincloth.
  const hips = r.joint("hips", "root", SH.hips);
  hips.mirrorX((m) => m.sphere(0.085, { mat: "bone", tint: tint(), uvm: 0.4, at: [0.08, 0.96, 0.03], rot: [0, 0.4, 0.3], squash: [1, 0.8, 0.35], segments: 8, rings: 5 }));
  hips.box([0.08, 0.1, 0.06], { mat: "bone", tint: tint(), uvm: 0.4, at: [0, 0.93, 0.07], bevel: 0.02 });
  hips.torus(0.055, 0.016, { mat: "bone", tint: tint(), uvm: 0.3, at: [0, 0.88, -0.01], rot: [Math.PI / 2 - 0.3, 0, 0], radial: 4, tubular: 10 });
  // A twine girdle with rag strips of shroud knotted on, mostly one side.
  hips.torus(0.13, 0.01, { ...twine, at: [0, 0.94, 0.02], rot: [Math.PI / 2 + 0.12, 0, 0.1], radial: 3, tubular: 10 });
  for (let i = 0; i < 7; i++) {
    const a = -2.2 + i * 0.62 + (R() - 0.5) * 0.3;
    const len = 0.18 + R() * 0.2 + (i < 3 ? 0.08 : 0);
    const x = Math.sin(a) * 0.14;
    const z = Math.cos(a) * 0.12 + 0.02;
    hips.box([0.07 + R() * 0.04, len, 0.012], {
      ...rag,
      tint: ["#6a5e4c", "#5a5040", "#7a6c58"][i % 3],
      at: [x * 1.1, 0.93 - len / 2, z * 1.1],
      rot: [(z < 0 ? -1 : 1) * (0.12 + R() * 0.1), a, (R() - 0.5) * 0.25],
      flat: true,
    });
  }

  // Spine and ribcage — too many ribs, from too many people.
  const sp = r.joint("spine", "hips", SH.spine);
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const y = lerp(1.0, 1.5, t);
    const z = 0.05 + Math.sin(t * Math.PI) * 0.06 - t * 0.1;
    sp.cylinder(0.026, 0.028, 0.034, { mat: "bone", tint: tint(), uvm: 0.3, at: [0, y, z], rot: [0.3 * t, 0, 0], segments: 5 });
    sp.box([0.012, 0.03, 0.035], { mat: "bone", tint: tint(), uvm: 0.3, at: [0, y, z + 0.035], rot: [0.5, 0, 0] });
  }
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const y = 1.19 + i * 0.034 + (R() - 0.5) * 0.015;
    const rad = 0.1 + Math.sin((0.25 + t * 0.7) * Math.PI) * 0.05 + (R() - 0.5) * 0.02;
    const gap = 0.7 + R() * 0.9 + (i === 3 ? 1.2 : 0);
    const g = Math.PI * 2 - gap / 2;
    sp.group({ at: [(R() - 0.5) * 0.02, y, 0.0 - t * 0.04], rot: [-0.35, 0, (R() - 0.5) * 0.12] }, (b) =>
      b.group({ rot: [0, g + Math.PI / 2, 0] }, (c) =>
        c.torus(rad, 0.012, { mat: "bone", tint: tint(), uvm: 0.3, rot: [Math.PI / 2, 0, 0], scale: [1.15, 1, 1], arc: Math.PI * 2 - gap, radial: 3, tubular: 10 }),
      ),
    );
  }
  sp.box([0.035, 0.2, 0.02], { mat: "bone", tint: tint(), uvm: 0.3, at: [0, 1.31, -0.13], rot: [-0.35, 0, 0.05], bevel: 0.008 });
  // Twine lashings holding the chest together.
  sp.torus(0.13, 0.008, { ...twine, at: [0, 1.25, -0.01], rot: [Math.PI / 2 - 0.3, 0, 0], radial: 3, tubular: 12 });
  sp.torus(0.14, 0.008, { ...twine, at: [0, 1.39, -0.04], rot: [Math.PI / 2 - 0.4, 0, 0.1], radial: 3, tubular: 12 });
  // Clavicles and shoulder blades.
  sp.mirrorX((m, side) => {
    bone(m, [0.02, 1.47, -0.1], [0.19, 1.45, -0.04], 0.012, tint(), 0.3);
    m.sphere(0.07, { mat: "bone", tint: tint(), uvm: 0.3, at: [0.1, 1.36, 0.1], rot: [0.2, side * 0.3, 0], squash: [0.9, 1.2, 0.2], segments: 6, rings: 4 });
  });
  // A second, smaller skull wedged under the collarbone.
  skull(sp, { at: [-0.1, 1.32, -0.1], rot: [0.3, 0.6, 0.4], s: 0.62, tint: "#c0ac80", jaw: false });
  // Rotten shroud scrap over the left shoulder.
  sp.box([0.16, 0.36, 0.02], { ...rag, at: [-0.19, 1.27, 0.06], rot: [0.15, 0.3, 0.12], flat: true });
  sp.box([0.12, 0.2, 0.02], { ...rag, tint: "#5a5040", at: [-0.21, 1.02, 0.1], rot: [0.25, 0.3, 0.2], flat: true });
  tag(sp, [0.09, 1.2, -0.13], [0.2, 0.2, 0.2]);

  // Head: a lolling skull with a painted name.
  const head = r.joint("head", "spine", SH.neck);
  skull(head, { at: [0.015, 1.6, -0.12], rot: [0.1, -0.15, 0.22], s: 1.12, tint: "#e2d6b8", jaw: false, eyes: { color: "#9fc8ff", emit: 2.2 } });
  head.box([0.13, 0.018, 0.08], { mat: "cloth.velvet", tint: "#8a2a1a", at: [0.01, 1.66, -0.19], rot: [0.1, -0.15, 0.22], uvm: 0.3 });
  const jaw = r.joint("jaw", "head", [0.015, 1.545, -0.13]);
  jaw.group({ at: [0.015, 1.6, -0.12], rot: [0.1, -0.15, 0.22], scale: 1.12 }, (j) => {
    j.box([0.1, 0.022, 0.07], { mat: "bone", tint: "#d4c49c", uvm: 0.3, at: [0, -0.09, -0.045], bevel: 0.008 });
    j.box([0.07, 0.018, 0.02], { mat: "bone", tint: "#e8dcc0", uvm: 0.3, at: [0, -0.078, -0.068], bevel: 0.004 });
    j.mirrorX((m) => m.box([0.018, 0.06, 0.03], { mat: "bone", tint: "#d4c49c", uvm: 0.3, at: [0.05, -0.07, -0.005], rot: [0.3, 0, 0], bevel: 0.006 }));
  });

  // Right arm: a femur for an upper arm, lashed to a second bone.
  const aR = r.joint("armR", "spine", SH.shR);
  aR.sphere(0.04, { mat: "bone", tint: tint(), uvm: 0.3, at: SH.shR, segments: 7, rings: 5 });
  bone(aR, SH.shR, SH.elR, 0.022, tint(), 0.4);
  bone(aR, [0.23, 1.38, 0.0], [0.26, 1.1, 0.02], 0.012, tint(), 0.4);
  aR.torus(0.035, 0.008, { ...twine, at: [0.24, 1.24, 0.0], rot: [Math.PI / 2, 0, 0.1], radial: 3, tubular: 8 });
  const fR = r.joint("foreR", "armR", SH.elR);
  bone(fR, SH.elR, SH.wrR, 0.016, tint(), 0.4);
  bone(fR, [SH.elR[0] + 0.03, SH.elR[1] - 0.02, SH.elR[2]], [SH.wrR[0] + 0.03, SH.wrR[1] + 0.02, SH.wrR[2]], 0.011, tint(), 0.4);
  const hR = r.joint("handR", "foreR", SH.wrR);
  hand(hR, { at: SH.wrR, s: 1.45, mat: "bone", tint: "#d4c49c", curl: 0.35, spread: 0.2, gaunt: true, uvm: 0.3 });

  // Left arm: short, a child's forearm on a man's shoulder.
  const aL = r.joint("armL", "spine", SH.shL);
  aL.sphere(0.035, { mat: "bone", tint: tint(), uvm: 0.3, at: SH.shL, segments: 7, rings: 5 });
  bone(aL, SH.shL, SH.elL, 0.018, tint(), 0.4);
  const fL = r.joint("foreL", "armL", SH.elL);
  bone(fL, SH.elL, SH.wrL, 0.011, tint(), 0.4);
  bone(fL, [SH.elL[0] - 0.025, SH.elL[1], SH.elL[2]], [SH.wrL[0] - 0.02, SH.wrL[1], SH.wrL[2]], 0.009, tint(), 0.4);
  const hL = r.joint("handL", "foreL", SH.wrL);
  hL.group({ scale: [-1, 1, 1] }, (m) => hand(m, { at: [-SH.wrL[0], SH.wrL[1], SH.wrL[2]], s: 1.0, mat: "bone", tint: "#e0d2b0", curl: 0.5, gaunt: true, uvm: 0.3 }));
  // The rib it will fling (shown only while winding up the throw).
  const miss = r.joint("missile", "handL", [SH.wrL[0], SH.wrL[1] - 0.12, SH.wrL[2]]);
  bone(miss, [SH.wrL[0], SH.wrL[1] - 0.02, SH.wrL[2] - 0.1], [SH.wrL[0], SH.wrL[1] - 0.2, SH.wrL[2] + 0.1], 0.013, "#e8dcc0", 0.3);

  // Legs.
  for (const [side, hip, knee, ank] of [
    ["L", SH.hipL, SH.kneeL, SH.ankL],
    ["R", SH.hipR, SH.kneeR, SH.ankR],
  ] as const) {
    const th = r.joint(`thigh${side}`, "hips", hip);
    th.sphere(0.035, { mat: "bone", tint: tint(), uvm: 0.3, at: hip, segments: 6, rings: 4 });
    bone(th, hip, knee, 0.022, tint(), 0.4);
    const sh = r.joint(`shin${side}`, `thigh${side}`, knee);
    sh.sphere(0.032, { mat: "bone", tint: tint(), uvm: 0.3, at: [knee[0], knee[1], knee[2] - 0.025], squash: [1, 0.8, 0.6], segments: 6, rings: 4 });
    bone(sh, knee, ank, 0.02, tint(), 0.4);
    bone(sh, [knee[0] + (side === "L" ? -0.035 : 0.035), knee[1] - 0.03, knee[2] + 0.02], [ank[0] + (side === "L" ? -0.03 : 0.03), ank[1] + 0.03, ank[2] + 0.01], 0.01, tint(), 0.4);
    const ft = r.joint(`foot${side}`, `shin${side}`, ank);
    ft.box([0.07, 0.04, 0.09], { mat: "bone", tint: tint(), uvm: 0.3, at: [ank[0], 0.04, ank[2] + 0.01], bevel: 0.015 });
    for (let k = 0; k < 4; k++) bone(ft, [ank[0] + (k - 1.5) * 0.018, 0.035, ank[2] - 0.03], [ank[0] + (k - 1.5) * 0.024, 0.015, ank[2] - 0.13], 0.007, tint(), 0.2);
    if (side === "R") ft.box([0.1, 0.03, 0.14], { ...rag, tint: "#4a4034", at: [ank[0], 0.07, ank[2] - 0.03], rot: [0.1, 0.1, 0.05], flat: true });
  }
}

function animateShambler(rig: Rig, s: AnimInput, g: Gait): void {
  const n = rig.nodes;
  const [root, hips, spine, head, jaw] = ["root", "hips", "spine", "head", "jaw"].map((k) => node(n, k));
  const [armR, foreR, handR, armL, foreL] = ["armR", "foreR", "handR", "armL", "foreL"].map((k) => node(n, k));
  const [thL, shL, ftL, thR, shR, ftR] = ["thighL", "shinL", "footL", "thighR", "shinR", "footR"].map((k) => node(n, k));
  const missile = node(n, "missile");
  g.update(s, s.anim === Anim.Run ? 1.5 : 1.15);
  const t = s.time;
  const w = g.amt;

  // Shamble: the right leg drags; everything lurches toward the bad side.
  const pL = g.sin(0);
  const pR = g.sin(0.5);
  turn(thL, pL * 0.45 * w);
  turn(shL, -Math.max(0, g.cos(0)) * 0.7 * w);
  turn(ftL, -pL * 0.2 * w);
  turn(thR, pR * 0.3 * w, 0, 0.05 * w);
  turn(shR, -Math.max(0, g.cos(0.5)) * 0.35 * w);
  turn(ftR, 0.2 * w);
  hips.position.y += (Math.abs(g.sin(0.1)) * 0.04 - 0.03) * w;
  turn(hips, 0, g.sin(0.1) * 0.12 * w, g.sin(0.35) * 0.1 * w);
  turn(spine, (-0.18 - Math.abs(g.sin()) * 0.06) * w, -g.sin(0.1) * 0.15 * w, -g.sin(0.3) * 0.1 * w);
  // Idle: sway on the spot, bones settling.
  const sway = 1 - w * 0.6;
  turn(spine, Math.sin(t * 0.9) * 0.04 * sway - 0.08, wobble(t * 0.4, 1) * 0.1 * sway, Math.sin(t * 0.7) * 0.05 * sway);
  turn(head, wobble(t * 0.7, 2) * 0.15 - g.sin(0.2) * 0.12 * w, wobble(t * 0.5, 5) * 0.25, Math.sin(t * 0.8) * 0.12 + g.sin(0.4) * 0.15 * w);
  turn(jaw, 0.1 + Math.max(0, Math.sin(t * 1.7)) ** 6 * 0.25);
  // Dangling arms, lagging the body.
  turn(armR, -g.sin(0.1) * 0.35 * w + Math.sin(t * 0.9 + 1) * 0.05, 0, 0.12 + Math.sin(t * 0.7) * 0.04);
  turn(foreR, 0.25 + Math.max(0, -g.sin(0.2)) * 0.3 * w);
  turn(armL, -g.sin(0.6) * 0.3 * w + Math.sin(t * 0.8) * 0.05, 0, -0.18);
  turn(foreL, 0.5 + Math.max(0, -g.sin(0.7)) * 0.3 * w);
  turn(handR, Math.sin(t * 1.1) * 0.1);
  missile.visible = false;

  if (s.anim === Anim.Windup || s.anim === Anim.Strike || s.anim === Anim.Recover) {
    const tm = timing(SHAMBLER_T, s.variant);
    const p = attackPose(s, tm.windup, tm.recover);
    const coil = Math.max(0, -p);
    const hit = Math.max(0, p);
    const shake = windupShake(s, tm.windup) * 0.03;
    if (s.variant === 1) {
      // Bone fling: reach into the chest, rip a rib, hurl it overhand.
      const reach = span(-p, 0, 0.45);
      const raise = span(-p, 0.4, 1);
      turn(armL, lerp(reach * 0.8, -2.5, raise) + hit * 3.0 + shake, 0, lerp(0.5 * reach, -0.3, raise));
      turn(foreL, lerp(1.6 * reach, 1.2, raise) - hit * 1.0);
      turn(spine, -0.25 * raise + hit * 0.5, 0.35 * raise - hit * 0.5, 0);
      turn(head, 0.2 * raise - hit * 0.2);
      turn(jaw, 0.4 * raise);
      missile.visible = (s.anim === Anim.Windup && -p > 0.35) || (s.anim === Anim.Strike && s.animTime < 0.04);
    } else {
      // Swipe: the long arm cocks back and out, then rakes across.
      turn(armR, -0.8 * coil + 1.5 * hit + shake, 0, 1.3 * coil + 1.1 * hit);
      turn(foreR, 0.7 * coil + 0.1 * hit);
      turn(handR, 0, 0, 0.4 * coil);
      turn(spine, 0.1 * coil - 0.35 * hit, -0.55 * coil + 0.65 * hit, 0.12 * coil);
      turn(hips, 0, -0.2 * coil + 0.25 * hit);
      turn(head, -0.15 * coil, 0.3 * coil - 0.2 * hit);
      turn(jaw, 0.5 * coil);
      turn(thL, 0.3 * hit);
      turn(shL, -0.2 * hit);
    }
  }
  const f = flinch(s);
  if (f) {
    turn(spine, f * 0.35, 0, f * 0.15);
    turn(head, f * 0.5, f * 0.2, -f * 0.3);
    turn(jaw, f * 0.5);
    turn(armR, -f * 0.4, 0, f * 0.3);
    turn(armL, -f * 0.4, 0, -f * 0.3);
  }
  const st = staggerAmt(s);
  if (st) {
    turn(spine, st * 0.4, Math.sin(s.animTime * 7) * 0.2 * st, st * 0.25);
    turn(thR, -0.3 * st);
    turn(shR, -0.6 * st);
    hips.position.y -= 0.08 * st;
    turn(head, st * 0.6);
  }
  const d = deathT(s, 0.55);
  if (d > 0) {
    // Knees go, then the whole ill-sorted stack pitches onto its face.
    const buckle = span(d, 0, 0.5);
    const fall = span(d, 0.3, 1);
    hips.position.y -= 0.35 * buckle;
    turn(thL, 1.0 * buckle);
    turn(shL, -1.5 * buckle);
    turn(thR, 0.8 * buckle, 0, 0.3 * buckle);
    turn(shR, -1.1 * buckle);
    turn(spine, -0.5 * buckle);
    root.position.y += 0.12 * fall;
    root.position.z -= 0.25 * fall;
    turn(root, -1.45 * easeOut(fall));
    turn(armR, 2.4 * fall, 0, 0.6 * fall);
    turn(armL, 1.2 * fall, 0, -0.9 * fall);
    turn(head, 0, 1.1 * fall, 0.3 * fall);
    turn(jaw, 0.5 * d);
  }
}

registerModel("shambler", (opts: ModelOptions) => {
  const g = new Gait();
  return rigModel(
    (r) => buildShambler(r, opts.seed ?? 11),
    (rig, s) => animateShambler(rig, s, g),
    opts,
    (rig) => ({ head: node(rig.nodes, "head"), hand: node(rig.nodes, "handL") }),
  );
});

// ── Candle wight ─────────────────────────────────────────────────────────────

const WIGHT_T = timings("wight", [{ windup: 0.6, recover: 0.5 }]);

const WI = {
  body: [0, 0.92, 0.01] as T3,
  neck: [0, 1.38, -0.02] as T3,
  shR: [0.16, 1.3, 0.0] as T3,
  elR: [0.25, 1.07, 0.02] as T3,
  wrR: [0.045, 1.2, -0.22] as T3,
  shL: [-0.16, 1.3, 0.0] as T3,
  elL: [-0.25, 1.07, 0.02] as T3,
  wrL: [-0.045, 1.2, -0.22] as T3,
  candle: [0.01, 1.63, 0.04] as T3,
  tilt: [-0.12, 0, 0.1] as T3,
};
const CANDLE_H = 0.24;
const CANDLE_R = 0.058;
/** Wick tip of the head candle (model space). */
const WICK: T3 = (() => {
  const v = new Vector3(0, CANDLE_H + CANDLE_R * 0.45, 0).applyEuler(new Euler(...WI.tilt));
  return [WI.candle[0] + v.x, WI.candle[1] + v.y, WI.candle[2] + v.z];
})();

function buildWight(r: RigBuilder, seed: number): void {
  const R = rand(seed);
  const robe = { mat: "cloth.linen", tint: "#4a4440", uvm: 0.8 };
  const robeDark = { mat: "cloth.wool", tint: "#2a2628", uvm: 0.8 };
  const wax = { mat: "wax", tint: "#efe0bc", uvm: 0.3 };
  const skin = { mat: "flesh.pale", tint: "#a8a090", uvm: 0.3 };

  // Robe skirt on the root: bell-shaped with a tattered hem.
  const body = r.joint("body", "root", WI.body);
  body.lathe(
    [
      [0.3, 0.07],
      [0.285, 0.2],
      [0.24, 0.5],
      [0.18, 0.8],
      [0.15, 0.95],
      [0.001, 0.96],
    ],
    { ...robe, segments: 9, flat: true },
  );
  for (let i = 0; i < 13; i++) {
    const a = (i / 13) * TAU + R() * 0.2;
    const len = 0.08 + R() * 0.1;
    body.cone(0.055, len, { ...robe, tint: i % 3 ? "#403a36" : "#4a4440", at: [Math.sin(a) * 0.28, 0.07 - len / 2 + 0.01, Math.cos(a) * 0.28], rot: [Math.PI, a, 0], segments: 3, flat: true });
  }
  // Knotted rope girdle with hanging ends and a string of tallow beads.
  body.torus(0.155, 0.018, { mat: "rope", tint: "#8a7450", uvm: 0.2, at: [0, 0.94, 0], rot: [Math.PI / 2, 0, 0], radial: 4, tubular: 14 });
  body.tube([[0.05, 0.93, -0.15], [0.07, 0.75, -0.2], [0.05, 0.55, -0.23]], 0.012, { mat: "rope", tint: "#8a7450", uvm: 0.2, radial: 4 });
  body.tube([[0.08, 0.93, -0.14], [0.12, 0.8, -0.18], [0.12, 0.66, -0.2]], 0.011, { mat: "rope", tint: "#8a7450", uvm: 0.2, radial: 4 });
  for (let k = 0; k < 7; k++) body.sphere(0.017, { ...wax, at: [-0.05 - k * 0.012, 0.9 - k * 0.045, -0.16 - k * 0.012], segments: 5, rings: 4 });
  // Torso: narrow, stooped, a mourning shawl over the shoulders.
  body.lathe(
    [
      [0.15, 0.93],
      [0.16, 1.05],
      [0.18, 1.22],
      [0.16, 1.32],
      [0.07, 1.4],
      [0.001, 1.41],
    ],
    { ...robe, segments: 10 },
  );
  body.lathe(
    [
      [0.25, 1.08],
      [0.24, 1.18],
      [0.2, 1.3],
      [0.12, 1.39],
      [0.07, 1.42],
    ],
    { ...robeDark, segments: 10, flat: true },
  );
  // Wax that has run down over the shoulders and back.
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + 0.4;
    const x = Math.sin(a) * 0.16;
    const z = Math.cos(a) * 0.16;
    body.tube([[x * 0.6, 1.41, z * 0.6], [x * 1.3, 1.3, z * 1.3], [x * 1.45, 1.15 - R() * 0.15, z * 1.45]], (t) => 0.018 - t * 0.01, { ...wax, radial: 4, segments: 5 });
  }
  // Bare, bony feet under the hem.
  for (const [side, x] of [
    ["L", -0.09],
    ["R", 0.09],
  ] as const) {
    const ft = r.joint(`foot${side}`, "root", [x, 0.3, 0]);
    ft.capsule(0.03, 0.2, { ...skin, at: [x, 0.2, 0.0], segments: 5 });
    ft.box([0.07, 0.04, 0.15], { ...skin, at: [x, 0.02, -0.04], bevel: 0.015 });
    for (let k = 0; k < 4; k++) ft.capsule(0.008, 0.02, { ...skin, tint: "#8a8070", at: [x + (k - 1.5) * 0.015, 0.012, -0.12], rot: [Math.PI / 2, 0, 0], segments: 4 });
  }

  // Head: deep hood, a sunken face, the candle melted into the crown.
  const head = r.joint("head", "body", WI.neck);
  head.sphere(0.13, { ...robeDark, at: [0, 1.52, 0.02], squash: [1, 1.12, 1.1], segments: 10, rings: 7 });
  head.cone(0.1, 0.12, { ...robeDark, at: [0, 1.66, 0.06], rot: [-0.3, 0, 0], segments: 8 });
  head.sphere(0.095, { ...VOID, at: [0, 1.5, -0.075], squash: [0.95, 1.2, 0.6], segments: 8, rings: 6 });
  head.sphere(0.07, { ...skin, at: [0, 1.48, -0.07], squash: [0.85, 1.15, 0.8], segments: 8, rings: 6 });
  head.box([0.08, 0.018, 0.03], { ...skin, tint: "#7a7468", at: [0, 1.515, -0.125], bevel: 0.006 });
  head.mirrorX((m) => {
    m.sphere(0.02, { ...VOID, at: [0.028, 1.49, -0.128], segments: 6, rings: 4 });
    m.sphere(0.008, { ...glow("#ffb35a", 3), at: [0.028, 1.49, -0.14], segments: 4, rings: 3 });
  });
  head.box([0.035, 0.012, 0.02], { ...VOID, at: [0, 1.43, -0.135] });
  // One eye sealed under a wax run.
  head.tube([[0.03, 1.62, -0.06], [0.03, 1.55, -0.12], [0.03, 1.47, -0.14]], (t) => 0.014 + t * 0.008, { ...wax, radial: 4 });
  // The candle: thick, leaning, pooled over the hood, glowing where it's thin.
  head.sphere(0.1, { ...wax, at: [0, 1.66, 0.03], squash: [1.05, 0.35, 1.05], segments: 9, rings: 5 });
  head.group({ at: WI.candle, rot: WI.tilt }, (c) => {
    candle(c, [0, 0, 0], { h: CANDLE_H, r: CANDLE_R, tint: "#ead8a8", drips: 7, seed: seed + 5 });
    c.torus(CANDLE_R * 0.8, CANDLE_R * 0.28, { mat: "wax", tint: "#ffd890", emit: 0.9, uvm: 0.2, at: [0, CANDLE_H * 0.97, 0], rot: [Math.PI / 2, 0, 0], radial: 4, tubular: 8 });
  });
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU + 1;
    const x = Math.sin(a) * 0.1;
    const z = Math.cos(a) * 0.1 + 0.03;
    head.tube([[x * 0.8, 1.66, z], [x * 1.25, 1.58, z * 1.2], [x * 1.3, 1.46 - R() * 0.1, z * 1.3]], (t) => 0.016 - t * 0.009, { ...wax, radial: 4, segments: 5 });
  }
  // A mourning veil falling down the back.
  head.cone(0.2, 0.34, { ...robeDark, at: [0, 1.4, 0.1], rot: [0.25, 0, 0], segments: 7, flat: true });
  const fl = r.joint("flame", "head", WICK);
  flame(fl, WICK, 0.17, 0.045, 4.5);

  // Arms in bell sleeves; hands pressed together at the breast in vigil.
  for (const [side, sh, el, wr] of [
    ["R", WI.shR, WI.elR, WI.wrR],
    ["L", WI.shL, WI.elL, WI.wrL],
  ] as const) {
    const sx = side === "R" ? 1 : -1;
    const a = r.joint(`arm${side}`, "body", sh);
    a.sphere(0.065, { ...robeDark, at: [sh[0], sh[1] + 0.01, sh[2]], segments: 7, rings: 5 });
    a.tube([sh, [(sh[0] + el[0]) / 2 + 0.01 * sx, (sh[1] + el[1]) / 2, (sh[2] + el[2]) / 2], el], (t) => 0.05 + t * 0.012, { ...robe, radial: 6, segments: 4 });
    const f = r.joint(`fore${side}`, `arm${side}`, el);
    const cuff: T3 = [wr[0] + 0.05 * sx, wr[1] - 0.03, wr[2] + 0.07];
    f.sphere(0.06, { ...robe, at: el, segments: 6, rings: 4 });
    f.tube([el, [(el[0] + cuff[0]) / 2, (el[1] + cuff[1]) / 2 - 0.02, (el[2] + cuff[2]) / 2], cuff], (t) => 0.055 + t * 0.045, { ...robe, radial: 7, segments: 5 });
    // The sleeve's hanging bell, ragged at the edge.
    f.cone(0.085, 0.26, { ...robe, tint: "#3e3834", at: [cuff[0] + 0.01 * sx, cuff[1] - 0.12, cuff[2] + 0.04], rot: [Math.PI - 0.25, 0, 0.1 * sx], segments: 5, flat: true });
    f.torus(0.095, 0.014, { ...robeDark, at: cuff, rot: [0.9, sx * 0.5, 0], radial: 3, tubular: 10 });
    const h = r.joint(`hand${side}`, `fore${side}`, wr);
    h.group({ scale: [sx, 1, 1] }, (m) =>
      hand(m, { at: [Math.abs(wr[0]) + 0.02, wr[1] - 0.02, wr[2] + 0.02], rot: [Math.PI - 0.35, 0, 0.12], s: 1.3, mat: "flesh.pale", tint: "#c4bcae", curl: 0.12, spread: 0.02, gaunt: true, uvm: 0.3 }),
    );
  }
}

function animateWight(rig: Rig, s: AnimInput, g: Gait): void {
  const n = rig.nodes;
  const [root, body, head, fl] = ["root", "body", "head", "flame"].map((k) => node(n, k));
  const [armR, foreR, handR, armL, foreL] = ["armR", "foreR", "handR", "armL", "foreL"].map((k) => node(n, k));
  const [ftL, ftR] = ["footL", "footR"].map((k) => node(n, k));
  g.update(s, 0.95);
  const t = s.time;
  const w = g.amt;

  // Vigil: a slow bowed sway; walking is a shuffling glide.
  turn(body, -0.08 - 0.06 * w + Math.sin(t * 0.8) * 0.02, g.sin(0.1) * 0.08 * w, Math.sin(t * 0.6) * 0.03 + g.sin(0.25) * 0.05 * w);
  body.position.y += Math.sin(t * 1.6) * 0.006 - Math.abs(g.sin(0.25)) * 0.02 * w;
  turn(head, 0.18 + Math.sin(t * 0.7) * 0.05 + g.sin(0.4) * 0.04 * w, wobble(t * 0.3, 4) * 0.2, Math.sin(t * 0.5) * 0.06);
  turn(ftL, g.sin(0) * 0.35 * w);
  turn(ftR, g.sin(0.5) * 0.35 * w);
  ftL.position.y += Math.max(0, g.cos(0)) * 0.03 * w;
  ftR.position.y += Math.max(0, g.cos(0.5)) * 0.03 * w;
  // Candle flame: flickers, leans back with speed.
  let flameScale = 1 + Math.sin(t * 13) * 0.08 + Math.sin(t * 29) * 0.05;
  turn(fl, Math.min(0.7, s.speed * 0.18) + Math.sin(t * 7) * 0.05, 0, Math.sin(t * 5.3) * 0.08);

  if (s.anim === Anim.Flee || (s.anim === Anim.Run && w > 0.5)) {
    // Hunched, both hands cupped around the flame.
    turn(body, -0.25);
    turn(head, 0.3);
    turn(armR, 2.0, 0, -0.2);
    turn(foreR, 0.9, 0, 0.3);
    turn(armL, 2.0, 0, 0.2);
    turn(foreL, 0.9, 0, -0.3);
  }
  if (s.anim === Anim.Cast || s.anim === Anim.Windup || s.anim === Anim.Strike || s.anim === Anim.Recover) {
    // Flick: pinch the flame, let it swell, snap the fire outward.
    const tm = timing(WIGHT_T, 0);
    const p = s.anim === Anim.Cast ? castPose(s.animTime) : attackPose(s, tm.windup, tm.recover);
    const coil = Math.max(0, -p);
    const hit = Math.max(0, p);
    turn(armR, 2.1 * coil + 1.4 * hit, 0, 0.3 * coil - 0.1 * hit);
    turn(foreR, 1.3 * coil - 0.6 * hit, 0, -0.3 * coil);
    turn(handR, 0.4 * coil - 0.8 * hit);
    turn(armL, -0.2 * coil, 0, -0.15 * coil);
    turn(body, 0.08 * coil - 0.15 * hit, -0.25 * coil + 0.2 * hit);
    turn(head, -0.2 * coil + 0.15 * hit, 0, 0.15 * coil);
    flameScale *= 1 + coil * 1.1 - hit * 0.5 + windupShake(s, tm.windup) * 0.15;
  }
  if (s.anim === Anim.Feed) {
    // Tending: head bowed low over cupped hands.
    turn(body, -0.3);
    turn(head, 0.4);
  }
  const f = flinch(s) + staggerAmt(s) * 0.8;
  if (f) {
    turn(body, f * 0.3, 0, -f * 0.15);
    turn(head, -f * 0.4, 0, f * 0.2);
    turn(armR, f * 0.6);
    turn(armL, f * 0.6);
    flameScale *= 1 - f * 0.4;
  }
  const d = deathT(s, 0.6);
  if (d > 0) {
    // Sinks to its knees, topples; the candle gutters out.
    const sink = span(d, 0, 0.5);
    const fall = span(d, 0.35, 1);
    body.position.y -= 0.45 * sink;
    turn(body, -0.4 * sink);
    turn(head, 0.3 * sink);
    ftL.visible = ftR.visible = d < 0.4;
    root.position.y += 0.18 * fall;
    root.position.z -= 0.3 * fall;
    turn(root, -1.5 * easeOut(fall), 0, 0.2 * fall);
    turn(armR, 1.0 * fall, 0, 0.5 * fall);
    turn(armL, 0.6 * fall, 0, -0.6 * fall);
    flameScale *= Math.max(0, 1 - s.animTime / 0.9);
  } else ftL.visible = ftR.visible = true;
  fl.scale.set(1 / Math.sqrt(Math.max(0.05, flameScale)), flameScale, 1 / Math.sqrt(Math.max(0.05, flameScale)));
  fl.visible = flameScale > 0.02;
  if (s.anim === Anim.Sleep || s.flags & Flag.Asleep) {
    turn(head, 0.35);
    fl.scale.setScalar(0.5);
  }
}

/** Cast (no windup data): quick pinch-and-flick over ~0.4 s. */
function castPose(at: number): number {
  if (at < 0.15) return -easeOut(at / 0.15);
  if (at < 0.25) return lerp(-1, 1, smooth((at - 0.15) / 0.1));
  return 1 - clamp01((at - 0.25) / 0.3);
}

registerModel("wight", (opts: ModelOptions) => {
  const g = new Gait();
  return rigModel(
    (r) => buildWight(r, opts.seed ?? 5),
    (rig, s) => animateWight(rig, s, g),
    opts,
    (rig) => ({ light: node(rig.nodes, "flame"), head: node(rig.nodes, "head") }),
  );
});
