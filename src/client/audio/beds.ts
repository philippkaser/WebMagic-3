/** Ambience beds, one per place. Each is layered and generative: continuous
 * layers drift under slow random automation, events are Poisson-timed and
 * placed at random pans / distances, and patterned layers (clocks, hearts,
 * breath, the Choir's chords) wander in tempo and voicing. Nothing loops. */

import { VOICE_CUES } from "./voices";
import { choirChord } from "./voices/made";
import type { BedDef, BedKit } from "./bedkit";
import {
  bank,
  biquad,
  crackle,
  drone,
  fm,
  gain,
  hiss,
  lfo,
  modal,
  MODES,
  noise,
  playBuf,
  tone,
  vocal,
  bubble,
  breathe,
  type NoiseColor,
  type Syn,
  type Vowel,
} from "./synth";
import { atAbs, bubbles, clatter, creak, heartbeat, modeNote } from "./cues/recipes";
import { BED_TRIM } from "./mix";
import { chance, pick, rand, randi } from "./util";

// ── Layer helpers ────────────────────────────────────────────────────────────

/** Oscillator drone with slow random detune drift and level swells. */
function droneLayer(k: BedKit, o: { freqs: readonly number[]; type?: OscillatorType; lp?: number; gain: number; drift?: number; wobble?: number }): GainNode {
  const { s } = k;
  const lp = biquad(s.ctx, "lowpass", o.lp ?? 400);
  const g = gain(s.ctx, o.gain);
  lp.connect(g).connect(s.out);
  const oscs = o.freqs.map((f) => drone(s, o.type ?? "sine", f, 1 / Math.sqrt(o.freqs.length), lp));
  if (o.wobble) for (const osc of oscs) lfo(s, osc.detune, rand(0.1, 0.3), o.wobble, s.t, Infinity);
  const drift = o.drift ?? 0;
  if (drift) k.every(4, 10, (e) => oscs.forEach((osc) => osc.detune.setTargetAtTime(rand(-drift, drift), e.t, 3)));
  k.every(6, 14, (e) => g.gain.setTargetAtTime(o.gain * rand(0.6, 1.15), e.t, 4));
  return g;
}

/** Filtered noise air with gusts (filter + level wander). */
function windLayer(k: BedKit, o: { color?: NoiseColor; f: number; q?: number; gain: number; gust?: readonly [number, number]; range?: readonly [number, number]; rate?: number }): void {
  const { s } = k;
  const bp = biquad(s.ctx, "bandpass", o.f, o.q ?? 0.7);
  const g = gain(s.ctx, o.gain);
  bp.connect(g).connect(s.out);
  hiss(s, o.color ?? "pink", 1, bp, o.rate ?? 1);
  const [lo, hi] = o.range ?? [o.f * 0.6, o.f * 1.8];
  const [gmin, gmax] = o.gust ?? [3, 8];
  k.every(gmin, gmax, (e) => {
    bp.frequency.setTargetAtTime(rand(lo, hi), e.t, rand(1, 3));
    g.gain.setTargetAtTime(o.gain * rand(0.3, 1.25), e.t, rand(1, 2.5));
  });
}

/** Low filtered noise floor (room tone). */
function airLayer(k: BedKit, color: NoiseColor, lp: number, level: number): GainNode {
  const f = biquad(k.s.ctx, "lowpass", lp);
  const g = gain(k.s.ctx, level);
  f.connect(g).connect(k.s.out);
  hiss(k.s, color, 1, f);
  k.every(5, 12, (e) => g.gain.setTargetAtTime(level * rand(0.6, 1.3), e.t, 3));
  return g;
}

function drip(e: Syn, deep = false): void {
  bubble(e, rand(deep ? 500 : 900, deep ? 1100 : 1700), 0, rand(0.04, 0.07), 0.25);
  tone(e, { at: 0.008, f: rand(1300, 2300), d: 0.12, gain: 0.05 });
}

function crickets(k: BedKit, pitch: number, spacing: number, level: number): void {
  for (let c = 0; c < 3; c++) {
    const f = rand(4100, 5200) * pitch;
    const pan = rand(-0.9, 0.9);
    k.every(0.5, 1.6, (e) => {
      const n = randi(2, 5);
      for (let i = 0; i < n; i++) tone(e, { at: i * 0.035 * spacing, f, d: 0.018 * spacing, a: 0.004, gain: level });
    }, { pan, far: [0.3, 0.8] });
  }
}

