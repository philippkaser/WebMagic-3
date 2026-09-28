import { KILL_Y, RUN, TICK_RATE } from "../../shared/config";
import { damage } from "../../shared/sim/combat";
import { ITEMS } from "../../shared/content";
import { COSMETICS } from "../../shared/content/shops";
import type { ItemInstance } from "../../shared/content/types";
import { makeStack, itemName } from "../../shared/game/items";
import { canAscend, entryFloor, gearLevel } from "../../shared/game/rules";
import { computeStats } from "../../shared/game/stats";
import type { ClientMsg, RunView, ServerMsg } from "../../shared/net/protocol";
import { PROTOCOL_VERSION } from "../../shared/net/protocol";
import { EntityType, type PlayerStats } from "../../shared/sim/entity";
import { interact, spawnPickup } from "../../shared/sim/objects";
import { initPhysics } from "../../shared/sim/physics";
import { playerCast, playerInput, playerRelease, playerSign, playerThrow, playerUseEffects } from "../../shared/sim/players";
import { dirFromAngles } from "../../shared/util/math";
import { randomSeed, Rng } from "../../shared/util/rng";
import { accountView, cleanName, newAccount, normalizeAccount, type Account, type AccountStore, type RunState } from "./account";
import { FloorInstance } from "./FloorInstance";
import { addToBag, forEachCarried, getAt, moveItem, takeItem } from "./inventory";
import { chooseInstance } from "./matchmaker";
import { returnKit, shopOp } from "./shops";

/** Landing faster than this (m/s) hurts. */
const FALL_SAFE = 13;

/** The game server. Transport-agnostic: the Bun host feeds it WebSocket
 * messages, the offline worker feeds it postMessage traffic — the same
 * code runs the world either way. */

export interface Connection {
  send(msg: ServerMsg): void;
  sendBinary(buf: ArrayBuffer): void;
  close?(): void;
}

export class Session {
  account: Account | null = null;
  scene: "none" | "village" | "floor" = "none";
  floorInstance: FloorInstance | null = null;
  entityId = 0;
  run: RunState | null = null;
  /** entity id → last replicated tick. */
  known = new Map<number, number>();
  infoSent = new Set<number>();
  villagePose = { p: [0, 0, 0] as [number, number, number], y: 0 };
  carryHp: number | undefined;
  carryMana: number | undefined;
  dead = false;
  /** Peak downward speed of the current fall (m/s). */
  fallSpeed = 0;
  /** Instance a pact ally descended into, for following them. */
  partyTarget: { instance: string; until: number } | null = null;
  private cachedStats: PlayerStats | null = null;

  constructor(
    readonly id: number,
    readonly conn: Connection,
  ) {}

  send(msg: ServerMsg): void {
    this.conn.send(msg);
  }

  sendBinary(buf: ArrayBuffer): void {
    this.conn.sendBinary(buf);
  }

  stats(): PlayerStats {
    if (!this.cachedStats) this.cachedStats = computeStats(this.account!.equipment);
    return this.cachedStats;
  }

  invalidateStats(): void {
    this.cachedStats = null;
  }

  look(): Record<string, string> {
    const out: Record<string, string> = {};
    const a = this.account;
    if (!a) return out;
    for (const [kind, id] of Object.entries(a.cosmetics.equipped)) {
      const c = COSMETICS.find((x) => x.id === id);
      if (c) out[kind] = c.value;
    }
    const focus = a.equipment.focus;
    if (focus) out.focus = focus.base;
    return out;
  }

  runView(): RunView {
    const r = this.run;
    return {
      active: !!r,
      startFloor: r?.startFloor ?? 0,
      floor: r?.floor ?? 0,
      floorsCleared: r?.floorsCleared ?? 0,
      canAscend: !!r && canAscend(r.floorsCleared),
      runGold: r?.runGold ?? 0,
      kit: r?.kit ?? null,
    };
  }
}

export interface ServerOptions {
  online: boolean;
  now?: () => number;
  log?: (msg: string) => void;
  /** Mint tokens/ids (crypto in production). */
  token?: () => string;
  /** Testing: every delver entering a floor joins an occupied instance if
   * one exists (bypasses the encounter probability). */
  forceEncounters?: boolean;
}

export class GameServer {
  readonly sessions = new Map<number, Session>();
  readonly instances = new Map<string, FloorInstance>();
  private nextSession = 1;
  private nextInstance = 1;
  private timer: ReturnType<typeof setInterval> | null = null;
  private saveTimers = new Map<Session, ReturnType<typeof setTimeout>>();
  private rng = new Rng(randomSeed());
  readonly now: () => number;
  private log: (msg: string) => void;
  private token: () => string;

