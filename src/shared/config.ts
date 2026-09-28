/** Global tuning. Gameplay feel numbers live here so they can be iterated on
 * in one place. Content numbers (a creature's hp, a spell's damage) live in
 * shared/content; this file holds the rules of the world itself. */

/** Simulation tick rate (Hz) — the server and offline worker step at this. */
export const TICK_RATE = 30;
export const TICK_DT = 1 / TICK_RATE;
/** Snapshots go out every N ticks (30/2 = 15 Hz). */
export const SNAPSHOT_EVERY = 2;
/** Clients render replicated entities this far in the past (ms). */
export const INTERP_DELAY_MS = 110;
/** Client → server pose rate (Hz). */
export const INPUT_RATE = 30;

export const GRAVITY = -24;

/** World grid. A floor is a 2.5D grid of 1 m cells; heights snap to 0.25 m. */
export const CELL = 1;
export const HEIGHT_STEP = 0.25;
/** Anything that falls below this is lost to the dream (pits). */
export const KILL_Y = -14;
/** Floor height of a pit cell (visual bottom of the abyss). */
export const PIT_DEPTH = -24;

export const PLAYER = {
  radius: 0.34,
  /** Capsule half height of the cylindrical part. */
  halfHeight: 0.52,
  eyeHeight: 0.66, // above capsule centre
  speed: 6.4,
  sprintMult: 1.0,
  groundAccel: 12,
  airAccel: 28,
  airSpeedCap: 8,
  jumpVelocity: 8.2,
  coyoteTime: 0.12,
  jumpBuffer: 0.14,
  glideFallSpeed: -1.6,
  stepHeight: 0.55,
  maxSlopeDeg: 50,
  baseHealth: 100,
  baseMana: 100,
  baseManaRegen: 10,
  /** Server tolerance on reported movement (multiplier on max speed). */
  speedTolerance: 1.6,
  interactRange: 2.4,
} as const;

export const RUN = {
  /** Floors that must be cleared in a run before Descents also offer Ascend. */
  floorsBeforeExit: 5,
  maxFloor: 100,
  floorsPerStratum: 10,
} as const;

/** How often delvers meet. The matchmaker places a newcomer into an
 * instance that already holds someone with this probability (if a
 * candidate exists), otherwise creates a private instance. Kept low so
 * encounters are rare enough to be memorable. */
export const ENCOUNTER = {
  maxPlayersPerInstance: 4,
  /** Base chance to be matched into an occupied instance of your floor. */
  joinChance: 0.22,
  /** Extra chance per minute since this player last met anyone (capped). */
  lonelinessBonusPerMin: 0.03,
  maxJoinChance: 0.45,
  /** Instances stop accepting strangers this long after creation (s). */
  joinWindowSec: 240,
  /** An instance whose warden fight has started accepts nobody. */
  closeOnWarden: true,
} as const;

/** Per-stratum index (0..9) of a floor number (1..100). */
export function stratumOf(floor: number): number {
  return Math.min(9, Math.max(0, Math.floor((floor - 1) / RUN.floorsPerStratum)));
}

/** Depth within the stratum, 0..9 (floor 10, 20, … are 9 — warden floors). */
export function depthInStratum(floor: number): number {
  return (floor - 1) % RUN.floorsPerStratum;
}

export function isWardenFloor(floor: number): boolean {
  return floor % RUN.floorsPerStratum === 0;
}

/** Difficulty multipliers. Numbers in content are "floor 1" values. */
export function floorScale(floor: number) {
  const f = Math.max(1, floor) - 1;
  return {
    health: 1 + f * 0.16 + f * f * 0.0012,
    damage: 1 + f * 0.1 + f * f * 0.0006,
    /** Creature budget for the floor (before stratum modifiers). */
    creatureBudget: Math.min(10 + Math.floor(f * 0.35), 26),
  };
}
