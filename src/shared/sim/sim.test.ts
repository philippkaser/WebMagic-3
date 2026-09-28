import { beforeAll, describe, expect, test } from "bun:test";
import { STARTER_FOCUS } from "../content";
import { makeStack, rollDrop, rollGear } from "../game/items";
import { computeStats } from "../game/stats";
import { ITEMS } from "../content";
import { dirFromAngles } from "../util/math";
import { Rng } from "../util/rng";
import { generateFloor } from "../world/generate";
import { EntityType } from "./entity";
import { FloorSim, type SimHooks } from "./FloorSim";
import { initPhysics } from "./physics";
import { addPlayer, playerCast, playerInput } from "./players";

function hooks(log: string[]): SimHooks {
  return {
    rollLoot: (rng, luck, count) => Array.from({ length: count }, () => rollDrop(rng, 3, luck)),
    makeStack: (id, qty) => makeStack(id, qty),
    describeItem: (item) => ({ name: String((item as { base: string }).base), rarity: "common", rare: false }),
    onPickup: () => true,
    onGold: (_id, amt) => log.push(`gold ${amt}`),
    onPlayerDeath: () => {
      log.push("died");
      return [];
    },
    onDescent: () => log.push("descent"),
    canAscend: () => false,
    onNote: () => log.push("note"),
  };
}

beforeAll(async () => {
  await initPhysics();
});

describe("FloorSim", () => {
  test("runs a floor with a player without errors", () => {
    const layout = generateFloor(777, 3);
    const log: string[] = [];
    const sim = new FloorSim(layout, hooks(log), 1);
    const staff = rollGear(new Rng(1), ITEMS.get(STARTER_FOCUS), 3, "common");
    const stats = computeStats({ focus: staff });
    const p = addPlayer(sim, { name: "Test", pos: { ...layout.arrival, y: layout.arrival.y + 0.9 }, yaw: layout.arrivalYaw, stats });
    const creatures = sim.list(EntityType.Creature).length;
    expect(creatures).toBeGreaterThan(0);
    let casts = 0;
    for (let i = 0; i < 600; i++) {
      if (i % 10 === 0) {
        const d = dirFromAngles(layout.arrivalYaw + Math.sin(i) * 0.5, -0.05);
        if (playerCast(sim, p, i % 40 === 0 ? "secondary" : "primary", i, { x: p.pos.x, y: p.pos.y + 0.6, z: p.pos.z }, d)) casts++;
      }
      playerInput(sim, p, { seq: i + 1, pos: p.pos, vel: { x: 0, y: 0, z: 0 }, yaw: layout.arrivalYaw, pitch: 0, grounded: true });
      sim.step();
      sim.drainEvents();
    }
    expect(casts).toBeGreaterThan(10);
    // Physics kept bodies inside the world.
    for (const e of sim.list(EntityType.Creature)) expect(Number.isFinite(e.pos.x)).toBe(true);
    sim.dispose();
  });

  test("creatures hunt a delver standing near them", () => {
    const layout = generateFloor(4242, 2);
    const sim = new FloorSim(layout, hooks([]), 2);
    const c = sim.list(EntityType.Creature)[0];
    const stats = computeStats({});
    // Stand a few metres from the creature, somewhere it can see.
    let pos = { ...c.pos };
    search: for (let r = 2; r <= 5; r++) {
      for (let a = 0; a < 16; a++) {
        const cand = { x: c.pos.x + Math.sin(a) * r, y: c.pos.y, z: c.pos.z + Math.cos(a) * r };
        if (sim.nav.walkable(Math.floor(cand.x), Math.floor(cand.z)) && sim.lineOfSight(c.pos, cand)) {
          pos = { ...cand, y: sim.groundAt(cand.x, cand.z) + 0.87 };
          break search;
        }
      }
    }
    const p = addPlayer(sim, { name: "Bait", pos, yaw: 0, stats });
    const hp0 = p.hp;
    for (let i = 0; i < 300; i++) {
      playerInput(sim, p, { seq: i + 1, pos: p.pos, vel: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, grounded: true });
      sim.step();
    }
    const events = sim.drainEvents();
    const attacked = p.hp < hp0 || events.some((e) => e.t === "hit" && e.id === p.id);
    expect(c.creature!.targetId === p.id || attacked).toBe(true);
    sim.dispose();
  });

  test("fire spreads through oil", () => {
    const layout = generateFloor(9, 1);
    const sim = new FloorSim(layout, hooks([]), 3);
    const a = layout.arrival;
    sim.surfaces.paint(a.x, a.z, 2, 2 /* oil */);
    sim.surfaces.react(a.x, a.z, 0.3, "fire");
    let fire = 0;
    for (let i = 0; i < 60; i++) sim.step();
    sim.surfaces.forDisc(a.x, a.z, 2, (_x, _z, i) => {
      if (sim.surfaces.kind[i] === 5 || sim.surfaces.kind[i] === 10) fire++;
    });
    expect(fire).toBeGreaterThan(10);
    sim.dispose();
  });
});
