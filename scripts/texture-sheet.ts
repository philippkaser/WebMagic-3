/** Paint every registered material (no GPU) and write contact sheets:
 *
 *   screenshots/textures-albedo.png     every material, 2×2 tiled (seams show)
 *   screenshots/textures-channels.png   normal | roughness | metalness | emissive
 *   screenshots/textures-lit.png        every material under a fake raking light
 *   screenshots/textures/page-NN.png    2× zoom pages: albedo 2×2 + lit 2×2
 *   screenshots/sprites.png             the particle sprite atlas at 4×
 *
 * Usage: bun scripts/texture-sheet.ts [id-prefix…]   (prefixes limit pages)
 * Also reports paint time per material and flags edges that don't tile. */

import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import "../src/client/gfx/textures/painters";
import { materialIds, paintMaterial, TEX_SIZE } from "../src/client/gfx/textures/library";
import { cavityAO, heightToNormal } from "../src/client/gfx/textures/paint";
import { buildSpriteAtlas } from "../src/client/gfx/textures/sprites";

const S = TEX_SIZE;
const OUT = "screenshots";
const prefixes = process.argv.slice(2);

// ─── PNG ────────────────────────────────────────────────────────────────────

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
function encodePNG(w: number, h: number, rgb: Uint8Array): Uint8Array {
  const raw = new Uint8Array(h * (w * 3 + 1));
  for (let y = 0; y < h; y++) raw.set(rgb.subarray(y * w * 3, (y + 1) * w * 3), y * (w * 3 + 1) + 1);
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", new Uint8Array(deflateSync(raw))),
    chunk("IEND", new Uint8Array(0)),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

// ─── Canvas + 3×5 font ──────────────────────────────────────────────────────

const FONT: Record<string, string> = {
  a: " # # ##### ## #", b: "## # ### # ### ", c: " ###  #  #   ##", d: "## # ## ## ### ",
  e: "####  ## #  ###", f: "####  ## #  #  ", g: " ###  # ## # ##", h: "# ## ##### ## #",
  i: "### #  #  # ###", j: "  #  #  ## # # ", k: "# ## ### # ## #", l: "#  #  #  #  ###",
  m: "# ####### ## ##", n: "## # ## ## ## #", o: " # # ## ## # # ", p: "## # ### #  #  ",
  q: " # # ## ### ##", r: "## # ### # ## #", s: " ###   #   ### ", t: "### #  #  #  # ",
  u: "# ## ## ## ####", v: "# ## ## ## # # ", w: "# ## ###### # #", x: "# ## # # # ## #",
  y: "# ## # #  #  # ", z: "###  # # #  ###", "0": "#### ## ## ####", "1": " # ##  #  # ###",
  "2": "##   # # #  ###", "3": "##   # #   ### ", "4": "# ## ####  #  #", "5": "####  ##   ### ",
  "6": " ###  #### ####", "7": "###  # #  #  # ", "8": "#### ##### ####", "9": "#### ####  ### ",
  ".": "             # ", _: "            ###", "-": "      ###      ",
};

class Canvas {
  readonly data: Uint8Array;
  constructor(
    readonly w: number,
    readonly h: number,
    bg: [number, number, number] = [24, 22, 26],
  ) {
    this.data = new Uint8Array(w * h * 3);
    for (let i = 0; i < w * h; i++) this.data.set(bg, i * 3);
  }
  px(x: number, y: number, r: number, g: number, b: number): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const o = (y * this.w + x) * 3;
    this.data[o] = r;
    this.data[o + 1] = g;
    this.data[o + 2] = b;
  }
  /** Blit an S×S RGB tile tiled nx×ny times at integer zoom. */
  tile(x0: number, y0: number, rgb: Uint8Array, nx: number, ny: number, zoom: number): void {
    for (let y = 0; y < S * ny * zoom; y++)
      for (let x = 0; x < S * nx * zoom; x++) {
        const sx = Math.floor(x / zoom) % S;
        const sy = Math.floor(y / zoom) % S;
        const o = (sy * S + sx) * 3;
        this.px(x0 + x, y0 + y, rgb[o], rgb[o + 1], rgb[o + 2]);
      }
  }
  text(x0: number, y0: number, s: string, c: [number, number, number] = [200, 196, 180]): void {
    let x = x0;
    for (const ch of s.toLowerCase()) {
      const g = FONT[ch];
      if (g)
        for (let k = 0; k < 15; k++) if (g[k] === "#") this.px(x + (k % 3), y0 + Math.floor(k / 3), c[0], c[1], c[2]);
      x += 4;
    }
  }
  save(path: string): void {
    writeFileSync(path, encodePNG(this.w, this.h, this.data));
  }
}

// ─── Paint everything ───────────────────────────────────────────────────────

interface Painted {
  id: string;
  albedo: Uint8Array;
  lit: Uint8Array;
  normal: Uint8Array;
  rough: Uint8Array;
  metal: Uint8Array;
  emit: Uint8Array;
  ms: number;
}

