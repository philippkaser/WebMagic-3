/** Physically-flavoured building blocks: modal banks (bells, metal, glass),
 * filter resonators, Karplus–Strong plucks (strings, bones, wood), granular
 * crackle (fire, ice, paper) and bubbles. Tables and JS-generated buffers are
 * cached per sample rate; AudioBuffers are context-independent. */

import { rand } from "../util";
import { ahd, biquad, gain, glide, hz, noiseSource, run, shape, type Shape, type Syn } from "./core";

// ── Modal synthesis ──────────────────────────────────────────────────────────

/** [frequency ratio, decay scale, amplitude]. */
export type Mode = readonly [number, number, number];

/** Partial tables for struck objects. */
export const MODES = {
  /** Church bell: hum, prime, minor tierce, quint, nominal, upper partials. */
  bell: [[0.5, 1, 0.45], [1, 0.8, 1], [1.19, 0.65, 0.55], [1.5, 0.5, 0.35], [2, 0.45, 0.5], [2.51, 0.3, 0.25], [2.66, 0.28, 0.2], [3.01, 0.2, 0.15], [4.16, 0.14, 0.1], [5.43, 0.1, 0.07]],
  /** Small hand bell / chime: brighter, fewer low partials. */
  chime: [[1, 1, 1], [2.76, 0.5, 0.45], [5.4, 0.25, 0.25], [8.93, 0.12, 0.12]],
  /** Iron plate / armour. */
  metal: [[1, 1, 1], [1.593, 0.7, 0.6], [2.135, 0.6, 0.5], [2.295, 0.55, 0.4], [2.917, 0.4, 0.3], [3.598, 0.35, 0.25], [4.06, 0.3, 0.2], [5.4, 0.2, 0.15]],
  glass: [[1, 1, 1], [2.32, 0.6, 0.5], [4.25, 0.35, 0.35], [6.63, 0.2, 0.2], [9.38, 0.12, 0.1]],
  coin: [[1, 1, 1], [2.4, 0.6, 0.7], [3.93, 0.4, 0.4], [5.6, 0.3, 0.25], [7.4, 0.2, 0.15]],
  /** Marimba-ish wooden bar. */
  wood: [[1, 1, 1], [3.99, 0.3, 0.4], [9.2, 0.1, 0.15]],
  ceramic: [[1, 1, 1], [1.87, 0.5, 0.6], [3.1, 0.3, 0.4], [4.5, 0.2, 0.25], [6.2, 0.12, 0.15]],
  ice: [[1, 1, 1], [2.9, 0.5, 0.6], [5.3, 0.3, 0.3], [8.1, 0.15, 0.2]],
  /** Electric-piano tine. */
  tine: [[1, 1, 1], [4.0, 0.25, 0.3], [10.6, 0.1, 0.1]],
  /** Gong / big sheet: clustered, slowly beating partials. */
  gong: [[1, 1, 1], [1.48, 0.9, 0.7], [1.99, 0.8, 0.6], [2.47, 0.7, 0.5], [2.97, 0.6, 0.4], [3.5, 0.5, 0.3], [4.1, 0.4, 0.25], [5.2, 0.3, 0.2]],
  /** Hollow stone / clay. */
  stone: [[1, 1, 1], [1.74, 0.5, 0.5], [2.6, 0.3, 0.3]],
} as const satisfies Record<string, readonly Mode[]>;

export interface ModalOpts extends Shape {
  f: number;
  modes: readonly Mode[];
  /** Decay of the fundamental in seconds (partials scale from this). */
  d: number;
  gain?: number;
  at?: number;
  a?: number;
  /** Random mistuning per partial (relative), so repeats never match. */
  spread?: number;
  /** Amount of noise "strike" transient. */
  strike?: number;
  /** Keep only the first N modes (cheap distant versions). */
  max?: number;
}

