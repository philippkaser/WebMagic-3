import { createElement } from "react";
import { createRoot } from "react-dom/client";
import "./gfx/textures/painters";
import "./ui/styles.css";
import { initPhysics } from "../shared/sim/physics";
import { Game } from "./app/Game";
import { Particles } from "./fx/particles";
import { buildSpriteAtlas } from "./gfx/textures/sprites";
import { buildMaterialArrays } from "./gfx/textures/library";
import { Input } from "./input/Input";
import { Renderer } from "./render/Renderer";
import { App } from "./ui/App";

// Content modules self-register on import. (Globs keep boot independent of
// which families exist yet; sheet.ts is a dev page, not a model.)
import.meta.glob(["./gfx/models/**/*.ts", "!./gfx/models/sheet.ts"], { eager: true });
import.meta.glob("../shared/content/lore/index.ts", { eager: true });

/** Bootstrap: paint every material and sprite, start physics, mount the UI,
 * and run the frame loop. */
async function main(): Promise<void> {
  const canvas = document.getElementById("game") as HTMLCanvasElement;
  const t0 = performance.now();
  buildMaterialArrays();
  const atlas = buildSpriteAtlas();
  await initPhysics();
  console.info(`[boot] materials + physics in ${Math.round(performance.now() - t0)} ms`);

  const renderer = new Renderer(canvas);
  const params = new URLSearchParams(location.search);
  if (params.has("scale")) renderer.settings.pixelScale = Number(params.get("scale"));
  const particles = new Particles(atlas);
  const input = new Input(canvas);
  const game = new Game(renderer, particles, input);
  window.addEventListener("resize", () => renderer.resize());
  renderer.resize();

  createRoot(document.getElementById("ui")!).render(createElement(App));
  (window as unknown as { game: Game }).game = game;
  if (params.has("autoplay")) void game.start(params.get("name") ?? "Tester");

  let last = performance.now();
  const loop = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    game.frame(dt);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

void main();
