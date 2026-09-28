import { describe, expect, test } from "bun:test";
import { buildStaticBoxes } from "./colliders";
import { generateFloor } from "./generate";
import { reachable, roomCenter } from "./generators/common";

describe("generateFloor", () => {
  test("is deterministic", () => {
    const a = generateFloor(1234, 3);
    const b = generateFloor(1234, 3);
    expect(Buffer.from(a.grid.kind)).toEqual(Buffer.from(b.grid.kind));
    expect(a.spawns).toEqual(b.spawns);
    expect(a.fixtures.length).toBe(b.fixtures.length);
  });

  test("different seeds differ", () => {
    const a = generateFloor(1, 2);
    const b = generateFloor(2, 2);
    expect(Buffer.from(a.grid.kind)).not.toEqual(Buffer.from(b.grid.kind));
  });

  test("descent is reachable from arrival across many seeds", () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const floor of [1, 5, 9, 10]) {
        const l = generateFloor(seed * 7919, floor);
        const arrival = l.rooms.find((r) => r.role === "arrival")!;
        const descent = l.rooms.find((r) => r.role === "descent")!;
        expect(arrival).toBeDefined();
        expect(descent).toBeDefined();
        expect(reachable(l.grid, roomCenter(arrival), roomCenter(descent))).toBe(true);
      }
    }
  });

  test("has creatures, props, fixtures and a descent", () => {
    const l = generateFloor(99, 4);
    expect(l.spawns.some((s) => s.kind === "creature")).toBe(true);
    expect(l.spawns.some((s) => s.kind === "prop")).toBe(true);
    expect(l.spawns.some((s) => s.def === "descent")).toBe(true);
    expect(l.fixtures.length).toBeGreaterThan(5);
  });

  test("warden floors place the warden and seal the descent", () => {
    const l = generateFloor(5, 10);
    expect(l.spawns.some((s) => s.data?.warden)).toBe(true);
    expect(l.spawns.find((s) => s.def === "descent")?.data?.sealed).toBe(true);
  });

  test("static colliders are compact", () => {
    const l = generateFloor(42, 6);
    const boxes = buildStaticBoxes(l);
    expect(boxes.length).toBeGreaterThan(10);
    expect(boxes.length).toBeLessThan(l.grid.w * l.grid.h * 0.5);
  });
});
