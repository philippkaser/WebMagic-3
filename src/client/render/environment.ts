import type { BiomeDef } from "../../shared/content/types";
import { DEFAULT_ENV, type Environment } from "./Renderer";

/** Environments: how the air of a place looks. Strata derive theirs from
 * BiomeDef.lighting; the village has its own moonlit night. */

export function biomeEnvironment(b: BiomeDef): Environment {
  const L = b.lighting;
  return {
    ...DEFAULT_ENV,
    ambientSky: L.ambient,
    ambientGround: shade(L.ambient, 0.45),
    ambientIntensity: L.ambientIntensity,
    fogColor: L.fogColor,
    fogDensity: L.fogDensity,
    fogHeight: 0,
    haze: L.haze,
    sky: null,
    sun: null,
    grade: L.grade,
  };
}

export const VILLAGE_ENV: Environment = {
  ...DEFAULT_ENV,
  ambientSky: "#3a4262",
  ambientGround: "#15141c",
  ambientIntensity: 0.55,
  fogColor: "#141722",
  fogDensity: 0.022,
  fogHeight: 4,
  haze: 0.9,
  sky: { top: "#05060c", horizon: "#1c2233", stars: 1 },
  sun: { dir: [-0.35, -0.8, 0.45], color: "#8ea4d8", intensity: 0.55, shadow: true },
  moonDir: [0.35, 0.55, -0.45],
  exposure: 1.15,
  bloom: 0.09,
  bloomThreshold: 0.85,
  grade: { shadows: "#c8d4ff", highlights: "#ffe8c8", saturation: 0.8, contrast: 1.08 },
  vignette: 1.2,
  grain: 0.03,
};

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * k);
  const g = Math.round(((n >> 8) & 255) * k);
  const b = Math.round((n & 255) * k);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
