/** Content definition types — the data contracts for everything that fills
 * the Godwell. Content is DATA: a new creature, spell, item, prop, trap or
 * biome is a definition object registered in shared/content/*, not new
 * engine code. Behaviour is implemented once, generically, in shared/sim and
 * parameterised by these definitions.
 *
 * Conventions
 *  - ids are lowercase snake_case strings, unique per kind ("candle_wight").
 *  - numbers are "floor 1" values; the sim scales them by floorScale().
 *  - distances in metres, times in seconds, angles in degrees (in data).
 *  - `model` / `material` / sound ids name client-side registries; the pure
 *    layers never import them, they only carry the string. */

// ── Elements, statuses, surfaces ────────────────────────────────────────────

export type Element = "physical" | "arcane" | "fire" | "frost" | "storm" | "void" | "venom" | "force";

export const ELEMENTS: readonly Element[] = [
  "physical",
  "arcane",
  "fire",
  "frost",
  "storm",
  "void",
  "venom",
  "force",
];

export type StatusId =
  | "burning"
  | "wet"
  | "chilled"
  | "frozen"
  | "shocked"
  | "poisoned"
  | "oiled"
  | "stunned"
  | "slowed"
  | "webbed"
  | "bleeding"
  | "feared"
  | "blessed"
  | "invisible";

export interface StatusDef {
  id: StatusId;
  name: string;
  desc: string;
  /** Default duration when applied without one (s). */
  duration: number;
  /** Damage per second while active (scaled by the applier's power). */
  dps?: number;
  element?: Element;
  /** Multiplies movement speed while active. */
  moveMult?: number;
  /** Multiplies damage taken while active. */
  damageTakenMult?: number;
  /** Cannot act (attack/cast) while active. */
  incapacitates?: boolean;
  /** Statuses removed when this one is applied (wet removes burning…). */
  removes?: StatusId[];
  /** Applying this status while `when` is active converts to `into`. */
  combos?: { when: StatusId; into: StatusId }[];
  /** UI / fx tint. */
  color: string;
}

/** Surface kinds are small integers — they live in a Uint8Array grid. */
export enum Surface {
  None = 0,
  Water = 1,
  Oil = 2,
  Blood = 3,
  Ice = 4,
  Fire = 5,
  Web = 6,
  Acid = 7,
  Spores = 8,
  Honey = 9,
  Ash = 10,
  Slime = 11,
  Ink = 12,
  Lava = 13,
}

export interface SurfaceDef {
  kind: Surface;
  id: string;
  name: string;
  /** Ground friction multiplier (ice ≈ 0.05). */
  friction: number;
  moveMult: number;
  /** Status applied to bodies standing in it (refreshed each tick). */
  applies?: StatusId;
  /** Damage per second to bodies standing in it. */
  dps?: number;
  dpsElement?: Element;
  /** Seconds until it fades on its own (0 = permanent). */
  lifetime: number;
  /** What an element does to this surface (fire on oil → Fire…). */
  reactions?: Partial<Record<Element, Surface>>;
  /** Fire spreads into flammable neighbours. */
  flammable?: boolean;
  /** Render hints (client). */
  color: string;
  roughness: number;
  emissive?: number;
  /** Liquids reflect (SSR) and ripple. */
  liquid?: boolean;
}

// ── Effects (shared by spells, traps, props, consumables, attacks) ─────────

export type EffectSpec =
  | { type: "damage"; amount: number; element: Element }
  | {
      type: "explode";
      radius: number;
      damage: number;
      element: Element;
      /** Radial impulse (N·s at the centre, linear falloff). */
      impulse: number;
      /** Fraction of damage dealt to the source's own team. Default 1. */
      friendlyFactor?: number;
    }
  | { type: "impulse"; strength: number; up?: number }
  | { type: "status"; status: StatusId; duration?: number; chance?: number }
  | { type: "surface"; surface: Surface; radius: number }
  | { type: "pull"; radius: number; strength: number; duration: number }
  | { type: "chain"; count: number; range: number; damage: number; element: Element }
  | { type: "heal"; amount: number }
  | { type: "mana"; amount: number }
  | { type: "spawn"; kind: "creature" | "prop"; def: string; count?: number }
  | { type: "light"; color: string; intensity: number; radius: number; duration: number }
  | { type: "noise"; loudness: number }
  | { type: "teleport"; range: number }
  | { type: "fx"; fx: string };

