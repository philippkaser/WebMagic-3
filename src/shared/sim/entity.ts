import type { Collider, RigidBody } from "@dimforge/rapier3d-compat";
import type { CreatureDef, Element, FactionId, PropDef, SpellDef, StatusId, TrapDef } from "../content/types";
import type { V3 } from "../util/math";
import type { CastOptions } from "./spells";

/** The simulation's entity model: one flat struct with optional component
 * blocks (miniplex-style). Systems iterate typed lists kept by FloorSim and
 * only touch the components they own. Everything visible to clients is in
 * the replicated header (type/def/pos/vel/yaw/quat/anim/flags/hp/statuses);
 * component blocks are server-private. */

export enum EntityType {
  Player = 0,
  Creature = 1,
  Prop = 2,
  Projectile = 3,
  Trap = 4,
  Pickup = 5,
  Interactable = 6,
}

/** Animation state machine value shared with clients: models animate
 * procedurally from (anim, variant, time since change). */
export enum Anim {
  Idle = 0,
  Walk = 1,
  Run = 2,
  Windup = 3,
  Strike = 4,
  Recover = 5,
  Hurt = 6,
  Stagger = 7,
  Dead = 8,
  Cast = 9,
  Feed = 10,
  Flee = 11,
  Sleep = 12,
  Special = 13,
  Fall = 14,
  Open = 15,
}

/** Replicated boolean state bits. */
export const Flag = {
  Burning: 1 << 0,
  /** Trap not yet spotted by anyone (clients render it barely visible). */
  Hidden: 1 << 1,
  /** Descent sealed (warden alive) / chest locked. */
  Sealed: 1 << 2,
  /** Chest/reliquary opened, trap sprung, door open. */
  Opened: 1 << 3,
  Warden: 1 << 4,
  /** Held by someone's Grasp. */
  Grasped: 1 << 5,
  Asleep: 1 << 6,
  /** Aware of a foe (clients show a tell). */
  Alerted: 1 << 7,
  /** Player: in a pact with the viewer's player (per-viewer, set by server). */
  Ally: 1 << 8,
  Oathbroken: 1 << 9,
  /** Descent that can also Ascend for this viewer. */
  CanAscend: 1 << 10,
  /** Rare/enchanted pickup — clients add a beam. */
  Rare: 1 << 11,
  Corpse: 1 << 12,
  /** Player currently raising the Open Palm. */
  Palm: 1 << 13,
  Helper: 1 << 14,
} as const;

export interface StatusInst {
  time: number;
  /** Damage-per-second multiplier (scaled by the applier). */
  power: number;
  source: number;
}

export interface Entity {
  id: number;
  type: EntityType;
  def: string;
  pos: V3;
  vel: V3;
  yaw: number;
  /** Full rotation (props tumble; corpses fall). */
  quat: { x: number; y: number; z: number; w: number } | null;
  anim: Anim;
  animVariant: number;
  animTick: number;
  flags: number;
  hp: number;
  maxHp: number;
  team: FactionId;
  mass: number;
  radius: number;
  height: number;
  statuses: Map<StatusId, StatusInst>;
  body: RigidBody | null;
  collider: Collider | null;
  removed: boolean;
  /** Tick of the last replicated change (servers diff against it). */
  changedTick: number;

  creature?: CreatureState;
  prop?: PropState;
  projectile?: ProjectileState;
  trap?: TrapState;
  pickup?: PickupState;
  interact?: InteractState;
  player?: PlayerState;
}

export interface AttackState {
  index: number;
  phase: "windup" | "strike" | "recover";
  t: number;
  targetId: number;
  aim: V3;
}

export interface CreatureState {
  def: CreatureDef;
  dmgScale: number;
  /** Current behaviour id and its private scratch data. */
  behavior: string;
  behaviorTime: number;
  scratch: Record<string, number>;
  targetId: number;
  attack: AttackState | null;
  cooldowns: number[];
  stagger: number;
  /** id → accumulated resentment (damage taken from them). */
  grudges: Map<number, number>;
  lastSeen: { id: number; pos: V3; time: number } | null;
  noise: { pos: V3; time: number; loudness: number } | null;
  /** Trap ids this creature knows about (it avoids their cells). */
  knownTraps: Set<number>;
  home: V3;
  path: V3[];
  pathTime: number;
  pathGoal: V3 | null;
  hunger: number;
  grounded: boolean;
  wantVel: V3;
  /** Seconds since the corpse fell (despawn timer). */
  deadTime: number;
  warden: { phase: number } | null;
  summonedBy: number;
  lifeTime: number;
}

