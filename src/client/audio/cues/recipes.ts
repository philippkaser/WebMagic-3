/** Reusable sound recipes — composite gestures built from the synth toolkit
 * and shared by spells, props, creatures and ambience beds. Each takes a Syn
 * plus a start offset `at` and returns its end time (relative to s.t). */

import {
  at as shift,
  biquad,
  breathe,
  fm,
  gain,
  modal,
  MODES,
  noise,
  noiseSource,
  pluck,
  run,
  tone,
  bubble,
  type Contour,
  type Mode,
  type PluckMat,
  type Syn,
  type Vowel,
} from "../synth";
import { chance, pick, rand, scatterTimes } from "../util";

/** The Godwell's signature mode: a Phrygian colour with septimal (7-limit)
 * thirds and sevenths — sweet but slightly wrong. Ratios over the root. */
export const GODWELL_MODE = [1, 16 / 15, 7 / 6, 4 / 3, 3 / 2, 8 / 5, 7 / 4] as const;
export const modeNote = (root: number, degree: number): number => {
  const n = GODWELL_MODE.length;
  const oct = Math.floor(degree / n);
  return root * (GODWELL_MODE[((degree % n) + n) % n] as number) * Math.pow(2, oct);
};

/** Absolute-time sub-Syn (for tick-scheduled events). */
export const atAbs = (s: Syn, t: number, out?: AudioNode): Syn => shift(s, t - s.t, out ?? s.out);

/** Knuth Poisson sampler — how many events fall in a window. */
export function poisson(lambda: number): number {
  if (lambda > 30) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * (Math.random() * 2 - 1)));
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

/** Poisson-distributed event times in [from, to) at `perSec`. */
export function eventsIn(from: number, to: number, perSec: number, fn: (t: number) => void): void {
  const n = poisson(perSec * (to - from));
  for (let i = 0; i < n; i++) fn(rand(from, to));
}

/** Air displacement: bandpassed noise swelling and sweeping. */
export function whoosh(s: Syn, o: { at?: number; d: number; f0: number; f1: number; q?: number; gain?: number; peakAt?: number; pan?: number }): number {
  const pa = o.peakAt ?? 0.45;
  return noise(s, { at: o.at, a: o.d * pa, d: o.d * (1 - pa), bp: o.f0, bp1: o.f1, q: o.q ?? 1.2, gain: o.gain ?? 0.3, color: "pink", linDecay: true, pan: o.pan });
}

/** Low body thump (sine drop) with optional click transient. */
export function thump(s: Syn, o: { at?: number; f?: number; f1?: number; d?: number; gain?: number; click?: number }): number {
  const f = o.f ?? 110;
  const d = o.d ?? 0.25;
  tone(s, { at: o.at, f, f1: o.f1 ?? f * 0.4, sweep: d * 0.6, d, a: 0.002, gain: o.gain ?? 0.5 });
  if (o.click) noise(s, { at: o.at, d: 0.012, lp: 3500, gain: o.click });
  return (o.at ?? 0) + d;
}

/** Heart: lub-dub. */
export function heartbeat(s: Syn, o: { at?: number; gain?: number; lp?: number; gap?: number; f?: number } = {}): number {
  const at0 = o.at ?? 0;
  const g = o.gain ?? 0.6;
  const f = o.f ?? 62;
  const beat = (dt: number, k: number) => {
    tone(s, { at: at0 + dt, f, f1: f * 0.6, sweep: 0.1, d: 0.17, a: 0.01, gain: g * k });
    noise(s, { at: at0 + dt, color: "brown", d: 0.1, a: 0.006, lp: o.lp ?? 220, gain: g * k * 0.9 });
  };
  const gap = o.gap ?? 0.28;
  beat(0, 1);
  beat(gap, 0.65);
  return at0 + gap + 0.22;
}

/** Tiny stone/grit clicks. */
export function pebbles(s: Syn, o: { at?: number; n: number; span: number; gain?: number; fLo?: number; fHi?: number; skew?: number }): number {
  const a = o.at ?? 0;
  for (const dt of scatterTimes(o.n, o.span, o.skew ?? 1.4)) {
    noise(s, { at: a + dt, d: rand(0.005, 0.02), bp: rand(o.fLo ?? 1500, o.fHi ?? 4500), q: 3, gain: (o.gain ?? 0.12) * rand(0.3, 1), pan: rand(-0.4, 0.4) });
  }
  return a + o.span + 0.03;
}

