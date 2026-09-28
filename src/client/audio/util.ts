/** Small math / randomness helpers shared by the audio modules. Randomness is
 * deliberately `Math.random`: every play should sound a little different. */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const rand = (a: number, b: number): number => a + Math.random() * (b - a);
export const randi = (a: number, b: number): number => Math.floor(rand(a, b + 1));
export const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)] as T;
export const chance = (p: number): boolean => Math.random() < p;
/** `v` randomised by ±`amt` (relative). */
export const jit = (v: number, amt: number): number => v * (1 + rand(-amt, amt));
export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** Frequency ratio of `n` equal-tempered semitones. */
export const semi = (n: number): number => Math.pow(2, n / 12);
export const dbToGain = (db: number): number => Math.pow(10, db / 20);

export function dist3(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

const warned = new Set<string>();
/** console.warn a message only the first time `key` is seen. */
export function warnOnce(key: string, msg: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[audio] ${msg}`);
}

/** Random times in [0, span), sorted; `skew` > 1 bunches them near the start
 * (debris, shards and splinters are densest right after the impact). */
export function scatterTimes(n: number, span: number, skew = 1): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(span * Math.pow(Math.random(), skew));
  return out.sort((a, b) => a - b);
}
