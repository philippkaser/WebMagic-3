import { BufferAttribute, BufferGeometry, Mesh, Vector3, type Camera } from "three";
import { LAYER } from "../render/Renderer";
import { forwardMaterial } from "../render/materials";

/** Camera-facing ribbons for beams and lightning: each bolt is a jittered
 * polyline re-randomised a few times per second, drawn additively. */

interface Bolt {
  pts: Vector3[];
  color: [number, number, number];
  width: number;
  life: number;
  max: number;
  jitter: number;
  seed: number;
}

const MAX_SEGMENTS = 2048;

const VERT = /* glsl */ `
in vec3 aColor;
out vec3 vColor;
out vec2 vUv;
out float vViewDepth;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  vColor = aColor;
  vUv = uv;
  vViewDepth = -mv.z;
}
`;

const FRAG = /* glsl */ `
in vec3 vColor;
in vec2 vUv;
in float vViewDepth;
layout(location = 0) out vec4 outColor;
void main() {
  float core = 1.0 - abs(vUv.y * 2.0 - 1.0);
  float a = pow(core, 1.5) * (1.0 - fogFactor(vViewDepth));
  outColor = vec4(vColor * a, 1.0);
}
`;

export class Bolts {
  readonly mesh: Mesh;
  private bolts: Bolt[] = [];
  private geo = new BufferGeometry();
  private pos = new Float32Array(MAX_SEGMENTS * 4 * 3);
  private col = new Float32Array(MAX_SEGMENTS * 4 * 3);
  private uv = new Float32Array(MAX_SEGMENTS * 4 * 2);
  private tmpA = new Vector3();
  private tmpB = new Vector3();
  private side = new Vector3();
  private toCam = new Vector3();

  constructor() {
    const idx = new Uint32Array(MAX_SEGMENTS * 6);
    for (let s = 0; s < MAX_SEGMENTS; s++) {
      const b = s * 4;
      idx.set([b, b + 1, b + 2, b, b + 2, b + 3], s * 6);
    }
    this.geo.setAttribute("position", new BufferAttribute(this.pos, 3));
    this.geo.setAttribute("aColor", new BufferAttribute(this.col, 3));
    this.geo.setAttribute("uv", new BufferAttribute(this.uv, 2));
    this.geo.setIndex(new BufferAttribute(idx, 1));
    this.mesh = new Mesh(this.geo, forwardMaterial({ vertexShader: VERT, fragmentShader: FRAG, blending: "add", doubleSided: true }));
    this.mesh.frustumCulled = false;
    this.mesh.layers.set(LAYER.FORWARD);
    this.mesh.renderOrder = 30;
  }

  /** Add a bolt along points (flattened xyz). */
  add(points: number[], color: [number, number, number], opts: { width?: number; life?: number; jitter?: number } = {}): void {
    const pts: Vector3[] = [];
    for (let i = 0; i + 2 < points.length; i += 3) pts.push(new Vector3(points[i], points[i + 1], points[i + 2]));
    if (pts.length < 2) return;
    this.bolts.push({ pts, color, width: opts.width ?? 0.08, life: opts.life ?? 0.15, max: opts.life ?? 0.15, jitter: opts.jitter ?? 0.25, seed: Math.random() * 100 });
  }

  update(dt: number, camera: Camera): void {
    let seg = 0;
    const keep: Bolt[] = [];
    for (const b of this.bolts) {
      b.life -= dt;
      if (b.life <= 0) continue;
      keep.push(b);
      const fade = b.life / b.max;
      const t = Math.floor((b.seed + performance.now() / 45) % 1000);
      for (let k = 0; k + 1 < b.pts.length; k++) {
        const a = b.pts[k];
        const c = b.pts[k + 1];
        const len = a.distanceTo(c);
        const n = Math.max(1, Math.min(24, Math.ceil(len / 0.5)));
        let prev = this.tmpA.copy(a);
        for (let s = 1; s <= n && seg < MAX_SEGMENTS; s++) {
          const u = s / n;
          const next = this.tmpB.copy(a).lerp(c, u);
          if (s < n && b.jitter > 0) {
            const h = Math.sin((t + s * 12.9898 + k * 78.233) * 43758.5453);
            next.x += (h - Math.floor(h) - 0.5) * b.jitter;
            next.y += (Math.sin(h * 91.7) * 0.5) * b.jitter;
            next.z += (Math.cos(h * 57.3) * 0.5) * b.jitter;
          }
          this.writeSegment(seg++, prev, next, b.width, b.color, fade, camera);
          prev = this.tmpA.copy(next);
        }
      }
    }
    this.bolts = keep;
    this.geo.setDrawRange(0, seg * 6);
    (this.geo.attributes.position as BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aColor as BufferAttribute).needsUpdate = true;
    (this.geo.attributes.uv as BufferAttribute).needsUpdate = true;
  }

  private writeSegment(s: number, a: Vector3, b: Vector3, w: number, c: [number, number, number], fade: number, camera: Camera): void {
    this.toCam.copy(camera.position).sub(a);
    this.side.copy(b).sub(a).cross(this.toCam).normalize().multiplyScalar(w * 0.5);
    const p = this.pos;
    const o = s * 12;
    p[o] = a.x - this.side.x;
    p[o + 1] = a.y - this.side.y;
    p[o + 2] = a.z - this.side.z;
    p[o + 3] = b.x - this.side.x;
    p[o + 4] = b.y - this.side.y;
    p[o + 5] = b.z - this.side.z;
    p[o + 6] = b.x + this.side.x;
    p[o + 7] = b.y + this.side.y;
    p[o + 8] = b.z + this.side.z;
    p[o + 9] = a.x + this.side.x;
    p[o + 10] = a.y + this.side.y;
    p[o + 11] = a.z + this.side.z;
    for (let k = 0; k < 4; k++) {
      this.col[o + k * 3] = c[0] * fade;
      this.col[o + k * 3 + 1] = c[1] * fade;
      this.col[o + k * 3 + 2] = c[2] * fade;
    }
    const u = s * 8;
    this.uv.set([0, 0, 1, 0, 1, 1, 0, 1], u);
  }
}
