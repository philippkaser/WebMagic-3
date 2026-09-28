/** Movement cues. Footsteps are pre-rendered (six variants per surface,
 * never the same one twice in a row, plus rate/level jitter) because they
 * fire several times a second for every walker on the floor. */

import { biquad, breathe, bubble, crackle, fadeIn, fm, gain, hiss, lfo, modal, MODES, noise, pluck, type Syn } from "../synth";
import { cueKit, type CueDef } from "../types";
import { chance, rand } from "../util";
import { bubbles, creak, eventsIn, pebbles, sparkle, thump } from "./recipes";

const { one, cached, loop } = cueKit("movement");

const step = { priority: 0.25, reverb: 0.15, maxInstances: 8, pitchVar: 0.06, refDist: 1.5, maxDist: 30, gain: 0.8 };

/** Stone / flagstone. */
function stone(s: Syn): number {
  noise(s, { d: 0.03, bp: rand(1800, 3000), q: 1, gain: 0.25 });
  thump(s, { f: rand(90, 120), f1: 60, d: 0.07, gain: 0.35 });
  noise(s, { color: "pink", at: 0.01, d: 0.06, bp: 700, q: 0.8, gain: 0.12 });
  pebbles(s, { at: 0.015, n: 3, span: 0.07, gain: 0.05, fLo: 4000, fHi: 6500 });
  return 0.16;
}