// ── Spells (player focus/relic abilities, creature spell attacks) ──────────

export type SpellDelivery =
  | {
      kind: "projectile";
      speed: number;
      radius: number;
      /** 0 = straight line; 1 = full gravity (lobbed). */
      gravity: number;
      lifetime: number;
      count?: number;
      /** Cone half-angle for multi-projectile casts (deg). */
      spread?: number;
      pierce?: number;
      bounces?: number;
      /** Turn rate toward targets (rad/s); 0 = none. */
      homing?: number;
      /** Effects at the impact point / on the struck body. */
      onHit: EffectSpec[];
      /** Explodes/applies onHit when lifetime ends instead of vanishing. */
      detonateOnExpire?: boolean;
    }
  | { kind: "beam"; range: number; width: number; tick: number; onHit: EffectSpec[] }
  | { kind: "cone"; range: number; angle: number; onHit: EffectSpec[] }
  | { kind: "nova"; radius: number; onHit: EffectSpec[] }
  | { kind: "self"; effects: EffectSpec[] }
  | { kind: "dash"; distance: number; duration: number; effects?: EffectSpec[] }
  /** Telekinesis: grab a prop/creature under the reticle, hold, throw. */
  | { kind: "grasp"; range: number; maxMass: number; throwSpeed: number }
  | { kind: "summon"; creature: string; count: number; duration: number }
  | { kind: "wall"; length: number; height: number; material: "ice" | "stone" | "bone"; duration: number };

export interface SpellDef {
  id: string;
  name: string;
  desc: string;
  element: Element;
  mana: number;
  cooldown: number;
  /** Hold-to-channel spells drain `mana` per second instead of per cast. */
  channeled?: boolean;
  delivery: SpellDelivery;
  /** Loudness of the cast (wakes creatures). */
  noise: number;
  vfx: { color: string; trail?: string; light?: { color: string; intensity: number; radius: number } };
  sfx?: { cast?: string; hit?: string };
}

// ── Items ───────────────────────────────────────────────────────────────────

export type Slot = "focus" | "relic" | "hood" | "robe" | "boots" | "amulet" | "ring";
export const SLOTS: readonly Slot[] = ["focus", "relic", "hood", "robe", "boots", "amulet", "ring"];

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export const RARITIES: readonly Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

export type StatKey =
  | "maxHealth"
  | "maxMana"
  | "healthRegen"
  | "manaRegen"
  | "spellPower" // % bonus damage
  | "castSpeed" // % faster cooldowns
  | "moveSpeed" // %
  | "armor" // flat physical reduction
  | "resFire"
  | "resFrost"
  | "resStorm"
  | "resVenom"
  | "resVoid"
  | "resArcane"
  | "critChance" // %
  | "critDamage" // % bonus on crit
  | "lightRadius" // m
  | "stealth" // % reduced notice range
  | "luck" // % better drops
  | "jumpPower" // %
  | "extraJumps"
  | "glide" // >0 = can glide
  | "lifeOnKill"
  | "manaOnKill"
  | "projectileSpeed" // %
  | "extraProjectiles"
  | "statusChance" // % bonus to status application
  | "knockback" // % more impulse
  | "thorns"; // damage returned to melee attackers

export type StatBlock = Partial<Record<StatKey, number>>;

export type ItemCategory = "gear" | "consumable" | "material" | "key" | "treasure";

