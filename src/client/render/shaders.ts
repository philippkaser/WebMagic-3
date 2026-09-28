/** GLSL for the deferred pipeline's full-screen passes. Kept as plain
 * strings in one place so the whole light model can be read top to bottom. */

export const fullscreenVertex = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/** The lighting pass: G-buffer → HDR radiance.
 *
 *  - N point lights looped from a float texture, GGX specular + Lambert,
 *    grid-traced shadows (DDA through the floor's height grid so light never
 *    bleeds through walls), analytic volumetric in-scattering per light.
 *  - Hemisphere ambient × baked AO, optional directional "moon" with a
 *    shadow map (village), exponential fog, procedural night sky. */
export const lightingFragment = /* glsl */ `
precision highp float;
in vec2 vUv;
layout(location = 0) out vec4 outColor;

uniform sampler2D tAlbedo;
uniform sampler2D tNormal;
uniform sampler2D tEmissive;
uniform sampler2D tDepth;
uniform sampler2D tLights;
uniform int uLightCount;

uniform mat4 uProjInv;
uniform mat4 uViewInv;
uniform vec3 uCamPos;
uniform float uTime;

uniform vec3 uAmbientSky;
uniform vec3 uAmbientGround;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uFogHeight;     // fog thickens below this world height
uniform float uHaze;          // volumetric in-scatter strength

uniform sampler2D tGrid;      // r = floor height, g = ceiling height per cell
uniform vec4 uGrid;           // x,y = size in cells, z = cell size, w = enabled

uniform vec3 uSunDir;         // world, pointing from the sun toward the scene
uniform vec3 uSunColor;
uniform sampler2D tSunShadow;
uniform mat4 uSunMatrix;
uniform float uSunShadow;     // 0 = no shadow map

uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform float uStars;
uniform vec3 uMoonDir;
uniform float uIsSky;         // 1 = draw sky where depth == 1, else fog colour

const float PI = 3.14159265;

vec3 viewPosFromDepth(vec2 uv, float d) {
  vec4 ndc = vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  vec4 v = uProjInv * ndc;
  return v.xyz / v.w;
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// DDA through the height grid from P toward the light. 0 = blocked.
float gridShadow(vec3 P, vec3 Lp) {
  if (uGrid.w < 0.5) return 1.0;
  float cs = uGrid.z;
  vec2 p0 = P.xz / cs;
  vec2 p1 = Lp.xz / cs;
  vec2 dv = p1 - p0;
  float len = length(dv);
  if (len < 1e-3) return 1.0;
  vec2 dir = dv / len;
  ivec2 c = ivec2(floor(p0));
  ivec2 cEnd = ivec2(floor(p1));
  ivec2 stp = ivec2(dir.x >= 0.0 ? 1 : -1, dir.y >= 0.0 ? 1 : -1);
  vec2 tDelta = vec2(abs(dir.x) > 1e-6 ? abs(1.0 / dir.x) : 1e9, abs(dir.y) > 1e-6 ? abs(1.0 / dir.y) : 1e9);
  vec2 tMax = vec2(
    abs(dir.x) > 1e-6 ? ((dir.x > 0.0 ? float(c.x + 1) : float(c.x)) - p0.x) / dir.x : 1e9,
    abs(dir.y) > 1e-6 ? ((dir.y > 0.0 ? float(c.y + 1) : float(c.y)) - p0.y) / dir.y : 1e9);
  ivec2 gsize = ivec2(uGrid.xy);
  for (int i = 0; i < 40; i++) {
    if (c == cEnd) return 1.0;
    float tIn = min(tMax.x, tMax.y);
    if (tIn >= len) return 1.0;
    if (tMax.x < tMax.y) { tMax.x += tDelta.x; c.x += stp.x; }
    else { tMax.y += tDelta.y; c.y += stp.y; }
    if (c.x < 0 || c.y < 0 || c.x >= gsize.x || c.y >= gsize.y) return 0.0;
    float tOut = min(min(tMax.x, tMax.y), len);
    float yIn = mix(P.y, Lp.y, tIn / len);
    float yOut = mix(P.y, Lp.y, tOut / len);
    vec2 fc = texelFetch(tGrid, c, 0).rg;
    if (min(yIn, yOut) < fc.x - 0.03 || max(yIn, yOut) > fc.y + 0.03) return 0.0;
  }
  return 1.0;
}

float sunShadow(vec3 P, vec3 N) {
  if (uSunShadow < 0.5) return 1.0;
  vec4 sp = uSunMatrix * vec4(P + N * 0.08, 1.0);
  vec3 s = sp.xyz / sp.w * 0.5 + 0.5;
  if (s.x < 0.0 || s.x > 1.0 || s.y < 0.0 || s.y > 1.0 || s.z > 1.0) return 1.0;
  vec2 texel = 1.0 / vec2(textureSize(tSunShadow, 0));
  float lit = 0.0;
  for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++) {
      float d = texture(tSunShadow, s.xy + vec2(x, y) * texel).r;
      lit += s.z - 0.0015 <= d ? 1.0 : 0.0;
    }
  return lit / 9.0;
}

float D_GGX(float NoH, float a) {
  float a2 = a * a;
  float f = (NoH * a2 - NoH) * NoH + 1.0;
  return a2 / (PI * f * f + 1e-7);
}

float V_SmithGGX(float NoV, float NoL, float a) {
  float a2 = a * a;
  float gv = NoL * sqrt(NoV * NoV * (1.0 - a2) + a2);
  float gl = NoV * sqrt(NoL * NoL * (1.0 - a2) + a2);
  return 0.5 / (gv + gl + 1e-5);
}

vec3 F_Schlick(vec3 f0, float VoH) {
  return f0 + (1.0 - f0) * pow(1.0 - VoH, 5.0);
}

// Closed-form single-scattering integral of an inverse-square point light
// along the view ray [0, T]: ∫ ds / (h² + (s − a)²).
float inscatter(vec3 ro, vec3 rd, float T, vec3 Lp, float R) {
  vec3 w = Lp - ro;
  float a = dot(w, rd);
  float h2 = max(dot(w, w) - a * a, 0.04);
  float h = sqrt(h2);
  float I = (atan((T - a) / h) - atan(-a / h)) / h;
  float falloff = 1.0 - smoothstep(0.0, R * 1.1, h);
  return I * falloff;
}

vec3 sky(vec3 rd) {
  float t = clamp(rd.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 col = mix(uSkyHorizon, uSkyTop, smoothstep(0.45, 1.0, t));
  if (uStars > 0.0 && rd.y > 0.0) {
    vec2 sp = rd.xz / (rd.y + 0.25) * 90.0;
    vec2 cell = floor(sp);
    float h = hash12(cell);
    float star = step(0.985, h) * smoothstep(0.5, 0.1, length(fract(sp) - 0.5));
    float tw = 0.6 + 0.4 * sin(uTime * (1.0 + h * 3.0) + h * 40.0);
    col += vec3(0.9, 0.9, 1.0) * star * tw * uStars * smoothstep(0.0, 0.3, rd.y);
  }
  float md = dot(rd, normalize(uMoonDir));
  col += vec3(0.85, 0.9, 1.0) * smoothstep(0.9993, 0.9996, md) * 2.5; // moon disc
  col += vec3(0.4, 0.45, 0.6) * pow(max(md, 0.0), 64.0) * 0.35;        // moon glow
  return col;
}

void main() {
  float rawDepth = texture(tDepth, vUv).r;
  // The HDR target keeps its own depth buffer for the forward pass.
  gl_FragDepth = rawDepth;
  vec4 Nm = texture(tNormal, vUv);
  // Viewmodel pixels are written with depth squashed ×0.1 (so the staff
  // never clips into walls) and flag themselves via metalness + 2.
  bool viewmodel = Nm.w > 1.5;
  float depth = viewmodel ? rawDepth * 10.0 : rawDepth;
  vec3 viewP = viewPosFromDepth(vUv, depth);
  vec3 P = (uViewInv * vec4(viewP, 1.0)).xyz;
  vec3 rd = normalize(P - uCamPos);
  float dist = depth >= 1.0 ? 80.0 : length(P - uCamPos);

  vec3 color;
  if (depth >= 1.0) {
    color = uIsSky > 0.5 ? sky(rd) : uFogColor;
  } else {
    vec4 A = texture(tAlbedo, vUv);
    vec4 E = texture(tEmissive, vUv);
    vec3 albedo = A.rgb;
    float rough = clamp(A.a, 0.04, 1.0);
    float metal = viewmodel ? Nm.w - 2.0 : Nm.w;
    float ao = E.a;
    vec3 N = normalize(mat3(uViewInv) * Nm.xyz);
    vec3 V = -rd;
    float NoV = clamp(dot(N, V), 1e-4, 1.0);
    vec3 diffuseColor = albedo * (1.0 - metal);
    vec3 f0 = mix(vec3(0.04), albedo, metal);
    float a = rough * rough;

    // Hemisphere ambient; metals get a faint ambient sheen so they read.
    vec3 amb = mix(uAmbientGround, uAmbientSky, N.y * 0.5 + 0.5);
    color = amb * (diffuseColor + f0 * 0.5) * ao;

    // Moon / sun.
    if (dot(uSunColor, uSunColor) > 0.0) {
      vec3 L = -normalize(uSunDir);
      float NoL = max(dot(N, L), 0.0);
      if (NoL > 0.0) {
        float sh = sunShadow(P, N);
        vec3 H = normalize(V + L);
        float NoH = max(dot(N, H), 0.0);
        vec3 F = F_Schlick(f0, max(dot(V, H), 0.0));
        vec3 spec = D_GGX(NoH, a) * V_SmithGGX(NoV, NoL, a) * F;
        color += (diffuseColor / PI + spec) * uSunColor * NoL * sh * PI;
      }
    }

    vec3 Ps = P + N * 0.06;
    for (int i = 0; i < uLightCount; i++) {
      vec4 l0 = texelFetch(tLights, ivec2(i, 0), 0);
      vec3 toL = l0.xyz - P;
      float d2 = dot(toL, toL);
      float R = l0.w;
      if (d2 > R * R) continue;
      vec4 l1 = texelFetch(tLights, ivec2(i, 1), 0);
      float d = sqrt(d2);
      vec3 L = toL / d;
      float NoL = dot(N, L);
      if (NoL <= 0.0) continue;
      float win = 1.0 - (d2 * d2) / (R * R * R * R);
      float atten = win * win / (d2 + 0.6);
      float sh = l1.w > 0.5 ? gridShadow(Ps, l0.xyz) : 1.0;
      if (sh <= 0.0) continue;
      vec3 H = normalize(V + L);
      float NoH = max(dot(N, H), 0.0);
      vec3 F = F_Schlick(f0, max(dot(V, H), 0.0));
      vec3 spec = D_GGX(NoH, a) * V_SmithGGX(NoV, NoL, a) * F;
      color += (diffuseColor / PI + spec) * l1.rgb * (atten * NoL * sh * PI);
    }

    color += E.rgb;
  }

  // Fog: thicker in low places, in the colour of the ambient air.
  float heightK = exp(-max(P.y - uFogHeight, 0.0) * 0.12);
  float fog = 1.0 - exp(-uFogDensity * dist * mix(0.6, 1.0, heightK));
  if (depth < 1.0 || uIsSky < 0.5) color = mix(color, uFogColor, fog);

  // Volumetric halos: every light scatters in the dusty air along the ray.
  if (uHaze > 0.0) {
    vec3 scatter = vec3(0.0);
    float T = min(dist, 60.0);
    for (int i = 0; i < uLightCount; i++) {
      vec4 l2 = texelFetch(tLights, ivec2(i, 2), 0);
      if (l2.x <= 0.0) continue;
      vec4 l0 = texelFetch(tLights, ivec2(i, 0), 0);
      vec4 l1 = texelFetch(tLights, ivec2(i, 1), 0);
      scatter += l1.rgb * (l2.x * inscatter(uCamPos, rd, T, l0.xyz, l0.w));
    }
    color += scatter * uHaze * 0.02;
  }

  outColor = vec4(color, 1.0);
}
`;

