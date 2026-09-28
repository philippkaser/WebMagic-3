import type { Element, Surface } from "../content/types";

/** Things that happened this tick that clients should see or hear. The sim
 * emits them; the server batches them into each client's frame (optionally
 * filtered by distance); clients turn them into particles, lights, sounds,
 * damage numbers and UI. Tuples keep them compact on the wire. */
export type P3 = [number, number, number];

export type SimEvent =
  | { t: "fx"; fx: string; p: P3; d?: P3; c?: string; s?: number }
  | { t: "sound"; id: string; p?: P3; v?: number }
  | { t: "cast"; by: number; spell: string; p: P3; d: P3; castId: number }
  | { t: "impact"; spell: string; p: P3; n: P3; el: Element; by: number; castId: number; proj: number }
  | { t: "hit"; id: number; amt: number; el: Element; crit: boolean; p: P3; by: number }
  | { t: "explode"; p: P3; r: number; el: Element }
  | { t: "death"; id: number; by: number; p: P3 }
  | { t: "beam"; by: number; from: P3; to: P3; el: Element; dur: number }
  | { t: "chain"; pts: number[]; el: Element }
  | { t: "trap"; id: number; action: string }
  | { t: "surf"; cells: number[] } // [index, kind, index, kind, …] on the surface grid
  | { t: "break"; id: number; def: string; p: P3 }
  | { t: "pickup"; by: number; id: number; name: string; rarity: string; gold: number }
  | { t: "status"; id: number; status: string }
  | { t: "shake"; p: P3; amount: number }
  | { t: "msg"; to: number; text: string; kind: "info" | "warn" | "lore" | "presence" }
  | { t: "warden"; id: number; phase: number; name: string }
  | { t: "open"; id: number };

/** Surface change batch helper type. */
export type SurfaceChange = { index: number; kind: Surface };