export interface ItemBaseDef {
  id: string;
  name: string;
  category: ItemCategory;
  /** Gear only. */
  slot?: Slot;
  /** Single glyph used by the UI everywhere the item appears. */
  glyph: string;
  /** UI/model hue. */
  color: string;
  /** Floor range where this base drops naturally. */
  floors: [number, number];
  /** Relative drop weight within its floor range. */
  weight: number;
  /** Base gold value at ilvl 1 (scaled by ilvl & rarity). */
  value: number;
  flavor?: string;
  /** Client model id (held staff, pickup mesh). */
  model?: string;
  /** Focus (weapon): the two spells and a damage multiplier. */
  focus?: { primary: string; secondary: string; power: number };
  /** Relic: the active ability (a spell id) on Shift. */
  relic?: { ability: string };
  /** Implicit stats at ilvl 1; scaled with ilvl by game/items.ts. */
  stats?: StatBlock;
  /** Consumable: effects on use; stack size. */
  use?: EffectSpec[];
  /** Consumable special actions handled by the server (e.g. "ascend"). */
  action?: "ascend" | "reveal_map" | "throw";
  /** Throwables: the projectile spell thrown. */
  throwSpell?: string;
  stack?: number;
  /** Legendary uniques: fixed affixes and a special mechanic id. */
  unique?: { affixes: { id: string; value: number }[]; mechanic?: string };
  /** Materials: which stratum they come from (0..9). */
  stratum?: number;
}

export interface AffixDef {
  id: string;
  /** Prefix ("Searing …") or suffix ("… of the Deep"). */
  kind: "prefix" | "suffix";
  name: string;
  slots: readonly Slot[];
  stat: StatKey;
  /** Value range at ilvl 1 and at ilvl 100 (linearly interpolated). */
  min: [number, number];
  max: [number, number];
  weight: number;
  minIlvl?: number;
}

/** Spell amplifiers rewrite how a focus' spells are *delivered* (see
 * DESIGN.md §5.2.1). They stack across all equipped gear. */
export type AmpEffect =
  | { type: "projectiles"; count: number }
  | { type: "homing"; turn: number }
  | { type: "bounces"; count: number }
  | { type: "pierce"; count: number }
  | { type: "split"; count: number; damage: number }
  | { type: "volatile"; radius: number }
  | { type: "chain"; count: number; range: number }
  | { type: "orbit"; duration: number }
  | { type: "echo"; delay: number }
  | { type: "trail"; surface: Surface }
  | { type: "heavy" }
  | { type: "magnetic"; strength: number }
  | { type: "timed"; fuse: number }
  | { type: "convert"; element: Element }
  | { type: "vampiric"; fraction: number }
  | { type: "speed"; mult: number }
  | { type: "size"; mult: number };

export interface AmplifierDef {
  id: string;
  /** Adjective shown in the item name ("Ricocheting Ember Staff"). */
  name: string;
  desc: string;
  effect: AmpEffect;
  /** Gear slots it may roll on. */
  slots: readonly Slot[];
  weight: number;
  minIlvl: number;
  /** Amplifiers sharing a group don't roll together (two trails…). */
  group?: string;
}

/** A concrete item. Server-authoritative; clients only view them. */
export interface ItemInstance {
  uid: string;
  base: string;
  ilvl: number;
  rarity: Rarity;
  affixes: { id: string; value: number }[];
  /** Spell amplifier ids (see AmplifierDef). */
  amps?: string[];
  qty: number;
  /** Picked up during the current run — lost on death. */
  run?: boolean;
  /** Loaned by the Quartermaster — returned when the run ends. */
  kit?: boolean;
  /** Crafting upgrades applied (+1, +2 …). */
  upgrade?: number;
}

// ── Creatures & factions ───────────────────────────────────────────────────

export type FactionId =
  | "delvers"
  | "dead"
  | "vermin"
  | "carrion"
  | "archive"
  | "deep"
  | "choir"
  | "fungal_beasts"
  | "foundry"
  | "slag"
  | "hive"
  | "frost"
  | "flesh"
  | "orrery"
  | "unlit"
  | "dream"
  | "wild"
  | "helpers";

export interface FactionDef {
  id: FactionId;
  name: string;
  /** Factions this one attacks on sight. */
  hostile: FactionId[];
  /** Factions it hunts as food (implies hostile, and it feeds on their corpses). */
  prey?: FactionId[];
  /** Factions it avoids / flees from when weaker. */
  fears?: FactionId[];
}

