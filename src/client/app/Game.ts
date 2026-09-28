import { Vector3 } from "three";
import { INTERP_DELAY_MS, PLAYER } from "../../shared/config";
import { ITEMS } from "../../shared/content";
import { COSMETICS } from "../../shared/content/shops";
import type { Element } from "../../shared/content/types";
import { computeStats } from "../../shared/game/stats";
import { NetClock } from "../../shared/net/clock";
import { decodeSnapshot } from "../../shared/net/codec";
import type { ClientMsg, SceneInfo, ServerMsg } from "../../shared/net/protocol";
import { PROTOCOL_VERSION } from "../../shared/net/protocol";
import { EntityType, Flag } from "../../shared/sim/entity";
import { audio } from "../audio";
import { Bolts } from "../fx/bolts";
import { Decals } from "../fx/decals";
import { Effects } from "../fx/Effects";
import { ELEMENT_HEX } from "../fx/palette";
import type { Particles } from "../fx/particles";
import { createModel, type ModelInstance } from "../gfx/models/registry";
import type { Input } from "../input/Input";
import { connect, type Connection } from "../net/connection";
import { LocalPlayer } from "../player/LocalPlayer";
import { LAYER, type Renderer } from "../render/Renderer";
import { viewmodelMaterial } from "../render/materials";
import { DungeonScene } from "../scenes/DungeonScene";
import { VillageScene } from "../scenes/VillageScene";
import { installActions } from "../ui/actions";
import { Floaters } from "../ui/floaters";
import { setMapProvider, type MapData } from "../ui/mapBridge";
import { Exploration } from "../world/Exploration";
import { ui } from "../ui/store";
import { ClientWorld } from "../world/ClientWorld";

interface PromptTarget {
  id?: number;
  action?: string;
  ascend?: boolean;
}

const TOKEN_KEY = "godwell.token";
const NAME_KEY = "godwell.name";

/** The client game: connection, scene lifecycle, the frame loop, and the
 * glue between input, the local delver, the replicated world, effects,
 * audio and UI. */
export class Game {
  private net: Connection | null = null;
  private clock = new NetClock();
  private player: LocalPlayer;
  private world: ClientWorld | null = null;
  private dungeon: DungeonScene | null = null;
  private village: VillageScene | null = null;
  private effects: Effects;
  private bolts = new Bolts();
  private decals = new Decals();
  private exploration: Exploration | null = null;
  private floaters: Floaters;
  private pingTimer = 0;
  private heartbeat = 0;
  private presenceUntil = 0;
  private villagers = new Map<number, { model: ModelInstance; pos: Vector3; yaw: number }>();
  private promptTarget: PromptTarget | null = null;
  private frameTimes: number[] = [];
  private shakeScale = 1;
  private lowHpAcc = 0;

  constructor(
    private renderer: Renderer,
    private particles: Particles,
    private input: Input,
  ) {
    this.player = new LocalPlayer(renderer.camera, renderer.lights, particles, {
      send: (m) => this.send(m),
      surfaceAt: (x, z) => this.dungeon?.surfaces.at(x, z) ?? 0,
      shakeScale: () => this.shakeScale,
    });
    renderer.scene.add(renderer.camera);
    renderer.scene.add(this.bolts.mesh);
    renderer.scene.add(this.decals.mesh);
    for (const o of particles.objects) renderer.scene.add(o);
    this.floaters = new Floaters(document.getElementById("ui")!, renderer.camera);
    this.effects = new Effects(particles, renderer.lights, this.bolts, () => this.world, () => this.dungeon?.surfaces ?? null, {
      shake: (a) => this.player.addTrauma(a),
      damageNumber: (p, amt, el, crit, onSelf) => this.floaters.damage(new Vector3(...p), amt, ELEMENT_HEX[el as Element], crit, onSelf),
      toast: (text, kind) => ui.toast(text, kind),
      banner: (title, sub) => ui.set({ banner: { title, sub, at: performance.now() } }),
      selfId: () => this.world?.selfId ?? -1,
      cameraPos: () => renderer.camera.position,
      groundAt: (x, z) => (this.dungeon ? this.dungeon.groundAt(x, z) : this.village ? 0 : NaN),
      decal: (kind, x, y, z, size) => this.decals.add(kind, x, y, z, size),
    });
    installActions({
      play: (name) => void this.start(name),
      resume: () => {
        input.lock();
        ui.set({ paused: false });
      },
      send: (m) => this.send(m),
      move: (from, to) => this.send({ t: "inv", op: { op: "move", from, to } }),
      drop: (from) => this.send({ t: "inv", op: { op: "drop", from } }),
      shop: (op) => this.send({ t: "shop", op }),
      openPanel: (panel) => this.openPanel(panel),
      respawn: () => {
        ui.set({ died: null, ascended: null });
        this.send({ t: "respawn" });
      },
      setSetting: (key, value) => this.setting(key, value),
    });
    setMapProvider(() => {
      if (!this.dungeon || !this.exploration) return null;
      const markers: MapData["markers"] = [];
      for (const e of this.world?.entities.values() ?? []) {
        if (e.type === EntityType.Interactable && (e.def === "descent" || e.def === "arrival" || e.def === "reliquary" || e.def === "chest")) markers.push({ x: e.x, z: e.z, kind: e.def });
        else if (e.type === EntityType.Player && e.id !== this.world?.selfId && e.flags & Flag.Ally) markers.push({ x: e.x, z: e.z, kind: "ally" });
      }
      return { layout: this.dungeon.layout, seen: this.exploration.seen, player: { x: this.player.pos.x, z: this.player.pos.z, yaw: this.player.yaw }, markers };
    });
    document.addEventListener("pointerlockchange", () => {
      if (!input.locked && ui.get().screen === "play" && !ui.get().panel && !ui.get().died && !ui.get().ascended && !ui.get().note) ui.set({ paused: true });
      if (input.locked) ui.set({ paused: false });
    });
    renderer.canvas.addEventListener("click", () => {
      if (ui.get().screen === "play" && !ui.get().panel) input.lock();
    });
  }

