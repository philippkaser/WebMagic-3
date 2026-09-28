/** Core synthesis building blocks: enveloped oscillators with pitch sweeps,
 * filtered noise bursts, FM pairs, LFOs and waveshaping.
 *
 * Every helper schedules onto a `Syn` — (context, output node, start time,
 * pitch multiplier, source list) — so the same cue code renders live, inside
 * an OfflineAudioContext pre-render, or in the headless level check. All
 * frequencies handed to helpers (oscillators *and* filters) are multiplied by
 * `s.pitch`, which is how per-play pitch randomisation reaches every layer. */

import { clamp, rand } from "../util";

/** A started source and when it is scheduled to stop (Infinity = until told). */
export interface Src {
  n: AudioScheduledSourceNode;
  end: number;
}

export interface Syn {
  readonly ctx: BaseAudioContext;
  readonly out: AudioNode;
  /** Absolute context time the sound starts at. */
  readonly t: number;
  /** Frequency multiplier applied by every helper. */
  readonly pitch: number;
  /** Every source started for this sound (shared by derived Syns) so a voice
   * can be cut short: stolen, stopped or virtualised. */
  readonly srcs: Src[];
}

export function makeSyn(ctx: BaseAudioContext, out: AudioNode, t: number, pitch = 1): Syn {
  return { ctx, out, t, pitch, srcs: [] };
}

/** Derive a Syn shifted in time, routed elsewhere, or re-pitched. */
export function at(s: Syn, dt: number, out: AudioNode = s.out, pitchMul = 1): Syn {
  return { ctx: s.ctx, out, t: s.t + dt, pitch: s.pitch * pitchMul, srcs: s.srcs };
}

/** Same Syn, different output. */
export const via = (s: Syn, out: AudioNode): Syn => at(s, 0, out);

/** Clamp a frequency into the audible / representable range of `ctx`. */
export const hz = (ctx: BaseAudioContext, f: number): number => clamp(f, 10, ctx.sampleRate * 0.49);

/** Register + schedule a source node. */
export function run<T extends AudioScheduledSourceNode>(s: Syn, n: T, t0: number, t1: number, offset?: number): T {
  if (offset !== undefined && n instanceof AudioBufferSourceNode) n.start(t0, offset);
  else n.start(t0);
  if (Number.isFinite(t1)) n.stop(t1);
  s.srcs.push({ n, end: t1 });
  return n;
}

/** Stop every source of a Syn at `t` (safe to call repeatedly). */
export function stopAll(srcs: readonly Src[], t: number): void {
  for (const x of srcs) {
    if (x.end <= t) continue;
    try {
      x.n.stop(t);
      x.end = t;
    } catch {
      // never started or already gone
    }
  }
}

/** Drop finished sources from long-lived source lists (loops, beds). */
export function prune(srcs: Src[], now: number): void {
  if (srcs.length < 64) return;
  let w = 0;
  for (let r = 0; r < srcs.length; r++) {
    const x = srcs[r] as Src;
    if (x.end > now) srcs[w++] = x;
  }
  srcs.length = w;
}

// ── Nodes ────────────────────────────────────────────────────────────────────

export function gain(ctx: BaseAudioContext, v = 1): GainNode {
  const g = ctx.createGain();
  g.gain.value = v;
  return g;
}

export function biquad(ctx: BaseAudioContext, type: BiquadFilterType, f: number, q = 0.707, db = 0): BiquadFilterNode {
  const b = ctx.createBiquadFilter();
  b.type = type;
  b.frequency.value = hz(ctx, f);
  b.Q.value = q;
  if (db) b.gain.value = db;
  return b;
}

export function stereo(ctx: BaseAudioContext, p: number): StereoPannerNode {
  const n = ctx.createStereoPanner();
  n.pan.value = clamp(p, -1, 1);
  return n;
}

/** Connect nodes in series; returns the last one. */
export function chain(...nodes: AudioNode[]): AudioNode {
  for (let i = 0; i < nodes.length - 1; i++) (nodes[i] as AudioNode).connect(nodes[i + 1] as AudioNode);
  return nodes[nodes.length - 1] as AudioNode;
}

