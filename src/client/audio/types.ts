/** Shared types for cues, handles and buses, plus the tiny factory each cue
 * module uses to declare its sounds with sensible defaults. */

import type { Syn } from "./synth/core";
import type { Vec3 } from "./util";

export type { Vec3 };

export type SubBus = "sfx" | "ambience" | "music" | "ui" | "voice";
export type BusId = "master" | SubBus;
export const SUB_BUSES: readonly SubBus[] = ["sfx", "ambience", "music", "ui", "voice"];

export interface PlayOpts {
  /** World position; omit for a non-positional (2D) sound. */
  pos?: Vec3 | null;
  /** Linear volume multiplier (default 1). */
  volume?: number;
  /** Pitch multiplier (default 1; creatures can pass a size factor). */
  pitch?: number;
  /** 0 = clear line of sight … 1 = fully walled off. */
  occlusion?: number;
  /** Start delay in seconds. */
  delay?: number;
}

/** Returned by every play / loop / voice call. Safe to use after the sound
 * ended (calls become no-ops). */
export interface SoundHandle {
  setPos(pos: Vec3 | null): void;
  setVolume(v: number): void;
  setOcclusion(o: number): void;
  stop(fade?: number): void;
  readonly playing: boolean;
}

export const NULL_HANDLE: SoundHandle = {
  setPos() {},
  setVolume() {},
  setOcclusion() {},
  stop() {},
  playing: false,
};

/** What a looping cue returns from its build. */
export interface LoopInstance {
  /** Schedule randomised texture events in [from, to) (seconds, ctx time). */
  tick?(from: number, to: number): void;
  /** Graceful stop requested at `t`: schedule a tail and return its length
   * (the engine cuts everything after it). Omit for a plain fade. */
  stop?(t: number): number;
}

export interface CueMeta {
  group: string;
  bus: SubBus;
  /** Output trim applied to the voice. */
  gain: number;
  /** 0..1 importance for voice stealing. */
  priority: number;
  /** Reverb send level. */
  reverb: number;
  /** Distance (m) at which the sound is at full level. */
  refDist: number;
  /** Beyond this distance the sound is culled. */
  maxDist: number;
  /** Max simultaneous instances of this cue. */
  maxInstances: number;
  /** Random ± pitch variation per play. */
  pitchVar: number;
}

export interface CacheSpec {
  variants: number;
  maxDur: number;
  /** Store the render reversed. */
  reverse?: boolean;
  /** Alternative build used only for the pre-render (e.g. the forward
   * sound that gets reversed); defaults to the cue's build. */
  render?: (s: Syn) => number;
}

export interface OneShotCue extends CueMeta {
  kind: "oneshot";
  /** Schedule the sound on `s`; return its duration in seconds. */
  build: (s: Syn) => number;
  /** Pre-render N variants once and play buffers afterwards. */
  cache?: CacheSpec;
}

export interface LoopCue extends CueMeta {
  kind: "loop";
  build: (s: Syn) => LoopInstance | void;
}

export type CueDef = OneShotCue | LoopCue;

type MetaIn = Partial<Omit<CueMeta, "group">>;

const DEFAULTS: Omit<CueMeta, "group"> = {
  bus: "sfx",
  gain: 1,
  priority: 0.5,
  reverb: 0.25,
  refDist: 2,
  maxDist: 60,
  maxInstances: 6,
  pitchVar: 0.04,
};

/** Declare cues of one group: `one` (live one-shot), `cached` (pre-rendered
 * variants), `loop` (continuous, needs stop()). */
export function cueKit(group: string) {
  return {
    one: (build: (s: Syn) => number, meta: MetaIn = {}): OneShotCue => ({ ...DEFAULTS, ...meta, group, kind: "oneshot", build }),
    cached: (variants: number, maxDur: number, build: (s: Syn) => number, meta: MetaIn & { reverse?: boolean; render?: (s: Syn) => number } = {}): OneShotCue => {
      const { reverse, render, ...rest } = meta;
      return { ...DEFAULTS, ...rest, group, kind: "oneshot", build, cache: { variants, maxDur, reverse, render } };
    },
    loop: (build: (s: Syn) => LoopInstance | void, meta: MetaIn = {}): LoopCue => ({ ...DEFAULTS, priority: 0.7, maxInstances: 24, ...meta, group, kind: "loop", build }),
  };
}