  // ── connection ───────────────────────────────────────────────────────────

  async start(name: string): Promise<void> {
    localStorage.setItem(NAME_KEY, name);
    ui.set({ screen: "loading", connecting: true });
    void audio.unlock();
    this.net = await connect();
    this.net.onMessage((m) => this.onMessage(m));
    this.net.onClose(() => {
      ui.toast("Lost the connection to Kneel. Reload to reconnect.", "error");
    });
    ui.set({ online: this.net.online, connecting: false });
    this.send({ t: "hello", name, token: localStorage.getItem(TOKEN_KEY) ?? undefined, v: PROTOCOL_VERSION });
    this.input.lock();
  }

  send(m: ClientMsg): void {
    this.net?.send(m);
  }

  private onMessage(m: ServerMsg | ArrayBuffer): void {
    if (m instanceof ArrayBuffer) {
      if (!this.world) return;
      const snap = decodeSnapshot(m);
      this.world.applySnapshot(snap.entities, snap.removed, snap.serverTime);
      return;
    }
    switch (m.t) {
      case "welcome":
        localStorage.setItem(TOKEN_KEY, m.token);
        this.clock.reset();
        ui.set({ account: m.account, online: m.online });
        this.applyStats();
        return;
      case "pong":
        this.clock.onPong(m.c, m.s);
        return;
      case "account":
        ui.set({ account: m.account });
        this.applyStats();
        return;
      case "scene":
        this.enterScene(m.info);
        ui.set({ run: m.run });
        return;
      case "run":
        ui.set({ run: m.run });
        return;
      case "self":
        this.player.applySelf(m.s);
        ui.set({ self: { ...this.player.self } });
        return;
      case "ev":
        for (const ev of m.ev) if (ev.t === "impact" && ev.by === this.world?.selfId && ev.castId) this.player.onImpact(ev.castId, ev.p);
        this.effects.handle(m.ev);
        return;
      case "info":
        this.world?.setInfo(m.list);
        return;
      case "died":
        this.player.dead = true;
        this.input.unlock();
        audio.stinger("death");
        ui.set({ died: { cause: m.cause, killer: m.killer, lost: m.lost, floor: m.floor } });
        return;
      case "ascended":
        audio.stinger("ascend");
        ui.set({ ascended: { floor: m.floor, banked: m.banked, gold: m.gold } });
        this.input.unlock();
        return;
      case "note":
        this.input.unlock();
        ui.set({ note: m.note });
        return;
      case "toast":
        ui.toast(m.text, m.kind);
        if (m.kind === "presence") this.presenceUntil = performance.now() + 25000;
        return;
      case "gamble":
        ui.set({ gambleOffers: m.offers });
        return;
      case "village":
        this.syncVillagers(m.players);
        return;
      case "dialog":
        ui.set({ dialog: { npc: m.npc, line: m.line } });
        return;
    }
  }