/** A bell partial set with no strike: it swells and fades, never rings. */
function unrungBell(e: Syn, f: number, level: number, reverse: boolean): void {
  if (!reverse) {
    modal(e, { f, modes: MODES.bell, d: 6, a: 1.8, gain: level, lp: 1400, max: 5 });
    return;
  }
  // Rings backwards: partials swell up and cut off.
  for (const [r, , g] of MODES.bell.slice(0, 6)) tone(e, { f: f * r, a: 3.2 * rand(0.9, 1.1), d: 0.06, gain: level * g * 0.7, linDecay: true, lp: 2000 });
}

function scratches(e: Syn): void {
  const n = randi(4, 8);
  let t = 0;
  for (let i = 0; i < n; i++) {
    noise(e, { at: t, a: 0.02, d: rand(0.05, 0.12), bp: rand(2000, 3500), q: 2, gain: 0.1 });
    t += rand(0.1, 0.2);
  }
}

function rustle(e: Syn, level: number): void {
  crackle(e, { d: rand(0.25, 0.5), density: 900, bp: 3000, q: 0.7, gain: level, a: 0.03 });
}

/** A cached voice buffer if pre-rendered, else its live build. */
function voiceOr(e: Syn, id: string, level: number): void {
  const buf = bank.get(id);
  const g = gain(e.ctx, level);
  g.connect(e.out);
  const s2 = { ...e, out: g };
  if (buf) playBuf(s2, buf);
  else VOICE_CUES[id]?.build(s2);
}

// ── Kneel (and its wrong twin) ───────────────────────────────────────────────

function villageLayers(k: BedKit, wrong: boolean): void {
  windLayer(k, { f: 500, gain: 0.16, range: [300, 900], gust: [3, 7] });
  airLayer(k, "brown", 120, 0.14);
  crickets(k, wrong ? 0.7 : 1, wrong ? 1.8 : 1, wrong ? 0.012 : 0.016);
  k.every(22, 45, (e) => unrungBell(e, 196, 0.06, wrong), { pan: -0.4, far: [0.75, 0.9] });
  k.every(18, 40, (e) => creak(e, { d: rand(0.6, 1.2), f: [[0, rand(30, 40)], [0.6, rand(45, 60)]], gain: 0.05 }), { spread: 0.9, far: [0.5, 0.85] });
  // An owl that hoots three times — and sometimes a fourth, at the wrong pitch.
  k.every(30, 70, (e) => {
    const f = 390;
    const n = chance(0.3) || wrong ? 4 : 3;
    for (let i = 0; i < n; i++) {
      const pf = i === 3 ? f * (wrong ? 0.71 : 1.06) : f;
      vocal(e, { at: i * 0.55, f0: [[0, pf], [0.35, pf * 0.94]], vowel: "u", src: "triangle", d: 0.35, a: 0.05, r: 0.2, gain: 0.05, breath: 0.2, shift: 0.9 });
    }
  }, { spread: 0.9, far: [0.6, 0.85] });
  if (!wrong) return;
  // The dreamer's mistakes: a warbling drone, reversed swells, backwards fragments.
  droneLayer(k, { freqs: [98, 103.8], type: "triangle", lp: 700, gain: 0.05, wobble: 50 });
  k.every(6, 14, (e) => noise(e, { color: "pink", a: rand(1.5, 3), d: 0.05, bp: rand(400, 1500), q: 1, gain: 0.08, linDecay: true }), { spread: 1, far: [0.3, 0.7] });
  k.every(10, 22, (e) => voiceOr(e, pick(["voice:dream:idle", "voice:mirror:idle", "voice:dream:alert"]), 0.45), { spread: 1, far: [0.4, 0.8] });
}

// ── Choir chord progression ──────────────────────────────────────────────────

const CHOIR_VOWELS: readonly Vowel[] = ["oo", "o", "u", "a", "oo", "er"];

function choirLayer(k: BedKit, root: number, level: number): void {
  const degs = [0, 2, 4, 6];
  let next = k.s.t + 0.5;
  k.tick((from, to) => {
    while (next < to) {
      const dur = rand(7, 12);
      if (next >= from - 0.05) {
        // Voice-leading: nudge one or two voices by a step.
        for (let m = 0; m < randi(1, 2); m++) {
          const i = randi(0, degs.length - 1);
          const cand = (degs[i] as number) + pick([-2, -1, 1, 2]);
          if (cand >= -2 && cand <= 11 && !degs.includes(cand)) degs[i] = cand;
        }
        degs.sort((a, b) => a - b);
        const v = [pick(CHOIR_VOWELS), pick(CHOIR_VOWELS), pick(CHOIR_VOWELS)] as const;
        const e = atAbs(k.s, next);
        choirChord(e, 0, root, degs, dur + 3.5, [[0, v[0]], [dur * 0.5, v[1]], [dur + 3.5, v[2]]], level, 3, 3.5, { vib: [rand(3.5, 5), 10] });
        if (chance(0.4)) choirChord(e, rand(1, 3), root / 2, [0], dur, [[0, "oo"]], level * 0.8, 3, 3);
      }
      next += dur;
    }
  });
}

