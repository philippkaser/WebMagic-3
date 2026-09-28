/** Content entry point: importing this registers every definition. Engine
 * code imports registries from here. */
export { BIOMES, biomeForFloor } from "./biomes";
export { CREATURES } from "./creatures";
export { FACTIONS, fears, isHostile, isPrey } from "./factions";
export { AFFIXES } from "./items/affixes";
export { AMPLIFIERS } from "./items/amplifiers";
export { ITEMS, STARTER_BOOTS, STARTER_FOCUS, STARTER_ROBE } from "./items/bases";
export { PROPS, TRAPS } from "./props";
export { SPELLS } from "./spells";
export { STATUSES } from "./statuses";
export { SURFACES, surfaceDef } from "./surfaces";
export * from "./types";
