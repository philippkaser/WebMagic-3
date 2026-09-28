import type { BiomeDef } from "../types";
import { Surface } from "../types";

export const UNDERCROFT: BiomeDef = {
  id: "undercroft",
  index: 0,
  name: "The Undercroft",
  epithet: "Where the first villagers buried themselves closer to God.",
  floors: [1, 10],
  generator: "crypt",
  palette: {
    floor: ["crypt.slab", "crypt.dirt_floor", "stone.cobble"],
    wall: ["crypt.brick", "crypt.ossuary", "crypt.plaster_old"],
    ceiling: ["crypt.ceiling"],
    trim: ["crypt.trim", "wood.beam"],
  },
  ceiling: [3, 5.5],
  lighting: {
    ambient: "#2a2238",
    ambientIntensity: 0.55,
    fogColor: "#07060a",
    fogDensity: 0.05,
    haze: 1.2,
    fixtureDensity: 1.6,
    fixture: "wall_torch",
    grade: { shadows: "#d8d4ff", highlights: "#ffe6c8", saturation: 0.85, contrast: 1.08 },
  },
  creatures: [
    { id: "grave_rat", weight: 5, group: [2, 5] },
    { id: "ossuary_shambler", weight: 3, group: [1, 2] },
    { id: "candle_wight", weight: 2, minDepth: 1, group: [1, 2] },
  ],
  props: [
    { id: "crate", weight: 3 },
    { id: "crate_small", weight: 2 },
    { id: "barrel", weight: 2 },
    { id: "oil_barrel", weight: 1.2 },
    { id: "powder_keg", weight: 0.4 },
    { id: "urn", weight: 4 },
    { id: "coffin", weight: 1.5 },
    { id: "candelabrum", weight: 1 },
  ],
  traps: [
    { id: "spike_plate", weight: 3 },
    { id: "dart_wall", weight: 2 },
    { id: "flame_vent", weight: 1 },
    { id: "collapse_floor", weight: 1 },
  ],
  liquids: [{ surface: Surface.Water, chance: 0.25 }],
  resources: ["grave_tallow", "ossuary_bone"],
  warden: "sexton",
  ambience: "undercroft",
};