  private applyStats(): void {
    const acc = ui.get().account;
    if (!acc) return;
    const stats = computeStats(acc.equipment);
    const lantern = acc.cosmetics.equipped.lantern ? COSMETICS.find((c) => c.id === acc.cosmetics.equipped.lantern)?.value : undefined;
    this.player.setStats(stats, lantern);
    const focus = acc.equipment.focus?.base ?? "apprentice_staff";
    if (focus !== this.player.focusBase || !this.player.viewmodel) {
      this.player.focusBase = focus;
      this.buildViewmodel(ITEMS.find(focus)?.model ?? "staff_apprentice");
    }
  }

  private buildViewmodel(modelId: string): void {
    const cam = this.renderer.camera;
    if (this.player.viewmodel) {
      cam.remove(this.player.viewmodel.root);
      this.player.viewmodel.dispose();
    }
    const vm = createModel(`viewmodel:${modelId}`, {});
    const mat = viewmodelMaterial();
    vm.root.traverse((o) => {
      o.layers.set(LAYER.VIEWMODEL);
      const mesh = o as unknown as { isMesh?: boolean; material: unknown };
      if (mesh.isMesh) mesh.material = mat;
    });
    cam.add(vm.root);
    this.player.viewmodel = vm;
  }

  // ── scenes ───────────────────────────────────────────────────────────────

  private enterScene(info: SceneInfo): void {
    this.leaveScene();
    ui.set({ screen: "play", scene: info.scene, floor: info.floor, biome: info.biome, died: null, prompt: null, presence: 0 });
    this.presenceUntil = 0;
    const ctx = {
      scene: this.renderer.scene,
      lights: this.renderer.lights,
      particles: this.particles,
      layout: null as import("../../shared/world/layout").FloorLayout | null,
      now: () => performance.now() / 1000,
      groundAt: (x: number, z: number) => this.dungeon?.groundAt(x, z) ?? 0,
    };
    if (info.scene === "floor") {
      this.dungeon = new DungeonScene(this.renderer, this.particles, info.seed, info.floor, info.surfaces);
      ctx.layout = this.dungeon.layout;
      this.world = new ClientWorld(ctx, info.you);
      this.exploration = new Exploration(this.dungeon.layout);
      this.player.enter(this.dungeon.staticBoxes, new Vector3(...info.arrival), info.yaw);
      audio.play("arrival");
      const biome = this.dungeon.layout.biome;
      ui.set({ banner: { title: `Floor ${info.floor}`, sub: bannerSub(biome, info.floor), at: performance.now() } });
    } else {
      this.village = new VillageScene(this.renderer, this.particles);
      this.world = null;
      this.player.enter(this.village.staticBoxes, this.village.spawn.clone(), this.village.spawnYaw);
    }
    this.player.dead = false;
    this.applyStats();
  }

  private leaveScene(): void {
    this.decals.clear();
    this.exploration = null;
    this.world?.clear();
    this.world = null;
    this.dungeon?.dispose();
    this.dungeon = null;
    this.village?.dispose();
    this.village = null;
    for (const v of this.villagers.values()) {
      this.renderer.scene.remove(v.model.root);
      v.model.dispose();
    }
    this.villagers.clear();
    this.player.leave();
    audio.stopAll(0.3);
  }

  private syncVillagers(list: { id: number; name: string; p: [number, number, number]; y: number; look?: Record<string, string> }[]): void {
    if (!this.village) return;
    const seen = new Set<number>();
    for (const p of list) {
      seen.add(p.id);
      let v = this.villagers.get(p.id);
      if (!v) {
        const model = createModel("delver", { look: p.look });
        this.renderer.scene.add(model.root);
        v = { model, pos: new Vector3(...p.p), yaw: p.y };
        this.villagers.set(p.id, v);
      }
      v.pos.set(p.p[0], p.p[1] - (PLAYER.halfHeight + PLAYER.radius), p.p[2]);
      v.yaw = p.y;
    }
    for (const [id, v] of this.villagers) {
      if (seen.has(id)) continue;
      this.renderer.scene.remove(v.model.root);
      v.model.dispose();
      this.villagers.delete(id);
    }
  }

  // ── frame ────────────────────────────────────────────────────────────────

