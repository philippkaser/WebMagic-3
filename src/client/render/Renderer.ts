import {
  AlwaysDepth,
  Color,
  DataTexture,
  DepthTexture,
  FloatType,
  Frustum,
  GLSL3,
  HalfFloatType,
  LinearFilter,
  Matrix4,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  RedFormat,
  RGFormat,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
  type Texture,
} from "three";
import { LightManager } from "./lights";
import { forwardUniforms, sharedTime } from "./materials";
import {
  bloomDownFragment,
  bloomUpFragment,
  compositeFragment,
  fullscreenVertex,
  lightingFragment,
} from "./shaders";

/** Render layers: which pass draws an object. */
export const LAYER = {
  /** Opaque deferred geometry (default for everything). */
  WORLD: 0,
  /** Additive / alpha effects drawn after lighting (particles, beams). */
  FORWARD: 1,
  /** First-person viewmodel: drawn into the G-buffer after a depth clear. */
  VIEWMODEL: 2,
} as const;

/** Look of a place: ambient air, fog, sky, grade. Biomes and the village
 * each provide one (render/environment.ts). */
export interface Environment {
  ambientSky: string;
  ambientGround: string;
  ambientIntensity: number;
  fogColor: string;
  fogDensity: number;
  fogHeight: number;
  haze: number;
  sky: { top: string; horizon: string; stars: number } | null;
  sun: { dir: [number, number, number]; color: string; intensity: number; shadow: boolean } | null;
  moonDir: [number, number, number];
  exposure: number;
  bloom: number;
  bloomThreshold: number;
  grade: { shadows: string; highlights: string; saturation: number; contrast: number };
  vignette: number;
  grain: number;
}

export interface RenderSettings {
  /** Screen pixels per rendered pixel (the chunkiness). */
  pixelScale: number;
  /** Ordered-dither colour levels (0 = off). */
  dither: number;
  bloom: boolean;
  /** Max distance at which lights are considered. */
  lightDistance: number;
}

/** A full-screen pass that reads the HDR buffer and writes a new one
 * (screen-space reflections, distortion…). */
export interface ScreenEffect {
  enabled: boolean;
  render(r: Renderer, input: WebGLRenderTarget, output: WebGLRenderTarget): void;
}

class FullscreenPass {
  readonly scene = new Scene();
  readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  readonly material: ShaderMaterial;

  constructor(fragmentShader: string, uniforms: Record<string, { value: unknown }>) {
    this.material = new ShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: fullscreenVertex,
      fragmentShader,
      uniforms,
      depthTest: false,
      depthWrite: false,
    });
    const quad = new Mesh(new PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.scene.add(quad);
  }

  get uniforms() {
    return this.material.uniforms;
  }

  render(gl: WebGLRenderer, target: WebGLRenderTarget | null): void {
    gl.setRenderTarget(target);
    gl.render(this.scene, this.camera);
  }
}

export { FullscreenPass };

const BLOOM_LEVELS = 5;

export class Renderer {
  readonly gl: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  readonly lights = new LightManager();
  readonly settings: RenderSettings = { pixelScale: 3, dither: 0, bloom: true, lightDistance: 48 };
  readonly effects: ScreenEffect[] = [];
  /** Extra per-frame hooks (particles upload, etc.) run before drawing. */
  readonly beforeRender: ((dt: number) => void)[] = [];
  width = 1;
  height = 1;
  time = 0;
  /** 0..1 damage pulse (decays automatically). */
  damage = 0;

  private gbuffer!: WebGLRenderTarget;
  private hdrA!: WebGLRenderTarget;
  private hdrB!: WebGLRenderTarget;
  private bloomTargets: WebGLRenderTarget[] = [];
  private lighting: FullscreenPass;
  private bloomDown: FullscreenPass;
  private bloomUp: FullscreenPass;
  private composite: FullscreenPass;
  private gridTexture: DataTexture | null = null;
  private sunTarget: WebGLRenderTarget | null = null;
  private sunCamera = new OrthographicCamera(-40, 40, 40, -40, 0.5, 200);
  private env!: Environment;
  private frustum = new Frustum();
  private projView = new Matrix4();

