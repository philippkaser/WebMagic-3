import { SNAPSHOT_EVERY } from "../../shared/config";
import { rollDrop, itemName, makeStack, rarityRank } from "../../shared/game/items";
import type { ItemInstance } from "../../shared/content/types";
import { notesFor } from "../../shared/content/notes";
import { encodeSnapshot, snapOf, type EntitySnap } from "../../shared/net/codec";
import type { EntityInfo, SelfState } from "../../shared/net/protocol";
import { EntityType, Flag, type Entity } from "../../shared/sim/entity";
import type { SimEvent } from "../../shared/sim/events";
import { FloorSim, type SimHooks } from "../../shared/sim/FloorSim";
import { addPlayer, setPlayerStats } from "../../shared/sim/players";
import { generateFloor } from "../../shared/world/generate";
import type { FloorLayout } from "../../shared/world/layout";
import { Rng } from "../../shared/util/rng";
import type { GameServer, Session } from "./GameServer";
import { canAscend } from "../../shared/game/rules";

/** One running floor: a FloorSim plus the sessions inside it, snapshot
 * replication per member, and the glue between sim hooks and accounts. */
export class FloorInstance {
  readonly sim: FloorSim;
  readonly layout: FloorLayout;
  readonly members = new Map<number, Session>();
  readonly createdAt: number;
  open = true;
  private pendingEvents: SimEvent[] = [];
  private pendingRemoved: number[] = [];

  constructor(
    readonly server: GameServer,
    readonly id: string,
    readonly floor: number,
    readonly seed: number,
  ) {
    this.createdAt = server.now();
    this.layout = generateFloor(seed, floor);
    this.sim = new FloorSim(this.layout, this.hooks(), seed ^ 0x51f15e);
  }

  get memberCount(): number {
    return this.members.size;
  }

  /** Bring a session in: spawn its delver and send the scene. */
  admit(session: Session): Entity {
    const others = [...this.members.values()];
    const a = session.account!;
    const spawn = this.layout.arrival;
    const jitter = others.length ? { x: (Math.random() - 0.5) * 2, z: (Math.random() - 0.5) * 2 } : { x: 0, z: 0 };
    const e = addPlayer(this.sim, {
      name: a.name,
      pos: { x: spawn.x + jitter.x, y: spawn.y + 0.87, z: spawn.z + jitter.z },
      yaw: this.layout.arrivalYaw,
      stats: session.stats(),
      hp: session.carryHp,
      mana: session.carryMana,
    });
    this.members.set(e.id, session);
    session.floorInstance = this;
    session.entityId = e.id;
    session.known.clear();
    session.infoSent.clear();
    session.send({
      t: "scene",
      info: {
        scene: "floor",
        you: e.id,
        floor: this.floor,
        seed: this.seed,
        biome: this.layout.biome,
        instance: this.id,
        arrival: [e.pos.x, e.pos.y, e.pos.z],
        yaw: this.layout.arrivalYaw,
        surfaces: this.sim.surfaces.snapshot(),
        serverTime: this.server.now(),
      },
      run: session.runView(),
    });
    // Presence: nobody is told outright — but you hear it.
    if (others.length) {
      for (const o of others) {
        o.send({ t: "toast", text: "A second heartbeat. You are not alone on this floor.", kind: "presence" });
        o.account!.lastEncounter = this.server.now();
      }
      session.send({ t: "toast", text: "Somewhere on this floor, another heart is beating.", kind: "presence" });
      a.lastEncounter = this.server.now();
    }
    return e;
  }

  /** Take a session out (descend, ascend, disconnect, back to village). */
  release(session: Session): void {
    const e = this.sim.get(session.entityId);
    if (e) {
      session.carryHp = e.hp;
      session.carryMana = e.player?.mana;
      this.sim.remove(e);
    }
    this.members.delete(session.entityId);
    if (session.floorInstance === this) session.floorInstance = null;
    session.entityId = 0;
  }

  refreshStats(session: Session): void {
    const e = this.sim.get(session.entityId);
    if (e) setPlayerStats(this.sim, e, session.stats());
  }

  step(): void {
    this.sim.step();
    this.pendingEvents.push(...this.sim.drainEvents());
    this.pendingRemoved.push(...this.sim.drainRemoved());
    if (this.open && this.members.size > 0) {
      for (const c of this.sim.list(EntityType.Creature)) {
        if (c.flags & Flag.Warden && c.creature?.targetId) this.open = false;
      }
    }
    if (this.sim.tick % SNAPSHOT_EVERY === 0) this.broadcast();
  }

