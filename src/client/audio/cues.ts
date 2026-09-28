/** The sound cue library: `CUES[id]` → how to synthesise it and how the
 * engine should treat it (bus, priority, reverb send, range, flood limits,
 * pre-render cache). Grouped by theme in ./cues/*. */

import { COMBAT_CUES } from "./cues/combat";
import { LOOT_CUES } from "./cues/loot";
import { MOVEMENT_CUES } from "./cues/movement";
import { RUN_CUES } from "./cues/run";
import { SPELL_CUES } from "./cues/spells";
import { WORLD_CUES } from "./cues/world";
import { CUE_TRIM, trimmed } from "./mix";
import type { CueDef } from "./types";

export type { CueDef };

export const CUES: Record<string, CueDef> = trimmed<CueDef>({
  ...SPELL_CUES,
  ...COMBAT_CUES,
  ...MOVEMENT_CUES,
  ...WORLD_CUES,
  ...LOOT_CUES,
  ...RUN_CUES,
}, CUE_TRIM);
