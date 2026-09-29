import { Quaternion, Vector3, type Object3D } from "three";
import { Anim } from "../../../shared/sim/entity";
import type { MeshBuilder, RGB, Surf, T3 } from "./kit";
import type { AnimInput } from "./registry";

/** Shared building blocks for the model families: reusable parts (flames,
 * candles, bones, skulls, chains, hands) and the small maths vocabulary the
 * procedural animations are written in. Everything here is authored in the
 * builder's current transform, facing −Z like the models themselves. */

// ── maths ────────────────────────────────────────────────────────────────────

export const TAU = Math.PI * 2;
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** 0..1 progress of `t` through [a, b]. */
export const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
export const smooth = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};
export const easeOut = (t: number) => 1 - (1 - clamp01(t)) ** 3;
export const easeIn = (t: number) => clamp01(t) ** 2;
/** Overshooting ease (snappy strikes). */
export const easeBack = (t: number) => {
  const x = clamp01(t) - 1;
  return 1 + 2.2 * x * x * x + 1.2 * x * x;
};

/** Deterministic PRNG (mulberry32) for per-instance variation. */
export function rand(seed: number): () => number {
  let a = seed >>> 0 || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cheap smooth noise in [-1, 1] from a few incommensurate sines. */
export const wobble = (t: number, seed = 0) =>
  (Math.sin(t * 1.7 + seed) * 0.5 + Math.sin(t * 2.9 + seed * 1.3) * 0.3 + Math.sin(t * 5.3 + seed * 2.1) * 0.2);

// ── animation vocabulary ─────────────────────────────────────────────────────

/** Strike phase length (sim: creatures.ts updateAttack). */
export const STRIKE_TIME = 0.12;

/** One scalar for a whole attack: 0 → −1 across the windup (the
 * telegraph: pull back and hold), −1 → +1 in the strike snap, +1 → 0 over
 * the recovery. Poses read it as "coiled" when negative, "extended" when
 * positive. Other anims return 0. */
export function attackPose(s: AnimInput, windup: number, recover: number): number {
  if (s.anim === Anim.Windup) {
    const k = s.animTime / Math.max(0.05, windup);
    // Most of the pull happens early, then a trembling hold.
    return -(easeOut(k * 1.25) * 0.9 + span(k, 0.6, 1) * 0.1);
  }
  if (s.anim === Anim.Strike) return lerp(-1, 1, easeBack(s.animTime / STRIKE_TIME));
  if (s.anim === Anim.Recover) return 1 - smooth(s.animTime / Math.max(0.05, recover));
  return 0;
}

/** Windup tremble: a fast shiver that grows toward the release. */
export function windupShake(s: AnimInput, windup: number): number {
  if (s.anim !== Anim.Windup) return 0;
  const k = span(s.animTime / Math.max(0.05, windup), 0.4, 1);
  return Math.sin(s.time * 55) * k;
}

/** Hurt flinch: 1 at the hit, decaying over ~0.35 s. */
export function flinch(s: AnimInput): number {
  if (s.anim !== Anim.Hurt) return 0;
  const t = s.animTime;
  return t < 0.06 ? t / 0.06 : Math.max(0, 1 - (t - 0.06) / 0.3) ** 2;
}

/** Stagger: a heavy, wobbling reel. */
export function staggerAmt(s: AnimInput): number {
  if (s.anim !== Anim.Stagger) return 0;
  return easeOut(s.animTime / 0.15) * (0.75 + 0.25 * Math.sin(s.animTime * 9));
}

/** Death collapse progress 0..1 (gravity-like ease-in over `dur`, tiny
 * settle bounce at the end). */
export function deathT(s: AnimInput, dur = 0.45): number {
  if (s.anim !== Anim.Dead) return 0;
  const t = s.animTime / dur;
  if (t < 1) return easeIn(t);
  const b = t - 1;
  return 1 - Math.max(0, Math.sin(b * 9) * 0.05 * Math.exp(-b * 6));
}

export const isDead = (s: AnimInput) => s.anim === Anim.Dead;

/** Accumulates a gait phase from speed so cycles never jump when speed
 * changes. `stride` = metres per full cycle. */
export class Gait {
  phase = 0;
  /** Smoothed 0..1 "how much are we walking". */
  amt = 0;
  private last = -1;
  update(s: AnimInput, stride: number, walkThreshold = 0.15): void {
    const dt = this.last < 0 ? s.dt : Math.min(0.1, Math.max(0, s.time - this.last));
    this.last = s.time;
    const moving = s.speed > walkThreshold && s.anim !== Anim.Dead;
    this.phase += ((dt || s.dt) * s.speed * TAU) / stride;
    const k = 1 - Math.exp(-(dt || s.dt) * 10);
    this.amt += ((moving ? 1 : 0) - this.amt) * k;
  }
  /** sin of the phase with an offset (in cycles). */
  sin(offset = 0): number {
    return Math.sin(this.phase + offset * TAU);
  }
  cos(offset = 0): number {
    return Math.cos(this.phase + offset * TAU);
  }
}

// ── surfaces ─────────────────────────────────────────────────────────────────

/** A flat, self-lit colour (eyes, sparks, coals): a pale material tinted
 * and pushed to glow. */
export function glow(color: string | RGB, emit = 4): Surf {
  return { mat: "wax", tint: color, emit, uvm: 8 };
}

/** Near-black recess colour (eye sockets, holes, slots). */
export const VOID: Surf = { mat: "stone.smooth", tint: "#0a0808", uvm: 4 };

// ── parts ────────────────────────────────────────────────────────────────────

/** A teardrop flame standing on `at` (its root): the flame texture mapped
 * root→tip so it burns white at the wick and licks out at the top. */
export function flame(b: MeshBuilder, at: T3, h: number, r: number, emit = 4, tint?: string): MeshBuilder {
  b.lathe(
    [
      [0, 0],
      [r * 0.75, h * 0.12],
      [r, h * 0.32],
      [r * 0.78, h * 0.55],
      [r * 0.36, h * 0.8],
      [0, h],
    ],
    { mat: "flame", at, uv: "native", uvRepeat: [1, -0.42], emit, tint, segments: 6 },
  );
  // A white-hot core so the flame never vanishes through its cut-outs.
  b.sphere(r * 0.5, { ...glow(tint ?? "#ffe7a0", emit + 1), at: [at[0], at[1] + h * 0.28, at[2]], squash: [1, 1.7, 1], segments: 6, rings: 4 });
  return b;
}

export interface CandleOpts {
  h: number;
  r: number;
  tint?: string;
  /** Number of wax runs down the side. */
  drips?: number;
  seed?: number;
  /** Include the wick (default true). */
  wick?: boolean;
}

/** A tallow candle standing on `at` with an uneven melted crown and wax
 * runs down its side. Returns the wick tip (where the flame goes). */
export function candle(b: MeshBuilder, at: T3, o: CandleOpts): T3 {
  const { h, r } = o;
  const R = rand(o.seed ?? 7);
  const tint = o.tint ?? "#efe2c2";
  const wax: Surf = { mat: "wax", tint, uvm: Math.max(0.15, h * 1.2) };
  b.group({ at }, (g) => {
    g.lathe(
      [
        [r * 1.12, 0],
        [r * 1.05, h * 0.06],
        [r, h * 0.2],
        [r * 0.98, h * 0.85],
        [r * 1.04, h * 0.96],
        [r * 0.8, h],
        [r * 0.35, h * 0.965],
        [0.001, h * 0.96],
      ],
      { ...wax, segments: 8 },
    );
    const n = o.drips ?? 3;
    for (let i = 0; i < n; i++) {
      const a = R() * TAU;
      const len = h * (0.25 + R() * 0.5);
      const x = Math.sin(a) * r;
      const z = Math.cos(a) * r;
      g.tube(
        [
          [x * 1.02, h * 0.98, z * 1.02],
          [x * 1.08, h - len * 0.5, z * 1.08],
          [x * 1.06, h - len, z * 1.06],
        ],
        (t) => r * (0.28 - t * 0.1),
        { ...wax, radial: 4, segments: 4 },
      );
      g.sphere(r * 0.2, { ...wax, at: [x * 1.06, h - len, z * 1.06], segments: 5, rings: 3 });
    }
    if (o.wick !== false) g.cylinder(r * 0.09, r * 0.12, r * 0.6, { mat: "rope", tint: "#2a2018", at: [0, h + r * 0.2, 0], segments: 4 });
  });
  return [at[0], at[1] + h + r * 0.45, at[2]];
}

/** A long bone from `a` to `c`: tapered shaft with knobbed ends (paired
 * condyles on the big bones). ~60–110 triangles. */
export function bone(b: MeshBuilder, a: T3, c: T3, r: number, tint?: string, uvm = 0.6): MeshBuilder {
  const s: Surf = { mat: "bone", tint, uvm };
  b.tube([a, [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2], c], (t) => r * (1 - 0.35 * Math.sin(t * Math.PI)), {
    ...s,
    radial: 4,
    segments: 3,
  });
  const dx = c[0] - a[0];
  const dz = c[2] - a[2];
  const len = Math.hypot(dx, c[1] - a[1], dz) || 1;
  const px = (-dz / len) * r * 0.6;
  const pz = (dx / len) * r * 0.6;
  const big = r >= 0.018;
  for (const e of [a, c]) {
    if (big) {
      b.sphere(r * 1.25, { ...s, at: [e[0] + px, e[1], e[2] + pz], segments: 5, rings: 3 });
      b.sphere(r * 1.15, { ...s, at: [e[0] - px, e[1], e[2] - pz], segments: 5, rings: 3 });
    } else b.sphere(r * 1.3, { ...s, at: e, segments: 5, rings: 3 });
  }
  return b;
}

export interface SkullOpts {
  at: T3;
  rot?: T3;
  s?: number;
  tint?: string;
  /** Lower jaw (default true); a number opens it (radians). */
  jaw?: boolean | number;
  /** Glowing eye points instead of empty sockets. */
  eyes?: { color: string; emit: number };
  uvm?: number;
}

/** A human skull, ~0.2 m tall at s = 1, facing −Z. */
export function skull(b: MeshBuilder, o: SkullOpts): MeshBuilder {
  const s = o.s ?? 1;
  const bs: Surf = { mat: "bone", tint: o.tint, uvm: o.uvm ?? 0.35 };
  b.group({ at: o.at, rot: o.rot, scale: s }, (g) => {
    // Cranium: a tall egg, wider at the back.
    g.sphere(0.1, { ...bs, at: [0, 0.035, 0.012], squash: [0.86, 0.92, 1.08], segments: 10, rings: 7 });
    // Brow ridge and face plate.
    g.box([0.15, 0.03, 0.05], { ...bs, at: [0, 0.01, -0.07], bevel: 0.012 });
    g.box([0.13, 0.07, 0.06], { ...bs, at: [0, -0.035, -0.06], bevel: 0.02 });
    // Cheekbones.
    g.mirrorX((m) => m.box([0.03, 0.025, 0.07], { ...bs, at: [0.062, -0.03, -0.045], rot: [0, 0.25, 0.2], bevel: 0.008 }));
    // Sockets / eyes.
    g.mirrorX((m) => {
      if (o.eyes) {
        m.sphere(0.024, { ...VOID, at: [0.035, -0.012, -0.088], squash: [1, 0.9, 0.5], segments: 6, rings: 4 });
        m.sphere(0.007, { ...glow(o.eyes.color, o.eyes.emit), at: [0.035, -0.014, -0.094], segments: 4, rings: 3 });
      } else m.sphere(0.026, { ...VOID, at: [0.035, -0.012, -0.086], squash: [1, 0.9, 0.55], segments: 6, rings: 4 });
    });
    // Nasal cavity.
    g.cone(0.014, 0.03, { ...VOID, at: [0, -0.045, -0.089], rot: [0.2, 0, 0], segments: 3 });
    // Upper teeth.
    g.box([0.075, 0.02, 0.02], { ...bs, tint: o.tint ?? "#e8dcc0", at: [0, -0.075, -0.075], bevel: 0.004 });
    if (o.jaw !== false) {
      const open = typeof o.jaw === "number" ? o.jaw : 0;
      g.group({ at: [0, -0.05, -0.01], rot: [open, 0, 0] }, (j) => {
        j.box([0.1, 0.022, 0.07], { ...bs, at: [0, -0.04, -0.045], bevel: 0.008 });
        j.box([0.07, 0.018, 0.02], { ...bs, tint: o.tint ?? "#e8dcc0", at: [0, -0.028, -0.068], bevel: 0.004 });
        j.mirrorX((m) => m.box([0.018, 0.06, 0.03], { ...bs, at: [0.05, -0.02, -0.005], rot: [0.3, 0, 0], bevel: 0.006 }));
      });
    }
  });
  return b;
}

/** A chain of alternating torus links from `a` to `c`. */
export function chain(b: MeshBuilder, a: T3, c: T3, link = 0.035, mat = "metal.iron", tint?: string): MeshBuilder {
  const dx = c[0] - a[0];
  const dy = c[1] - a[1];
  const dz = c[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  const n = Math.max(1, Math.round(len / (link * 1.5)));
  // Orient the local +Y along the chain.
  const yaw = Math.atan2(dx, dz);
  const pitch = Math.acos(Math.max(-1, Math.min(1, dy / (len || 1))));
  b.group({ at: a, rot: [0, yaw, 0] }, (g) =>
    g.group({ rot: [pitch, 0, 0] }, (h) => {
      for (let i = 0; i < n; i++) {
        h.torus(link * 0.5, link * 0.13, {
          mat,
          tint,
          uvm: 0.3,
          at: [0, (i + 0.5) * (len / n), 0],
          rot: [0, i % 2 ? Math.PI / 2 : 0, 0],
          scale: [1, 1.5, 1],
          radial: 3,
          tubular: 6,
        });
      }
    }),
  );
  return b;
}

/** A row of rivet heads between two points. */
export function rivets(b: MeshBuilder, a: T3, c: T3, n: number, r: number, mat = "metal.iron", tint?: string): MeshBuilder {
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    b.sphere(r, { mat, tint, uvm: 0.2, at: [lerp(a[0], c[0], t), lerp(a[1], c[1], t), lerp(a[2], c[2], t)], segments: 5, rings: 3 });
  }
  return b;
}

export interface HandOpts {
  at: T3;
  rot?: T3;
  s?: number;
  mat?: string;
  tint?: string;
  /** 0 = open, 1 = fist. */
  curl?: number;
  /** Finger splay (radians). */
  spread?: number;
  /** Knobbly, long-fingered (undead) hands. */
  gaunt?: boolean;
  thumb?: number;
  uvm?: number;
  /** Rounded capsule fingers (close-ups); default is cheap cylinders. */
  hi?: boolean;
}

/** One finger segment hanging from the current origin, `len` long. */
function phalanx(b: MeshBuilder, r: number, len: number, sf: Surf, hi: boolean): void {
  if (hi) b.capsule(r, Math.max(0.001, len - 2 * r), { ...sf, at: [0, -len / 2, 0], segments: 5 });
  else {
    b.cylinder(r * 0.9, r, len, { ...sf, at: [0, -len / 2, 0], segments: 4 });
    b.sphere(r * 0.9, { ...sf, at: [0, -len, 0], segments: 4, rings: 2 });
  }
}

/** A hand hanging from the wrist at `at`: fingers point −Y, palm faces −X
 * (the right hand's inside); mirror for the left. ~0.19 m long at s = 1. */
export function hand(b: MeshBuilder, o: HandOpts): MeshBuilder {
  const sf: Surf = { mat: o.mat ?? "skin.wizard", tint: o.tint, uvm: o.uvm ?? 0.4 };
  const curl = o.curl ?? 0.3;
  const spread = o.spread ?? 0.08;
  const long = o.gaunt ? 1.3 : 1;
  const th = o.gaunt ? 0.7 : 1;
  const hi = o.hi ?? false;
  b.group({ at: o.at, rot: o.rot, scale: o.s ?? 1 }, (g) => {
    // Palm: thicker at the heel, tapering to the knuckles.
    g.box([0.028 * th + 0.004, 0.085, 0.078], { ...sf, at: [0, -0.045, 0], bevel: 0.012 });
    g.sphere(0.02, { ...sf, at: [-0.004, -0.02, 0.02], squash: [0.9, 1.2, 1], segments: 6, rings: 4 });
    const lens = [0.045, 0.052, 0.049, 0.038];
    for (let i = 0; i < 4; i++) {
      const z = -0.028 + i * 0.019;
      const L = lens[i] * long;
      g.group({ at: [0, -0.088, z], rot: [(i - 1.5) * spread, 0, curl * 1.3] }, (f) => {
        phalanx(f, 0.0085 * th + 0.001, L * 0.6, sf, hi);
        if (o.gaunt) f.sphere(0.011, { ...sf, at: [0, -L * 0.02, 0], segments: 4, rings: 3 });
        f.group({ at: [0, -L * 0.6, 0], rot: [0, 0, curl * 1.5] }, (t) => {
          phalanx(t, 0.0075 * th + 0.001, L * 0.5, sf, hi);
          if (o.gaunt) t.cone(0.006, 0.02, { mat: "bone", tint: "#6a5a40", at: [0, -L * 0.55, 0], rot: [Math.PI, 0, 0], segments: 3 });
        });
      });
    }
    // Thumb from the heel, across the palm.
    const tc = o.thumb ?? curl;
    g.group({ at: [-0.012, -0.03, -0.035], rot: [-0.7 + tc * 0.3, 0, 0.5 + tc * 0.9] }, (t) => {
      phalanx(t, 0.011 * th + 0.001, 0.045 * long, sf, hi);
      t.group({ at: [0, -0.045 * long, 0], rot: [0, 0, tc * 0.8] }, (u) => phalanx(u, 0.009 * th + 0.001, 0.035 * long, sf, hi));
    });
  });
  return b;
}

/** Hanging cloth panel (a curtain of robe) between two widths with gentle
 * folds: a strip of quads, double-sided. */
export function drape(
  b: MeshBuilder,
  o: { y0: number; y1: number; wTop: number; wBot: number; z: number; folds?: number; depth?: number; surf: Surf },
): MeshBuilder {
  const n = 8;
  const folds = o.folds ?? 3;
  const dep = o.depth ?? 0.03;
  for (let i = 0; i < n; i++) {
    const u0 = i / n - 0.5;
    const u1 = (i + 1) / n - 0.5;
    const f0 = Math.sin((i / n) * folds * TAU) * dep;
    const f1 = Math.sin(((i + 1) / n) * folds * TAU) * dep;
    const c: [T3, T3, T3, T3] = [
      [u0 * o.wBot, o.y0, o.z + f0 * 1.5],
      [u1 * o.wBot, o.y0, o.z + f1 * 1.5],
      [u1 * o.wTop, o.y1, o.z + f1 * 0.5],
      [u0 * o.wTop, o.y1, o.z + f0 * 0.5],
    ];
    b.quad(c, { ...o.surf, uv: "box" });
    b.quad([c[1], c[0], c[3], c[2]], { ...o.surf, uv: "box" });
  }
  return b;
}

/** Look up a socket-able node; throws early if a rig name is misspelt. */
export function node(nodes: Map<string, Object3D>, name: string): Object3D {
  const n = nodes.get(name);
  if (!n) throw new Error(`rig node ${name} missing`);
  return n;
}

// ── inverse kinematics ───────────────────────────────────────────────────────

const _d = new Vector3();
const _n = new Vector3();
const _u = new Vector3();
const _e = new Vector3();
const _f = new Vector3();
const _q = new Quaternion();
const _qi = new Quaternion();

/** A two-bone limb for `ik2`: rest directions/lengths from its pivots. */
export interface Limb {
  upper: Object3D;
  lower: Object3D;
  a: number;
  b: number;
  restA: Vector3;
  restB: Vector3;
}

export function limb(nodes: Map<string, Object3D>, upper: string, lower: string, shoulder: T3, elbow: T3, wrist: T3): Limb {
  const A = new Vector3(elbow[0] - shoulder[0], elbow[1] - shoulder[1], elbow[2] - shoulder[2]);
  const B = new Vector3(wrist[0] - elbow[0], wrist[1] - elbow[1], wrist[2] - elbow[2]);
  return { upper: node(nodes, upper), lower: node(nodes, lower), a: A.length(), b: B.length(), restA: A.normalize(), restB: B.normalize() };
}

/** Two-bone IK: rotates the limb so the wrist reaches `target` (given in
 * the upper bone's PARENT space); the elbow bends toward `pole`. Overrides
 * the two joints' rotations (rest rotations are identity in a rig). */
export function ik2(l: Limb, target: Vector3, pole: Vector3): void {
  const S = l.upper.position;
  _d.subVectors(target, S);
  const dist = Math.min(Math.max(_d.length(), Math.abs(l.a - l.b) + 1e-3), l.a + l.b - 1e-3);
  _d.normalize();
  const cosA = (l.a * l.a + dist * dist - l.b * l.b) / (2 * l.a * dist);
  const A = Math.acos(Math.max(-1, Math.min(1, cosA)));
  _n.crossVectors(_d, pole);
  if (_n.lengthSq() < 1e-8) _n.set(1, 0, 0);
  _n.normalize();
  _u.copy(_d).applyAxisAngle(_n, A);
  l.upper.quaternion.setFromUnitVectors(l.restA, _u);
  _e.copy(S).addScaledVector(_u, l.a);
  _f.subVectors(target, _e).normalize();
  _qi.copy(l.upper.quaternion).invert();
  _f.applyQuaternion(_qi);
  l.lower.quaternion.setFromUnitVectors(l.restB, _f);
}

/** Point a node's local −Y along `dir` (parent space) with a roll about it. */
export function aimDown(n: Object3D, dir: Vector3, roll = 0): void {
  _f.copy(dir).normalize();
  n.quaternion.setFromUnitVectors(_u.set(0, -1, 0), _f);
  if (roll) n.quaternion.multiply(_q.setFromAxisAngle(_u.set(0, 1, 0), roll));
}
