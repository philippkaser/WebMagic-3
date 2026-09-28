/** WebMagic III audio — the one public entry point.
 *
 *   import { audio } from "../audio";
 *   audio.play("hit_bone", { pos, occlusion });
 *   const torch = audio.loop("torch_loop", { pos });   // …later torch.stop()
 *   audio.voice("rat", "alert", { pos, pitch: 1.2 });
 *   audio.setListener(camPos, camForward, camUp);      // every frame
 *   audio.setAmbience("undercroft"); audio.setEnvironment("small_crypt");
 *
 * Everything is synthesised at runtime. The AudioContext is created lazily
 * on the first user gesture (pointerdown / keydown / touchend listeners are
 * armed at import; `unlock()` may also be called from your own handler).
 * Before that, one-shots are silent no-ops, loops are remembered and start on
 * unlock, and settings (listener, ambience, environment, volumes, danger) are
 * stored and applied. Unknown ids warn once and no-op. */

import { Ambience, BEDS, STINGERS } from "./ambience";
import { CUES } from "./cues";
import { BUS_DEFAULTS, Engine } from "./engine";
import { warmCache } from "./registry";
import { ROOMS, type RoomId } from "./reverb";
import { NULL_HANDLE, type BusId, type LoopCue, type PlayOpts, type SoundHandle, type Vec3 } from "./types";
import { warnOnce } from "./util";
import { VOICE_KINDS, VOICES, voiceCueId, type VoiceKind } from "./voices";

export type { BusId, PlayOpts, SoundHandle, Vec3, VoiceKind, RoomId };

let engine: Engine | null = null;
let amb: Ambience | null = null;

const state = {
  listener: null as null | { pos: Vec3; fwd: Vec3; up?: Vec3 },
  env: "small_crypt" as RoomId,
  ambience: null as string | null,
  danger: 0,
  volumes: { ...BUS_DEFAULTS } as Record<BusId, number>,
};

/** A loop requested before unlock: keeps its state, becomes real on unlock. */
class DeferredLoop implements SoundHandle {
  inner: SoundHandle | null = null;
  private stopped = false;
  constructor(
    readonly id: string,
    readonly cue: LoopCue,
    readonly o: PlayOpts,
  ) {}
  setPos(p: Vec3 | null): void {
    if (p) this.o.pos = { x: p.x, y: p.y, z: p.z };
    this.inner?.setPos(p);
  }
  setVolume(v: number): void {
    this.o.volume = v;
    this.inner?.setVolume(v);
  }
  setOcclusion(x: number): void {
    this.o.occlusion = x;
    this.inner?.setOcclusion(x);
  }
  stop(fade?: number): void {
    this.stopped = true;
    this.inner?.stop(fade);
    const i = pending.indexOf(this);
    if (i >= 0) pending.splice(i, 1);
  }
  get playing(): boolean {
    return !this.stopped;
  }
  adopt(e: Engine): void {
    if (!this.stopped) this.inner = e.addLoop(this.id, this.cue, this.o);
  }
}
const pending: DeferredLoop[] = [];

function unlock(): Promise<void> {
  if (typeof window === "undefined" || typeof AudioContext === "undefined") return Promise.resolve();
  if (!engine) {
    let ctx: AudioContext;
    try {
      ctx = new AudioContext({ latencyHint: "interactive" });
    } catch (err) {
      warnOnce("ctx", `AudioContext unavailable: ${String(err)}`);
      return Promise.resolve();
    }
    const e = new Engine(ctx, { realtime: true });
    engine = e;
    for (const [bus, v] of Object.entries(state.volumes) as [BusId, number][]) e.setVolume(bus, v);
    e.setEnvironment(state.env, 0.01);
    if (state.listener) e.setListener(state.listener.pos, state.listener.fwd, state.listener.up);
    amb = new Ambience(e);
    amb.setDanger(state.danger);
    amb.set(state.ambience, 3);
    for (const d of pending.splice(0)) d.adopt(e);
    void warmCache(ctx.sampleRate);
  }
  const ctx = engine.ctx as AudioContext;
  if (ctx.state !== "running") return ctx.resume().catch(() => undefined);
  return Promise.resolve();
}

// Arm first-gesture unlock (and re-resume after the OS suspends us).
if (typeof window !== "undefined") {
  const onGesture = () => {
    if (!engine || (engine.ctx as AudioContext).state !== "running") void unlock();
  };
  for (const ev of ["pointerdown", "keydown", "touchend", "mousedown"]) window.addEventListener(ev, onGesture, { capture: true, passive: true });
}

function play(id: string, opts: PlayOpts = {}): SoundHandle {
  const cue = CUES[id];
  if (!cue) {
    warnOnce(`cue:${id}`, `unknown cue "${id}"`);
    return NULL_HANDLE;
  }
  if (cue.kind === "loop") return loop(id, opts);
  return engine ? engine.play(id, cue, opts) : NULL_HANDLE;
}

