import { Box3, Mesh, Vector3, type Object3D } from "three";
import { Anim, Flag } from "../../../shared/sim/entity";
import { DEFAULT_ENV, LAYER, Renderer } from "../../render/Renderer";
import type { PointLight } from "../../render/lights";
import { surfaceMaterial } from "../../render/materials";
import "../textures/painters";
import { buildMaterialArrays } from "../textures/library";
import "./index";
import { MeshBuilder } from "./kit";
import { createModel, modelIds, type AnimInput, type ModelInstance } from "./registry";
import { buildViewmodel } from "./viewmodel";

/** Model contact sheet (model-sheet.html): renders registered models with
 * the game's deferred renderer so they can be judged under real lighting
 * and at the game's chunky resolution. Driven by URL params:
 *
 *   group=creatures|props|items|fixtures|traps|interactables|delver|all
 *   ids=a,b,c            explicit list (overrides group)
 *   mode=grid|scene|vm   contact grid · in-situ crypt scene · first-person viewmodel
 *   anim=Walk&at=0.3     frozen anim state (omit `at` to animate live)
 *   variant=1 speed=2 hp=0.4 flags=Opened+Sealed look=hood:pointed;robe_dye:#335
 *   px=3                 pixel scale (1 = full res)
 *   yaw=0.5 cols=6 fov=22 focus=staff_ember (vm)
 *
 * Sets window.__ready once a frozen frame is on screen (scripts/model-sheet.ts). */

const q = new URLSearchParams(location.search);
const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d);

const GROUPS: Record<string, string[]> = {
  creatures: ["rat", "shambler", "wight", "sexton", "delver"],
  delver: ["delver"],
  props: ["crate", "crate_small", "barrel", "barrel_oil", "keg_powder", "urn", "bone_pile", "candelabrum", "oil_lamp", "coffin", "sarcophagus"],
  items: [
    "staff_apprentice", "staff_ember", "wand_rime", "rod_storm", "staff_void", "orb_venom",
    "relic_blink", "relic_grasp", "relic_ward", "hood_plain", "hood_chandler", "robe_plain", "robe_bone",
    "boots_plain", "boots_hare", "boots_moth", "amulet_bone", "amulet_tallow", "ring_iron", "ring_grave",
    "potion_red", "potion_blue", "flask_oil", "flask_fire", "bell_small", "mat_tallow", "mat_bone", "coin",
  ],
  fixtures: ["wall_torch", "candles", "brazier", "glow_fungus", "forge_glow", "cold_lantern", "rubble", "skull", "bones_niche"],
  traps: ["trap_spikes", "trap_dart", "trap_flame", "trap_collapse"],
  interactables: ["descent", "arrival", "chest", "reliquary", "note", "mercy_candle"],
};
/** Wall-mounted ids get a wall behind them (+Z in model space). */
const WALL = new Set(["wall_torch", "glow_fungus", "forge_glow", "cold_lantern", "trap_dart", "brazier"]);

buildMaterialArrays();
const canvas = document.getElementById("c") as HTMLCanvasElement;
const R = new Renderer(canvas);
R.settings.pixelScale = num("px", 1);
R.settings.lightDistance = 400;
R.resize();
R.setEnvironment({
  ...DEFAULT_ENV,
  ambientSky: q.get("sky") ?? "#34304a",
  ambientGround: "#16121a",
  ambientIntensity: num("amb", 1.8),
  fogDensity: num("fog", 0),
  vignette: 0.35,
  grain: 0,
});

const mode = q.get("mode") ?? "grid";
const anim = (Anim[(q.get("anim") ?? "Idle") as keyof typeof Anim] ?? Anim.Idle) as Anim;
const flags = (q.get("flags") ?? "")
  .split("+")
  .filter(Boolean)
  .reduce((f, n) => f | (Flag[n as keyof typeof Flag] ?? 0), 0);