/** Bright-pass + downsample (13-tap, from the CoD/Jimenez bloom). */
export const bloomDownFragment = /* glsl */ `
precision highp float;
in vec2 vUv;
layout(location = 0) out vec4 outColor;
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uThreshold;
uniform float uFirst;
vec3 s(vec2 o) { return texture(tSrc, vUv + o * uTexel).rgb; }
void main() {
  vec3 a = s(vec2(-2, 2)), b = s(vec2(0, 2)), c = s(vec2(2, 2));
  vec3 d = s(vec2(-2, 0)), e = s(vec2(0, 0)), f = s(vec2(2, 0));
  vec3 g = s(vec2(-2, -2)), h = s(vec2(0, -2)), i = s(vec2(2, -2));
  vec3 j = s(vec2(-1, 1)), k = s(vec2(1, 1)), l = s(vec2(-1, -1)), m = s(vec2(1, -1));
  vec3 col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  if (uFirst > 0.5) {
    float br = max(col.r, max(col.g, col.b));
    float soft = clamp(br - uThreshold + 0.5, 0.0, 1.0);
    soft = soft * soft * 0.5;
    float contrib = max(soft, br - uThreshold) / max(br, 1e-4);
    col *= contrib;
  }
  outColor = vec4(min(col, vec3(64.0)), 1.0);
}
`;

