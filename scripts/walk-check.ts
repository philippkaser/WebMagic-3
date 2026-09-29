/** Headless smoke test for the one thing that must never break: standing on
 * the ground. Boots the game (offline worker server), walks the delver around
 * the village and then a dungeon floor with real key presses, and fails if it
 * ever sinks below the ground it should be standing on.
 *   bun scripts/walk-check.ts [--url http://localhost:3000] */
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const urlArg = args.indexOf("--url");
let url = urlArg >= 0 ? args[urlArg + 1] : "";
let vite: ReturnType<typeof spawn> | null = null;
if (!url) {
  const port = 5196;
  vite = spawn("./node_modules/.bin/vite", ["--config", "scripts/vite.playtest.config.ts", "--port", String(port), "--strictPort"], { stdio: "ignore" });
  url = `http://localhost:${port}`;
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(url);
      break;
    } catch {
      await Bun.sleep(500);
    }
  }
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${url}/?offline&autoplay&name=Walker&scale=3`);

const until = async (expr: string, ms = 30000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await page.evaluate(expr).catch(() => false)) return;
    await page.waitForTimeout(250);
  }
  throw new Error(`timed out waiting for ${expr}`);
};

interface Sample { y: number; ground: number | null; grounded: boolean }

/** Hold W (and wiggle the heading) for `secs`, sampling height vs. ground. */
async function walk(label: string, secs: number): Promise<Sample[]> {
  // Headless Chromium can't take pointer lock; pretend we have it.
  await page.evaluate(`Object.defineProperty(window.game.input, "locked", { get: () => true, configurable: true })`);
  await page.keyboard.down("KeyW");
  const samples: Sample[] = [];
  for (let t = 0; t < secs * 4; t++) {
    if (t % 6 === 0) await page.evaluate(`window.game?.player && (window.game.player.yaw += ${(Math.random() - 0.5) * 2.4})`);
    await page.waitForTimeout(250);
    const sample = (await page.evaluate(`(() => {
        const g = window.game;
        if (!g || !g.player || !g.player.world) return null;
        const p = g.player.pos;
        const layout = g.dungeon?.layout;
        let ground = null;
        if (layout) {
          const G = layout.grid, cx = Math.floor(p.x), cz = Math.floor(p.z);
          if (cx >= 0 && cz >= 0 && cx < G.w && cz < G.h && G.kind[cz * G.w + cx] === 1) ground = G.floor[cz * G.w + cx];
        }
        return { y: p.y, ground, grounded: g.player.grounded };
      })()`)) as Sample | null;
    if (sample) samples.push(sample);
  }
  if (samples.length < secs * 2) throw new Error(`${label}: the game wasn't running for most of the walk`);
  await page.keyboard.up("KeyW");
  const grounded = samples.filter((s) => s.grounded).length / samples.length;
  const lowest = Math.min(...samples.map((s) => s.y));
  console.log(`${label}: ${samples.length} samples, grounded ${(grounded * 100).toFixed(0)}%, lowest y ${lowest.toFixed(2)}`);
  return samples;
}

let failed = false;
const fail = (msg: string) => {
  failed = true;
  console.log(`FAIL: ${msg}`);
};

try {
  await until(`!!(window.game && window.game.player && window.game.player.world && window.game.village)`, 60000);
  await page.waitForTimeout(3000);
  await until(`!!(window.game && window.game.player && window.game.player.world && window.game.village)`, 60000);
  const spawnY = (await page.evaluate(`window.game.player.pos.y`)) as number;
  const village = await walk("village", 6);
  if (village.some((s) => s.y < spawnY - 20)) fail("fell out of the village");
  if (village.filter((s) => s.grounded).length < village.length * 0.6) fail("village: mostly airborne");

  await page.evaluate(`window.game.send({ t: "enter" })`);
  await until(`!!(window.game.dungeon && window.game.player.world)`);
  await page.waitForTimeout(1500);
  const floor = await walk("floor", 8);
  const sunk = floor.filter((s) => s.ground !== null && s.y < s.ground + 0.3);
  if (sunk.length) fail(`floor: ${sunk.length} samples below solid ground (e.g. y ${sunk[0].y.toFixed(2)} over ${sunk[0].ground})`);
} catch (e) {
  fail((e as Error).message);
}
for (const e of errors.slice(0, 10)) console.log(`[pageerror] ${e}`);
console.log(failed ? "WALK CHECK FAILED" : "WALK CHECK OK");
await browser.close();
vite?.kill();
process.exit(failed ? 1 : 0);
