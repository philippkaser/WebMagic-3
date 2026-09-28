/** Spatial audio: the listener (driven every frame by the camera) and a
 * per-voice chain  voice gain → occlusion/air lowpass → occlusion gain →
 * PannerNode → bus,  with a reverb send tapped after the lowpass.
 *
 * Occlusion (0 = clear line of sight, 1 = behind thick walls) is computed by
 * the game; here it darkens the direct sound, lowers it, and makes it
 * relatively wetter — you hear the room around the wall, not the source.
 * Distance adds air absorption and a wetter mix. HRTF panners are used for
 * the nearest few voices only (they cost a convolution each); the rest use
 * equal-power panning. */

import { clamp, dist3, type Vec3 } from "./util";

export interface Listener {
  pos: Vec3;
  fwd: Vec3;
  up: Vec3;
}

/** Occlusion 0..1 → lowpass cutoff (Hz). */
export const occlusionCutoff = (o: number): number => 20000 * Math.pow(550 / 20000, clamp(o, 0, 1));
/** Air absorption: distant sounds lose their top end. */
export const airCutoff = (d: number): number => 20000 / (1 + d / 14);
/** WebAudio's "inverse" distance model, reproduced for culling / priority. */
export const distanceGain = (d: number, ref: number, rolloff = 1): number => ref / (ref + rolloff * Math.max(0, d - ref));
/** Direct-path attenuation from occlusion. */
export const occlusionGain = (o: number): number => 1 - 0.6 * clamp(o, 0, 1);

export interface ChainOpts {
  pos: Vec3 | null;
  occlusion: number;
  refDist: number;
  dest: AudioNode;
  send: AudioNode;
  sendLevel: number;
}

function setParam(p: AudioParam, v: number, now: number, tc: number): void {
  if (tc <= 0) p.setValueAtTime(v, now);
  else p.setTargetAtTime(v, now, tc);
}

/** One voice's spatial path. */
export class SpatialChain {
  readonly input: GainNode;
  pos: Vec3 | null;
  occlusion: number;
  private lp: BiquadFilterNode;
  private occ: GainNode;
  private panner: PannerNode | null = null;
  private send: GainNode;
  private hrtf = false;
  /** Last applied [cutoff, occlusion gain, reverb send]. */
  private last: [number, number, number] = [-1, -1, -1];

  constructor(
    private sp: Spatial,
    private o: ChainOpts,
  ) {
    const { ctx } = sp;
    this.pos = o.pos ? { x: o.pos.x, y: o.pos.y, z: o.pos.z } : null;
    this.occlusion = clamp(o.occlusion, 0, 1);
    this.input = ctx.createGain();
    this.lp = ctx.createBiquadFilter();
    this.lp.type = "lowpass";
    this.lp.Q.value = 0.5;
    this.occ = ctx.createGain();
    this.send = ctx.createGain();
    this.input.connect(this.lp).connect(this.occ);
    this.lp.connect(this.send).connect(o.send);
    if (o.pos) {
      const d = sp.distance(o.pos);
      this.hrtf = sp.claimHrtf(d);
      const p = ctx.createPanner();
      p.panningModel = this.hrtf ? "HRTF" : "equalpower";
      p.distanceModel = "inverse";
      p.refDistance = o.refDist;
      p.rolloffFactor = 1;
      p.maxDistance = 10000;
      this.panner = p;
      this.place(o.pos, 0);
      this.occ.connect(p).connect(o.dest);
    } else {
      this.occ.connect(o.dest);
    }
    this.refresh(0);
  }

  setPos(p: Vec3 | null): void {
    if (!p || !this.panner) return;
    this.pos = { x: p.x, y: p.y, z: p.z };
    this.place(p, 0.015);
    this.refresh(0.03);
  }

  setOcclusion(o: number): void {
    this.occlusion = clamp(o, 0, 1);
    this.refresh(0.06);
  }