  frame(dt: number): void {
    const t0 = performance.now();
    this.pingTimer -= dt;
    if (this.pingTimer <= 0 && this.net) {
      this.pingTimer = 1;
      this.send({ t: "ping", c: performance.now() });
    }
    const st = ui.get();
    this.player.active = !st.panel && !st.note && !st.died && !st.ascended && st.screen === "play";
    this.input.suspended = !this.player.active;
    this.handleKeys();
    this.player.update(dt, this.input, this.world);
    if (this.world) this.world.update(this.clock.serverNow() - INTERP_DELAY_MS, dt);
    this.dungeon?.update(dt);
    this.exploration?.update(dt, this.player.pos.x, this.player.pos.y + 0.6, this.player.pos.z, (this.player.stats?.lightRadius ?? 7) + 3);
    this.village?.update(dt);
    for (const v of this.villagers.values()) {
      const r = v.model.root;
      const moved = r.position.distanceTo(v.pos);
      r.position.lerp(v.pos, Math.min(1, dt * 10));
      r.rotation.y = v.yaw;
      v.model.animate({ anim: 0, variant: 0, animTime: 0, time: performance.now() / 1000, dt, speed: moved / Math.max(dt, 1e-3), hp: 1, flags: 0, statuses: [] });
    }
    this.updatePrompt();
    this.particles.update(dt, performance.now() / 1000);
    this.bolts.update(dt, this.renderer.camera);
    this.floaters.update(dt);
    this.presenceAudio(dt);
    this.lowHealth(dt);
    this.renderer.render(dt);
    this.input.endFrame();
    this.perf(performance.now() - t0, dt);
  }

  private handleKeys(): void {
    const i = this.input;
    if (i.wasPressed("perf")) ui.set({ perf: ui.get().perf ? null : { fps: 0, frame: 0, p95: 0, lights: 0, particles: 0, entities: 0, drawCalls: 0 } });
    if (i.wasPressed("inventory")) this.openPanel(ui.get().panel === "inventory" ? null : "inventory");
    if (i.wasPressed("map") && this.dungeon) this.openPanel(ui.get().panel === "map" ? null : "map");
    if (i.wasPressed("escape") && ui.get().panel) this.openPanel(null);
    if (!this.player.active) return;
    const beltKeys = ["belt1", "belt2", "belt3", "belt4"] as const;
    beltKeys.forEach((k, idx) => {
      if (!i.wasPressed(k)) return;
      const eye = this.player.eye();
      const dir = this.player.aim();
      this.send({ t: "use", belt: idx, o: [eye.x, eye.y, eye.z], d: [dir.x, dir.y, dir.z] });
    });
    if (i.wasPressed("sign") && this.dungeon) this.send({ t: "sign" });
    if (i.wasPressed("interact") || i.wasPressed("alt")) {
      const t = this.promptTarget;
      if (!t) return;
      if (t.action) this.villageAction(t.action);
      else if (t.id !== undefined) this.send({ t: "interact", id: t.id, choice: i.wasPressed("alt") && t.ascend ? "ascend" : "descend" });
    }
  }

  private villageAction(action: string): void {
    if (action === "enter") {
      audio.play("descend");
      this.send({ t: "enter" });
    } else if (action.startsWith("shop:") || action.startsWith("panel:")) {
      this.openPanel(action.startsWith("panel:") ? action.slice(6) : action);
    } else if (action.startsWith("secret:")) {
      this.send({ t: "village", action: "secret", arg: action.slice(7) });
    } else if (action.startsWith("npc:")) {
      this.send({ t: "village", action: "talk", arg: action.slice(4) });
    }
  }

  /** What would E do right now? */
  private updatePrompt(): void {
    let best: { text: string; alt?: string; target: PromptTarget | null } | null = null;
    const eye = this.player.eye();
    const aim = this.player.aim();
    if (this.village) {
      for (const s of this.village.spots) {
        const d = Math.hypot(s.pos.x - this.player.pos.x, s.pos.z - this.player.pos.z);
        if (d < s.radius) best = { text: s.prompt, target: { action: s.action } };
      }
    } else if (this.world) {
      let bestScore = -Infinity;
      for (const e of this.world.entities.values()) {
        if (e.type !== EntityType.Interactable && e.type !== EntityType.Pickup) continue;
        const dx = e.x - eye.x;
        const dy = e.y + 0.3 - eye.y;
        const dz = e.z - eye.z;
        const flat = Math.hypot(e.x - this.player.pos.x, e.z - this.player.pos.z);
        const reach = PLAYER.interactRange + (e.def === "descent" ? 1.2 : 0.4);
        if (flat > reach) continue;
        const len = Math.hypot(dx, dy, dz) || 1;
        const facing = (dx * aim.x + dy * aim.y + dz * aim.z) / len;
        if (facing < 0.55 && e.def !== "descent") continue;
        const score = facing * 2 - flat;
        if (score <= bestScore) continue;
        bestScore = score;
        best = this.promptFor(e.id, e.type, e.def, e.flags, e.info?.name);
      }
    }
    this.promptTarget = best?.target ?? null;
    const cur = ui.get().prompt;
    const next = best ? { text: best.text, alt: best.alt } : null;
    if (cur?.text !== next?.text || cur?.alt !== next?.alt) ui.set({ prompt: next });
  }

