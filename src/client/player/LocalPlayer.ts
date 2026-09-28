import type { Collider, KinematicCharacterController, RigidBody, World } from "@dimforge/rapier3d-compat";
import { PerspectiveCamera, Vector3, type Object3D } from "three";
import { GRAVITY, INPUT_RATE, KILL_Y, PLAYER } from "../../shared/config";
import { CREATURES, ITEMS, SPELLS, surfaceDef } from "../../shared/content";
import type { SpellDef } from "../../shared/content/types";
import type { ClientMsg, SelfState } from "../../shared/net/protocol";
import { EntityType, type PlayerStats } from "../../shared/sim/entity";
import { GROUPS, RAPIER, createWorld } from "../../shared/sim/physics";
import type { StaticBox } from "../../shared/world/colliders";
import { damp, dirFromAngles } from "../../shared/util/math";
import { audio } from "../audio";
import type { Input } from "../input/Input";
import type { Particles } from "../fx/particles";
import type { LightManager, PointLight } from "../render/lights";
import type { ClientWorld } from "../world/ClientWorld";
import { hexLinear } from "../fx/palette";
import { Predicted } from "./Predicted";

/** The delver you control. Movement runs locally for zero-latency feel
 * (Rapier kinematic character controller against the same static world the
 * server builds, plus proxies of nearby bodies) and is reported to the
 * server, which validates it. Casting is sent to the server and predicted
 * visually here. */

export interface PlayerHooks {
  send(msg: ClientMsg): void;
  /** Surface kind under a point (ice slides, water slows). */
  surfaceAt(x: number, z: number): number;
  shakeScale(): number;
}

const HALF = PLAYER.halfHeight;
const RADIUS = PLAYER.radius;

export class LocalPlayer {
  readonly camera: PerspectiveCamera;
  readonly pos = new Vector3();
  readonly vel = new Vector3();
  yaw = 0;
  pitch = 0;
  stats: PlayerStats | null = null;
  self: SelfState = { hp: 100, maxHp: 100, mana: 100, maxMana: 100, cd: {}, st: {} };
  dead = false;
  /** False while menus are open. */
  active = true;

  private world: World | null = null;
  private kcc: KinematicCharacterController | null = null;
  private collider: Collider | null = null;
  private body: RigidBody | null = null;
  private proxies = new Map<number, { body: RigidBody; collider: Collider }>();
  private grounded = false;
  private coyote = 0;
  private jumpBuffer = 0;
  private jumpsUsed = 0;
  private dashTime = 0;
  private dashVel = new Vector3();
  private seq = 0;
  private inputAcc = 0;
  private castId = 1;
  private localCd: Record<string, number> = {};
  private bobPhase = 0;
  private bobAmp = 0;
  private landDip = 0;
  private trauma = 0;
  private fovKick = 0;
  private lastFallSpeed = 0;
  private stepAcc = 0;
  private lantern: PointLight | null = null;
  private predicted: Predicted[] = [];
  private channeling: "primary" | "secondary" | null = null;
  private graspHeld = false;
  viewmodel: { root: Object3D; animate(s: import("../gfx/models/registry").AnimInput): void; sockets?: Record<string, Object3D>; dispose(): void } | null = null;
  private castAnim = -10;
  private time = 0;

  constructor(
    camera: PerspectiveCamera,
    private lights: LightManager,
    private particles: Particles,
    private hooks: PlayerHooks,
  ) {
    this.camera = camera;
  }

  // ── scene lifecycle ──────────────────────────────────────────────────────

