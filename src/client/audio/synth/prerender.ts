/** Offline pre-rendering: build a sound once in an OfflineAudioContext, trim
 * it, optionally reverse it, and cache a handful of variants so frequently
 * repeated sounds (footsteps, hits, clicks) cost one buffer source per play. */

import { makeSyn, type Syn } from "./core";
import { reverseBuffer } from "./physical";

export interface RenderOpts {
  channels?: number;
  reverse?: boolean;
  trim?: boolean;
}

export async function renderOffline(
  sampleRate: number,
  maxDur: number,
  build: (s: Syn) => unknown,
  opts: RenderOpts = {},
): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext({
    numberOfChannels: opts.channels ?? 1,
    length: Math.max(1, Math.ceil(maxDur * sampleRate)),
    sampleRate,
  });
  build(makeSyn(ctx, ctx.destination, 0.002, 1));
  let buf = await ctx.startRendering();
  if (opts.trim !== false) buf = trimBuffer(buf);
  if (opts.reverse) buf = reverseBuffer(buf);
  return buf;
}

/** Cut trailing near-silence (keeps a 10 ms pad). */
export function trimBuffer(buf: AudioBuffer, threshold = 1e-4): AudioBuffer {
  let last = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = d.length - 1; i > last; i--) {
      if (Math.abs(d[i] as number) > threshold) {
        last = i;
        break;
      }
    }
  }
  const len = Math.min(buf.length, last + Math.ceil(buf.sampleRate * 0.01) + 1);
  if (len >= buf.length) return buf;
  const out = new AudioBuffer({ length: len, sampleRate: buf.sampleRate, numberOfChannels: buf.numberOfChannels });
  for (let c = 0; c < buf.numberOfChannels; c++) out.copyToChannel(buf.getChannelData(c).subarray(0, len), c);
  return out;
}

export function measure(buf: AudioBuffer): { peak: number; rms: number } {
  let peak = 0;
  let sq = 0;
  let n = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) {
      const v = d[i] as number;
      const a = Math.abs(v);
      if (a > peak) peak = a;
      sq += v * v;
    }
    n += d.length;
  }
  return { peak, rms: Math.sqrt(sq / Math.max(1, n)) };
}

/** Variant cache keyed by cue id. Buffers are context-independent. */
export class BufferBank {
  private sets = new Map<string, AudioBuffer[]>();
  private last = new Map<string, number>();
  private jobs = new Map<string, Promise<void>>();

  /** A random variant, never the same one twice in a row. */
  get(key: string): AudioBuffer | null {
    const arr = this.sets.get(key);
    if (!arr || arr.length === 0) return null;
    let i = Math.floor(Math.random() * arr.length);
    if (arr.length > 1 && i === this.last.get(key)) i = (i + 1) % arr.length;
    this.last.set(key, i);
    return arr[i] as AudioBuffer;
  }

  has(key: string): boolean {
    return (this.sets.get(key)?.length ?? 0) > 0;
  }

  fill(key: string, variants: number, sampleRate: number, maxDur: number, build: (s: Syn) => unknown, opts?: RenderOpts): Promise<void> {
    const running = this.jobs.get(key);
    if (running) return running;
    const job = (async () => {
      const out: AudioBuffer[] = [];
      for (let i = 0; i < variants; i++) out.push(await renderOffline(sampleRate, maxDur, build, opts));
      this.sets.set(key, out);
    })().catch((err: unknown) => {
      this.jobs.delete(key);
      console.warn(`[audio] pre-render of ${key} failed`, err);
    });
    this.jobs.set(key, job);
    return job;
  }
}

/** The shared cache. */
export const bank = new BufferBank();
