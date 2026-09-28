import type { Collider, EventQueue, World } from "@dimforge/rapier3d-compat";
import { floorScale, KILL_Y, TICK_DT } from "../config";
import { CREATURES, PROPS, TRAPS } from "../content";
import type { FactionId } from "../content/types";
import type { V3 } from "../util/math";
import { v3, v3dist2 } from "../util/math";
import { Rng } from "../util/rng";
import type { FloorLayout } from "../world/layout";
import { Anim, EntityType, Flag, type Entity } from "./entity";
import type { SimEvent } from "./events";
import { NavGrid } from "./nav";
import { addStaticLayout, createWorld, RAPIER } from "./physics";
import { SurfaceGrid } from "./surfaces";
import { spawnCreature, updateCreatures } from "./creatures";
import { tickStatuses, applyContactForces, updateSurfaceContact } from "./combat";
import { updateProjectiles } from "./spells";
import { spawnInteractable, spawnProp, spawnTrap, updateObjects } from "./objects";
import { updatePlayers } from "./players";

/** Hooks through which the floor simulation talks to its host (the game
 * server or the offline worker). The sim knows nothing of accounts,
 * inventories or matchmaking; items are opaque payloads it only carries. */
export interface SimHooks {
  /** Roll `count` loot items for this floor. */
  rollLoot(rng: Rng, luck: number, count: number): unknown[];
  /** A stack of a specific base (materials). */
  makeStack(baseId: string, qty: number): unknown;
  describeItem(item: unknown): { name: string; rarity: string; rare: boolean };
  /** A player picked up an item. Return false to leave it (bag full). */
  onPickup(playerId: number, item: unknown): boolean;
  onGold(playerId: number, amount: number): void;
  /** A player died. Return the items that go into their Reliquary. */
  onPlayerDeath(playerId: number, killerId: number, cause: string): unknown[];
  /** A player used the Descent (ascend = leave for the village). */
  onDescent(playerId: number, ascend: boolean): void;
  /** Whether this player may Ascend from here (5-floor rule). */
  canAscend(playerId: number): boolean;
  onNote(playerId: number, stratum: number, pick: number): void;
  /** A creature was killed (kill credit, stats). */
  onKill?(killerId: number, victim: Entity): void;
}

export class FloorSim {
  readonly layout: FloorLayout;
  readonly world: World;
  readonly nav: NavGrid;
  readonly surfaces: SurfaceGrid;
  readonly rng: Rng;
  readonly scale: ReturnType<typeof floorScale>;
  readonly entities = new Map<number, Entity>();
  readonly byCollider = new Map<number, Entity>();
  events: SimEvent[] = [];
  tick = 0;
  time = 0;
  /** Positions of burning fixtures (torches, braziers) — fire sources. */
  readonly fireSources: V3[];
  private nextId = 1;
  private timers: { at: number; fn: () => void }[] = [];
  private eventQueue: EventQueue;
  private lists = new Map<EntityType, Entity[]>();
  private listsDirty = true;

  constructor(
    layout: FloorLayout,
    readonly hooks: SimHooks,
    seed: number,
  ) {
    this.layout = layout;
    this.rng = new Rng(seed);
    this.scale = floorScale(layout.floor);
    this.world = createWorld();
    this.world.timestep = TICK_DT;
    addStaticLayout(this.world, layout);
    this.nav = new NavGrid(layout.grid);
    this.surfaces = new SurfaceGrid(layout, () => this.rng.next());
    this.fireSources = layout.fixtures.filter((f) => f.burning).map((f) => f.pos);
    this.eventQueue = new RAPIER.EventQueue(true);
    this.spawnLayout();
  }

  // ── entity bookkeeping ───────────────────────────────────────────────────

  allocId(): number {
    return this.nextId++;
  }

