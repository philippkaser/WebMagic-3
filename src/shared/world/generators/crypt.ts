import { depthInStratum } from "../../config";
import { Surface, type BiomeDef } from "../../content/types";
import type { Rng } from "../../util/rng";
import { CellKind, CellTag, type FloorGrid, type Room } from "../layout";
import {
  addPillars,
  assignRoles,
  carveCorridor,
  carveRoom,
  chasm,
  computeRoomDepths,
  connectRooms,
  floodRoom,
  markDoors,
  newGrid,
  placeRooms,
  snapH,
} from "./common";

/** The Undercroft: catacombs of the first rim-village. Tight stepped
 * corridors, burial niches cut into the walls, pillared ossuaries, sunken
 * flooded crypts and the odd collapsed chasm. */
export function generateCrypt(rng: Rng, floor: number, biome: BiomeDef): { grid: FloorGrid; rooms: Room[] } {
  const depth = depthInStratum(floor);
  const size = Math.min(52 + depth * 3 + Math.floor(floor / 10) * 2, 88);
  const g = newGrid(size, size);
  const pal = biome.palette;
  const WALL_BRICK = 0;
  const WALL_OSSUARY = Math.min(1, pal.wall.length - 1);
  const WALL_PLASTER = Math.min(2, pal.wall.length - 1);

  const rooms = placeRooms(g, rng.fork("rooms"), {
    count: 9 + Math.floor(depth * 0.8),
    minSize: 5,
    maxSize: 12,
    padding: 3,
    heights: [0, 0, 0, -0.5, 0.5, -1, 1, 0.25],
    ceiling: biome.ceiling,
  });

  const rr = rng.fork("room-style");
  for (const r of rooms) {
    const style = rr.next();
    const wall = style < 0.2 ? WALL_OSSUARY : style < 0.45 ? WALL_PLASTER : WALL_BRICK;
    if (wall === WALL_OSSUARY) r.tags.push("ossuary");
    carveRoom(g, r, { floor: rr.chance(0.25) ? 1 : 0, wall, ceil: 0 });
  }

  const cr = rng.fork("corridors");
  const edges = connectRooms(rooms, cr, 0.3);
  for (const [a, b] of edges) {
    carveCorridor(g, cr, rooms[a], rooms[b], { width: cr.chance(0.35) ? 2 : 1, ceilAbove: 2.75, floorMat: 2, maxStep: 0.25 });
  }
  markDoors(g, rooms);

  // Arrival: a small room on the edge of the graph.
  const arrival = rooms.reduce((best, r) => (r.w * r.h < best.w * best.h ? r : best), rooms[0]);
  computeRoomDepths(rooms, edges, arrival.id);
  assignRoles(rooms, rng.fork("roles"), arrival.id, ["treasure", "shrine", "lair"]);

  // Features.
  const fr = rng.fork("features");
  for (const r of rooms) {
    if (r.role === "arrival" || r.role === "descent") continue;
    const roll = fr.next();
    if (r.role === "hall" || (r.w >= 8 && r.h >= 8 && roll < 0.5)) {
      addPillars(g, r, fr.chance(0.5) ? 3 : 4, WALL_BRICK);
      r.tags.push("pillared");
    } else if (roll < 0.62 && biome.liquids?.length) {
      floodRoom(g, r, Surface.Water, 0.75, 0.35);
      r.tags.push("flooded");
    } else if (roll < 0.72 && depth >= 2) {
      chasm(g, fr, r);
    }
  }

  carveNiches(g, rng.fork("niches"), rooms);

  // Arrival and descent pads stay clear.
  for (const r of rooms) {
    if (r.role !== "arrival" && r.role !== "descent") continue;
    const cx = Math.floor(r.x + r.w / 2);
    const cz = Math.floor(r.z + r.h / 2);
    for (let z = cz - 1; z <= cz + 1; z++) for (let x = cx - 1; x <= cx + 1; x++) g.tags[z * g.w + x] |= CellTag.NoSpawn;
  }
  return { grid: g, rooms };
}

/** Burial niches (loculi): shallow raised alcoves cut into room walls. */
function carveNiches(g: FloorGrid, rng: Rng, rooms: Room[]): void {
  for (const r of rooms) {
    const chance = r.tags.includes("ossuary") ? 0.35 : 0.1;
    const tryNiche = (x: number, z: number, dx: number, dz: number) => {
      const nx = x + dx;
      const nz = z + dz;
      const bx = nx + dx;
      const bz = nz + dz;
      if (bx <= 0 || bz <= 0 || bx >= g.w - 1 || bz >= g.h - 1) return;
      const n = nz * g.w + nx;
      if (g.kind[n] !== CellKind.Solid || g.kind[bz * g.w + bx] !== CellKind.Solid) return;
      // Keep niches separated by solid wall.
      const side1 = (nz + dx) * g.w + (nx + dz);
      const side2 = (nz - dx) * g.w + (nx - dz);
      if (g.kind[side1] !== CellKind.Solid || g.kind[side2] !== CellKind.Solid) return;
      if (!rng.chance(chance)) return;
      const base = g.floor[z * g.w + x];
      g.kind[n] = CellKind.Open;
      g.floor[n] = snapH(base + 0.75);
      g.ceil[n] = snapH(base + 1.75);
      g.region[n] = r.id;
      g.tags[n] |= CellTag.NoSpawn;
      g.floorMat[n] = 0;
    };
    for (let x = r.x + 1; x < r.x + r.w - 1; x += 2) {
      tryNiche(x, r.z, 0, -1);
      tryNiche(x, r.z + r.h - 1, 0, 1);
    }
    for (let z = r.z + 1; z < r.z + r.h - 1; z += 2) {
      tryNiche(r.x, z, -1, 0);
      tryNiche(r.x + r.w - 1, z, 1, 0);
    }
  }
}
