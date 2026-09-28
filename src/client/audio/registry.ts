/** Every playable definition in one table (cues + creature-voice kinds), and
 * the background pre-render of all cached cues. */

import { CUES } from "./cues";
import { bank } from "./synth";
import type { CueDef } from "./types";
import { VOICE_CUES } from "./voices";

export const ALL_CUES: Record<string, CueDef> = { ...CUES, ...VOICE_CUES };

/** Pre-render every cached cue's variants, one cue at a time, yielding to the
 * main thread between cues. Cues play live until their buffers land. */
export async function warmCache(sampleRate: number): Promise<void> {
  for (const [id, cue] of Object.entries(ALL_CUES)) {
    if (cue.kind !== "oneshot" || !cue.cache) continue;
    const c = cue.cache;
    await bank.fill(id, c.variants, sampleRate, c.maxDur, c.render ?? cue.build, { reverse: c.reverse });
    await new Promise((r) => setTimeout(r, 0));
  }
}
