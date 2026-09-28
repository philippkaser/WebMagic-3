/** Shared convolution reverb. Impulse responses are *generated*: stereo
 * decorrelated noise with an RT60 envelope, a time-varying lowpass (high
 * frequencies die first), smeared early reflections, optional flutter between
 * parallel walls and discrete late slap-echoes. Switching environment
 * cross-fades two convolvers so the tail never clicks. */

import { rand } from "./util";

export interface RoomPreset {
  /** RT60 in seconds. */
  decay: number;
  predelay: number;
  /** Tail lowpass cutoff at the start / end of the decay (Hz). */
  bright: number;
  dark: number;
  /** Number of early reflections and the window they fall in (s). */
  early: number;
  earlySpan: number;
  /** 0..1 — below 1 the tail is sparse (open air, few surfaces). */
  density: number;
  /** Highpass on the IR to keep the wet signal from getting muddy. */
  lowCut: number;
  /** Return level. */
  wet: number;
  /** Parallel-wall flutter: [period s, repeats, gain]. */
  flutter?: readonly [number, number, number];
  /** Discrete far-wall echoes: [time s, gain]. */
  echoes?: readonly (readonly [number, number])[];
}

export const ROOMS = {
  /** Low vaulted ossuary: short, dense, dark. */
  small_crypt: { decay: 0.95, predelay: 0.006, bright: 5200, dark: 1100, early: 10, earlySpan: 0.03, density: 1, lowCut: 130, wet: 0.34 },
  /** Water on the floor, stone above: brighter, long, fluttery. */
  flooded_hall: { decay: 2.5, predelay: 0.018, bright: 8500, dark: 1800, early: 8, earlySpan: 0.06, density: 1, lowCut: 160, wet: 0.4, flutter: [0.021, 14, 0.22] },
  /** Enormous dark cave with distinct far-wall echoes. */
  huge_cavern: { decay: 5.5, predelay: 0.05, bright: 3600, dark: 480, early: 6, earlySpan: 0.12, density: 1, lowCut: 60, wet: 0.46, echoes: [[0.19, 0.28], [0.37, 0.16], [0.61, 0.09]] },
  /** Open air between houses: sparse, short, mostly early reflections. */
  village_night: { decay: 1.4, predelay: 0.012, bright: 6000, dark: 1500, early: 7, earlySpan: 0.11, density: 0.2, lowCut: 220, wet: 0.2 },
  /** Iron and brick: bright metallic ring. */
  forge: { decay: 1.7, predelay: 0.01, bright: 7500, dark: 2300, early: 10, earlySpan: 0.04, density: 1, lowCut: 120, wet: 0.3, flutter: [0.013, 8, 0.14] },
  /** Soft wax walls: warm, muffled. */
  wax_hall: { decay: 2.1, predelay: 0.02, bright: 3000, dark: 900, early: 8, earlySpan: 0.05, density: 1, lowCut: 100, wet: 0.34 },
  /** Frozen cathedral: long and glassy. */
  ice_chapel: { decay: 4.2, predelay: 0.03, bright: 11000, dark: 3600, early: 8, earlySpan: 0.07, density: 1, lowCut: 180, wet: 0.45 },
  /** Meat absorbs everything: short, dark, close. */
  flesh: { decay: 0.6, predelay: 0.004, bright: 1800, dark: 500, early: 6, earlySpan: 0.02, density: 1, lowCut: 80, wet: 0.3 },
  /** The Orrery / Unlit glass halls: metallic flutter. */
  mirror_hall: { decay: 3.0, predelay: 0.015, bright: 9000, dark: 4000, early: 12, earlySpan: 0.05, density: 1, lowCut: 200, wet: 0.4, flutter: [0.0085, 30, 0.3] },
  /** Nowhere at all: huge, dark, sparse. */
  void: { decay: 7, predelay: 0.08, bright: 2000, dark: 300, early: 0, earlySpan: 0, density: 0.6, lowCut: 50, wet: 0.36 },
  /** Menus / fallback. */
  dry: { decay: 0.25, predelay: 0.002, bright: 4000, dark: 2000, early: 3, earlySpan: 0.01, density: 1, lowCut: 200, wet: 0.06 },
} as const satisfies Record<string, RoomPreset>;

export type RoomId = keyof typeof ROOMS;

const irCache = new Map<string, AudioBuffer>();