  constructor(readonly canvas: HTMLCanvasElement) {
    this.gl = new WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance", stencil: false });
    this.gl.setPixelRatio(1);
    this.gl.autoClear = false;
    this.camera = new PerspectiveCamera(80, 16 / 9, 0.05, 150);
    this.camera.layers.enable(LAYER.WORLD);

    this.lighting = new FullscreenPass(lightingFragment, {
      tAlbedo: { value: null },
      tNormal: { value: null },
      tEmissive: { value: null },
      tDepth: { value: null },
      tLights: { value: this.lights.texture },
      uLightCount: { value: 0 },
      uProjInv: { value: new Matrix4() },
      uViewInv: { value: new Matrix4() },
      uCamPos: { value: new Vector3() },
      uTime: sharedTime,
      uAmbientSky: { value: new Color() },
      uAmbientGround: { value: new Color() },
      uFogColor: { value: new Color() },
      uFogDensity: { value: 0.03 },
      uFogHeight: { value: 0 },
      uHaze: { value: 1 },
      tGrid: { value: null },
      uGrid: { value: [1, 1, 1, 0] },
      uSunDir: { value: new Vector3(0, -1, 0) },
      uSunColor: { value: new Color(0, 0, 0) },
      tSunShadow: { value: null },
      uSunMatrix: { value: new Matrix4() },
      uSunShadow: { value: 0 },
      uSkyTop: { value: new Color() },
      uSkyHorizon: { value: new Color() },
      uStars: { value: 0 },
      uMoonDir: { value: new Vector3(0.3, 0.5, -0.8) },
      uIsSky: { value: 0 },
    });
    // Always-pass depth test so gl_FragDepth lands in hdrA's depth buffer.
    this.lighting.material.depthTest = true;
    this.lighting.material.depthWrite = true;
    this.lighting.material.depthFunc = AlwaysDepth;
    this.bloomDown = new FullscreenPass(bloomDownFragment, {
      tSrc: { value: null },
      uTexel: { value: new Vector2() },
      uThreshold: { value: 1 },
      uFirst: { value: 0 },
    });
    this.bloomUp = new FullscreenPass(bloomUpFragment, { tSrc: { value: null }, uTexel: { value: new Vector2() } });
    this.bloomUp.material.blending = 2; // additive onto the larger level
    this.bloomUp.material.transparent = true;
    this.composite = new FullscreenPass(compositeFragment, {
      tHdr: { value: null },
      tBloom: { value: null },
      uBloom: { value: 0.06 },
      uExposure: { value: 1 },
      uShadowTint: { value: new Color(1, 1, 1) },
      uHighlightTint: { value: new Color(1, 1, 1) },
      uSaturation: { value: 1 },
      uContrast: { value: 1 },
      uVignette: { value: 1.2 },
      uGrain: { value: 0.03 },
      uTime: sharedTime,
      uDither: { value: 0 },
      uDamage: { value: 0 },
      uResolution: { value: new Vector2() },
    });
    this.setEnvironment(DEFAULT_ENV);
    this.resize();
  }

  // ── configuration ────────────────────────────────────────────────────────