function loop(id: string, opts: PlayOpts = {}): SoundHandle {
  const cue = CUES[id];
  if (!cue) {
    warnOnce(`cue:${id}`, `unknown cue "${id}"`);
    return NULL_HANDLE;
  }
  if (cue.kind !== "loop") {
    warnOnce(`notloop:${id}`, `"${id}" is a one-shot; playing it once`);
    return play(id, opts);
  }
  if (!engine) {
    const d = new DeferredLoop(id, cue, { ...opts, pos: opts.pos ? { ...opts.pos } : null });
    pending.push(d);
    return d;
  }
  return engine.addLoop(id, cue, opts);
}

function voice(voiceId: string, kind: VoiceKind, opts: PlayOpts = {}): SoundHandle {
  const set = VOICES[voiceId];
  if (!set) {
    warnOnce(`voice:${voiceId}`, `unknown voice "${voiceId}"`);
    return NULL_HANDLE;
  }
  const cue = set[kind];
  if (!cue) {
    warnOnce(`voicekind:${kind}`, `unknown voice kind "${kind}" (use ${VOICE_KINDS.join(", ")})`);
    return NULL_HANDLE;
  }
  return engine ? engine.play(voiceCueId(voiceId, kind), cue, opts) : NULL_HANDLE;
}

export const audio = {
  /** Create / resume the AudioContext. Call from a user-gesture handler (it
   * is also armed automatically on the first pointer / key event). */
  unlock,

  /** True once the context exists and is running. */
  get unlocked(): boolean {
    return !!engine && (engine.ctx as AudioContext).state === "running";
  },

  /** Play a cue by id. Positional when `pos` is given. Loop ids return a
   * loop handle (see `loop`). Always returns a handle (inert if dropped). */
  play,

  /** Start a looping cue; keep the handle and call stop() when done. Loops
   * are virtual: only the most audible ~12 are synthesised at any time. */
  loop,

  /** A creature vocalisation: voice id × kind (idle|alert|attack|hurt|death). */
  voice,

  /** Camera pose, every frame (three.js convention: forward -Z, up +Y). */
  setListener(pos: Vec3, forward: Vec3, up?: Vec3): void {
    state.listener = { pos, fwd: forward, up };
    engine?.setListener(pos, forward, up);
  },

  /** Cross-fade to an ambience bed (null = silence). */
  setAmbience(id: string | null, fade = 4): void {
    if (id && !BEDS[id]) {
      warnOnce(`bed:${id}`, `unknown ambience "${id}"`);
      return;
    }
    state.ambience = id;
    amb?.set(id, fade);
  },

  /** Combat intensity 0..1 → tension music. */
  setDanger(v: number): void {
    state.danger = v;
    amb?.setDanger(v);
  },

  /** One-shot musical stinger (ducks the ambience). */
  stinger(id: string): SoundHandle {
    if (!STINGERS[id]) {
      warnOnce(`stinger:${id}`, `unknown stinger "${id}"`);
      return NULL_HANDLE;
    }
    return amb ? amb.stinger(id) : NULL_HANDLE;
  },

  /** Re-tune the shared reverb to a room type (cross-fades). */
  setEnvironment(id: RoomId | string): void {
    if (!(id in ROOMS)) {
      warnOnce(`room:${id}`, `unknown environment "${id}"`);
      return;
    }
    state.env = id as RoomId;
    engine?.setEnvironment(id as RoomId);
  },

  /** Bus volume 0..2 (1 = unity). Buses: master, sfx, ambience, music, ui, voice. */
  setVolume(bus: BusId, v: number): void {
    if (!(bus in state.volumes)) {
      warnOnce(`bus:${bus}`, `unknown bus "${bus}"`);
      return;
    }
    state.volumes[bus] = v;
    engine?.setVolume(bus, v);
  },

  getVolume(bus: BusId): number {
    return state.volumes[bus] ?? 0;
  },

  /** Fade out every sound and forget every loop (e.g. between floors). */
  stopAll(fade = 0.2): void {
    for (const d of pending.splice(0)) d.stop();
    engine?.stopAll(fade);
  },

  /** The reverb environment that suits an ambience bed. */
  roomFor(ambienceId: string): RoomId | null {
    return BEDS[ambienceId]?.room ?? null;
  },

  cues: (): string[] => Object.keys(CUES),
  loopCues: (): string[] => Object.keys(CUES).filter((id) => CUES[id]?.kind === "loop"),
  voices: (): string[] => Object.keys(VOICES),
  voiceKinds: (): readonly VoiceKind[] => VOICE_KINDS,
  ambiences: (): string[] => Object.keys(BEDS),
  stingers: (): string[] => Object.keys(STINGERS),
  environments: (): string[] => Object.keys(ROOMS),

  /** Debug counters for overlays. */
  stats(): { unlocked: boolean; voices: number; loops: number; realLoops: number; hrtf: number; danger: number; ambience: string | null } {
    const s = engine?.stats();
    return {
      unlocked: audio.unlocked,
      voices: s?.voices ?? 0,
      loops: (s?.loops ?? 0) + pending.length,
      realLoops: s?.realLoops ?? 0,
      hrtf: s?.hrtf ?? 0,
      danger: amb?.danger.value ?? 0,
      ambience: state.ambience,
    };
  },
};
