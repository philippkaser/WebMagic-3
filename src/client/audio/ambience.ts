/** Ambience & music: `set(id)` cross-fades generative beds (./beds.ts),
 * `setDanger(v)` drives the tension layer, `stinger(id)` plays a one-shot
 * musical sting and ducks the bed underneath it. */

import { startBed, type BedRun } from "./bedkit";
import { BEDS } from "./beds";
import type { Engine } from "./engine";
import { DangerMusic, STINGERS } from "./music";
import { NULL_HANDLE, type SoundHandle } from "./types";
import { warnOnce } from "./util";

export { BEDS, STINGERS };

export class Ambience {
  readonly danger: DangerMusic;
  private run: BedRun | null = null;
  private id: string | null = null;

  constructor(private e: Engine) {
    this.danger = new DangerMusic(e);
  }

  get current(): string | null {
    return this.id;
  }

  set(id: string | null, fade = 4): void {
    if (id === this.id) return;
    const def = id ? BEDS[id] : undefined;
    if (id && !def) {
      warnOnce(`bed:${id}`, `unknown ambience "${id}"`);
      return;
    }
    this.run?.stop(fade);
    this.run = null;
    this.id = id;
    if (!def || !id) return;
    const ctx = this.e.ctx;
    this.run = startBed(ctx, this.e.bus.ambience, this.e.sends.ambience, this.e.sched, id, def, ctx.currentTime + 0.05, fade);
    this.danger.setRoot(def.root);
    // Fill the lookahead window right away so the bed starts on time.
    this.e.sched.advance(ctx.currentTime + 0.6);
  }

  setDanger(v: number): void {
    this.danger.set(v);
  }

  stinger(id: string): SoundHandle {
    const cue = STINGERS[id];
    if (!cue) {
      warnOnce(`stinger:${id}`, `unknown stinger "${id}"`);
      return NULL_HANDLE;
    }
    this.e.duckBus("ambience", 0.55, 2.5, 2.5);
    return this.e.play(`stinger:${id}`, cue);
  }
}
