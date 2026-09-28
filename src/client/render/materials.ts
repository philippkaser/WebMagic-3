import { AdditiveBlending, GLSL3, NormalBlending, ShaderMaterial, Vector4, type Blending, type Texture } from "three";
import { getMaterialArrays } from "../gfx/textures/library";

/** Materials of the deferred pipeline.
 *
 * `surfaceMaterial()` — THE material for everything opaque: world geometry,
 * creatures, props, the wizard. It writes the G-buffer (albedo+roughness,
 * view normal+metalness, emissive+AO) from the three material texture arrays,
 * with normal mapping via screen-space derivatives (no tangents needed, so
 * procedural geometry just works). Supports InstancedMesh and SkinnedMesh
 * automatically (three.js sets the defines).
 *
 * Every geometry drawn with it must carry `aLayer`, `aTint`, `aEmit`
 * (MeshBuilder and the dungeon mesher always do; see ensureSurfaceAttributes).
 *
 * `forwardMaterial()` — for additive/alpha effects rendered after lighting
 * (beams, glows, portal swirls). They get the scene depth for soft edges. */

const surfaceVertex = /* glsl */ `
#include <common>
#include <skinning_pars_vertex>
attribute float aLayer;
attribute vec3 aTint;
attribute float aEmit;
out vec3 vViewPos;
out vec3 vViewNormal;
out vec3 vWorldPos;
out vec2 vUv;
flat out float vLayer;
out vec3 vTint;
out float vEmit;
uniform float uTime;
uniform float uWind;
void main() {
  #include <beginnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  vec4 mvPosition = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    mvPosition = instanceMatrix * mvPosition;
  #endif
  vec4 worldPos = modelMatrix * mvPosition;
  // Gentle sway for foliage/cloth/banners: layers flagged via aEmit < 0.
  if (aEmit < -0.5) worldPos.xz += sin(uTime * 1.7 + worldPos.y * 2.0 + worldPos.x) * 0.03 * uWind * max(0.0, transformed.y);
  mvPosition = viewMatrix * worldPos;
  gl_Position = projectionMatrix * mvPosition;
  vViewPos = mvPosition.xyz;
  vViewNormal = normalize(transformedNormal);
  vWorldPos = worldPos.xyz;
  vUv = uv;
  vLayer = aLayer;
  vTint = aTint;
  vEmit = max(aEmit, 0.0);
}
`;

const surfaceFragment = /* glsl */ `
precision highp sampler2DArray;
in vec3 vViewPos;
in vec3 vViewNormal;
in vec3 vWorldPos;
in vec2 vUv;
flat in float vLayer;
in vec3 vTint;
in float vEmit;
uniform sampler2DArray uAlbedo;
uniform sampler2DArray uNormal;
uniform sampler2DArray uOrm;
uniform vec4 uGlow[64];   // per-layer glow multipliers, packed 4 per vec4
uniform vec4 uFlash;       // rgb flash colour, a amount
uniform float uEmissive;   // per-material glow multiplier
uniform float uTime;
layout(location = 0) out vec4 gAlbedo;   // rgb albedo (linear), a roughness
layout(location = 1) out vec4 gNormal;   // xyz view normal, w metalness
layout(location = 2) out vec4 gEmissive; // rgb emitted radiance, a ao

// Cotangent frame from derivatives (Schüler) — normal maps on arbitrary
// procedural geometry without precomputed tangents.
mat3 cotangentFrame(vec3 N, vec3 p, vec2 uv) {
  vec3 dp1 = dFdx(p);
  vec3 dp2 = dFdy(p);
  vec2 duv1 = dFdx(uv);
  vec2 duv2 = dFdy(uv);
  vec3 dp2perp = cross(dp2, N);
  vec3 dp1perp = cross(N, dp1);
  vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
  vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;
  float invmax = inversesqrt(max(dot(T, T), dot(B, B)) + 1e-12);
  return mat3(T * invmax, B * invmax, N);
}

void main() {
  int layer = int(vLayer + 0.5);
  vec3 uvw = vec3(vUv, float(layer));
  vec4 alb = texture(uAlbedo, uvw);
  if (alb.a < 0.5) discard;
  vec4 nrm = texture(uNormal, uvw);
  vec4 orm = texture(uOrm, uvw);

  vec3 N = normalize(vViewNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 tn = nrm.xyz * 2.0 - 1.0;
  mat3 tbn = cotangentFrame(N, vViewPos, vUv);
  vec3 mapped = normalize(tbn * tn);
  // Guard against degenerate derivatives on tiny/far triangles.
  N = any(isnan(mapped)) ? N : mapped;

  vec3 albedo = alb.rgb * vTint;
  float glow = uGlow[layer >> 2][layer & 3] * orm.a + vEmit;
  vec3 emissive = albedo * glow * uEmissive;
  emissive = mix(emissive, uFlash.rgb * 2.0, uFlash.a);
  albedo = mix(albedo, uFlash.rgb, uFlash.a * 0.6);

  gAlbedo = vec4(albedo, orm.g);
  gNormal = vec4(N, orm.b);
  gEmissive = vec4(emissive, orm.r);
  #ifdef VIEWMODEL
    gl_FragDepth = gl_FragCoord.z * 0.1;
    gNormal.w = orm.b + 2.0;
  #endif
}
`;