  /** Build the local collision world for a new place and spawn there. */
  enter(boxes: StaticBox[], spawn: Vector3, yaw: number): void {
    this.leave();
    const w = createWorld();
    const fixed = w.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    for (const b of boxes) {
      w.createCollider(RAPIER.ColliderDesc.cuboid(b.half[0], b.half[1], b.half[2]).setTranslation(b.center[0], b.center[1], b.center[2]).setCollisionGroups(GROUPS.world), fixed);
    }
    this.body = w.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y, spawn.z));
    this.collider = w.createCollider(RAPIER.ColliderDesc.capsule(HALF, RADIUS).setCollisionGroups(GROUPS.player), this.body);
    const kcc = w.createCharacterController(0.02);
    kcc.enableAutostep(PLAYER.stepHeight, 0.15, false);
    kcc.enableSnapToGround(0.3);
    kcc.setMaxSlopeClimbAngle((PLAYER.maxSlopeDeg * Math.PI) / 180);
    kcc.setApplyImpulsesToDynamicBodies(false);
    this.kcc = kcc;
    this.world = w;
    this.pos.copy(spawn);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
    this.dead = false;
    this.lastFallSpeed = 0;
    if (!this.lantern) this.lantern = this.lights.add({ position: this.pos, color: "#ffd9b0", intensity: 1.6, radius: 7, flicker: 0.15, priority: 5, haze: 0.35 });
  }

  leave(): void {
    for (const p of this.predicted) p.dispose(this.lights);
    this.predicted = [];
    this.proxies.clear();
    this.world?.free();
    this.world = null;
    this.kcc = null;
    this.collider = null;
    this.body = null;
  }

  setStats(stats: PlayerStats, lanternColor?: string): void {
    this.stats = stats;
    if (this.lantern) {
      this.lantern.radius = Math.max(4, stats.lightRadius);
      if (lanternColor) this.lights.setColor(this.lantern, lanternColor);
    }
  }

  applySelf(s: SelfState): void {
    this.self = { ...this.self, ...s };
    if (s.imp) {
      this.vel.x += s.imp[0];
      this.vel.y += s.imp[1];
      this.vel.z += s.imp[2];
      if (s.imp[1] > 1) this.grounded = false;
      this.trauma = Math.min(1, this.trauma + Math.hypot(...s.imp) * 0.04);
    }
    if (s.corr) this.teleport(new Vector3(...s.corr));
    // Server cooldowns are the truth; keep the larger of predicted/server.
    for (const [k, v] of Object.entries(s.cd)) this.localCd[k] = Math.max(this.localCd[k] ?? 0, v);
  }

  teleport(p: Vector3): void {
    this.pos.copy(p);
    this.vel.set(0, 0, 0);
    this.body?.setTranslation(p, true);
  }

  addTrauma(v: number): void {
    this.trauma = Math.min(1, this.trauma + v);
  }

  // ── per frame ────────────────────────────────────────────────────────────

  update(dt: number, input: Input, world: ClientWorld | null): void {
    this.time += dt;
    if (!this.world || !this.kcc || !this.collider) return;
    dt = Math.min(dt, 1 / 20);
    if (world) this.syncProxies(world);

    if (this.active && input.locked) {
      this.yaw -= input.mouseDX * input.sensitivity;
      this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch - input.mouseDY * input.sensitivity));
    }

    if (!this.dead) this.move(dt, input);
    this.updateCamera(dt);
    if (!this.dead && this.active) this.casting(dt, input);
    for (const k in this.localCd) this.localCd[k] = Math.max(0, this.localCd[k] - dt * (this.stats?.castSpeed ?? 1));

    for (const p of this.predicted) p.update(dt, this.world, this.particles, this.lights);
    this.predicted = this.predicted.filter((p) => {
      if (p.done) p.dispose(this.lights);
      return !p.done;
    });

    // Report movement.
    this.inputAcc += dt;
    if (this.inputAcc >= 1 / INPUT_RATE && !this.dead) {
      this.inputAcc = 0;
      this.hooks.send({ t: "in", s: ++this.seq, p: [this.pos.x, this.pos.y, this.pos.z], v: [this.vel.x, this.vel.y, this.vel.z], y: this.yaw, pi: this.pitch, g: this.grounded ? 1 : 0 });
    }

    if (this.lantern) {
      // The lantern hangs at the hip, slightly ahead: it lights what you face.
      const f = dirFromAngles(this.yaw, 0);
      this.lantern.x = this.pos.x + f.x * 0.35 - Math.cos(this.yaw) * 0.25;
      this.lantern.y = this.pos.y + 0.15;
      this.lantern.z = this.pos.z + f.z * 0.35 + Math.sin(this.yaw) * 0.25;
      this.lantern.enabled = !this.dead;
    }
  }

  private statusMult(): number {
    let m = 1;
    const st = this.self.st;
    if (st.chilled) m *= 0.6;
    if (st.slowed) m *= 0.5;
    if (st.webbed) m *= 0.15;
    if (st.shocked) m *= 0.7;
    if (st.frozen || st.stunned) m = 0;
    return m;
  }

  private move(dt: number, input: Input): void {
    const st = this.stats;
    const controls = this.active && input.locked;
    const f = (controls && input.isDown("forward") ? 1 : 0) - (controls && input.isDown("back") ? 1 : 0);
    const s = (controls && input.isDown("right") ? 1 : 0) - (controls && input.isDown("left") ? 1 : 0);
    const fwd = dirFromAngles(this.yaw, 0);
    const rightX = -fwd.z;
    const rightZ = fwd.x;
    let wx = fwd.x * f + rightX * s;
    let wz = fwd.z * f + rightZ * s;
    const wl = Math.hypot(wx, wz);
    if (wl > 0) {
      wx /= wl;
      wz /= wl;
    }
    const surf = surfaceDef(this.hooks.surfaceAt(this.pos.x, this.pos.z));
    const speed = PLAYER.speed * (st?.moveSpeed ?? 1) * this.statusMult() * (this.grounded ? surf.moveMult : 1);

    if (this.dashTime > 0) {
      this.dashTime -= dt;
      this.vel.x = this.dashVel.x;
      this.vel.z = this.dashVel.z;
      this.vel.y = Math.max(this.vel.y, 0);
    } else if (this.grounded) {
      const k = 1 - Math.exp(-PLAYER.groundAccel * Math.min(1, surf.friction * 1.1) * dt);
      this.vel.x += (wx * speed - this.vel.x) * k;
      this.vel.z += (wz * speed - this.vel.z) * k;
    } else {
      this.vel.x += wx * PLAYER.airAccel * dt;
      this.vel.z += wz * PLAYER.airAccel * dt;
      const hs = Math.hypot(this.vel.x, this.vel.z);
      const cap = Math.max(PLAYER.airSpeedCap * (st?.moveSpeed ?? 1), this.prevHoriz);
      if (hs > cap) {
        this.vel.x *= cap / hs;
        this.vel.z *= cap / hs;
      }
    }
    this.prevHoriz = Math.hypot(this.vel.x, this.vel.z);

    // Jumping: buffered presses, coyote time, extra jumps from boots.
    if (controls && input.wasPressed("jump")) this.jumpBuffer = PLAYER.jumpBuffer;
    else this.jumpBuffer -= dt;
    if (this.grounded) {
      this.coyote = PLAYER.coyoteTime;
      this.jumpsUsed = 0;
    } else this.coyote -= dt;
    if (this.jumpBuffer > 0 && this.statusMult() > 0) {
      const jv = PLAYER.jumpVelocity * (st?.jumpPower ?? 1);
      if (this.grounded || this.coyote > 0) {
        this.vel.y = jv;
        this.jumpBuffer = 0;
        this.coyote = 0;
        this.grounded = false;
        audio.play("jump");
        this.dust(6);
      } else if (this.jumpsUsed < (st?.extraJumps ?? 0)) {
        this.vel.y = jv * 0.92;
        this.jumpsUsed++;
        this.jumpBuffer = 0;
        audio.play("jump", { pitch: 1.2 });
        this.particlesAtFeet([0.6, 1.4, 0.8], 10);
      }
    }

    this.vel.y += GRAVITY * dt;
    // Glide (moth boots): hold jump while falling.
    if (st?.glide && controls && input.isDown("jump") && this.vel.y < PLAYER.glideFallSpeed && !this.grounded) {
      this.vel.y = PLAYER.glideFallSpeed;
      if (Math.random() < dt * 20) this.particlesAtFeet([0.9, 0.9, 1.4], 1);
    }

    // Resolve against the world.
    const desired = { x: this.vel.x * dt, y: this.vel.y * dt, z: this.vel.z * dt };
    this.kcc!.computeColliderMovement(this.collider!, desired, undefined, GROUPS.player);
    const m = this.kcc!.computedMovement();
    const wasGrounded = this.grounded;
    this.grounded = this.kcc!.computedGrounded();
    this.pos.x += m.x;
    this.pos.y += m.y;
    this.pos.z += m.z;
    this.body!.setNextKinematicTranslation(this.pos);
    this.body!.setTranslation(this.pos, false);
    // Blocked motion kills velocity along that axis.
    if (Math.abs(m.x - desired.x) > 1e-4 && dt > 0) this.vel.x = m.x / dt;
    if (Math.abs(m.z - desired.z) > 1e-4 && dt > 0) this.vel.z = m.z / dt;
    if (this.grounded && this.vel.y < 0) this.vel.y = 0;
    else if (desired.y > 0 && m.y < desired.y * 0.5) this.vel.y = 0; // ceiling

    if (!wasGrounded && this.grounded) {
      const impact = this.lastFallSpeed;
      this.landDip = Math.min(0.25, impact * 0.012);
      if (impact > 6) {
        audio.play(impact > 12 ? "land_heavy" : "land");
        this.dust(Math.round(impact));
      }
    }
    this.lastFallSpeed = this.grounded ? 0 : Math.max(0, -this.vel.y);

    // Footsteps.
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (this.grounded && hs > 1) {
      this.stepAcc += hs * dt;
      if (this.stepAcc > 2.1) {
        this.stepAcc = 0;
        const sk = surf.id;
        audio.play(sk === "water" || sk === "oil" || sk === "blood" ? "footstep_water" : sk === "ice" ? "footstep_snow" : "footstep_stone", { volume: 0.55 });
      }
    }

    if (this.pos.y < KILL_Y - 10) this.vel.set(0, 0, 0);
  }

  private prevHoriz = 0;

  private updateCamera(dt: number): void {
    const cam = this.camera;
    const hs = Math.hypot(this.vel.x, this.vel.z);
    const targetAmp = this.grounded ? Math.min(1, hs / PLAYER.speed) : 0;
    this.bobAmp = damp(this.bobAmp, targetAmp, 10, dt);
    this.bobPhase += hs * dt * 1.7;
    this.landDip = damp(this.landDip, 0, 9, dt);
    this.trauma = Math.max(0, this.trauma - dt * 1.4);
    this.fovKick = damp(this.fovKick, this.dashTime > 0 ? 12 : 0, 10, dt);
    const shake = this.trauma * this.trauma * this.hooks.shakeScale();
    const t = this.time * 30;
    const eye = this.dead ? -0.6 : PLAYER.eyeHeight;
    cam.position.set(
      this.pos.x + Math.cos(this.bobPhase) * 0.035 * this.bobAmp,
      this.pos.y + eye + Math.abs(Math.sin(this.bobPhase)) * 0.05 * this.bobAmp - this.landDip,
      this.pos.z,
    );
    cam.rotation.order = "YXZ";
    cam.rotation.set(this.pitch + Math.sin(t * 1.1) * 0.05 * shake, this.yaw + Math.sin(t * 0.9 + 1) * 0.05 * shake, Math.sin(t * 1.3 + 2) * 0.04 * shake + (this.dead ? 0.4 : 0));
    const fov = 80 + this.fovKick;
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    audio.setListener(cam.position, dirFromAngles(this.yaw, this.pitch));
    this.viewmodel?.animate({
      anim: this.time - this.castAnim < 0.3 ? 9 : 0,
      variant: 0,
      animTime: this.time - this.castAnim,
      time: this.time,
      dt,
      speed: this.grounded ? hs : 0,
      hp: this.self.hp / Math.max(1, this.self.maxHp),
      flags: 0,
      statuses: [],
    });
  }

  // ── casting ──────────────────────────────────────────────────────────────

  eye(): Vector3 {
    return new Vector3(this.camera.position.x, this.camera.position.y, this.camera.position.z);
  }

  aim(): Vector3 {
    const d = dirFromAngles(this.yaw, this.pitch);
    return new Vector3(d.x, d.y, d.z);
  }

  /** Where the focus tip is (spells visually leave from here). */
  private castOrigin(): Vector3 {
    const tip = this.viewmodel?.sockets?.tip;
    if (tip) {
      const v = new Vector3();
      tip.getWorldPosition(v);
      return v;
    }
    const d = this.aim();
    return this.eye().addScaledVector(d, 0.5).add(new Vector3(-d.z, -0.15, d.x).multiplyScalar(0.25));
  }

  private casting(dt: number, input: Input): void {
    const st = this.stats;
    if (!st || !input.locked) return;
    this.trySlot("primary", st.primary, input.mouse(0), input.mouseWasPressed(0), input.mouseWasReleased(0));
    this.trySlot("secondary", st.secondary, input.mouse(2), input.mouseWasPressed(2), input.mouseWasReleased(2));
    if (st.relic) this.trySlot("relic", st.relic, input.isDown("relic"), input.wasPressed("relic"), input.wasReleased("relic"));
    void dt;
  }

  private trySlot(slot: "primary" | "secondary" | "relic", spellId: string, held: boolean, pressed: boolean, released: boolean): void {
    const spell = SPELLS.find(spellId);
    if (!spell) return;
    const eye = this.eye();
    const dir = this.aim();
    if (spell.channeled) {
      if (pressed && this.self.mana > spell.mana * 0.15) {
        this.hooks.send({ t: "cast", slot, id: this.castId++, o: [eye.x, eye.y, eye.z], d: [dir.x, dir.y, dir.z] });
        this.channeling = slot as "primary" | "secondary";
      }
      if (released && this.channeling === slot) {
        this.hooks.send({ t: "release", slot });
        this.channeling = null;
      }
      return;
    }
    if (spell.delivery.kind === "grasp") {
      if (pressed && !this.graspHeld && (this.localCd[spellId] ?? 0) <= 0) {
        this.graspHeld = true;
        this.hooks.send({ t: "cast", slot, id: this.castId++, o: [eye.x, eye.y, eye.z], d: [dir.x, dir.y, dir.z] });
        this.localCd[spellId] = spell.cooldown;
      }
      if (released && this.graspHeld) {
        this.graspHeld = false;
        this.hooks.send({ t: "release", slot });
        this.castAnim = this.time;
      }
      return;
    }
    if (!held) return;
    if ((this.localCd[spellId] ?? 0) > 0 || this.self.mana < spell.mana || this.self.st.frozen || this.self.st.stunned) return;
    const id = this.castId++;
    this.localCd[spellId] = spell.cooldown;
    this.self.mana -= spell.mana;
    this.hooks.send({ t: "cast", slot, id, o: [eye.x, eye.y, eye.z], d: [dir.x, dir.y, dir.z] });
    this.castAnim = this.time;
    if (spell.sfx?.cast) audio.play(spell.sfx.cast);
    if (spell.delivery.kind === "dash") {
      this.dash(spell);
      return;
    }
    this.trauma = Math.min(1, this.trauma + 0.06);
    this.predict(spell, id, dir);
  }

  private dash(spell: SpellDef): void {
    const d = spell.delivery as Extract<SpellDef["delivery"], { kind: "dash" }>;
    const hs = Math.hypot(this.vel.x, this.vel.z);
    const dir = hs > 0.5 ? new Vector3(this.vel.x / hs, 0, this.vel.z / hs) : this.aim().setY(0).normalize();
    this.dashVel.copy(dir).multiplyScalar(d.distance / d.duration);
    this.dashTime = d.duration;
    this.particlesAtFeet([1.2, 1, 1.8], 16);
  }

  /** Visual prediction of our own projectiles (the server's copies are
   * hidden for us); impacts come from the server. */
  private predict(spell: SpellDef, castId: number, dir: Vector3): void {
    const d = spell.delivery;
    if (d.kind !== "projectile") return;
    const origin = this.castOrigin();
    const st = this.stats!;
    let count = (d.count ?? 1) + st.extraProjectiles;
    const speedMult = st.projectileSpeed;
    for (const id of st.amps) {
      if (id === "twinned") count += 1;
      if (id === "legion") count += 2;
    }
    const spread = ((d.spread ?? 0) + (count > 1 && !d.spread ? 4 : 0)) * (Math.PI / 180);
    const yaw = Math.atan2(-dir.x, -dir.z);
    const pitch = Math.asin(Math.max(-1, Math.min(1, dir.y)));
    const color = hexLinear(spell.vfx.color, 2.2);
    for (let k = 0; k < count; k++) {
      const off = count === 1 ? 0 : (k / (count - 1) - 0.5) * 2 * spread;
      const v = dirFromAngles(yaw + off, pitch);
      this.predicted.push(new Predicted(castId, spell, origin.clone(), new Vector3(v.x, v.y, v.z).multiplyScalar(d.speed * speedMult), color, this.lights, this.collider!));
    }
  }

  /** Server says a cast of ours hit something: retire one prediction. */
  onImpact(castId: number, p: [number, number, number]): void {
    let best: Predicted | null = null;
    let bestD = Infinity;
    for (const pr of this.predicted) {
      if (pr.castId !== castId || pr.done) continue;
      const d = pr.pos.distanceToSquared(new Vector3(...p));
      if (d < bestD) {
        bestD = d;
        best = pr;
      }
    }
    if (best) best.done = true;
  }

  cooldown(spellId: string): number {
    return this.localCd[spellId] ?? 0;
  }

  // ── world proxies ────────────────────────────────────────────────────────

  /** Solid replicas of nearby creatures and props so we collide with them. */
  private syncProxies(cw: ClientWorld): void {
    const w = this.world!;
    const seen = new Set<number>();
    for (const e of cw.entities.values()) {
      if (e.id === cw.selfId) continue;
      const solid = (e.type === EntityType.Creature && e.hp > 0 && e.anim !== 8) || e.type === EntityType.Player || (e.type === EntityType.Interactable && (e.def === "chest" || e.def === "reliquary"));
      if (!solid) continue;
      if (Math.abs(e.x - this.pos.x) > 12 || Math.abs(e.z - this.pos.z) > 12) continue;
      seen.add(e.id);
      let p = this.proxies.get(e.id);
      if (!p) {
        const body = w.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(e.x, e.y, e.z));
        const collider = w.createCollider(proxyShape(e.type, e.def).setCollisionGroups(GROUPS.creature), body);
        p = { body, collider };
        this.proxies.set(e.id, p);
      }
      p.body.setNextKinematicTranslation({ x: e.x, y: e.type === EntityType.Interactable ? e.y + 0.3 : e.y, z: e.z });
    }
    for (const [id, p] of this.proxies) {
      if (seen.has(id)) continue;
      w.removeRigidBody(p.body);
      this.proxies.delete(id);
    }
    w.step();
  }

  private dust(n: number): void {
    this.particlesAtFeet([0.35, 0.32, 0.28], n, false);
  }

  private particlesAtFeet(c: [number, number, number], n: number, additive = true): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      this.particles.spawn({
        x: this.pos.x + Math.cos(a) * 0.3,
        y: this.pos.y - HALF - RADIUS + 0.05,
        z: this.pos.z + Math.sin(a) * 0.3,
        vx: Math.cos(a) * 1.2,
        vy: 0.4 + Math.random() * 0.6,
        vz: Math.sin(a) * 1.2,
        life: 0.6,
        size: additive ? 0.06 : 0.25,
        size1: additive ? 0.02 : 0.6,
        r: c[0],
        g: c[1],
        b: c[2],
        alpha: additive ? 1 : 0.35,
        sprite: additive ? "star" : "dust",
        additive,
        drag: 2,
      });
    }
  }

  focusModelId(): string {
    const f = this.stats ? ITEMS.find(this.focusBase)?.model : undefined;
    return f ?? "staff_apprentice";
  }

  focusBase = "apprentice_staff";
}

function proxyShape(type: EntityType, def: string) {
  if (type === EntityType.Interactable) return RAPIER.ColliderDesc.cuboid(0.45, 0.3, 0.3);
  if (type === EntityType.Player) return RAPIER.ColliderDesc.capsule(HALF, RADIUS);
  const c = CREATURES.find(def);
  const r = (c?.radius ?? 0.3) * (c?.scale ?? 1);
  const h = (c?.height ?? 1.2) * (c?.scale ?? 1);
  return RAPIER.ColliderDesc.capsule(Math.max(0.01, h / 2 - r), r);
}