/** Scattered modal pings: ice shards, glass, pottery. */
export function shards(
  s: Syn,
  o: { at?: number; n: number; span: number; fLo: number; fHi: number; modes: readonly Mode[]; d: number; gain?: number; skew?: number },
): number {
  const a = o.at ?? 0;
  let end = a;
  for (const dt of scatterTimes(o.n, o.span, o.skew ?? 1.5)) {
    end = Math.max(end, modal(s, { at: a + dt, f: rand(o.fLo, o.fHi), modes: o.modes, d: o.d * rand(0.5, 1), gain: (o.gain ?? 0.08) * rand(0.4, 1), max: 3, pan: rand(-0.5, 0.5), spread: 0.02 }));
  }
  return end;
}

/** Short high sine glints. */
export function sparkle(s: Syn, o: { at?: number; n: number; span: number; fLo: number; fHi: number; gain?: number; d?: number }): number {
  const a = o.at ?? 0;
  for (const dt of scatterTimes(o.n, o.span, 1)) {
    tone(s, { at: a + dt, f: rand(o.fLo, o.fHi), d: (o.d ?? 0.18) * rand(0.5, 1.2), a: 0.002, gain: (o.gain ?? 0.05) * rand(0.4, 1), pan: rand(-0.7, 0.7) });
  }
  return a + o.span + (o.d ?? 0.18) * 1.2;
}

/** Karplus–Strong clatter (bones, dice, planks). */
export function clatter(s: Syn, o: { at?: number; n: number; span: number; mat?: PluckMat; fLo?: number; fHi?: number; gain?: number; skew?: number }): number {
  const a = o.at ?? 0;
  for (const dt of scatterTimes(o.n, o.span, o.skew ?? 1.2)) {
    pluck(s, { at: a + dt, f: rand(o.fLo ?? 500, o.fHi ?? 1400), mat: o.mat ?? "bone", gain: (o.gain ?? 0.2) * rand(0.35, 1), pan: rand(-0.5, 0.5) });
  }
  return a + o.span + 0.2;
}

/** Wood splinters: twig plucks + dry cracks. */
export function splinters(s: Syn, o: { at?: number; n: number; span: number; gain?: number }): number {
  const a = o.at ?? 0;
  for (const dt of scatterTimes(o.n, o.span, 1.6)) {
    if (chance(0.6)) pluck(s, { at: a + dt, f: rand(900, 2600), mat: "twig", gain: (o.gain ?? 0.15) * rand(0.4, 1), pan: rand(-0.5, 0.5) });
    else noise(s, { at: a + dt, d: rand(0.006, 0.02), bp: rand(1500, 3500), q: 2, gain: (o.gain ?? 0.15) * rand(0.5, 1.2) });
  }
  return a + o.span + 0.1;
}

/** Coins: bright clinks with a short ring. */
export function coins(s: Syn, o: { at?: number; n: number; span: number; gain?: number; skew?: number }): number {
  const a = o.at ?? 0;
  let end = a;
  for (const dt of scatterTimes(o.n, o.span, o.skew ?? 1)) {
    end = Math.max(end, modal(s, { at: a + dt, f: rand(2500, 4200), modes: MODES.coin, d: rand(0.18, 0.45), gain: (o.gain ?? 0.12) * rand(0.5, 1), strike: 0.35, max: 4, pan: rand(-0.4, 0.4), spread: 0.01 }));
  }
  return end;
}

/** Church-bell toll. */
export function toll(s: Syn, o: { at?: number; f: number; d: number; gain?: number; lp?: number; strike?: number; spread?: number }): number {
  return modal(s, { at: o.at, f: o.f, modes: MODES.bell, d: o.d, gain: o.gain ?? 0.3, strike: o.strike ?? 0.25, lp: o.lp, spread: o.spread ?? 0.003 });
}

/** Electric discharge: violently FM'd saw + hiss. */
export function zap(s: Syn, o: { at?: number; d: number; f: number; gain?: number; pan?: number }): number {
  const g = o.gain ?? 0.3;
  fm(s, { at: o.at, f: o.f, f1: o.f * rand(0.6, 1.6), ratio: rand(1.3, 3.7), index: 12, index1: 3, type: "sawtooth", modType: "square", d: o.d, a: 0.001, gain: g, drive: 4, hp: 300, lp: 7000, pan: o.pan });
  noise(s, { at: o.at, d: o.d * 0.7, hp: 2500, gain: g * 0.6, pan: o.pan });
  return (o.at ?? 0) + o.d;
}

/** Hiss of something hot meeting something wet. */
export function sizzleLayer(s: Syn, o: { at?: number; d: number; gain?: number }): number {
  const g = o.gain ?? 0.2;
  noise(s, { at: o.at, a: 0.02, d: o.d, hp: 3200, gain: g * 0.6 });
  noise(s, { at: o.at, a: 0.01, d: o.d * 0.8, bp: 6000, q: 1.5, gain: g * 0.5 });
  return (o.at ?? 0) + o.d;
}

