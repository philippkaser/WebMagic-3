/** Living things of the Well: vermin, carrion birds, ink eels, drones, spore
 * puffs, slag and the Red Garden's flesh. */

import { biquad, crackle, gain, lfo, noise, run, tone, vocal, bubble, breathe, glide, ahd, type Syn } from "../synth";
import { rand, randi } from "../util";
import { bubbles, pebbles, sizzleLayer, thump, whoosh } from "../cues/recipes";
import { voiceSet, type VoiceSet } from "./kit";

// ── Rat ──────────────────────────────────────────────────────────────────────

function squeak(s: Syn, at: number, f0: number, f1: number, d: number, g = 0.2): number {
  return tone(s, { at, type: "triangle", f: f0, f1, d, a: 0.006, gain: g, vib: [rand(28, 45), 90], hp: 1500 });
}
function chitter(s: Syn, at: number, n: number, g = 0.12): number {
  let t = at;
  for (let i = 0; i < n; i++) {
    squeak(s, t, rand(3000, 4200), rand(2600, 3600), rand(0.02, 0.04), g * rand(0.5, 1));
    t += rand(0.035, 0.07);
  }
  return t + 0.05;
}

const rat = voiceSet("rat", {
  idle: (s) => {
    for (let i = 0; i < randi(2, 3); i++) noise(s, { at: i * 0.09, d: 0.04, hp: 3000, gain: 0.12 });
    return chitter(s, 0.3, randi(3, 5), 0.1);
  },
  alert: (s) => {
    squeak(s, 0, 2500, 4200, 0.16, 0.25);
    return chitter(s, 0.2, 4, 0.14);
  },
  attack: (s) => {
    vocal(s, { f0: [[0, 1400], [0.1, 2200], [0.3, 1800]], vowel: "i", shift: 3.2, d: 0.32, gain: 0.3, growl: 0.4, breath: 0.4, drive: 2 });
    for (let i = 0; i < 4; i++) noise(s, { at: 0.05 + i * 0.05, d: 0.006, bp: 4000, q: 3, gain: 0.15 });
    return 0.35;
  },
  hurt: (s) => {
    squeak(s, 0, 4200, 2400, 0.15, 0.3);
    vocal(s, { f0: 1600, vowel: "e", shift: 3, d: 0.12, gain: 0.15, breath: 0.5 });
    return 0.18;
  },
  death: (s) => {
    squeak(s, 0, 3500, 1200, 0.5, 0.3);
    squeak(s, 0.6, 1800, 1300, 0.12, 0.08);
    return 0.8;
  },
}, { refDist: 1.5, maxDist: 30, pitchVar: 0.1 });

// ── Carrion (crow-thing) ─────────────────────────────────────────────────────

function caw(s: Syn, at: number, f0: number, d: number, g = 0.3, harsh = 1): number {
  return vocal(s, {
    at,
    f0: [[0, f0], [d * 0.6, f0 * 0.92], [d, f0 * 0.8]],
    vowel: [[0, "a"], [d * 0.6, "ae"]],
    shift: 1.35,
    growl: 0.85 * harsh,
    jitter: 90,
    breath: 0.25,
    bw: 1.6,
    d,
    a: 0.015,
    r: d * 0.35,
    gain: g,
    drive: 1.5 + harsh,
  }) + at;
}
function flap(s: Syn, at: number, n: number, g = 0.15): void {
  for (let i = 0; i < n; i++) noise(s, { at: at + i * rand(0.06, 0.09), color: "pink", a: 0.01, d: 0.05, bp: 900, q: 0.8, gain: g });
}

const carrion = voiceSet("carrion", {
  idle: (s) => caw(s, 0, rand(280, 330), 0.3, 0.2, 0.6),
  alert: (s) => {
    caw(s, 0, 450, 0.25);
    return caw(s, 0.35, 430, 0.28);
  },
  attack: (s) => {
    flap(s, 0, 3, 0.18);
    return caw(s, 0.1, 620, 0.45, 0.35, 1.5);
  },
  hurt: (s) => caw(s, 0, 720, 0.15, 0.3, 1.2),
  death: (s) => {
    vocal(s, { f0: [[0, 350], [0.8, 150]], vowel: [[0, "a"], [0.8, "u"]], shift: 1.2, growl: 0.9, jitter: 120, breath: 0.35, d: 0.9, r: 0.4, gain: 0.3, drive: 2 });
    flap(s, 0.2, 4, 0.1);
    return 1;
  },
});

