import { beforeAll, describe, expect, test } from "bun:test";
import { initPhysics } from "../../shared/sim/physics";
import { decodeSnapshot } from "../../shared/net/codec";
import type { ServerMsg } from "../../shared/net/protocol";
import { MemoryStore } from "./account";
import { GameServer, type Session } from "./GameServer";

function client(server: GameServer) {
  const msgs: ServerMsg[] = [];
  const snaps: ArrayBuffer[] = [];
  const s: Session = server.connect({ send: (m) => msgs.push(m), sendBinary: (b) => snaps.push(b) });
  return { s, msgs, snaps, last: <T extends ServerMsg["t"]>(t: T) => msgs.filter((m) => m.t === t).pop() as Extract<ServerMsg, { t: T }> | undefined };
}

beforeAll(async () => {
  await initPhysics();
});

describe("GameServer", () => {
  test("hello → village → enter the Well → floor with snapshots", async () => {
    const server = new GameServer(new MemoryStore(), { online: false });
    const c = client(server);
    await server.handle(c.s, { t: "hello", name: "Wren", v: 1 });
    expect(c.last("welcome")?.account.name).toBe("Wren");
    expect(c.last("scene")?.info.scene).toBe("village");
    await server.handle(c.s, { t: "enter" });
    const scene = c.last("scene")!;
    expect(scene.info.scene).toBe("floor");
    expect(scene.info.floor).toBe(1);
    for (let i = 0; i < 10; i++) server.tick();
    expect(c.snaps.length).toBeGreaterThan(0);
    const snap = decodeSnapshot(c.snaps[0]);
    expect(snap.entities.length).toBeGreaterThan(10);
    expect(snap.entities.some((e) => e.id === scene.info.you)).toBe(true);
    expect(c.last("self")?.s.maxHp).toBeGreaterThan(0);
  });

  test("death forfeits run loot into a reliquary and returns to village on respawn", async () => {
    const server = new GameServer(new MemoryStore(), { online: false });
    const c = client(server);
    await server.handle(c.s, { t: "hello", name: "Moth", v: 1 });
    await server.handle(c.s, { t: "enter" });
    server.tick();
    const e = server.entityOf(c.s)!;
    // Pretend we picked something up.
    server.pickup(c.s, { uid: "x1", base: "bone_amulet", ilvl: 1, rarity: "rare", affixes: [], qty: 1 });
    server.gold(c.s, 30);
    expect(c.s.account!.equipment.amulet?.run).toBe(true);
    const inst = c.s.floorInstance!;
    e.hp = 1;
    e.player!.invuln = 0; // spawn grace
    const { damage } = await import("../../shared/sim/combat");
    damage(inst.sim, e, 50, { source: 0, element: "physical" });
    const died = c.last("died")!;
    expect(died.lost.map((i) => i.base).sort()).toEqual(["bone_amulet", "gold_coin"]);
    expect(c.s.account!.equipment.amulet).toBeNull();
    expect([...inst.sim.entities.values()].some((x) => x.interact?.kind === "reliquary")).toBe(true);
    await server.handle(c.s, { t: "respawn" });
    expect(c.last("scene")?.info.scene).toBe("village");
  });

  test("ascend only after five floors; banks loot and gold", async () => {
    const server = new GameServer(new MemoryStore(), { online: false });
    const c = client(server);
    await server.handle(c.s, { t: "hello", name: "Lark", v: 1 });
    await server.handle(c.s, { t: "enter" });
    server.pickup(c.s, { uid: "r1", base: "iron_ring", ilvl: 2, rarity: "uncommon", affixes: [], qty: 1 });
    server.gold(c.s, 12);
    for (let f = 0; f < 4; f++) server.descend(c.s, c.s.floorInstance!, true); // ascend refused → descends
    expect(c.s.run?.floorsCleared).toBe(4);
    expect(c.s.run?.floor).toBe(5);
    const gold0 = c.s.account!.gold;
    server.descend(c.s, c.s.floorInstance!, true);
    expect(c.last("ascended")?.banked.some((i) => i.base === "iron_ring")).toBe(true);
    expect(c.s.account!.gold).toBe(gold0 + 12);
    expect(c.s.account!.equipment.ring?.run).toBeUndefined();
  });
});
