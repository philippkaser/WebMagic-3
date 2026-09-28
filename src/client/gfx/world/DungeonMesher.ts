import { BufferAttribute, BufferGeometry, Group, Mesh } from "three";
import { CELL, PIT_DEPTH } from "../../../shared/config";
import { surfaceDef } from "../../../shared/content";
import type { BiomeDef } from "../../../shared/content/types";
import { hash01 } from "../../../shared/util/rng";
import { CellKind, type FloorLayout } from "../../../shared/world/layout";
import { surfaceMaterial } from "../../render/materials";
import { hasMaterial, layerOf, worldSizeOf } from "../textures/library";

/** Turns a floor's height grid into renderable geometry, old-dungeon-game
 * style: every open cell gets a floor and a ceiling, every edge where the
 * neighbour is rock or at a different height gets a wall face, pits drop
 * into the dark, pools get a liquid surface. Corners get baked vertex AO so
 * the geometry sits in the light, and walls get a baseboard trim.
 *
 * Output is chunked (CHUNK×CHUNK cells per mesh) for frustum culling. */

const CHUNK = 16;

class ChunkBuilder {
  pos: number[] = [];
  nrm: number[] = [];
  uv: number[] = [];
  layer: number[] = [];
  tint: number[] = [];
  emit: number[] = [];
  idx: number[] = [];

