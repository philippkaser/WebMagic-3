import { Group, Quaternion, Vector3 } from "three";
import { BIOMES } from "../../shared/content";
import { buildStaticBoxes } from "../../shared/world/colliders";
import { generateFloor } from "../../shared/world/generate";
import { CellKind, type FloorLayout } from "../../shared/world/layout";
import { audio } from "../audio";
import { createModel, type ModelInstance } from "../gfx/models/registry";
import { meshDungeon } from "../gfx/world/DungeonMesher";
import type { Particles } from "../fx/particles";
import { biomeEnvironment } from "../render/environment";
import type { PointLight } from "../render/lights";
import type { Renderer } from "../render/Renderer";
import { SurfaceLayer } from "../world/SurfaceLayer";

/** A floor as the client sees it: the meshed grid, static fixtures and
 * decor (from the same seed the server used), light fixtures with flames,
 * the surface layer, and the stratum's air. */
export class DungeonScene {
  readonly layout: FloorLayout;
  readonly group = new Group();
  readonly surfaces: SurfaceLayer;
  private fixtures: { model: ModelInstance; light: PointLight | null; flame: Vector3 | null; kind: string }[] = [];
  private decor: ModelInstance[] = [];
  private flameAcc = 0;
  private loops: { stop(f?: number): void }[] = [];
  private time = 0;

  constructor(
    private renderer: Renderer,
    private particles: Particles,
    seed: number,
    floor: number,
    surfaceCells: number[],
  ) {
    this.layout = generateFloor(seed, floor);
    const biome = BIOMES.get(this.layout.biome);
    this.group.add(meshDungeon(this.layout, biome));
    this.surfaces = new SurfaceLayer(this.layout);
    this.surfaces.apply(surfaceCells);
    this.group.add(this.surfaces.mesh);

    const q = new Quaternion();
    const up = new Vector3(0, 1, 0);
    for (const f of this.layout.fixtures) {
      const model = createModel(f.def, { seed: Math.floor(f.pos.x * 31 + f.pos.z * 17) });
      model.root.position.set(f.pos.x, f.pos.y, f.pos.z);
      model.root.quaternion.copy(q.setFromAxisAngle(up, f.yaw));
      this.group.add(model.root);
      const light = f.light ? renderer.lights.add({ position: f.pos, color: f.light.color, intensity: f.light.intensity, radius: f.light.radius, flicker: f.light.flicker, priority: 1 }) : null;
      this.fixtures.push({ model, light, flame: f.burning ? new Vector3(f.pos.x, f.pos.y, f.pos.z) : null, kind: f.def });
      if (f.burning && f.def === "wall_torch") this.loops.push(audio.loop("torch_loop", { pos: f.pos, volume: 0.5 }));
    }
    for (const d of this.layout.decor) {
      const m = createModel(d.def, { seed: Math.floor(d.pos.x * 13 + d.pos.z * 7) });
      m.root.position.set(d.pos.x, d.pos.y, d.pos.z);
      m.root.rotation.y = d.yaw;
      m.root.scale.setScalar(d.scale);
      this.group.add(m.root);
      this.decor.push(m);
    }
    // Pools of water murmur.
    for (let z = 0; z < this.layout.grid.h; z += 6) {
      for (let x = 0; x < this.layout.grid.w; x += 6) {
        const i = z * this.layout.grid.w + x;
        if (this.layout.grid.liquid[i] && this.layout.grid.kind[i] === CellKind.Open) this.loops.push(audio.loop("water_drip", { pos: { x: x + 0.5, y: this.layout.grid.liquidLevel[i], z: z + 0.5 }, volume: 0.4 }));
      }
    }

    renderer.scene.add(this.group);
    renderer.setEnvironment(biomeEnvironment(biome));
    const g = this.layout.grid;
    renderer.setShadowGrid({ w: g.w, h: g.h, cell: 1, floor: g.floor, ceil: g.ceil, solid: (i) => g.kind[i] === CellKind.Solid });
    audio.setAmbience(biome.ambience);
    const room = audio.roomFor(biome.ambience);
    if (room) audio.setEnvironment(room);
  }

