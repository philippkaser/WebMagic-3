import { Color } from "three";
import type { Element } from "../../shared/content/types";

/** Element colours for particles and lights (linear, HDR-ish). One place so
 * every effect of an element reads the same. */
export const ELEMENT_COLOR: Record<Element, [number, number, number]> = {
  physical: [0.9, 0.85, 0.75],
  arcane: [0.45, 0.8, 1.6],
  fire: [2.4, 0.9, 0.2],
  frost: [0.6, 1.3, 2.0],
  storm: [1.8, 1.8, 0.6],
  void: [0.9, 0.35, 2.0],
  venom: [0.5, 1.8, 0.3],
  force: [1.3, 1.2, 1.8],
};

export const ELEMENT_HEX: Record<Element, string> = {
  physical: "#e8dcc0",
  arcane: "#8fd8ff",
  fire: "#ff8a2a",
  frost: "#a8e6ff",
  storm: "#f4f7a0",
  void: "#b27cff",
  venom: "#8cff5a",
  force: "#e6d9ff",
};

const tmp = new Color();
/** "#rrggbb" → linear rgb triple times `k`. */
export function hexLinear(hex: string, k = 1): [number, number, number] {
  tmp.set(hex);
  return [tmp.r * k, tmp.g * k, tmp.b * k];
}