// ── Orrery clocks ────────────────────────────────────────────────────────────

function clocks(k: BedKit): void {
  const layers = [
    { period: 0.5, f: 3300, pan: -0.6, far: 0.4, g: 0.05 },
    { period: 0.75, f: 2200, pan: 0.5, far: 0.55, g: 0.05 },
    { period: 0.6, f: 900, pan: 0.1, far: 0.7, g: 0.06 },
  ];
  const next = layers.map(() => k.s.t + rand(0, 0.5));
  let count = 0;
  k.tick((from, to) => {
    layers.forEach((L, i) => {
      while ((next[i] as number) < to) {
        const t = next[i] as number;
        if (t >= from - 0.05) {
          const e = atAbs(k.s, t, k.place({ pan: L.pan, far: [L.far, L.far] }));
          noise(e, { d: 0.004, bp: L.f * 1.3, q: 6, gain: L.g });
          modal(e, { f: L.f, modes: [[1, 1, 1], [2.3, 0.5, 0.5]], d: 0.04, gain: L.g * 0.6 });
          if (i === 0 && ++count % 16 === 0) {
            const root = pick([523, 587]);
            [0, 4, 2, 6].slice(0, randi(3, 4)).forEach((deg, j) => modal(atAbs(k.s, t + 0.25 + j * 0.25, k.place({ spread: 0.6, far: [0.5, 0.7] })), { f: modeNote(root, deg), modes: MODES.chime, d: 1.5, gain: 0.04 }));
          }
        }
        next[i] = t + L.period * rand(0.995, 1.005);
      }
    });
  });
}

// ── The beds ─────────────────────────────────────────────────────────────────

