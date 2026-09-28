/** Made and grown things: foundry automata, Orrery clockworks, drowned-archive
 * paper, the Mycelial Choir (which really sings — slow close-harmony vowel
 * chords in the Godwell mode) and the giants' rumble used by wardens. */

import { crackle, fm, modal, MODES, noise, pluck, tone, vocal, breathe, type Syn, type Vowel } from "../synth";
import { rand } from "../util";
import { modeNote, pebbles, thump } from "../cues/recipes";
import { voiceSet, type VoiceSet } from "./kit";

// ── Automaton ────────────────────────────────────────────────────────────────

function servo(s: Syn, at: number, f0: number, f1: number, d: number, g: number): number {
  tone(s, { at, type: "sawtooth", f: f0, f1, sweep: d, a: 0.02, h: Math.max(0, d - 0.07), d: 0.05, bp: 900, q: 2, gain: g });
  tone(s, { at, type: "square", f: f0 * 2, f1: f1 * 2, sweep: d, a: 0.02, h: Math.max(0, d - 0.07), d: 0.05, lp: 1500, gain: g * 0.25 });
  noise(s, { at, color: "pink", a: 0.02, h: Math.max(0, d - 0.07), d: 0.05, bp: 1500, q: 2, gain: g * 0.4 });
  return at + d;
}
function clank(s: Syn, at: number, g: number): number {
  modal(s, { at, f: rand(180, 300), modes: MODES.metal, d: 0.4, strike: 0.6, gain: g });
  thump(s, { at, f: 120, f1: 60, d: 0.08, gain: g });
  return at + 0.45;
}
const tickClick = (s: Syn, at: number, g = 0.25) => noise(s, { at, d: 0.005, bp: 3500, q: 5, gain: g });

const automaton = voiceSet("automaton", {
  idle: (s) => {
    tickClick(s, 0);
    tickClick(s, 0.12);
    return servo(s, 0.25, 300, 360, 0.25, 0.12) + 0.05;
  },
  alert: (s) => {
    servo(s, 0, 200, 600, 0.35, 0.2);
    clank(s, 0.4, 0.25);
    return clank(s, 0.6, 0.2);
  },
  attack: (s) => {
    servo(s, 0, 400, 800, 0.15, 0.22);
    clank(s, 0.15, 0.35);
    noise(s, { at: 0.2, a: 0.02, d: 0.4, hp: 2000, gain: 0.2 });
    return 0.65;
  },
  hurt: (s) => {
    modal(s, { f: 420, modes: MODES.metal, d: 0.8, strike: 0.8, gain: 0.3 });
    crackle(s, { d: 0.25, density: 800, hp: 3000, gain: 0.3 });
    for (let i = 0; i < 3; i++) servo(s, 0.1 + i * 0.08, 500, 450, 0.05, 0.12);
    return 0.9;
  },
  death: (s) => {
    servo(s, 0, 500, 60, 1.5, 0.22);
    for (let i = 0; i < 8; i++) clank(s, 0.8 + rand(0, 0.8), 0.14);
    noise(s, { at: 1.4, a: 0.1, d: 0.8, hp: 1500, gain: 0.15 });
    return 2.3;
  },
}, { reverb: 0.35 });

// ── Clockwork (the Orrery) ───────────────────────────────────────────────────

function tick(s: Syn, at: number, hi: boolean, g = 0.25): void {
  noise(s, { at, d: 0.004, bp: hi ? 4200 : 2800, q: 6, gain: g });
  modal(s, { at, f: hi ? 3300 : 2500, modes: [[1, 1, 1], [2.3, 0.5, 0.5]], d: 0.03, gain: g * 0.5 });
}
const chime = (s: Syn, at: number, f: number, d = 0.8, g = 0.15): number => modal(s, { at, f, modes: MODES.chime, d, gain: g, strike: 0.2 });

