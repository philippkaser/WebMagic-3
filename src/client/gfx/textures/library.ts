import {
  DataArrayTexture,
  LinearMipmapLinearFilter,
  NearestFilter,
  NearestMipmapLinearFilter,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from "three";
import { cavityAO, heightToNormal, Paint } from "./paint";

/** The material library: every surface in the game is a *material id*
 * ("stone.crypt_brick", "wood.dark_plank", "bone") whose painter is
 * registered here. At startup all registered materials are painted and
 * packed into three WebGL2 texture arrays; geometry references a material by
 * its layer index (vertex attribute `layer`), so the whole world renders with
 * one shader and tiling UVs work per layer without atlas bleeding.
 *
 * Painters live in ./painters/*.ts and self-register on import. */

export const TEX_SIZE = 64;

export interface MaterialOptions {
  /** Normal map strength (Sobel multiplier). Default 2. */
  normal?: number;
  /** Cavity AO strength from height. Default 1. */
  ao?: number;
  /** Emissive intensity multiplier the shader applies to emit-mask texels. */
  glow?: number;
  /** Alpha-tested cut-out material (webs, grates, foliage). */
  cutout?: boolean;
  /** One texture repeat covers this many metres on world geometry. Default 2. */
  worldSize?: number;
}

export type Painter = (p: Paint) => void;

interface Entry {
  id: string;
  painter: Painter;
  opts: MaterialOptions;
}

const entries: Entry[] = [];
const byId = new Map<string, number>();

/** Register a material. Re-registering an id replaces its painter (lets
 * biome painter files override generic ones). */
export function registerMaterial(id: string, painter: Painter, opts: MaterialOptions = {}): void {
  const existing = byId.get(id);
  if (existing !== undefined) {
    entries[existing] = { id, painter, opts };
    return;
  }
  byId.set(id, entries.length);
  entries.push({ id, painter, opts });
}

export function hasMaterial(id: string): boolean {
  return byId.has(id);
}

export function materialIds(): string[] {
  return entries.map((e) => e.id);
}

export interface MaterialArrays {
  albedo: DataArrayTexture;
  normal: DataArrayTexture;
  orm: DataArrayTexture;
  /** Per-layer glow multiplier and world size (for UV generation). */
  glow: Float32Array;
  worldSize: Float32Array;
  count: number;
}

let built: MaterialArrays | null = null;
const warned = new Set<string>();

/** Layer index of a material id. Unknown ids fall back to layer 0 (the
 * magenta "missing" checker) with a one-time warning. */
export function layerOf(id: string): number {
  const i = byId.get(id);
  if (i === undefined) {
    if (!warned.has(id)) {
      warned.add(id);
      console.warn(`[materials] unknown material "${id}"`);
    }
    return 0;
  }
  return i;
}

export function worldSizeOf(id: string): number {
  const i = byId.get(id);
  return i === undefined ? 2 : (entries[i].opts.worldSize ?? 2);
}

/** Paint every registered material into the three arrays. Call once after
 * all painter modules are imported. */
export function buildMaterialArrays(): MaterialArrays {
  if (built) return built;
  const n = entries.length;
  const S = TEX_SIZE;
  const layerBytes = S * S * 4;
  const albedo = new Uint8Array(layerBytes * n);
  const normal = new Uint8Array(layerBytes * n);
  const orm = new Uint8Array(layerBytes * n);
  const glow = new Float32Array(n);
  const worldSize = new Float32Array(n);

  entries.forEach((e, layer) => {
    const p = new Paint(S, e.id);
    try {
      e.painter(p);
    } catch (err) {
      console.error(`[materials] painter "${e.id}" failed`, err);
      missingPainter(p);
    }
    const nrm = heightToNormal(p, e.opts.normal ?? 2);
    const ao = cavityAO(p, e.opts.ao ?? 1);
    const base = layer * layerBytes;
    for (let i = 0; i < S * S; i++) {
      const o = base + i * 4;
      albedo[o] = to8(p.albedo[i * 3]);
      albedo[o + 1] = to8(p.albedo[i * 3 + 1]);
      albedo[o + 2] = to8(p.albedo[i * 3 + 2]);
      albedo[o + 3] = to8(e.opts.cutout ? p.alpha[i] : 1);
      normal[o] = nrm[i * 4];
      normal[o + 1] = nrm[i * 4 + 1];
      normal[o + 2] = nrm[i * 4 + 2];
      normal[o + 3] = nrm[i * 4 + 3];
      orm[o] = to8(ao[i]);
      orm[o + 1] = to8(p.rough[i]);
      orm[o + 2] = to8(p.metal[i]);
      orm[o + 3] = to8(p.emit[i]);
    }
    glow[layer] = e.opts.glow ?? 2;
    worldSize[layer] = e.opts.worldSize ?? 2;
  });

  built = {
    albedo: makeArray(albedo, n, true),
    normal: makeArray(normal, n, false),
    orm: makeArray(orm, n, false),
    glow,
    worldSize,
    count: n,
  };
  return built;
}

export function getMaterialArrays(): MaterialArrays {
  if (!built) throw new Error("buildMaterialArrays() has not run yet");
  return built;
}

/** Raw RGBA8 pixels of one layer's albedo — for UI icons / previews. */
export function paintPreview(id: string): { size: number; rgba: Uint8ClampedArray } | null {
  const i = byId.get(id);
  if (i === undefined) return null;
  const p = new Paint(TEX_SIZE, id);
  entries[i].painter(p);
  const rgba = new Uint8ClampedArray(TEX_SIZE * TEX_SIZE * 4);
  for (let t = 0; t < TEX_SIZE * TEX_SIZE; t++) {
    rgba[t * 4] = to8(p.albedo[t * 3]);
    rgba[t * 4 + 1] = to8(p.albedo[t * 3 + 1]);
    rgba[t * 4 + 2] = to8(p.albedo[t * 3 + 2]);
    rgba[t * 4 + 3] = 255;
  }
  return { size: TEX_SIZE, rgba };
}

/** Paint one material into a fresh Paint (all channels) — for tooling such
 * as contact sheets and debug views. Null for unknown ids. */
export function paintMaterial(id: string): { paint: Paint; opts: MaterialOptions } | null {
  const i = byId.get(id);
  if (i === undefined) return null;
  const p = new Paint(TEX_SIZE, id);
  entries[i].painter(p);
  return { paint: p, opts: entries[i].opts };
}

function to8(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v * 255)));
}

function makeArray(data: Uint8Array, layers: number, srgb: boolean): DataArrayTexture {
  const tex = new DataArrayTexture(data, TEX_SIZE, TEX_SIZE, layers);
  tex.format = RGBAFormat;
  tex.type = UnsignedByteType;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  // Nearest magnification is the look; mip-mapped minification keeps
  // distant walls from shimmering.
  tex.magFilter = NearestFilter;
  tex.minFilter = srgb ? NearestMipmapLinearFilter : LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 1;
  if (srgb) tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function missingPainter(p: Paint): void {
  p.each((x, y, i) => {
    const on = ((x >> 3) + (y >> 3)) & 1;
    p.setColor(i, on ? [1, 0, 1] : [0.1, 0, 0.1]);
    p.height[i] = 0.5;
  });
}

// Layer 0 is always the "missing" checker so unknown ids are obvious.
registerMaterial("missing", missingPainter);