  setEnvironment(env: Environment): void {
    this.env = env;
    const u = this.lighting.uniforms;
    (u.uAmbientSky.value as Color).set(env.ambientSky).multiplyScalar(env.ambientIntensity);
    (u.uAmbientGround.value as Color).set(env.ambientGround).multiplyScalar(env.ambientIntensity);
    (u.uFogColor.value as Color).set(env.fogColor);
    u.uFogDensity.value = env.fogDensity;
    u.uFogHeight.value = env.fogHeight;
    u.uHaze.value = env.haze;
    u.uIsSky.value = env.sky ? 1 : 0;
    if (env.sky) {
      (u.uSkyTop.value as Color).set(env.sky.top);
      (u.uSkyHorizon.value as Color).set(env.sky.horizon);
      u.uStars.value = env.sky.stars;
    }
    (u.uMoonDir.value as Vector3).set(...env.moonDir).normalize();
    if (env.sun) {
      (u.uSunDir.value as Vector3).set(...env.sun.dir).normalize();
      (u.uSunColor.value as Color).set(env.sun.color).multiplyScalar(env.sun.intensity);
      if (env.sun.shadow && !this.sunTarget) this.createSunShadow();
    } else {
      (u.uSunColor.value as Color).setRGB(0, 0, 0);
    }
    u.uSunShadow.value = env.sun?.shadow ? 1 : 0;
    const f = forwardUniforms;
    const fc = new Color(env.fogColor);
    f.uFogColor.value = [fc.r, fc.g, fc.b];
    f.uFogDensity.value = env.fogDensity;
    const c = this.composite.uniforms;
    c.uExposure.value = env.exposure;
    c.uBloom.value = env.bloom;
    (c.uShadowTint.value as Color).set(env.grade.shadows);
    (c.uHighlightTint.value as Color).set(env.grade.highlights);
    c.uSaturation.value = env.grade.saturation;
    c.uContrast.value = env.grade.contrast;
    c.uVignette.value = env.vignette;
    c.uGrain.value = env.grain;
    this.bloomDown.uniforms.uThreshold.value = env.bloomThreshold;
  }

  get environment(): Environment {
    return this.env;
  }

  /** Floor/ceiling heights per cell for grid-traced light shadows. Pass
   * null outside grid-based places (the village uses a shadow map). */
  setShadowGrid(grid: { w: number; h: number; cell: number; floor: Float32Array; ceil: Float32Array; solid: (i: number) => boolean } | null): void {
    this.gridTexture?.dispose();
    this.gridTexture = null;
    const u = this.lighting.uniforms;
    if (!grid) {
      u.uGrid.value = [1, 1, 1, 0];
      return;
    }
    const data = new Float32Array(grid.w * grid.h * 2);
    for (let i = 0; i < grid.w * grid.h; i++) {
      const solid = grid.solid(i);
      data[i * 2] = solid ? 1e4 : grid.floor[i];
      data[i * 2 + 1] = solid ? -1e4 : grid.ceil[i];
    }
    const tex = new DataTexture(data, grid.w, grid.h, RGFormat, FloatType);
    tex.minFilter = NearestFilter;
    tex.magFilter = NearestFilter;
    tex.needsUpdate = true;
    this.gridTexture = tex;
    u.tGrid.value = tex;
    u.uGrid.value = [grid.w, grid.h, grid.cell, 1];
  }

  resize(): void {
    const cssW = this.canvas.clientWidth || window.innerWidth;
    const cssH = this.canvas.clientHeight || window.innerHeight;
    const w = Math.max(160, Math.round(cssW / this.settings.pixelScale));
    const h = Math.max(90, Math.round(cssH / this.settings.pixelScale));
    if (w === this.width && h === this.height && this.gbuffer) return;
    this.width = w;
    this.height = h;
    this.gl.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.createTargets();
  }

  private createTargets(): void {
    this.gbuffer?.dispose();
    this.hdrA?.dispose();
    this.hdrB?.dispose();
    for (const t of this.bloomTargets) t.dispose();
    const { width: w, height: h } = this;

    const depth = new DepthTexture(w, h, FloatType);
    this.gbuffer = new WebGLRenderTarget(w, h, {
      count: 3,
      type: HalfFloatType,
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      depthBuffer: true,
      depthTexture: depth,
    });
    this.gbuffer.textures[0].name = "gAlbedo";
    this.gbuffer.textures[1].name = "gNormal";
    this.gbuffer.textures[2].name = "gEmissive";

    // hdrA has its own depth buffer, filled by the lighting pass from the
    // G-buffer depth (gl_FragDepth), so forward effects depth-test against
    // the world without sampling a texture attached to the framebuffer.
    const hdr = (withDepth: boolean) =>
      new WebGLRenderTarget(w, h, {
        type: HalfFloatType,
        minFilter: LinearFilter,
        magFilter: LinearFilter,
        depthBuffer: withDepth,
      });
    this.hdrA = hdr(true);
    this.hdrB = hdr(false);

    this.bloomTargets = [];
    let bw = w;
    let bh = h;
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      bw = Math.max(1, Math.floor(bw / 2));
      bh = Math.max(1, Math.floor(bh / 2));
      this.bloomTargets.push(
        new WebGLRenderTarget(bw, bh, { type: HalfFloatType, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false }),
      );
    }

