/** Creature-voice declaration helper: every voice id provides the same five
 * kinds, each a one-shot cue on the `voice` bus with kind-appropriate
 * priority (a death outranks an idle mutter). */

import type { Syn } from "../synth";
import { cueKit, type CueMeta, type OneShotCue } from "../types";

export type VoiceKind = "idle" | "alert" | "attack" | "hurt" | "death";
export const VOICE_KINDS: readonly VoiceKind[] = ["idle", "alert", "attack", "hurt", "death"];

export type VoiceSet = Record<VoiceKind, OneShotCue>;
export type VoiceBuilds = Record<VoiceKind, (s: Syn) => number>;

const PRIORITY: Record<VoiceKind, number> = { idle: 0.3, alert: 0.6, attack: 0.7, hurt: 0.6, death: 0.75 };

type Meta = Partial<Omit<CueMeta, "group" | "bus">>;

export interface VoiceOpts extends Meta {
  /** Pre-render these kinds reversed: [variants, maxDur, forward render]. */
  reversed?: Partial<Record<VoiceKind, readonly [number, number, (s: Syn) => number]>>;
}

export function voiceSet(id: string, builds: VoiceBuilds, o: VoiceOpts = {}): VoiceSet {
  const { reversed, ...meta } = o;
  const kit = cueKit(`voice:${id}`);
  const out = {} as VoiceSet;
  for (const [kind, build] of Object.entries(builds) as [VoiceKind, (s: Syn) => number][]) {
    const m = { bus: "voice" as const, reverb: 0.3, maxInstances: kind === "idle" ? 3 : 4, pitchVar: 0.06, maxDist: 45, ...meta, priority: (meta.priority ?? 1) * PRIORITY[kind] };
    const rev = reversed?.[kind];
    out[kind] = rev ? kit.cached(rev[0], rev[1], build, { ...m, reverse: true, render: rev[2] }) : kit.one(build, m);
  }
  return out;
}
