/** Headless playtest: boots the game (offline worker server), enters the
 * Godwell, looks around, casts, and saves screenshots + console output.
 *   bun scripts/playtest.ts [--url http://localhost:3000] [--out screenshots/play]
 * Starts its own Vite dev server unless --url is given. */
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";

const args = process.argv.slice(2);
const arg = (k: string, d: string) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const out = arg("--out", "screenshots/play");
mkdirSync(out, { recursive: true });
let url = arg("--url", "");
let vite: ReturnType<typeof spawn> | null = null;
if (!url) {
  // A production build served statically: immune to HMR reloads while
  // other work edits the tree.
  const port = 5199;
  const outDir = "/tmp/godwell-playtest";
  const build = Bun.spawnSync(["./node_modules/.bin/vite", "build", "--outDir", outDir, "--emptyOutDir", "--logLevel", "error"], { stdout: "inherit", stderr: "inherit" });
  if (build.exitCode !== 0) throw new Error("build failed");
  vite = spawn("./node_modules/.bin/vite", ["preview", "--outDir", outDir, "--port", String(port), "--strictPort"], { stdio: "ignore" });
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
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs: string[] = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}\n${e.stack ?? ""}`));

const scale = arg("--scale", "2");
await page.goto(`${url}/?offline&autoplay&name=Tester&scale=${scale}`);
const shot = async (name: string) => {
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log(`saved ${out}/${name}.png`);
};
const wait = (ms: number) => page.waitForTimeout(ms);
const game = (fn: string) => page.evaluate(fn);

process.on("unhandledRejection", (e) => { console.log("FAILED:", e); for (const l of logs) console.log(l); process.exit(1); });
await wait(8000);
await shot("01-village");
// Walk to the portal and enter.
await game(`window.game.send({ t: "enter" })`);
await wait(6000);
await shot("02-floor-arrival");
// Look around.
for (const [i, yaw] of [0.8, 1.8, 3.2, 4.4].entries()) {
  await game(`(() => { const p = window.game.player; p.yaw += ${yaw}; p.pitch = -0.1; })()`);
  await wait(900);
  await shot(`03-look-${i}`);
}
// Cast a few spells forward.
await game(`(() => { const g = window.game; const p = g.player; for (let k = 0; k < 3; k++) { const e = p.eye(), d = p.aim(); g.send({ t: "cast", slot: "primary", id: 9000 + k, o: [e.x, e.y, e.z], d: [d.x, d.y, d.z] }); } })()`);
await wait(250);
await shot("04-cast");
await game(`(() => { const g = window.game; const p = g.player; const e = p.eye(), d = p.aim(); g.send({ t: "cast", slot: "secondary", id: 9100, o: [e.x, e.y, e.z], d: [d.x, d.y, d.z] }); })()`);
await wait(700);
await shot("05-blast");
try {
  const perf = await game(`(() => { const r = window.game.renderer; return { w: r.width, h: r.height, lights: r.lights.count, calls: r.gl.info.render.calls, tris: r.gl.info.render.triangles }; })()`);
  console.log("perf", JSON.stringify(perf));
} catch (e) {
  console.log("perf probe failed:", (e as Error).message.split("\n")[0]);
}
console.log("---- console ----");
for (const l of logs.slice(0, 120)) console.log(l);
await browser.close();
vite?.kill();