/** Stick-slip creak (doors, lids, ropes, wax): a jittery low sawtooth
 * pulse-train ringing a few wooden resonances. */
export function creak(s: Syn, o: { at?: number; d: number; f: Contour<number>; gain?: number; res?: readonly number[]; q?: number; jitter?: number }): number {
  const { ctx } = s;
  const t = s.t + (o.at ?? 0);
  const end = t + o.d;
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  const pts = Array.isArray(o.f) ? (o.f as readonly (readonly [number, number])[]) : [[0, o.f as number] as const];
  pts.forEach(([dt, f], i) => {
    if (i === 0) osc.frequency.setValueAtTime(f * s.pitch, t + dt);
    else osc.frequency.exponentialRampToValueAtTime(f * s.pitch, t + dt);
  });
  const j = noiseSource(s, "white", t, end + 0.05, 45 / ctx.sampleRate);
  j.connect(gain(ctx, (o.jitter ?? 500) / 0.3)).connect(osc.detune);
  const env = gain(ctx, 0);
  const peak = o.gain ?? 0.3;
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(peak, t + Math.min(0.06, o.d * 0.2));
  env.gain.setValueAtTime(peak, end - Math.min(0.12, o.d * 0.3));
  env.gain.linearRampToValueAtTime(0, end);
  const sum = gain(ctx, 3);
  for (const r of o.res ?? [620, 1450, 2700]) {
    const b = biquad(ctx, "bandpass", r * s.pitch * rand(0.95, 1.05), o.q ?? 10);
    osc.connect(b).connect(sum);
  }
  sum.connect(env).connect(s.out);
  run(s, osc, t, end + 0.05);
  return end - s.t;
}

const WHISPER_VOWELS: readonly Vowel[] = ["a", "e", "i", "o", "u", "uh", "er", "oo"];

/** Unintelligible whisper: syllables of noise-excited vowels and fricatives. */
export function whisper(s: Syn, o: { at?: number; d: number; gain?: number; shift?: number; syllables?: number; pan?: number }): number {
  const n = o.syllables ?? Math.round(rand(2, 4));
  const g = o.gain ?? 0.3;
  let t = o.at ?? 0;
  const per = o.d / n;
  for (let i = 0; i < n; i++) {
    if (chance(0.55)) noise(s, { at: t, a: 0.02, d: per * 0.3, bp: rand(3500, 7000), q: 2, gain: g * 0.35, pan: o.pan });
    breathe(s, {
      at: t + per * 0.12,
      vowel: [[0, pick(WHISPER_VOWELS)], [per * 0.6, pick(WHISPER_VOWELS)]],
      d: per * 0.85,
      a: per * 0.3,
      r: per * 0.4,
      gain: g,
      shift: o.shift ?? 1,
      bw: 1.4,
      hp: 300,
      pan: o.pan,
    });
    t += per * rand(0.85, 1.1);
  }
  return t + 0.05;
}

/** Bubbles rising / popping. */
export function bubbles(s: Syn, o: { at?: number; n: number; span: number; fLo: number; fHi: number; gain?: number; d?: number; skew?: number }): number {
  const a = o.at ?? 0;
  for (const dt of scatterTimes(o.n, o.span, o.skew ?? 1)) {
    bubble(s, rand(o.fLo, o.fHi), a + dt, (o.d ?? 0.045) * rand(0.6, 1.5), (o.gain ?? 0.15) * rand(0.4, 1));
  }
  return a + o.span + (o.d ?? 0.045) * 1.5;
}

/** Layered explosion scaled by `k` (0.2 small … 1 large). */
export function explosion(s: Syn, k: number): number {
  noise(s, { d: 0.03 + 0.03 * k, hp: 1000, gain: 0.45, drive: 2 });
  noise(s, { d: 0.45 + 1.0 * k, a: 0.003, color: "brown", lp: 3500, lp1: 140, fs: 0.3 + 0.7 * k, gain: 0.85, drive: 2.5 });
  noise(s, { d: 0.25 + 0.35 * k, color: "pink", bp: 1100, bp1: 180, q: 0.7, gain: 0.35 });
  tone(s, { f: 90 - 25 * k, f1: 26, sweep: 0.3 + 0.35 * k, d: 0.5 + 0.8 * k, gain: 0.8, a: 0.003 });
  noise(s, { at: 0.04, a: 0.12, d: 0.9 + 2.2 * k, color: "brown", lp: 160, gain: 0.45 + 0.2 * k, rate: 0.6 });
  pebbles(s, { at: 0.12, n: Math.round(4 + 12 * k), span: 0.4 + 1.4 * k, gain: 0.1, fLo: 900, fHi: 3500 });
  return 1.1 + 2.3 * k;
}
