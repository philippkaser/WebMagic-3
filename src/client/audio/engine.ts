/** The audio engine: context wiring, buses, master dynamics, shared reverb,
 * voice pool and the lookahead scheduler.
 *
 *   voices ─► sub-bus (sfx | ambience | music | ui | voice) ─► duck ─► master
 *        └──► bus send ─► Reverb (generated IR, per environment) ─► master
 *   master ─► glue compressor ─► limiter ─► soft clip ─► destination
 *
 * Works on any BaseAudioContext, so the headless check can run the whole
 * chain inside an OfflineAudioContext.
 *
 * Voice budget: at most `maxVoices` sounding voices. A new one-shot is
 * dropped if it is out of range / inaudible, if it duplicates the same cue
 * within 25 ms at the same spot, or if the pool is full and it is weaker than
 * the weakest playing voice (older voices near their end are cheapest to
 * steal). Loops are *virtual*: the game can create hundreds (every torch),
 * only the `maxLoops` most audible are actually synthesised, re-evaluated as
 * the listener moves. */

import { Reverb, type RoomId } from "./reverb";
import { distanceGain, occlusionGain, Spatial, type SpatialChain } from "./spatial";
import { bank, makeSyn, playBuf, prune, stopAll, type Syn } from "./synth";
import {
  NULL_HANDLE,
  SUB_BUSES,
  type BusId,
  type LoopCue,
  type LoopInstance,
  type OneShotCue,
  type PlayOpts,
  type SoundHandle,
  type SubBus,
} from "./types";
import { clamp, dist3, rand, type Vec3 } from "./util";

export type Ticker = (from: number, to: number) => void;

/** Calls tickers with consecutive, non-overlapping time windows. Live, it is
 * pumped by a timer with lookahead; offline, the check advances it by hand. */
export class Scheduler {
  private list: { fn: Ticker; until: number }[] = [];

  add(fn: Ticker, from: number): () => void {
    const e = { fn, until: from };
    this.list.push(e);
    return () => {
      const i = this.list.indexOf(e);
      if (i >= 0) this.list.splice(i, 1);
    };
  }

  advance(to: number): void {
    for (const e of this.list.slice()) {
      if (to <= e.until) continue;
      const from = e.until;
      e.until = to;
      try {
        e.fn(from, to);
      } catch (err) {
        console.error("[audio] ticker failed", err);
      }
    }
  }
}

export const BUS_DEFAULTS: Record<BusId, number> = {
  master: 0.85,
  sfx: 0.9,
  ambience: 0.7,
  music: 0.6,
  ui: 0.55,
  voice: 0.9,
};

interface Voice {
  id: string;
  prio: number;
  start: number;
  end: number;
  /** Current level and the cue's trim (setVolume multiplies the trim). */
  gain: number;
  base: number;
  chain: SpatialChain;
  syn: Syn;
  dying: boolean;
  loop: LoopEntry | null;
  inst: LoopInstance | null;
  untick: (() => void) | null;
}

interface LoopEntry {
  id: string;
  cue: LoopCue;
  pos: Vec3 | null;
  vol: number;
  occ: number;
  pitch: number;
  voice: Voice | null;
  aud: number;
}

const LOOKAHEAD = 0.6;

/** Soft-knee clip curve: linear to 0.75, then eases into ±0.98. */
function clipCurve(): Float32Array<ArrayBuffer> {
  const c = new Float32Array(4096);
  for (let i = 0; i < c.length; i++) {
    const x = (i / (c.length - 1)) * 2 - 1;
    const a = Math.abs(x);
    const y = a < 0.75 ? a : 0.75 + 0.23 * Math.tanh((a - 0.75) / 0.23);
    c[i] = Math.sign(x) * y;
  }
  return c;
}

export class Engine {
  readonly ctx: BaseAudioContext;
  readonly master: GainNode;
  readonly bus: Record<SubBus, GainNode>;
  readonly duck: Record<SubBus, GainNode>;
  readonly sends: Record<SubBus, GainNode>;
  readonly reverb: Reverb;
  readonly spatial: Spatial;
  readonly sched = new Scheduler();
  readonly volumes: Record<BusId, number> = { ...BUS_DEFAULTS };
  maxVoices = 32;
  maxLoops = 12;
  private voices: Voice[] = [];
  private loops = new Set<LoopEntry>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastUpdate = -1;