  /** Quad from 4 corners (CCW seen from the front), with per-corner shade. */
  quad(
    c: [number, number, number][],
    n: [number, number, number],
    uvs: [number, number][],
    layer: number,
    shade: [number, number, number, number] = [1, 1, 1, 1],
    emit = 0,
  ): void {
    const base = this.pos.length / 3;
    for (let k = 0; k < 4; k++) {
      this.pos.push(c[k][0], c[k][1], c[k][2]);
      this.nrm.push(n[0], n[1], n[2]);
      this.uv.push(uvs[k][0], uvs[k][1]);
      this.layer.push(layer);
      this.tint.push(shade[k], shade[k], shade[k]);
      this.emit.push(emit);
    }
    // Split along the brighter diagonal so AO gradients don't crease.
    if (shade[0] + shade[2] < shade[1] + shade[3]) this.idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
    else this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  build(): BufferGeometry | null {
    if (!this.pos.length) return null;
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute("normal", new BufferAttribute(new Float32Array(this.nrm), 3));
    g.setAttribute("uv", new BufferAttribute(new Float32Array(this.uv), 2));
    g.setAttribute("aLayer", new BufferAttribute(new Float32Array(this.layer), 1));
    g.setAttribute("aTint", new BufferAttribute(new Float32Array(this.tint), 3));
    g.setAttribute("aEmit", new BufferAttribute(new Float32Array(this.emit), 1));
    g.setIndex(this.pos.length / 3 > 65535 ? new BufferAttribute(new Uint32Array(this.idx), 1) : new BufferAttribute(new Uint16Array(this.idx), 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

const DIRS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function meshDungeon(layout: FloorLayout, biome: BiomeDef): Group {
  const g = layout.grid;
  const group = new Group();
  group.name = "dungeon";
  const mat = surfaceMaterial();
  const pal = biome.palette;
  const pick = (list: string[], i: number) => {
    const id = list[Math.min(i, list.length - 1)] ?? list[0];
    return hasMaterial(id) ? id : fallback(id);
  };
  const L = (id: string) => layerOf(id);
  const WS = (id: string) => worldSizeOf(id);

  const isSolid = (x: number, z: number) => x < 0 || z < 0 || x >= g.w || z >= g.h || g.kind[z * g.w + x] === CellKind.Solid;
  const floorH = (x: number, z: number) => {
    const i = z * g.w + x;
    return g.kind[i] === CellKind.Pit ? PIT_DEPTH : g.floor[i];
  };

  /** Classic voxel corner AO for floor corners: count solid cells around. */
  const cornerAO = (x: number, z: number, cx: number, cz: number, y: number): number => {
    // (cx, cz) ∈ {0,1}²: which corner of cell (x,z).
    const sx = cx ? 1 : -1;
    const sz = cz ? 1 : -1;
    const side1 = isSolid(x + sx, z) || floorH(x + sx, z) > y + 0.4;
    const side2 = isSolid(x, z + sz) || floorH(x, z + sz) > y + 0.4;
    const diag = isSolid(x + sx, z + sz) || floorH(x + sx, z + sz) > y + 0.4;
    const occ = side1 && side2 ? 3 : (side1 ? 1 : 0) + (side2 ? 1 : 0) + (diag ? 1 : 0);
    return 1 - occ * 0.14;
  };

  const chunks = new Map<string, ChunkBuilder>();
  const chunk = (x: number, z: number) => {
    const key = `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`;
    let c = chunks.get(key);
    if (!c) chunks.set(key, (c = new ChunkBuilder()));
    return c;
  };

  for (let z = 0; z < g.h; z++) {
    for (let x = 0; x < g.w; x++) {
      const i = z * g.w + x;
      const kind = g.kind[i];
      if (kind === CellKind.Solid) continue;
      const cb = chunk(x, z);
      const x0 = x * CELL;
      const x1 = x0 + CELL;
      const z0 = z * CELL;
      const z1 = z0 + CELL;
      const fy = floorH(x, z);
      const cy = g.ceil[i];
      const noise = 0.92 + hash01(x, z, 11) * 0.1;

      // Floor.
      const floorId = kind === CellKind.Pit ? pick(pal.wall, 0) : pick(pal.floor, g.floorMat[i]);
      const fws = WS(floorId);
      const ao = [cornerAO(x, z, 0, 0, fy), cornerAO(x, z, 1, 0, fy), cornerAO(x, z, 1, 1, fy), cornerAO(x, z, 0, 1, fy)].map((a) => a * noise * (kind === CellKind.Pit ? 0.25 : 1)) as [number, number, number, number];
      cb.quad(
        [
          [x0, fy, z1],
          [x1, fy, z1],
          [x1, fy, z0],
          [x0, fy, z0],
        ],
        [0, 1, 0],
        [
          [x0 / fws, -z1 / fws],
          [x1 / fws, -z1 / fws],
          [x1 / fws, -z0 / fws],
          [x0 / fws, -z0 / fws],
        ],
        L(floorId),
        [ao[3], ao[2], ao[1], ao[0]],
      );

      // Ceiling.
      const ceilId = pick(pal.ceiling, g.ceilMat[i]);
      const cws = WS(ceilId);
      cb.quad(
        [
          [x0, cy, z0],
          [x1, cy, z0],
          [x1, cy, z1],
          [x0, cy, z1],
        ],
        [0, -1, 0],
        [
          [x0 / cws, z0 / cws],
          [x1 / cws, z0 / cws],
          [x1 / cws, z1 / cws],
          [x0 / cws, z1 / cws],
        ],
        L(ceilId),
        [0.7, 0.7, 0.7, 0.7],
      );

      // Liquid surface.
      if (g.liquid[i]) {
        const sd = surfaceDef(g.liquid[i]);
        const lid = hasMaterial(`surface.${sd.id}`) ? `surface.${sd.id}` : "surface.water";
        const ly = g.liquidLevel[i];
        const lws = WS(lid);
        cb.quad(
          [
            [x0, ly, z1],
            [x1, ly, z1],
            [x1, ly, z0],
            [x0, ly, z0],
          ],
          [0, 1, 0],
          [
            [x0 / lws, -z1 / lws],
            [x1 / lws, -z1 / lws],
            [x1 / lws, -z0 / lws],
            [x0 / lws, -z0 / lws],
          ],
          L(lid),
          [1, 1, 1, 1],
          sd.emissive ?? 0,
        );
      }

      // Edges.
      for (const [dx, dz] of DIRS) {
        const nx = x + dx;
        const nz = z + dz;
        const solid = isSolid(nx, nz);
        // Edge line of this cell facing (dx,dz), CCW when seen from inside.
        const ex0 = dx === 1 ? x1 : dx === -1 ? x0 : dz === 1 ? x1 : x0;
        const ez0 = dz === 1 ? z1 : dz === -1 ? z0 : dx === 1 ? z0 : z1;
        const ex1 = dx === 1 ? x1 : dx === -1 ? x0 : dz === 1 ? x0 : x1;
        const ez1 = dz === 1 ? z1 : dz === -1 ? z0 : dx === 1 ? z1 : z0;
        const n: [number, number, number] = [-dx, 0, -dz];
        // Along-edge texture coordinate from world position.
        const along = (px: number, pz: number) => (dx !== 0 ? pz * -dx : px * dz);

        const face = (yLo: number, yHi: number, id: string, shadeLo: number, shadeHi: number) => {
          if (yHi - yLo < 0.01) return;
          const ws = WS(id);
          cb.quad(
            [
              [ex0, yLo, ez0],
              [ex1, yLo, ez1],
              [ex1, yHi, ez1],
              [ex0, yHi, ez0],
            ],
            n,
            [
              [along(ex0, ez0) / ws, yLo / ws],
              [along(ex1, ez1) / ws, yLo / ws],
              [along(ex1, ez1) / ws, yHi / ws],
              [along(ex0, ez0) / ws, yHi / ws],
            ],
            L(id),
            [shadeLo, shadeLo, shadeHi, shadeHi],
          );
        };

        if (solid) {
          const wi = nx >= 0 && nz >= 0 && nx < g.w && nz < g.h ? nz * g.w + nx : i;
          const wallId = pick(pal.wall, g.wallMat[wi]);
          const shadeBase = 0.9 + hash01(nx, nz, 7) * 0.1;
          face(fy, cy, wallId, shadeBase * 0.72, shadeBase * 0.95);
          if (kind === CellKind.Open && pal.trim.length) baseboard(cb, ex0, ez0, ex1, ez1, fy, n, L(pick(pal.trim, 0)), WS(pick(pal.trim, 0)));
          continue;
        }
        const nfy = floorH(nx, nz);
        const ni = nz * g.w + nx;
        // Our floor is higher: a step face visible from the neighbour.
        if (fy > nfy + 0.01) {
          const tall = fy - nfy > 0.6;
          const id = tall ? pick(pal.wall, g.wallMat[i]) : pick(pal.floor, g.floorMat[i]);
          // Faces toward the neighbour: flip the normal and winding.
          const ws = WS(id);
          cb.quad(
            [
              [ex1, nfy, ez1],
              [ex0, nfy, ez0],
              [ex0, fy, ez0],
              [ex1, fy, ez1],
            ],
            [dx, 0, dz],
            [
              [along(ex1, ez1) / ws, nfy / ws],
              [along(ex0, ez0) / ws, nfy / ws],
              [along(ex0, ez0) / ws, fy / ws],
              [along(ex1, ez1) / ws, fy / ws],
            ],
            L(id),
            [0.6, 0.6, 0.9, 0.9],
          );
        }
        // Our ceiling is lower than the neighbour's: a lintel face.
        const ncy = g.ceil[ni];
        if (cy < ncy - 0.01) {
          const id = pick(pal.wall, g.wallMat[i]);
          const ws = WS(id);
          cb.quad(
            [
              [ex1, cy, ez1],
              [ex0, cy, ez0],
              [ex0, ncy, ez0],
              [ex1, ncy, ez1],
            ],
            [dx, 0, dz],
            [
              [along(ex1, ez1) / ws, cy / ws],
              [along(ex0, ez0) / ws, cy / ws],
              [along(ex0, ez0) / ws, ncy / ws],
              [along(ex1, ez1) / ws, ncy / ws],
            ],
            L(id),
            [0.85, 0.85, 0.7, 0.7],
          );
        }
      }
    }
  }

  for (const cb of chunks.values()) {
    const geo = cb.build();
    if (!geo) continue;
    const m = new Mesh(geo, mat);
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    group.add(m);
  }
  return group;
}

/** A thin skirting strip where wall meets floor — cheap detail that makes
 * rooms read as built rather than carved. */
function baseboard(cb: ChunkBuilder, ex0: number, ez0: number, ex1: number, ez1: number, fy: number, n: [number, number, number], layer: number, ws: number): void {
  const h = 0.16;
  const d = 0.05;
  const ox = n[0] * d;
  const oz = n[2] * d;
  const along = (px: number, pz: number) => (px + pz) / ws;
  // Front face.
  cb.quad(
    [
      [ex0 + ox, fy, ez0 + oz],
      [ex1 + ox, fy, ez1 + oz],
      [ex1 + ox, fy + h, ez1 + oz],
      [ex0 + ox, fy + h, ez0 + oz],
    ],
    n,
    [
      [along(ex0, ez0), 0],
      [along(ex1, ez1), 0],
      [along(ex1, ez1), h / ws],
      [along(ex0, ez0), h / ws],
    ],
    layer,
    [0.55, 0.55, 0.8, 0.8],
  );
  // Top face.
  cb.quad(
    [
      [ex0 + ox, fy + h, ez0 + oz],
      [ex1 + ox, fy + h, ez1 + oz],
      [ex1, fy + h, ez1],
      [ex0, fy + h, ez0],
    ],
    [0, 1, 0],
    [
      [along(ex0, ez0), 0],
      [along(ex1, ez1), 0],
      [along(ex1, ez1), d / ws],
      [along(ex0, ez0), d / ws],
    ],
    layer,
    [0.85, 0.85, 0.85, 0.85],
  );
}

/** Missing biome material → closest generic one, so a half-painted biome
 * still renders sensibly. */
function fallback(id: string): string {
  if (id.includes("floor") || id.includes("slab") || id.includes("parquet") || id.includes("tile")) return hasMaterial("stone.cobble") ? "stone.cobble" : "missing";
  if (id.includes("ceil")) return hasMaterial("stone.rough") ? "stone.rough" : "missing";
  if (id.includes("trim") || id.includes("beam")) return hasMaterial("wood.beam") ? "wood.beam" : "missing";
  return hasMaterial("stone.rough") ? "stone.rough" : "missing";
}
