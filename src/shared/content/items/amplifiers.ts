import { Registry } from "../registry";
import type { AmplifierDef, Slot } from "../types";
import { Surface } from "../types";

/** Spell amplifiers (DESIGN.md §5.2.1): affixes that rewrite how spells are
 * delivered. Applied by shared/sim/spells/amplify.ts. */
export const AMPLIFIERS = new Registry<AmplifierDef>("amplifier");

const WEAPON: Slot[] = ["focus"];
const JEWEL: Slot[] = ["focus", "amulet", "ring"];

AMPLIFIERS.register(
  { id: "twinned", name: "Twinned", desc: "+1 projectile", effect: { type: "projectiles", count: 1 }, slots: JEWEL, weight: 10, minIlvl: 3, group: "count" },
  { id: "legion", name: "Legion", desc: "+2 projectiles", effect: { type: "projectiles", count: 2 }, slots: WEAPON, weight: 3, minIlvl: 25, group: "count" },
  { id: "seeking", name: "Seeking", desc: "Projectiles home in on hostiles", effect: { type: "homing", turn: 3.5 }, slots: JEWEL, weight: 9, minIlvl: 2 },
  { id: "ricochet", name: "Ricocheting", desc: "Projectiles bounce off walls twice", effect: { type: "bounces", count: 2 }, slots: JEWEL, weight: 8, minIlvl: 4 },
  { id: "piercing", name: "Piercing", desc: "Projectiles pass through 2 bodies", effect: { type: "pierce", count: 2 }, slots: JEWEL, weight: 8, minIlvl: 3 },
  { id: "splitting", name: "Splitting", desc: "On impact, burst into 3 lesser projectiles", effect: { type: "split", count: 3, damage: 0.35 }, slots: WEAPON, weight: 6, minIlvl: 8 },
  { id: "volatile", name: "Volatile", desc: "Projectiles explode on impact", effect: { type: "volatile", radius: 1.8 }, slots: JEWEL, weight: 6, minIlvl: 6 },
  { id: "chaining", name: "Chaining", desc: "Hits arc to 2 nearby bodies", effect: { type: "chain", count: 2, range: 4.5 }, slots: JEWEL, weight: 6, minIlvl: 10 },
  { id: "orbiting", name: "Orbiting", desc: "Projectiles circle you before flying out", effect: { type: "orbit", duration: 1.2 }, slots: WEAPON, weight: 4, minIlvl: 12 },
  { id: "echoing", name: "Echoing", desc: "The cast repeats after a heartbeat", effect: { type: "echo", delay: 0.4 }, slots: ["focus", "amulet"], weight: 4, minIlvl: 15 },
  { id: "oil_trail", name: "Oozing", desc: "Projectiles leave a trail of oil", effect: { type: "trail", surface: Surface.Oil }, slots: JEWEL, weight: 4, minIlvl: 5, group: "trail" },
  { id: "fire_trail", name: "Smouldering", desc: "Projectiles leave a trail of fire", effect: { type: "trail", surface: Surface.Fire }, slots: JEWEL, weight: 3, minIlvl: 12, group: "trail" },
  { id: "frost_trail", name: "Rime-tailed", desc: "Projectiles leave a trail of ice", effect: { type: "trail", surface: Surface.Ice }, slots: JEWEL, weight: 3, minIlvl: 12, group: "trail" },
  { id: "heavy", name: "Heavy", desc: "Projectiles fall and hit three times as hard", effect: { type: "heavy" }, slots: JEWEL, weight: 6, minIlvl: 4 },
  { id: "magnetic", name: "Magnetic", desc: "Impacts pull nearby bodies inward", effect: { type: "magnetic", strength: 14 }, slots: JEWEL, weight: 4, minIlvl: 14 },
  { id: "timed", name: "Fused", desc: "Projectiles stick and detonate after 1.5 s", effect: { type: "timed", fuse: 1.5 }, slots: WEAPON, weight: 4, minIlvl: 9 },
  { id: "to_fire", name: "Searing", desc: "Spells become fire", effect: { type: "convert", element: "fire" }, slots: JEWEL, weight: 5, minIlvl: 2, group: "convert" },
  { id: "to_frost", name: "Rimed", desc: "Spells become frost", effect: { type: "convert", element: "frost" }, slots: JEWEL, weight: 5, minIlvl: 2, group: "convert" },
  { id: "to_storm", name: "Crackling", desc: "Spells become storm", effect: { type: "convert", element: "storm" }, slots: JEWEL, weight: 5, minIlvl: 5, group: "convert" },
  { id: "to_void", name: "Hollow", desc: "Spells become void", effect: { type: "convert", element: "void" }, slots: JEWEL, weight: 3, minIlvl: 20, group: "convert" },
  { id: "to_venom", name: "Festering", desc: "Spells become venom", effect: { type: "convert", element: "venom" }, slots: JEWEL, weight: 4, minIlvl: 8, group: "convert" },
  { id: "vampiric", name: "Vampiric", desc: "10% of damage dealt returns as health", effect: { type: "vampiric", fraction: 0.1 }, slots: ["amulet", "ring"], weight: 4, minIlvl: 10 },
  { id: "swift", name: "Swift", desc: "Projectiles fly 40% faster", effect: { type: "speed", mult: 1.4 }, slots: JEWEL, weight: 8, minIlvl: 1 },
  { id: "swollen", name: "Swollen", desc: "Projectiles are 60% larger", effect: { type: "size", mult: 1.6 }, slots: JEWEL, weight: 7, minIlvl: 1 },
);