    const u = this.lighting.uniforms;
    u.tAlbedo.value = this.gbuffer.textures[0];
    u.tNormal.value = this.gbuffer.textures[1];
    u.tEmissive.value = this.gbuffer.textures[2];
    u.tDepth.value = depth;
    forwardUniforms.uDepth.value = depth;
    forwardUniforms.uResolution.value = [w, h];
    (this.composite.uniforms.uResolution.value as Vector2).set(w, h);
  }

  private createSunShadow(): void {
    const size = 2048;
    const depth = new DepthTexture(size, size, FloatType);
    this.sunTarget = new WebGLRenderTarget(size, size, { depthBuffer: true, depthTexture: depth, format: RedFormat });
    this.lighting.uniforms.tSunShadow.value = depth;
  }

  // ── G-buffer accessors for screen effects ────────────────────────────────

  get gAlbedo(): Texture {
    return this.gbuffer.textures[0];
  }
  get gNormal(): Texture {
    return this.gbuffer.textures[1];
  }
  get gEmissive(): Texture {
    return this.gbuffer.textures[2];
  }
  get gDepth(): Texture {
    return this.gbuffer.depthTexture!;
  }

  // ── frame ────────────────────────────────────────────────────────────────

  render(dt: number): void {
    this.time += dt;
    sharedTime.value = this.time;
    this.damage = Math.max(0, this.damage - dt * 1.6);
    for (const fn of this.beforeRender) fn(dt);

    const gl = this.gl;
    const cam = this.camera;
    cam.updateMatrixWorld();
    this.projView.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projView);
    this.lights.update(dt, this.time, cam.position, this.frustum, this.settings.lightDistance);
    forwardUniforms.uCameraNear.value = cam.near;
    forwardUniforms.uCameraFar.value = cam.far;

    if (this.env.sun?.shadow && this.sunTarget) this.renderSunShadow();

    // 1. G-buffer: world, then the viewmodel (depth-squashed, see materials).
    gl.setRenderTarget(this.gbuffer);
    gl.setClearColor(0x000000, 0);
    gl.clear(true, true, false);
    cam.layers.set(LAYER.WORLD);
    gl.render(this.scene, cam);
    cam.layers.set(LAYER.VIEWMODEL);
    gl.render(this.scene, cam);

    // 2. Lighting → HDR.
    const u = this.lighting.uniforms;
    (u.uProjInv.value as Matrix4).copy(cam.projectionMatrixInverse);
    (u.uViewInv.value as Matrix4).copy(cam.matrixWorld);
    (u.uCamPos.value as Vector3).copy(cam.position);
    u.uLightCount.value = this.lights.count;
    this.lighting.render(gl, this.hdrA);

    // 3. Forward effects into the HDR buffer (depth-tested against the world).
    gl.setRenderTarget(this.hdrA);
    cam.layers.set(LAYER.FORWARD);
    gl.render(this.scene, cam);

    // 4. Screen effects (SSR, …) ping-pong.
    let src = this.hdrA;
    let dst = this.hdrB;
    for (const fx of this.effects) {
      if (!fx.enabled) continue;
      fx.render(this, src, dst);
      const t = src;
      src = dst;
      dst = t;
    }

    // 5. Bloom.
    let bloomTex: Texture = this.bloomTargets[0].texture;
    if (this.settings.bloom) {
      let input: Texture = src.texture;
      let iw = this.width;
      let ih = this.height;
      for (let i = 0; i < BLOOM_LEVELS; i++) {
        const bu = this.bloomDown.uniforms;
        bu.tSrc.value = input;
        (bu.uTexel.value as Vector2).set(1 / iw, 1 / ih);
        bu.uFirst.value = i === 0 ? 1 : 0;
        this.bloomDown.render(gl, this.bloomTargets[i]);
        input = this.bloomTargets[i].texture;
        iw = this.bloomTargets[i].width;
        ih = this.bloomTargets[i].height;
      }
      for (let i = BLOOM_LEVELS - 1; i > 0; i--) {
        const uu = this.bloomUp.uniforms;
        uu.tSrc.value = this.bloomTargets[i].texture;
        (uu.uTexel.value as Vector2).set(1 / this.bloomTargets[i].width, 1 / this.bloomTargets[i].height);
        this.bloomUp.render(gl, this.bloomTargets[i - 1]);
      }
      bloomTex = this.bloomTargets[0].texture;
    }

    // 6. Composite to the canvas.
    const c = this.composite.uniforms;
    c.tHdr.value = src.texture;
    c.tBloom.value = bloomTex;
    c.uBloom.value = this.settings.bloom ? this.env.bloom : 0;
    c.uDither.value = this.settings.dither;
    c.uDamage.value = this.damage;
    this.composite.render(gl, null);
    cam.layers.set(LAYER.WORLD);
  }

  private renderSunShadow(): void {
    const sun = this.env.sun!;
    const sc = this.sunCamera;
    const d = new Vector3(...sun.dir).normalize();
    const focus = this.camera.position;
    sc.position.copy(focus).addScaledVector(d, -90);
    sc.lookAt(focus);
    sc.updateMatrixWorld();
    sc.updateProjectionMatrix();
    const gl = this.gl;
    gl.setRenderTarget(this.sunTarget);
    gl.clear(true, true, false);
    sc.layers.set(LAYER.WORLD);
    const prev = this.scene.overrideMaterial;
    this.scene.overrideMaterial = shadowDepthMaterial();
    gl.render(this.scene, sc);
    this.scene.overrideMaterial = prev;
    const m = this.lighting.uniforms.uSunMatrix.value as Matrix4;
    m.multiplyMatrices(sc.projectionMatrix, sc.matrixWorldInverse);
  }

  dispose(): void {
    this.gbuffer.dispose();
    this.hdrA.dispose();
    this.hdrB.dispose();
    for (const t of this.bloomTargets) t.dispose();
    this.sunTarget?.dispose();
    this.gl.dispose();
  }
}

