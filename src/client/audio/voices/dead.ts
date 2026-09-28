/** The dead and the half-there: skeletal clatter, wights' whispers, frozen
 * pilgrims, mirror things (reversed whispers) and dream things (reverse
 * swells). Mirror and dream kinds are pre-rendered forward and reversed; the
 * live fallback (used until the render lands) fakes the swell-and-cut shape. */

import { breathe, crackle, modal, MODES, noise, pluck, tone, vocal, type Syn, type Vowel } from "../synth";
import { rand } from "../util";
import { clatter, modeNote, shards, thump, whisper, whoosh } from "../cues/recipes";
import { voiceSet, type VoiceSet } from "./kit";

// ── Bones ────────────────────────────────────────────────────────────────────

function moan(s: Syn, at: number, d: number, f0: readonly (readonly [number, number])[], g: number, v0: Vowel, v1: Vowel): number {
  return vocal(s, { at, f0, vowel: [[0, v0], [d, v1]], src: "triangle", breath: 0.6, shift: 0.9, bw: 1.5, jitter: 20, lp: 1500, d, a: d * 0.3, r: d * 0.4, gain: g }) + at;
}

const bones = voiceSet("bones", {
  idle: (s) => {
    clatter(s, { n: 3, span: 0.3, gain: 0.15 });
    return moan(s, 0.2, 1.2, [[0, 105], [1.2, 95]], 0.14, "oo", "o");
  },
  alert: (s) => {
    clatter(s, { n: 6, span: 0.3, gain: 0.2 });
    return moan(s, 0.1, 0.9, [[0, 90], [0.9, 140]], 0.22, "oo", "a");
  },
  attack: (s) => {
    pluck(s, { f: 1200, mat: "bone", gain: 0.35 });
    pluck(s, { at: 0.08, f: 1100, mat: "bone", gain: 0.35 });
    breathe(s, { at: 0.05, vowel: "i", d: 0.3, a: 0.03, gain: 0.2, hp: 2000 });
    whoosh(s, { at: 0.1, d: 0.25, f0: 500, f1: 2000, gain: 0.2 });
    return 0.4;
  },
  hurt: (s) => {
    clatter(s, { n: 8, span: 0.2, gain: 0.25, skew: 1 });
    pluck(s, { f: 1600, mat: "bone", gain: 0.35 });
    return moan(s, 0.02, 0.3, [[0, 130], [0.3, 100]], 0.16, "uh", "oo");
  },
  death: (s) => {
    clatter(s, { n: 22, span: 1.3, skew: 1.7, fLo: 300, fHi: 900, gain: 0.3 });
    for (let i = 0; i < 3; i++) thump(s, { at: rand(0.05, 0.8), f: rand(120, 180), f1: 70, d: 0.1, gain: 0.2 });
    moan(s, 0, 1.6, [[0, 120], [1.6, 60]], 0.18, "a", "u");
    return 1.7;
  },
});

// ── Wight ────────────────────────────────────────────────────────────────────

const wight = voiceSet("wight", {
  idle: (s) => whisper(s, { d: 1.2, gain: 0.3, shift: 0.9, syllables: 3 }),
  alert: (s) => {
    breathe(s, { vowel: [[0, "i"], [0.3, "a"]], env: [[0, 0], [0.3, 1], [0.35, 0]], d: 0.36, gain: 0.32, hp: 500 });
    return whisper(s, { at: 0.4, d: 0.5, gain: 0.26, syllables: 2 });
  },
  attack: (s) => {
    vocal(s, { f0: [[0, 400], [0.2, 700], [0.6, 500]], vowel: [[0, "a"], [0.4, "i"]], breath: 0.8, d: 0.7, gain: 0.3, jitter: 80, shift: 1.1 });
    noise(s, { a: 0.05, d: 0.6, hp: 3000, gain: 0.12 });
    return 0.75;
  },
  hurt: (s) => {
    breathe(s, { vowel: "a", a: 0.02, d: 0.25, gain: 0.3 });
    vocal(s, { f0: 300, vowel: "uh", breath: 0.7, d: 0.2, gain: 0.15 });
    return 0.3;
  },
  death: (s) => {
    breathe(s, { vowel: [[0, "a"], [1.8, "u"]], env: [[0, 0], [0.1, 1], [1.8, 0]], d: 2, gain: 0.3, hp: 300 });
    tone(s, { at: 0.3, f: 800, f1: 1600, a: 1.4, d: 0.3, gain: 0.03 });
    whisper(s, { at: 0.8, d: 1, gain: 0.12, syllables: 3 });
    return 2.05;
  },
}, { reverb: 0.45 });

// ── Frost (frozen pilgrims) ──────────────────────────────────────────────────

function sigh(s: Syn, at: number, d: number, g: number, v0: Vowel, v1: Vowel): number {
  return breathe(s, { at, vowel: [[0, v0], [d, v1]], d, env: [[0, 0], [d * 0.4, 1], [d, 0]], gain: g, hp: 1200, shift: 1.2 }) + at;
}

