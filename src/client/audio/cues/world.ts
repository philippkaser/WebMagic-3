/** World & prop cues: breakables, fire and water loops, mechanisms and traps.
 * Loops with random texture (fire flare-ups, lava blops, gusts, grinding
 * teeth) schedule it in `tick`, so they never cycle audibly. */

import { biquad, crackle, drone, fadeIn, gain, hiss, lfo, modal, MODES, noise, pluck, tone, bubble } from "../synth";
import { cueKit, type CueDef } from "../types";
import { rand } from "../util";
import {
  atAbs,
  bubbles,
  clatter,
  creak,
  eventsIn,
  explosion,
  pebbles,
  shards,
  sizzleLayer,
  splinters,
  thump,
  whoosh,
} from "./recipes";

const { one, cached, loop } = cueKit("world");

const brk = { priority: 0.6, reverb: 0.3, maxInstances: 4 };
const mech = { priority: 0.55, reverb: 0.3, maxInstances: 4 };

export const WORLD_CUES: Record<string, CueDef> = {
  // ── Breakables ─────────────────────────────────────────────────────────────
  crate_break: one((s) => {
    noise(s, { d: 0.03, bp: 1800, q: 0.7, gain: 0.5 });
    pluck(s, { f: rand(140, 220), mat: "wood", gain: 0.45 });
    pluck(s, { at: 0.02, f: rand(250, 380), mat: "wood", gain: 0.3 });
    splinters(s, { at: 0.02, n: 10, span: 0.5, gain: 0.15 });
    thump(s, { f: 100, f1: 50, d: 0.15, gain: 0.35 });
    clatter(s, { at: 0.15, n: 4, span: 0.6, mat: "wood", fLo: 150, fHi: 300, gain: 0.25 });
    return 1;
  }, brk),
  barrel_break: one((s) => {
    noise(s, { d: 0.04, bp: 1200, q: 0.7, gain: 0.5 });
    pluck(s, { f: rand(90, 140), mat: "wood", gain: 0.5 });
    modal(s, { at: 0.02, f: rand(250, 350), modes: MODES.metal, d: 0.8, gain: 0.12, max: 5 });
    splinters(s, { at: 0.02, n: 8, span: 0.4, gain: 0.12 });
    clatter(s, { at: 0.12, n: 6, span: 0.7, mat: "wood", fLo: 120, fHi: 260, gain: 0.25 });
    thump(s, { f: 90, f1: 45, d: 0.18, gain: 0.4 });
    return 1.1;
  }, brk),
  pot_shatter: one((s) => {
    thump(s, { f: 180, f1: 90, d: 0.08, gain: 0.35 });
    noise(s, { d: 0.05, bp: 3000, gain: 0.35 });
    shards(s, { n: 14, span: 0.4, fLo: 1200, fHi: 4500, modes: MODES.ceramic, d: 0.15, gain: 0.1 });
    pebbles(s, { at: 0.1, n: 6, span: 0.5, gain: 0.08, fLo: 2000, fHi: 5000 });
    return 0.8;
  }, brk),
  glass_shatter: one((s) => {
    noise(s, { d: 0.06, hp: 2500, gain: 0.4 });
    shards(s, { n: 22, span: 0.8, skew: 1.6, fLo: 2500, fHi: 9000, modes: MODES.glass, d: 0.3, gain: 0.06 });
    noise(s, { d: 0.5, bp: 6000, q: 0.7, gain: 0.12 });
    return 1.2;
  }, brk),
  barrel_explode: one((s) => {
    explosion(s, 0.6);
    splinters(s, { at: 0.01, n: 14, span: 0.8, gain: 0.18 });
    noise(s, { color: "pink", a: 0.02, d: 0.8, bp: 400, bp1: 1500, q: 0.8, gain: 0.2 });
    crackle(s, { at: 0.1, d: 1.5, density: 120, hp: 1200, gain: 0.25 });
    return 2.5;
  }, { priority: 0.95, reverb: 0.45, refDist: 5, maxDist: 100, maxInstances: 3 }),
  oil_splash: one((s) => {
    noise(s, { color: "pink", d: 0.3, lp: 700, lp1: 250, gain: 0.5 });
    bubbles(s, { n: 5, span: 0.35, fLo: 120, fHi: 300, d: 0.09, gain: 0.2 });
    noise(s, { color: "pink", at: 0.05, d: 0.25, bp: 400, q: 3, gain: 0.2 });
    return 0.55;
  }, { priority: 0.45, reverb: 0.25 }),

  // ── Fire & water loops ─────────────────────────────────────────────────────
  fire_crackle_loop: loop((s) => {
    const { ctx } = s;
    const out = fadeIn(s, 1, 0.5);
    const roar = gain(ctx, 0.9);
    lfo(s, roar.gain, rand(0.25, 0.4), 0.2, s.t, Infinity);
    const lp = biquad(ctx, "lowpass", 380 * s.pitch);
    lp.connect(roar).connect(out);
    hiss(s, "brown", 1, lp);
    crackle(s, { d: Infinity, density: 60, hp: 1200, gain: 0.5, loop: true, out });
    crackle(s, { d: Infinity, density: 18, bp: 700, q: 0.8, gain: 0.45, loop: true, out, rate: 0.8 });
    const hp = biquad(ctx, "highpass", 5000);
    hp.connect(out);
    hiss(s, "white", 0.03, hp);
    return {
      tick(from, to) {
        eventsIn(from, to, 0.5, (t) => noise(atAbs(s, t, out), { color: "pink", a: 0.15, d: 0.6, bp: 500, bp1: 1300, q: 0.8, gain: 0.14 }));
      },
    };
  }, { priority: 0.6, reverb: 0.2, refDist: 2, maxDist: 35 }),
  torch_loop: loop((s) => {
    const { ctx } = s;
    const out = fadeIn(s, 1, 0.4);
    const fl = gain(ctx, 0.6);
    lfo(s, fl.gain, rand(3, 5), 0.18, s.t, Infinity, "triangle");
    const lp = biquad(ctx, "lowpass", 520 * s.pitch);
    lp.connect(fl).connect(out);
    hiss(s, "brown", 0.8, lp);
    crackle(s, { d: Infinity, density: 12, hp: 1500, gain: 0.35, loop: true, out });
    return {
      tick(from, to) {
        eventsIn(from, to, 0.35, (t) => whoosh(atAbs(s, t, out), { d: rand(0.3, 0.6), f0: 300, f1: 900, q: 1, gain: 0.08 }));
      },
    };
  }, { priority: 0.4, reverb: 0.2, refDist: 1.5, maxDist: 20 }),
  candle_snuff: one((s) => {
    noise(s, { color: "pink", a: 0.02, d: 0.2, bp: 900, bp1: 400, q: 1.5, gain: 0.35 });
    noise(s, { at: 0.05, d: 0.15, hp: 4000, gain: 0.05 });
    tone(s, { at: 0.08, f: 1400, f1: 1800, a: 0.1, d: 0.5, gain: 0.02 });
    return 0.65;
  }, { priority: 0.4, reverb: 0.3, refDist: 1.5, maxDist: 25 }),
  water_drip: cached(6, 0.6, (s) => {
    bubble(s, rand(900, 1600), 0, 0.06, 0.4);
    noise(s, { d: 0.005, hp: 3000, gain: 0.1 });
    tone(s, { at: 0.01, f: rand(1400, 2200), d: 0.12, gain: 0.08 });
    return 0.15;
  }, { priority: 0.3, reverb: 0.6, maxInstances: 6, pitchVar: 0.15, maxDist: 40 }),
  bubbling_loop: loop((s) => {
    const { ctx } = s;
    const out = fadeIn(s, 1, 0.4);
    const lp = biquad(ctx, "lowpass", 400 * s.pitch);
    lp.connect(out);
    hiss(s, "brown", 0.25, lp);
    return {
      tick(from, to) {
        eventsIn(from, to, 7, (t) => bubble(atAbs(s, t, out), rand(150, 600), 0, rand(0.03, 0.07), rand(0.05, 0.2)));
        eventsIn(from, to, 0.7, (t) => {
          const e = atAbs(s, t, out);
          bubble(e, rand(80, 140), 0, 0.12, 0.35);
          noise(e, { color: "pink", d: 0.1, bp: 350, q: 2, gain: 0.12 });
        });
      },
    };
  }, { priority: 0.4, reverb: 0.3, maxDist: 30 }),
  lava_loop: loop((s) => {
    const { ctx } = s;
    const out = fadeIn(s, 1, 0.6);
    const lp = biquad(ctx, "lowpass", 180 * s.pitch);
    const sw = gain(ctx, 0.8);
    lfo(s, sw.gain, 0.13, 0.2, s.t, Infinity);
    lp.connect(sw).connect(out);
    hiss(s, "brown", 1, lp, 0.7);
    crackle(s, { d: Infinity, density: 25, hp: 2000, gain: 0.15, loop: true, out });
    return {
      tick(from, to) {
        eventsIn(from, to, 1.6, (t) => {
          const e = atAbs(s, t, out);
          bubble(e, rand(55, 140), 0, rand(0.1, 0.2), rand(0.25, 0.5));
          noise(e, { color: "pink", at: 0.05, d: 0.15, bp: 300, bp1: 150, q: 2, gain: 0.18 });
          if (Math.random() < 0.3) sizzleLayer(e, { at: 0.1, d: 0.4, gain: 0.08 });
        });
      },
    };
  }, { priority: 0.5, reverb: 0.3, refDist: 3, maxDist: 45 }),
  wind_loop: loop((s) => {
    const { ctx } = s;
    const out = fadeIn(s, 1, 1);
    const bp = biquad(ctx, "bandpass", 500 * s.pitch, 0.7);
    const g = gain(ctx, 0.7);
    bp.connect(g).connect(out);
    hiss(s, "pink", 1, bp);
    const wh = biquad(ctx, "bandpass", 1400 * s.pitch, 25);
    const wg = gain(ctx, 0.25);
    wh.connect(wg).connect(out);
    hiss(s, "white", 1, wh);
    return {
      tick(from, to) {
        eventsIn(from, to, 0.35, (t) => {
          bp.frequency.setTargetAtTime(rand(300, 1100) * s.pitch, t, rand(0.6, 1.5));
          g.gain.setTargetAtTime(rand(0.35, 1), t, rand(0.5, 1.2));
          wh.frequency.setTargetAtTime(rand(900, 2200) * s.pitch, t, 1);
          wg.gain.setTargetAtTime(rand(0, 0.35), t, 0.8);
        });
      },
    };
  }, { priority: 0.4, reverb: 0.2, refDist: 4, maxDist: 60 }),

  // ── Mechanisms ─────────────────────────────────────────────────────────────
  door_creak: one((s) => {
    const d = rand(1.1, 1.6);
    creak(s, { d, f: [[0, rand(30, 45)], [d * 0.4, rand(70, 95)], [d, rand(40, 55)]], gain: 0.35 });
    noise(s, { color: "brown", a: 0.1, d, lp: 300, gain: 0.12 });
    thump(s, { at: d - 0.05, f: 110, f1: 60, d: 0.15, gain: 0.35 });
    pluck(s, { at: d - 0.05, f: 140, mat: "wood", gain: 0.3 });
    return d + 0.3;
  }, mech),
  lever: one((s) => {
    for (let i = 0; i < 5; i++) noise(s, { at: i * 0.04, d: 0.006, bp: 3000, q: 4, gain: 0.3 });
    noise(s, { color: "brown", a: 0.05, d: 0.2, bp: 500, q: 1, gain: 0.25 });
    thump(s, { at: 0.22, f: 120, f1: 60, d: 0.15, gain: 0.5 });
    modal(s, { at: 0.22, f: 220, modes: MODES.metal, d: 0.4, gain: 0.15, max: 5 });
    return 0.7;
  }, mech),
  chain_rattle: one((s) => {
    for (let i = 0; i < 14; i++) {
      const t = Math.pow(Math.random(), 0.8) * 0.7;
      modal(s, { at: t, f: rand(1800, 3500), modes: [[1, 1, 1], [2.7, 0.5, 0.5]], d: 0.06, gain: rand(0.04, 0.12), pan: rand(-0.3, 0.3) });
    }
    noise(s, { a: 0.05, d: 0.5, bp: 5000, q: 1, gain: 0.06 });
    return 0.85;
  }, mech),
  gear_grind_loop: loop((s) => {
    const { ctx } = s;
    const out = fadeIn(s, 1, 0.5);
    const am = gain(ctx, 0.6);
    lfo(s, am.gain, rand(12, 16), 0.4, s.t, Infinity, "square");
    const bp = biquad(ctx, "bandpass", 260 * s.pitch, 3);
    bp.connect(am).connect(out);
    hiss(s, "brown", 1.2, bp);
    const groan = biquad(ctx, "bandpass", 420 * s.pitch, 5);
    groan.connect(out);
    drone(s, "sawtooth", 55, 0.18, groan);
    return {
      tick(from, to) {
        eventsIn(from, to, 1.1, (t) => {
          const e = atAbs(s, t, out);
          thump(e, { f: rand(80, 100), f1: 50, d: 0.1, gain: 0.3 });
          modal(e, { f: rand(300, 500), modes: MODES.metal, d: 0.2, gain: 0.08, max: 4 });
        });
        eventsIn(from, to, 0.08, (t) => tone(atAbs(s, t, out), { f: rand(1600, 2400), a: 0.2, d: 0.6, gain: 0.03, vib: [6, 40] }));
      },
    };
  }, { priority: 0.5, reverb: 0.3, refDist: 3, maxDist: 45 }),
  pressure_plate_click: cached(4, 0.5, (s) => {
    noise(s, { d: 0.008, bp: 2500, q: 2, gain: 0.5 });
    thump(s, { at: 0.01, f: 150, f1: 80, d: 0.08, gain: 0.4 });
    noise(s, { color: "brown", at: 0.01, d: 0.1, lp: 600, gain: 0.25 });
    return 0.2;
  }, { ...mech, priority: 0.7 }),
  spike_trap: one((s) => {
    noise(s, { d: 0.006, bp: 2000, gain: 0.3 });
    for (let i = 0; i < 4; i++) noise(s, { at: 0.04 + i * 0.015, d: 0.12, bp: rand(4000, 6000), bp1: rand(2500, 3500), q: 5, gain: 0.28 });
    modal(s, { at: 0.04, f: 700, modes: MODES.metal, d: 0.35, gain: 0.15, max: 5 });
    thump(s, { at: 0.04, f: 150, f1: 70, d: 0.1, gain: 0.4 });
    return 0.5;
  }, { ...mech, priority: 0.8 }),
  dart_fire: cached(4, 0.6, (s) => {
    noise(s, { color: "pink", d: 0.06, bp: 1500, q: 1, gain: 0.45 });
    tone(s, { at: 0.02, f: 2800, f1: 1600, d: 0.25, gain: 0.07 });
    noise(s, { at: 0.02, d: 0.2, bp: 3500, bp1: 2000, q: 4, gain: 0.14 });
    return 0.3;
  }, { ...mech, priority: 0.7 }),
  blade_swing: one((s) => {
    noise(s, { color: "pink", a: 0.15, d: 0.2, bp: 500, bp1: 2500, fs: 0.15, q: 2, gain: 0.5 });
    tone(s, { f: 180, f1: 260, a: 0.12, d: 0.2, gain: 0.1 });
    noise(s, { at: 0.12, d: 0.1, hp: 5000, gain: 0.1 });
    return 0.4;
  }, { ...mech, priority: 0.7 }),
  boulder_roll_loop: loop((s) => {
    const { ctx } = s;
    const out = fadeIn(s, 1, 0.3);
    const roll = gain(ctx, 0.75);
    lfo(s, roll.gain, 2.5, 0.25, s.t, Infinity);
    const lp = biquad(ctx, "lowpass", 150 * s.pitch);
    lp.connect(roll).connect(out);
    hiss(s, "brown", 1.4, lp, 0.8);
    drone(s, "sine", 38, 0.2, out);
    return {
      tick(from, to) {
        eventsIn(from, to, 6, (t) => {
          const e = atAbs(s, t, out);
          if (Math.random() < 0.6) noise(e, { d: rand(0.01, 0.03), bp: rand(900, 2200), q: 2, gain: rand(0.05, 0.15) });
          else thump(e, { f: rand(60, 90), f1: 40, d: 0.08, gain: rand(0.15, 0.35) });
        });
      },
    };
  }, { priority: 0.9, reverb: 0.3, refDist: 4, maxDist: 60 }),
  gas_hiss: one((s) => {
    noise(s, { a: 0.05, h: 0.9, d: 0.6, hp: 2000, gain: 0.28 });
    noise(s, { color: "pink", a: 0.05, h: 0.6, d: 0.6, bp: 1200, q: 3, gain: 0.12 });
    for (let i = 0; i < 4; i++) noise(s, { at: rand(0.1, 1.2), d: 0.05, hp: 3000, gain: 0.08 });
    return 1.6;
  }, { ...mech, priority: 0.6 }),
  trap_arm: one((s) => {
    noise(s, { d: 0.006, bp: 3500, q: 3, gain: 0.35 });
    noise(s, { at: 0.08, d: 0.006, bp: 3000, q: 3, gain: 0.3 });
    creak(s, { at: 0.05, d: 0.3, f: [[0, 60], [0.3, 100]], gain: 0.2, res: [900, 2100, 3400] });
    modal(s, { at: 0.34, f: 900, modes: MODES.metal, d: 0.3, gain: 0.1, max: 4 });
    return 0.7;
  }, mech),
};