export const bloomUpFragment = /* glsl */ `
precision highp float;
in vec2 vUv;
layout(location = 0) out vec4 outColor;
uniform sampler2D tSrc;
uniform vec2 uTexel;
void main() {
  vec3 col = vec3(0.0);
  col += texture(tSrc, vUv + vec2(-1, 1) * uTexel).rgb;
  col += texture(tSrc, vUv + vec2(0, 1) * uTexel).rgb * 2.0;
  col += texture(tSrc, vUv + vec2(1, 1) * uTexel).rgb;
  col += texture(tSrc, vUv + vec2(-1, 0) * uTexel).rgb * 2.0;
  col += texture(tSrc, vUv).rgb * 4.0;
  col += texture(tSrc, vUv + vec2(1, 0) * uTexel).rgb * 2.0;
  col += texture(tSrc, vUv + vec2(-1, -1) * uTexel).rgb;
  col += texture(tSrc, vUv + vec2(0, -1) * uTexel).rgb * 2.0;
  col += texture(tSrc, vUv + vec2(1, -1) * uTexel).rgb;
  outColor = vec4(col / 16.0, 1.0);
}
`;

/** Final composite: bloom, exposure, filmic tonemap, grade, vignette,
 * grain, ordered dither + optional palette quantisation, damage pulse. */
