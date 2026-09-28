import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CapsuleGeometry,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  ExtrudeGeometry,
  Group,
  LatheGeometry,
  Matrix3,
  Matrix4,
  Mesh,
  Object3D,
  Quaternion,
  Shape,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  type Material,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { layerOf, worldSizeOf } from "../textures/library";

/** The procedural model kit.
 *
 * Every mesh in the game — creatures, props, architecture details, the
 * wizard, the Colossus — is authored in code by composing primitives with a
 * `MeshBuilder`. Each primitive carries a *material id* (see
 * gfx/textures/MATERIALS.md), an optional colour tint and an optional extra
 * glow; the builder bakes them into vertex attributes so a whole model is one
 * geometry drawn with the shared deferred surface material:
 *
 *   position, normal, uv   standard
 *   aLayer                 texture-array layer of the material
 *   aTint                  linear RGB multiplier on albedo (default white)
 *   aEmit                  extra self-illumination (albedo × tint × aEmit)
 *
 * UVs default to *box projection in model space* (metres / material world
 * size), so texel density is consistent across parts of any size and
 * textures never stretch. Pass `uvm` (metres per texture repeat) to get finer
 * or coarser detail on a part.
 *
 * Articulated models use a `RigBuilder`: named nodes with pivots, each owning
 * a MeshBuilder; everything is authored in *model space* and the rig converts
 * to parent-relative transforms. Procedural animation then just rotates
 * nodes. */

export type T3 = [number, number, number];
export type RGB = [number, number, number];

/** Placement of a primitive relative to the current transform. */
export interface Xf {
  at?: T3;
  /** Euler XYZ, radians. */
  rot?: T3;
  scale?: T3 | number;
}

/** Surface description of a primitive. */
export interface Surf {
  mat: string;
  /** "#rrggbb" (sRGB) or linear RGB multiplier. */
  tint?: string | RGB;
  emit?: number;
  /** Metres covered by one texture repeat (default: the material's). */
  uvm?: number;
  /** "box" (default) projects UVs from model-space position; "native"
   * keeps the primitive's own 0..1 UVs × `uvRepeat`. */
  uv?: "box" | "native";
  uvRepeat?: [number, number];
  /** Faceted shading (per-face normals) — reads well at low resolution. */
  flat?: boolean;
}

export type PartOpts = Surf & Xf;

const tmpV = new Vector3();
const tmpN = new Vector3();
const tmpM = new Matrix4();
const tmpQ = new Quaternion();
const tmpE = new Euler();
const tmpS = new Vector3();
const nrmMat = new Matrix3();

function tintOf(t: string | RGB | undefined): RGB {
  if (!t) return [1, 1, 1];
  if (typeof t === "string") {
    const c = new Color(t); // three converts hex from sRGB to linear working space
    return [c.r, c.g, c.b];
  }
  return t;
}

function xfMatrix(xf: Xf, out: Matrix4): Matrix4 {
  const at = xf.at ?? [0, 0, 0];
  const rot = xf.rot ?? [0, 0, 0];
  const sc = xf.scale ?? 1;
  tmpE.set(rot[0], rot[1], rot[2], "XYZ");
  tmpQ.setFromEuler(tmpE);
  if (typeof sc === "number") tmpS.set(sc, sc, sc);
  else tmpS.set(sc[0], sc[1], sc[2]);
  return out.compose(tmpV.set(at[0], at[1], at[2]), tmpQ, tmpS);
}

export class MeshBuilder {
  private pos: number[] = [];
  private nrm: number[] = [];
  private uvs: number[] = [];
  private layer: number[] = [];
  private tint: number[] = [];
  private emit: number[] = [];
  private index: number[] = [];
  private stack: Matrix4[] = [new Matrix4()];

  get vertexCount(): number {
    return this.pos.length / 3;
  }

  get isEmpty(): boolean {
    return this.pos.length === 0;
  }

  // ── transform stack ──────────────────────────────────────────────────────

  /** Push a transform; subsequent primitives are placed inside it. */
  push(xf: Xf): this {
    const m = xfMatrix(xf, new Matrix4());
    this.stack.push(this.top.clone().multiply(m));
    return this;
  }

  pop(): this {
    if (this.stack.length > 1) this.stack.pop();
    return this;
  }

  /** Run `fn` inside a transform. */
  group(xf: Xf, fn: (b: this) => void): this {
    this.push(xf);
    fn(this);
    return this.pop();
  }

  /** Repeat `fn` n times around the Y axis (columns, legs, spikes…). */
  radial(n: number, fn: (b: this, i: number, angle: number) => void, phase = 0): this {
    for (let i = 0; i < n; i++) {
      const a = phase + (i / n) * Math.PI * 2;
      this.push({ rot: [0, a, 0] });
      fn(this, i, a);
      this.pop();
    }
    return this;
  }