export type AttackKind = "melee" | "lunge" | "ranged" | "spell" | "breath" | "slam" | "explode" | "grab";

export interface AttackDef {
  id: string;
  kind: AttackKind;
  /** Range at which the attack is attempted (m). */
  range: number;
  minRange?: number;
  /** Telegraph time before the hit lands (s) — readable chaos. */
  windup: number;
  recover: number;
  cooldown: number;
  damage: number;
  element: Element;
  /** Knockback impulse applied to the target. */
  impulse?: number;
  /** Lunge/leap speed (m/s). */
  leapSpeed?: number;
  /** Ranged/spell attacks cast this spell id. */
  spell?: string;
  effects?: EffectSpec[];
  /** Relative preference when several attacks are in range. */
  weight?: number;
}

/** Behaviour ids implemented in shared/sim/ai/behaviors. */
export type BehaviorId =
  | "wander"
  | "patrol"
  | "guard"
  | "hunt"
  | "kite" // keep distance, shoot
  | "flee"
  | "feed" // eat corpses / prey
  | "investigate" // go to last noise
  | "swarm" // stick to pack, surround target
  | "ambush" // wait hidden until close
  | "retaliate"
  | "avoid_hazard"
  | "tend" // relight candles / repair / guard nest
  | "sleep";

export interface CreatureDef {
  id: string;
  name: string;
  desc: string;
  faction: FactionId;
  /** Collision capsule. */
  radius: number;
  height: number;
  mass: number;
  movement: "walk" | "fly" | "hover" | "swim" | "burrow" | "static";
  stats: {
    hp: number;
    armor?: number;
    speed: number;
    /** Chasing speed multiplier. */
    runMult?: number;
    turnRate: number; // deg/s
    res?: Partial<Record<Element, number>>; // 0..1 resistance, <0 weakness
  };
  senses: {
    sight: number;
    fov: number; // deg
    hearing: number;
    /** Sees without light. Otherwise sight is shortened in darkness. */
    darkvision?: boolean;
  };
  /** 0..1 — trap awareness, tactics, use of cover. */
  intelligence: number;
  temperament: {
    aggression: number; // 0..1 chance to engage on sight
    /** Flees below this hp fraction (0 = never). */
    courage: number;
    /** Alerts same-faction allies within this radius when it spots a foe. */
    callRadius?: number;
  };
  attacks: AttackDef[];
  behaviors: BehaviorId[];
  immune?: StatusId[];
  /** Burns readily (paper, dry bone, fur). */
  flammable?: boolean;
  /** Light the creature carries (candle wights, lantern bearers). */
  light?: { color: string; intensity: number; radius: number };
  /** Emitted on death (e.g. bloated things burst). */
  onDeath?: EffectSpec[];
  drops: { gold: number; goldChance: number; lootChance: number; materials?: { id: string; chance: number }[] };
  /** Client model id and voice set. */
  model: string;
  voice?: string;
  /** Scales the model (variants of one mesh). */
  scale?: number;
  /** Wardens (bosses) have phases and never flee. */
  warden?: { title: string; phases: number };
  /** Helpers never target delvers. */
  helper?: boolean;
}

// ── Props, traps, interactables ────────────────────────────────────────────

export type PropMaterial = "wood" | "stone" | "metal" | "ceramic" | "cloth" | "glass" | "bone" | "flesh" | "wax" | "paper";

export interface PropDef {
  id: string;
  name: string;
  shape: { kind: "box"; half: [number, number, number] } | { kind: "cylinder"; radius: number; halfHeight: number } | { kind: "ball"; radius: number };
  /** 0 = static (immovable, e.g. altar). */
  mass: number;
  material: PropMaterial;
  /** Breakable when hp is set. */
  hp?: number;
  flammable?: boolean;
  /** Effects when it breaks (explosion, oil spill, gas…). */
  onBreak?: EffectSpec[];
  /** Chance to drop loot on break. */
  lootChance?: number;
  /** Carries a light (lamps, candelabra, braziers). */
  light?: { color: string; intensity: number; radius: number; flicker?: number };
  /** Can be picked up by Grasp. */
  grabbable?: boolean;
  /** Emits particles (fire, smoke) — client fx id. */
  fx?: string;
  model: string;
}

