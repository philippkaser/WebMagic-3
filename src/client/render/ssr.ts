import { Matrix4, Vector2, type WebGLRenderTarget } from "three";
import { FullscreenPass, type Renderer, type ScreenEffect } from "./Renderer";

/** Screen-space reflections: glossy texels (wet slabs, pools, ice, oil,
 * polished marble, metal) reflect what's on screen — torches double in
 * puddles, spells streak across the floor. View-space ray march against
 * the G-buffer depth with binary refinement; fades at screen edges, with
 * distance and roughness; weighted by Fresnel. */

const FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
layout(location = 0) out vec4 outColor;
uniform sampler2D tSrc;
uniform sampler2D tDepth;
uniform sampler2D tNormal;
uniform sampler2D tAlbedo;
uniform mat4 uProj;
uniform mat4 uProjInv;
uniform vec2 uResolution;
uniform float uMaxRough;
uniform float uStrength;
uniform float uTime;

vec3 viewPos(vec2 uv) {
  float d = texture(tDepth, uv).r;
  vec4 v = uProjInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  return v.xyz / v.w;
}

vec2 project(vec3 p) {
  vec4 c = uProj * vec4(p, 1.0);
  return c.xy / c.w * 0.5 + 0.5;
}

float bayer(vec2 p) {
  ivec2 i = ivec2(mod(p, 4.0));
  int idx = i.x + i.y * 4;
  float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return m[idx] / 16.0;
}

void main() {
  vec3 base = texture(tSrc, vUv).rgb;
  outColor = vec4(base, 1.0);
  float depth = texture(tDepth, vUv).r;
  if (depth >= 1.0) return;
  vec4 A = texture(tAlbedo, vUv);
  vec4 Nm = texture(tNormal, vUv);
  if (Nm.w > 1.5) return; // viewmodel
  float rough = A.a;
  if (rough > uMaxRough) return;
  float metal = Nm.w;
  vec3 N = normalize(Nm.xyz);
  vec3 P = viewPos(vUv);
  vec3 V = normalize(P);
  vec3 R = normalize(reflect(V, N));
  // Rays heading back into the camera find nothing useful.
  if (R.z > 0.6) return;

  const int STEPS = 26;
  float maxDist = 14.0;
  float stepLen = maxDist / float(STEPS);
  float jitter = bayer(gl_FragCoord.xy + fract(uTime) * 7.0);
  float t = stepLen * (0.3 + jitter * 0.8);
  float prevT = 0.0;
  bool hit = false;
  vec2 hitUv = vec2(0.0);
  for (int i = 0; i < STEPS; i++) {
    vec3 Q = P + R * t;
    vec2 uv = project(Q);
    if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0 || Q.z > -0.05) break;
    float sceneZ = viewPos(uv).z;
    float diff = sceneZ - Q.z; // > 0: the ray is behind the surface
    if (diff > 0.0 && diff < 0.35 + t * 0.06) {
      // Binary refinement between the last miss and this hit.
      float a = prevT;
      float b = t;
      for (int k = 0; k < 5; k++) {
        float m = (a + b) * 0.5;
        vec3 M = P + R * m;
        vec2 muv = project(M);
        if (viewPos(muv).z - M.z > 0.0) b = m; else a = m;
      }
      hitUv = project(P + R * b);
      t = b;
      hit = true;
      break;
    }
    prevT = t;
    t += stepLen * (1.0 + float(i) * 0.08);
  }
  if (!hit) return;

  vec3 refl = texture(tSrc, hitUv).rgb;
  vec2 e = smoothstep(vec2(0.0), vec2(0.12), hitUv) * smoothstep(vec2(0.0), vec2(0.12), 1.0 - hitUv);
  float fade = e.x * e.y * (1.0 - smoothstep(maxDist * 0.6, maxDist, t)) * (1.0 - smoothstep(uMaxRough * 0.4, uMaxRough, rough));
  float NoV = clamp(dot(N, -V), 0.0, 1.0);
  vec3 f0 = mix(vec3(0.04), A.rgb, metal);
  vec3 F = f0 + (1.0 - f0) * pow(1.0 - NoV, 5.0);
  outColor = vec4(base + refl * F * fade * uStrength, 1.0);
}
`;

export class SSR implements ScreenEffect {
  enabled = true;
  private pass: FullscreenPass;

  constructor() {
    this.pass = new FullscreenPass(FRAG, {
      tSrc: { value: null },
      tDepth: { value: null },
      tNormal: { value: null },
      tAlbedo: { value: null },
      uProj: { value: new Matrix4() },
      uProjInv: { value: new Matrix4() },
      uResolution: { value: new Vector2() },
      uMaxRough: { value: 0.42 },
      uStrength: { value: 1.35 },
      uTime: { value: 0 },
    });
  }

  render(r: Renderer, input: WebGLRenderTarget, output: WebGLRenderTarget): void {
    const u = this.pass.uniforms;
    u.tSrc.value = input.texture;
    u.tDepth.value = r.gDepth;
    u.tNormal.value = r.gNormal;
    u.tAlbedo.value = r.gAlbedo;
    (u.uProj.value as Matrix4).copy(r.camera.projectionMatrix);
    (u.uProjInv.value as Matrix4).copy(r.camera.projectionMatrixInverse);
    (u.uResolution.value as Vector2).set(r.width, r.height);
    u.uTime.value = r.time;
    this.pass.render(r.gl, output);
  }
}