  /** Recompute lowpass / occlusion gain / reverb send from distance + occlusion. */
  refresh(tc = 0.05): void {
    const now = this.sp.ctx.currentTime;
    const d = this.pos ? this.sp.distance(this.pos) : 0;
    const cut = Math.min(occlusionCutoff(this.occlusion), this.pos ? airCutoff(d) : 20000, this.sp.ctx.sampleRate * 0.45);
    const og = occlusionGain(this.occlusion);
    // Reverb falls off more slowly than the direct path (≈ 1/√d), and an
    // occluded source is heard mostly through the room.
    const dg = this.pos ? distanceGain(d, this.o.refDist) : 1;
    const wet = this.o.sendLevel * (0.3 + 0.7 * Math.sqrt(dg)) * (1 + 0.8 * this.occlusion);
    // Skip automation that would change nothing audible (called ~10×/s).
    const [c0, g0, w0] = this.last;
    if (Math.abs(cut / c0 - 1) < 0.02 && Math.abs(og - g0) < 0.01 && Math.abs(wet - w0) < 0.004) return;
    this.last = [cut, og, wet];
    setParam(this.lp.frequency, cut, now, tc);
    setParam(this.occ.gain, og, now, tc);
    setParam(this.send.gain, wet, now, tc);
  }

  dispose(): void {
    try {
      this.input.disconnect();
      this.lp.disconnect();
      this.occ.disconnect();
      this.send.disconnect();
      this.panner?.disconnect();
    } catch {
      // already disconnected
    }
    if (this.hrtf) this.sp.releaseHrtf();
    this.hrtf = false;
  }

  private place(p: Vec3, tc: number): void {
    const pn = this.panner;
    if (!pn) return;
    if (pn.positionX) {
      const now = this.sp.ctx.currentTime;
      setParam(pn.positionX, p.x, now, tc);
      setParam(pn.positionY, p.y, now, tc);
      setParam(pn.positionZ, p.z, now, tc);
    } else {
      (pn as unknown as { setPosition(x: number, y: number, z: number): void }).setPosition(p.x, p.y, p.z);
    }
  }
}

/** Listener state + panner budget. */
export class Spatial {
  readonly listener: Listener = {
    pos: { x: 0, y: 0, z: 0 },
    fwd: { x: 0, y: 0, z: -1 },
    up: { x: 0, y: 1, z: 0 },
  };
  /** HRTF panners in use / allowed, and the range they're worth it within. */
  hrtfActive = 0;
  maxHrtf = 10;
  hrtfRange = 18;

  constructor(readonly ctx: BaseAudioContext) {}

  /** Call every frame with the camera's world position / forward / up. */
  setListener(pos: Vec3, fwd: Vec3, up: Vec3 = { x: 0, y: 1, z: 0 }): void {
    const L = this.listener;
    L.pos = { x: pos.x, y: pos.y, z: pos.z };
    L.fwd = { x: fwd.x, y: fwd.y, z: fwd.z };
    L.up = { x: up.x, y: up.y, z: up.z };
    const l = this.ctx.listener;
    const now = this.ctx.currentTime;
    if (l.positionX) {
      const tc = 0.012;
      setParam(l.positionX, pos.x, now, tc);
      setParam(l.positionY, pos.y, now, tc);
      setParam(l.positionZ, pos.z, now, tc);
      setParam(l.forwardX, fwd.x, now, tc);
      setParam(l.forwardY, fwd.y, now, tc);
      setParam(l.forwardZ, fwd.z, now, tc);
      setParam(l.upX, up.x, now, tc);
      setParam(l.upY, up.y, now, tc);
      setParam(l.upZ, up.z, now, tc);
    } else {
      const legacy = l as unknown as {
        setPosition(x: number, y: number, z: number): void;
        setOrientation(x: number, y: number, z: number, ux: number, uy: number, uz: number): void;
      };
      legacy.setPosition(pos.x, pos.y, pos.z);
      legacy.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z);
    }
  }

  distance(p: Vec3): number {
    return dist3(p, this.listener.pos);
  }

  chain(o: ChainOpts): SpatialChain {
    return new SpatialChain(this, o);
  }

  claimHrtf(d: number): boolean {
    if (d > this.hrtfRange || this.hrtfActive >= this.maxHrtf) return false;
    this.hrtfActive++;
    return true;
  }

  releaseHrtf(): void {
    this.hrtfActive = Math.max(0, this.hrtfActive - 1);
  }
}