const to8 = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const srgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

const painted: Painted[] = [];
let totalMs = 0;
const ids = materialIds();
for (const id of ids) {
  const t0 = performance.now();
  const r = paintMaterial(id)!;
  const p = r.paint;
  const nrm = heightToNormal(p, r.opts.normal ?? 2);
  const ao = cavityAO(p, r.opts.ao ?? 1);
  const ms = performance.now() - t0;
  totalMs += ms;
  const glow = r.opts.glow ?? 2;
  const albedo = new Uint8Array(S * S * 3);
  const lit = new Uint8Array(S * S * 3);
  const normal = new Uint8Array(S * S * 3);
  const rough = new Uint8Array(S * S * 3);
  const metal = new Uint8Array(S * S * 3);
  const emit = new Uint8Array(S * S * 3);
  const L = [-0.5, 0.55, 0.67];
  const ll = Math.hypot(L[0], L[1], L[2]);
  const H = [L[0] / ll, L[1] / ll, L[2] / ll + 1];
  const hl = Math.hypot(H[0], H[1], H[2]);
  for (let i = 0; i < S * S; i++) {
    const cut = r.opts.cutout && p.alpha[i] < 0.5;
    const a = [p.albedo[i * 3], p.albedo[i * 3 + 1], p.albedo[i * 3 + 2]];
    for (let k = 0; k < 3; k++) albedo[i * 3 + k] = cut ? ((i + (i >> 6)) & 4 ? 60 : 40) : to8(a[k]);
    const n = [nrm[i * 4] / 127.5 - 1, nrm[i * 4 + 1] / 127.5 - 1, nrm[i * 4 + 2] / 127.5 - 1];
    normal.set([nrm[i * 4], nrm[i * 4 + 1], nrm[i * 4 + 2]], i * 3);
    rough.fill(to8(p.rough[i]), i * 3, i * 3 + 3);
    metal.fill(to8(p.metal[i]), i * 3, i * 3 + 3);
    for (let k = 0; k < 3; k++) emit[i * 3 + k] = to8(a[k] * p.emit[i]);
    const ndl = Math.max(0, (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / ll);
    const ndh = Math.max(0, (n[0] * H[0] + n[1] * H[1] + n[2] * H[2]) / hl);
    const rr = Math.max(0.04, p.rough[i]);
    const shin = 2 / (rr * rr * rr * rr) - 2;
    const spec = Math.pow(ndh, Math.min(shin, 2000)) * (1 - rr) * (1 - rr) * 3;
    const m = p.metal[i];
    for (let k = 0; k < 3; k++) {
      const al = lin(a[k]);
      const f0 = 0.04 * (1 - m) + al * m;
      let c = al * (1 - m) * (0.1 * ao[i] + ndl * 1.1 * ao[i]) + f0 * spec * ndl + al * m * 0.15 * ao[i];
      c += al * p.emit[i] * glow * 0.6;
      lit[i * 3 + k] = cut ? albedo[i * 3 + k] : to8(srgb(Math.min(1, c)));
    }
  }
  painted.push({ id, albedo, lit, normal, rough, metal, emit, ms });

  // Seam check: edge-to-edge difference vs typical neighbour difference.
  const lum = (x: number, y: number) => {
    const o = (((y + S) % S) * S + ((x + S) % S)) * 3;
    return albedo[o] * 0.3 + albedo[o + 1] * 0.59 + albedo[o + 2] * 0.11;
  };
  // A column/row pair across the wrap edge should look like any other
  // adjacent pair: flag it when it differs more than the strongest interior
  // transition (joints legitimately sit on the border).
  const pairDiff = (a: number, b: number, vertical: boolean) => {
    let d = 0;
    for (let k = 0; k < S; k++) d += vertical ? Math.abs(lum(k, a) - lum(k, b)) : Math.abs(lum(a, k) - lum(b, k));
    return d / S;
  };
  let maxX = 0;
  let maxY = 0;
  for (let j = 0; j < S - 1; j++) {
    maxX = Math.max(maxX, pairDiff(j, j + 1, false));
    maxY = Math.max(maxY, pairDiff(j, j + 1, true));
  }
  const seamX = pairDiff(S - 1, 0, false);
  const seamY = pairDiff(S - 1, 0, true);
  if (seamX > maxX * 1.15 + 2 || seamY > maxY * 1.15 + 2)
    console.warn(`  seam? ${id}  x:${seamX.toFixed(1)}/${maxX.toFixed(1)} y:${seamY.toFixed(1)}/${maxY.toFixed(1)}`);
}

const slow = [...painted].sort((a, b) => b.ms - a.ms).slice(0, 8);
console.log(`${painted.length} materials painted in ${totalMs.toFixed(0)} ms (incl. normal+AO)`);
console.log("slowest:", slow.map((p) => `${p.id} ${p.ms.toFixed(1)}ms`).join(", "));

mkdirSync(`${OUT}/textures`, { recursive: true });

// ─── Overview sheets ────────────────────────────────────────────────────────

{
  const cols = 10;
  const cw = S * 2 + 8;
  const ch = S * 2 + 14;
  const rows = Math.ceil(painted.length / cols);
  for (const [name, key] of [
    ["albedo", "albedo"],
    ["lit", "lit"],
  ] as const) {
    const c = new Canvas(cols * cw + 8, rows * ch + 8);
    painted.forEach((m, k) => {
      const x = 8 + (k % cols) * cw;
      const y = 8 + Math.floor(k / cols) * ch;
      c.tile(x, y, m[key], 2, 2, 1);
      c.text(x, y + S * 2 + 3, m.id.slice(0, 32));
    });
    c.save(`${OUT}/textures-${name}.png`);
  }
}
{
  const cols = 5;
  const cw = S * 4 + 3 * 2 + 12;
  const ch = S + 14;
  const rows = Math.ceil(painted.length / cols);
  const c = new Canvas(cols * cw + 8, rows * ch + 8);
  painted.forEach((m, k) => {
    const x = 8 + (k % cols) * cw;
    const y = 8 + Math.floor(k / cols) * ch;
    c.tile(x, y, m.normal, 1, 1, 1);
    c.tile(x + S + 2, y, m.rough, 1, 1, 1);
    c.tile(x + 2 * (S + 2), y, m.metal, 1, 1, 1);
    c.tile(x + 3 * (S + 2), y, m.emit, 1, 1, 1);
    c.text(x, y + S + 3, m.id);
  });
  c.save(`${OUT}/textures-channels.png`);
}

// ─── Zoomed pages ───────────────────────────────────────────────────────────

{
  const pick = prefixes.length ? painted.filter((m) => prefixes.some((p) => m.id.startsWith(p))) : painted;
  const perPage = 6;
  const zoom = 2;
  const block = S * 2 * zoom;
  const cw = block * 2 + 16;
  const ch = block + 16;
  for (let pg = 0; pg * perPage < pick.length; pg++) {
    const items = pick.slice(pg * perPage, (pg + 1) * perPage);
    const c = new Canvas(cw * 2 + 8, ch * Math.ceil(items.length / 2) + 8);
    items.forEach((m, k) => {
      const x = 8 + (k % 2) * cw;
      const y = 8 + Math.floor(k / 2) * ch;
      c.tile(x, y, m.albedo, 2, 2, zoom);
      c.tile(x + block + 4, y, m.lit, 2, 2, zoom);
      c.text(x, y + block + 4, m.id);
    });
    c.save(`${OUT}/textures/page-${String(pg + 1).padStart(2, "0")}.png`);
  }
  console.log(`wrote ${Math.ceil(pick.length / perPage)} zoom pages to ${OUT}/textures/`);
}

// ─── Sprites ────────────────────────────────────────────────────────────────

{
  const t0 = performance.now();
  const atlas = buildSpriteAtlas();
  console.log(`sprite atlas ${atlas.size}px, ${atlas.rects.size} sprites in ${(performance.now() - t0).toFixed(1)} ms`);
  const img = atlas.texture.image as { data: Uint8Array; width: number; height: number };
  const zoom = 4;
  const cell = 16 * zoom + 12;
  const names = [...atlas.rects.keys()];
  const cols = 10;
  const c = new Canvas(cols * cell * 2 + 8, Math.ceil(names.length / cols) * (cell + 8) + 8, [18, 18, 22]);
  names.forEach((name, k) => {
    const [u0, , , v1] = atlas.rects.get(name)!;
    const sx0 = Math.round(u0 * img.width);
    // Rects are UVs with v up; the sprite's top row is the data row just
    // below v1.
    const topRow = Math.round(v1 * img.height) - 1;
    for (const [bgi, bg] of [
      [0, [18, 18, 22]],
      [1, [120, 110, 100]],
    ] as const) {
      const x0 = 8 + (k % cols) * cell * 2 + bgi * (16 * zoom + 2);
      const y0 = 8 + Math.floor(k / cols) * (cell + 8);
      for (let y = 0; y < 16 * zoom; y++)
        for (let x = 0; x < 16 * zoom; x++) {
          const sx = sx0 + Math.floor(x / zoom);
          const o = ((topRow - Math.floor(y / zoom)) * img.width + sx) * 4;
          const a = img.data[o + 3] / 255;
          c.px(
            x0 + x,
            y0 + y,
            Math.round(bg[0] * (1 - a) + img.data[o] * a),
            Math.round(bg[1] * (1 - a) + img.data[o + 1] * a),
            Math.round(bg[2] * (1 - a) + img.data[o + 2] * a),
          );
        }
      if (bgi === 0) c.text(x0, y0 + 16 * zoom + 2, name);
    }
  });
  c.save(`${OUT}/sprites.png`);
}