export const compositeFragment = /* glsl */ `
precision highp float;
in vec2 vUv;
layout(location = 0) out vec4 outColor;
uniform sampler2D tHdr;
uniform sampler2D tBloom;
uniform float uBloom;
uniform float uExposure;
uniform vec3 uShadowTint;
uniform vec3 uHighlightTint;
uniform float uSaturation;
uniform float uContrast;
uniform float uVignette;
uniform float uGrain;
uniform float uTime;
uniform float uDither;     // 0 = off, else colour levels per channel
uniform float uDamage;     // 0..1 red pulse + chromatic split
uniform vec2 uResolution;

vec3 aces(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

float bayer4(vec2 p) {
  ivec2 i = ivec2(mod(p, 4.0));
  int idx = i.x + i.y * 4;
  float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return m[idx] / 16.0 - 0.5;
}

vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  vec2 uv = vUv;
  vec3 hdr;
  if (uDamage > 0.001) {
    vec2 dir = (uv - 0.5) * uDamage * 0.012;
    hdr = vec3(texture(tHdr, uv + dir).r, texture(tHdr, uv).g, texture(tHdr, uv - dir).b);
  } else {
    hdr = texture(tHdr, uv).rgb;
  }
  hdr += texture(tBloom, uv).rgb * uBloom;
  vec3 c = aces(hdr * uExposure);

  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(lum), c, uSaturation);
  c = (c - 0.5) * uContrast + 0.5;
  c *= mix(uShadowTint, uHighlightTint, smoothstep(0.0, 0.7, lum));
  c = clamp(c, 0.0, 1.0);

  vec2 q = uv - 0.5;
  c *= 1.0 - dot(q, q) * uVignette;
  c = mix(c, c * vec3(1.35, 0.35, 0.3), uDamage * 0.35 * smoothstep(0.1, 0.7, length(q)));

  c = toSRGB(c);
  c += (hash(uv * uResolution + fract(uTime) * 91.0) - 0.5) * uGrain;
  if (uDither > 0.5) {
    c += bayer4(gl_FragCoord.xy) / uDither;
    c = floor(c * uDither + 0.5) / uDither;
  }
  outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

export const copyFragment = /* glsl */ `
precision highp float;
in vec2 vUv;
layout(location = 0) out vec4 outColor;
uniform sampler2D tSrc;
void main() { outColor = texture(tSrc, vUv); }
`;