/** Sum of exponentially decaying sine partials — bells, clangs, glass, coins. */
export function modal(s: Syn, o: ModalOpts): number {
  const { ctx } = s;
  const t = s.t + (o.at ?? 0);
  const bus = gain(ctx, 1);
  const modes = o.max ? o.modes.slice(0, o.max) : o.modes;
  let norm = 0;
  for (const m of modes) norm += m[2] * m[2];
  norm = (o.gain ?? 0.3) / Math.sqrt(norm || 1);
  const spread = o.spread ?? 0.006;
  let end = t;
  const nyq = ctx.sampleRate * 0.45;
  for (const [r, dk, g] of modes) {
    const f = o.f * s.pitch * r * (1 + rand(-spread, spread));
    if (f > nyq) continue;
    const osc = ctx.createOscillator();
    osc.frequency.value = f;
    const eg = gain(ctx, 0);
    const e = ahd(eg.gain, t, o.a ?? 0.0015, 0, o.d * dk, g * norm);
    osc.connect(eg).connect(bus);
    run(s, osc, t, e + 0.01);
    end = Math.max(end, e);
  }
  if (o.strike) {
    const ng = gain(ctx, 0);
    ahd(ng.gain, t, 0.0005, 0, 0.012, o.strike * (o.gain ?? 0.3));
    const hp = biquad(ctx, "highpass", Math.min(o.f * s.pitch * 1.5, nyq));
    noiseSource(s, "white", t, t + 0.03).connect(hp).connect(ng).connect(bus);
  }
  shape(s, bus, o, t, end - t);
  return end - s.t;
}

/** A bank of resonant bandpass filters excited by `input` — cheaper than
 * `modal` for short, noisy resonances (wood bodies, stone, creature throats). */
export function resonate(s: Syn, input: AudioNode, f: number, modes: readonly Mode[], q: number, out: AudioNode): void {
  const { ctx } = s;
  for (const [r, dk, g] of modes) {
    const b = biquad(ctx, "bandpass", f * r * s.pitch, q * dk);
    input.connect(b).connect(gain(ctx, g)).connect(out);
  }
}

// ── Karplus–Strong ───────────────────────────────────────────────────────────

export type PluckMat = "string" | "gut" | "bone" | "wood" | "snare" | "twig";

interface MatSpec {
  decay: number;
  /** 0 = maximal damping (dull), 1 = barely damped (bright). */
  bright: number;
  /** Probability of sign-flip per sample (KS "drum" variant — rattly). */
  blend: number;
  /** Excitation lowpass 0..1 (lower = softer pluck). */
  soft: number;
}

const MATS: Record<PluckMat, MatSpec> = {
  string: { decay: 1.6, bright: 0.7, blend: 0, soft: 0.2 },
  gut: { decay: 0.9, bright: 0.35, blend: 0, soft: 0.5 },
  bone: { decay: 0.09, bright: 0.3, blend: 0.3, soft: 0.1 },
  wood: { decay: 0.14, bright: 0.12, blend: 0.04, soft: 0.35 },
  snare: { decay: 0.2, bright: 0.5, blend: 0.5, soft: 0.05 },
  twig: { decay: 0.05, bright: 0.6, blend: 0.15, soft: 0.05 },
};

const ksCache = new Map<string, AudioBuffer>();

/** Render a Karplus–Strong pluck into a buffer (a feedback delay can't go
 * below one render quantum in WebAudio, so KS is computed in JS). */