  private broadcast(): void {
    const sim = this.sim;
    const events = this.pendingEvents;
    const removed = this.pendingRemoved;
    this.pendingEvents = [];
    this.pendingRemoved = [];
    const all = [...sim.entities.values()].filter((e) => !e.removed);
    for (const [pid, s] of this.members) {
      const viewer = sim.get(pid);
      const snaps: EntitySnap[] = [];
      const infos: EntityInfo[] = [];
      for (const e of all) {
        const last = s.known.get(e.id);
        if (last !== undefined && e.changedTick <= last) continue;
        s.known.set(e.id, sim.tick);
        snaps.push(snapOf(e, sim.tick, this.viewerFlags(e, viewer, s)));
        if (!s.infoSent.has(e.id)) {
          s.infoSent.add(e.id);
          const info = this.infoOf(e, pid);
          if (info) infos.push(info);
        }
      }
      const gone = removed.filter((id) => s.known.delete(id));
      if (infos.length) s.send({ t: "info", list: infos });
      s.sendBinary(encodeSnapshot({ tick: sim.tick, serverTime: this.server.now(), entities: snaps, removed: gone }));
      const mine = events.filter((ev) => ev.t !== "msg" || ev.to === pid);
      if (mine.length) s.send({ t: "ev", ev: mine });
      if (viewer?.player) s.send({ t: "self", s: this.selfState(viewer) });
    }
  }

  private viewerFlags(e: Entity, viewer: Entity | undefined, s: Session): number {
    let f = e.flags;
    if (e.player && viewer?.player?.pactWith.has(e.id)) f |= Flag.Ally;
    if (e.interact?.kind === "descent" && s.run && canAscend(s.run.floorsCleared)) f |= Flag.CanAscend;
    return f;
  }

  private infoOf(e: Entity, viewer: number): EntityInfo | null {
    if (e.projectile) return e.projectile.owner === viewer && e.projectile.castId ? { id: e.id, own: true } : null;
    if (e.player) {
      const s = this.members.get(e.id);
      return { id: e.id, name: e.player.name, look: s?.look(), oath: e.player.oathbroken };
    }
    if (e.pickup?.item) {
      const it = e.pickup.item as ItemInstance;
      return { id: e.id, name: itemName(it), rarity: it.rarity };
    }
    if (e.creature?.warden) return { id: e.id, name: e.creature.def.name };
    if (e.interact?.kind === "reliquary") return { id: e.id, name: `Reliquary of ${e.interact.data.owner ?? "a delver"}` };
    return null;
  }

  private selfState(e: Entity): SelfState {
    const p = e.player!;
    const st: Record<string, number> = {};
    for (const [id, s] of e.statuses) st[id] = Math.round(s.time * 10) / 10;
    const cd: Record<string, number> = {};
    for (const [k, v] of Object.entries(p.cooldowns)) if (v > 0) cd[k] = Math.round(v * 100) / 100;
    const out: SelfState = { hp: Math.round(e.hp * 10) / 10, maxHp: e.maxHp, mana: Math.round(p.mana * 10) / 10, maxMana: p.maxMana, cd, st, channel: p.channel?.spell ?? null, grasp: p.grasp?.targetId ?? 0 };
    const imp = p.pendingImpulse;
    if (imp.x || imp.y || imp.z) {
      out.imp = [imp.x, imp.y, imp.z];
      p.pendingImpulse = { x: 0, y: 0, z: 0 };
    }
    return out;
  }

  private hooks(): SimHooks {
    const floor = this.floor;
    return {
      rollLoot: (rng: Rng, luck: number, count: number) => Array.from({ length: count }, () => rollDrop(rng, floor, luck)),
      makeStack: (base: string, qty: number) => makeStack(base, qty, floor),
      describeItem: (item: unknown) => {
        const it = item as ItemInstance;
        return { name: itemName(it), rarity: it.rarity, rare: rarityRank(it.rarity) >= 2 };
      },
      onPickup: (pid: number, item: unknown) => this.server.pickup(this.members.get(pid), item as ItemInstance),
      onGold: (pid: number, amount: number) => this.server.gold(this.members.get(pid), amount),
      onPlayerDeath: (pid: number, killer: number, cause: string) => {
        const s = this.members.get(pid);
        if (!s) return [];
        const k = this.sim.get(killer);
        const killerName = k?.player ? k.player.name : k?.creature ? k.creature.def.name : cause;
        return this.server.death(s, killerName, cause, floor);
      },
      onDescent: (pid: number, ascend: boolean) => {
        const s = this.members.get(pid);
        if (s) this.server.descend(s, this, ascend);
      },
      canAscend: (pid: number) => {
        const s = this.members.get(pid);
        return !!s?.run && canAscend(s.run.floorsCleared);
      },
      onNote: (pid: number, stratum: number, pick: number) => {
        const s = this.members.get(pid);
        const pool = notesFor(stratum);
        if (!s || !pool.length) return;
        const n = pool[pick % pool.length];
        if (!s.account!.lore.includes(n.id)) s.account!.lore.push(n.id);
        s.send({ t: "note", note: { id: n.id, title: n.title, author: n.author, text: n.text } });
        this.server.saveSoon(s);
      },
      onKill: (killer: number) => {
        const s = this.members.get(killer);
        if (s?.account) s.account.stats.kills++;
      },
    };
  }

  dispose(): void {
    this.sim.dispose();
  }
}