  constructor(
    readonly store: AccountStore,
    readonly opts: ServerOptions,
  ) {
    this.now = opts.now ?? (() => Date.now());
    this.log = opts.log ?? (() => {});
    this.token = opts.token ?? (() => crypto.randomUUID());
  }

  static async create(store: AccountStore, opts: ServerOptions): Promise<GameServer> {
    await initPhysics();
    return new GameServer(store, opts);
  }

  start(): void {
    if (this.timer) return;
    let last = this.now();
    let acc = 0;
    const step = 1000 / TICK_RATE;
    // Fixed-step loop that catches up (bounded) after timer jitter.
    this.timer = setInterval(() => {
      const t = this.now();
      acc += Math.min(250, t - last);
      last = t;
      let n = 0;
      while (acc >= step && n < 5) {
        this.tick();
        acc -= step;
        n++;
      }
    }, step / 2);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  connect(conn: Connection): Session {
    const s = new Session(this.nextSession++, conn);
    this.sessions.set(s.id, s);
    return s;
  }

  disconnect(s: Session): void {
    // Leaving mid-run forfeits it (no escaping death by closing the tab);
    // the run state stays on the account and is settled at next login.
    this.leaveFloor(s);
    if (s.account) this.store.save(s.account);
    this.sessions.delete(s.id);
  }

  tick(): void {
    for (const inst of this.instances.values()) {
      inst.step();
      if (inst.memberCount === 0) {
        inst.dispose();
        this.instances.delete(inst.id);
      }
    }
    if (Math.round(this.now() / (1000 / TICK_RATE)) % 3 === 0) this.broadcastVillage();
  }

  // ── messages ─────────────────────────────────────────────────────────────

  async handle(s: Session, msg: ClientMsg): Promise<void> {
    try {
      if (msg.t === "hello") return await this.hello(s, msg.name, msg.token, msg.v);
      if (msg.t === "ping") return s.send({ t: "pong", c: msg.c, s: this.now() });
      if (!s.account) return;
      switch (msg.t) {
        case "enter":
          return this.enterWell(s);
        case "in":
          return this.input(s, msg);
        case "cast": {
          const e = this.me(s);
          if (e) playerCast(s.floorInstance!.sim, e, msg.slot, msg.id, v(msg.o), v(msg.d));
          return;
        }
        case "release": {
          const e = this.me(s);
          if (e) playerRelease(s.floorInstance!.sim, e, msg.slot);
          return;
        }
        case "interact": {
          const e = this.me(s);
          const target = s.floorInstance?.sim.get(msg.id);
          if (e && target) interact(s.floorInstance!.sim, e, target, msg.choice);
          return;
        }
        case "sign": {
          const e = this.me(s);
          if (e) playerSign(s.floorInstance!.sim, e);
          return;
        }
        case "use":
          return this.useBelt(s, msg.belt, msg.o, msg.d);
        case "inv":
          return this.inventory(s, msg.op);
        case "shop": {
          if (s.scene !== "village") return s.send({ t: "toast", text: "The shops are in Kneel.", kind: "warn" });
          const err = shopOp(s.account, msg.op, this.rng);
          if (err) s.send({ t: "toast", text: err, kind: "error" });
          if (msg.op.op === "gamble" && !err && s.account.gambleOffers) {
            s.send({ t: "gamble", offers: s.account.gambleOffers.map((o) => ({ glyph: ITEMS.get(o.base).glyph, hint: `${o.rarity} ${ITEMS.get(o.base).slot ?? ""}` })) });
          }
          s.invalidateStats();
          this.pushAccount(s);
          return;
        }
        case "village":
          return this.villageAction(s, msg.action, msg.arg);
        case "chat":
          return this.chat(s, String(msg.text ?? "").slice(0, 160));
        case "respawn":
          if (s.dead || s.scene === "floor") {
            this.leaveFloor(s);
            this.toVillage(s);
          }
          return;
      }
    } catch (err) {
      this.log(`error handling ${msg.t}: ${(err as Error).stack ?? err}`);
    }
  }

  private me(s: Session) {
    if (s.scene !== "floor" || !s.floorInstance) return undefined;
    const e = s.floorInstance.sim.get(s.entityId);
    return e?.player && !e.player.dead ? e : undefined;
  }

  private async hello(s: Session, name: string, token: string | undefined, version: number): Promise<void> {
    if (version !== PROTOCOL_VERSION) {
      s.send({ t: "toast", text: "Your client is out of date — reload the page.", kind: "error" });
    }
    let a = token ? await this.store.byToken(token) : null;
    if (!a) a = newAccount(name, this.token(), this.token().slice(0, 8));
    a = normalizeAccount(a);
    if (name && name.trim()) a.name = cleanName(name);
    s.account = a;
    if (a.run) this.forfeitStaleRun(s);
    this.store.save(a);
    s.send({ t: "welcome", token: a.token, account: accountView(a), serverTime: this.now(), online: this.opts.online });
    this.toVillage(s);
  }

  /** A run left open by a crash/disconnect is lost, as if the dream kept it. */
  private forfeitStaleRun(s: Session): void {
    const a = s.account!;
    const lost: ItemInstance[] = [];
    forEachCarried(a, (it, remove) => {
      if (it.run) {
        lost.push(it);
        remove();
      }
    });
    returnKit(a);
    a.run = null;
    a.stats.deaths++;
    if (lost.length) s.send({ t: "toast", text: `You woke in Kneel with empty pockets. The dream kept ${lost.length} thing(s).`, kind: "warn" });
  }

  // ── village ──────────────────────────────────────────────────────────────

  private toVillage(s: Session): void {
    s.scene = "village";
    s.dead = false;
    s.run = null;
    s.carryHp = undefined;
    s.carryMana = undefined;
    s.villagePose = { p: [0, 0, 0], y: 0 };
    s.send({
      t: "scene",
      info: { scene: "village", you: s.id, floor: 0, seed: 0, biome: "village", instance: "village", arrival: [0, 0, 0], yaw: 0, surfaces: [], serverTime: this.now() },
      run: s.runView(),
    });
    this.pushAccount(s);
  }

  private broadcastVillage(): void {
    const here = [...this.sessions.values()].filter((x) => x.scene === "village" && x.account);
    if (here.length < 2) return;
    for (const s of here) {
      s.send({
        t: "village",
        players: here.filter((o) => o !== s).map((o) => ({ id: o.id, name: o.account!.name, p: o.villagePose.p, y: o.villagePose.y, look: o.look() })),
      });
    }
  }

  private villageAction(s: Session, action: string, arg?: string): void {
    const a = s.account!;
    if (action === "secret" && arg && !a.secrets.includes(arg)) {
      // Secret triggers are validated client-side for now; the reward is
      // cosmetic/lore only, never power.
      a.secrets.push(arg);
      this.pushAccount(s);
      s.send({ t: "toast", text: "Something in Kneel remembers you now.", kind: "lore" });
    } else if (action === "memorial") {
      const wall = this.store.memorial?.() ?? [];
      s.send({ t: "dialog", npc: "memorial", line: wall.map((w) => `${w.name} — dreamt into the Well on floor ${w.floor} (${w.cause})`).join("\n") || "The wall is blank. For now." });
    } else if (action === "unkit") {
      if (a.heldGear && !s.run) {
        returnKit(a);
        s.invalidateStats();
        this.pushAccount(s);
      }
    }
  }

  // ── the Well ─────────────────────────────────────────────────────────────

  private enterWell(s: Session): void {
    const a = s.account!;
    if (s.scene !== "village") return;
    const gl = gearLevel(a.equipment);
    const floor = entryFloor(gl, this.rng);
    s.run = { startFloor: floor, floor, floorsCleared: 0, runGold: 0, kit: a.heldGear ? "kit" : null, startedAt: this.now() };
    a.run = s.run;
    a.stats.runs++;
    s.invalidateStats();
    this.store.save(a);
    this.placeOnFloor(s, floor);
  }

  private placeOnFloor(s: Session, floor: number): void {
    const a = s.account!;
    const party = s.partyTarget && s.partyTarget.until > this.now() ? s.partyTarget.instance : undefined;
    const candidates = [...this.instances.values()].map((i) => ({ id: i.id, floor: i.floor, members: i.memberCount, createdAt: i.createdAt, open: i.open }));
    const random = this.opts.forceEncounters ? () => 0 : () => this.rng.next();
    const pick = chooseInstance(candidates, { floor, now: this.now(), lonelyMinutes: (this.now() - a.lastEncounter) / 60000, partyInstance: party }, random);
    let inst = pick ? this.instances.get(pick) : undefined;
    if (!inst) {
      inst = new FloorInstance(this, `f${floor}-${this.nextInstance++}`, floor, randomSeed());
      this.instances.set(inst.id, inst);
      this.log(`instance ${inst.id} created`);
    }
    s.partyTarget = null;
    s.scene = "floor";
    s.dead = false;
    if (s.run) {
      s.run.floor = floor;
      a.stats.deepest = Math.max(a.stats.deepest, floor);
    }
    inst.admit(s);
  }

  private leaveFloor(s: Session): void {
    s.floorInstance?.release(s);
  }

  /** Descent used. Ascend banks the run; otherwise go one floor deeper. */
  descend(s: Session, from: FloorInstance, ascend: boolean): void {
    const a = s.account!;
    if (!s.run) return;
    // Pact allies who follow within a few seconds land with us.
    const me = from.sim.get(s.entityId);
    const allies = me?.player ? [...me.player.pactWith] : [];
    // The five-floor rule is enforced here too, not just by the sim.
    const mayAscend = ascend && canAscend(s.run.floorsCleared);
    from.release(s);
    s.run.floorsCleared++;
    if (mayAscend || s.run.floor >= RUN.maxFloor) {
      this.ascend(s);
      return;
    }
    this.placeOnFloor(s, s.run.floor + 1);
    for (const id of allies) {
      const ally = from.members.get(id);
      if (ally) ally.partyTarget = { instance: s.floorInstance!.id, until: this.now() + 12000 };
    }
    this.store.save(a);
  }

  private ascend(s: Session, bell = false): void {
    const a = s.account!;
    const banked: ItemInstance[] = [];
    forEachCarried(a, (it) => {
      if (it.run) {
        delete it.run;
        banked.push(it);
      }
    });
    const gold = s.run?.runGold ?? 0;
    a.gold += gold;
    if (!bell) a.stats.ascents++;
    returnKit(a);
    a.run = null;
    s.invalidateStats();
    this.store.save(a);
    s.send({ t: "ascended", floor: s.run?.floor ?? 0, banked, gold });
    this.toVillage(s);
  }

  /** Called by the instance when a delver dies. Returns Reliquary contents. */
  death(s: Session, killer: string, cause: string, floor: number): ItemInstance[] {
    const a = s.account!;
    const lost: ItemInstance[] = [];
    forEachCarried(a, (it, remove) => {
      if (it.run) {
        delete it.run;
        lost.push(it);
        remove();
      }
    });
    if (s.run && s.run.runGold > 0) lost.push(makeStack("gold_coin", s.run.runGold, floor));
    returnKit(a);
    a.run = null;
    a.stats.deaths++;
    this.store.addMemorial?.({ name: a.name, floor, cause: killer || cause, at: this.now() });
    s.run = null;
    s.dead = true;
    s.invalidateStats();
    this.store.save(a);
    s.send({ t: "died", cause, killer, lost, floor });
    this.pushAccount(s);
    return lost.map((it) => ({ ...it }));
  }

  pickup(s: Session | undefined, item: ItemInstance): boolean {
    if (!s?.account) return false;
    if (item.base === "gold_coin") {
      this.gold(s, item.qty);
      return true;
    }
    const copy: ItemInstance = { ...item, run: true };
    if (!addToBag(s.account, copy)) return false;
    s.invalidateStats();
    s.floorInstance?.refreshStats(s);
    this.pushAccount(s);
    return true;
  }

  gold(s: Session | undefined, amount: number): void {
    if (!s?.run) return;
    s.run.runGold += Math.max(0, Math.round(amount));
    s.send({ t: "run", run: s.runView() });
  }

  // ── inventory & belt ─────────────────────────────────────────────────────

  private inventory(s: Session, op: Extract<ClientMsg, { t: "inv" }>["op"]): void {
    const a = s.account!;
    const where = s.scene === "village" ? "village" : "dungeon";
    let err: string | null = null;
    if (op.op === "move") err = moveItem(a, op.from, op.to, where);
    else if (op.op === "drop") {
      const it = getAt(a, op.from);
      if (it?.kit) err = "That belongs to Old Hask.";
      else {
        const taken = takeItem(a, op.from);
        const me = this.me(s);
        if (taken && me && s.floorInstance) {
          // Dropped in the dungeon: it's on the floor for anyone to take.
          const pk = spawnPickup(s.floorInstance.sim, { x: me.pos.x, y: me.pos.y, z: me.pos.z }, { ...taken, run: undefined }, 0, 0);
          pk.pickup!.ownerOnlyUntil = 0;
        }
      }
    } else if (op.op === "split") {
      const it = getAt(a, op.from);
      if (it && op.qty > 0 && op.qty < it.qty) {
        const part = takeItem(a, op.from, op.qty);
        if (part && !addToBag(a, part)) {
          it.qty += part.qty;
          err = "No room to split.";
        }
      }
    }
    if (err) s.send({ t: "toast", text: err, kind: "error" });
    s.invalidateStats();
    s.floorInstance?.refreshStats(s);
    this.pushAccount(s);
  }

  private useBelt(s: Session, index: number, o?: [number, number, number], d?: [number, number, number]): void {
    const a = s.account!;
    const it = a.belt[index];
    if (!it) return;
    const base = ITEMS.get(it.base);
    const e = this.me(s);
    if (base.action === "ascend") {
      if (!e || !s.run) return s.send({ t: "toast", text: "The bell only works in the dream.", kind: "warn" });
      this.spend(a, index);
      s.floorInstance!.sim.emit({ t: "sound", id: "ascend", p: [e.pos.x, e.pos.y, e.pos.z] });
      s.floorInstance!.release(s);
      this.ascend(s, true);
      return;
    }
    if (!e) return;
    if (base.action === "throw" && base.throwSpell) {
      const origin = o ? v(o) : { x: e.pos.x, y: e.pos.y + 0.6, z: e.pos.z };
      const dir = d ? v(d) : dirFromAngles(e.player!.input.yaw, e.player!.input.pitch);
      playerThrow(s.floorInstance!.sim, e, base.throwSpell, origin, dir);
    } else if (base.use) {
      playerUseEffects(s.floorInstance!.sim, e, base.use);
    } else return;
    this.spend(a, index);
    this.pushAccount(s);
  }

  private spend(a: Account, beltIndex: number): void {
    const it = a.belt[beltIndex];
    if (!it) return;
    it.qty--;
    if (it.qty <= 0) a.belt[beltIndex] = null;
  }

  // ── movement ─────────────────────────────────────────────────────────────

  private input(s: Session, msg: Extract<ClientMsg, { t: "in" }>): void {
    if (s.scene === "village") {
      s.villagePose = { p: msg.p, y: msg.y };
      return;
    }
    const e = this.me(s);
    if (!e) return;
    const sim = s.floorInstance!.sim;
    const wasGrounded = e.player!.input.grounded;
    const fallSpeed = Math.max(s.fallSpeed, -e.player!.input.vel.y);
    const corr = playerInput(sim, e, { seq: msg.s, pos: v(msg.p), vel: v(msg.v), yaw: msg.y, pitch: msg.pi, grounded: !!msg.g });
    if (corr) s.send({ t: "self", s: { hp: e.hp, maxHp: e.maxHp, mana: e.player!.mana, maxMana: e.player!.maxMana, cd: {}, st: {}, corr: [corr.x, corr.y, corr.z] } });
    // Falls are judged here, from the reported motion: a hard landing hurts,
    // and the abyss under a pit keeps what falls into it.
    s.fallSpeed = msg.g ? 0 : fallSpeed;
    if (!wasGrounded && msg.g && fallSpeed > FALL_SAFE) {
      damage(sim, e, (fallSpeed - FALL_SAFE) * 7, { source: 0, element: "physical", cause: "fall" });
      sim.emit({ t: "sound", id: "land_heavy", p: [e.pos.x, e.pos.y, e.pos.z] });
    }
    if (e.pos.y < KILL_Y && e.hp > 0) damage(sim, e, e.hp + 999, { source: e.player!.lastDamagedBy, element: "physical", cause: "the abyss" });
  }

  private chat(s: Session, text: string): void {
    if (!text.trim()) return;
    const line = `${s.account!.name}: ${text}`;
    const targets = s.scene === "floor" && s.floorInstance ? [...s.floorInstance.members.values()] : [...this.sessions.values()].filter((o) => o.scene === "village");
    for (const o of targets) o.send({ t: "toast", text: line, kind: "info" });
  }

  // ── persistence ──────────────────────────────────────────────────────────

  pushAccount(s: Session): void {
    if (s.account) s.send({ t: "account", account: accountView(s.account) });
  }

  saveSoon(s: Session): void {
    if (this.saveTimers.has(s)) return;
    this.saveTimers.set(
      s,
      setTimeout(() => {
        this.saveTimers.delete(s);
        if (s.account) this.store.save(s.account);
      }, 2000),
    );
  }

  /** For tests/debug: the entity of a session. */
  entityOf(s: Session) {
    return s.floorInstance?.sim.get(s.entityId);
  }

  describe(item: ItemInstance): string {
    return itemName(item);
  }

  get playerCount(): number {
    let n = 0;
    for (const i of this.instances.values()) n += i.sim.list(EntityType.Player).length;
    return n;
  }
}

function v(t: readonly number[]) {
  const x = Number(t?.[0]);
  const y = Number(t?.[1]);
  const z = Number(t?.[2]);
  return { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0, z: Number.isFinite(z) ? z : 0 };
}

