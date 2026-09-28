import { CellKind, type FloorLayout } from "../../shared/world/layout";

/** What the delver has seen of this floor: cells within sight (grid
 * line-of-sight from the eye) become explored. Feeds the floor map. */
export class Exploration {
  readonly seen: Uint8Array;
  private acc = 0;
  version = 0;

  constructor(readonly layout: FloorLayout) {
    this.seen = new Uint8Array(layout.grid.w * layout.grid.h);
  }

  update(dt: number, x: number, y: number, z: number, radius = 9): void {
    this.acc += dt;
    if (this.acc < 0.2) return;
    this.acc = 0;
    const g = this.layout.grid;
    const cx = Math.floor(x);
    const cz = Math.floor(z);
    const r = Math.ceil(radius);
    let changed = false;
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const tx = cx + dx;
        const tz = cz + dz;
        if (tx < 0 || tz < 0 || tx >= g.w || tz >= g.h) continue;
        const i = tz * g.w + tx;
        if (this.seen[i] || dx * dx + dz * dz > radius * radius) continue;
        if (this.visible(x, y, z, tx + 0.5, tz + 0.5)) {
          this.seen[i] = 1;
          changed = true;
          // Walls bordering a seen cell are seen too.
          for (const [ox, oz] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            const nx = tx + ox;
            const nz = tz + oz;
            if (nx >= 0 && nz >= 0 && nx < g.w && nz < g.h && g.kind[nz * g.w + nx] === CellKind.Solid) this.seen[nz * g.w + nx] = 1;
          }
        }
      }
    }
    if (changed) this.version++;
  }

  private visible(x0: number, y0: number, z0: number, x1: number, z1: number): boolean {
    const g = this.layout.grid;
    const dx = x1 - x0;
    const dz = z1 - z0;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.4));
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const i = Math.floor(z0 + dz * t) * g.w + Math.floor(x0 + dx * t);
      if (g.kind[i] === CellKind.Solid) return false;
      if (g.kind[i] === CellKind.Open && g.floor[i] > y0) return false;
    }
    return true;
  }
}
