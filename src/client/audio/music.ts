/** Music bus: the danger layer and one-shot stingers.
 *
 * Danger (0..1, smoothed: quick to rise, slow to fall) adds, in order: a
 * dissonant cluster drone (root, minor second, tritone) whose filter opens
 * with the threat; low drum pulses whose tempo climbs 55 → 140 bpm; a high
 * string tremolo above 0.45; metallic sixteenth ticks above 0.75. Everything
 * is tuned to the current bed's root. The layer is built lazily and torn
 * down after a spell of calm, so it costs nothing out of combat. */

import type { Engine } from "./engine";
import { biquad, drone, gain, lfo, makeSyn, modal, MODES, noise, pluck, prune, stopAll, tone, vocal, type Syn } from "./synth";
import { cueKit, type OneShotCue } from "./types";
import { choirChord } from "./voices/made";
import { atAbs, modeNote, sparkle, thump, toll, whoosh } from "./cues/recipes";
import { STINGER_TRIM, trimmed } from "./mix";
import { clamp, rand } from "./util";

interface Layer {
  s: Syn;
  out: GainNode;
  cluster: OscillatorNode[];
  clusterLp: BiquadFilterNode;
  clusterGain: GainNode;
  strings: OscillatorNode[];
  stringGain: GainNode;
  untick: () => void;
}

const CLUSTER = [1, 16 / 15, 45 / 32];

export class DangerMusic {
  private target = 0;
  private level = 0;
  private root = 55;
  private layer: Layer | null = null;
  private nextBeat = 0;
  private beat = 0;
  private calmSince = 0;

  constructor(private e: Engine) {}

  get value(): number {
    return this.level;
  }

  set(v: number): void {
    this.target = clamp(v, 0, 1);
    if (this.target > 0.02 && !this.layer) this.build();
  }

  setRoot(f: number): void {
    this.root = f;
    const L = this.layer;
    if (!L) return;
    const now = this.e.ctx.currentTime;
    L.cluster.forEach((o, i) => o.frequency.setTargetAtTime(f * 2 * (CLUSTER[i] as number), now, 2));
    L.strings.forEach((o, i) => o.frequency.setTargetAtTime(f * 8 * (i ? 1.06 : 1), now, 2));
  }

  private build(): void {
    const { ctx } = this.e;
    const t0 = ctx.currentTime + 0.02;
    const out = gain(ctx, 1);
    out.connect(this.e.bus.music);
    const s = makeSyn(ctx, out, t0, 1);
    const clusterLp = biquad(ctx, "lowpass", 150, 2);
    const clusterGain = gain(ctx, 0);
    clusterLp.connect(clusterGain).connect(out);
    const cluster = CLUSTER.map((r) => drone(s, "sawtooth", this.root * 2 * r, 0.33, clusterLp));
    for (const o of cluster) lfo(s, o.detune, rand(0.1, 0.2), 8, t0, Infinity);
    const bp = biquad(ctx, "bandpass", 2500, 1);
    const trem = gain(ctx, 0.5);
    lfo(s, trem.gain, 11, 0.5, t0, Infinity);
    const stringGain = gain(ctx, 0);
    bp.connect(trem).connect(stringGain).connect(out);
    const strings = [1, 1.06].map((r) => drone(s, "sawtooth", this.root * 8 * r, 0.5, bp));
    this.nextBeat = t0 + 0.1;
    const untick = this.e.sched.add((from, to) => this.tick(from, to), t0);
    this.layer = { s, out, cluster, clusterLp, clusterGain, strings, stringGain, untick };
    this.calmSince = t0;
  }

  private teardown(): void {
    const L = this.layer;
    if (!L) return;
    const now = this.e.ctx.currentTime;
    L.out.gain.setTargetAtTime(0, now, 0.2);
    stopAll(L.s.srcs, now + 1);
    L.untick();
    this.layer = null;
  }

  private tick(from: number, to: number): void {
    const L = this.layer;
    if (!L) return;
    const dt = to - from;
    const tau = this.target > this.level ? 0.6 : 4;
    this.level += (this.target - this.level) * (1 - Math.exp(-dt / tau));
    const d = this.level;
    L.clusterGain.gain.setTargetAtTime(0.1 * Math.pow(d, 1.3), from, 0.4);
    L.clusterLp.frequency.setTargetAtTime(150 + 1900 * d * d, from, 0.5);
    L.stringGain.gain.setTargetAtTime(d > 0.45 ? ((d - 0.45) / 0.55) * 0.05 : 0, from, 0.5);

    while (this.nextBeat < to) {
      const t = this.nextBeat;
      const spb = 60 / (55 + 85 * d);
      if (t >= from - 0.05 && d > 0.12) {
        const e = atAbs(L.s, t);
        const accent = this.beat % 4 === 0 ? 1 : 0.7;
        tone(e, { f: this.root * 1.5, f1: this.root * 0.75, sweep: 0.12, d: 0.35, gain: 0.45 * d * accent });
        noise(e, { color: "brown", d: 0.15, lp: 300, gain: 0.3 * d * accent });
        if (d > 0.5 && this.beat % 2 === 1) tone(atAbs(L.s, t + spb / 2), { f: this.root * 1.2, f1: this.root * 0.8, d: 0.2, gain: 0.15 * d });
        if (d > 0.75) for (let i = 0; i < 4; i++) noise(atAbs(L.s, t + (i * spb) / 4), { d: 0.02, bp: 6000, q: 8, gain: (i ? 0.03 : 0.06) * d });
      }
      this.beat++;
      this.nextBeat = t + spb;
    }
    prune(L.s.srcs, from);
    if (this.target < 0.01 && this.level < 0.005) {
      if (to - this.calmSince > 8) this.teardown();
    } else this.calmSince = to;
  }
}