const curves = new Map<number, Float32Array<ArrayBuffer>>();
/** Soft-clipping tanh waveshaper; `drive` 1 ≈ gentle warmth, 8+ ≈ fuzz. */
export function shaper(ctx: BaseAudioContext, drive: number): WaveShaperNode {
  const k = Math.max(0.2, Math.round(drive * 5) / 5);
  let c = curves.get(k);
  if (!c) {
    c = new Float32Array(2048);
    const norm = Math.tanh(k);
    for (let i = 0; i < c.length; i++) {
      const x = (i / (c.length - 1)) * 2 - 1;
      c[i] = Math.tanh(k * x) / norm;
    }
    curves.set(k, c);
  }
  const ws = ctx.createWaveShaper();
  ws.curve = c;
  ws.oversample = "2x";
  return ws;
}

// ── Automation ───────────────────────────────────────────────────────────────

/** Attack–hold–decay envelope on a gain param; returns the end time. The
 * decay is exponential to −80 dB (natural ring-out) unless `lin`. */
export function ahd(p: AudioParam, t: number, a: number, h: number, d: number, peak: number, lin = false): number {
  const ta = t + Math.max(a, 0.0015);
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, ta);
  const td = ta + h;
  if (h > 0) p.setValueAtTime(peak, td);
  const end = td + Math.max(d, 0.005);
  if (lin) p.linearRampToValueAtTime(0, end);
  else {
    p.exponentialRampToValueAtTime(Math.max(peak * 1e-4, 1e-7), end);
    p.setValueAtTime(0, end);
  }
  return end;
}

/** Glide a param from → to over `dur` (exponential unless `lin`). */
export function glide(p: AudioParam, t: number, from: number, to: number, dur: number, lin = false): void {
  p.setValueAtTime(from, t);
  if (to === from || dur <= 0) return;
  if (lin || from <= 0 || to <= 0) p.linearRampToValueAtTime(to, t + dur);
  else p.exponentialRampToValueAtTime(to, t + dur);
}

/** Piecewise-linear automation through [time offset, value] points. */
export function curve(p: AudioParam, t: number, pts: readonly (readonly [number, number])[]): void {
  pts.forEach(([dt, v], i) => {
    if (i === 0) p.setValueAtTime(v, t + dt);
    else p.linearRampToValueAtTime(v, t + dt);
  });
}

/** Modulate a param with an LFO (adds ±depth around its value). */
export function lfo(
  s: Syn,
  param: AudioParam,
  rate: number,
  depth: number,
  t: number,
  end: number,
  type: OscillatorType = "sine",
): OscillatorNode {
  const o = s.ctx.createOscillator();
  o.type = type;
  o.frequency.value = rate;
  const g = gain(s.ctx, depth);
  o.connect(g).connect(param);
  run(s, o, t, end);
  return o;
}

// ── Noise ────────────────────────────────────────────────────────────────────

export type NoiseColor = "white" | "pink" | "brown";
const noiseCache = new Map<string, AudioBuffer>();

/** 3 s of looping noise per colour and sample rate, RMS-normalised so colours
 * are interchangeable without re-balancing gains. Buffers are
 * context-independent, so live and offline renders share them. */
export function noiseBuffer(ctx: BaseAudioContext, color: NoiseColor): AudioBuffer {
  const sr = ctx.sampleRate;
  const key = `${color}:${sr}`;
  let buf = noiseCache.get(key);
  if (buf) return buf;
  const len = Math.floor(sr * 3);
  buf = new AudioBuffer({ length: len, sampleRate: sr, numberOfChannels: 1 });
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (color === "white") d[i] = w;
    else if (color === "pink") {
      // Paul Kellet's refined pink filter.
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
      b6 = w * 0.115926;
    } else {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last;
    }
  }
  // Remove DC, cross-fade the loop seam, normalise to RMS 0.3.
  let mean = 0;
  for (let i = 0; i < len; i++) mean += d[i] as number;
  mean /= len;
  let sq = 0;
  for (let i = 0; i < len; i++) {
    d[i] = (d[i] as number) - mean;
    sq += (d[i] as number) ** 2;
  }
  const k = 0.3 / Math.sqrt(sq / len);
  const fade = Math.floor(sr * 0.05);
  for (let i = 0; i < len; i++) d[i] = (d[i] as number) * k;
  for (let i = 0; i < fade; i++) {
    const w = i / fade;
    const j = len - fade + i;
    d[j] = (d[j] as number) * (1 - w) + (d[i] as number) * w;
  }
  noiseCache.set(key, buf);
  return buf;
}