// ── Ink eel ──────────────────────────────────────────────────────────────────

function gurgle(s: Syn, at: number, d: number, g = 0.3, f = 600): number {
  const { ctx } = s;
  const t = s.t + at;
  const am = gain(ctx, 0);
  ahd(am.gain, t, d * 0.2, d * 0.4, d * 0.4, g, true);
  const trem = gain(ctx, 0.5);
  lfo(s, trem.gain, rand(12, 20), 0.5, t, t + d + 0.05, "square");
  const bp = biquad(ctx, "bandpass", f * s.pitch, 2);
  glide(bp.frequency, t, f * s.pitch, f * 0.6 * s.pitch, d);
  noise(s, { at, color: "pink", h: d, d: 0.02, gain: 1, out: bp });
  bp.connect(trem).connect(am).connect(s.out);
  bubbles(s, { at, n: Math.round(d * 18), span: d, fLo: 200, fHi: 700, gain: g * 0.5 });
  return at + d + 0.05;
}

const inkEel = voiceSet("ink_eel", {
  idle: (s) => gurgle(s, 0, rand(0.6, 0.9), 0.2),
  alert: (s) => {
    noise(s, { d: 0.01, bp: 1500, q: 2, gain: 0.3 });
    return gurgle(s, 0.02, 0.5, 0.3, 800);
  },
  attack: (s) => {
    noise(s, { d: 0.3, bp: 2500, bp1: 800, q: 2, gain: 0.3 });
    vocal(s, { at: 0.05, f0: [[0, 180], [0.3, 130]], vowel: [[0, "a"], [0.25, "u"]], shift: 0.8, growl: 0.7, breath: 0.3, d: 0.35, gain: 0.25 });
    bubbles(s, { n: 10, span: 0.35, fLo: 300, fHi: 900, gain: 0.15 });
    return 0.45;
  },
  hurt: (s) => {
    noise(s, { color: "pink", d: 0.12, bp: 600, bp1: 1400, q: 3, gain: 0.3 });
    vocal(s, { f0: [[0, 200], [0.25, 120]], vowel: "u", growl: 0.7, d: 0.3, gain: 0.22, breath: 0.2 });
    return gurgle(s, 0.05, 0.3, 0.2);
  },
  death: (s) => {
    const end = gurgle(s, 0, 1.4, 0.3, 700);
    vocal(s, { f0: [[0, 150], [1.3, 60]], vowel: [[0, "o"], [1.2, "u"]], growl: 0.8, d: 1.4, gain: 0.2, breath: 0.3, shift: 0.8 });
    bubble(s, 90, 1.35, 0.2, 0.3);
    return end + 0.2;
  },
});

// ── Bee (drone swarm) ────────────────────────────────────────────────────────

function buzz(s: Syn, at: number, d: number, f0: number, f1: number, g = 0.2, n = 3, drive = 0): number {
  const { ctx } = s;
  const t = s.t + at;
  const env = gain(ctx, 0);
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(g, t + Math.min(0.08, d * 0.3));
  env.gain.setValueAtTime(g, t + d * 0.7);
  env.gain.linearRampToValueAtTime(0, t + d);
  const bp = biquad(ctx, "bandpass", 1000 * s.pitch, 0.8);
  let last: AudioNode = bp;
  if (drive) {
    const sh = biquad(ctx, "peaking", 2500 * s.pitch, 1, 6);
    bp.connect(sh);
    last = sh;
  }
  last.connect(env).connect(s.out);
  for (let i = 0; i < n; i++) {
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    const k = rand(0.96, 1.04);
    glide(o.frequency, t, f0 * k * s.pitch, f1 * k * s.pitch, d);
    lfo(s, o.detune, rand(18, 32), rand(20, 45), t, t + d + 0.02);
    o.connect(gain(ctx, 1 / n)).connect(bp);
    run(s, o, t, t + d + 0.02);
  }
  return at + d;
}