const frost = voiceSet("frost", {
  idle: (s) => {
    crackle(s, { d: 0.9, density: 150, hp: 3000, gain: 0.2 });
    return sigh(s, 0.3, 1.2, 0.2, "a", "u");
  },
  alert: (s) => {
    crackle(s, { d: 0.3, density: 900, hp: 2500, gain: 0.3 });
    return sigh(s, 0.1, 0.6, 0.26, "u", "i");
  },
  attack: (s) => {
    noise(s, { d: 0.03, hp: 2000, gain: 0.45 });
    shards(s, { n: 6, span: 0.2, fLo: 2500, fHi: 6000, modes: MODES.ice, d: 0.25, gain: 0.08 });
    return sigh(s, 0.02, 0.5, 0.3, "a", "i");
  },
  hurt: (s) => {
    noise(s, { d: 0.025, hp: 2500, gain: 0.4 });
    shards(s, { n: 4, span: 0.15, fLo: 2500, fHi: 5500, modes: MODES.ice, d: 0.2, gain: 0.07 });
    breathe(s, { vowel: "a", a: 0.015, d: 0.2, gain: 0.22, hp: 900 });
    return 0.35;
  },
  death: (s) => {
    noise(s, { d: 0.04, hp: 1500, gain: 0.45 });
    shards(s, { n: 16, span: 0.8, fLo: 1800, fHi: 7000, modes: MODES.ice, d: 0.35, gain: 0.07 });
    crackle(s, { d: 1.5, density: 300, hp: 2500, gain: 0.2 });
    return sigh(s, 0.2, 2, 0.25, "a", "u");
  },
}, { reverb: 0.4 });

// ── Mirror (reversed whispers) ───────────────────────────────────────────────

/** Forward render: whisper + glass ring + breathy tail — reversed, the tail
 * becomes an in-breath and the whisper runs backwards. */
const mirrorFwd = (len: number, glass: number) => (s: Syn): number => {
  whisper(s, { d: len, gain: 0.34, shift: 1.1 });
  modal(s, { f: rand(1500, 2500), modes: MODES.glass, d: 1.2 + glass, gain: 0.08 + 0.05 * glass, strike: 0.2 });
  if (glass > 0.5) shards(s, { n: Math.round(8 * glass), span: 0.3, fLo: 2500, fHi: 8000, modes: MODES.glass, d: 0.4, gain: 0.06 });
  breathe(s, { at: len * 0.8, vowel: [[0, "a"], [0.8, "u"]], d: 0.9, env: [[0, 1], [0.9, 0]], gain: 0.16, hp: 400 });
  return len + 1.3 + glass;
};
/** Live stand-in: a breath that swells and cuts off. */
const mirrorLive = (len: number, glass: number) => (s: Syn): number => {
  breathe(s, { vowel: [[0, "u"], [len, "a"]], d: len, env: [[0, 0], [len * 0.85, 1], [len, 0]], gain: 0.3, hp: 400 });
  tone(s, { f: rand(1800, 2400), a: len * 0.9, d: 0.03, gain: 0.04 + 0.04 * glass });
  return len;
};

const mirror = voiceSet("mirror", {
  idle: mirrorLive(1.2, 0),
  alert: mirrorLive(0.8, 0.3),
  attack: mirrorLive(0.6, 1),
  hurt: mirrorLive(0.4, 0.6),
  death: mirrorLive(1.8, 1.5),
}, {
  reverb: 0.5,
  reversed: {
    idle: [3, 4, mirrorFwd(1.2, 0)],
    alert: [3, 4, mirrorFwd(0.8, 0.3)],
    attack: [3, 4, mirrorFwd(0.6, 1)],
    hurt: [3, 4, mirrorFwd(0.4, 0.6)],
    death: [2, 6, mirrorFwd(1.8, 1.5)],
  },
});

// ── Dream (reverse swells) ───────────────────────────────────────────────────

const dreamFwd = (root: number, degs: readonly number[], d: number, grit: number) => (s: Syn): number => {
  degs.forEach((deg, i) => modal(s, { at: i * 0.012, f: modeNote(root, deg), modes: MODES.tine, d, gain: 0.14, strike: 0.1 + grit * 0.4 }));
  noise(s, { color: "pink", d: d * 0.6, lp: 1200, gain: 0.04 + 0.08 * grit });
  if (grit > 0.5) tone(s, { f: 80, f1: 40, d: d * 0.5, gain: 0.25 });
  return d + 0.1;
};
const dreamLive = (root: number, degs: readonly number[], d: number, grit: number) => (s: Syn): number => {
  degs.forEach((deg) => tone(s, { f: modeNote(root, deg), a: d * 0.92, d: 0.04, gain: 0.08, linDecay: true }));
  noise(s, { color: "pink", a: d * 0.9, d: 0.05, lp: 1500, gain: 0.03 + 0.08 * grit });
  if (grit > 0.5) thump(s, { at: d - 0.02, f: 80, f1: 40, d: 0.2, gain: 0.25 });
  return d + 0.1;
};

const DREAM: Record<string, [number, readonly number[], number, number]> = {
  idle: [262, [0, 4], 1.4, 0],
  alert: [330, [0, 2, 6], 0.9, 0.2],
  attack: [294, [0, 1, 4], 0.7, 1],
  hurt: [311, [0, 1], 0.45, 0.6],
  death: [196, [0, 3, 5, 7], 2.6, 0.4],
};
const dreamArgs = (k: keyof typeof DREAM) => DREAM[k] as [number, readonly number[], number, number];

const dream = voiceSet("dream", {
  idle: dreamLive(...dreamArgs("idle")),
  alert: dreamLive(...dreamArgs("alert")),
  attack: dreamLive(...dreamArgs("attack")),
  hurt: dreamLive(...dreamArgs("hurt")),
  death: dreamLive(...dreamArgs("death")),
}, {
  reverb: 0.55,
  reversed: {
    idle: [3, 3, dreamFwd(...dreamArgs("idle"))],
    alert: [3, 3, dreamFwd(...dreamArgs("alert"))],
    attack: [3, 3, dreamFwd(...dreamArgs("attack"))],
    hurt: [3, 3, dreamFwd(...dreamArgs("hurt"))],
    death: [2, 5, dreamFwd(...dreamArgs("death"))],
  },
});

export const DEAD_VOICES: Record<string, VoiceSet> = { bones, wight, frost, mirror, dream };
