/** Creature voices: `VOICES[voiceId][kind]` — each voice id has idle, alert,
 * attack, hurt and death variants. Pass `pitch` (size) per creature for
 * variety within a species: 0.8 for a big one, 1.25 for a runt. */

import type { OneShotCue } from "./types";
import { BEAST_VOICES } from "./voices/beasts";
import { DEAD_VOICES } from "./voices/dead";
import { VOICE_KINDS, type VoiceKind, type VoiceSet } from "./voices/kit";
import { MADE_VOICES } from "./voices/made";
import { VOICE_TRIM } from "./mix";

export { VOICE_KINDS, type VoiceKind };

const RAW: Record<string, VoiceSet> = { ...BEAST_VOICES, ...DEAD_VOICES, ...MADE_VOICES };

/** Voice sets with the mix sheet's per-kind trims applied. */
export const VOICES: Record<string, VoiceSet> = Object.fromEntries(
  Object.entries(RAW).map(([id, set]) => {
    const trim = VOICE_TRIM[id];
    const out = {} as VoiceSet;
    VOICE_KINDS.forEach((k, i) => (out[k] = { ...set[k], gain: set[k].gain * (trim?.[i] ?? 1) }));
    return [id, out];
  }),
);

/** Internal cue id for a voice kind (voices share the one-shot machinery). */
export const voiceCueId = (voiceId: string, kind: VoiceKind): string => `voice:${voiceId}:${kind}`;

/** Every voice kind flattened into cue-registry form. */
export const VOICE_CUES: Record<string, OneShotCue> = Object.fromEntries(
  Object.entries(VOICES).flatMap(([id, set]) => VOICE_KINDS.map((k) => [voiceCueId(id, k), set[k]] as const)),
);