  private promptFor(id: number, type: EntityType, def: string, flags: number, name?: string) {
    if (type === EntityType.Pickup) {
      const base = ITEMS.find(def);
      if (base?.category === "material" || def === "gold_coin") return null;
      return { text: `Take ${name ?? base?.name ?? "item"}`, target: { id } };
    }
    switch (def) {
      case "descent":
        if (flags & Flag.Sealed) return { text: "The Descent is sealed", target: null };
        return flags & Flag.CanAscend ? { text: "Descend deeper", alt: "Ascend to Kneel (bank your loot)", target: { id, ascend: true } } : { text: "Descend", target: { id } };
      case "chest":
        return flags & Flag.Opened ? null : { text: "Open the chest", target: { id } };
      case "reliquary":
        return flags & Flag.Opened ? null : { text: `Open ${name ?? "the Reliquary"}`, target: { id } };
      case "note":
        return { text: "Read", target: { id } };
      case "mercy_candle":
        return { text: "Warm your hands at the mercy candle", target: { id } };
      default:
        return null;
    }
  }

  openPanel(panel: string | null): void {
    ui.set({ panel });
    if (panel) {
      this.input.unlock();
      audio.play("ui_open");
    } else {
      audio.play("ui_close");
      if (ui.get().screen === "play" && !ui.get().died && !ui.get().ascended) this.input.lock();
    }
  }

  private presenceAudio(dt: number): void {
    if (performance.now() > this.presenceUntil) {
      if (ui.get().presence) ui.set({ presence: 0 });
      return;
    }
    this.heartbeat -= dt;
    if (this.heartbeat <= 0) {
      this.heartbeat = 1.15;
      audio.play("presence_heartbeat", { volume: 0.7 });
      ui.set({ presence: performance.now() });
    }
  }

  private lowHealth(dt: number): void {
    const s = this.player.self;
    const frac = s.hp / Math.max(1, s.maxHp);
    const low = frac < 0.3 && !this.player.dead && !!this.dungeon;
    if (low !== ui.get().lowHealth) ui.set({ lowHealth: low });
    if (!low) return;
    this.lowHpAcc -= dt;
    if (this.lowHpAcc <= 0) {
      this.lowHpAcc = 0.5 + frac * 1.4;
      audio.play("low_health_heartbeat");
      this.renderer.damage = Math.max(this.renderer.damage, 0.25);
    }
  }

  private perf(ms: number, dt: number): void {
    const p = ui.get().perf;
    this.frameTimes.push(dt * 1000);
    if (this.frameTimes.length > 120) this.frameTimes.shift();
    if (!p || this.frameTimes.length % 15 !== 0) return;
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    ui.set({
      perf: {
        fps: Math.round(1000 / avg),
        frame: Math.round(ms * 10) / 10,
        p95: Math.round(sorted[Math.floor(sorted.length * 0.95)] * 10) / 10,
        lights: this.renderer.lights.count,
        particles: this.particles.count,
        entities: this.world?.entities.size ?? 0,
        drawCalls: this.renderer.gl.info.render.calls,
      },
    });
  }

  private setting(key: string, value: number | boolean): void {
    if (key === "pixelScale" && typeof value === "number") {
      this.renderer.settings.pixelScale = value;
      this.renderer.resize();
    } else if (key === "dither" && typeof value === "number") this.renderer.settings.dither = value;
    else if (key === "bloom") this.renderer.settings.bloom = !!value;
    else if (key === "shake" && typeof value === "number") this.shakeScale = value;
    else if (key === "sensitivity" && typeof value === "number") this.input.sensitivity = value;
    else if (key === "volume" && typeof value === "number") audio.setVolume("master", value);
  }

  get savedName(): string {
    return localStorage.getItem(NAME_KEY) ?? "";
  }
}

function bannerSub(biome: string, floor: number): string {
  const names: Record<string, string> = { undercroft: "The Undercroft", archive: "The Drowned Archive", choir: "The Mycelial Choir", foundry: "The Cinder Foundry", hive: "The Gilded Hive", liturgy: "The Frozen Liturgy", garden: "The Red Garden", orrery: "The Orrery", unlit: "The Unlit", threshold: "The Threshold" };
  return `${names[biome] ?? biome}${floor % 10 === 0 ? " — a warden waits" : ""}`;
}