// ── Stingers ─────────────────────────────────────────────────────────────────

const { one } = cueKit("stinger");
const meta = { bus: "music" as const, priority: 1, reverb: 0.4, maxInstances: 1, pitchVar: 0 };

/** One-shot musical stingers; they duck the ambience while they play. */
export const STINGERS: Record<string, OneShotCue> = trimmed<OneShotCue>({
  warden_appears: one((s) => {
    for (const r of [1, 16 / 15, 3 / 2]) tone(s, { type: "sawtooth", f: 55 * r, a: 0.05, h: 1.5, d: 2.5, lp: 300, lp1: 1500, fs: 0.8, drive: 2, gain: 0.12 });
    modal(s, { f: 70, modes: MODES.gong, d: 5, gain: 0.3, strike: 0.4 });
    choirChord(s, 0.05, 110, [0, 1, 4], 2.5, [[0, "a"], [2.5, "o"]], 0.08, 0.05, 1.2, { drive: 1.2 });
    thump(s, { f: 40, f1: 25, d: 1.5, gain: 0.6 });
    return 5.2;
  }, meta),
  legendary_drop: one((s) => {
    [0, 2, 4, 6, 7, 9, 11, 14].forEach((deg, i) => modal(s, { at: i * 0.11, f: modeNote(523, deg), modes: MODES.chime, d: 1.4, gain: 0.08, strike: 0.2 }));
    choirChord(s, 0.2, 262, [0, 4, 7], 3.2, [[0, "oo"], [3.2, "a"]], 0.06, 1, 1.5);
    sparkle(s, { at: 0.5, n: 12, span: 2.5, fLo: 3000, fHi: 8000, gain: 0.02, d: 0.4 });
    return 4.2;
  }, meta),
  death: one((s) => {
    toll(s, { f: 73.4, d: 6, gain: 0.3, lp: 2000 });
    for (const [f, k] of [[110, 1], [116.5, 0.7], [146.8, 0.6]] as const) tone(s, { type: "sawtooth", f, f1: f / 2, sweep: 3.5, a: 0.3, h: 1, d: 3, lp: 900, lp1: 200, gain: 0.07 * k });
    choirChord(s, 0.4, 147, [0, 2, 4], 3.5, [[0, "a"], [3.5, "u"]], 0.06, 0.4, 1.6, { fall: 0.25 });
    noise(s, { at: 3, color: "pink", a: 2, d: 0.05, lp: 1500, gain: 0.12, linDecay: true });
    return 6.2;
  }, meta),
  ascend: one((s) => {
    for (const [f, i] of [[131, 0], [196, 1], [262, 2], [392, 3]] as const) tone(s, { at: i * 0.2, f, a: 1.5, h: 0.8, d: 2.5, gain: 0.07, vib: [4, 6] });
    modal(s, { at: 1.5, f: 784, modes: MODES.chime, d: 2, gain: 0.12, strike: 0.2 });
    whoosh(s, { d: 1.8, f0: 300, f1: 3000, gain: 0.1, peakAt: 0.8 });
    sparkle(s, { at: 1.4, n: 10, span: 1.5, fLo: 3000, fHi: 7000, gain: 0.025, d: 0.4 });
    return 5.2;
  }, meta),
  descend: one((s) => {
    whoosh(s, { d: 1.2, f0: 2500, f1: 200, gain: 0.15, peakAt: 0.2 });
    toll(s, { at: 0.3, f: 65.4, d: 4, gain: 0.26, lp: 1500 });
    for (const r of [1, 16 / 15]) tone(s, { at: 0.3, type: "triangle", f: 130.8 * r, a: 0.5, d: 2, gain: 0.07, lp: 700 });
    return 4.3;
  }, meta),
  secret: one((s) => {
    [0, 4, 2, 6, 9].forEach((deg, i) => pluck(s, { at: i * 0.18, f: modeNote(784, deg), mat: "string", decay: 1.2, gain: 0.14 }));
    modal(s, { at: 0.95, f: 1568, modes: MODES.chime, d: 1.5, gain: 0.08 });
    vocal(s, { at: 0.3, f0: 392, vowel: [[0, "oo"], [1.5, "a"]], d: 1.8, a: 0.6, r: 0.8, gain: 0.04, breath: 0.3 });
    return 2.6;
  }, meta),
}, STINGER_TRIM);