const clock = voiceSet("clock", {
  idle: (s) => {
    tick(s, 0, true);
    tick(s, 0.5, false);
    return 0.6;
  },
  alert: (s) => {
    for (let i = 0; i < 8; i++) tick(s, i * 0.06, i % 2 === 0);
    return chime(s, 0.5, 1320);
  },
  attack: (s) => {
    pluck(s, { f: 90, mat: "string", decay: 0.6, gain: 0.3 });
    fm(s, { f: 180, ratio: 1.41, index: 3, index1: 0, d: 0.5, gain: 0.12 });
    chime(s, 0.05, 1200);
    return chime(s, 0.05, 1270);
  },
  hurt: (s) => {
    for (let i = 0; i < 12; i++) tick(s, rand(0, 0.25), Math.random() < 0.5, 0.2);
    chime(s, 0.1, 990 * 1.03, 0.5);
    return chime(s, 0.1, 990, 0.5);
  },
  death: (s) => {
    let t = 0;
    let iv = 0.05;
    for (let i = 0; i < 10; i++) {
      tick(s, t, i % 2 === 0);
      t += iv;
      iv *= 1.35;
    }
    pluck(s, { at: t, f: 60, mat: "string", decay: 1.2, gain: 0.3 });
    chime(s, t, 660, 2, 0.12);
    tone(s, { at: t, f: 660, f1: 590, a: 0.01, d: 2, gain: 0.06 });
    return t + 2.2;
  },
}, { reverb: 0.4 });

// ── Paper (drowned-archive things) ───────────────────────────────────────────

function rustle(s: Syn, at: number, d: number, g: number): number {
  crackle(s, { at, d, density: 800, bp: 3000, q: 0.7, gain: g, a: 0.02 });
  noise(s, { at, color: "pink", a: d * 0.3, d: d * 0.7, bp: 4000, q: 1, gain: g * 0.3 });
  return at + d;
}
function shriek(s: Syn, at: number, d: number, f0: number, g: number): number {
  return vocal(s, { at, f0: [[0, f0], [d * 0.4, f0 * 1.5], [d, f0 * 1.2]], vowel: [[0, "e"], [d * 0.4, "i"]], shift: 1.8, breath: 0.7, hp: 1200, d, gain: g, jitter: 50 }) + at;
}

const paper = voiceSet("paper", {
  idle: (s) => rustle(s, 0, 0.6, 0.22),
  alert: (s) => {
    rustle(s, 0, 0.3, 0.3);
    return shriek(s, 0.2, 0.35, 900, 0.22);
  },
  attack: (s) => {
    noise(s, { d: 0.25, bp: 2500, q: 0.8, gain: 0.3 });
    crackle(s, { d: 0.25, density: 2500, hp: 1500, gain: 0.4 });
    return shriek(s, 0.1, 0.5, 1000, 0.3);
  },
  hurt: (s) => {
    crackle(s, { d: 0.3, density: 1500, bp: 2000, gain: 0.35 });
    return shriek(s, 0.05, 0.2, 1200, 0.2);
  },
  death: (s) => {
    rustle(s, 0, 1, 0.3);
    crackle(s, { at: 0.3, d: 0.25, density: 2500, hp: 1500, gain: 0.35 });
    breathe(s, { at: 0.6, vowel: [[0, "a"], [1, "u"]], d: 1, a: 0.2, gain: 0.12, hp: 500 });
    crackle(s, { at: 1, d: 0.6, density: 400, lp: 2000, gain: 0.2 });
    return 1.65;
  },
});

// ── Fungal (the Mycelial Choir) ──────────────────────────────────────────────

interface ChordOpts {
  vib?: readonly [number, number];
  /** Relative pitch fall over the chord (negative = rise). */
  fall?: number;
  drive?: number;
}

/** Close-harmony vowel chord: one formant voice per note, slightly out of
 * time and tune with each other, as a crowd of fungal throats would be. */
export function choirChord(s: Syn, at: number, root: number, degs: readonly number[], d: number, vowels: readonly (readonly [number, Vowel])[], g: number, a: number, r: number, o: ChordOpts = {}): number {
  degs.forEach((deg) => {
    const f = modeNote(root, deg);
    const end = o.fall ? f * (1 - o.fall * rand(0.7, 1.3)) : f * rand(0.995, 1.005);
    vocal(s, {
      at: at + rand(0, 0.08),
      f0: [[0, f], [d, end]],
      vowel: vowels,
      d,
      a,
      r,
      gain: g,
      breath: 0.12,
      vib: o.vib ?? [rand(4, 5.5), 12],
      shift: rand(0.97, 1.03),
      lp: 3500,
      pan: rand(-0.55, 0.55),
      drive: o.drive,
    });
  });
  return at + d + 0.1;
}

