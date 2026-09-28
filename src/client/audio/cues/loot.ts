/** Loot & UI cues. UI sounds are tactile (wood, parchment, brass) rather than
 * beeps; rarity escalates from a clink to a bell to a sung chord in the
 * Godwell mode. */

import { crackle, fm, modal, MODES, noise, pluck, tone, vocal } from "../synth";
import { cueKit, type CueDef } from "../types";
import { pick, rand } from "../util";
import { clatter, coins, modeNote, sizzleLayer, sparkle, thump, toll } from "./recipes";

const { one, cached } = cueKit("loot");
const ui = cueKit("ui");

const pickup = { priority: 0.7, reverb: 0.15, maxInstances: 4, pitchVar: 0.03 };
const uiMeta = { bus: "ui" as const, priority: 0.6, reverb: 0, maxInstances: 4, pitchVar: 0.03 };

/** A short arpeggio of chimes in the Godwell mode. */
function chimeRun(s: Parameters<typeof tone>[0], root: number, degrees: readonly number[], step: number, at = 0, gain = 0.12, d = 0.9): number {
  degrees.forEach((deg, i) => modal(s, { at: at + i * step, f: modeNote(root, deg), modes: MODES.chime, d: i === degrees.length - 1 ? d * 1.8 : d, gain, strike: 0.2 }));
  return at + degrees.length * step + d * 1.8;
}

