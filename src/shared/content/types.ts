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
  | "invisible"
  /** Sight cut to a few metres (ink, steam, a snuffed candle). */
  | "blinded"
  /** Cannot cast spells (a proctor's SHH). Melee still works. */
  | "silenced";

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
  /** Paint a surface disc. `duration` overrides the surface's own lifetime
   * (poured lava that cools, a timed web). */
  | { type: "surface"; surface: Surface; radius: number; duration?: number }
  | { type: "pull"; radius: number; strength: number; duration: number }
  | { type: "chain"; count: number; range: number; damage: number; element: Element }
  | { type: "heal"; amount: number }
  | { type: "mana"; amount: number }
  | {
      type: "spawn";
      kind: "creature" | "prop";
      def: string;
      count?: number;
      chance?: number;
      /** Creatures: seconds before they dissolve (0 = permanent). */
      lifeTime?: number;
      /** Scatter radius around the point. */
      spread?: number;
    }
  | { type: "light"; color: string; intensity: number; radius: number; duration: number }
  | { type: "noise"; loudness: number }
  | { type: "teleport"; range: number }
  | { type: "fx"; fx: string }
  /** Conditional: run `effects` on the target only if it matches. */
  | {
      type: "if";
      factions?: FactionId[];
      notFactions?: FactionId[];
      /** Relative to the source's team. */
      relation?: "ally" | "foe";
      hasStatus?: StatusId;
      material?: CreatureMaterial[];
      /** Only creatures (not delvers, not props). */
      creaturesOnly?: boolean;
      effects: EffectSpec[];
    }
  /** Apply `effects` to every body within `radius` of the point (each as
   * the target, pushed along the direction away from the point). */
  | { type: "area"; radius: number; effects: EffectSpec[]; los?: boolean; excludeSource?: boolean }
  /** Put out every flame in the radius: fire surfaces, burning bodies, lit
   * candles/lamps/fixtures, candle-bearing creatures. */
  | { type: "snuff"; radius: number }
  /** Relight candles, lamps, braziers and fixtures in the radius. */
  | { type: "kindle"; radius: number }
  | { type: "remove_status"; statuses: StatusId[] }
  /** Temporary creature buff (a cantor's swell, a warden's harmonise) or,
   * with `discord`, the loss of pack/harmony bonuses. */
  | { type: "empower"; duration: number; speed?: number; damage?: number; resist?: number; haste?: number; discord?: boolean }
  /** Set off every armed trap within the radius (an arena switch). */
  | { type: "trigger_traps"; radius: number }
  /** Run `effects` again `times` times, `interval` s apart (steam jets,
   * flood waves, lingering clouds). */
  | { type: "repeat"; times: number; interval: number; effects: EffectSpec[] };

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
  | "helpers"
  /** Things That Feed: ticks, leeches, lampreys. */
  | "parasite";

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
  /** Wardens: only usable in this phase. */
  phase?: number;
  /** Preconditions: allies nearby (harmony), in water, wounded. */
  requires?: { allies?: number; radius?: number; inWater?: boolean; hpBelow?: number };
  /** Grab: seconds the victim is held (dragged along). */
  hold?: number;
  /** Grab: where the victim is taken — pulled to the grabber, carried toward
   * the nearest hazard (lava, fire, pit), or dragged into water. */
  carry?: "self" | "hazard" | "water";
  /** Grab: throw speed at the end of the hold (toward `carry`). */
  throwSpeed?: number;
  /** Grab: damage per second while held. */
  holdDps?: number;
  /** Fraction of max hp the attack costs (a shambler tearing out a rib). */
  selfDamage?: number;
  /** Radius of the ground telegraph shown during the windup (slams, novas). */
  telegraph?: number;
}

/** What a creature is made of — decides who eats it, what conducts, what
 * cracks under thermal shock. */
export type CreatureMaterial = "flesh" | "bone" | "metal" | "paper" | "fungus" | "cloth" | "wax" | "jelly" | "spirit" | "stone" | "chitin" | "slag";

/** Things a `seek` trait is drawn to. */
export type Stimulus =
  /** Fire surfaces, burning fixtures, burning bodies. */
  | "fire"
  /** Delvers' lanterns, lit props and fixtures, light-bearing creatures. */
  | "light"
  /** Flammable/explosive props and oiled bodies. */
  | "flammable"
  /** Metal creatures below half health. */
  | "metal_wounded"
  /** Paper props and unread notes. */
  | "paper";

/** Data-driven special behaviour (implemented once in sim/ai/traits.ts).
 * `phase` restricts a trait to one warden phase. */
