import { Group, Mesh, type Object3D } from "three";
import type { StatusId } from "../../../shared/content/types";
import { Anim } from "../../../shared/sim/entity";
import { ownSurfaceMaterial, surfaceMaterial } from "../../render/materials";
import { MeshBuilder, RigBuilder, resetRig, turn, type Rig } from "./kit";

/** Model registry: every model id used by content (creature.model,
 * prop.model, item.model, trap.model, fixtures, decor) maps to a factory
 * that builds a fresh, animatable instance. Model modules self-register on
 * import (gfx/models/index.ts imports them all). Unknown ids get a visible
 * placeholder so missing art is obvious but never fatal. */

/** Replicated state a model animates from each frame. */
export interface AnimInput {
  anim: Anim;
  variant: number;
  /** Seconds since `anim` last changed. */
  animTime: number;
  /** Global time (s) for idle motion. */
  time: number;
  dt: number;
  /** Horizontal speed (m/s). */
  speed: number;
  hp: number;
  flags: number;
  statuses: readonly StatusId[];
}

export interface ModelInstance {
  root: Object3D;
  /** Approximate height (name tags, hp bars, fx anchors). */
  height: number;
  animate(s: AnimInput): void;
  /** Named attachment points (e.g. "light", "hand", "mouth"). */
  sockets?: Record<string, Object3D>;
  /** Flash white/red on hit: 0..1 amount, colour. */
  flash?(amount: number, color?: [number, number, number]): void;
  dispose(): void;
}

export interface ModelOptions {
  /** Cosmetic / variant parameters (robe dye, hood style…). */
  look?: Record<string, string>;
  seed?: number;
  /** Uses a private material (hit flashes). Creatures do, props needn't. */
  flashable?: boolean;
}

export type ModelFactory = (opts: ModelOptions) => ModelInstance;

const factories = new Map<string, ModelFactory>();
const warned = new Set<string>();

export function registerModel(id: string, factory: ModelFactory): void {
  factories.set(id, factory);
}

export function hasModel(id: string): boolean {
  return factories.has(id);
}

/** Every registered id, in registration order (tooling: the model sheet). */
export function modelIds(): string[] {
  return [...factories.keys()];
}

export function createModel(id: string, opts: ModelOptions = {}): ModelInstance {
  const f = factories.get(id);
  if (f) return f(opts);
  if (!warned.has(id)) {
    warned.add(id);
    console.warn(`[models] no model "${id}" — using placeholder`);
  }
  return placeholder(opts);
}

/** Static (non-animated) model from a builder: props, decor, items. */
export function staticModel(build: (b: MeshBuilder) => void, opts: ModelOptions = {}, height = 1): ModelInstance {
  const b = new MeshBuilder();
  build(b);
  const geo = b.build();
  const mat = opts.flashable ? ownSurfaceMaterial() : surfaceMaterial();
  const g = new Group();
  const mesh = new Mesh(geo, mat);
  g.add(mesh);
  return {
    root: g,
    height,
    animate() {},
    flash: opts.flashable
      ? (a, c) => {
          const m = mat as ReturnType<typeof ownSurfaceMaterial>;
          m.uniforms.uFlash.value.set(c?.[0] ?? 1, c?.[1] ?? 1, c?.[2] ?? 1, a);
        }
      : undefined,
    dispose() {
      geo.dispose();
      if (opts.flashable) mat.dispose();
    },
  };
}

/** Helper for articulated models: builds the rig with a (private) material
 * and wires flash + dispose. `animate` receives the rig after resetRig(). */
export function rigModel(
  build: (r: RigBuilder) => void,
  animate: (rig: Rig, s: AnimInput) => void,
  opts: ModelOptions = {},
  sockets?: (rig: Rig) => Record<string, Object3D>,
): ModelInstance {
  const r = new RigBuilder();
  build(r);
  const mat = opts.flashable !== false ? ownSurfaceMaterial() : surfaceMaterial();
  const rig = r.build(mat);
  // The rig root is reset every frame (it may be animated, e.g. a death
  // topple), so hand out a holder the caller can place freely.
  const holder = new Group();
  holder.add(rig.root);
  return {
    root: holder,
    height: rig.height,
    animate(s) {
      resetRig(rig);
      animate(rig, s);
    },
    sockets: sockets?.(rig),
    flash(a, c) {
      const m = mat as ReturnType<typeof ownSurfaceMaterial>;
      if (m.uniforms.uFlash) m.uniforms.uFlash.value.set(c?.[0] ?? 1, c?.[1] ?? 1, c?.[2] ?? 1, a);
    },
    dispose() {
      for (const m of rig.meshes) m.geometry.dispose();
      if (mat !== surfaceMaterial()) mat.dispose();
    },
  };
}

/** Generic stand-in: a hunched cloaked shape with glowing eyes. */
function placeholder(opts: ModelOptions): ModelInstance {
  return rigModel(
    (r) => {
      r.root.cylinder(0.25, 0.35, 1.1, { mat: "cloth.burlap", at: [0, 0.55, 0], segments: 7 });
      const head = r.joint("head", "root", [0, 1.1, 0]);
      head.sphere(0.2, { mat: "cloth.burlap", at: [0, 1.25, 0] });
      head.sphere(0.04, { mat: "eye.glow", at: [-0.07, 1.27, -0.17], emit: 3 });
      head.sphere(0.04, { mat: "eye.glow", at: [0.07, 1.27, -0.17], emit: 3 });
    },
    (rig, s) => {
      turn(rig.nodes.get("head"), Math.sin(s.time * 1.3) * 0.1, Math.sin(s.time * 0.7) * 0.3);
      if (s.anim === Anim.Dead) rig.root.rotation.x = -Math.PI / 2;
    },
    opts,
  );
}
