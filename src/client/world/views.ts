import { Group, Quaternion, Vector3 } from "three";
import { CREATURES, ITEMS, PROPS, SPELLS, TRAPS } from "../../shared/content";
import type { EntityInfo } from "../../shared/net/protocol";
import { Anim, EntityType, Flag } from "../../shared/sim/entity";
import { createModel, type AnimInput, type ModelInstance } from "../gfx/models/registry";
import { ELEMENT_COLOR, hexLinear } from "../fx/palette";
import type { PointLight } from "../render/lights";
import type { ClientEntity, ViewContext } from "./ClientWorld";

/** Entity views: how each kind of replicated entity looks, glows and
 * animates. A view owns its scene objects, lights and emitters and cleans
 * them up on dispose. */

export interface EntityView {
  update(e: ClientEntity, dt: number, now: number): void;
  onInfo?(info: EntityInfo): void;
  dispose(): void;
  /** World point for name tags / hp bars (null = none). */
  anchor?(): Vector3 | null;
}

export function createView(e: ClientEntity, ctx: ViewContext): EntityView {
  switch (e.type) {
    case EntityType.Creature:
      return new CreatureView(e, ctx);
    case EntityType.Player:
      return new DelverView(e, ctx);
    case EntityType.Prop:
      return new PropView(e, ctx);
    case EntityType.Projectile:
      return new ProjectileView(e, ctx);
    case EntityType.Pickup:
      return new PickupView(e, ctx);
    case EntityType.Trap:
      return new TrapView(e, ctx);
    case EntityType.Interactable:
      return new InteractableView(e, ctx);
  }
}

const tmpQ = new Quaternion();
const UP = new Vector3(0, 1, 0);

function animInput(e: ClientEntity, dt: number, now: number): AnimInput {
  return {
    anim: e.anim as Anim,
    variant: e.variant,
    animTime: Math.max(0, now - e.animStart),
    time: now,
    dt,
    speed: Math.hypot(e.pose.v[0], e.pose.v[2]),
    hp: e.hp,
    flags: e.flags,
    statuses: e.statuses,
  };
}

/** Shared status visuals for living things: fire, frost, shock, poison. */
function statusFx(e: ClientEntity, ctx: ViewContext, height: number, dt: number): void {
  if (!e.statuses.length) return;
  const p = ctx.particles;
  const k = Math.min(1, dt * 30);
  for (const s of e.statuses) {
    if (Math.random() > k) continue;
    const x = e.x + (Math.random() - 0.5) * 0.5;
    const z = e.z + (Math.random() - 0.5) * 0.5;
    const y = e.y - height / 2 + Math.random() * height;
    switch (s) {
      case "burning":
        p.spawn({ x, y, z, vy: 1.6, life: 0.45, size: 0.25, size1: 0.05, r: 3, g: 1.1, b: 0.25, sprite: "flame", turb: 2 });
        if (Math.random() < 0.2) p.spawn({ x, y: y + 0.4, z, vy: 1, life: 1.4, size: 0.3, size1: 0.8, r: 0.06, g: 0.05, b: 0.05, alpha: 0.5, sprite: "smoke", additive: false });
        break;
      case "chilled":
      case "frozen":
        if (Math.random() < 0.3) p.spawn({ x, y, z, vy: -0.2, life: 0.8, size: 0.06, r: 0.8, g: 1.4, b: 2, sprite: "snowflake", spin: 3 });
        break;
      case "shocked":
        if (Math.random() < 0.4) p.spawn({ x, y, z, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, vz: (Math.random() - 0.5) * 4, life: 0.12, size: 0.08, r: 2, g: 2, b: 0.8, sprite: "spark" });
        break;
      case "poisoned":
        if (Math.random() < 0.15) p.spawn({ x, y, z, vy: 0.4, life: 1, size: 0.08, r: 0.4, g: 1.4, b: 0.2, sprite: "bubble", turb: 0.5 });
        break;
      case "wet":
        if (Math.random() < 0.1) p.spawn({ x, y, z, vy: -1, gravity: -9, life: 0.5, size: 0.04, r: 0.4, g: 0.6, b: 0.9, alpha: 0.7, sprite: "droplet", additive: false });
        break;
      case "oiled":
        if (Math.random() < 0.05) p.spawn({ x, y, z, vy: -1, gravity: -9, life: 0.5, size: 0.05, r: 0.05, g: 0.04, b: 0.02, alpha: 0.8, sprite: "droplet", additive: false });
        break;
      case "blessed":
        if (Math.random() < 0.15) p.spawn({ x, y, z, vy: 0.8, life: 1.2, size: 0.07, r: 2, g: 1.7, b: 0.9, sprite: "star", turb: 0.5 });
        break;
    }
  }
}

