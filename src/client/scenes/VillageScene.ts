import { Group, Mesh, Vector3 } from "three";
import type { StaticBox } from "../../shared/world/colliders";
import { audio } from "../audio";
import { MeshBuilder } from "../gfx/models/kit";
import { createModel, type ModelInstance } from "../gfx/models/registry";
import type { Particles } from "../fx/particles";
import { surfaceMaterial } from "../render/materials";
import { VILLAGE_ENV } from "../render/environment";
import type { PointLight } from "../render/lights";
import type { Renderer } from "../render/Renderer";

/** A place the delver can interact with in the village (shop counters,
 * the portal, secrets). Village interactions are client-side prompts that
 * send intentions to the server. */
export interface VillageSpot {
  id: string;
  pos: Vector3;
  radius: number;
  prompt: string;
  /** "enter" | "shop:<id>" | "npc:<id>" | "secret:<id>" | … */
  action: string;
}

/** Kneel — stand-in layout until the full village is built: the market ring
 * around the Godwell portal, lanterns, a few houses and the distant
 * Colossus. */
export class VillageScene {
  readonly group = new Group();
  readonly spawn = new Vector3(0, 1.0, 9);
  readonly spawnYaw = 0;
  readonly spots: VillageSpot[] = [];
  readonly staticBoxes: StaticBox[] = [];
  private models: ModelInstance[] = [];
  private lights: PointLight[] = [];
  private time = 0;
  private portal: ModelInstance;
  private loops: { stop(f?: number): void }[] = [];

  constructor(
    private renderer: Renderer,
    private particles: Particles,
  ) {
    const b = new MeshBuilder();
    // Ground: cobbled market ring on packed earth.
    b.box([120, 1, 120], { mat: "village.dirt_path", at: [0, -0.5, 0], uvm: 3 });
    b.cylinder(14, 14, 0.06, { mat: "village.cobble", at: [0, 0.03, 0], segments: 32, uvm: 2 });
    this.staticBoxes.push({ center: [0, -0.5, 0], half: [60, 0.5, 60], role: "floor" });
    // Low well-wall around the portal pit.
    b.radial(16, (bb) => bb.box([1.6, 0.8, 0.5], { mat: "village.well_stone", at: [0, 0.4, 4.2], bevel: 0.05, flat: true }));
    // Houses around the ring.
    const houses: [number, number, number, number][] = [
      [-20, -6, 8, 6],
      [-18, 12, 7, 7],
      [18, -10, 9, 6],
      [21, 8, 6, 8],
      [0, -24, 12, 7],
      [-6, 24, 7, 6],
      [12, 22, 8, 6],
    ];
    for (const [x, z, w, d] of houses) {
      b.box([w, 4, d], { mat: "village.plaster", at: [x, 2, z], flat: true });
      b.box([w + 0.4, 0.3, d + 0.4], { mat: "village.timber", at: [x, 4.1, z] });
      b.group({ at: [x, 4.2, z] }, (bb) => {
        bb.extrude(
          [
            [-w / 2 - 0.6, 0],
            [w / 2 + 0.6, 0],
            [0, 2.8],
          ],
          d + 0.8,
          { mat: "village.shingle", uvm: 2 },
        );
      });
      // A lit window facing the ring.
      const toC = new Vector3(-x, 0, -z).normalize();
      b.box([1, 1.1, 0.1], { mat: "village.window_lit", at: [x + toC.x * (w / 2 + 0.05), 1.8, z + toC.z * (d / 2 + 0.05)], rot: [0, Math.atan2(toC.x, toC.z), 0], emit: 1.5 });
      this.staticBoxes.push({ center: [x, 2, z], half: [w / 2, 2, d / 2], role: "wall" });
      const l = renderer.lights.add({ position: [x + toC.x * (w / 2 + 1), 1.8, z + toC.z * (d / 2 + 1)], color: "#ffb870", intensity: 1.6, radius: 7, flicker: 0.3 });
      this.lights.push(l);
    }
    // The Colossus: a headless kneeling giant on the horizon.
    b.group({ at: [0, 0, -70] }, (c) => {
      c.box([26, 18, 14], { mat: "village.colossus_stone", at: [0, 9, 0], flat: true, uvm: 6 }); // knees/lap
      c.box([22, 30, 12], { mat: "village.colossus_stone", at: [0, 33, -4], rot: [0.25, 0, 0], flat: true, uvm: 6 }); // torso
      c.box([9, 26, 8], { mat: "village.colossus_stone", at: [-14, 30, 2], rot: [-0.5, 0, 0.2], flat: true, uvm: 6 });
      c.box([9, 26, 8], { mat: "village.colossus_stone", at: [14, 30, 2], rot: [-0.5, 0, -0.2], flat: true, uvm: 6 });
      c.box([10, 4, 10], { mat: "village.colossus_stone", at: [0, 49, -6], flat: true, uvm: 6 }); // the neck, headless
    });
    const ground = new Mesh(b.build(), surfaceMaterial());
    this.group.add(ground);

    // Lantern posts around the ring.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      const p = new Vector3(Math.cos(a) * 11, 0, Math.sin(a) * 11);
      const post = new MeshBuilder();
      post.cylinder(0.07, 0.09, 3, { mat: "metal.iron", at: [0, 1.5, 0], segments: 6 });
      post.box([0.35, 0.45, 0.35], { mat: "metal.iron", at: [0, 3.1, 0] });
      post.box([0.24, 0.3, 0.24], { mat: "flame", at: [0, 3.1, 0], emit: 4 });
      const m = new Mesh(post.build(), surfaceMaterial());
      m.position.copy(p);
      this.group.add(m);
      this.lights.push(renderer.lights.add({ position: [p.x, 3.1, p.z], color: "#ffc070", intensity: 2.4, radius: 10, flicker: 0.4 }));
      this.staticBoxes.push({ center: [p.x, 1.5, p.z], half: [0.12, 1.5, 0.12], role: "decor" });
    }