  newEntity(type: EntityType, def: string, pos: V3, team: FactionId): Entity {
    const e: Entity = {
      id: this.allocId(),
      type,
      def,
      pos: { ...pos },
      vel: v3(),
      yaw: 0,
      quat: null,
      anim: Anim.Idle,
      animVariant: 0,
      animTick: this.tick,
      flags: 0,
      hp: 0,
      maxHp: 0,
      team,
      mass: 0,
      radius: 0.3,
      height: 1,
      statuses: new Map(),
      body: null,
      collider: null,
      removed: false,
      changedTick: this.tick,
    };
    this.entities.set(e.id, e);
    this.listsDirty = true;
    return e;
  }

  bindCollider(e: Entity, c: Collider): void {
    e.collider = c;
    this.byCollider.set(c.handle, e);
  }

  entityOfCollider(c: Collider | null | undefined): Entity | undefined {
    return c ? this.byCollider.get(c.handle) : undefined;
  }

  /** Remove at the end of the tick (safe during iteration). */
  remove(e: Entity): void {
    if (e.removed) return;
    e.removed = true;
    this.listsDirty = true;
  }

  get(id: number): Entity | undefined {
    const e = this.entities.get(id);
    return e && !e.removed ? e : undefined;
  }

  list(type: EntityType): Entity[] {
    if (this.listsDirty) {
      this.lists.clear();
      for (const e of this.entities.values()) {
        if (e.removed) continue;
        let l = this.lists.get(e.type);
        if (!l) this.lists.set(e.type, (l = []));
        l.push(e);
      }
      this.listsDirty = false;
    }
    return this.lists.get(type) ?? [];
  }

  /** Living things with health (players, creatures) near a point. */
  bodiesNear(p: V3, radius: number, filter?: (e: Entity) => boolean): Entity[] {
    const out: Entity[] = [];
    for (const type of [EntityType.Player, EntityType.Creature, EntityType.Prop]) {
      for (const e of this.list(type)) {
        if (e.removed || v3dist2(e.pos, p) > (radius + e.radius) * (radius + e.radius)) continue;
        if (filter && !filter(e)) continue;
        out.push(e);
      }
    }
    return out;
  }

  emit(ev: SimEvent): void {
    this.events.push(ev);
  }

  drainEvents(): SimEvent[] {
    const ev = this.events;
    this.events = [];
    return ev;
  }

  /** Mark replicated state changed. */
  touch(e: Entity): void {
    e.changedTick = this.tick;
  }

  setAnim(e: Entity, anim: Anim, variant = 0): void {
    if (e.anim === anim && e.animVariant === variant) return;
    e.anim = anim;
    e.animVariant = variant;
    e.animTick = this.tick;
    this.touch(e);
  }

  setFlag(e: Entity, flag: number, on: boolean): void {
    const next = on ? e.flags | flag : e.flags & ~flag;
    if (next !== e.flags) {
      e.flags = next;
      this.touch(e);
    }
  }

  // ── spawning ─────────────────────────────────────────────────────────────

  private spawnLayout(): void {
    for (const s of this.layout.spawns) {
      switch (s.kind) {
        case "creature":
          if (CREATURES.has(s.def)) spawnCreature(this, CREATURES.get(s.def), s.pos, s.yaw, { warden: !!s.data?.warden });
          break;
        case "prop":
          if (PROPS.has(s.def)) spawnProp(this, PROPS.get(s.def), s.pos, s.yaw);
          break;
        case "trap":
          if (TRAPS.has(s.def)) spawnTrap(this, TRAPS.get(s.def), s.pos, s.yaw);
          break;
        case "interactable":
          spawnInteractable(this, s.def, s.pos, s.yaw, s.data ?? {});
          break;
      }
    }
  }

  // ── the tick ─────────────────────────────────────────────────────────────

  /** Run `fn` after `delay` seconds of sim time. */
  later(delay: number, fn: () => void): void {
    this.timers.push({ at: this.time + delay, fn });
  }