  constructor(ctx: BaseAudioContext, opts: { realtime: boolean }) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volumes.master;
    const glue = ctx.createDynamicsCompressor();
    glue.threshold.value = -20;
    glue.knee.value = 10;
    glue.ratio.value = 3;
    glue.attack.value = 0.006;
    glue.release.value = 0.25;
    const limit = ctx.createDynamicsCompressor();
    limit.threshold.value = -4;
    limit.knee.value = 0;
    limit.ratio.value = 20;
    limit.attack.value = 0.001;
    limit.release.value = 0.1;
    const makeup = ctx.createGain();
    makeup.gain.value = 1.25;
    const clip = ctx.createWaveShaper();
    clip.curve = clipCurve();
    clip.oversample = "2x";
    this.master.connect(glue).connect(limit).connect(makeup).connect(clip).connect(ctx.destination);

    this.reverb = new Reverb(ctx, opts.realtime);
    this.reverb.output.connect(this.master);
    const bus = {} as Record<SubBus, GainNode>;
    const duck = {} as Record<SubBus, GainNode>;
    const sends = {} as Record<SubBus, GainNode>;
    for (const b of SUB_BUSES) {
      bus[b] = ctx.createGain();
      bus[b].gain.value = this.volumes[b];
      duck[b] = ctx.createGain();
      bus[b].connect(duck[b]).connect(this.master);
      sends[b] = ctx.createGain();
      sends[b].gain.value = this.volumes[b];
      sends[b].connect(this.reverb.input);
    }
    this.bus = bus;
    this.duck = duck;
    this.sends = sends;
    this.reverb.set("small_crypt", 0.01);
    this.spatial = new Spatial(ctx);
    if (opts.realtime) this.timer = setInterval(() => this.pump(), 90);
  }

  /** Advance the scheduler and housekeeping (timer-driven when live). */
  pump(): void {
    const now = this.ctx.currentTime;
    this.sched.advance(now + LOOKAHEAD);
    this.update(now);
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  setVolume(bus: BusId, v: number): void {
    const x = clamp(v, 0, 2);
    this.volumes[bus] = x;
    const now = this.ctx.currentTime;
    if (bus === "master") this.master.gain.setTargetAtTime(x, now, 0.03);
    else {
      this.bus[bus].gain.setTargetAtTime(x, now, 0.03);
      this.sends[bus].gain.setTargetAtTime(x, now, 0.03);
    }
  }

  /** Temporarily lower a bus (stingers duck the ambience). */
  duckBus(bus: SubBus, amount: number, hold: number, release = 1.5): void {
    const g = this.duck[bus].gain;
    const now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(1 - amount, now + 0.15);
    g.setValueAtTime(1 - amount, now + 0.15 + hold);
    g.linearRampToValueAtTime(1, now + 0.15 + hold + release);
  }

  setEnvironment(id: RoomId, fade = 1.2): void {
    this.reverb.set(id, fade);
  }

  setListener(pos: Vec3, fwd: Vec3, up?: Vec3): void {
    this.spatial.setListener(pos, fwd, up);
    // Loops re-rank at most ~6×/s as the listener moves.
    const now = this.ctx.currentTime;
    if (now - this.lastUpdate > 0.15) this.update(now);
  }

  stats(): { voices: number; loops: number; realLoops: number; hrtf: number; time: number } {
    let voices = 0;
    let realLoops = 0;
    for (const v of this.voices) {
      if (v.dying) continue;
      if (v.loop) realLoops++;
      else voices++;
    }
    return { voices, loops: this.loops.size, realLoops, hrtf: this.spatial.hrtfActive, time: this.ctx.currentTime };
  }

  // ── One-shots ──────────────────────────────────────────────────────────────

  play(id: string, cue: OneShotCue, o: PlayOpts = {}): SoundHandle {
    const now = this.ctx.currentTime;
    this.reap(now);
    const vol = Math.max(0, o.volume ?? 1);
    const occ = clamp(o.occlusion ?? 0, 0, 1);
    const pos = o.pos ?? null;
    const aud = this.audibility(cue, pos, vol, occ);
    if (aud < 0.003) return NULL_HANDLE;
    const prio = cue.priority * (0.4 + 0.6 * Math.min(1, aud));

    // Flood control for this cue.
    let same = 0;
    let oldest: Voice | null = null;
    for (const v of this.voices) {
      if (v.id !== id || v.dying || v.loop) continue;
      if (now - v.start < 0.025 && (!pos || !v.chain.pos || dist3(pos, v.chain.pos) < 1.5)) return NULL_HANDLE;
      same++;
      if (!oldest || v.start < oldest.start) oldest = v;
    }
    if (oldest && same >= cue.maxInstances) this.kill(oldest, 0.04);

    // Global budget.
    if (this.liveCount() >= this.maxVoices) {
      let victim: Voice | null = null;
      let weakest = Infinity;
      for (const v of this.voices) {
        if (v.dying || v.loop) continue;
        const e = this.effPrio(v, now);
        if (e < weakest) {
          weakest = e;
          victim = v;
        }
      }
      if (!victim || weakest >= prio) return NULL_HANDLE;
      this.kill(victim, 0.03);
    }

    const t0 = now + 0.006 + Math.max(0, o.delay ?? 0);
    const pitch = (o.pitch ?? 1) * (1 + rand(-cue.pitchVar, cue.pitchVar));
    const chain = this.spatial.chain({
      pos,
      occlusion: occ,
      refDist: cue.refDist,
      dest: this.bus[cue.bus],
      send: this.sends[cue.bus],
      sendLevel: cue.reverb,
    });
    const level = vol * cue.gain;
    chain.input.gain.value = level;
    const syn = makeSyn(this.ctx, chain.input, t0, pitch);
    let dur: number;
    try {
      const buf = cue.cache ? bank.get(id) : null;
      dur = buf ? playBuf(syn, buf) : cue.build(syn);
    } catch (err) {
      console.error(`[audio] cue ${id} failed`, err);
      chain.dispose();
      return NULL_HANDLE;
    }
    const v: Voice = { id, prio, start: t0, end: t0 + dur + 0.05, gain: level, base: cue.gain, chain, syn, dying: false, loop: null, inst: null, untick: null };
    this.voices.push(v);
    return this.handle(v);
  }

  // ── Loops ──────────────────────────────────────────────────────────────────

  addLoop(id: string, cue: LoopCue, o: PlayOpts = {}): SoundHandle {
    const e: LoopEntry = {
      id,
      cue,
      pos: o.pos ? { ...o.pos } : null,
      vol: Math.max(0, o.volume ?? 1),
      occ: clamp(o.occlusion ?? 0, 0, 1),
      pitch: (o.pitch ?? 1) * (1 + rand(-cue.pitchVar, cue.pitchVar)),
      voice: null,
      aud: 0,
    };
    this.loops.add(e);
    this.updateLoops(this.ctx.currentTime);
    let stopped = false;
    const loops = this.loops;
    return {
      setPos: (p) => {
        if (!p) return;
        e.pos = { x: p.x, y: p.y, z: p.z };
        e.voice?.chain.setPos(p);
      },
      setVolume: (x) => {
        e.vol = Math.max(0, x);
        const v = e.voice;
        if (v && !v.dying) {
          v.gain = e.vol * cue.gain;
          v.chain.input.gain.setTargetAtTime(v.gain, this.ctx.currentTime, 0.05);
        }
      },
      setOcclusion: (x) => {
        e.occ = clamp(x, 0, 1);
        e.voice?.chain.setOcclusion(e.occ);
      },
      stop: (fade = 0.3) => {
        if (stopped) return;
        stopped = true;
        this.loops.delete(e);
        if (e.voice) this.release(e.voice, fade);
        e.voice = null;
      },
      get playing() {
        return !stopped && loops.has(e);
      },
    };
  }

  /** Housekeeping: reap finished voices, re-rank loops, refresh spatial filters. */
  update(now = this.ctx.currentTime): void {
    this.lastUpdate = now;
    this.reap(now);
    this.updateLoops(now);
    for (const v of this.voices) if (v.chain.pos && !v.dying) v.chain.refresh(0.08);
  }

  /** Stop everything (e.g. on leaving a floor). Loop handles become inert. */
  stopAll(fade = 0.2): void {
    for (const e of this.loops) if (e.voice) this.release(e.voice, fade);
    this.loops.clear();
    for (const v of this.voices) if (!v.dying) this.kill(v, fade);
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private audibility(cue: { gain: number; maxDist: number; refDist: number }, pos: Vec3 | null, vol: number, occ: number): number {
    let a = vol * cue.gain;
    if (pos) {
      const d = this.spatial.distance(pos);
      if (d > cue.maxDist) return 0;
      a *= distanceGain(d, cue.refDist) * occlusionGain(occ);
    }
    return a;
  }

  private liveCount(): number {
    let n = 0;
    for (const v of this.voices) if (!v.dying) n++;
    return n;
  }

  private effPrio(v: Voice, now: number): number {
    const life = Math.max(0.05, v.end - v.start);
    const age = clamp((now - v.start) / life, 0, 1);
    return v.prio * (1 - 0.75 * age);
  }

  private handle(v: Voice): SoundHandle {
    const ctx = this.ctx;
    return {
      setPos: (p) => v.chain.setPos(p),
      setVolume: (x) => {
        if (v.dying) return;
        v.gain = Math.max(0, x) * v.base;
        v.chain.input.gain.setTargetAtTime(v.gain, ctx.currentTime, 0.03);
      },
      setOcclusion: (o) => v.chain.setOcclusion(o),
      stop: (fade = 0.08) => {
        if (!v.dying) this.kill(v, fade);
      },
      get playing() {
        return !v.dying && ctx.currentTime < v.end;
      },
    };
  }

  /** Fade a voice out over `fade` and cut all its sources. */
  private kill(v: Voice, fade: number): void {
    const now = this.ctx.currentTime;
    const g = v.chain.input.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + fade);
    stopAll(v.syn.srcs, now + fade + 0.01);
    v.untick?.();
    v.untick = null;
    v.dying = true;
    v.end = now + fade + 0.03;
  }

  /** Graceful loop release: let the instance play its tail, then cut. */
  private release(v: Voice, fade: number): void {
    const now = this.ctx.currentTime;
    const tail = v.inst?.stop ? v.inst.stop(now) : 0;
    if (tail > 0) {
      v.untick?.();
      v.untick = null;
      stopAll(v.syn.srcs, now + tail);
      v.dying = true;
      v.end = now + tail + 0.03;
    } else this.kill(v, fade);
  }

  private reap(now: number): void {
    if (!this.voices.length) return;
    let w = 0;
    for (const v of this.voices) {
      if (now > v.end) v.chain.dispose();
      else this.voices[w++] = v;
    }
    this.voices.length = w;
  }

  private updateLoops(now: number): void {
    if (!this.loops.size) return;
    const list = [...this.loops];
    for (const e of list) e.aud = this.audibility(e.cue, e.pos, e.vol, e.occ) * e.cue.priority;
    list.sort((a, b) => b.aud - a.aud);
    list.forEach((e, i) => {
      const inBudget = i < this.maxLoops;
      if (!e.voice) {
        if (inBudget && e.aud > 0.004) this.realize(e, now);
      } else if (e.aud < 0.002 || (!inBudget && now - e.voice.start > 1.5)) {
        this.kill(e.voice, 0.4);
        e.voice = null;
      }
    });
  }

  private realize(e: LoopEntry, now: number): void {
    const t0 = now + 0.01;
    const chain = this.spatial.chain({
      pos: e.pos,
      occlusion: e.occ,
      refDist: e.cue.refDist,
      dest: this.bus[e.cue.bus],
      send: this.sends[e.cue.bus],
      sendLevel: e.cue.reverb,
    });
    const level = e.vol * e.cue.gain;
    chain.input.gain.setValueAtTime(0, now);
    chain.input.gain.linearRampToValueAtTime(level, t0 + 0.3);
    const syn = makeSyn(this.ctx, chain.input, t0, e.pitch);
    let inst: LoopInstance;
    try {
      inst = e.cue.build(syn) ?? {};
    } catch (err) {
      console.error(`[audio] loop ${e.id} failed`, err);
      chain.dispose();
      this.loops.delete(e);
      return;
    }
    const v: Voice = { id: e.id, prio: e.cue.priority, start: t0, end: Infinity, gain: level, base: e.cue.gain, chain, syn, dying: false, loop: e, inst, untick: null };
    if (inst.tick) {
      const tick = inst.tick.bind(inst);
      v.untick = this.sched.add((a, b) => {
        tick(a, b);
        prune(syn.srcs, a);
      }, t0);
    }
    this.voices.push(v);
    e.voice = v;
  }
}
