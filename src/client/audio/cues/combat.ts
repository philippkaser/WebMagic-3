/** Combat & body cues: material hits (pre-rendered — they fire constantly),
 * the player's own hurt / death, crits, wards, healing, and the low-health
 * heartbeat (one lub-dub per call; the game sets the tempo). */

import { fm, modal, MODES, noise, pluck, tone, vocal } from "../synth";
import { cueKit, type CueDef } from "../types";
import { pick, rand } from "../util";
import { heartbeat, pebbles, sparkle, thump, toll } from "./recipes";

const { one, cached } = cueKit("combat");

const impact = { priority: 0.55, reverb: 0.22, maxInstances: 6, pitchVar: 0.06 };

export const COMBAT_CUES: Record<string, CueDef> = {
  hit_flesh: cached(6, 0.6, (s) => {
    thump(s, { f: rand(115, 145), f1: 60, d: 0.14, gain: 0.55 });
    noise(s, { color: "pink", d: 0.07, bp: rand(800, 1000), bp1: 400, q: 1.2, gain: 0.45 });
    noise(s, { color: "pink", at: 0.01, d: 0.15, bp: 500, bp1: 1500, q: 4, gain: 0.16 });
    return 0.25;
  }, impact),
  hit_bone: cached(6, 0.6, (s) => {
    pluck(s, { f: rand(500, 900), mat: "bone", gain: 0.45 });
    noise(s, { d: 0.01, hp: 2000, gain: 0.3 });
    modal(s, { f: rand(900, 1300), modes: MODES.wood, d: 0.08, gain: 0.15 });
    thump(s, { f: 150, f1: 80, d: 0.08, gain: 0.22 });
    return 0.2;
  }, impact),
  hit_metal: cached(6, 1.4, (s) => {
    modal(s, { f: rand(350, 650), modes: MODES.metal, d: 0.9, gain: 0.32, strike: 0.6, spread: 0.01 });
    noise(s, { d: 0.02, hp: 3000, gain: 0.3 });
    thump(s, { f: 200, f1: 100, d: 0.06, gain: 0.2 });
    return 1;
  }, impact),
  hit_wood: cached(6, 0.6, (s) => {
    pluck(s, { f: rand(180, 320), mat: "wood", gain: 0.5 });
    modal(s, { f: rand(300, 500), modes: MODES.wood, d: 0.1, gain: 0.15 });
    noise(s, { d: 0.02, bp: 2000, q: 1, gain: 0.2 });
    return 0.25;
  }, impact),
  hit_stone: cached(6, 0.6, (s) => {
    noise(s, { d: 0.02, bp: 2500, q: 0.7, gain: 0.4 });
    noise(s, { color: "brown", d: 0.12, lp: 800, gain: 0.45 });
    pebbles(s, { at: 0.02, n: 4, span: 0.2, gain: 0.1 });
    thump(s, { f: 110, f1: 60, d: 0.1, gain: 0.35 });
    return 0.3;
  }, impact),

  player_hurt: one((s) => {
    vocal(s, {
      f0: [[0, rand(150, 180)], [0.25, rand(95, 115)]],
      vowel: [[0, pick(["uh", "a", "ae"] as const)], [0.2, "er"]],
      d: 0.32,
      a: 0.012,
      r: 0.15,
      gain: 0.35,
      breath: 0.35,
      jitter: 25,
      growl: 0.3,
      shift: rand(0.95, 1.1),
    });
    thump(s, { f: 90, f1: 45, d: 0.18, gain: 0.35 });
    noise(s, { color: "pink", d: 0.08, bp: 1000, gain: 0.2 });
    return 0.4;
  }, { priority: 1, reverb: 0.15, maxInstances: 2, pitchVar: 0.05 }),

  player_death: one((s) => {
    vocal(s, {
      f0: [[0, 150], [0.3, 130], [1.7, 70]],
      vowel: [[0, "a"], [0.7, "o"], [1.5, "u"]],
      d: 1.8,
      env: [[0, 0], [0.05, 1], [0.6, 0.7], [1.4, 0.3], [1.8, 0]],
      gain: 0.32,
      breath: 0.5,
      jitter: 40,
      growl: 0.25,
    });
    thump(s, { at: 0.55, f: 80, f1: 35, d: 0.45, gain: 0.5 });
    noise(s, { at: 0.55, color: "pink", d: 0.25, bp: 1500, q: 0.8, gain: 0.15 });
    toll(s, { at: 0.9, f: 98, d: 4.5, gain: 0.28, lp: 2400 });
    tone(s, { at: 0.2, f: 55, f1: 41, a: 1.2, d: 3.5, gain: 0.14, linDecay: true });
    return 5.6;
  }, { priority: 1, reverb: 0.5, maxInstances: 1, pitchVar: 0 }),

  crit: one((s) => {
    noise(s, { d: 0.25, bp: 5000, bp1: 8000, q: 6, gain: 0.3 });
    modal(s, { f: 1200, modes: MODES.chime, d: 0.4, gain: 0.18 });
    thump(s, { f: 160, f1: 50, d: 0.2, gain: 0.55, click: 0.4 });
    fm(s, { f: 2400, ratio: 1.41, index: 2, d: 0.25, gain: 0.07 });
    return 0.5;
  }, { priority: 0.85, reverb: 0.3, maxInstances: 3 }),

  block: one((s) => {
    thump(s, { f: 180, f1: 90, d: 0.12, gain: 0.45, click: 0.2 });
    modal(s, { f: rand(650, 750), modes: MODES.glass, d: 0.35, gain: 0.2, strike: 0.3 });
    noise(s, { d: 0.05, bp: 2500, q: 1, gain: 0.2 });
    return 0.45;
  }, { priority: 0.7, reverb: 0.3 }),

  heal: one((s) => {
    const root = 262 * pick([1, 0.944, 1.059]);
    [1, 1.5, 2.25, 3].forEach((r, i) => tone(s, { at: i * 0.07, f: root * r * 0.98, f1: root * r, sweep: 0.3, a: 0.25, d: 1.0, gain: 0.09, vib: [5, 6] }));
    noise(s, { color: "pink", a: 0.3, d: 0.8, bp: 3000, bp1: 6000, q: 2, gain: 0.06 });
    sparkle(s, { at: 0.2, n: 5, span: 0.8, fLo: 3000, fHi: 6000, gain: 0.03 });
    return 1.5;
  }, { priority: 0.7, reverb: 0.45, maxInstances: 2, pitchVar: 0.01 }),

  mana_restore: one((s) => {
    [1, 1.2, 1.5, 1.8, 2.25].forEach((r, i) => fm(s, { at: i * 0.06, f: 523 * r, ratio: 7, index: 1.2, index1: 0, d: 0.6, gain: 0.08 }));
    noise(s, { a: 0.1, d: 0.5, hp: 5000, gain: 0.05 });
    tone(s, { f: 131, a: 0.1, d: 0.6, gain: 0.08 });
    return 0.95;
  }, { priority: 0.65, reverb: 0.4, maxInstances: 2, pitchVar: 0.01 }),

  low_health_heartbeat: one((s) => {
    heartbeat(s, { gain: 0.7, lp: 200 });
    tone(s, { f: 41, a: 0.05, d: 0.5, gain: 0.12 });
    return 0.6;
  }, { priority: 0.9, reverb: 0, maxInstances: 2, pitchVar: 0.02 }),
};