class CreatureView implements EntityView {
  private holder = new Group();
  private model: ModelInstance;
  private light: PointLight | null = null;
  private height: number;
  private lastHp: number;
  private tmp = new Vector3();

  constructor(
    e: ClientEntity,
    private ctx: ViewContext,
  ) {
    const def = CREATURES.get(e.def);
    this.height = def.height * (def.scale ?? 1);
    this.model = createModel(def.model, { flashable: true, seed: e.id });
    if (def.scale && def.scale !== 1) this.model.root.scale.setScalar(def.scale);
    this.model.root.position.y = -this.height / 2;
    this.holder.add(this.model.root);
    ctx.scene.add(this.holder);
    if (def.light) this.light = ctx.lights.add({ position: [e.x, e.y, e.z], color: def.light.color, intensity: def.light.intensity, radius: def.light.radius, flicker: 0.5, priority: 2 });
    this.lastHp = e.hp;
  }

  update(e: ClientEntity, dt: number, now: number): void {
    const dead = e.anim === Anim.Dead;
    if (dead) {
      // Corpses rest on the grid floor, facing their last yaw.
      this.holder.position.set(e.x, this.ctx.groundAt(e.x, e.z) + this.height / 2, e.z);
    } else {
      this.holder.position.set(e.x, e.y, e.z);
    }
    this.holder.quaternion.copy(tmpQ.setFromAxisAngle(UP, e.yaw));
    this.model.animate(animInput(e, dt, now));
    if (e.hp < this.lastHp) this.model.flash?.(1, e.flashColor);
    else this.model.flash?.(e.statuses.includes("frozen") ? 0.55 : e.flash, e.statuses.includes("frozen") ? [0.6, 0.85, 1] : e.flashColor);
    this.lastHp = e.hp;
    if (this.light) {
      const sock = this.model.sockets?.light;
      if (sock && !dead) {
        sock.getWorldPosition(this.tmp);
        this.light.x = this.tmp.x;
        this.light.y = this.tmp.y;
        this.light.z = this.tmp.z;
      } else {
        this.light.x = e.x;
        this.light.y = e.y + this.height * 0.4;
        this.light.z = e.z;
      }
      this.light.enabled = !dead && !e.statuses.includes("wet");
    }
    if (!dead) statusFx(e, this.ctx, this.height, dt);
  }

  anchor(): Vector3 {
    return this.tmp.set(this.holder.position.x, this.holder.position.y + this.height / 2 + 0.3, this.holder.position.z);
  }

  dispose(): void {
    this.ctx.scene.remove(this.holder);
    this.model.dispose();
    this.ctx.lights.remove(this.light);
  }
}

class DelverView implements EntityView {
  private holder = new Group();
  private model: ModelInstance;
  private lantern: PointLight;
  private tmp = new Vector3();
  private height = 1.72;

  constructor(
    e: ClientEntity,
    private ctx: ViewContext,
  ) {
    this.model = createModel("delver", { flashable: true, look: e.info?.look, seed: e.id });
    this.model.root.position.y = -this.height / 2;
    this.holder.add(this.model.root);
    ctx.scene.add(this.holder);
    this.lantern = ctx.lights.add({ position: [e.x, e.y, e.z], color: e.info?.look?.lantern ?? "#ffc48a", intensity: 2.2, radius: 8, flicker: 0.25, priority: 3 });
  }

  onInfo(info: EntityInfo): void {
    if (info.look?.lantern) this.ctx.lights.setColor(this.lantern, info.look.lantern);
  }

  update(e: ClientEntity, dt: number, now: number): void {
    this.holder.position.set(e.x, e.y, e.z);
    this.holder.quaternion.copy(tmpQ.setFromAxisAngle(UP, e.yaw));
    this.model.animate(animInput(e, dt, now));
    this.model.flash?.(e.flash, e.flashColor);
    const sock = this.model.sockets?.lantern;
    if (sock) sock.getWorldPosition(this.tmp);
    else this.tmp.set(e.x, e.y + 0.2, e.z);
    this.lantern.x = this.tmp.x;
    this.lantern.y = this.tmp.y;
    this.lantern.z = this.tmp.z;
    this.lantern.enabled = e.anim !== Anim.Dead;
    statusFx(e, this.ctx, this.height, dt);
    if (e.flags & Flag.Palm && Math.random() < dt * 20) {
      this.ctx.particles.spawn({ x: e.x, y: e.y + 0.9, z: e.z, vy: 0.6, life: 0.8, size: 0.08, r: 1.6, g: 1.5, b: 1, sprite: "star", turb: 1 });
    }
  }

