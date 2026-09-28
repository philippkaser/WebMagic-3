import { stratumOf } from "../config";
import { biomeForFloor } from "../content";
import type { BiomeDef, GeneratorId } from "../content/types";
import { yawOf } from "../util/math";
import { hash3, Rng } from "../util/rng";
import { cellPos, reachable, roomCenter } from "./generators/common";
import { generateCrypt } from "./generators/crypt";
import type { FloorGrid, FloorLayout, Room } from "./layout";
import { populate } from "./populate";

/** Floor generation entry point. Pure and deterministic: the same
 * (seed, floor) always yields the identical layout, so the server only ever
 * ships a seed and every client rebuilds the same geometry locally.
 *
 * A biome chooses a *generator* (layout style); generators carve the grid
 * and assign room roles, then the shared populator dresses it from the
 * biome's tables. */

export type Generator = (rng: Rng, floor: number, biome: BiomeDef) => { grid: FloorGrid; rooms: Room[] };

const GENERATORS: Partial<Record<GeneratorId, Generator>> = {
  crypt: generateCrypt,
};

/** Register a generator (biome generator modules call this). */
export function registerGenerator(id: GeneratorId, gen: Generator): void {
  GENERATORS[id] = gen;
}

export function generateFloor(seed: number, floor: number): FloorLayout {
  const biome = biomeForFloor(floor);
  const gen = GENERATORS[biome.generator] ?? generateCrypt;
  // Retry with derived seeds until every room is reachable from the
  // arrival (steep corridor crossings can occasionally cut one off).
  let attempt = 0;
  for (;;) {
    const rng = new Rng(hash3(seed, floor, attempt, 0x60d));
    const { grid, rooms } = gen(rng.fork("layout"), floor, biome);
    const arrival = rooms.find((r) => r.role === "arrival") ?? rooms[0];
    const descent = rooms.find((r) => r.role === "descent") ?? rooms[rooms.length - 1];
    const ok = rooms.every((r) => r.role !== "descent" || reachable(grid, roomCenter(arrival), roomCenter(r)));
    if (!ok && attempt < 12) {
      attempt++;
      continue;
    }
    const pop = populate(grid, rooms, rng.fork("populate"), floor, biome);
    const [ax, az] = roomCenter(arrival);
    const [dx, dz] = roomCenter(descent);
    return {
      seed,
      floor,
      stratum: stratumOf(floor),
      biome: biome.id,
      grid,
      rooms,
      arrival: cellPos(grid, ax, az, 0),
      arrivalYaw: yawOf(dx - ax, dz - az),
      descent: cellPos(grid, dx, dz, 0),
      spawns: pop.spawns,
      fixtures: pop.fixtures,
      decor: pop.decor,
      surfaces: pop.surfaces,
    };
  }
}