let shared: ShaderMaterial | null = null;

function makeSurfaceMaterial(): ShaderMaterial {
  const arrays = getMaterialArrays();
  const glow: Vector4[] = [];
  for (let i = 0; i < 64; i++) {
    const g = (k: number) => arrays.glow[i * 4 + k] ?? 2;
    glow.push(new Vector4(g(0), g(1), g(2), g(3)));
  }
  return new ShaderMaterial({
    name: "surface",
    glslVersion: GLSL3,
    vertexShader: surfaceVertex,
    fragmentShader: surfaceFragment,
    uniforms: {
      uAlbedo: { value: arrays.albedo },
      uNormal: { value: arrays.normal },
      uOrm: { value: arrays.orm },
      uGlow: { value: glow },
      uFlash: { value: new Vector4(1, 1, 1, 0) },
      uEmissive: { value: 1 },
      uTime: sharedTime,
      uWind: { value: 1 },
    },
  });
}

/** Global time uniform shared by every surface/forward material. */
export const sharedTime = { value: 0 };

/** The shared opaque material (no per-object uniforms). */
export function surfaceMaterial(): ShaderMaterial {
  if (!shared) shared = makeSurfaceMaterial();
  return shared;
}

/** A private instance for objects that need their own uniforms (hit flash,
 * emissive pulses). Same program as the shared one — no extra compile. */
export function ownSurfaceMaterial(): ShaderMaterial & { uniforms: { uFlash: { value: Vector4 }; uEmissive: { value: number } } } {
  const base = surfaceMaterial();
  const m = base.clone();
  // Texture arrays and glow table are shared by reference.
  m.uniforms.uAlbedo = base.uniforms.uAlbedo;
  m.uniforms.uNormal = base.uniforms.uNormal;
  m.uniforms.uOrm = base.uniforms.uOrm;
  m.uniforms.uGlow = base.uniforms.uGlow;
  m.uniforms.uTime = sharedTime;
  m.uniforms.uFlash = { value: new Vector4(1, 1, 1, 0) };
  m.uniforms.uEmissive = { value: 1 };
  return m as ShaderMaterial & { uniforms: { uFlash: { value: Vector4 }; uEmissive: { value: number } } };
}

/** Material for first-person viewmodel meshes (the held focus, hands):
 * depth is squashed so it never clips into walls; the lighting pass
 * un-squashes it (see shaders.ts). Put such meshes on LAYER.VIEWMODEL. */
export function viewmodelMaterial(): ShaderMaterial {
  const m = ownSurfaceMaterial();
  m.defines = { ...(m.defines ?? {}), VIEWMODEL: 1 };
  m.needsUpdate = true;
  return m;
}

/** Uniforms every forward material receives from the renderer each frame. */
export const forwardUniforms = {
  uDepth: { value: null as Texture | null },
  uResolution: { value: [1, 1] as [number, number] },
  uCameraNear: { value: 0.05 },
  uCameraFar: { value: 150 },
  uFogColor: { value: [0, 0, 0] as [number, number, number] },
  uFogDensity: { value: 0.02 },
};

/** GLSL helpers available to forward shaders (declare before main). */
export const forwardCommon = /* glsl */ `
uniform sampler2D uDepth;
uniform vec2 uResolution;
uniform float uCameraNear;
uniform float uCameraFar;
uniform vec3 uFogColor;
uniform float uFogDensity;
float linearDepth(float d) {
  float z = d * 2.0 - 1.0;
  return (2.0 * uCameraNear * uCameraFar) / (uCameraFar + uCameraNear - z * (uCameraFar - uCameraNear));
}
/** 0..1 fade as a fragment approaches opaque geometry behind it. */
float softEdge(float fragViewDepth, float softness) {
  float sceneDepth = linearDepth(texture(uDepth, gl_FragCoord.xy / uResolution).r);
  return clamp((sceneDepth - fragViewDepth) / softness, 0.0, 1.0);
}
float fogFactor(float dist) { return 1.0 - exp(-uFogDensity * dist); }
`;

export function forwardMaterial(opts: {
  vertexShader: string;
  fragmentShader: string;
  uniforms?: Record<string, { value: unknown }>;
  blending?: "add" | "alpha";
  doubleSided?: boolean;
}): ShaderMaterial {
  const blending: Blending = opts.blending === "alpha" ? NormalBlending : AdditiveBlending;
  const m = new ShaderMaterial({
    glslVersion: GLSL3,
    vertexShader: opts.vertexShader,
    fragmentShader: forwardCommon + opts.fragmentShader,
    uniforms: { ...forwardUniforms, uTime: sharedTime, ...(opts.uniforms ?? {}) },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending,
  });
  if (opts.doubleSided) m.side = 2;
  return m;
}