  anchor(): Vector3 {
    return this.tmp.set(this.holder.position.x, this.holder.position.y + 1.15, this.holder.position.z);
  }

  dispose(): void {
    this.ctx.scene.remove(this.holder);
    this.model.dispose();
    this.ctx.lights.remove(this.lantern);
  }
}

class PropView implements EntityView {
  private model: ModelInstance;
  private light: PointLight | null = null;
  private tmp = new Vector3();
  private flameAcc = 0;

  constructor(
    e: ClientEntity,
    private ctx: ViewContext,
  ) {
    const def = PROPS.get(e.def);
    this.model = createModel(def.model, { flashable: !!def.hp, seed: e.id });
    ctx.scene.add(this.model.root);
    if (def.light) this.light = ctx.lights.add({ position: [e.x, e.y, e.z], color: def.light.color, intensity: def.light.intensity, radius: def.light.radius, flicker: def.light.flicker ?? 0.5, priority: 1 });
  }

  update(e: ClientEntity, dt: number, now: number): void {
    const r = this.model.root;
    r.position.set(e.x, e.y, e.z);
    const q = e.pose.q;
    if (q) r.quaternion.set(q[0], q[1], q[2], q[3]);
    else r.quaternion.copy(tmpQ.setFromAxisAngle(UP, e.yaw));
    this.model.animate(animInput(e, dt, now));
    this.model.flash?.(e.flash, e.flashColor);
    if (this.light) {
      const sock = this.model.sockets?.light;
      if (sock) sock.getWorldPosition(this.tmp);
      else this.tmp.set(e.x, e.y + 0.5, e.z);
      this.light.x = this.tmp.x;
      this.light.y = this.tmp.y;
      this.light.z = this.tmp.z;
      this.flameAcc += dt;
      if (this.flameAcc > 0.12) {
        this.flameAcc = 0;
        this.ctx.particles.spawn({ x: this.tmp.x, y: this.tmp.y, z: this.tmp.z, vy: 0.5, life: 0.4, size: 0.08, size1: 0.02, r: 2.5, g: 1.2, b: 0.4, sprite: "flame" });
      }
    }
    statusFx(e, this.ctx, 0.8, dt);
  }

  dispose(): void {
    this.ctx.scene.remove(this.model.root);
    this.model.dispose();
    this.ctx.lights.remove(this.light);
  }
}

class ProjectileView implements EntityView {
  private light: PointLight | null;
  private color: [number, number, number];
  private size: number;
  private trail: string;

  constructor(
    e: ClientEntity,
    private ctx: ViewContext,
  ) {
    const spell = SPELLS.find(e.def);
    this.color = spell ? hexLinear(spell.vfx.color, 2.2) : ELEMENT_COLOR.arcane;
    this.size = spell?.delivery.kind === "projectile" ? Math.max(0.12, spell.delivery.radius * 2.4) : 0.2;
    this.trail = spell?.vfx.trail ?? "";
    const L = spell?.vfx.light;
    this.light = L ? ctx.lights.add({ position: [e.x, e.y, e.z], color: L.color, intensity: L.intensity, radius: L.radius, priority: 3, flicker: 0.2 }) : null;
  }

  update(e: ClientEntity, dt: number): void {
    // Our own casts are drawn by the local prediction (player/Predicted.ts).
    if (e.info?.own) {
      if (this.light) this.light.enabled = false;
      return;
    }
    const p = this.ctx.particles;
    const [r, g, b] = this.color;
    // Core glow (re-emitted every frame so it tracks the interpolated pose).
    p.spawn({ x: e.x, y: e.y, z: e.z, life: 0.05, size: this.size * 1.6, r, g, b, sprite: "glow" });
    p.spawn({ x: e.x, y: e.y, z: e.z, life: 0.05, size: this.size * 0.6, r: r * 2, g: g * 2, b: b * 2, sprite: "glow" });
    const n = Math.max(1, Math.round(dt * 90));
    for (let k = 0; k < n; k++) trailParticle(p, this.trail, e, [r, g, b], this.size);
    if (this.light) {
      this.light.x = e.x;
      this.light.y = e.y;
      this.light.z = e.z;
    }
  }

