/** Bed runtime: what an ambience bed definition builds with. A bed is a set
 * of continuous layers (drones, air, wind) plus Poisson-timed events (drips,
 * scratches, bells, creaks) scheduled just ahead of time by the engine's
 * scheduler — so the texture never loops. Events are placed in the stereo
 * field and at a pseudo-distance (lowpass + level) to give the bed depth. */

import type { Scheduler, Ticker } from "./engine";
import type { RoomId } from "./reverb";
import { at, biquad, gain, makeSyn, prune, stereo, stopAll, type Src, type Syn } from "./synth";
import { rand } from "./util";

export interface Place {
  /** Fixed pan, or a random one within ±spread. */
  pan?: number;
  spread?: number;
  /** Pseudo-distance range 0 (close) … 1 (far, dark, quiet). */
  far?: readonly [number, number];
}

export interface BedKit {
  /** Output = the bed's mix; t = bed start. */
  s: Syn;
  /** Recurring random event every min..max seconds. Without `place` the
   * event Syn outputs straight into the bed (use for automation). */
  every(min: number, max: number, fn: (e: Syn, n: number) => void, place?: Place): void;
  /** Raw scheduler access for patterned layers (clocks, heartbeats). */
  tick(fn: Ticker): void;
  /** A fresh placement chain feeding the bed. */
  place(p: Place): AudioNode;
}

export interface BedDef {
  /** Tonal centre (Hz) the danger layer tunes to. */
  root: number;
  /** Suggested reverb environment for this place. */
  room: RoomId;
  /** Reverb send of the whole bed. */
  wet?: number;
  /** Output trim (from the mix sheet). */
  gain?: number;
  build(k: BedKit): void;
}

export interface BedRun {
  id: string;
  stop(fade: number): void;
}

export function placeNode(ctx: BaseAudioContext, dest: AudioNode, p: Place): AudioNode {
  const spread = p.spread ?? 0.8;
  const pan = stereo(ctx, p.pan ?? rand(-spread, spread));
  const far = p.far ? rand(p.far[0], p.far[1]) : 0;
  const lp = biquad(ctx, "lowpass", 16000 * Math.pow(600 / 16000, far));
  const g = gain(ctx, 1 - 0.75 * far);
  pan.connect(lp).connect(g).connect(dest);
  return pan;
}

/** Start a bed at t0, fading in over `fade`. */
export function startBed(
  ctx: BaseAudioContext,
  dest: AudioNode,
  send: AudioNode | null,
  sched: Scheduler,
  id: string,
  def: BedDef,
  t0: number,
  fade: number,
): BedRun {
  const out = gain(ctx, 0);
  out.gain.setValueAtTime(0, t0);
  out.gain.linearRampToValueAtTime(def.gain ?? 1, t0 + Math.max(0.05, fade));
  out.connect(dest);
  if (send) out.connect(gain(ctx, def.wet ?? 0.35)).connect(send);
  const s = makeSyn(ctx, out, t0, 1);
  const tickers: Ticker[] = [];
  const kit: BedKit = {
    s,
    place: (p) => placeNode(ctx, out, p),
    tick: (fn) => tickers.push(fn),
    every(min, max, fn, place) {
      let next = t0 + rand(min, max) * rand(0.05, 0.8);
      let n = 0;
      tickers.push((from, to) => {
        while (next < to) {
          if (next >= from - 0.05) {
            const node = place ? placeNode(ctx, out, place) : out;
            fn(at(s, next - s.t, node), n++);
          }
          next += rand(min, max);
        }
      });
    },
  };
  def.build(kit);
  const untick = sched.add((from, to) => {
    for (const f of tickers) f(from, to);
    prune(s.srcs as Src[], from);
  }, t0);
  let stopped = false;
  return {
    id,
    stop(f) {
      if (stopped) return;
      stopped = true;
      const now = ctx.currentTime;
      out.gain.cancelScheduledValues(now);
      out.gain.setValueAtTime(out.gain.value, now);
      out.gain.linearRampToValueAtTime(0, now + f);
      stopAll(s.srcs, now + f + 0.05);
      untick();
      setTimeout(() => out.disconnect(), (f + 0.2) * 1000);
    },
  };
}