  /** Mirror `fn` across the X axis (left/right symmetric parts). */
  mirrorX(fn: (b: this, side: 1 | -1) => void): this {
    fn(this, 1);
    this.push({ scale: [-1, 1, 1] });
    fn(this, -1);
    return this.pop();
  }

  private get top(): Matrix4 {
    return this.stack[this.stack.length - 1];
  }

  // ── primitives ───────────────────────────────────────────────────────────

  /** Box of full size [w,h,d] centred at `at`. `bevel` rounds the edges. */
  box(size: T3, o: PartOpts & { bevel?: number }): this {
    const g =
      o.bevel && o.bevel > 0
        ? new RoundedBoxGeometry(size[0], size[1], size[2], 1, Math.min(o.bevel, Math.min(...size) / 2 - 1e-4))
        : new BoxGeometry(size[0], size[1], size[2]);
    return this.add(g, o);
  }

  /** Cylinder along Y, centred. */
  cylinder(
    radiusTop: number,
    radiusBottom: number,
    height: number,
    o: PartOpts & { segments?: number; open?: boolean; heightSegments?: number },
  ): this {
    return this.add(
      new CylinderGeometry(radiusTop, radiusBottom, height, o.segments ?? 8, o.heightSegments ?? 1, o.open ?? false),
      o,
    );
  }

  cone(radius: number, height: number, o: PartOpts & { segments?: number }): this {
    return this.add(new ConeGeometry(radius, height, o.segments ?? 8), o);
  }

  /** Sphere; `squash` scales it into an ellipsoid. */
  sphere(radius: number, o: PartOpts & { segments?: number; rings?: number; squash?: T3 }): this {
    const g = new SphereGeometry(radius, o.segments ?? 10, o.rings ?? 7);
    if (o.squash) g.scale(o.squash[0], o.squash[1], o.squash[2]);
    return this.add(g, o);
  }

  /** Capsule along Y: `length` is the straight section. */
  capsule(radius: number, length: number, o: PartOpts & { segments?: number }): this {
    return this.add(new CapsuleGeometry(radius, length, 3, o.segments ?? 8), o);
  }

  torus(radius: number, tube: number, o: PartOpts & { radial?: number; tubular?: number; arc?: number }): this {
    return this.add(new TorusGeometry(radius, tube, o.radial ?? 6, o.tubular ?? 16, o.arc ?? Math.PI * 2), o);
  }

  /** Surface of revolution around Y from a [radius, y] profile (bottom→top):
   * urns, candles, pillars, bells, mushroom caps. */
  lathe(profile: [number, number][], o: PartOpts & { segments?: number }): this {
    const pts = profile.map(([r, y]) => new Vector2(Math.max(r, 0.0001), y));
    return this.add(new LatheGeometry(pts, o.segments ?? 12), o);
  }

  /** Tube along a smooth path: tails, tentacles, roots, chains, horns.
   * `radius` may be a function of t∈[0,1] for tapering. */
  tube(
    path: T3[],
    radius: number | ((t: number) => number),
    o: PartOpts & { segments?: number; radial?: number; closed?: boolean },
  ): this {
    const curve = new CatmullRomCurve3(path.map((p) => new Vector3(p[0], p[1], p[2])), o.closed ?? false);
    const segs = o.segments ?? Math.max(4, path.length * 4);
    const radial = o.radial ?? 6;
    const g = new TubeGeometry(curve, segs, typeof radius === "number" ? radius : 1, radial, o.closed ?? false);
    if (typeof radius === "function") {
      // Re-scale each ring around its centre point on the curve.
      const p = g.attributes.position as BufferAttribute;
      const c = new Vector3();
      for (let s = 0; s <= segs; s++) {
        const t = s / segs;
        curve.getPointAt(t, c);
        const r = radius(t);
        for (let k = 0; k <= radial; k++) {
          const vi = s * (radial + 1) + k;
          tmpV.fromBufferAttribute(p, vi).sub(c).multiplyScalar(r).add(c);
          p.setXYZ(vi, tmpV.x, tmpV.y, tmpV.z);
        }
      }
      g.computeVertexNormals();
    }
    return this.add(g, o);
  }

  /** Extruded 2D polygon (XY plane, extruded along +Z by `depth`, centred):
   * blades, gears, sigils, arch outlines. */
  extrude(shape: [number, number][], depth: number, o: PartOpts & { bevel?: number; holes?: [number, number][][] }): this {
    const s = new Shape(shape.map(([x, y]) => new Vector2(x, y)));
    for (const h of o.holes ?? []) s.holes.push(new Shape(h.map(([x, y]) => new Vector2(x, y))));
    const g = new ExtrudeGeometry(s, {
      depth,
      bevelEnabled: !!o.bevel,
      bevelSize: o.bevel ?? 0,
      bevelThickness: o.bevel ?? 0,
      bevelSegments: 1,
      curveSegments: 6,
    });
    g.translate(0, 0, -depth / 2);
    return this.add(g, o);
  }