const look: Record<string, string> = {};
for (const kv of (q.get("look") ?? "").split(";").filter(Boolean)) {
  const [k, v] = kv.split(":");
  look[k] = v;
}
const frozenAt = q.has("at") ? num("at", 0) : -1;
const defaultSpeed = anim === Anim.Walk ? 1.8 : anim === Anim.Run || anim === Anim.Flee ? 4.5 : 0;
const input: AnimInput = { anim, variant: num("variant", 0), animTime: 0, time: 0, dt: 1 / 60, speed: num("speed", defaultSpeed), hp: num("hp", 1), flags, statuses: [] };

interface Placed {
  id: string;
  m: ModelInstance;
  light: PointLight | null;
  label: HTMLDivElement;
  anchor: Vector3;
}
const placed: Placed[] = [];
const labels = document.getElementById("labels")!;
const title = document.getElementById("title")!;

function tris(o: Object3D): number {
  let n = 0;
  o.traverse((c) => {
    if (c instanceof Mesh) n += (c.geometry.index?.count ?? c.geometry.attributes.position.count) / 3;
  });
  return Math.round(n);
}

function slab(size: [number, number, number], at: [number, number, number], mat: string, tint?: string, uvm?: number): Mesh {
  const b = new MeshBuilder();
  b.box(size, { mat, tint, at, uvm });
  return new Mesh(b.build(), surfaceMaterial());
}

function addLight(p: [number, number, number], color: string, intensity: number, radius: number): PointLight {
  return R.lights.add({ position: p, color, intensity, radius, shadow: false, haze: 0, flicker: 0 });
}

function ids(): string[] {
  const yaws = q.get("yaws");
  if (yaws && q.has("ids")) return q.get("ids")!.split(",").flatMap((id) => yaws.split(",").map(() => id));
  if (q.has("ids")) return q.get("ids")!.split(",");
  const g = q.get("group") ?? "all";
  if (g === "all") return modelIds();
  return GROUPS[g] ?? modelIds().filter((id) => id.startsWith(g));
}

function makeLabel(text: string): HTMLDivElement {
  const d = document.createElement("div");
  d.innerHTML = text;
  labels.appendChild(d);
  return d;
}

function socketLight(m: ModelInstance): PointLight | null {
  const s = m.sockets?.light;
  if (!s) return null;
  return addLight([0, 0, 0], q.get("lightc") ?? "#ffb060", num("li", 1.2), num("lr", 3));
}

// ── layouts ──────────────────────────────────────────────────────────────────

