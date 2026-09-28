/** Print a floor layout as ASCII: `bun scripts/floor-ascii.ts [seed] [floor]`. */
import { generateFloor } from "../src/shared/world/generate";
import { CellKind, CellTag } from "../src/shared/world/layout";

const seed = Number(process.argv[2] ?? 1);
const floor = Number(process.argv[3] ?? 1);
const l = generateFloor(seed, floor);
const g = l.grid;
const marks = new Map<number, string>();
for (const s of l.spawns) {
  const i = Math.floor(s.pos.z) * g.w + Math.floor(s.pos.x);
  marks.set(i, s.kind === "creature" ? "c" : s.kind === "prop" ? "o" : s.kind === "trap" ? "^" : s.def === "descent" ? "D" : s.def === "arrival" ? "A" : "?");
}
for (const f of l.fixtures) marks.set(Math.floor(f.pos.z) * g.w + Math.floor(f.pos.x), "*");
let out = "";
for (let z = 0; z < g.h; z++) {
  let row = "";
  for (let x = 0; x < g.w; x++) {
    const i = z * g.w + x;
    const m = marks.get(i);
    if (m) row += m;
    else if (g.kind[i] === CellKind.Solid) row += "█";
    else if (g.kind[i] === CellKind.Pit) row += " ";
    else if (g.liquid[i]) row += "~";
    else if (g.tags[i] & CellTag.Stair) row += "=";
    else row += g.floor[i] > 0.1 ? "+" : g.floor[i] < -0.1 ? "-" : ".";
  }
  out += row + "\n";
}
console.log(out);
console.log(`biome=${l.biome} size=${g.w} rooms=${l.rooms.length} spawns=${l.spawns.length} fixtures=${l.fixtures.length} decor=${l.decor.length}`);