  step(): void {
    const dt = TICK_DT;
    this.tick++;
    this.time += dt;
    if (this.timers.length) {
      const due = this.timers.filter((t) => t.at <= this.time);
      if (due.length) {
        this.timers = this.timers.filter((t) => t.at > this.time);
        for (const t of due) t.fn();
      }
    }

    updatePlayers(this, dt);
    updateCreatures(this, dt);
    updateObjects(this, dt);

    this.world.step(this.eventQueue);
    this.eventQueue.drainContactForceEvents((ev) => applyContactForces(this, ev));
    this.readBodies();

    updateProjectiles(this, dt);
    updateSurfaceContact(this, dt);
    tickStatuses(this, dt);
    this.surfaces.update(dt);
    const surf = this.surfaces.drainChanges();
    if (surf.length) this.emit({ t: "surf", cells: surf });

    this.sweepRemoved();
  }

  /** Copy physics state into entity headers; enforce the kill plane. */
  private readBodies(): void {
    for (const e of this.entities.values()) {
      const b = e.body;
      if (!b || e.removed) continue;
      if (e.type === EntityType.Player) continue; // players are driven by input
      const t = b.translation();
      const v = b.linvel();
      const moved = Math.abs(t.x - e.pos.x) + Math.abs(t.y - e.pos.y) + Math.abs(t.z - e.pos.z) > 0.004;
      e.pos.x = t.x;
      e.pos.y = t.y;
      e.pos.z = t.z;
      e.vel.x = v.x;
      e.vel.y = v.y;
      e.vel.z = v.z;
      if (e.quat) {
        const r = b.rotation();
        const rotated = Math.abs(r.x - e.quat.x) + Math.abs(r.y - e.quat.y) + Math.abs(r.z - e.quat.z) + Math.abs(r.w - e.quat.w) > 0.002;
        if (rotated) {
          e.quat.x = r.x;
          e.quat.y = r.y;
          e.quat.z = r.z;
          e.quat.w = r.w;
          this.touch(e);
        }
      }
      if (moved) this.touch(e);
      if (t.y < KILL_Y) this.fellIntoAbyss(e);
    }
  }

  private fellIntoAbyss(e: Entity): void {
    if (e.type === EntityType.Creature && e.hp > 0) {
      this.emit({ t: "sound", id: "fall_scream", p: [e.pos.x, e.pos.y + 6, e.pos.z] });
      e.hp = 0;
      this.setAnim(e, Anim.Dead);
      this.hooks.onKill?.(e.creature?.grudges.keys().next().value ?? 0, e);
    }
    this.remove(e);
  }

  private sweepRemoved(): void {
    let any = false;
    for (const e of this.entities.values()) {
      if (!e.removed) continue;
      if (e.collider) this.byCollider.delete(e.collider.handle);
      if (e.body) this.world.removeRigidBody(e.body);
      else if (e.collider) this.world.removeCollider(e.collider, false);
      e.body = null;
      e.collider = null;
      this.entities.delete(e.id);
      this.removedIds.push(e.id);
      any = true;
    }
    if (any) this.listsDirty = true;
  }

  /** Ids removed since the last drain (for replication). */
  removedIds: number[] = [];

  drainRemoved(): number[] {
    const r = this.removedIds;
    this.removedIds = [];
    return r;
  }

  // ── queries ──────────────────────────────────────────────────────────────

  /** Is there an unobstructed line from a to b through the static world? */
  lineOfSight(a: V3, b: V3): boolean {
    return this.nav.lineOfSight(a, b);
  }

  /** Ground height under a point (grid). */
  groundAt(x: number, z: number): number {
    const g = this.layout.grid;
    const cx = Math.floor(x);
    const cz = Math.floor(z);
    if (cx < 0 || cz < 0 || cx >= g.w || cz >= g.h) return -1e3;
    return g.floor[cz * g.w + cx];
  }

  flagged(e: Entity, flag: number): boolean {
    return (e.flags & flag) !== 0;
  }

  isWarden(e: Entity): boolean {
    return (e.flags & Flag.Warden) !== 0;
  }

  dispose(): void {
    this.eventQueue.free();
    this.world.free();
  }
}