    // The Godwell portal in the middle of the ring.
    this.portal = createModel("descent", {});
    this.portal.root.position.set(0, 0.02, 0);
    this.portal.root.scale.setScalar(2.2);
    this.group.add(this.portal.root);
    this.lights.push(renderer.lights.add({ position: [0, 1, 0], color: "#9a7cff", intensity: 5, radius: 12, priority: 3 }));
    this.spots.push({ id: "portal", pos: new Vector3(0, 0, 0), radius: 3.2, prompt: "Step into the Godwell", action: "enter" });

    // Shop stalls (counters) — full shops arrive with the village build.
    const stalls: [string, string, number][] = [
      ["apothecary", "Mother Sallow — Apothecary", 0.6],
      ["artificer", "Brannoc — Artificer", 1.4],
      ["wagers", "Mistress Vey — Wagers", 2.3],
      ["tailor", "Pell — Tailor", 3.3],
      ["quartermaster", "Old Hask — Quartermaster", 4.3],
      ["stash", "Your Stash", 5.3],
    ];
    for (const [id, label, a] of stalls) {
      const p = new Vector3(Math.cos(a) * 12.5, 0, Math.sin(a) * 12.5);
      const s = new MeshBuilder();
      s.box([2.4, 1.1, 0.9], { mat: "wood.old", at: [0, 0.55, 0], bevel: 0.04 });
      s.box([2.8, 0.1, 1.6], { mat: "village.market_cloth", at: [0, 2.5, -0.2], rot: [0.2, 0, 0] });
      s.cylinder(0.05, 0.05, 2.5, { mat: "wood.beam", at: [-1.3, 1.25, -0.8] });
      s.cylinder(0.05, 0.05, 2.5, { mat: "wood.beam", at: [1.3, 1.25, -0.8] });
      const m = new Mesh(s.build(), surfaceMaterial());
      m.position.copy(p);
      m.lookAt(0, 0, 0);
      this.group.add(m);
      this.staticBoxes.push({ center: [p.x, 0.55, p.z], half: [0.8, 0.55, 0.8], role: "decor" });
      this.spots.push({ id, pos: p.clone().multiplyScalar(0.92), radius: 2.2, prompt: label, action: id === "stash" ? "panel:inventory" : `shop:${id}` });
      this.lights.push(renderer.lights.add({ position: [p.x * 0.95, 2.2, p.z * 0.95], color: "#ffd8a0", intensity: 1.2, radius: 5, flicker: 0.2 }));
    }

    renderer.scene.add(this.group);
    renderer.setEnvironment(VILLAGE_ENV);
    renderer.setShadowGrid(null);
    audio.setAmbience("village_night");
    audio.setEnvironment("village_night");
    this.loops.push(audio.loop("portal_hum_loop", { pos: { x: 0, y: 1, z: 0 } }));
  }

  groundAt(): number {
    return 0;
  }

  update(dt: number): void {
    this.time += dt;
    this.portal.animate({ anim: 0, variant: 0, animTime: this.time, time: this.time, dt, speed: 0, hp: 1, flags: 0, statuses: [] });
    if (Math.random() < dt * 30) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 3;
      this.particles.spawn({ x: Math.cos(a) * r, y: 0.1, z: Math.sin(a) * r, vy: 0.3 + Math.random() * 0.6, life: 2, size: 0.06, r: 1, g: 0.6, b: 2.2, sprite: "star", turb: 0.8 });
    }
    // Fog wisps and fireflies.
    if (Math.random() < dt * 4) {
      const cam = this.renderer.camera.position;
      this.particles.spawn({ x: cam.x + (Math.random() - 0.5) * 30, y: 0.5 + Math.random() * 2, z: cam.z + (Math.random() - 0.5) * 30, vx: 0.2, life: 6, size: 2, size1: 4, r: 0.12, g: 0.13, b: 0.17, alpha: 0.12, sprite: "smoke", additive: false, turb: 0.2 });
    }
  }

  dispose(): void {
    this.renderer.scene.remove(this.group);
    for (const l of this.lights) this.renderer.lights.remove(l);
    for (const m of this.models) m.dispose();
    this.portal.dispose();
    for (const l of this.loops) l.stop(0.5);
    this.group.traverse((o) => (o as Mesh).geometry?.dispose());
  }
}