function grid(list: string[]): void {
  const C = num("cell", 2.4);
  const cols = num("cols", Math.min(list.length, Math.ceil(Math.sqrt(list.length * 2.2))));
  const rows = Math.ceil(list.length / cols);
  const yaw = num("yaw", 0.55);
  list.forEach((id, i) => {
    const yawList = q.get("yaws")?.split(",").map(Number);
    const myYaw = yawList ? yawList[i % yawList.length] : yaw;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = (col - (cols - 1) / 2) * C;
    const y = ((rows - 1) / 2 - row) * C * 0.92;
    const m = createModel(id, { look, seed: 1 + i, flashable: true });
    m.animate({ ...input, animTime: 0 });
    m.root.updateMatrixWorld(true);
    const box = new Box3().setFromObject(m.root);
    const size = box.getSize(new Vector3());
    const scale = q.get("norm") === "0" ? 1 : (C * 0.72) / Math.max(size.y, size.x * 0.8, size.z * 0.8, 0.05);
    m.root.scale.setScalar(scale);
    m.root.rotation.y = Math.PI + myYaw;
    m.root.position.set(x, y - box.min.y * scale, 0);
    R.scene.add(m.root);
    R.scene.add(slab([C * 0.94, 0.08, C * 0.8], [x, y - 0.04, 0], "crypt.slab", "#8a8088", 1.2));
    if (WALL.has(id)) {
      const w = new MeshBuilder();
      const back = Math.PI + myYaw;
      w.box([C * 0.9, C * 0.85, 0.1], { mat: "crypt.brick", at: [0, C * 0.42, 0.05 * scale + 0.05], uvm: 1.5 });
      const mesh = new Mesh(w.build(), surfaceMaterial());
      mesh.position.set(x, y, 0);
      mesh.rotation.y = back;
      mesh.scale.set(1, 1, 1);
      // Wall plane sits at model-space z = +wallOffset, scaled with the model.
      mesh.position.x += Math.sin(back) * 0.08 * scale;
      mesh.position.z += Math.cos(back) * 0.08 * scale;
      R.scene.add(mesh);
    }
    const k = num("key", 1);
    addLight([x - C * 0.35, y + C * 0.8, C * 0.75], "#ffdcb0", 7 * k, C * 2.4);
    addLight([x + C * 0.55, y + C * 0.3, C * 0.5], "#8ea8ff", 2.2 * k, C * 1.8);
    addLight([x + C * 0.25, y + C * 0.9, -C * 0.6], "#ffb070", 3.5 * k, C * 1.8);
    const h = m.height;
    const label = makeLabel(`${id} <small>${h.toFixed(2)}m · ${tris(m.root)}▲</small>`);
    placed.push({ id, m, light: socketLight(m), label, anchor: new Vector3(x, y - 0.05, 0.45 * C) });
  });
  // Frame the camera on everything placed (labels included).
  const fov = num("fov", 24);
  const cam = R.camera;
  cam.fov = fov;
  const all = new Box3();
  for (const p of placed) {
    p.m.root.updateMatrixWorld(true);
    all.union(new Box3().setFromObject(p.m.root));
    all.expandByPoint(p.anchor);
  }
  const ctr = all.getCenter(new Vector3());
  const sz = all.getSize(new Vector3());
  const t = Math.tan(((fov / 2) * Math.PI) / 180);
  const D = Math.max((sz.y * 0.5 + 0.3) / t, (sz.x * 0.5 + 0.3) / (t * cam.aspect)) * 1.08 + sz.z * 0.5;
  cam.position.set(ctr.x, ctr.y + D * 0.14, ctr.z + D);
  cam.lookAt(ctr.x, ctr.y, ctr.z);
  cam.updateProjectionMatrix();
}

function scene(list: string[]): void {
  R.settings.pixelScale = num("px", 3);
  R.resize();
  R.setEnvironment({ ...R.environment, fogColor: "#07060a", fogDensity: num("fog", 0.05), ambientSky: "#2a2238", ambientIntensity: 0.55, vignette: 1.2 });
  const floor = new MeshBuilder();
  floor.box([24, 0.2, 24], { mat: "crypt.slab", at: [0, -0.1, -6] });
  floor.box([24, 5, 0.4], { mat: "crypt.brick", at: [0, 2.5, -14] });
  floor.box([0.4, 5, 24], { mat: "crypt.ossuary", at: [-6, 2.5, -6] });
  floor.box([0.4, 5, 24], { mat: "crypt.brick", at: [6, 2.5, -6] });
  R.scene.add(new Mesh(floor.build(), surfaceMaterial()));
  let x = -((list.length - 1) / 2) * 1.8;
  list.forEach((id, i) => {
    const m = createModel(id, { look, seed: 1 + i, flashable: true });
    const dist = num("dist", 5);
    m.root.position.set(x, 0, -dist - (i % 2) * 1.5);
    m.root.rotation.y = Math.PI + num("yaw", 0.4) * (i % 2 ? -1 : 1);
    R.scene.add(m.root);
    placed.push({ id, m, light: socketLight(m), label: makeLabel(""), anchor: new Vector3() });
    x += 1.8;
  });
  const torch = [
    [-5.6, 2.1, -3],
    [5.6, 2.1, -7],
    [-5.6, 2.1, -11],
    [0, 2.1, -13.6],
  ] as const;
  for (const p of torch) R.lights.add({ position: [p[0], p[1], p[2]], color: "#ff9a40", intensity: 2.6, radius: 8.5, flicker: 1, shadow: false, haze: 1 });
  R.camera.fov = 80;
  R.camera.position.set(0, 1.6, 2);
  R.camera.lookAt(0, 1.1, -6);
  R.camera.updateProjectionMatrix();
}

