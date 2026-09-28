/** Portal & run cues: descending, ascending, arriving, the Reliquary, the
 * presence heartbeat (another delver on the floor), pacts, oaths and the
 * wardens' voices. */

import { biquad, drone, fadeIn, fm, gain, hiss, lfo, modal, MODES, noise, tone, vocal } from "../synth";
import { cueKit, type CueDef } from "../types";
import { rand } from "../util";
import { atAbs, coins, creak, eventsIn, heartbeat, sparkle, thump, toll, whoosh } from "./recipes";

const { one, loop } = cueKit("run");

const big = { priority: 1, reverb: 0.45, maxInstances: 1, pitchVar: 0.01 };

export const RUN_CUES: Record<string, CueDef> = {
  portal_hum_loop: loop((s) => {
    const { ctx } = s;
    const out = fadeIn(s, 1, 1.2);
    drone(s, "sine", 55, 0.35, out);
    drone(s, "sine", 55.6, 0.35, out);
    const lp = biquad(ctx, "lowpass", 400 * s.pitch);
    lp.connect(out);
    drone(s, "triangle", 110.3, 0.2, lp);
    const bp = biquad(ctx, "bandpass", 700 * s.pitch, 3);
    lfo(s, bp.frequency, 0.2, 400, s.t, Infinity);
    bp.connect(out);
    hiss(s, "pink", 0.4, bp);
    for (const r of [1, 1.498, 1.75]) {
      const g = gain(ctx, 0.015);
      lfo(s, g.gain, rand(0.1, 0.3), 0.012, s.t, Infinity);
      g.connect(out);
      drone(s, "sine", 440 * r, 1, g);
    }
    return {
      tick(from, to) {
        eventsIn(from, to, 0.2, (t) => whoosh(atAbs(s, t, out), { d: rand(1.5, 3), f0: 200, f1: 900, q: 2, gain: 0.08, peakAt: 0.6 }));
      },
    };
  }, { priority: 0.8, reverb: 0.4, refDist: 3, maxDist: 50 }),

  descend: one((s) => {
    noise(s, { color: "pink", a: 0.1, d: 1.2, bp: 3000, bp1: 200, q: 1.5, gain: 0.38 });
    tone(s, { f: 220, f1: 40, d: 1.4, gain: 0.3 });
    noise(s, { a: 0.6, d: 0.05, hp: 3000, gain: 0.12 });
    thump(s, { at: 0.7, f: 60, f1: 30, d: 0.8, gain: 0.5 });
    noise(s, { at: 0.7, color: "brown", a: 0.05, d: 1.2, lp: 200, gain: 0.35 });
    return 2;
  }, big),
  ascend: one((s) => {
    noise(s, { color: "pink", a: 0.8, d: 0.4, bp: 300, bp1: 4000, fs: 1.2, q: 1.2, gain: 0.3 });
    for (const [f, k] of [[220, 1], [330, 0.8], [440, 0.6]] as const) tone(s, { f, f1: f * 2, sweep: 1, a: 0.6, d: 0.8, gain: 0.1 * k });
    modal(s, { at: 0.9, f: 880, modes: MODES.chime, d: 1.2, gain: 0.14, strike: 0.2 });
    sparkle(s, { at: 0.8, n: 8, span: 0.8, fLo: 3000, fHi: 7000, gain: 0.03 });
    return 2.4;
  }, big),
  arrival: one((s) => {
    noise(s, { color: "pink", a: 0.35, d: 0.04, bp: 400, bp1: 2500, fs: 0.38, q: 1.2, gain: 0.3 });
    thump(s, { at: 0.37, f: 70, f1: 35, d: 0.5, gain: 0.55 });
    noise(s, { at: 0.37, color: "brown", d: 0.4, lp: 600, gain: 0.3 });
    tone(s, { at: 0.37, f: 55, a: 0.02, d: 1.2, gain: 0.15 });
    return 1.7;
  }, big),
  reliquary_open: one((s) => {
    creak(s, { d: 0.9, f: [[0, 35], [0.9, 55]], gain: 0.32, res: [400, 950, 1900] });
    thump(s, { at: 0.85, f: 100, f1: 55, d: 0.2, gain: 0.35 });
    for (const [f, v] of [[220, "oo"], [256.7, "o"], [330, "oo"]] as const) {
      vocal(s, { at: 0.5, f0: f, vowel: [[0, v], [1.2, "a"]], d: 1.6, a: 0.5, r: 0.8, gain: 0.07, breath: 0.5, vib: [4, 10] });
    }
    coins(s, { at: 0.9, n: 4, span: 0.4, gain: 0.08 });
    return 2.3;
  }, { ...big, priority: 0.85, reverb: 0.4 }),
  presence_heartbeat: one((s) => {
    heartbeat(s, { gain: 0.55, lp: 170 });
    // The other heart: lower, further, never quite in step.
    heartbeat(s, { at: rand(0.1, 0.2), gain: 0.4, lp: 110, f: 55, gap: rand(0.24, 0.33) });
    tone(s, { f: 36, a: 0.1, d: 0.8, gain: 0.1 });
    return 0.95;
  }, { priority: 0.75, reverb: 0.4, maxInstances: 2, pitchVar: 0.02, refDist: 20, maxDist: 200 }),
  pact_formed: one((s) => {
    modal(s, { f: 392, modes: MODES.chime, d: 2, gain: 0.14, strike: 0.2 });
    fm(s, { f: 415, f1: 392, sweep: 0.8, ratio: 2.76, index: 0.6, index1: 0.1, a: 0.02, d: 2, gain: 0.1 });
    for (const [f, k] of [[196, 1], [294, 0.8], [392, 0.6]] as const) tone(s, { at: 0.7, f, a: 0.4, h: 0.4, d: 1.3, gain: 0.08 * k, vib: [4, 6] });
    return 2.8;
  }, big),
  oath_broken: one((s) => {
    toll(s, { f: 196, d: 2.5, gain: 0.26, spread: 0.04 });
    modal(s, { f: 196 * 1.03, modes: MODES.bell, d: 1.8, gain: 0.12, max: 5 });
    noise(s, { d: 0.05, hp: 1500, gain: 0.4, drive: 3 });
    vocal(s, { at: 0.2, f0: [[0, 70], [1.4, 52]], vowel: [[0, "o"], [1.2, "u"]], d: 1.4, a: 0.9, r: 0.25, gain: 0.22, growl: 0.5, breath: 0.3, shift: 0.7 });
    return 3;
  }, big),
  warden_roar: one((s) => {
    vocal(s, {
      f0: [[0, 70], [0.3, 95], [1.4, 60], [2.0, 45]],
      vowel: [[0, "a"], [0.8, "o"], [1.8, "u"]],
      d: 2.1,
      a: 0.15,
      r: 0.6,
      gain: 0.45,
      breath: 0.35,
      growl: 0.8,
      sub: 0.7,
      jitter: 60,
      shift: 0.55,
      drive: 3,
      bw: 1.8,
    });
    noise(s, { color: "brown", a: 0.1, d: 1.8, lp: 300, gain: 0.5 });
    noise(s, { color: "pink", a: 0.2, d: 1.4, bp: 1200, bp1: 600, q: 1, gain: 0.18 });
    thump(s, { f: 50, f1: 30, d: 1.2, gain: 0.45 });
    return 2.3;
  }, { priority: 1, reverb: 0.5, refDist: 10, maxDist: 200, maxInstances: 2, pitchVar: 0.05 }),
  warden_phase: one((s) => {
    thump(s, { f: 45, f1: 25, d: 1.5, gain: 0.7 });
    for (const f of [110, 116.5, 155.6]) tone(s, { f, type: "sawtooth", a: 1.2, d: 0.4, gain: 0.09, lp: 200, lp1: 2200, fs: 1.3 });
    noise(s, { a: 0.3, d: 1.0, bp: 2000, bp1: 5000, q: 8, gain: 0.2 });
    fm(s, { at: 0.2, f: 330, ratio: 1.41, index: 6, index1: 1, a: 0.5, d: 1.2, gain: 0.08 });
    return 2.2;
  }, { priority: 1, reverb: 0.5, refDist: 10, maxDist: 200, maxInstances: 1, pitchVar: 0.01 }),
};