export const MOVEMENT_CUES: Record<string, CueDef> = {
  footstep_stone: cached(6, 0.5, stone, step),
  footstep_wood: cached(6, 0.9, (s) => {
    pluck(s, { f: rand(110, 170), mat: "wood", gain: 0.4 });
    thump(s, { f: 90, f1: 55, d: 0.08, gain: 0.3 });
    noise(s, { color: "pink", d: 0.03, bp: 1200, gain: 0.12 });
    if (chance(0.35)) creak(s, { at: 0.03, d: rand(0.2, 0.35), f: [[0, rand(35, 50)], [0.25, rand(50, 70)]], gain: 0.08 });
    return 0.4;
  }, step),
  footstep_water: cached(6, 0.6, (s) => {
    noise(s, { color: "pink", d: 0.12, bp: rand(700, 1100), bp1: 400, q: 1, gain: 0.35 });
    noise(s, { at: 0.01, d: 0.08, hp: 2500, gain: 0.12 });
    bubbles(s, { n: 3, span: 0.12, fLo: 500, fHi: 1200, gain: 0.08 });
    thump(s, { f: 80, f1: 50, d: 0.06, gain: 0.2 });
    return 0.3;
  }, step),
  footstep_metal: cached(6, 0.6, (s) => {
    modal(s, { f: rand(300, 450), modes: MODES.metal, d: 0.25, gain: 0.2, strike: 0.5, max: 6 });
    thump(s, { f: 110, f1: 70, d: 0.06, gain: 0.3 });
    noise(s, { d: 0.015, hp: 3000, gain: 0.15 });
    return 0.3;
  }, step),
  footstep_snow: cached(6, 0.5, (s) => {
    crackle(s, { d: 0.15, density: 1800, bp: 2500, q: 0.6, gain: 0.55, a: 0.02 });
    noise(s, { color: "pink", d: 0.12, lp: 1200, gain: 0.15, a: 0.02 });
    thump(s, { f: 70, f1: 45, d: 0.08, gain: 0.2 });
    return 0.2;
  }, step),
  footstep_flesh: cached(6, 0.6, (s) => {
    noise(s, { color: "pink", d: 0.14, bp: 500, bp1: 1200, q: 3, gain: 0.32 });
    thump(s, { f: 70, f1: 40, d: 0.1, gain: 0.3 });
    bubble(s, rand(200, 350), 0.06, 0.05, 0.1);
    noise(s, { color: "pink", at: 0.08, d: 0.08, bp: 1500, bp1: 700, q: 5, gain: 0.12 });
    return 0.25;
  }, step),
  footstep_dirt: cached(6, 0.5, (s) => {
    noise(s, { color: "pink", d: 0.08, lp: 900, gain: 0.3 });
    thump(s, { f: 80, f1: 50, d: 0.07, gain: 0.3 });
    crackle(s, { d: 0.06, density: 900, bp: 3000, gain: 0.15 });
    return 0.15;
  }, step),

  jump: one((s) => {
    noise(s, { color: "pink", a: 0.05, d: 0.15, bp: 800, bp1: 2000, q: 1.5, gain: 0.22 });
    breathe(s, { vowel: "uh", d: 0.16, a: 0.02, gain: 0.1, hp: 700 });
    return 0.22;
  }, { priority: 0.4, reverb: 0.1, maxInstances: 2 }),
  land: one((s) => {
    thump(s, { f: 90, f1: 45, d: 0.12, gain: 0.45 });
    noise(s, { color: "pink", d: 0.08, lp: 1500, gain: 0.25 });
    noise(s, { color: "pink", at: 0.02, d: 0.1, bp: 2000, q: 1, gain: 0.08 });
    return 0.2;
  }, { priority: 0.45, reverb: 0.15, maxInstances: 3 }),
  land_heavy: one((s) => {
    thump(s, { f: 75, f1: 30, d: 0.35, gain: 0.7, click: 0.3 });
    noise(s, { color: "brown", d: 0.3, lp: 400, gain: 0.5 });
    pebbles(s, { at: 0.05, n: 6, span: 0.4, gain: 0.08 });
    breathe(s, { at: 0.02, vowel: [[0, "uh"], [0.1, "er"]], d: 0.2, a: 0.01, gain: 0.12, hp: 400 });
    return 0.55;
  }, { priority: 0.6, reverb: 0.2, maxInstances: 2 }),
  dash: one((s) => {
    noise(s, { color: "pink", a: 0.04, d: 0.22, bp: 400, bp1: 3500, fs: 0.15, q: 1.2, gain: 0.42 });
    fm(s, { f: 660, f1: 1320, ratio: 2, index: 2, index1: 0, d: 0.25, gain: 0.07 });
    sparkle(s, { at: 0.05, n: 3, span: 0.15, fLo: 3000, fHi: 5000, gain: 0.03 });
    return 0.35;
  }, { priority: 0.6, reverb: 0.2, maxInstances: 2 }),
  glide_loop: loop((s) => {
    const { ctx } = s;
    const out = fadeIn(s, 1, 0.3);
    const am = gain(ctx, 0.7);
    lfo(s, am.gain, rand(9, 13), 0.3, s.t, Infinity, "triangle");
    const bp = biquad(ctx, "bandpass", 900 * s.pitch, 0.8);
    bp.connect(am).connect(out);
    hiss(s, "pink", 0.6, bp);
    const lp = biquad(ctx, "lowpass", 300 * s.pitch);
    lp.connect(out);
    hiss(s, "brown", 0.5, lp);
    return {
      tick(from, to) {
        eventsIn(from, to, 0.5, (t) => {
          bp.frequency.setTargetAtTime(rand(600, 1500) * s.pitch, t, 0.4);
          am.gain.setTargetAtTime(rand(0.5, 0.9), t, 0.3);
        });
      },
    };
  }, { priority: 0.8, reverb: 0.1 }),
  splash_in: one((s) => {
    thump(s, { f: 70, f1: 30, d: 0.35, gain: 0.5 });
    noise(s, { color: "pink", d: 0.4, bp: 900, bp1: 300, q: 0.7, gain: 0.45 });
    bubbles(s, { at: 0.05, n: 18, span: 0.9, fLo: 200, fHi: 900, gain: 0.12, skew: 1.4 });
    noise(s, { d: 0.2, hp: 2500, gain: 0.2 });
    return 1.1;
  }, { priority: 0.6, reverb: 0.3, maxInstances: 3 }),
};