const sporePuff = (s: Syn, at: number, g: number) => noise(s, { at, color: "pink", a: 0.01, d: 0.3, lp: 1500, lp1: 400, gain: g });

const fungal = voiceSet("fungal", {
  idle: (s) => choirChord(s, 0, 196, [0, 2, 4], 2.2, [[0, "oo"], [2.2, "o"]], 0.07, 0.8, 0.8),
  alert: (s) => choirChord(s, 0, 196, [0, 2, 4], 1.4, [[0, "oo"], [1.2, "a"]], 0.1, 0.3, 0.5, { fall: -0.06 }),
  attack: (s) => {
    sporePuff(s, 0.05, 0.3);
    return choirChord(s, 0, 220, [0, 1, 2], 0.8, [[0, "a"], [0.6, "ae"]], 0.12, 0.05, 0.3, { drive: 1.5 });
  },
  hurt: (s) => choirChord(s, 0, 208, [0, 3], 0.6, [[0, "e"]], 0.1, 0.03, 0.3, { vib: [7, 60] }),
  death: (s) => {
    sporePuff(s, 2, 0.25);
    return choirChord(s, 0, 196, [0, 2, 4, 6], 2.6, [[0, "a"], [2.6, "oo"]], 0.08, 0.1, 1.2, { fall: 0.3 });
  },
}, { reverb: 0.5, pitchVar: 0.02 });

// ── Giant (warden rumble) ────────────────────────────────────────────────────

function rumble(s: Syn, at: number, d: number, f0: readonly (readonly [number, number])[], g: number, vowels: readonly (readonly [number, Vowel])[]): number {
  vocal(s, { at, f0, vowel: vowels, shift: 0.45, growl: 0.9, sub: 0.8, drive: 2.5, breath: 0.3, jitter: 40, d, gain: g, a: d * 0.25, r: d * 0.35, lp: 1200 });
  noise(s, { at, color: "brown", a: d * 0.3, d: d * 0.7, lp: 200, gain: g });
  return at + d;
}

const giant = voiceSet("giant", {
  idle: (s) => rumble(s, 0, 2, [[0, 42], [2, 40]], 0.25, [[0, "o"], [2, "u"]]),
  alert: (s) => rumble(s, 0, 1.5, [[0, 40], [1.5, 55]], 0.35, [[0, "u"], [1.2, "o"]]),
  attack: (s) => {
    rumble(s, 0, 1.2, [[0, 60], [0.3, 75], [1.2, 45]], 0.42, [[0, "a"], [1, "o"]]);
    thump(s, { at: 0.9, f: 45, f1: 25, d: 0.8, gain: 0.55 });
    pebbles(s, { at: 0.95, n: 8, span: 0.6, gain: 0.1 });
    return 1.8;
  },
  hurt: (s) => {
    rumble(s, 0, 0.5, [[0, 55], [0.5, 42]], 0.35, [[0, "uh"]]);
    noise(s, { d: 0.03, bp: 2000, gain: 0.3 });
    pebbles(s, { at: 0.02, n: 5, span: 0.3, gain: 0.1 });
    return 0.6;
  },
  death: (s) => {
    rumble(s, 0, 3, [[0, 55], [3, 28]], 0.4, [[0, "a"], [1.5, "o"], [3, "u"]]);
    thump(s, { at: 1.8, f: 50, f1: 25, d: 0.9, gain: 0.55 });
    thump(s, { at: 2.3, f: 45, f1: 22, d: 1, gain: 0.5 });
    pebbles(s, { at: 1.8, n: 20, span: 1.5, gain: 0.12 });
    noise(s, { at: 1.8, color: "brown", a: 0.1, d: 2, lp: 150, gain: 0.35 });
    return 4;
  },
}, { refDist: 8, maxDist: 160, reverb: 0.45, priority: 1.3, pitchVar: 0.04 });

export const MADE_VOICES: Record<string, VoiceSet> = { automaton, clock, paper, fungal, giant };