const RAW_BEDS: Record<string, BedDef> = {
  village_night: { root: 49, room: "village_night", wet: 0.3, build: (k) => villageLayers(k, false) },

  undercroft: {
    root: 41,
    room: "small_crypt",
    build(k) {
      droneLayer(k, { freqs: [41, 41.3, 61.6], lp: 220, gain: 0.3, drift: 6 });
      airLayer(k, "pink", 300, 0.05);
      k.every(1.5, 5, (e) => drip(e), { spread: 1, far: [0.3, 0.85] });
      k.every(8, 20, scratches, { spread: 1, far: [0.6, 0.9] });
      k.every(15, 35, (e) => clatter(e, { n: randi(2, 4), span: 0.4, mat: "bone", gain: 0.1 }), { spread: 1, far: [0.5, 0.85] });
      k.every(20, 45, (e) => creak(e, { d: rand(1.5, 2.5), f: [[0, rand(18, 24)], [2, rand(26, 32)]], res: [200, 450, 900], gain: 0.06 }), { spread: 1, far: [0.6, 0.9] });
    },
  },

  archive: {
    root: 55,
    room: "flooded_hall",
    build(k) {
      airLayer(k, "brown", 200, 0.08);
      droneLayer(k, { freqs: [55, 82.4], type: "triangle", lp: 250, gain: 0.1, drift: 5 });
      k.every(1.2, 3, (e) => noise(e, { color: "pink", a: rand(0.3, 0.6), d: rand(0.6, 1), bp: 420, bp1: 240, q: 0.7, gain: 0.08, linDecay: true }), { spread: 0.8, far: [0.2, 0.5] });
      k.every(0.8, 2.5, (e) => drip(e, true), { spread: 1, far: [0.2, 0.8] });
      k.every(10, 25, (e) => rustle(e, 0.07), { spread: 1, far: [0.4, 0.8] });
      k.every(12, 30, (e) => creak(e, { d: rand(0.8, 1.5), f: [[0, rand(30, 40)], [1, rand(40, 55)]], gain: 0.05 }), { spread: 1, far: [0.5, 0.9] });
    },
  },

  choir: {
    root: 55,
    room: "huge_cavern",
    wet: 0.45,
    build(k) {
      choirLayer(k, 110, 0.05);
      droneLayer(k, { freqs: [55], lp: 200, gain: 0.12 });
      airLayer(k, "brown", 180, 0.06);
      k.every(2, 6, (e) => drip(e, true), { spread: 1, far: [0.4, 0.85] });
      k.every(6, 15, (e) => noise(e, { color: "pink", a: 0.02, d: rand(0.3, 0.6), lp: 1200, lp1: 400, gain: 0.08 }), { spread: 1, far: [0.4, 0.8] });
    },
  },

  foundry: {
    root: 36.7,
    room: "forge",
    build(k) {
      airLayer(k, "brown", 250, 0.14);
      crackle(k.s, { d: Infinity, density: 30, hp: 1500, gain: 0.05, loop: true });
      droneLayer(k, { freqs: [36.7], lp: 120, gain: 0.12 });
      k.every(4, 9, (e) => {
        const f = rand(620, 780);
        const n = randi(3, 5);
        const iv = rand(0.45, 0.6);
        for (let i = 0; i < n; i++) {
          modal(e, { at: i * iv, f: f * rand(0.99, 1.01), modes: MODES.metal, d: 0.5, strike: 0.7, gain: i === n - 1 ? 0.05 : 0.08, lp: 2500, max: 6 });
          noise(e, { at: i * iv, color: "brown", d: 0.06, lp: 400, gain: 0.08 });
        }
      }, { spread: 0.9, far: [0.6, 0.9] });
      k.every(5, 9, (e) => {
        noise(e, { color: "pink", a: 1.2, d: 1.4, lp: 400, lp1: 900, gain: 0.1 });
        creak(e, { at: 0.2, d: 1, f: 30, gain: 0.03 });
      }, { spread: 0.6, far: [0.4, 0.7] });
      k.every(6, 15, (e) => noise(e, { a: 0.05, h: 0.4, d: 0.8, hp: 2500, gain: 0.05 }), { spread: 1, far: [0.3, 0.8] });
      k.every(15, 30, (e) => fm(e, { f: rand(50, 70), ratio: 2.76, index: 3, a: 1.5, d: 2, gain: 0.05, vib: [0.5, 30] }), { spread: 1, far: [0.5, 0.85] });
    },
  },

  hive: {
    root: 55,
    room: "wax_hall",
    build(k) {
      const { s } = k;
      const lp = biquad(s.ctx, "lowpass", 500);
      const am = gain(s.ctx, 0.85);
      lfo(s, am.gain, 34, 0.15, s.t, Infinity);
      const g = gain(s.ctx, 0.1);
      lp.connect(am).connect(g).connect(s.out);
      for (const f of [110, 110.4, 109.7, 220.3, 164.9]) drone(s, "sawtooth", f, 0.25, lp);
      k.every(5, 12, (e) => g.gain.setTargetAtTime(rand(0.06, 0.13), e.t, 3));
      airLayer(k, "brown", 200, 0.05);
      k.every(4, 12, (e) => {
        creak(e, { d: rand(0.5, 1.2), f: [[0, rand(50, 65)], [1, rand(65, 85)]], res: [500, 1100, 2300], gain: 0.04 });
        bubble(e, rand(200, 350), rand(0.4, 1), 0.04, 0.08);
      }, { spread: 1, far: [0.3, 0.7] });
      k.every(12, 25, (e) => {
        for (let i = 0; i < 3; i++) tone(e, { type: "sawtooth", f: rand(200, 240), a: 2, h: 0.5, d: 2.5, gain: 0.03, bp: 900, q: 0.8, vib: [rand(18, 30), 30] });
      }, { spread: 1, far: [0.6, 0.85] });
      k.every(3, 8, (e) => bubble(e, rand(150, 300), 0, 0.1, 0.12), { spread: 1, far: [0.4, 0.8] });
    },
  },

  liturgy: {
    root: 73.4,
    room: "ice_chapel",
    wet: 0.45,
    build(k) {
      windLayer(k, { color: "white", f: 2500, q: 6, gain: 0.03, range: [1500, 4200], gust: [2, 6] });
      windLayer(k, { f: 600, gain: 0.07, gust: [4, 9] });
      k.every(3, 7, (e) => fm(e, { f: modeNote(440, randi(0, 9)), ratio: 3.5, index: 1, index1: 0.2, a: 0.8, d: 4, gain: 0.025 }), { spread: 1, far: [0.3, 0.7] });
      // A held choir note that never changes (overlapping re-triggers).
      k.every(7.5, 8.5, (e) => {
        for (const deg of [0, 4, 9]) vocal(e, { f0: modeNote(146.8, deg), vowel: "oo", d: 13, a: 4, r: 4, gain: 0.03, breath: 0.25, vib: [0.2, 5], lp: 2000 });
      });
      k.every(6, 18, (e) => {
        crackle(e, { d: rand(0.1, 0.3), density: 1500, hp: 2500, gain: 0.06 });
        if (chance(0.3)) tone(e, { f: 90, f1: 60, a: 0.5, d: 1.5, gain: 0.05 });
      }, { spread: 1, far: [0.3, 0.8] });
    },
  },

  garden: {
    root: 49,
    room: "flesh",
    build(k) {
      const { s } = k;
      const lp = biquad(s.ctx, "lowpass", 180);
      const breath = gain(s.ctx, 0.12);
      lfo(s, breath.gain, 0.22, 0.07, s.t, Infinity);
      lp.connect(breath).connect(s.out);
      hiss(s, "brown", 1, lp);
      let next = s.t + 0.3;
      let iv = 1.15;
      k.tick((from, to) => {
        while (next < to) {
          if (next >= from - 0.05) {
            const e = atAbs(s, next, k.place({ pan: 0, far: [0.35, 0.45] }));
            heartbeat(e, { gain: 0.3, lp: 150, f: 50, gap: 0.3 });
          }
          iv = Math.min(1.35, Math.max(0.95, iv + rand(-0.03, 0.03)));
          next += iv;
        }
      });
      k.every(3, 9, (e) => bubbles(e, { n: randi(6, 12), span: 1, fLo: 100, fHi: 400, gain: 0.06 }), { spread: 1, far: [0.3, 0.8] });
      k.every(5, 14, (e) => noise(e, { color: "pink", d: 0.3, bp: 400, bp1: 1100, q: 3, gain: 0.07 }), { spread: 1, far: [0.3, 0.7] });
      k.every(15, 35, (e) => vocal(e, { f0: [[0, 80], [2, 70]], vowel: [[0, "o"], [2, "u"]], growl: 0.6, breath: 0.3, d: 2, a: 0.6, r: 0.8, gain: 0.06, lp: 900 }), { spread: 1, far: [0.6, 0.9] });
    },
  },

  orrery: {
    root: 49,
    room: "mirror_hall",
    build(k) {
      clocks(k);
      const { s } = k;
      const bp = biquad(s.ctx, "bandpass", 180, 3);
      const am = gain(s.ctx, 0.6);
      lfo(s, am.gain, 7, 0.3, s.t, Infinity, "square");
      const g = gain(s.ctx, 0.06);
      bp.connect(am).connect(g).connect(s.out);
      hiss(s, "brown", 1, bp);
      droneLayer(k, { freqs: [49], lp: 150, gain: 0.08 });
      let side = 1;
      k.every(2.3, 2.5, (e) => {
        side = -side;
        noise(e, { color: "pink", a: 0.6, d: 0.6, bp: 200, bp1: 600, q: 1.2, gain: 0.04, pan: side * 0.6, linDecay: true });
      });
    },
  },

  unlit: {
    root: 32.7,
    room: "void",
    wet: 0.25,
    build(k) {
      airLayer(k, "brown", 55, 0.35);
      const { s } = k;
      // Your own breath: close, dry, a little uneven.
      let next = s.t + 1;
      k.tick((from, to) => {
        while (next < to) {
          const inh = rand(1.4, 1.8);
          const exh = rand(1.8, 2.3);
          if (next >= from - 0.05) {
            const e = atAbs(s, next);
            breathe(e, { vowel: [[0, "u"], [inh, "o"]], d: inh, env: [[0, 0], [inh * 0.6, 1], [inh, 0]], gain: 0.05, hp: 300, lp: 2500 });
            breathe(e, { at: inh + 0.15, vowel: [[0, "a"], [exh, "uh"]], d: exh, env: [[0, 0], [0.3, 1], [exh, 0]], gain: 0.06, hp: 250, lp: 2200 });
          }
          next += inh + exh + rand(0.3, 1.2);
        }
      });
      k.every(40, 90, (e) => voiceOr(e, "voice:mirror:idle", 0.3), { spread: 1, far: [0.5, 0.8] });
      k.every(10, 25, (e) => modal(e, { f: rand(3000, 5000), modes: MODES.glass, d: 0.4, gain: 0.03 }), { spread: 1, far: [0.5, 0.9] });
    },
  },

  threshold: { root: 49, room: "void", wet: 0.4, build: (k) => villageLayers(k, true) },
};

export const BEDS: Record<string, BedDef> = Object.fromEntries(Object.entries(RAW_BEDS).map(([id, d]) => [id, { ...d, gain: BED_TRIM[id] ?? 1 }]));