export interface PropState {
  def: PropDef;
  grabbedBy: number;
  /** Thrown props hurt what they hit until they slow down. */
  thrownBy: number;
  thrownTime: number;
  ignited: boolean;
}

export interface ProjectileState {
  spell: SpellDef;
  owner: number;
  ownerTeam: FactionId;
  castId: number;
  element: Element;
  damageMult: number;
  radius: number;
  gravity: number;
  life: number;
  bounces: number;
  pierce: number;
  homing: number;
  hitIds: Set<number>;
  split: { count: number; damage: number } | null;
  volatile: number;
  chain: { count: number; range: number } | null;
  trail: number;
  trailAcc: number;
  heavy: boolean;
  magnetic: number;
  fuse: number;
  stuck: boolean;
  vampiric: number;
  orbit: number;
  orbitAngle: number;
  isChild: boolean;
  /** The cast that produced it (caster modifiers apply on impact). */
  cast: CastOptions;
}

export interface TrapState {
  def: TrapDef;
  armed: boolean;
  cooldown: number;
  pending: number;
  /** Spotted by delvers (then visible to everyone). */
  spotted: boolean;
  facing: V3;
}

export interface PickupState {
  /** Server-side item payload (an ItemInstance), opaque to the sim. */
  item: unknown;
  gold: number;
  /** Only this player may take it for the first seconds (drops from kills). */
  ownerOnlyUntil: number;
  owner: number;
  auto: boolean;
  life: number;
}

export type InteractKind = "descent" | "arrival" | "chest" | "reliquary" | "note" | "mercy_candle" | "shrine";

export interface InteractState {
  kind: InteractKind;
  data: Record<string, string | number | boolean>;
  /** Loot contained (chests, reliquaries). Opaque ItemInstances. */
  contents: unknown[];
  usedBy: Set<number>;
}

export interface PlayerState {
  name: string;
  input: { seq: number; pos: V3; vel: V3; yaw: number; pitch: number; grounded: boolean; time: number };
  mana: number;
  maxMana: number;
  stats: PlayerStats;
  cooldowns: Record<string, number>;
  channel: { spell: string; castId: number; tickAcc: number; dir: V3 } | null;
  grasp: { targetId: number; dist: number } | null;
  palm: number;
  pactWith: Set<number>;
  oathbroken: boolean;
  dead: boolean;
  lastDamagedBy: number;
  invuln: number;
  /** Knockback queued for the owning client. */
  pendingImpulse: V3;
  kills: number;
  lastSpotCheck: number;
  lastPos: V3;
  lastInputTime: number;
}

/** Player combat stats derived from gear (game/stats.ts). */
export interface PlayerStats {
  maxHealth: number;
  maxMana: number;
  healthRegen: number;
  manaRegen: number;
  spellPower: number; // multiplier (1 = base)
  castSpeed: number; // multiplier on cooldown rate
  moveSpeed: number; // multiplier
  armor: number;
  res: Partial<Record<Element, number>>;
  critChance: number; // 0..1
  critDamage: number; // multiplier on crit (e.g. 1.5)
  lightRadius: number;
  stealth: number; // 0..1 reduction of notice range
  luck: number; // multiplier
  jumpPower: number;
  extraJumps: number;
  glide: boolean;
  lifeOnKill: number;
  manaOnKill: number;
  projectileSpeed: number; // multiplier
  extraProjectiles: number;
  statusChance: number; // additive
  knockback: number; // multiplier
  thorns: number;
  /** Focus weapon damage multiplier (base power × ilvl scaling). */
  focusPower: number;
  primary: string;
  secondary: string;
  relic: string | null;
  /** Amplifier ids from all gear. */
  amps: string[];
}