function viewmodel(): void {
  R.settings.pixelScale = num("px", 3);
  R.resize();
  const focus = q.get("focus") ?? "staff_apprentice";
  const m = buildViewmodel(focus);
  R.scene.add(m.root);
  R.camera.layers.enable(LAYER.VIEWMODEL);
  const wall = new MeshBuilder();
  wall.box([12, 6, 0.3], { mat: "crypt.brick", at: [0, 1, -4] });
  wall.box([12, 0.2, 12], { mat: "crypt.slab", at: [0, -1.6, -2] });
  R.scene.add(new Mesh(wall.build(), surfaceMaterial()));
  R.lights.add({ position: [-1.5, 1.2, -1.5], color: "#ff9a40", intensity: 2.4, radius: 7, flicker: 0.5, shadow: false, haze: 1 });
  R.camera.fov = 80;
  R.camera.position.set(0, 0, 0);
  R.camera.lookAt(0, 0, -1);
  R.camera.updateProjectionMatrix();
  placed.push({ id: focus, m, light: socketLight2(m), label: makeLabel(""), anchor: new Vector3() });
}

function socketLight2(m: ModelInstance): PointLight | null {
  return m.sockets?.tip ? addLight([0, 0, 0], q.get("lightc") ?? "#9fd8ff", 1.4, 3) : null;
}

// ── run ──────────────────────────────────────────────────────────────────────

const list = ids();
if (mode === "scene") scene(list);
else if (mode === "vm") viewmodel();
else grid(list);
title.textContent = `${mode} · ${q.get("group") ?? q.get("ids") ?? "all"} · anim ${Anim[anim]}${frozenAt >= 0 ? ` @${frozenAt}s` : ""}${input.variant ? ` v${input.variant}` : ""}${flags ? ` flags ${q.get("flags")}` : ""}`;

const tmp = new Vector3();
function step(time: number, dt: number, animTime: number): void {
  const s: AnimInput = { ...input, time, dt, animTime };
  for (const p of placed) {
    p.m.animate(s);
    const sock = p.m.sockets?.light ?? p.m.sockets?.tip;
    if (p.light && sock) {
      sock.updateWorldMatrix(true, false);
      sock.getWorldPosition(tmp);
      p.light.x = tmp.x;
      p.light.y = tmp.y;
      p.light.z = tmp.z;
    }
  }
}

function placeLabels(): void {
  for (const p of placed) {
    if (!p.label.innerHTML) continue;
    tmp.copy(p.anchor).project(R.camera);
    p.label.style.left = `${((tmp.x + 1) / 2) * innerWidth}px`;
    p.label.style.top = `${((1 - tmp.y) / 2) * innerHeight}px`;
  }
}

/** Live attack loop for interactive viewing. */
function liveAnimTime(t: number): number {
  if (anim === Anim.Dead) return t % 3;
  return t % 4;
}

const w = window as unknown as { __ready?: boolean; __stats?: unknown };
if (frozenAt >= 0) {
  const T = num("t", 2);
  const dt = 1 / 60;
  for (let time = 0; time <= T + 1e-6; time += dt) step(time, dt, Math.max(0, frozenAt - (T - time)));
  let frames = 0;
  const loop = () => {
    R.render(0);
    placeLabels();
    if (++frames === 3) {
      w.__stats = placed.map((p) => ({ id: p.id, tris: tris(p.m.root), height: p.m.height }));
      w.__ready = true;
    } else requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
} else {
  let last = performance.now();
  let t = 0;
  const loop = () => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    step(t, dt, liveAnimTime(t));
    R.render(dt);
    placeLabels();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  addEventListener("resize", () => R.resize());
  w.__ready = true;
}