export const LOOT_CUES: Record<string, CueDef> = {
  pickup_item: one((s) => {
    noise(s, { color: "pink", a: 0.01, d: 0.12, bp: 2500, q: 0.8, gain: 0.25 });
    modal(s, { at: 0.05, f: rand(800, 1100), modes: MODES.ceramic, d: 0.12, gain: 0.15 });
    thump(s, { at: 0.04, f: 160, f1: 100, d: 0.06, gain: 0.15 });
    return 0.3;
  }, pickup),
  pickup_gold: cached(6, 1, (s) => {
    const n = Math.round(rand(3, 6));
    coins(s, { n, span: 0.08 * n, gain: 0.14 });
    return 0.8;
  }, pickup),
  pickup_rare: one((s) => {
    coins(s, { n: 3, span: 0.15, gain: 0.12 });
    chimeRun(s, 523, [0, 2, 4], 0.08, 0.05, 0.12, 0.7);
    return 1.6;
  }, { ...pickup, priority: 0.85 }),
  pickup_legendary: one((s) => {
    toll(s, { f: 131, d: 3.5, gain: 0.3, lp: 3000 });
    chimeRun(s, 523, [0, 4, 6, 7, 9, 11], 0.09, 0.15, 0.1, 0.9);
    for (const [deg, v] of [[0, "oo"], [4, "o"], [6, "oo"]] as const) {
      vocal(s, { at: 0.2, f0: modeNote(131, deg + 7), vowel: [[0, v], [2.2, "a"]], d: 2.8, a: 0.8, r: 1.2, gain: 0.07, breath: 0.2, vib: [4.5, 12], src: "sawtooth" });
    }
    noise(s, { a: 0.5, d: 1.5, bp: 6000, q: 1, gain: 0.04 });
    sparkle(s, { at: 0.3, n: 10, span: 1.6, fLo: 3000, fHi: 7000, gain: 0.025, d: 0.3 });
    return 3.6;
  }, { ...pickup, priority: 1, maxInstances: 1, reverb: 0.4 }),
  equip: one((s) => {
    noise(s, { color: "pink", d: 0.18, bp: 1800, q: 1, gain: 0.22 });
    modal(s, { at: 0.08, f: 2200, modes: MODES.coin, d: 0.08, gain: 0.1, max: 3 });
    tone(s, { f: 110, a: 0.05, d: 0.4, gain: 0.12, vib: [5, 10] });
    return 0.5;
  }, pickup),

  ui_click: ui.cached(4, 0.3, (s) => {
    pluck(s, { f: rand(1200, 1500), mat: "wood", gain: 0.28 });
    noise(s, { d: 0.004, bp: 3000, q: 2, gain: 0.18 });
    return 0.1;
  }, uiMeta),
  ui_hover: ui.cached(4, 0.2, (s) => {
    noise(s, { color: "pink", a: 0.005, d: 0.03, bp: 2200, q: 2, gain: 0.14 });
    tone(s, { f: 1800, d: 0.04, gain: 0.025 });
    return 0.06;
  }, { ...uiMeta, priority: 0.3, maxInstances: 2 }),
  ui_open: ui.one((s) => {
    noise(s, { color: "pink", a: 0.08, d: 0.2, bp: 1500, bp1: 3000, q: 1, gain: 0.2 });
    crackle(s, { d: 0.25, density: 200, hp: 2000, gain: 0.12 });
    pluck(s, { at: 0.12, f: 180, mat: "wood", gain: 0.2 });
    return 0.35;
  }, uiMeta),
  ui_close: ui.one((s) => {
    noise(s, { color: "pink", a: 0.02, d: 0.15, bp: 3000, bp1: 1200, q: 1, gain: 0.18 });
    thump(s, { at: 0.08, f: 140, f1: 80, d: 0.08, gain: 0.25 });
    return 0.2;
  }, uiMeta),
  shop_buy: ui.one((s) => {
    coins(s, { n: 5, span: 0.2, gain: 0.12 });
    thump(s, { at: 0.05, f: 150, f1: 90, d: 0.08, gain: 0.2 });
    modal(s, { at: 0.25, f: 1568, modes: MODES.chime, d: 0.9, gain: 0.12, strike: 0.3 });
    return 1.3;
  }, uiMeta),
  shop_sell: ui.one((s) => {
    noise(s, { a: 0.05, d: 0.25, bp: 5000, q: 1, gain: 0.1 });
    coins(s, { at: 0.05, n: 4, span: 0.3, gain: 0.11 });
    thump(s, { at: 0.35, f: 120, f1: 70, d: 0.1, gain: 0.3 });
    pluck(s, { at: 0.35, f: 160, mat: "wood", gain: 0.2 });
    return 0.8;
  }, uiMeta),
  gamble_roll: ui.one((s) => {
    clatter(s, { n: 10, span: 0.5, mat: "bone", fLo: 900, fHi: 1600, gain: 0.2 });
    clatter(s, { at: 0.55, n: 8, span: 0.6, mat: "bone", fLo: 700, fHi: 1300, gain: 0.25, skew: 2.2 });
    pluck(s, { at: 1.2, f: 200, mat: "wood", gain: 0.2 });
    return 1.5;
  }, uiMeta),
  gamble_win: ui.one((s) => {
    coins(s, { n: 8, span: 0.6, gain: 0.1 });
    chimeRun(s, pick([440, 466]), [0, 2, 4, 6, 7], 0.1, 0.05, 0.12, 0.8);
    return 2.2;
  }, uiMeta),
  gamble_lose: ui.one((s) => {
    toll(s, { f: 392, d: 1.2, gain: 0.16, spread: 0.02 });
    toll(s, { at: 0.25, f: 277, d: 1.6, gain: 0.16, spread: 0.02 });
    thump(s, { at: 0.25, f: 110, f1: 60, d: 0.2, gain: 0.3 });
    tone(s, { at: 0.3, f: 110, f1: 70, d: 0.6, gain: 0.1, type: "triangle", lp: 600 });
    return 1.9;
  }, uiMeta),
  craft: ui.one((s) => {
    [0, 0.28, 0.5].forEach((t, i) => {
      modal(s, { at: t, f: rand(500, 560), modes: MODES.metal, d: 0.6, gain: i === 2 ? 0.12 : 0.22, strike: 0.7 });
      thump(s, { at: t, f: 180, f1: 90, d: 0.06, gain: 0.2 });
    });
    sizzleLayer(s, { at: 0.75, d: 0.6, gain: 0.15 });
    sparkle(s, { at: 0.8, n: 6, span: 0.5, fLo: 2500, fHi: 6000, gain: 0.04 });
    return 1.5;
  }, uiMeta),
  error: ui.one((s) => {
    pluck(s, { f: 150, mat: "wood", gain: 0.35 });
    pluck(s, { at: 0.12, f: 141, mat: "wood", gain: 0.35 });
    tone(s, { f: 110, d: 0.2, gain: 0.08, type: "triangle", lp: 500 });
    return 0.3;
  }, { ...uiMeta, maxInstances: 1 }),
  level_up: ui.one((s) => {
    chimeRun(s, 523, [0, 2, 3, 4, 6, 7], 0.09, 0, 0.11, 0.8);
    for (const f of [262, 392, 523]) tone(s, { f, a: 0.4, h: 0.5, d: 1.5, gain: 0.06, vib: [4, 8] });
    toll(s, { f: 131, d: 3, gain: 0.2, lp: 2500 });
    fm(s, { at: 0.5, f: 1047, ratio: 3, index: 1, index1: 0, d: 1.2, gain: 0.04 });
    return 3;
  }, { ...uiMeta, priority: 0.9, reverb: 0.3, maxInstances: 1 }),
};
