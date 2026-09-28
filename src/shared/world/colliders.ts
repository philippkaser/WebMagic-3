import { CELL, PIT_DEPTH } from "../config";
import { CellKind, type FloorGrid, type FloorLayout } from "./layout";

/** Static collision for a floor, derived purely from the grid so server and
 * client build byte-identical worlds. Cells are greedy-merged into as few
 * boxes as possible: floor slabs per equal height, solid rock columns, and
 * ceiling slabs. */

export interface StaticBox {
  center: [number, number, number];
  half: [number, number, number];
  /** What it is (debug, surface sounds). */
  role: "floor" | "wall" | "ceiling" | "decor";
}

const SLAB = 1; // slab thickness below floors / above ceilings (m)

export function buildStaticBoxes(layout: FloorLayout): StaticBox[] {
  const g = layout.grid;
  const boxes: StaticBox[] = [];
  let minFloor = 0;
  let maxCeil = 4;
  for (let i = 0; i < g.w * g.h; i++) {
    if (g.kind[i] === CellKind.Solid) continue;
    minFloor = Math.min(minFloor, g.kind[i] === CellKind.Pit ? PIT_DEPTH : g.floor[i]);
    maxCeil = Math.max(maxCeil, g.ceil[i]);
  }

  // Solid rock: full-height columns.
  mergeByKey(g, (i) => (g.kind[i] === CellKind.Solid ? 1 : null), (x, z, w, h) => {
    const y0 = minFloor - SLAB;
    const y1 = maxCeil + SLAB;
    boxes.push(box(x, z, w, h, y0, y1, "wall"));
  });

  // Floors: a slab under every open cell, merged by height.
  mergeByKey(
    g,
    (i) => (g.kind[i] === CellKind.Solid ? null : g.kind[i] === CellKind.Pit ? PIT_DEPTH : g.floor[i]),
    (x, z, w, h, y) => boxes.push(box(x, z, w, h, y - SLAB, y, "floor")),
  );

  // Ceilings.
  mergeByKey(
    g,
    (i) => (g.kind[i] === CellKind.Solid ? null : g.ceil[i]),
    (x, z, w, h, y) => boxes.push(box(x, z, w, h, y, y + SLAB, "ceiling")),
  );

  for (const d of layout.decor) {
    if (!d.solid) continue;
    const [hx, hy, hz] = d.solid.half;
    // Decor colliders are axis-aligned; generators keep solid decor at 90°.
    const swap = Math.abs(Math.sin(d.yaw)) > 0.7;
    boxes.push({
      center: [d.pos.x, d.pos.y + hy, d.pos.z],
      half: swap ? [hz, hy, hx] : [hx, hy, hz],
      role: "decor",
    });
  }
  return boxes;
}

function box(x: number, z: number, w: number, h: number, y0: number, y1: number, role: StaticBox["role"]): StaticBox {
  return {
    center: [(x + w / 2) * CELL, (y0 + y1) / 2, (z + h / 2) * CELL],
    half: [(w * CELL) / 2, (y1 - y0) / 2, (h * CELL) / 2],
    role,
  };
}

/** Greedy rectangle merge of cells sharing the same key (null = skip). */
function mergeByKey(
  g: FloorGrid,
  key: (i: number) => number | null,
  emit: (x: number, z: number, w: number, h: number, value: number) => void,
): void {
  const used = new Uint8Array(g.w * g.h);
  for (let z = 0; z < g.h; z++) {
    for (let x = 0; x < g.w; x++) {
      const i = z * g.w + x;
      if (used[i]) continue;
      const k = key(i);
      if (k === null) continue;
      let w = 1;
      while (x + w < g.w && !used[i + w] && key(i + w) === k) w++;
      let h = 1;
      outer: while (z + h < g.h) {
        for (let dx = 0; dx < w; dx++) {
          const j = (z + h) * g.w + x + dx;
          if (used[j] || key(j) !== k) break outer;
        }
        h++;
      }
      for (let dz = 0; dz < h; dz++) for (let dx = 0; dx < w; dx++) used[(z + dz) * g.w + x + dx] = 1;
      emit(x, z, w, h, k);
    }
  }
}
