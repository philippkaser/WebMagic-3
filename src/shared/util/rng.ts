/** Seeded, deterministic randomness. Everything gameplay-relevant that must
 * agree between machines (floor layouts, spawn tables, loot rolled from a
 * seed) draws from an `Rng`; cosmetic jitter may use Math.random. */

/** 32-bit string hash (FNV-1a). Stable across platforms. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Integer hash of up to three ints (+ seed) → uint32. Used by noise and by
 * anything that needs a stateless "random value at this cell". */
export function hash3(x: number, y: number, z: number, seed = 0): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (x | 0), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13) ^ (y | 0), 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 16) ^ (z | 0), 0x27d4eb2f);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return h >>> 0;
}

/** hash3 mapped to [0, 1). */
export function hash01(x: number, y: number, z = 0, seed = 0): number {
  return hash3(x, y, z, seed) / 4294967296;
}

/** mulberry32 generator. Small, fast, good enough for games. */
export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max] (inclusive). */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  /** ±1 */
  sign(): number {
    return this.next() < 0.5 ? -1 : 1;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  /** Weighted pick. Items with weight <= 0 are never chosen. */
  weighted<T>(items: readonly T[], weight: (item: T) => number): T {
    let total = 0;
    for (const it of items) total += Math.max(0, weight(it));
    let r = this.next() * total;
    for (const it of items) {
      const w = Math.max(0, weight(it));
      if (w <= 0) continue;
      r -= w;
      if (r <= 0) return it;
    }
    return items[items.length - 1];
  }

  /** In-place Fisher–Yates. */
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = items[i];
      items[i] = items[j];
      items[j] = tmp;
    }
    return items;
  }

  /** Gaussian-ish (sum of 3 uniforms), mean 0, roughly [-1.5, 1.5]. */
  gauss(): number {
    return this.next() + this.next() + this.next() - 1.5;
  }

  /** Independent child stream. Drawing from a fork never perturbs the
   * parent — generators use forks per phase so adding content to one phase
   * keeps every other phase of a seed stable. */
  fork(salt: string | number): Rng {
    const s = typeof salt === "string" ? hashString(salt) : salt >>> 0;
    return new Rng(hash3(this.s, s, 0x5eed));
  }

  /** A fresh uint32 (for seeding sub-systems). */
  seed(): number {
    return Math.floor(this.next() * 4294967296) >>> 0;
  }
}

/** Random uint32 seed from the platform (non-deterministic). */
export function randomSeed(): number {
  return (Math.random() * 4294967296) >>> 0;
}
