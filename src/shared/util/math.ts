/** Minimal vector math for the pure layers (sim, world gen, net). The client
 * uses three.js math; shared code must not import three. */

export interface V3 {
  x: number;
  y: number;
  z: number;
}

export type Tuple3 = [number, number, number];

export const v3 = (x = 0, y = 0, z = 0): V3 => ({ x, y, z });
export const v3copy = (a: V3): V3 => ({ x: a.x, y: a.y, z: a.z });
export const v3set = (o: V3, x: number, y: number, z: number): V3 => {
  o.x = x;
  o.y = y;
  o.z = z;
  return o;
};
export const v3add = (a: V3, b: V3): V3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const v3sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const v3scale = (a: V3, s: number): V3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const v3dot = (a: V3, b: V3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const v3len = (a: V3): number => Math.hypot(a.x, a.y, a.z);
export const v3dist = (a: V3, b: V3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const v3dist2 = (a: V3, b: V3): number =>
  (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
/** Horizontal (xz) distance. */
export const v3distXZ = (a: V3, b: V3): number => Math.hypot(a.x - b.x, a.z - b.z);
export const v3norm = (a: V3): V3 => {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};
export const v3lerp = (a: V3, b: V3, t: number): V3 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
});
export const v3tuple = (a: V3): Tuple3 => [a.x, a.y, a.z];
export const v3from = (t: readonly number[]): V3 => ({ x: t[0], y: t[1], z: t[2] });

/** Direction from yaw/pitch (radians). Yaw 0 looks down -Z, like three.js. */
export function dirFromAngles(yaw: number, pitch: number): V3 {
  const cp = Math.cos(pitch);
  return { x: -Math.sin(yaw) * cp, y: Math.sin(pitch), z: -Math.cos(yaw) * cp };
}

/** Yaw that faces along (dx, dz) — inverse of dirFromAngles' horizontal part. */
export function yawOf(dx: number, dz: number): number {
  return Math.atan2(-dx, -dz);
}

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
/** Shortest signed angle from a to b. */
export const angleDelta = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
/** Frame-rate independent exponential approach. */
export const damp = (current: number, target: number, rate: number, dt: number) =>
  target + (current - target) * Math.exp(-rate * dt);
