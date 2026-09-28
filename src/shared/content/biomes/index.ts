import { stratumOf } from "../../config";
import { Registry } from "../registry";
import type { BiomeDef } from "../types";
import { UNDERCROFT } from "./undercroft";

export const BIOMES = new Registry<BiomeDef>("biome");
BIOMES.register(UNDERCROFT);

/** The biome of a floor number. Strata without a definition yet fall back
 * to the deepest defined one below them. */
export function biomeForFloor(floor: number): BiomeDef {
  const s = stratumOf(floor);
  let best: BiomeDef | null = null;
  for (const b of BIOMES.all()) if (b.index <= s && (!best || b.index > best.index)) best = b;
  return best ?? BIOMES.all()[0];
}
