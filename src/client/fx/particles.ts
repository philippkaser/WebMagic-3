import {
  DataTexture,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  PlaneGeometry,
  RGBAFormat,
  UnsignedByteType,
  type Texture,
} from "three";
import { LAYER } from "../render/Renderer";
import { forwardMaterial } from "../render/materials";

/** Pooled GPU particles: one instanced draw call per blend mode, a ring
 * buffer allocator, CPU integration (gravity, drag, curl-ish turbulence,
 * floor bounce), soft depth fade and fog in the shader. Sprites come from
 * the procedural sprite atlas (gfx/textures/sprites.ts). */

export interface ParticleSpawn {
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
  life: number;
  size: number;
  /** End size (defaults to size). */
  size1?: number;
  /** Linear RGB (may exceed 1 for HDR glow). */
  r: number;
  g: number;
  b: number;
  alpha?: number;
  gravity?: number;
  drag?: number;
  sprite?: string;
  /** Random spin speed (rad/s). */
  spin?: number;
  /** Turbulence amplitude (m/s²). */
  turb?: number;
  /** Additive (glowy) vs alpha (smoke, dust, blood). */
  additive?: boolean;
  /** Stops at this floor height (splats) — undefined = no floor. */
  floor?: number;
}

const VERT = /* glsl */ `
in vec3 iPos;
in vec4 iColor;
in vec4 iRect;
in vec2 iSizeRot;
out vec2 vUv;
out vec4 vColor;
out float vViewDepth;
void main() {
  vec4 mv = viewMatrix * vec4(iPos, 1.0);
  float c = cos(iSizeRot.y), s = sin(iSizeRot.y);
  vec2 corner = vec2(c * position.x - s * position.y, s * position.x + c * position.y);
  mv.xy += corner * iSizeRot.x;
  gl_Position = projectionMatrix * mv;
  vUv = mix(iRect.xy, iRect.zw, uv);
  vColor = iColor;
  vViewDepth = -mv.z;
}
`;

const FRAG = /* glsl */ `
uniform sampler2D uAtlas;
in vec2 vUv;
in vec4 vColor;
in float vViewDepth;
layout(location = 0) out vec4 outColor;
void main() {
  vec4 t = texture(uAtlas, vUv);
  float soft = softEdge(vViewDepth, 0.25);
  float fog = fogFactor(vViewDepth);
  vec4 c = vec4(t.rgb * vColor.rgb, t.a * vColor.a * soft);
  #ifdef ADDITIVE
    c.rgb *= c.a * (1.0 - fog);
    outColor = vec4(c.rgb, 1.0);
  #else
    c.rgb = mix(c.rgb, uFogColor, fog);
    if (c.a < 0.01) discard;
    outColor = c;
  #endif
}
`;

class Pool {
  readonly capacity: number;
  readonly mesh: Mesh;
  private pos: Float32Array;
  private vel: Float32Array;
  private col: Float32Array;
  private rect: Float32Array;
  private sizeRot: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private size0: Float32Array;
  private size1: Float32Array;
  private alpha0: Float32Array;
  private gravity: Float32Array;
  private drag: Float32Array;
  private spin: Float32Array;
  private turb: Float32Array;
  private floorY: Float32Array;
  private aPos: InstancedBufferAttribute;
  private aCol: InstancedBufferAttribute;
  private aRect: InstancedBufferAttribute;
  private aSizeRot: InstancedBufferAttribute;
  private next = 0;
  private alive = 0;
  private geo: InstancedBufferGeometry;