  dispose(): void {
    this.ctx.lights.remove(this.light);
  }
}

function trailParticle(p: ViewContext["particles"], trail: string, e: ClientEntity, c: [number, number, number], size: number): void {
  const jx = (Math.random() - 0.5) * size * 0.6;
  const jy = (Math.random() - 0.5) * size * 0.6;
  const jz = (Math.random() - 0.5) * size * 0.6;
  switch (trail) {
    case "fire":
    case "ember":
      p.spawn({ x: e.x + jx, y: e.y + jy, z: e.z + jz, vy: 0.8, life: 0.35, size: size * 0.9, size1: 0.02, r: c[0], g: c[1] * 0.6, b: c[2] * 0.4, sprite: "flame", turb: 2 });
      if (Math.random() < 0.3) p.spawn({ x: e.x, y: e.y, z: e.z, vy: 0.6, life: 0.9, size: size, size1: size * 3, r: 0.05, g: 0.04, b: 0.04, alpha: 0.4, sprite: "smoke", additive: false });
      break;
    case "frost":
      p.spawn({ x: e.x + jx, y: e.y + jy, z: e.z + jz, vy: -0.3, life: 0.5, size: size * 0.4, r: c[0], g: c[1], b: c[2], sprite: "snowflake", spin: 4 });
      break;
    case "spark":
      p.spawn({ x: e.x + jx * 3, y: e.y + jy * 3, z: e.z + jz * 3, life: 0.1, size: size * 0.6, r: c[0], g: c[1], b: c[2], sprite: "spark" });
      break;
    case "void":
      p.spawn({ x: e.x + jx, y: e.y + jy, z: e.z + jz, life: 0.5, size: size * 1.2, size1: 0.02, r: c[0] * 0.6, g: c[1] * 0.4, b: c[2], sprite: "ring", spin: 5 });
      break;
    case "venom":
      p.spawn({ x: e.x + jx, y: e.y + jy, z: e.z + jz, gravity: -6, life: 0.5, size: size * 0.4, r: c[0], g: c[1], b: c[2], alpha: 0.9, sprite: "droplet", additive: false });
      break;
    default:
      p.spawn({ x: e.x + jx, y: e.y + jy, z: e.z + jz, life: 0.25, size: size * 0.7, size1: 0.01, r: c[0], g: c[1], b: c[2], sprite: "glow" });
  }
}

class PickupView implements EntityView {
  private model: ModelInstance;
  private light: PointLight | null = null;
  private seed = Math.random() * 10;
  private rarity: string | undefined;

  constructor(
    e: ClientEntity,
    private ctx: ViewContext,
  ) {
    const base = ITEMS.find(e.def);
    this.model = createModel(base?.model ?? "coin", { seed: e.id });
    ctx.scene.add(this.model.root);
    this.rarity = e.info?.rarity;
    this.makeLight(e);
  }

  private makeLight(e: ClientEntity): void {
    const color = rarityColor(this.rarity) ?? ITEMS.find(e.def)?.color ?? "#ffd24a";
    this.ctx.lights.remove(this.light);
    this.light = this.ctx.lights.add({ position: [e.x, e.y, e.z], color, intensity: this.rarity && this.rarity !== "common" ? 1.6 : 0.8, radius: 3.5, priority: 1, haze: 0.4 });
  }

  onInfo(info: EntityInfo): void {
    this.rarity = info.rarity;
  }

  update(e: ClientEntity, dt: number, now: number): void {
    const r = this.model.root;
    r.position.set(e.x, e.y + 0.12 + Math.sin(now * 2.2 + this.seed) * 0.06, e.z);
    r.rotation.y = now * 1.4 + this.seed;
    if (this.light) {
      this.light.x = e.x;
      this.light.y = e.y + 0.4;
      this.light.z = e.z;
    }
    const rare = e.flags & Flag.Rare;
    if (Math.random() < dt * (rare ? 14 : 4)) {
      const c = hexLinear(rarityColor(this.rarity) ?? "#ffd24a", 2);
      this.ctx.particles.spawn({ x: e.x + (Math.random() - 0.5) * 0.3, y: e.y, z: e.z + (Math.random() - 0.5) * 0.3, vy: rare ? 1.6 : 0.6, life: rare ? 1.2 : 0.8, size: 0.05, r: c[0], g: c[1], b: c[2], sprite: "star" });
    }
  }