export type TrapTrigger = "plate" | "tripwire" | "proximity" | "timer" | "sight";

export interface TrapDef {
  id: string;
  name: string;
  desc: string;
  trigger: TrapTrigger;
  /** Plates: minimum resting mass (kg) to trigger — crates and rats count. */
  minMass?: number;
  /** Trigger radius / sensing range. */
  radius: number;
  /** Seconds before it can fire again (0 = single use). */
  rearm: number;
  /** Delay between trigger and effect (a click you might hear). */
  delay: number;
  /** What it does. */
  action: "spikes" | "darts" | "flame" | "blade" | "boulder" | "gas" | "collapse" | "warp" | "net" | "alarm";
  damage: number;
  element: Element;
  effects?: EffectSpec[];
  /** Base chance a delver notices it (reduced by darkness). */
  visibility: number;
  mount: "floor" | "wall" | "ceiling";
  model: string;
}

export type InteractableKind =
  | "descent"
  | "arrival"
  | "chest"
  | "reliquary"
  | "shrine"
  | "lever"
  | "door"
  | "note"
  | "mercy_candle"
  | "npc";

// ── Biomes (strata) ─────────────────────────────────────────────────────────

export type GeneratorId = "crypt" | "archive" | "caverns" | "foundry" | "hive" | "cathedral" | "garden" | "orrery" | "mirror" | "threshold";

export interface BiomeDef {
  id: string;
  /** Stratum index 0..9. */
  index: number;
  name: string;
  /** One-line epithet shown on arrival. */
  epithet: string;
  floors: [number, number];
  generator: GeneratorId;
  /** Material palette: grid cells store indices into `materials`. The first
   * entry of each list is the default. Material ids name client painters. */
  palette: {
    floor: string[];
    wall: string[];
    ceiling: string[];
    trim: string[];
    liquid?: string[];
  };
  /** Room heights (m). */
  ceiling: [number, number];
  lighting: {
    ambient: string;
    ambientIntensity: number;
    fogColor: string;
    fogDensity: number;
    /** Dust/haze amount for volumetric in-scattering. */
    haze: number;
    /** Light fixtures placed per room (average). */
    fixtureDensity: number;
    fixture: string; // prop id of the typical light (torch, candelabra…)
    /** Colour grade: shadows/midtones/highlights tints + saturation. */
    grade: { shadows: string; highlights: string; saturation: number; contrast: number };
  };
  creatures: { id: string; weight: number; minDepth?: number; group?: [number, number] }[];
  props: { id: string; weight: number }[];
  traps: { id: string; weight: number }[];
  liquids?: { surface: Surface; chance: number }[];
  helpers?: { id: string; chance: number }[];
  resources: string[];
  warden: string;
  ambience: string;
}

// ── Village / NPC shops ────────────────────────────────────────────────────

export type ShopId = "apothecary" | "artificer" | "wagers" | "tailor" | "quartermaster" | "stash";

export interface KitDef {
  id: string;
  name: string;
  /** Gear level the Well will weigh the wearer at. */
  gearLevel: number;
  price: number;
  /** Item bases + rarity, instantiated at `gearLevel` when the kit is used. */
  items: { base: string; rarity: Rarity }[];
  desc: string;
}

export interface CosmeticDef {
  id: string;
  name: string;
  kind: "robe_dye" | "hood" | "staff_finish" | "lantern" | "trail" | "sigil";
  price: number;
  /** Colour or style parameter consumed by the wizard model. */
  value: string;
  /** Unlocked by a village secret instead of gold. */
  secret?: string;
}

export interface RecipeDef {
  id: string;
  name: string;
  desc: string;
  kind: "upgrade" | "reforge" | "imbue" | "craft";
  gold: number;
  materials: { id: string; qty: number }[];
  /** craft: the item produced. */
  output?: { base: string; qty: number };
  /** upgrade/reforge/imbue: min ilvl of the target. */
  minIlvl?: number;
}