  constructor(capacity: number, atlas: Texture, additive: boolean) {
    this.capacity = capacity;
    const n = capacity;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.col = new Float32Array(n * 4);
    this.rect = new Float32Array(n * 4);
    this.sizeRot = new Float32Array(n * 2);
    this.life = new Float32Array(n);
    this.maxLife = new Float32Array(n);
    this.size0 = new Float32Array(n);
    this.size1 = new Float32Array(n);
    this.alpha0 = new Float32Array(n);
    this.gravity = new Float32Array(n);
    this.drag = new Float32Array(n);
    this.spin = new Float32Array(n);
    this.turb = new Float32Array(n);
    this.floorY = new Float32Array(n).fill(-1e9);
    const quad = new PlaneGeometry(1, 1);
    const geo = new InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute("position", quad.getAttribute("position"));
    geo.setAttribute("uv", quad.getAttribute("uv"));
    this.aPos = new InstancedBufferAttribute(new Float32Array(n * 3), 3);
    this.aCol = new InstancedBufferAttribute(new Float32Array(n * 4), 4);
    this.aRect = new InstancedBufferAttribute(new Float32Array(n * 4), 4);
    this.aSizeRot = new InstancedBufferAttribute(new Float32Array(n * 2), 2);
    for (const a of [this.aPos, this.aCol, this.aRect, this.aSizeRot]) a.setUsage(35048 /* DynamicDraw */);
    geo.setAttribute("iPos", this.aPos);
    geo.setAttribute("iColor", this.aCol);
    geo.setAttribute("iRect", this.aRect);
    geo.setAttribute("iSizeRot", this.aSizeRot);
    geo.instanceCount = 0;
    this.geo = geo;
    const mat = forwardMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uAtlas: { value: atlas } },
      blending: additive ? "add" : "alpha",
      doubleSided: true,
    });
    if (additive) mat.defines = { ADDITIVE: 1 };
    this.mesh = new Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.layers.set(LAYER.FORWARD);
    this.mesh.renderOrder = additive ? 20 : 10;
  }

  spawn(p: ParticleSpawn, rect: [number, number, number, number]): void {
    const i = this.next;
    this.next = (this.next + 1) % this.capacity;
    this.pos[i * 3] = p.x;
    this.pos[i * 3 + 1] = p.y;
    this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = p.vx ?? 0;
    this.vel[i * 3 + 1] = p.vy ?? 0;
    this.vel[i * 3 + 2] = p.vz ?? 0;
    this.col[i * 4] = p.r;
    this.col[i * 4 + 1] = p.g;
    this.col[i * 4 + 2] = p.b;
    this.alpha0[i] = p.alpha ?? 1;
    this.rect.set(rect, i * 4);
    this.life[i] = p.life;
    this.maxLife[i] = p.life;
    this.size0[i] = p.size;
    this.size1[i] = p.size1 ?? p.size;
    this.gravity[i] = p.gravity ?? 0;
    this.drag[i] = p.drag ?? 0;
    this.spin[i] = (Math.random() - 0.5) * 2 * (p.spin ?? 0);
    this.sizeRot[i * 2 + 1] = Math.random() * Math.PI * 2;
    this.turb[i] = p.turb ?? 0;
    this.floorY[i] = p.floor ?? -1e9;
  }

  update(dt: number, time: number): void {
    let n = 0;
    const P = this.aPos.array as Float32Array;
    const C = this.aCol.array as Float32Array;
    const R = this.aRect.array as Float32Array;
    const S = this.aSizeRot.array as Float32Array;
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) continue;
      const k = 1 - this.life[i] / this.maxLife[i];
      const d = Math.exp(-this.drag[i] * dt);
      let vx = this.vel[i * 3] * d;
      let vy = this.vel[i * 3 + 1] * d + this.gravity[i] * dt;
      let vz = this.vel[i * 3 + 2] * d;
      if (this.turb[i] > 0) {
        const px = this.pos[i * 3];
        const pz = this.pos[i * 3 + 2];
        vx += Math.sin(time * 2.1 + pz * 1.7 + i) * this.turb[i] * dt;
        vz += Math.cos(time * 1.9 + px * 1.3 + i * 0.7) * this.turb[i] * dt;
        vy += Math.sin(time * 1.3 + i * 1.1) * this.turb[i] * 0.5 * dt;
      }
      let y = this.pos[i * 3 + 1] + vy * dt;
      if (y < this.floorY[i]) {
        y = this.floorY[i];
        vy = -vy * 0.2;
        vx *= 0.5;
        vz *= 0.5;
      }
      this.vel[i * 3] = vx;
      this.vel[i * 3 + 1] = vy;
      this.vel[i * 3 + 2] = vz;
      this.pos[i * 3] += vx * dt;
      this.pos[i * 3 + 1] = y;
      this.pos[i * 3 + 2] += vz * dt;
      this.sizeRot[i * 2 + 1] += this.spin[i] * dt;

      P[n * 3] = this.pos[i * 3];
      P[n * 3 + 1] = this.pos[i * 3 + 1];
      P[n * 3 + 2] = this.pos[i * 3 + 2];
      // Fade in fast, out slow.
      const fade = Math.min(1, k * 8) * (1 - k * k);
      C[n * 4] = this.col[i * 4];
      C[n * 4 + 1] = this.col[i * 4 + 1];
      C[n * 4 + 2] = this.col[i * 4 + 2];
      C[n * 4 + 3] = this.alpha0[i] * fade;
      R[n * 4] = this.rect[i * 4];
      R[n * 4 + 1] = this.rect[i * 4 + 1];
      R[n * 4 + 2] = this.rect[i * 4 + 2];
      R[n * 4 + 3] = this.rect[i * 4 + 3];
      S[n * 2] = this.size0[i] + (this.size1[i] - this.size0[i]) * k;
      S[n * 2 + 1] = this.sizeRot[i * 2 + 1];
      n++;
    }
    this.alive = n;
    this.geo.instanceCount = n;
    for (const a of [this.aPos, this.aCol, this.aRect, this.aSizeRot]) {
      a.clearUpdateRanges();
      a.addUpdateRange(0, n * a.itemSize);
      a.needsUpdate = true;
    }
  }

  get count(): number {
    return this.alive;
  }
}

