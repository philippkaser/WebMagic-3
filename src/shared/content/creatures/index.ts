import { Registry } from "../registry";
import type { CreatureDef } from "../types";
import { UNDERCROFT_CREATURES } from "./undercroft";

export const CREATURES = new Registry<CreatureDef>("creature");
CREATURES.register(...UNDERCROFT_CREATURES);