  get staticBoxes() {
    return buildStaticBoxes(this.layout);
  }

  groundAt(x: number, z: number): number {
    const g = this.layout.grid;
    const cx = Math.floor(x);
    const cz = Math.floor(z);
    if (cx < 0 || cz < 0 || cx >= g.w || cz >= g.h) return 0;
    return g.floor[cz * g.w + cx];
  }

  update(dt: number): void {
    this.time += dt;
    for (const f of this.fixtures) f.model.animate({ anim: 0, variant: 0, animTime: this.time, time: this.time, dt, speed: 0, hp: 1, flags: 0, statuses: [] });
    this.surfaces.update(this.particles, dt);
    // Torch flames, embers and smoke — only near the camera.
    this.flameAcc += dt;
    if (this.flameAcc < 1 / 30) return;
    const step = this.flameAcc;
    this.flameAcc = 0;
    const cam = this.renderer.camera.position;
    const tmp = new Vector3();
    for (const f of this.fixtures) {
      if (!f.flame) continue;
      const sock = f.model.sockets?.light;
      if (sock) sock.getWorldPosition(tmp);
      else tmp.copy(f.flame).y += 0.25;
      if (tmp.distanceToSquared(cam) > 30 * 30) continue;
      if (f.light) {
        f.light.x = tmp.x;
        f.light.y = tmp.y;
        f.light.z = tmp.z;
      }
      const big = f.kind === "brazier" || f.kind === "wall_torch";
      const n = big ? 2 : 1;
      for (let k = 0; k < n; k++) {
        this.particles.spawn({ x: tmp.x + (Math.random() - 0.5) * 0.08, y: tmp.y, z: tmp.z + (Math.random() - 0.5) * 0.08, vy: 1.1, life: 0.35 + Math.random() * 0.2, size: big ? 0.2 : 0.07, size1: 0.02, r: 3, g: 1.2, b: 0.35, sprite: "flame", turb: 1.5 });
      }
      if (Math.random() < step * 3) this.particles.spawn({ x: tmp.x, y: tmp.y + 0.1, z: tmp.z, vx: (Math.random() - 0.5) * 0.4, vy: 1.4, vz: (Math.random() - 0.5) * 0.4, life: 2, size: 0.03, r: 4, g: 1.5, b: 0.3, sprite: "ember", gravity: 0.3, turb: 2.5 });
      if (big && Math.random() < step * 4) this.particles.spawn({ x: tmp.x, y: tmp.y + 0.3, z: tmp.z, vy: 0.7, life: 2.2, size: 0.18, size1: 0.7, r: 0.05, g: 0.045, b: 0.04, alpha: 0.35, sprite: "smoke", additive: false, turb: 0.5 });
    }
    // Dust motes drifting in the lantern light.
    for (let k = 0; k < 2; k++) {
      if (Math.random() > step * 12) continue;
      this.particles.spawn({ x: cam.x + (Math.random() - 0.5) * 8, y: cam.y + (Math.random() - 0.5) * 3, z: cam.z + (Math.random() - 0.5) * 8, vx: (Math.random() - 0.5) * 0.1, vy: -0.02, vz: (Math.random() - 0.5) * 0.1, life: 5, size: 0.015, r: 0.5, g: 0.45, b: 0.38, alpha: 0.6, sprite: "dust", additive: false, turb: 0.15 });
    }
  }

  dispose(): void {
    this.renderer.scene.remove(this.group);
    for (const f of this.fixtures) {
      f.model.dispose();
      this.renderer.lights.remove(f.light);
    }
    for (const d of this.decor) d.dispose();
    for (const l of this.loops) l.stop(0.5);
    this.surfaces.dispose();
    this.group.traverse((o) => {
      const m = o as { geometry?: { dispose(): void } };
      if (o.name !== "dungeon" && m.geometry && o.parent?.name === "dungeon") m.geometry.dispose();
    });
    this.renderer.setShadowGrid(null);
  }
}