let depthMat: ShaderMaterial | null = null;
/** Depth-only material for the sun shadow map (instancing/skinning aware). */
function shadowDepthMaterial(): ShaderMaterial {
  if (depthMat) return depthMat;
  depthMat = new ShaderMaterial({
    glslVersion: GLSL3,
    vertexShader: /* glsl */ `
      #include <common>
      #include <skinning_pars_vertex>
      void main() {
        #include <skinbase_vertex>
        #include <begin_vertex>
        #include <skinning_vertex>
        vec4 p = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
        #endif
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * p;
      }`,
    fragmentShader: /* glsl */ `
      layout(location = 0) out vec4 outColor;
      void main() { outColor = vec4(1.0); }`,
  });
  return depthMat;
}

export const DEFAULT_ENV: Environment = {
  ambientSky: "#1a1824",
  ambientGround: "#0c0a0e",
  ambientIntensity: 1,
  fogColor: "#050407",
  fogDensity: 0.045,
  fogHeight: 0,
  haze: 1,
  sky: null,
  sun: null,
  moonDir: [0.3, 0.5, -0.8],
  exposure: 0.95,
  bloom: 0.08,
  bloomThreshold: 0.9,
  grade: { shadows: "#e8e4ff", highlights: "#fff1dc", saturation: 0.92, contrast: 1.05 },
  vignette: 1.3,
  grain: 0.035,
};
