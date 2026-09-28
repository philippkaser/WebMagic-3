import { describe, expect, test } from "bun:test";
import { ENCOUNTER } from "../../shared/config";
import { chooseInstance, encounterChance } from "./matchmaker";

const inst = (id: string, floor: number, members: number, createdAt = 0, open = true) => ({ id, floor, members, createdAt, open });

describe("matchmaker", () => {
  test("never matches across floors", () => {
    expect(chooseInstance([inst("a", 4, 1)], { floor: 5, now: 1000, lonelyMinutes: 99 }, () => 0)).toBeNull();
  });
  test("joins with the encounter chance, else creates", () => {
    const c = [inst("a", 5, 1)];
    expect(chooseInstance(c, { floor: 5, now: 1000, lonelyMinutes: 0 }, () => ENCOUNTER.joinChance - 0.01)).toBe("a");
    expect(chooseInstance(c, { floor: 5, now: 1000, lonelyMinutes: 0 }, () => ENCOUNTER.joinChance + 0.01)).toBeNull();
  });
  test("loneliness raises the chance up to a cap", () => {
    expect(encounterChance(0)).toBe(ENCOUNTER.joinChance);
    expect(encounterChance(1000)).toBe(ENCOUNTER.maxJoinChance);
  });
  test("respects capacity, join window and closure", () => {
    const now = (ENCOUNTER.joinWindowSec + 1) * 1000;
    expect(chooseInstance([inst("full", 5, ENCOUNTER.maxPlayersPerInstance)], { floor: 5, now: 0, lonelyMinutes: 0 }, () => 0)).toBeNull();
    expect(chooseInstance([inst("old", 5, 1, 0)], { floor: 5, now, lonelyMinutes: 0 }, () => 0)).toBeNull();
    expect(chooseInstance([inst("closed", 5, 1, 0, false)], { floor: 5, now: 0, lonelyMinutes: 0 }, () => 0)).toBeNull();
  });
  test("pact allies always follow each other down", () => {
    expect(chooseInstance([inst("p", 6, 1)], { floor: 6, now: 0, lonelyMinutes: 0, partyInstance: "p" }, () => 0.99)).toBe("p");
  });
  test("prefers the loneliest instance", () => {
    const c = [inst("pair", 5, 2), inst("solo", 5, 1)];
    expect(chooseInstance(c, { floor: 5, now: 0, lonelyMinutes: 0 }, () => 0)).toBe("solo");
  });
});