  /** Single quad from 4 corners (counter-clockwise when seen from the front). */
  quad(c: [T3, T3, T3, T3], o: PartOpts): this {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(c.flat()), 3));
    g.setAttribute("uv", new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.computeVertexNormals();
    return this.add(g, { ...o, uv: o.uv ?? "native" });
  }

  /** Append any three.js geometry with a surface. */
  add(geometry: BufferGeometry, o: PartOpts): this {
    let g = geometry;
    if (o.flat) {
      g = g.index ? g.toNonIndexed() : g;
      g.computeVertexNormals();
    }
    const m = this.top.clone().multiply(xfMatrix(o, tmpM));
    nrmMat.getNormalMatrix(m);
    const P = g.attributes.position as BufferAttribute;
    const N = g.attributes.normal as BufferAttribute | undefined;
    const UV = g.attributes.uv as BufferAttribute | undefined;
    const base = this.pos.length / 3;
    const layer = layerOf(o.mat);
    const tint = tintOf(o.tint);
    const emit = o.emit ?? 0;
    const uvm = o.uvm ?? worldSizeOf(o.mat);
    const boxUV = (o.uv ?? "box") === "box" || !UV;
    const rep = o.uvRepeat ?? [1, 1];

    for (let i = 0; i < P.count; i++) {
      tmpV.fromBufferAttribute(P, i).applyMatrix4(m);
      if (N) tmpN.fromBufferAttribute(N, i).applyMatrix3(nrmMat).normalize();
      else tmpN.set(0, 1, 0);
      this.pos.push(tmpV.x, tmpV.y, tmpV.z);
      this.nrm.push(tmpN.x, tmpN.y, tmpN.z);
      if (boxUV) {
        const ax = Math.abs(tmpN.x);
        const ay = Math.abs(tmpN.y);
        const az = Math.abs(tmpN.z);
        let u: number;
        let v: number;
        if (ay >= ax && ay >= az) {
          u = tmpV.x;
          v = tmpV.z * Math.sign(tmpN.y || 1);
        } else if (ax >= az) {
          u = -tmpV.z * Math.sign(tmpN.x || 1);
          v = tmpV.y;
        } else {
          u = tmpV.x * Math.sign(tmpN.z || 1);
          v = tmpV.y;
        }
        this.uvs.push(u / uvm, v / uvm);
      } else {
        this.uvs.push(UV!.getX(i) * rep[0], UV!.getY(i) * rep[1]);
      }
      this.layer.push(layer);
      this.tint.push(tint[0], tint[1], tint[2]);
      this.emit.push(emit);
    }

    // Negative-determinant transforms (mirrors) flip winding.
    const flip = m.determinant() < 0;
    if (g.index) {
      const idx = g.index.array;
      for (let i = 0; i < idx.length; i += 3) {
        if (flip) this.index.push(base + idx[i], base + idx[i + 2], base + idx[i + 1]);
        else this.index.push(base + idx[i], base + idx[i + 1], base + idx[i + 2]);
      }
    } else {
      for (let i = 0; i < P.count; i += 3) {
        if (flip) this.index.push(base + i, base + i + 2, base + i + 1);
        else this.index.push(base + i, base + i + 1, base + i + 2);
      }
    }
    if (g !== geometry) g.dispose();
    geometry.dispose();
    return this;
  }

  /** Merge another builder's output (already in its own model space). */
  merge(other: MeshBuilder, xf: Xf = {}): this {
    if (other.isEmpty) return this;
    return this.add(other.build(), { mat: "missing", ...xf, uv: "native" }).retag(other);
  }

  /** After merge(): restore the merged vertices' own layer/tint/emit/uv. */
  private retag(other: MeshBuilder): this {
    const n = other.vertexCount;
    const start = this.vertexCount - n;
    for (let i = 0; i < n; i++) {
      this.layer[start + i] = other.layer[i];
      this.emit[start + i] = other.emit[i];
      this.tint[(start + i) * 3] = other.tint[i * 3];
      this.tint[(start + i) * 3 + 1] = other.tint[i * 3 + 1];
      this.tint[(start + i) * 3 + 2] = other.tint[i * 3 + 2];
      this.uvs[(start + i) * 2] = other.uvs[i * 2];
      this.uvs[(start + i) * 2 + 1] = other.uvs[i * 2 + 1];
    }
    return this;
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute("normal", new BufferAttribute(new Float32Array(this.nrm), 3));
    g.setAttribute("uv", new BufferAttribute(new Float32Array(this.uvs), 2));
    g.setAttribute("aLayer", new BufferAttribute(new Float32Array(this.layer), 1));
    g.setAttribute("aTint", new BufferAttribute(new Float32Array(this.tint), 3));
    g.setAttribute("aEmit", new BufferAttribute(new Float32Array(this.emit), 1));
    const vcount = this.pos.length / 3;
    g.setIndex(vcount > 65535 ? new BufferAttribute(new Uint32Array(this.index), 1) : new BufferAttribute(new Uint16Array(this.index), 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

// ── Rigs (articulated models) ───────────────────────────────────────────────

export interface Rig {
  root: Group;
  /** Named joints. Animate by rotating/translating these. */
  nodes: Map<string, Object3D>;
  /** Rest transforms (for procedural animation to offset from). */
  rest: Map<string, { position: Vector3; quaternion: Quaternion }>;
  /** Meshes (for material swaps like hit flashes). */
  meshes: Mesh[];
  /** Model-space height of the tallest point — used for name tags, hp bars. */
  height: number;
}

interface NodeSpec {
  name: string;
  parent: string | null;
  pivot: T3;
  builder: MeshBuilder;
}

export class RigBuilder {
  private nodes = new Map<string, NodeSpec>();

  constructor() {
    this.nodes.set("root", { name: "root", parent: null, pivot: [0, 0, 0], builder: new MeshBuilder() });
  }

  /** The builder of an existing node (author geometry in MODEL space). */
  part(name: string): MeshBuilder {
    const n = this.nodes.get(name);
    if (!n) throw new Error(`rig node "${name}" not defined`);
    return n.builder;
  }

  /** Define a joint at `pivot` (model space) under `parent`. Returns its
   * builder; geometry added to it is authored in model space too. */
  joint(name: string, parent: string, pivot: T3): MeshBuilder {
    if (!this.nodes.has(parent)) throw new Error(`rig parent "${parent}" not defined`);
    const b = new MeshBuilder();
    // Geometry is authored in model space: shift it into the joint's frame.
    b.push({ at: [-pivot[0], -pivot[1], -pivot[2]] });
    this.nodes.set(name, { name, parent, pivot, builder: b });
    return b;
  }

  get root(): MeshBuilder {
    return this.part("root");
  }

  build(material: Material): Rig {
    const objects = new Map<string, Object3D>();
    const rest = new Map<string, { position: Vector3; quaternion: Quaternion }>();
    const meshes: Mesh[] = [];
    const root = new Group();
    let maxY = 0;
    for (const spec of this.nodes.values()) {
      const obj = spec.parent === null ? root : new Group();
      obj.name = spec.name;
      if (spec.parent !== null) {
        const parentPivot = this.nodes.get(spec.parent)!.pivot;
        obj.position.set(spec.pivot[0] - parentPivot[0], spec.pivot[1] - parentPivot[1], spec.pivot[2] - parentPivot[2]);
        objects.get(spec.parent)!.add(obj);
      }
      if (!spec.builder.isEmpty) {
        const geo = spec.builder.build();
        const mesh = new Mesh(geo, material);
        mesh.name = `${spec.name}.mesh`;
        obj.add(mesh);
        meshes.push(mesh);
        if (geo.boundingBox) maxY = Math.max(maxY, geo.boundingBox.max.y + spec.pivot[1]);
      }
      objects.set(spec.name, obj);
      rest.set(spec.name, { position: obj.position.clone(), quaternion: obj.quaternion.clone() });
    }
    return { root, nodes: objects, rest, meshes, height: maxY };
  }
}

/** Reset every node of a rig to its rest pose (call before layering
 * procedural animation offsets each frame). */
export function resetRig(rig: Rig): void {
  for (const [name, obj] of rig.nodes) {
    const r = rig.rest.get(name)!;
    obj.position.copy(r.position);
    obj.quaternion.copy(r.quaternion);
  }
}

const axisX = new Vector3(1, 0, 0);
const axisY = new Vector3(0, 1, 0);
const axisZ = new Vector3(0, 0, 1);
const qTmp = new Quaternion();

/** Rotate a node relative to its current orientation (radians). */
export function turn(node: Object3D | undefined, x: number, y = 0, z = 0): void {
  if (!node) return;
  if (x) node.quaternion.multiply(qTmp.setFromAxisAngle(axisX, x));
  if (y) node.quaternion.multiply(qTmp.setFromAxisAngle(axisY, y));
  if (z) node.quaternion.multiply(qTmp.setFromAxisAngle(axisZ, z));
}