/** A looping noise source started at a random offset. */
export function noiseSource(s: Syn, color: NoiseColor, t0: number, t1: number, rate = 1): AudioBufferSourceNode {
  const src = s.ctx.createBufferSource();
  src.buffer = noiseBuffer(s.ctx, color);
  src.loop = true;
  src.playbackRate.value = rate;
  return run(s, src, t0, t1, rand(0, 2.8));
}

// ── Shared filter / placement options ────────────────────────────────────────

export interface Shape {
  /** Lowpass cutoff (and optional sweep target). */
  lp?: number;
  lp1?: number;
  /** Lowpass resonance. */
  lq?: number;
  hp?: number;
  hp1?: number;
  /** Bandpass centre, sweep target and Q. */
  bp?: number;
  bp1?: number;
  q?: number;
  /** Duration of filter sweeps (defaults to the whole sound). */
  fs?: number;
  /** Peaking EQ [freq, Q, dB]. */
  peak?: readonly [number, number, number];
  /** Waveshaper drive. */
  drive?: number;
  /** Stereo position −1..1. */
  pan?: number;
  /** Output override (defaults to s.out). */
  out?: AudioNode;
}

/** Insert the optional filters / drive / pan of `o` after `src`, connect to the
 * output and return the last node. */
export function shape(s: Syn, src: AudioNode, o: Shape, t: number, dur: number): AudioNode {
  const { ctx } = s;
  const P = s.pitch;
  const fs = o.fs ?? dur;
  let n = src;
  const sweep = (type: BiquadFilterType, f: number, f1: number | undefined, q: number) => {
    const b = biquad(ctx, type, f * P, q);
    if (f1 !== undefined) glide(b.frequency, t, hz(ctx, f * P), hz(ctx, f1 * P), fs);
    n.connect(b);
    n = b;
  };
  if (o.hp !== undefined) sweep("highpass", o.hp, o.hp1, 0.707);
  if (o.bp !== undefined) sweep("bandpass", o.bp, o.bp1, o.q ?? 1);
  if (o.lp !== undefined) sweep("lowpass", o.lp, o.lp1, o.lq ?? 0.707);
  if (o.peak) {
    const b = biquad(ctx, "peaking", o.peak[0] * P, o.peak[1], o.peak[2]);
    n.connect(b);
    n = b;
  }
  if (o.drive) {
    const w = shaper(ctx, o.drive);
    n.connect(w);
    n = w;
  }
  if (o.pan) {
    const p = stereo(ctx, o.pan);
    n.connect(p);
    n = p;
  }
  n.connect(o.out ?? s.out);
  return n;
}

// ── Enveloped oscillator ─────────────────────────────────────────────────────

export interface ToneOpts extends Shape {
  type?: OscillatorType;
  wave?: PeriodicWave;
  f: number;
  /** Pitch sweep target and its duration (default: whole note). */
  f1?: number;
  sweep?: number;
  linSweep?: boolean;
  at?: number;
  a?: number;
  h?: number;
  d: number;
  gain?: number;
  linDecay?: boolean;
  detune?: number;
  /** Vibrato [rate Hz, depth cents]. */
  vib?: readonly [number, number];
}

/** One enveloped oscillator with optional sweep, vibrato and filtering.
 * Returns the end time relative to `s.t`. */
export function tone(s: Syn, o: ToneOpts): number {
  const { ctx } = s;
  const t = s.t + (o.at ?? 0);
  const a = o.a ?? 0.004;
  const h = o.h ?? 0;
  const osc = ctx.createOscillator();
  if (o.wave) osc.setPeriodicWave(o.wave);
  else osc.type = o.type ?? "sine";
  const f0 = hz(ctx, o.f * s.pitch);
  const f1 = o.f1 !== undefined ? hz(ctx, o.f1 * s.pitch) : f0;
  glide(osc.frequency, t, f0, f1, o.sweep ?? a + h + o.d, o.linSweep);
  if (o.detune) osc.detune.value = o.detune;
  const g = gain(ctx, 0);
  const end = ahd(g.gain, t, a, h, o.d, o.gain ?? 0.3, o.linDecay);
  if (o.vib) lfo(s, osc.detune, o.vib[0], o.vib[1], t, end + 0.02);
  osc.connect(g);
  shape(s, g, o, t, end - t);
  run(s, osc, t, end + 0.02);
  return end - s.t;
}