export type TraitSpec = (
  /** Every `interval` s, apply `effects` to bodies within `radius`. */
  | { kind: "aura"; radius: number; interval: number; effects: EffectSpec[]; affects?: "all" | "foes" | "allies"; factions?: FactionId[]; includeSelf?: boolean }
  /** Leaves a surface behind while moving (optionally only below an hp fraction). */
  | { kind: "trail"; surface: Surface; radius?: number; spacing?: number; hpBelow?: number; duration?: number }
  /** Carries an open flame: lights flammable ground it walks through; snuffed
   * by water/frost/keening (goes blind) and relights after `relightAfter` s. */
  | { kind: "flame_bearer"; relightAfter: number }
  /** Tends lights: walks to unlit fixtures, candles and lamps and relights them. */
  | { kind: "relight"; range: number; time: number }
  /** Firefighter: walks to fires and beats them out. */
  | { kind: "extinguish"; range: number; time: number; urgent?: boolean }
  /** Drawn to stimuli. With `attack`, the stimulus becomes its target
   * (kamikaze sparks); with `exclusive` it perceives nothing else. */
  | { kind: "seek"; stimuli: Stimulus[]; range: number; attack?: boolean; exclusive?: boolean; throughWalls?: boolean }
  /** Moves only in water; stranded (slow, hurting) out of it. */
  | { kind: "swim"; strandedSpeed?: number; strandedDps?: number }
  /** Waits under the floor; bursts out when prey steps within range. */
  | { kind: "burrow"; emergeRange: number; rehide?: number; senseFlying?: boolean }
  /** Death spawns smaller creatures (unless it died of one of `unless`). */
  | { kind: "split"; into: string; count: number; unless?: StatusId[] }
  /** Death leaves a pile that reassembles into the creature after `time` s
   * unless the pile is burned, broken or eaten. */
  | { kind: "reform"; prop: string; time: number; hpFrac?: number; unless?: StatusId[] }
  /** Periodically summons helpers, capped. */
  | { kind: "summon"; creature: string; count: number; interval: number; max: number; radius?: number; whenAlerted?: boolean; lifeTime?: number }
  /** How it relates to surfaces: hides in them, is fast/regenerates in them,
   * or ignores their harm. */
  | { kind: "surface"; surfaces: Surface[]; hide?: boolean; speedMult?: number; regen?: number; immune?: boolean }
  /** Electrifies the water under it every `interval` s for `duration` s. */
  | { kind: "conductive"; interval: number; duration: number }
  /** What a status does to it beyond the status itself: water kills sparks,
   * shells slag, snuffs candles; burning makes vermin panic. */
  | { kind: "on_status"; statuses: StatusId[]; result: "die" | "shell" | "snuff" | "panic" | "stun" | "effects"; duration?: number; effects?: EffectSpec[] }
  /** Reacts to being hit (in the back, by an element, below an hp
   * fraction): puffs spores, bursts bellows, dumps ink. */
  | { kind: "reactive"; arc?: "back" | "front" | "any"; elements?: Element[]; minDamage?: number; hpBelow?: number; once?: boolean; cooldown?: number; delay?: number; effects: EffectSpec[]; dies?: boolean; stun?: number }
  /** Extra death effects, optionally only if it died with/without a status. */
  | { kind: "death_burst"; effects: EffectSpec[]; ifStatus?: StatusId; unlessStatus?: StatusId }
  /** Pack tactics / harmony: bolder, tougher and faster with kin around. */
  | { kind: "pack"; min: number; radius: number; sameDef?: boolean; resist?: number; haste?: number; damage?: number; aggression?: number; courage?: number }
  /** Turns on the wounded regardless of faction. */
  | { kind: "opportunist"; below: number; range: number; material?: CreatureMaterial[]; defs?: string[] }
  /** Hunts by sound: anything moving (or wading) within range is a target,
   * any faction; still things are invisible to it. */
  | { kind: "listen"; range: number; minSpeed?: number; wadingMult?: number; ignoreFlying?: boolean; anyFaction?: boolean }
  /** Eats props (bone piles, tallow vats, lumen caps, paper) and corpses of
   * the listed materials: heals, and may grow. */
  | { kind: "graze"; props: string[]; corpses?: CreatureMaterial[]; keep?: string[]; time: number; heal?: number; grow?: number; maxMeals?: number; range?: number }
  /** Embraces corpses until they rise as `into`. */
  | { kind: "raise"; into: string; time: number; range?: number }
  /** Standing in `surface` for `time` s destroys it; `into` rises `delay` s later. */
  | { kind: "melt"; surface: Surface; time: number; into?: string; delay?: number }
  /** Herd animal: loud noise or fire nearby stampedes the whole herd. */
  | { kind: "stampede"; noise: number; fire?: number; herd: number; duration: number }
  /** Moving fast, it runs over whatever is in front of it. */
  | { kind: "trample"; minSpeed: number; damage: number; impulse: number }
  /** Hot metal that meets water/frost cracks: armour × `armorMult`. */
  | { kind: "thermal_shock"; armorMult: number; duration: number }
  /** Anything standing still for `still` s within `range` gets `attack`. */
  | { kind: "punish_still"; still: number; range: number; attack: string }
  /** Warden arenas: floods outward from home, or rains surface patches. */
  | { kind: "arena"; surface: Surface; radius: number; interval: number; pattern: "flood" | "scatter"; count?: number; spot?: number; duration?: number; grow?: number }
  /** A companion prop (a page, a heart): damaging it distracts the owner;
   * breaking it runs `onBreak` on the owner. */
  | { kind: "linked_prop"; prop: string; offset?: [number, number, number]; distract: number; cooldown: number; onBreak?: EffectSpec[] }
  /** Helpers: keep near the nearest delver. */
  | { kind: "follow"; distance: number; range: number }
  /** Helpers: find hidden traps and reveal them. */
  | { kind: "reveal"; range: number; time: number }
  /** Permanently carries a status (drowned = wet, rendered = oiled). */
  | { kind: "permanent"; status: StatusId }
) & { phase?: number };

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
  /** Data-driven special behaviour (sim/ai/traits.ts). */
  traits?: TraitSpec[];
  material?: CreatureMaterial;
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
  /** Wardens (bosses) have phases and never flee. Phase 2 begins below
   * half health; `phase2` describes what changes. */
  warden?: {
    title: string;
    phases: number;
    phase2?: {
      speedMult?: number;
      /** Change sides (the Choir turns on Ysolde). */
      team?: FactionId;
      /** Run at the warden when the phase begins. */
      onEnter?: EffectSpec[];
      /** Shown to delvers nearby. */
      say?: string;
    };
  };
  /** Helpers never target delvers. */
  helper?: boolean;
}

