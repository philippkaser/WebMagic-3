/** Two-delver online test: starts the Bun game server (forced encounters,
 * throwaway data dir) and a no-HMR Vite dev server proxying /ws, opens two
 * headless browsers, sends both into the Godwell, and checks they share a
 * floor and see each other. Screenshots → screenshots/mp/.
 *   bun scripts/mp-test.ts */
import { chromium, type Page } from "playwright-core";
import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";

const out = "screenshots/mp";
mkdirSync(out, { recursive: true });
rmSync("/tmp/godwell-mp-data", { recursive: true, force: true });
const server = spawn("bun", ["src/server/bun/main.ts"], { env: { ...process.env, PORT: "8787", DATA_DIR: "/tmp/godwell-mp-data", FORCE_ENCOUNTERS: "1" }, stdio: ["ignore", "pipe", "pipe"] });
const serverLog: string[] = [];
server.stdout.on("data", (d) => serverLog.push(String(d).trim()));
server.stderr.on("data", (d) => serverLog.push(String(d).trim()));
const vite = spawn("./node_modules/.bin/vite", ["--config", "scripts/vite.playtest.config.ts", "--port", "5198", "--strictPort"], { stdio: "ignore" });
const url = "http://localhost:5198";
for (let i = 0; i < 60; i++) {
  try {
    await fetch(url);
    await fetch("http://localhost:8787/health");
    break;
  } catch {
    await Bun.sleep(500);
  }
}

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const logs: string[] = [];
async function delver(name: string): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() !== "warning" && logs.push(`[${name}:${m.type()}] ${m.text()}`));
  page.on("pageerror", (e) => logs.push(`[${name}:pageerror] ${e.message}`));
  await page.goto(`${url}/?autoplay&name=${name}&scale=2`);
  return page;
}

let ok = true;
try {
  const a = await delver("Wren");
  await Bun.sleep(6000);
  const b = await delver("Moth");
  await Bun.sleep(6000);
  for (const [n, pg] of [["A", a], ["B", b]] as const) console.log(n, "build tag:", await pg.evaluate(`document.querySelector(".build")?.textContent`));
  await a.evaluate(`window.game.send({ t: "enter" })`);
  await Bun.sleep(4000);
  await b.evaluate(`window.game.send({ t: "enter" })`);
  await Bun.sleep(5000);
  // Put B right in front of A so they can see each other.
  await b.evaluate(`(() => { const pa = ${JSON.stringify(null)}; })()`);
  const posA = await a.evaluate(`(() => { const p = window.game.player; return [p.pos.x, p.pos.y, p.pos.z, p.yaw]; })()`) as number[];
  await b.evaluate(`(() => { const p = window.game.player; p.teleport(new p.pos.constructor(${posA[0]} - Math.sin(${posA[3]}) * 3, ${posA[1]}, ${posA[2]} - Math.cos(${posA[3]}) * 3)); p.yaw = ${posA[3]} + Math.PI; })()`);
  await Bun.sleep(2500);
  const seenByA = await a.evaluate(`[...window.game.world.entities.values()].filter(e => e.type === 0 && e.id !== window.game.world.selfId).map(e => e.info?.name)`) as string[];
  const seenByB = await b.evaluate(`[...window.game.world.entities.values()].filter(e => e.type === 0 && e.id !== window.game.world.selfId).map(e => e.info?.name)`) as string[];
  console.log("A sees delvers:", seenByA, "B sees delvers:", seenByB);
  for (const [n, pg] of [["A", a], ["B", b]] as const) {
    console.log(n, await pg.evaluate(`(() => { const g = window.game; const w = g.world; const types = {}; for (const e of w?.entities.values() ?? []) types[e.type] = (types[e.type] ?? 0) + 1; return JSON.stringify({ self: w?.selfId, types, pos: [g.player.pos.x, g.player.pos.y, g.player.pos.z].map(v => v.toFixed(1)) }); })()`));
  }
  if (!seenByA.includes("Moth") || !seenByB.includes("Wren")) ok = false;
  await a.screenshot({ path: `${out}/a-sees-b.png` });
  await b.screenshot({ path: `${out}/b-sees-a.png` });
  // Both raise the Open Palm → pact.
  await a.evaluate(`window.game.send({ t: "sign" })`);
  await b.evaluate(`window.game.send({ t: "sign" })`);
  await Bun.sleep(1500);
  const toastsA = await a.evaluate(`[...document.querySelectorAll(".toast")].map(t => t.textContent)`);
  console.log("A toasts:", toastsA);
  await a.screenshot({ path: `${out}/pact.png` });
} catch (e) {
  ok = false;
  console.log("FAILED:", e);
} finally {
  console.log("---- server ----");
  for (const l of serverLog.slice(-15)) console.log(l);
  console.log("---- clients ----");
  for (const l of logs.filter((l) => !l.includes("React DevTools")).slice(0, 30)) console.log(l);
  await browser.close();
  vite.kill();
  server.kill();
  console.log(ok ? "MULTIPLAYER OK" : "MULTIPLAYER FAILED");
  process.exit(ok ? 0 : 1);
}