const bee = voiceSet("bee", {
  idle: (s) => buzz(s, 0, rand(0.9, 1.3), 200, rand(190, 215), 0.18),
  alert: (s) => buzz(s, 0, 0.6, 200, 265, 0.25),
  attack: (s) => {
    buzz(s, 0, 0.5, 285, 220, 0.3, 4, 1);
    tone(s, { at: 0.42, f: 3000, f1: 1500, d: 0.08, gain: 0.1 });
    return 0.55;
  },
  hurt: (s) => {
    for (let i = 0; i < 3; i++) buzz(s, i * 0.07, 0.05, rand(220, 300), rand(200, 280), 0.25);
    return 0.25;
  },
  death: (s) => {
    buzz(s, 0, 0.9, 220, 90, 0.25, 3);
    for (let i = 0; i < 4; i++) buzz(s, 0.9 + i * 0.12 * (1 + i * 0.4), 0.04, 90, 80, 0.12, 1);
    return 1.7;
  },
}, { maxInstances: 5 });

// ── Spore puff ───────────────────────────────────────────────────────────────

function puff(s: Syn, at: number, size: number, g = 0.3): number {
  noise(s, { at, color: "pink", a: 0.01, d: 0.12 + 0.3 * size, lp: 1200 + 800 * size, lp1: 400, gain: g });
  bubble(s, rand(250, 400) / (0.6 + size), at, 0.04, g * 0.4);
  noise(s, { at: at + 0.02, a: 0.02, d: 0.1 + 0.2 * size, hp: 3000, gain: g * 0.15 });
  return at + 0.2 + 0.35 * size;
}

const spore = voiceSet("spore", {
  idle: (s) => {
    puff(s, 0, 0.1, 0.15);
    return puff(s, rand(0.25, 0.5), 0.15, 0.12);
  },
  alert: (s) => {
    puff(s, 0, 0.3, 0.25);
    breathe(s, { at: 0.15, vowel: "i", shift: 1.5, d: 0.25, a: 0.05, gain: 0.12, hp: 1000 });
    return 0.45;
  },
  attack: (s) => {
    whoosh(s, { d: 0.35, f0: 300, f1: 1400, q: 0.7, gain: 0.3, peakAt: 0.2 });
    thump(s, { f: 90, f1: 50, d: 0.15, gain: 0.3 });
    return puff(s, 0.02, 1, 0.35);
  },
  hurt: (s) => {
    noise(s, { color: "pink", d: 0.1, bp: 700, bp1: 1400, q: 3, gain: 0.3 });
    return puff(s, 0.05, 0.25, 0.2);
  },
  death: (s) => {
    noise(s, { a: 0.05, d: 1, bp: 3000, bp1: 800, q: 1.5, gain: 0.2 });
    breathe(s, { vowel: [[0, "i"], [0.9, "u"]], shift: 1.4, d: 1, a: 0.1, gain: 0.1, hp: 600 });
    bubble(s, 160, 1.05, 0.06, 0.3);
    return 1.2;
  },
}, { refDist: 1.5, maxDist: 30 });

// ── Slag (molten) ────────────────────────────────────────────────────────────

function blops(s: Syn, at: number, n: number, span: number, g = 0.4): void {
  for (let i = 0; i < n; i++) bubble(s, rand(55, 140), at + rand(0, span), rand(0.1, 0.2), g * rand(0.5, 1));
}
function magmaGrowl(s: Syn, at: number, d: number, f0: readonly (readonly [number, number])[], g = 0.3): number {
  return vocal(s, { at, f0, vowel: [[0, "o"], [d, "a"]], growl: 0.85, sub: 0.5, drive: 3, shift: 0.6, breath: 0.35, jitter: 60, d, gain: g, lp: 1800 }) + at;
}

