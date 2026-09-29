import { Registry } from "./registry";
import type { FactionDef, FactionId } from "./types";

/** Who fights whom. Creatures of hostile factions attack each other on
 * sight; predators hunt and eat prey (including prey corpses). Infighting
 * between otherwise-neutral creatures comes from grudges (being hit). */
export const FACTIONS = new Registry<FactionDef>("faction");

FACTIONS.register(
  { id: "delvers", name: "Delvers", hostile: [] },
  { id: "dead", name: "The Restless Dead", hostile: ["delvers", "carrion"], fears: [] },
  { id: "vermin", name: "Vermin", hostile: ["delvers"], fears: ["carrion"] },
  { id: "carrion", name: "Carrion-eaters", hostile: ["delvers"], prey: ["vermin"], fears: [] },
  { id: "archive", name: "The Archive", hostile: ["delvers", "deep"] },
  { id: "deep", name: "Things of the Deep Water", hostile: ["delvers"], prey: ["archive"] },
  { id: "choir", name: "The Choir", hostile: ["delvers", "fungal_beasts", "wild"] },
  { id: "fungal_beasts", name: "Fungal Beasts", hostile: ["delvers"], prey: ["choir"] },
  { id: "foundry", name: "The Foundry", hostile: ["delvers", "slag"] },
  { id: "slag", name: "Slag", hostile: ["delvers", "foundry"] },
  { id: "hive", name: "The Hive", hostile: ["delvers", "wild"] },
  { id: "frost", name: "The Frozen", hostile: ["delvers", "wild"] },
  { id: "flesh", name: "The Grown", hostile: ["delvers", "dream"], prey: ["delvers"] },
  { id: "orrery", name: "The Orrery", hostile: ["delvers", "unlit"] },
  { id: "unlit", name: "The Unlit", hostile: ["delvers", "orrery"] },
  { id: "dream", name: "The Dream Itself", hostile: ["delvers", "unlit"] },
  // Dissonants are wild, and the chord hates them back.
  { id: "wild", name: "Wild Things", hostile: ["delvers", "choir"], prey: ["vermin", "hive"] },
  { id: "helpers", name: "Kindly Things", hostile: [] },
  {
    id: "parasite",
    name: "Things That Feed",
    hostile: ["delvers"],
    prey: ["vermin", "carrion", "wild", "flesh", "hive", "fungal_beasts"],
  },
);

const cache = new Map<string, boolean>();

/** Does faction `a` attack faction `b` on sight? */
export function isHostile(a: FactionId, b: FactionId): boolean {
  if (a === b) return false;
  const key = `${a}>${b}`;
  let v = cache.get(key);
  if (v === undefined) {
    const fa = FACTIONS.find(a);
    v = !!fa && (fa.hostile.includes(b) || !!fa.prey?.includes(b));
    // Helpers are hostile to anything hostile to delvers.
    if (a === "helpers") v = !!FACTIONS.find(b)?.hostile.includes("delvers");
    if (b === "helpers") v = false;
    cache.set(key, v);
  }
  return v;
}

export function isPrey(hunter: FactionId, prey: FactionId): boolean {
  return !!FACTIONS.find(hunter)?.prey?.includes(prey);
}

export function fears(a: FactionId, b: FactionId): boolean {
  return !!FACTIONS.find(a)?.fears?.includes(b);
}
