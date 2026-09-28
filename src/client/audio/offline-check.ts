/** Level check: render every cue, voice kind, ambience bed and stinger into
 * an OfflineAudioContext and measure peak / RMS, then run the full engine
 * chain (spatial + occlusion + reverb + voice pool + ambience + danger)
 * offline. Used by the demo page and scripts/audio-check.ts. */

import { startBed } from "./bedkit";
import { BEDS } from "./beds";
import { Ambience } from "./ambience";
import { Engine, Scheduler } from "./engine";
import { STINGERS } from "./music";
import { ALL_CUES, warmCache } from "./registry";
import { gain, makeSyn, measure, renderOffline, trimBuffer } from "./synth";
import type { CueDef } from "./types";
import { rand } from "./util";

const SR = 48000;

export type Status = "ok" | "quiet" | "silent" | "clip" | "error";

export interface Level {
  id: string;
  kind: "cue" | "loop" | "voice" | "bed" | "stinger" | "cached" | "engine";
  peak: number;
  rms: number;
  dur: number;
  status: Status;
  note?: string;
}

const status = (peak: number): Status => (peak < 0.003 ? "silent" : peak >= 0.995 ? "clip" : peak < 0.03 ? "quiet" : "ok");

function level(id: string, kind: Level["kind"], buf: AudioBuffer, note?: string): Level {
  const t = trimBuffer(buf, 1e-3);
  const { peak, rms } = measure(t);
  return { id, kind, peak, rms, dur: t.duration, status: status(peak), note };
}

async function render(len: number, build: (ctx: OfflineAudioContext) => void): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext({ numberOfChannels: 2, length: Math.ceil(len * SR), sampleRate: SR });
  build(ctx);
  return ctx.startRendering();
}

/** Dry render of one cue definition at its trim gain (worst of `runs` plays). */
export async function checkCue(id: string, cue: CueDef, runs = 3): Promise<Level[]> {
  const kind: Level["kind"] = id.startsWith("voice:") ? "voice" : id.startsWith("stinger:") ? "stinger" : cue.kind === "loop" ? "loop" : "cue";
  const out: Level[] = [];
  try {
    // Every play is randomised: render one-shots several times, keep the worst peak.
    const n = cue.kind === "loop" ? 1 : runs;
    const all: Level[] = [];
    for (let i = 0; i < n; i++) {
      const buf = await render(cue.kind === "loop" ? 4 : 7, (ctx) => {
        const g = gain(ctx, cue.gain);
        g.connect(ctx.destination);
        const s = makeSyn(ctx, g, 0.01, 1);
        if (cue.kind === "loop") cue.build(s)?.tick?.(0, 4);
        else cue.build(s);
      });
      all.push(level(id, kind, buf));
    }
    const worst = all.reduce((a, b) => (b.peak > a.peak ? b : a));
    out.push({ ...worst, rms: all.reduce((a, b) => a + b.rms, 0) / all.length });
    if (cue.kind === "oneshot" && cue.cache) {
      const c = cue.cache;
      const pre = await renderOffline(SR, c.maxDur, c.render ?? cue.build, { reverse: c.reverse });
      const m = measure(pre);
      out.push({ id: `${id} (pre-render)`, kind: "cached", peak: m.peak * cue.gain, rms: m.rms * cue.gain, dur: pre.duration, status: status(m.peak * cue.gain) });
    }
  } catch (err) {
    out.push({ id, kind, peak: 0, rms: 0, dur: 0, status: "error", note: String(err) });
  }
  return out;
}

export async function checkBed(id: string): Promise<Level> {
  const def = BEDS[id];
  if (!def) return { id, kind: "bed", peak: 0, rms: 0, dur: 0, status: "error", note: "unknown" };
  try {
    const len = 16;
    const buf = await render(len, (ctx) => {
      const sched = new Scheduler();
      startBed(ctx, ctx.destination, null, sched, id, def, 0, 1);
      sched.advance(len);
    });
    // Skip the fade-in when measuring.
    const tail = new AudioBuffer({ length: buf.length - 2 * SR, sampleRate: SR, numberOfChannels: 2 });
    for (let c = 0; c < 2; c++) tail.copyToChannel(buf.getChannelData(c).subarray(2 * SR), c);
    return level(id, "bed", tail);
  } catch (err) {
    return { id, kind: "bed", peak: 0, rms: 0, dur: 0, status: "error", note: String(err) };
  }
}

/** The whole chain offline: positional + occluded one-shots, a loop, a flood
 * of 80 voices (checks the pool cap), creature voices, a bed and danger. */
export async function checkEngine(): Promise<Level & { maxVoices: number }> {
  let peakVoices = 0;
  try {
    const len = 10;
    const buf = await render(len, (ctx) => {
      const e = new Engine(ctx, { realtime: false });
      e.setEnvironment("huge_cavern", 0.01);
      e.setListener({ x: 0, y: 1.6, z: 0 }, { x: 0, y: 0, z: -1 });
      const cue = (id: string) => {
        const c = ALL_CUES[id];
        if (!c || c.kind !== "oneshot") throw new Error(`no one-shot ${id}`);
        return c;
      };
      e.play("hit_metal", cue("hit_metal"), { pos: { x: 3, y: 1, z: -2 } });
      e.play("hit_bone", cue("hit_bone"), { pos: { x: -6, y: 1, z: 4 }, occlusion: 0.8 });
      e.play("voice:rat:alert", cue("voice:rat:alert"), { pos: { x: 2, y: 0, z: 1 }, pitch: 1.2 });
      const fire = ALL_CUES.fire_crackle_loop;
      if (fire?.kind === "loop") e.addLoop("fire_crackle_loop", fire, { pos: { x: -2, y: 0.5, z: -3 } });
      const ids = ["explosion_small", "hit_flesh", "footstep_stone", "cast_fire", "hit_storm", "splash", "crate_break"];
      for (let i = 0; i < 80; i++) {
        const id = ids[i % ids.length] as string;
        e.play(id, cue(id), { pos: { x: rand(-20, 20), y: 0, z: rand(-20, 20) }, occlusion: rand(0, 1) });
        peakVoices = Math.max(peakVoices, e.stats().voices + e.stats().realLoops);
      }
      const amb = new Ambience(e);
      amb.set("undercroft", 0.5);
      amb.setDanger(0.9);
      amb.stinger("warden_appears");
      e.sched.advance(len);
      e.update(0);
    });
    return { ...level("engine: full chain", "engine", buf, `peak concurrent voices ${peakVoices}`), maxVoices: peakVoices };
  } catch (err) {
    return { id: "engine: full chain", kind: "engine", peak: 0, rms: 0, dur: 0, status: "error", note: String(err), maxVoices: peakVoices };
  }
}

/** Everything. `onProgress` is called with each result as it lands. */
export async function checkAll(onProgress?: (l: Level) => void): Promise<Level[]> {
  await warmCache(SR);
  const results: Level[] = [];
  const push = (l: Level) => {
    results.push(l);
    onProgress?.(l);
  };
  for (const [id, cue] of Object.entries(ALL_CUES)) for (const l of await checkCue(id, cue)) push(l);
  for (const [id, cue] of Object.entries(STINGERS)) for (const l of await checkCue(`stinger:${id}`, cue)) push(l);
  for (const id of Object.keys(BEDS)) push(await checkBed(id));
  push(await checkEngine());
  return results;
}