  dispose(): void {
    this.ctx.scene.remove(this.model.root);
    this.model.dispose();
    this.ctx.lights.remove(this.light);
  }
}

function rarityColor(r: string | undefined): string | undefined {
  switch (r) {
    case "uncommon":
      return "#7fd06a";
    case "rare":
      return "#5fa8ff";
    case "epic":
      return "#c07bff";
    case "legendary":
      return "#ffb83a";
    default:
      return undefined;
  }
}

class TrapView implements EntityView {
  private model: ModelInstance;

  constructor(
    e: ClientEntity,
    private ctx: ViewContext,
  ) {
    this.model = createModel(TRAPS.get(e.def).model, { seed: e.id });
    ctx.scene.add(this.model.root);
  }

  update(e: ClientEntity, dt: number, now: number): void {
    const r = this.model.root;
    r.position.set(e.x, e.y, e.z);
    r.quaternion.copy(tmpQ.setFromAxisAngle(UP, e.yaw));
    this.model.animate(animInput(e, dt, now));
  }

  dispose(): void {
    this.ctx.scene.remove(this.model.root);
    this.model.dispose();
  }
}

const INTERACT_LIGHT: Record<string, { color: string; intensity: number; radius: number } | undefined> = {
  descent: { color: "#9a7cff", intensity: 3.5, radius: 9 },
  arrival: { color: "#6a6488", intensity: 1, radius: 5 },
  reliquary: { color: "#ffd8a0", intensity: 1.6, radius: 5 },
  mercy_candle: { color: "#ffc070", intensity: 2.4, radius: 7 },
  note: { color: "#fff0c8", intensity: 0.5, radius: 2.5 },
};

class InteractableView implements EntityView {
  private model: ModelInstance;
  private light: PointLight | null = null;
  private kind: string;
  private tmp = new Vector3();

  constructor(
    e: ClientEntity,
    private ctx: ViewContext,
  ) {
    this.kind = e.def;
    this.model = createModel(e.def, { seed: e.id });
    ctx.scene.add(this.model.root);
    const L = INTERACT_LIGHT[e.def];
    if (L) this.light = ctx.lights.add({ position: [e.x, e.y + 1, e.z], color: L.color, intensity: L.intensity, radius: L.radius, priority: 2, flicker: 0.15 });
  }

  update(e: ClientEntity, dt: number, now: number): void {
    const r = this.model.root;
    r.position.set(e.x, e.y, e.z);
    r.quaternion.copy(tmpQ.setFromAxisAngle(UP, e.yaw));
    this.model.animate(animInput(e, dt, now));
    if (this.light) {
      this.light.x = e.x;
      this.light.y = e.y + (this.kind === "descent" ? 0.6 : 0.8);
      this.light.z = e.z;
      if (this.kind === "descent") {
        const sealed = e.flags & Flag.Sealed;
        this.light.intensity = sealed ? 0.8 : 3.5 + Math.sin(now * 2) * 0.6;
        this.ctx.lights.setColor(this.light, e.flags & Flag.CanAscend ? "#d8e4ff" : "#9a7cff");
      }
    }
    if (this.kind === "descent" && !(e.flags & Flag.Sealed) && Math.random() < dt * 25) {
      const a = Math.random() * Math.PI * 2;
      const rr = 0.4 + Math.random() * 0.8;
      const up = e.flags & Flag.CanAscend;
      const c = up ? [1.4, 1.5, 2] : [1.1, 0.6, 2.2];
      this.ctx.particles.spawn({ x: e.x + Math.cos(a) * rr, y: e.y + 0.05, z: e.z + Math.sin(a) * rr, vx: -Math.cos(a) * 0.3, vy: up ? 2.2 : 0.4, vz: -Math.sin(a) * 0.3, life: 1.2, size: 0.07, r: c[0], g: c[1], b: c[2], sprite: "star", turb: 0.8 });
    }
    if (this.kind === "reliquary" && Math.random() < dt * 3) {
      this.model.root.getWorldPosition(this.tmp);
      this.ctx.particles.spawn({ x: this.tmp.x, y: this.tmp.y + 0.6, z: this.tmp.z, vy: 0.4, life: 1.5, size: 0.06, r: 2, g: 1.6, b: 0.9, sprite: "glow", turb: 0.4 });
    }
  }

  dispose(): void {
    this.ctx.scene.remove(this.model.root);
    this.model.dispose();
    this.ctx.lights.remove(this.light);
  }
}