// ── Props, traps, interactables ────────────────────────────────────────────

export type PropMaterial = "wood" | "stone" | "metal" | "ceramic" | "cloth" | "glass" | "bone" | "flesh" | "wax" | "paper" | "fungus";

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
  /** Carries an open flame (candles, lamps, braziers): a fire source while
   * lit, snuffable, relightable, spills fire when knocked over. */
  flame?: boolean;
  /** Seconds a flammable prop burns before it collapses. */
  burnTime?: number;
  /** Moving faster than this (m/s) it crushes what it hits (boulders, carts,
   * falling shelves). */
  crushSpeed?: number;
  /** Effects once when it tips over (spilled candles, bone piles, lava). */
  onTopple?: EffectSpec[];
  /** Effects when struck (a ringing bell-cap, a disturbed scrap heap). */
  onHit?: { effects: EffectSpec[]; cooldown: number; elements?: Element[]; charges?: number; minDamage?: number };
  /** Extra effects on break if it was lit/burning. */
  onBreakLit?: EffectSpec[];
  /** Materials dropped when broken (harvesting). */
  drops?: { id: string; chance: number }[];
  /** Surface painted around it on spawn (a quench trough's water). */
  pool?: { surface: Surface; radius: number };
  /** Seconds before it crumbles away on its own (walls, grave candles). */
  life?: number;
  /** Floats on water (drifts, bobs). */
  float?: boolean;
  /** Spawn lying on its side (logs roll). */
  lying?: boolean;
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
  action:
    | "spikes"
    | "darts"
    | "flame"
    | "blade"
    | "boulder"
    | "gas"
    | "collapse"
    | "warp"
    | "net"
    | "alarm"
    /** Delayed crushing blow from above (drop hammers). */
    | "hammer"
    /** Run `effects` at the trap (vents, sluices, pours, resonance). */
    | "burst"
    /** Spray `effects` in a cone along the facing (jets). */
    | "cone"
    /** Something heavy falls across the facing: crush strip + debris prop. */
    | "topple"
    /** Webbed + dragged toward the nearest `pullTo` creature. */
    | "snare"
    /** Belts: bodies in radius are carried along the facing for `duration`. */
    | "conveyor";
  damage: number;
  element: Element;
  effects?: EffectSpec[];
  /** Darts: projectile spell and how many per volley. */
  spell?: string;
  volley?: number;
  /** Cone half-angle (deg) for cone actions. */
  cone?: number;
  /** Seconds the action keeps going (jets, belts). */
  duration?: number;
  /** Timer traps: seconds between firings [min, max] (defaults to rearm). */
  interval?: [number, number];
  /** Loudness of the trap going off. */
  noise?: number;
  /** Prop to drop (topple) or roll (boulder). */
  spawn?: string;
  /** A second beat of effects (a chute's candle after its tallow). */
  followUp?: { delay: number; effects: EffectSpec[] };
  /** Snares: creature defs whose mouths the victims are dragged toward. */
  pullTo?: string[];
  /** Sight triggers only see moving bodies. */
  movingOnly?: boolean;
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
  /** upgrade/reforge/imbue: max ilvl of the target. */
  maxIlvl?: number;
}
