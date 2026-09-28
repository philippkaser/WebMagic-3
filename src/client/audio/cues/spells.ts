/** Spell cues: casts and impacts per element, explosions, beams, singularities
 * and elemental reactions. Casts are the moment the spell leaves the hand
 * (whoosh + elemental signature); impacts are transient + body + tail. */

import { biquad, crackle, drone, fadeIn, fm, gain, hiss, lfo, MODES, noise, tone, type Syn } from "../synth";
import { cueKit, type CueDef } from "../types";
import { pick, rand } from "../util";
import { atAbs, bubbles, eventsIn, explosion, shards, sizzleLayer, sparkle, thump, whoosh, zap } from "./recipes";

const { one, cached, loop } = cueKit("spells");

const cast = { priority: 0.65, reverb: 0.3, maxInstances: 5 };
const hit = { priority: 0.6, reverb: 0.3, maxInstances: 6 };

export const SPELL_CUES: Record<string, CueDef> = {
  // ── Casts ──────────────────────────────────────────────────────────────────
  cast_arcane: cached(4, 1.2, (s) => {
    const r = pick([1, 1.059, 0.944]);
    whoosh(s, { d: 0.35, f0: 600, f1: 2600, q: 1.5, gain: 0.25 });
    fm(s, { f: 440 * r, f1: 880 * r, sweep: 0.22, ratio: 1.5, index: 3, index1: 0.3, a: 0.01, d: 0.5, gain: 0.22 });
    tone(s, { at: 0.03, f: 622 * r, f1: 1245 * r, sweep: 0.2, type: "triangle", d: 0.4, gain: 0.1, vib: [7, 30] });
    sparkle(s, { at: 0.05, n: 6, span: 0.3, fLo: 2500, fHi: 6000, gain: 0.05 });
    return 0.8;
  }, cast),
  cast_fire: cached(4, 1.2, (s) => {
    noise(s, { color: "pink", a: 0.05, h: 0.05, d: 0.35, bp: 300, bp1: 1800, fs: 0.15, q: 0.8, gain: 0.55 });
    crackle(s, { at: 0.03, d: 0.5, density: 120, hp: 1500, gain: 0.28 });
    thump(s, { f: 120, f1: 50, d: 0.25, gain: 0.35 });
    noise(s, { a: 0.01, d: 0.25, hp: 3000, gain: 0.07 });
    return 0.7;
  }, cast),
  cast_frost: cached(4, 1.2, (s) => {
    noise(s, { a: 0.02, d: 0.4, bp: 5000, bp1: 2500, q: 1.5, gain: 0.3 });
    shards(s, { n: 5, span: 0.25, fLo: 2400, fHi: 5200, modes: MODES.ice, d: 0.25, gain: 0.08 });
    fm(s, { f: 1760, f1: 1320, ratio: 3.5, index: 2, index1: 0, d: 0.6, gain: 0.09, a: 0.005 });
    tone(s, { f: 220, f1: 180, type: "triangle", d: 0.3, gain: 0.14, lp: 800 });
    return 0.8;
  }, cast),
  cast_storm: cached(4, 1.2, (s) => {
    zap(s, { d: 0.18, f: 90, gain: 0.28 });
    zap(s, { at: 0.07, d: 0.12, f: 140, gain: 0.18, pan: rand(-0.3, 0.3) });
    crackle(s, { d: 0.35, density: 600, hp: 2000, gain: 0.3 });
    tone(s, { type: "sawtooth", f: 60, f1: 120, d: 0.35, gain: 0.1, lp: 900, drive: 3 });
    noise(s, { d: 0.06, hp: 5000, gain: 0.2 });
    return 0.5;
  }, cast),
  cast_void: cached(4, 1.4, (s) => {
    noise(s, { color: "pink", a: 0.28, d: 0.06, bp: 300, bp1: 2500, fs: 0.3, q: 2, gain: 0.4 });
    tone(s, { f: 180, f1: 45, sweep: 0.35, a: 0.2, h: 0.05, d: 0.3, gain: 0.35 });
    tone(s, { at: 0.26, f: 90, f1: 30, d: 0.45, gain: 0.3, type: "triangle", drive: 2 });
    fm(s, { f: 110, f1: 70, ratio: 0.5, index: 4, a: 0.2, d: 0.35, gain: 0.12, lp: 600 });
    return 0.9;
  }, cast),
  cast_venom: cached(4, 1.2, (s) => {
    bubbles(s, { n: 7, span: 0.3, fLo: 300, fHi: 900, gain: 0.16 });
    noise(s, { a: 0.02, d: 0.35, bp: 3500, q: 3, gain: 0.2 });
    noise(s, { color: "pink", d: 0.15, lp: 900, lp1: 300, gain: 0.35 });
    tone(s, { f: 330, f1: 311, type: "triangle", d: 0.3, gain: 0.08, vib: [9, 40] });
    tone(s, { f: 349, f1: 330, type: "triangle", d: 0.3, gain: 0.06, vib: [7, 30] });
    return 0.6;
  }, cast),
  cast_force: cached(4, 1, (s) => {
    thump(s, { f: 140, f1: 45, d: 0.3, gain: 0.6, click: 0.3 });
    whoosh(s, { d: 0.25, f0: 300, f1: 1500, q: 0.8, gain: 0.4, peakAt: 0.25 });
    noise(s, { color: "brown", d: 0.2, lp: 600, gain: 0.35 });
    return 0.4;
  }, cast),

  // ── Impacts ────────────────────────────────────────────────────────────────
  hit_arcane: cached(4, 1, (s) => {
    thump(s, { f: 160, f1: 70, d: 0.15, gain: 0.35 });
    fm(s, { f: 880, ratio: 1.414, index: 4, index1: 0, d: 0.5, gain: 0.14 });
    sparkle(s, { n: 8, span: 0.15, fLo: 2000, fHi: 7000, gain: 0.07 });
    noise(s, { d: 0.08, bp: 3000, q: 1, gain: 0.22 });
    return 0.7;
  }, hit),
  hit_fire: cached(4, 1.2, (s) => {
    noise(s, { color: "pink", d: 0.35, lp: 3000, lp1: 400, gain: 0.55 });
    thump(s, { f: 100, f1: 45, d: 0.2, gain: 0.35 });
    crackle(s, { d: 0.6, density: 150, hp: 1200, gain: 0.3 });
    return 0.7;
  }, hit),
  hit_frost: cached(4, 1, (s) => {
    noise(s, { d: 0.02, hp: 2000, gain: 0.5 });
    shards(s, { n: 8, span: 0.3, fLo: 2000, fHi: 6000, modes: MODES.ice, d: 0.3, gain: 0.08 });
    noise(s, { at: 0.01, d: 0.3, bp: 6000, q: 2, gain: 0.12 });
    thump(s, { f: 200, f1: 90, d: 0.1, gain: 0.25 });
    return 0.7;
  }, hit),
  hit_storm: cached(4, 1, (s) => {
    noise(s, { d: 0.04, hp: 800, gain: 0.5, drive: 3 });
    zap(s, { d: 0.15, f: 70, gain: 0.26 });
    crackle(s, { at: 0.02, d: 0.4, density: 400, hp: 2500, gain: 0.3 });
    thump(s, { f: 90, f1: 40, d: 0.25, gain: 0.35 });
    return 0.5;
  }, hit),
  hit_void: cached(4, 1, (s) => {
    tone(s, { f: 200, f1: 30, sweep: 0.25, d: 0.4, gain: 0.5 });
    noise(s, { color: "pink", a: 0.08, d: 0.05, bp: 2000, bp1: 200, q: 3, gain: 0.3 });
    fm(s, { f: 55, ratio: 1.5, index: 5, index1: 0, d: 0.5, gain: 0.2, lp: 500 });
    return 0.6;
  }, hit),
  hit_venom: cached(4, 1, (s) => {
    noise(s, { color: "pink", d: 0.12, bp: 1400, bp1: 500, q: 1.5, gain: 0.5 });
    bubbles(s, { at: 0.05, n: 6, span: 0.35, fLo: 250, fHi: 700, gain: 0.12 });
    noise(s, { a: 0.05, d: 0.5, hp: 4000, gain: 0.08 });
    thump(s, { f: 120, f1: 60, d: 0.12, gain: 0.3 });
    return 0.6;
  }, hit),
  hit_force: cached(4, 1, (s) => {
    thump(s, { f: 120, f1: 40, d: 0.28, gain: 0.7, click: 0.4 });
    noise(s, { color: "brown", d: 0.18, lp: 1500, lp1: 200, gain: 0.5 });
    noise(s, { d: 0.03, bp: 2500, q: 0.8, gain: 0.3 });
    return 0.35;
  }, hit),

  // ── Explosions ─────────────────────────────────────────────────────────────
  explosion_small: one((s) => explosion(s, 0.2), { priority: 0.8, reverb: 0.4, refDist: 3, maxDist: 70, maxInstances: 3 }),
  explosion_medium: one((s) => explosion(s, 0.55), { priority: 0.9, reverb: 0.45, refDist: 5, maxDist: 100, maxInstances: 3 }),
  explosion_large: one((s) => explosion(s, 1), { priority: 1, reverb: 0.5, refDist: 8, maxDist: 150, maxInstances: 2 }),

  // ── Sustained / multi-part ─────────────────────────────────────────────────
  beam_loop: loop((s) => {
    const { ctx } = s;
    const out = fadeIn(s, 1, 0.08);
    const am = gain(ctx, 0.75);
    lfo(s, am.gain, 23, 0.25, s.t, Infinity);
    const bp = biquad(ctx, "bandpass", 900 * s.pitch, 2);
    lfo(s, bp.frequency, 0.7, 400, s.t, Infinity);
    bp.connect(am).connect(out);
    drone(s, "sawtooth", 110, 0.35, bp);
    drone(s, "sawtooth", 110.7, 0.35, bp);
    drone(s, "sawtooth", 165.3, 0.2, bp);
    drone(s, "sine", 55, 0.25, out);
    const hp = biquad(ctx, "highpass", 3000);
    hp.connect(out);
    hiss(s, "white", 0.12, hp);
    crackle(s, { d: Infinity, density: 300, hp: 3000, gain: 0.2, loop: true, out });
    return {};
  }, { priority: 0.8, reverb: 0.25 }),

  black_hole_loop: loop((s) => {
    const { ctx } = s;
    const out = fadeIn(s, 1, 0.5);
    drone(s, "sine", 38, 0.45, out);
    drone(s, "sine", 38.4, 0.45, out);
    drone(s, "triangle", 57, 0.08, out);
    for (const [rate, lvl] of [[0.5, 0.4], [0.37, 0.3]] as const) {
      const bp = biquad(ctx, "bandpass", 1100 * s.pitch, 4);
      lfo(s, bp.frequency, rate, -900, s.t, Infinity, "sawtooth");
      bp.connect(out);
      hiss(s, "pink", lvl, bp);
    }
    return {
      tick(from, to) {
        eventsIn(from, to, 1.2, (t) => {
          const e = atAbs(s, t, out);
          if (Math.random() < 0.5) whoosh(e, { d: rand(0.3, 0.7), f0: rand(2000, 4000), f1: rand(150, 300), q: 3, gain: 0.12, peakAt: 0.7 });
          else crackle(e, { d: 0.25, density: 400, hp: 2500, gain: 0.12 });
        });
      },
      stop(t) {
        out.gain.cancelScheduledValues(t);
        out.gain.setValueAtTime(out.gain.value, t);
        out.gain.linearRampToValueAtTime(0, t + 0.3);
        const e = atAbs(s, t);
        thump(e, { f: 70, f1: 25, d: 0.8, gain: 0.7 });
        noise(e, { color: "pink", a: 0.02, d: 0.6, bp: 200, bp1: 2000, q: 1, gain: 0.25 });
        return 0.9;
      },
    };
  }, { priority: 0.9, reverb: 0.45, refDist: 4, maxDist: 80 }),

  chain_lightning: one((s: Syn) => {
    const n = 4 + Math.floor(rand(0, 2));
    let t = 0;
    for (let i = 0; i < n; i++) {
      zap(s, { at: t, d: rand(0.08, 0.14), f: rand(60, 160), gain: 0.26, pan: rand(-0.6, 0.6) });
      noise(s, { at: t, d: 0.02, hp: 1500, gain: 0.35 });
      t += rand(0.05, 0.09);
    }
    crackle(s, { d: t + 0.3, density: 700, hp: 2500, gain: 0.3 });
    thump(s, { at: t, f: 80, f1: 35, d: 0.3, gain: 0.35 });
    return t + 0.4;
  }, { priority: 0.75, reverb: 0.35, maxInstances: 3 }),

  freeze: one((s) => {
    noise(s, { a: 0.15, d: 0.5, bp: 2000, bp1: 6000, fs: 0.4, q: 2, gain: 0.22 });
    crackle(s, { d: 0.7, density: 500, hp: 3000, gain: 0.3 });
    shards(s, { n: 10, span: 0.6, skew: 0.7, fLo: 2000, fHi: 5000, modes: MODES.ice, d: 0.3, gain: 0.08 });
    tone(s, { f: 80, f1: 60, d: 0.5, lp: 300, gain: 0.25, type: "triangle" });
    return 0.95;
  }, { priority: 0.6, reverb: 0.4 }),

  ignite: one((s) => {
    noise(s, { color: "pink", a: 0.06, d: 0.5, lp: 500, lp1: 3500, fs: 0.1, gain: 0.5 });
    thump(s, { f: 80, f1: 40, d: 0.3, gain: 0.3 });
    crackle(s, { at: 0.05, d: 0.9, density: 90, hp: 1000, gain: 0.3 });
    return 1;
  }, { priority: 0.55, reverb: 0.3 }),

  shatter_ice: one((s) => {
    noise(s, { d: 0.03, hp: 1500, gain: 0.5 });
    shards(s, { n: 18, span: 0.7, skew: 1.8, fLo: 1800, fHi: 7000, modes: MODES.ice, d: 0.35, gain: 0.07 });
    noise(s, { d: 0.4, bp: 5000, q: 0.8, gain: 0.15 });
    thump(s, { f: 150, f1: 70, d: 0.12, gain: 0.3 });
    return 1.1;
  }, { priority: 0.6, reverb: 0.4, maxInstances: 4 }),

  splash: one((s) => {
    noise(s, { color: "pink", d: 0.25, bp: 1200, bp1: 600, q: 0.8, gain: 0.45 });
    noise(s, { d: 0.15, hp: 3000, gain: 0.15 });
    bubbles(s, { n: 10, span: 0.5, fLo: 400, fHi: 1400, gain: 0.1, skew: 1.5 });
    bubbles(s, { at: 0.3, n: 5, span: 0.6, fLo: 900, fHi: 2000, gain: 0.05 });
    return 1;
  }, { priority: 0.45, reverb: 0.35 }),

  sizzle: one((s) => {
    sizzleLayer(s, { d: 0.9, gain: 0.25 });
    crackle(s, { d: 1, density: 300, hp: 2000, gain: 0.3 });
    noise(s, { color: "pink", a: 0.05, d: 0.6, bp: 800, bp1: 1600, q: 1, gain: 0.12 });
    return 1.05;
  }, { priority: 0.4, reverb: 0.25 }),
};