// ── Filtered noise burst ─────────────────────────────────────────────────────

export interface NoiseOpts extends Shape {
  color?: NoiseColor;
  at?: number;
  a?: number;
  h?: number;
  d: number;
  gain?: number;
  linDecay?: boolean;
  /** Playback rate of the noise buffer (lower = grainier, darker). */
  rate?: number;
}

export function noise(s: Syn, o: NoiseOpts): number {
  const { ctx } = s;
  const t = s.t + (o.at ?? 0);
  const a = o.a ?? 0.002;
  const h = o.h ?? 0;
  const g = gain(ctx, 0);
  const end = ahd(g.gain, t, a, h, o.d, o.gain ?? 0.3, o.linDecay);
  const src = noiseSource(s, o.color ?? "white", t, end + 0.02, o.rate ?? 1);
  src.connect(g);
  shape(s, g, o, t, end - t);
  return end - s.t;
}

// ── FM pair ──────────────────────────────────────────────────────────────────

export interface FmOpts extends Shape {
  f: number;
  f1?: number;
  sweep?: number;
  /** Modulator : carrier frequency ratio. */
  ratio: number;
  /** Modulation index at start / end. */
  index: number;
  index1?: number;
  type?: OscillatorType;
  modType?: OscillatorType;
  at?: number;
  a?: number;
  h?: number;
  d: number;
  gain?: number;
  vib?: readonly [number, number];
}

/** Two-operator FM: bells, tines, metallic zaps, growly buzzes. */
export function fm(s: Syn, o: FmOpts): number {
  const { ctx } = s;
  const t = s.t + (o.at ?? 0);
  const a = o.a ?? 0.003;
  const h = o.h ?? 0;
  const dur = a + h + o.d;
  const f0 = hz(ctx, o.f * s.pitch);
  const f1 = o.f1 !== undefined ? hz(ctx, o.f1 * s.pitch) : f0;
  const car = ctx.createOscillator();
  car.type = o.type ?? "sine";
  const mod = ctx.createOscillator();
  mod.type = o.modType ?? "sine";
  glide(car.frequency, t, f0, f1, o.sweep ?? dur);
  glide(mod.frequency, t, hz(ctx, f0 * o.ratio), hz(ctx, f1 * o.ratio), o.sweep ?? dur);
  const mg = gain(ctx, 0);
  mg.gain.setValueAtTime(o.index * f0 * o.ratio, t);
  mg.gain.linearRampToValueAtTime((o.index1 ?? o.index) * f1 * o.ratio, t + dur);
  mod.connect(mg).connect(car.frequency);
  const g = gain(ctx, 0);
  const end = ahd(g.gain, t, a, h, o.d, o.gain ?? 0.3);
  if (o.vib) lfo(s, car.detune, o.vib[0], o.vib[1], t, end + 0.02);
  car.connect(g);
  shape(s, g, o, t, dur);
  run(s, car, t, end + 0.02);
  run(s, mod, t, end + 0.02);
  return end - s.t;
}

// ── Sustained (loop) primitives ──────────────────────────────────────────────

/** An oscillator that runs until the owning voice stops it. */
export function drone(s: Syn, type: OscillatorType, f: number, level: number, out: AudioNode = s.out, detune = 0): OscillatorNode {
  const o = s.ctx.createOscillator();
  o.type = type;
  o.frequency.value = hz(s.ctx, f * s.pitch);
  o.detune.value = detune;
  o.connect(gain(s.ctx, level)).connect(out);
  return run(s, o, s.t, Infinity);
}

/** A noise source that runs until the owning voice stops it. */
export function hiss(s: Syn, color: NoiseColor, level: number, out: AudioNode = s.out, rate = 1): AudioBufferSourceNode {
  const n = noiseSource(s, color, s.t, Infinity, rate);
  n.connect(gain(s.ctx, level)).connect(out);
  return n;
}

/** A gain node that fades in from silence at s.t — the usual loop output. */
export function fadeIn(s: Syn, level: number, time = 0.15, out: AudioNode = s.out): GainNode {
  const g = gain(s.ctx, 0);
  g.gain.setValueAtTime(0, s.t);
  g.gain.linearRampToValueAtTime(level, s.t + time);
  g.connect(out);
  return g;
}
