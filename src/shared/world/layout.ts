import { CELL, PIT_DEPTH } from "../config";
import type { Surface } from "../content/types";
import type { V3 } from "../util/math";

/** A floor of the Godwell is a 2.5D grid in the tradition of the old
 * dungeon games: every 1 m cell has a floor height and a ceiling height
 * (0.25 m steps), so stairs, sunken halls, galleries, pits and flooded
 * crypts all fall out of one compact representation that is cheap to
 * generate, mesh, collide, path-find and trace light through.
 *
 * World mapping: cell (x, z) covers [x·CELL, (x+1)·CELL) × [z·CELL, (z+1)·CELL);
 * +Y is up. The grid is pure data (typed arrays) — safe on server and client. */

export enum CellKind {
  Solid = 0,
  Open = 1,
  /** Open cell whose floor drops into the abyss. */
  Pit = 2,
}

/** Bit flags per cell. */
export const CellTag = {
  /** Nothing may be spawned here (arrival area, portal pads, bridges). */
  NoSpawn: 1,
  /** Part of a corridor rather than a room. */
  Corridor: 2,
  /** Doorway between a room and a corridor. */
  Door: 4,
  /** Stairs (floor height differs from a neighbour by design). */
  Stair: 8,
  /** Bridge over a pit or liquid. */
  Bridge: 16,
  /** Visible on the map from the start (landmarks). */
  Landmark: 32,
} as const;

export interface FloorGrid {
  w: number;
  h: number;
  kind: Uint8Array;
  floor: Float32Array;
  ceil: Float32Array;
  /** Liquid pool (Surface.Water / Lava / Acid / Ink / Honey…), 0 = dry. */
  liquid: Uint8Array;
  /** World height of the liquid surface in that cell. */
  liquidLevel: Float32Array;
  /** Palette indices (into BiomeDef.palette lists). */
  floorMat: Uint8Array;
  wallMat: Uint8Array;
  ceilMat: Uint8Array;
  /** Room id (index into FloorLayout.rooms), -1 corridor/other. */
  region: Int16Array;
  tags: Uint8Array;
}

export function createGrid(w: number, h: number): FloorGrid {
  const n = w * h;
  return {
    w,
    h,
    kind: new Uint8Array(n),
    floor: new Float32Array(n),
    ceil: new Float32Array(n).fill(4),
    liquid: new Uint8Array(n),
    liquidLevel: new Float32Array(n),
    floorMat: new Uint8Array(n),
    wallMat: new Uint8Array(n),
    ceilMat: new Uint8Array(n),
    region: new Int16Array(n).fill(-1),
    tags: new Uint8Array(n),
  };
}

export const cellIndex = (g: FloorGrid, x: number, z: number) => z * g.w + x;
export const inBounds = (g: FloorGrid, x: number, z: number) => x >= 0 && z >= 0 && x < g.w && z < g.h;

export function isOpen(g: FloorGrid, x: number, z: number): boolean {
  return inBounds(g, x, z) && g.kind[z * g.w + x] !== CellKind.Solid;
}

/** Walkable = open, not a pit. */
export function isWalkable(g: FloorGrid, x: number, z: number): boolean {
  return inBounds(g, x, z) && g.kind[z * g.w + x] === CellKind.Open;
}

/** Floor height at a cell (pits report the abyss). */
export function floorAt(g: FloorGrid, x: number, z: number): number {
  if (!inBounds(g, x, z)) return 1e4;
  const i = z * g.w + x;
  if (g.kind[i] === CellKind.Solid) return 1e4;
  if (g.kind[i] === CellKind.Pit) return PIT_DEPTH;
  return g.floor[i];
}

export function cellOf(p: { x: number; z: number }): [number, number] {
  return [Math.floor(p.x / CELL), Math.floor(p.z / CELL)];
}

export function cellCenter(x: number, z: number, y = 0): V3 {
  return { x: (x + 0.5) * CELL, y, z: (z + 0.5) * CELL };
}

/** Ground height under a world point (for placing things). */
export function groundAt(g: FloorGrid, p: { x: number; z: number }): number {
  const [x, z] = cellOf(p);
  return floorAt(g, x, z);
}

export type RoomRole = "arrival" | "descent" | "treasure" | "vault" | "shrine" | "arena" | "lair" | "hall" | "chamber";

export interface Room {
  id: number;
  x: number;
  z: number;
  w: number;
  h: number;
  role: RoomRole;
  floor: number;
  ceil: number;
  /** Graph distance (in rooms) from the arrival room. */
  depth: number;
  /** Free-form tags generators and populators share ("flooded", "ossuary"…). */
  tags: string[];
}

export type SpawnKind = "creature" | "prop" | "trap" | "interactable";

/** Something the simulation instantiates as an entity. */
export interface SpawnSpec {
  kind: SpawnKind;
  def: string;
  pos: V3;
  yaw: number;
  /** Definition-specific parameters (trap facing, note id, chest tier…). */
  data?: Record<string, string | number | boolean>;
}

/** A static light fixture (torch sconce, candle cluster, brazier, glowing
 * fungus). Rendered by the client; the sim treats burning ones as fire
 * sources (oil and flammable creatures ignite near them). */
export interface FixtureSpec {
  def: string;
  pos: V3;
  yaw: number;
  light: { color: string; intensity: number; radius: number; flicker: number } | null;
  burning: boolean;
}

/** Static, non-simulated visual dressing (bone piles, rubble, cobwebs,
 * shelves, pipes). `solid` ones also get a static collider of `half` size. */
export interface DecorSpec {
  def: string;
  pos: V3;
  yaw: number;
  scale: number;
  solid?: { half: [number, number, number] };
}

export interface FloorLayout {
  seed: number;
  floor: number;
  stratum: number;
  biome: string;
  grid: FloorGrid;
  rooms: Room[];
  arrival: V3;
  arrivalYaw: number;
  descent: V3;
  spawns: SpawnSpec[];
  fixtures: FixtureSpec[];
  decor: DecorSpec[];
  /** Surface cells to paint at start (puddles, blood, webs, oil). */
  surfaces: { x: number; z: number; surface: Surface }[];
}
