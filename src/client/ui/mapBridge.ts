import type { FloorLayout } from "../../shared/world/layout";

/** Live data the map panel draws from; the Game installs the provider. */
export interface MapData {
  layout: FloorLayout;
  seen: Uint8Array;
  player: { x: number; z: number; yaw: number };
  markers: { x: number; z: number; kind: "descent" | "arrival" | "ally" | "reliquary" | "chest" }[];
}

let provider: (() => MapData | null) | null = null;

export function setMapProvider(fn: (() => MapData | null) | null): void {
  provider = fn;
}

export function mapData(): MapData | null {
  return provider?.() ?? null;
}
