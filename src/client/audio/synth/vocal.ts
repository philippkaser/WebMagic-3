/** Source–filter voice: a glottal source (saw / pulse / breath noise) shaped
 * by three parallel formant bandpasses that can glide between vowels. Size is
 * `shift` (formant scale: <1 = bigger throat), roughness is `growl` (sub-
 * harmonic amplitude modulation) and `jitter` (random pitch wobble). This one
 * helper voices moans, hisses, croaks, shrieks, whispers and the Choir. */

import { biquad, gain, hz, lfo, noiseSource, run, shape, type Shape, type Syn } from "./core";

/** Formant frequencies F1–F3 (Hz, adult voice). */
export const VOWELS = {
  a: [730, 1090, 2440],
  e: [530, 1840, 2480],
  i: [270, 2290, 3010],
  o: [570, 840, 2410],
  u: [300, 870, 2240],
  uh: [520, 1190, 2390],
  ae: [660, 1720, 2410],
  er: [490, 1350, 1690],
  /** Dark, hollow "oo" (skulls, choirs). */
  oo: [360, 640, 2300],
} as const;
export type Vowel = keyof typeof VOWELS;

const FORMANT_GAIN = [1, 0.6, 0.32];
const FORMANT_BW = [90, 110, 170];

export type Contour<T> = T | readonly (readonly [number, T])[];

export interface VocalOpts extends Shape {
  /** Fundamental in Hz, or a [time, Hz] contour. */
  f0: Contour<number>;
  vowel: Contour<Vowel>;
  d: number;
  a?: number;
  r?: number;
  /** Custom amplitude contour [time, 0..1] (overrides a/r). */
  env?: readonly (readonly [number, number])[];
  gain?: number;
  at?: number;
  src?: OscillatorType | "noise";
  /** Breath noise mixed into the source, 0..1. */
  breath?: number;
  /** Formant scale (creature size: 0.6 huge throat, 1.6 tiny). */
  shift?: number;
  /** Formant bandwidth multiplier (>1 = rougher, less vowel-like). */
  bw?: number;
  vib?: readonly [number, number];
  /** Random pitch wobble in cents. */
  jitter?: number;
  /** Sub-harmonic amplitude modulation 0..1 (vocal fry, growl). */
  growl?: number;
  growlRate?: number;
  /** Octave-down square mixed in, 0..1. */
  sub?: number;
}

const contour = <T>(c: Contour<T>): readonly (readonly [number, T])[] =>
  Array.isArray(c) ? (c as readonly (readonly [number, T])[]) : [[0, c as T]];

export function vocal(s: Syn, o: VocalOpts): number {
  const { ctx } = s;
  const t = s.t + (o.at ?? 0);
  const end = t + o.d;
  const P = s.pitch;
  const f0s = contour(o.f0);
  const setF0 = (p: AudioParam, mul: number) =>
    f0s.forEach(([dt, f], i) => {
      const v = hz(ctx, f * P * mul);
      if (i === 0) p.setValueAtTime(v, t + dt);
      else p.exponentialRampToValueAtTime(v, t + dt);
    });

  const exc = gain(ctx, 1);
  const noiseOnly = o.src === "noise";
  const breath = noiseOnly ? 1 : o.breath ?? 0.08;
  if (!noiseOnly) {
    const osc = ctx.createOscillator();
    osc.type = (o.src as OscillatorType | undefined) ?? "sawtooth";
    setF0(osc.frequency, 1);
    if (o.vib) lfo(s, osc.detune, o.vib[0], o.vib[1], t, end + 0.05);
    if (o.jitter) {
      // Linear-interpolated random walk: noise played absurdly slowly.
      const j = noiseSource(s, "white", t, end + 0.05, 30 / ctx.sampleRate);
      j.connect(gain(ctx, o.jitter / 0.3)).connect(osc.detune);
    }
    osc.connect(gain(ctx, 1 - breath * 0.75)).connect(exc);
    run(s, osc, t, end + 0.05);
    if (o.sub) {
      const so = ctx.createOscillator();
      so.type = "square";
      setF0(so.frequency, 0.5);
      so.connect(gain(ctx, o.sub * 0.5)).connect(exc);
      run(s, so, t, end + 0.05);
    }
  }
  if (breath > 0) noiseSource(s, "white", t, end + 0.05).connect(gain(ctx, breath * 1.6)).connect(exc);

  let node: AudioNode = exc;
  if (o.growl) {
    const am = gain(ctx, 1 - o.growl * 0.5);
    const m = ctx.createOscillator();
    if (o.growlRate) m.frequency.value = o.growlRate;
    else setF0(m.frequency, 0.5);
    m.connect(gain(ctx, o.growl * 0.5)).connect(am.gain);
    run(s, m, t, end + 0.05);
    exc.connect(am);
    node = am;
  }

  const peak = o.gain ?? 0.3;
  const sum = gain(ctx, noiseOnly ? 1.6 : 2.6);
  const vs = contour(o.vowel);
  const shift = (o.shift ?? 1) * P;
  const first = VOWELS[(vs[0] as readonly [number, Vowel])[1]];
  for (let k = 0; k < 3; k++) {
    const f = first[k] as number;
    const b = biquad(ctx, "bandpass", f * shift, (f * shift) / ((FORMANT_BW[k] as number) * (o.bw ?? 1) * Math.sqrt(shift)));
    vs.forEach(([dt, v], i) => {
      const fk = hz(ctx, (VOWELS[v][k] as number) * shift);
      if (i === 0) b.frequency.setValueAtTime(fk, t + dt);
      else b.frequency.linearRampToValueAtTime(fk, t + dt);
    });
    node.connect(b).connect(gain(ctx, FORMANT_GAIN[k] as number)).connect(sum);
  }

  const amp = gain(ctx, 0);
  if (o.env) {
    o.env.forEach(([dt, v], i) => {
      if (i === 0) amp.gain.setValueAtTime(v * peak, t + dt);
      else amp.gain.linearRampToValueAtTime(v * peak, t + dt);
    });
    amp.gain.linearRampToValueAtTime(0, end);
  } else {
    const a = o.a ?? 0.03;
    const r = o.r ?? Math.min(0.2, o.d * 0.4);
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(peak, t + a);
    amp.gain.setValueAtTime(peak, Math.max(t + a, end - r));
    amp.gain.linearRampToValueAtTime(0, end);
  }
  sum.connect(amp);
  shape(s, amp, o, t, o.d);
  return end - s.t;
}

/** A quick breath/whisper: noise-excited vocal with no pitch. */
export function breathe(s: Syn, o: Omit<VocalOpts, "f0" | "src">): number {
  return vocal(s, { ...o, f0: 100, src: "noise" });
}

/** Fixed-pitch sine partial helper for pads (choir chords, stingers). */
export function padNote(s: Syn, f: number, at: number, d: number, level: number, a: number, out: AudioNode = s.out): void {
  const { ctx } = s;
  const t = s.t + at;
  const osc = ctx.createOscillator();
  osc.frequency.value = hz(ctx, f * s.pitch);
  const g = gain(ctx, 0);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(level, t + a);
  g.gain.setValueAtTime(level, t + Math.max(a, d - a));
  g.gain.linearRampToValueAtTime(0, t + d);
  osc.connect(g).connect(out);
  run(s, osc, t, t + d + 0.02);
}