export function ksBuffer(sr: number, f: number, m: MatSpec, dur: number): AudioBuffer {
  const N = Math.max(2, Math.round(sr / Math.max(f, 20)));
  const variant = Math.floor(Math.random() * 3);
  const key = `${sr}:${N}:${m.decay}:${m.bright}:${m.blend}:${m.soft}:${dur}:${variant}`;
  const hit = ksCache.get(key);
  if (hit) return hit;
  const L = Math.max(N * 2, Math.floor(dur * sr));
  const buf = new AudioBuffer({ length: L, sampleRate: sr, numberOfChannels: 1 });
  const out = buf.getChannelData(0);
  const line = new Float32Array(N);
  let lp = 0;
  for (let i = 0; i < N; i++) {
    lp += (1 - m.soft) * (Math.random() * 2 - 1 - lp);
    line[i] = lp;
  }
  const rho = Math.pow(0.001, N / (m.decay * sr));
  const S = 0.5 + 0.49 * m.bright;
  let i = 0;
  let peak = 1e-9;
  for (let n = 0; n < L; n++) {
    const a = line[i] as number;
    const b = line[(i + 1) % N] as number;
    out[n] = a;
    peak = Math.max(peak, Math.abs(a));
    let v = rho * (S * a + (1 - S) * b);
    if (m.blend && Math.random() < m.blend) v = -v;
    line[i] = v;
    i = (i + 1) % N;
  }
  const fade = Math.min(L, Math.floor(sr * 0.004));
  const k = 0.9 / peak;
  for (let n = 0; n < L; n++) out[n] = (out[n] as number) * k * (n >= L - fade ? (L - n) / fade : 1);
  if (ksCache.size > 96) ksCache.delete(ksCache.keys().next().value as string);
  ksCache.set(key, buf);
  return buf;
}

export interface PluckOpts extends Shape {
  f: number;
  mat?: PluckMat;
  /** Override the material decay (seconds to −60 dB). */
  decay?: number;
  gain?: number;
  at?: number;
}

export function pluck(s: Syn, o: PluckOpts): number {
  const base = MATS[o.mat ?? "string"];
  const m = o.decay ? { ...base, decay: o.decay } : base;
  const f = hz(s.ctx, o.f * s.pitch);
  const dur = Math.min(4, m.decay * 1.3 + 0.02);
  const buf = ksBuffer(s.ctx.sampleRate, f, m, dur);
  return playBuf(s, buf, { ...o, rate: 1, gain: o.gain ?? 0.3, pitched: false });
}

// ── Buffers ──────────────────────────────────────────────────────────────────

export interface BufOpts extends Shape {
  at?: number;
  rate?: number;
  gain?: number;
  /** Offset into the buffer (seconds). */
  offset?: number;
  /** Play at most this long (with a short fade). */
  d?: number;
  /** Fade in time. */
  a?: number;
  loop?: boolean;
  /** Apply s.pitch to the rate (default true). */
  pitched?: boolean;
}

/** Play an AudioBuffer through the optional shape chain; returns end time. */
export function playBuf(s: Syn, buf: AudioBuffer, o: BufOpts = {}): number {
  const { ctx } = s;
  const t = s.t + (o.at ?? 0);
  const rate = (o.rate ?? 1) * (o.pitched === false ? 1 : s.pitch);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  src.loop = !!o.loop;
  const natural = (buf.duration - (o.offset ?? 0)) / rate;
  const dur = o.d !== undefined ? Math.min(o.d, o.loop ? o.d : natural) : natural;
  const g = gain(ctx, o.gain ?? 1);
  if (o.a) {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(o.gain ?? 1, t + o.a);
  }
  if (o.d !== undefined && o.d < natural + (o.loop ? 1e9 : 0)) {
    const f = Math.min(0.03, dur * 0.3);
    g.gain.setValueAtTime(o.gain ?? 1, t + dur - f);
    g.gain.linearRampToValueAtTime(0, t + dur);
  }
  src.connect(g);
  shape(s, g, o, t, Number.isFinite(dur) ? dur : 1);
  run(s, src, t, t + dur + 0.01, o.offset ?? 0);
  return t + dur - s.t;
}

/** Reverse a buffer's samples (reversed whispers, dream swells). */
export function reverseBuffer(buf: AudioBuffer): AudioBuffer {
  const out = new AudioBuffer({ length: buf.length, sampleRate: buf.sampleRate, numberOfChannels: buf.numberOfChannels });
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const src = buf.getChannelData(c);
    const dst = out.getChannelData(c);
    for (let i = 0, n = src.length; i < n; i++) dst[i] = src[n - 1 - i] as number;
  }
  return out;
}

// ── Crackle ──────────────────────────────────────────────────────────────────

const crackleCache = new Map<string, AudioBuffer>();