const slag = voiceSet("slag", {
  idle: (s) => {
    blops(s, 0, 3, 0.8, 0.35);
    crackle(s, { d: 1, density: 40, hp: 2500, gain: 0.12 });
    return 1.1;
  },
  alert: (s) => {
    blops(s, 0, 4, 0.3, 0.35);
    return magmaGrowl(s, 0.1, 0.6, [[0, 55], [0.6, 75]], 0.3);
  },
  attack: (s) => {
    magmaGrowl(s, 0, 0.55, [[0, 80], [0.55, 60]], 0.35);
    noise(s, { at: 0.3, color: "pink", d: 0.3, bp: 500, bp1: 250, q: 1, gain: 0.3 });
    sizzleLayer(s, { at: 0.35, d: 0.5, gain: 0.15 });
    return 0.9;
  },
  hurt: (s) => {
    sizzleLayer(s, { d: 0.4, gain: 0.2 });
    blops(s, 0, 2, 0.2, 0.35);
    return magmaGrowl(s, 0.05, 0.25, [[0, 70], [0.25, 55]], 0.25);
  },
  death: (s) => {
    sizzleLayer(s, { d: 1.6, gain: 0.25 });
    noise(s, { at: 0.4, d: 0.03, bp: 2500, q: 0.8, gain: 0.35 });
    pebbles(s, { at: 0.45, n: 10, span: 0.9, gain: 0.12, fLo: 800, fHi: 2500 });
    magmaGrowl(s, 0, 0.8, [[0, 60], [0.8, 35]], 0.3);
    bubble(s, 60, 1.4, 0.25, 0.35);
    return 1.8;
  },
}, { refDist: 3, maxDist: 50 });

// ── Flesh (the Red Garden) ───────────────────────────────────────────────────

function squelch(s: Syn, at: number, d: number, g = 0.3): number {
  noise(s, { at, color: "pink", d, bp: 500, bp1: rand(1000, 1500), q: 3, gain: g });
  thump(s, { at, f: 75, f1: 40, d: d * 0.8, gain: g * 0.8 });
  bubbles(s, { at: at + d * 0.3, n: 3, span: d, fLo: 150, fHi: 400, gain: g * 0.4 });
  return at + d + 0.1;
}
function wetMoan(s: Syn, at: number, d: number, f0: readonly (readonly [number, number])[], g = 0.25): number {
  return vocal(s, { at, f0, vowel: [[0, "o"], [d * 0.6, "uh"], [d, "u"]], growl: 0.6, breath: 0.3, jitter: 45, shift: 0.8, bw: 1.4, d, gain: g, a: d * 0.2, r: d * 0.3 }) + at;
}

const flesh = voiceSet("flesh", {
  idle: (s) => {
    squelch(s, 0, 0.3, 0.15);
    return wetMoan(s, 0.2, 1.2, [[0, 85], [1.2, 78]], 0.12);
  },
  alert: (s) => {
    noise(s, { color: "pink", d: 0.3, bp: 400, bp1: 2000, q: 4, gain: 0.25 });
    return wetMoan(s, 0.1, 0.7, [[0, 80], [0.7, 120]], 0.25);
  },
  attack: (s) => {
    squelch(s, 0, 0.25, 0.35);
    wetMoan(s, 0.02, 0.5, [[0, 110], [0.5, 90]], 0.3);
    noise(s, { at: 0.3, color: "pink", d: 0.12, bp: 1400, bp1: 500, q: 1.5, gain: 0.35 });
    return 0.6;
  },
  hurt: (s) => {
    squelch(s, 0, 0.2, 0.3);
    return wetMoan(s, 0, 0.3, [[0, 120], [0.3, 85]], 0.22);
  },
  death: (s) => {
    wetMoan(s, 0, 1.8, [[0, 100], [1.8, 50]], 0.28);
    bubbles(s, { at: 0.2, n: 20, span: 1.5, fLo: 120, fHi: 500, gain: 0.15, skew: 0.8 });
    squelch(s, 1.5, 0.3, 0.3);
    return 1.95;
  },
});

export const BEAST_VOICES: Record<string, VoiceSet> = {
  rat,
  carrion,
  ink_eel: inkEel,
  bee,
  spore,
  slag,
  flesh,
};