/** Generate a stereo impulse response for `p` at `sr`. */
export function makeIR(sr: number, p: RoomPreset): AudioBuffer {
  const len = Math.ceil((p.predelay + p.decay * 1.1 + 0.05) * sr);
  const buf = new AudioBuffer({ length: len, numberOfChannels: 2, sampleRate: sr });
  const pre = Math.floor(p.predelay * sr);
  const decaySamples = p.decay * sr;
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    // Diffuse tail.
    const k = Math.exp(-6.9 / decaySamples);
    let amp = 1;
    let y = 0;
    let a = 0;
    let comp = 1;
    for (let i = pre; i < len; i++) {
      const n = i - pre;
      if ((n & 127) === 0) {
        const frac = Math.min(1, n / decaySamples);
        const fc = p.bright * Math.pow(p.dark / p.bright, frac);
        a = Math.exp((-2 * Math.PI * fc) / sr);
        comp = Math.sqrt((1 + a) / (1 - a));
      }
      let w = Math.random() * 2 - 1;
      if (p.density < 1) w = Math.random() < p.density ? w / Math.sqrt(p.density) : 0;
      y = (1 - a) * w + a * y;
      const onset = n < sr * 0.004 ? n / (sr * 0.004) : 1;
      d[i] = y * comp * amp * onset * 0.6;
      amp *= k;
    }
    // Smeared early reflections (each a 1–3 ms burst).
    const burst = (time: number, g: number, ms: number) => {
      const i0 = Math.floor(time * sr);
      const L = Math.max(8, Math.floor(sr * ms * 0.001));
      let lp = 0;
      for (let j = 0; j < L && i0 + j < len; j++) {
        lp += 0.5 * (Math.random() * 2 - 1 - lp);
        d[i0 + j] = (d[i0 + j] as number) + g * lp * Math.exp((-4 * j) / L);
      }
    };
    for (let e = 0; e < p.early; e++) {
      const time = 0.002 + p.predelay * 0.5 + Math.random() * p.earlySpan;
      burst(time, (Math.random() < 0.5 ? -1 : 1) * rand(1.2, 2.6) * (1 - (0.6 * e) / Math.max(1, p.early)), rand(1, 3));
    }
    if (p.flutter) {
      const [period, count, g] = p.flutter;
      for (let n = 1; n <= count; n++) burst(0.003 + n * period * rand(0.985, 1.015), g * 6 * Math.pow(0.82, n) * (n % 2 ? 1 : -1), 1);
    }
    for (const [time, g] of p.echoes ?? []) burst(time * rand(0.97, 1.03), g * 5, 22);
    // Low cut (one-pole highpass).
    const ah = Math.exp((-2 * Math.PI * p.lowCut) / sr);
    let hy = 0;
    let hx = 0;
    for (let i = 0; i < len; i++) {
      const x = d[i] as number;
      hy = ah * (hy + x - hx);
      hx = x;
      d[i] = hy;
    }
  }
  // Unit energy per channel so every room returns a comparable level.
  let e = 0;
  for (let c = 0; c < 2; c++) for (const v of buf.getChannelData(c)) e += v * v;
  const norm = 1 / Math.sqrt(e / 2 || 1);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (d[i] as number) * norm;
  }
  return buf;
}

export function roomIR(sr: number, id: RoomId): AudioBuffer {
  const key = `${id}:${sr}`;
  let ir = irCache.get(key);
  if (!ir) {
    ir = makeIR(sr, ROOMS[id]);
    irCache.set(key, ir);
  }
  return ir;
}

/** Two-slot cross-fading convolution reverb. */
export class Reverb {
  readonly input: GainNode;
  readonly output: GainNode;
  current: RoomId | null = null;
  private slot: { conv: ConvolverNode; g: GainNode } | null = null;

  constructor(
    private ctx: BaseAudioContext,
    private realtime: boolean,
  ) {
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.output.gain.value = 0;
  }

  set(id: RoomId, fade = 1.2): void {
    if (id === this.current) return;
    const preset = ROOMS[id];
    const { ctx } = this;
    const now = ctx.currentTime;
    const conv = ctx.createConvolver();
    conv.normalize = false;
    conv.buffer = roomIR(ctx.sampleRate, id);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(1, now + fade);
    this.input.connect(conv).connect(g).connect(this.output);
    const old = this.slot;
    if (old) {
      old.g.gain.cancelScheduledValues(now);
      old.g.gain.setValueAtTime(old.g.gain.value, now);
      old.g.gain.linearRampToValueAtTime(0, now + fade);
      const drop = () => {
        try {
          this.input.disconnect(old.conv);
          old.g.disconnect();
        } catch {
          // already gone
        }
      };
      if (this.realtime) setTimeout(drop, (fade + ROOMS[this.current ?? "dry"].decay + 0.5) * 1000);
    }
    this.output.gain.setTargetAtTime(preset.wet, now, fade / 3);
    this.slot = { conv, g };
    this.current = id;
  }
}
