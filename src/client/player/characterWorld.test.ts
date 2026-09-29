import { beforeAll, describe, expect, test } from "bun:test";
import { GRAVITY, PLAYER } from "../../shared/config";
import { GROUPS, initPhysics } from "../../shared/sim/physics";
import { Rng } from "../../shared/util/rng";
import { buildStaticBoxes } from "../../shared/world/colliders";
import { generateFloor } from "../../shared/world/generate";
import { CellKind } from "../../shared/world/layout";
import { createCharacterWorld } from "./characterWorld";

const STAND = PLAYER.halfHeight + PLAYER.radius;
const DT = 1 / 60;

beforeAll(async () => {
  await initPhysics();
});

describe("character world", () => {
  test("the capsule stands on the ground from the very first frame", () => {
    const cw = createCharacterWorld([{ center: [0, -0.5, 0], half: [5, 0.5, 5], role: "floor" }], { x: 0, y: STAND + 0.01, z: 0 });
    cw.kcc.computeColliderMovement(cw.collider, { x: 0, y: GRAVITY * DT * DT - 0.2, z: 0 }, undefined, GROUPS.player);
    expect(cw.kcc.computedGrounded()).toBe(true);
    expect(cw.kcc.computedMovement().y).toBeGreaterThan(-0.05);
    cw.world.free();
  });

  // Walk like the client does (step the world every frame, then move) in
  // random directions across real floors: never sink under solid ground.
  for (const [seed, floor] of [
    [11, 1],
    [42, 3],
    [7, 12],
    [99, 25],
  ] as const) {
    test(`a wandering delver never sinks through floor ${floor} (seed ${seed})`, () => {
      const layout = generateFloor(seed, floor);
      const g = layout.grid;
      const spawn = { x: layout.arrival.x, y: layout.arrival.y + STAND + 0.01, z: layout.arrival.z };
      const cw = createCharacterWorld(buildStaticBoxes(layout), spawn);
      const rng = new Rng(seed);
      const pos = { ...spawn };
      const vel = { x: 0, y: 0, z: 0 };
      let heading = rng.range(0, Math.PI * 2);
      let sunk = 0;
      for (let f = 0; f < 60 * 40; f++) {
        if (f % 90 === 0) heading = rng.range(0, Math.PI * 2);
        vel.x = Math.cos(heading) * PLAYER.speed;
        vel.z = Math.sin(heading) * PLAYER.speed;
        vel.y += GRAVITY * DT;
        cw.world.step();
        cw.kcc.computeColliderMovement(cw.collider, { x: vel.x * DT, y: vel.y * DT, z: vel.z * DT }, undefined, GROUPS.player);
        const m = cw.kcc.computedMovement();
        pos.x += m.x;
        pos.y += m.y;
        pos.z += m.z;
        cw.body.setNextKinematicTranslation(pos);
        if (cw.kcc.computedGrounded() && vel.y < 0) vel.y = 0;
        const cx = Math.floor(pos.x);
        const cz = Math.floor(pos.z);
        const i = cz * g.w + cx;
        if (g.kind[i] === CellKind.Pit) break; // walked into a pit: a real fall
        if (g.kind[i] === CellKind.Open && pos.y < g.floor[i] + STAND - 0.3) sunk++;
      }
      cw.world.free();
      expect(sunk).toBe(0);
    });
  }
});
