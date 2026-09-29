import { UNDERCROFT_CREATURES } from "../../../../shared/content/creatures/undercroft";
import type { CreatureDef } from "../../../../shared/content/types";

/** Attack timings come straight from content so telegraphs stay in sync
 * with the sim when designers retune windups. */
const DEFS = new Map<string, CreatureDef>(UNDERCROFT_CREATURES.map((d) => [d.model, d]));

export interface Timing {
  windup: number;
  recover: number;
}

export function timings(model: string, fallback: Timing[]): Timing[] {
  const d = DEFS.get(model);
  if (!d) return fallback;
  return d.attacks.map((a, i) => ({ windup: a.windup ?? fallback[i]?.windup ?? 0.5, recover: a.recover ?? fallback[i]?.recover ?? 0.5 }));
}

export function timing(t: Timing[], variant: number): Timing {
  return t[Math.max(0, Math.min(t.length - 1, variant))] ?? { windup: 0.5, recover: 0.5 };
}
