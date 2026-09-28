import type { Collider, World } from "@dimforge/rapier3d-compat";
import { Vector3 } from "three";
import { GRAVITY } from "../../shared/config";
import type { SpellDef } from "../../shared/content/types";
import { GROUPS, RAPIER } from "../../shared/sim/physics";
import type { Particles } from "../fx/particles";
import type { LightManager, PointLight } from "../render/lights";

const ROT = { x: 0, y: 0, z: 0, w: 1 };
const balls = new Map<number, InstanceType<typeof RAPIER.Ball>>();

/** A locally predicted projectile: flies instantly from the focus tip so
 * casting feels immediate; the server's authoritative copy is invisible to
 * us and its impact event retires this one. */
export class Predicted {
  done = false;
  private life: number;
  private stopped = 0;
  private light: PointLight | null;
  private gravity: number;
  private radius: number;
  private trail: string;

  constructor(
    readonly castId: number,
    readonly spell: SpellDef,
    readonly pos: Vector3,
    readonly vel: Vector3,
    private color: [number, number, number],
    lights: LightManager,
    private self: Collider,
  ) {
    const d = spell.delivery as Extract<SpellDef["delivery"], { kind: "projectile" }>;
    this.life = d.lifetime;
    this.gravity = d.gravity;
    this.radius = d.radius;
    this.trail = spell.vfx.trail ?? "";
    const L = spell.vfx.light;
    this.light = L ? lights.add({ position: pos, color: L.color, intensity: L.intensity, radius: L.radius, priority: 3, flicker: 0.2 }) : null;
  }

  update(dt: number, world: World, particles: Particles, _lights: LightManager): void {
    if (this.done) return;
    this.life -= dt;
    if (this.stopped > 0) {
      // Parked at a wall waiting for the server's impact; give up quickly.
      this.stopped -= dt;
      if (this.stopped <= 0) this.done = true;
      return;
    }
    this.vel.y += GRAVITY * this.gravity * dt;
    const key = Math.round(this.radius * 100);
    let ball = balls.get(key);
    if (!ball) balls.set(key, (ball = new RAPIER.Ball(Math.max(0.02, key / 100))));
    const hit = world.castShape(this.pos, ROT, this.vel, ball, 0, dt, true, undefined, GROUPS.queryAll, this.self);
    if (hit) {
      this.pos.addScaledVector(this.vel, hit.time_of_impact);
      this.stopped = 0.25;
    } else this.pos.addScaledVector(this.vel, dt);
    if (this.life <= 0) this.done = true;
    const [r, g, b] = this.color;
    const size = Math.max(0.12, this.radius * 2.4);
    particles.spawn({ x: this.pos.x, y: this.pos.y, z: this.pos.z, life: 0.05, size: size * 1.6, r, g, b, sprite: "glow" });
    particles.spawn({ x: this.pos.x, y: this.pos.y, z: this.pos.z, life: 0.05, size: size * 0.6, r: r * 2, g: g * 2, b: b * 2, sprite: "glow" });
    const n = Math.max(1, Math.round(dt * 90));
    for (let k = 0; k < n; k++) {
      const j = () => (Math.random() - 0.5) * size * 0.6;
      const sprite = this.trail === "fire" || this.trail === "ember" ? "flame" : this.trail === "frost" ? "snowflake" : this.trail === "spark" ? "spark" : this.trail === "void" ? "ring" : "glow";
      particles.spawn({ x: this.pos.x + j(), y: this.pos.y + j(), z: this.pos.z + j(), vy: sprite === "flame" ? 0.8 : 0, life: 0.3, size: size * 0.7, size1: 0.01, r, g, b, sprite, spin: 4, turb: sprite === "flame" ? 2 : 0 });
    }
    if (this.light) {
      this.light.x = this.pos.x;
      this.light.y = this.pos.y;
      this.light.z = this.pos.z;
    }
  }

  dispose(lights: LightManager): void {
    lights.remove(this.light);
    this.light = null;
  }
}