const CRACKLE_BUCKETS = [12, 20, 32, 50, 80, 130, 200, 320, 500, 800, 1300, 2000];

/** Sparse random pops with a power-law amplitude spread (many ticks, a few
 * loud snaps) plus occasional resin "pops" — fire, frost, tearing paper.
 * `density` ≈ events per second, snapped to a bucket; buffers are 24 kHz
 * (clicks need no more) and cached, 2 variants per bucket (≈7 MB worst case). */
export function crackleBuffer(ctxRate: number, density: number, dur = 3): AudioBuffer {
  const sr = Math.min(ctxRate, 24000);
  const bucket = CRACKLE_BUCKETS.reduce((a, b) => (Math.abs(Math.log(b / density)) < Math.abs(Math.log(a / density)) ? b : a));
  density = bucket;
  const variant = Math.floor(Math.random() * 2);
  const key = `${sr}:${bucket}:${dur}:${variant}`;
  const hit = crackleCache.get(key);
  if (hit) return hit;
  const L = Math.floor(sr * dur);
  const buf = new AudioBuffer({ length: L, sampleRate: sr, numberOfChannels: 1 });
  const d = buf.getChannelData(0);
  let pos = 0;
  while (true) {
    pos += Math.floor((-Math.log(1 - Math.random()) / density) * sr);
    if (pos >= L) break;
    const amp = Math.pow(Math.random(), 2.5);
    if (Math.random() < 0.06) {
      // resin pop: short damped low sine
      const f = rand(250, 900);
      const len = Math.floor(sr * 0.012);
      for (let k = 0; k < len && pos + k < L; k++) {
        d[pos + k] = (d[pos + k] as number) + amp * 1.4 * Math.sin((2 * Math.PI * f * k) / sr) * Math.exp(-k / (len * 0.25));
      }
    } else {
      const len = Math.max(4, Math.floor(sr * rand(0.0002, 0.0025)));
      for (let k = 0; k < len && pos + k < L; k++) {
        d[pos + k] = (d[pos + k] as number) + amp * (Math.random() * 2 - 1) * Math.exp(-k / (len * 0.3));
      }
    }
  }
  let peak = 1e-9;
  for (let i = 0; i < L; i++) peak = Math.max(peak, Math.abs(d[i] as number));
  for (let i = 0; i < L; i++) d[i] = ((d[i] as number) / peak) * 0.95;
  crackleCache.set(key, buf);
  return buf;
}

export interface CrackleOpts extends Shape {
  d: number;
  density: number;
  gain?: number;
  at?: number;
  a?: number;
  rate?: number;
  /** Loop the crackle forever (for loop cues). */
  loop?: boolean;
}

export function crackle(s: Syn, o: CrackleOpts): number {
  const buf = crackleBuffer(s.ctx.sampleRate, o.density);
  if (o.loop) return playBuf(s, buf, { ...o, loop: true, d: Infinity, rate: o.rate ?? 1, offset: rand(0, buf.duration - 0.1) });
  const offset = rand(0, Math.max(0, buf.duration - o.d - 0.05));
  const end = playBuf(s, buf, { ...o, offset, d: Math.min(o.d, buf.duration - offset), rate: o.rate ?? 1 });
  return end;
}

// ── Bubbles & drops ──────────────────────────────────────────────────────────

/** A single bubble / drop: a sine whose pitch rises as it resonates out
 * (Minnaert resonance). */
export function bubble(s: Syn, f: number, at = 0, d = 0.05, level = 0.2, out?: AudioNode): number {
  const { ctx } = s;
  const t = s.t + at;
  const osc = ctx.createOscillator();
  const f0 = hz(ctx, f * s.pitch);
  glide(osc.frequency, t, f0, hz(ctx, f0 * rand(1.8, 2.8)), d);
  const g = gain(ctx, 0);
  const end = ahd(g.gain, t, 0.002, 0, d, level);
  osc.connect(g).connect(out ?? s.out);
  run(s, osc, t, end + 0.01);
  return end - s.t;
}