export class Particles {
  private add: Pool;
  private alpha: Pool;
  private rects: Map<string, [number, number, number, number]>;
  private fallbackRect: [number, number, number, number];

  constructor(atlas: { texture: Texture; rects: Map<string, [number, number, number, number]> } | null) {
    const tex = atlas?.texture ?? softDot();
    this.rects = atlas?.rects ?? new Map();
    this.fallbackRect = this.rects.get("glow") ?? [0, 0, 1, 1];
    this.add = new Pool(6000, tex, true);
    this.alpha = new Pool(3000, tex, false);
  }

  get objects(): Mesh[] {
    return [this.alpha.mesh, this.add.mesh];
  }

  rect(sprite?: string): [number, number, number, number] {
    if (!sprite) return this.fallbackRect;
    // Variants: "smoke" picks smoke0..smoke2 when present.
    const direct = this.rects.get(sprite);
    if (direct) return direct;
    const v = this.rects.get(`${sprite}${Math.floor(Math.random() * 4)}`) ?? this.rects.get(`${sprite}0`);
    return v ?? this.fallbackRect;
  }

  spawn(p: ParticleSpawn): void {
    (p.additive === false ? this.alpha : this.add).spawn(p, this.rect(p.sprite));
  }

  update(dt: number, time: number): void {
    this.add.update(dt, time);
    this.alpha.update(dt, time);
  }

  get count(): number {
    return this.add.count + this.alpha.count;
  }
}

function softDot(): DataTexture {
  const s = 32;
  const data = new Uint8Array(s * s * 4);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const d = Math.hypot(x + 0.5 - s / 2, y + 0.5 - s / 2) / (s / 2);
      const a = Math.max(0, 1 - d) ** 2;
      const o = (y * s + x) * 4;
      data[o] = data[o + 1] = data[o + 2] = 255;
      data[o + 3] = Math.round(a * 255);
    }
  const t = new DataTexture(data, s, s, RGBAFormat, UnsignedByteType);
  t.needsUpdate = true;
  return t;
}
