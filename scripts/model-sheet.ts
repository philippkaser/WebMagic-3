/** Render the procedural models with the real renderer in headless Chromium
 * and save contact sheets:
 *
 *   screenshots/models-<shot>.png
 *
 * Usage: bun scripts/model-sheet.ts [shot-name-prefix…]
 *        bun scripts/model-sheet.ts --url "group=props&px=2" --out props-test
 *
 * Starts its own Vite dev server (port 5188+) and never installs browsers:
 * it uses the preinstalled Chromium under /opt/pw-browsers. */

import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { chromium } from "playwright-core";

const OUT = "screenshots";
const PORT = Number(process.env.SHEET_PORT ?? 5188);

/** name → query string (see src/client/gfx/models/sheet.ts). */
const SHOTS: Record<string, string> = {
  creatures: "group=creatures&at=0.5",
  "creatures-walk": "group=creatures&anim=Walk&at=0.5&t=2.13",
  "creatures-run": "group=creatures&anim=Run&at=0.5&t=2.3",
  "creatures-windup": "group=creatures&anim=Windup&at=0.5",
  "creatures-strike": "group=creatures&anim=Strike&at=0.1",
  "creatures-hurt": "group=creatures&anim=Hurt&at=0.08",
  "creatures-dead": "group=creatures&anim=Dead&at=1.2",
  "creatures-dead-side": "group=creatures&anim=Dead&at=1.2&yaw=1.4",
  "turn-rat": "ids=rat&yaws=0,1.57,3.14,4.3&cols=4&at=0.5",
  "turn-shambler": "ids=shambler&yaws=0,1.57,3.14,4.3&cols=4&at=0.5",
  "turn-wight": "ids=wight&yaws=0,1.57,3.14,4.3&cols=4&at=0.5",
  "turn-sexton": "ids=sexton&yaws=0,1.57,3.14,4.3&cols=4&at=0.5",
  "turn-delver": "ids=delver&yaws=0,1.57,3.14,4.3&cols=4&at=0.5",
  "shambler-fling": "ids=shambler,shambler,shambler&anim=Windup&variant=1&at=0.6&cols=3",
  "sexton-attacks": "ids=sexton,sexton,sexton,sexton&cols=4&anim=Windup&at=0.9",
  "sexton-slam": "ids=sexton,sexton&cols=2&anim=Windup&variant=1&at=1.1",
  "sexton-phase2": "ids=sexton&hp=0.3&at=0.5&cols=1",
  "wight-cast": "ids=wight,wight&anim=Cast&at=0.15&cols=2",
  "rat-feed": "ids=rat,rat,rat&anim=Feed&at=0.5&cols=3",
  delver: "ids=delver,delver,delver,delver&cols=4&at=0.5&look=hood:pointed",
  "delver-looks": "group=delver&at=0.5",
  "delver-cast": "ids=delver,delver&anim=Cast&at=0.12&cols=2",
  "delver-palm": "ids=delver&flags=Palm&at=0.5&cols=1",
  props: "group=props&at=0.5",
  items: "group=items&at=0.5&cols=7",
  fixtures: "group=fixtures&at=0.5",
  traps: "group=traps&at=0.5",
  "traps-sprung": "group=traps&anim=Strike&at=0.25",
  "traps-hidden": "group=traps&flags=Hidden&at=0.5",
  interactables: "group=interactables&at=0.5",
  "interactables-states": "ids=descent,descent,chest,reliquary&flags=Sealed&anim=Open&at=0.8&cols=4",
  "descent-ascend": "ids=descent&flags=CanAscend&at=0.5&cols=1",
  "scene-creatures": "mode=scene&ids=rat,shambler,wight,sexton,delver&at=0.5&dist=5",
  "scene-props": "mode=scene&ids=crate,barrel,barrel_oil,keg_powder,urn,candelabrum,coffin&at=0.5&dist=4",
};
for (const f of ["staff_apprentice", "staff_ember", "wand_rime", "rod_storm", "staff_void", "orb_venom"]) {
  SHOTS[`vm-${f}`] = `mode=vm&focus=${f}&at=0.5`;
}
SHOTS["vm-cast"] = "mode=vm&focus=staff_apprentice&anim=Cast&at=0.06";

function findChrome(): string {
  const root = "/opt/pw-browsers";
  for (const d of readdirSync(root).filter((n) => n.startsWith("chromium-")).sort().reverse()) {
    const p = `${root}/${d}/chrome-linux/chrome`;
    if (existsSync(p)) return p;
  }
  throw new Error("no chromium under /opt/pw-browsers");
}

async function waitFor(url: string, ms: number): Promise<void> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`timeout waiting for ${url}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let shots: [string, string][];
  const ui = args.indexOf("--url");
  if (ui >= 0) {
    const oi = args.indexOf("--out");
    shots = [[oi >= 0 ? args[oi + 1] : "custom", args[ui + 1]]];
  } else {
    shots = Object.entries(SHOTS).filter(([n]) => !args.length || args.some((a) => n.startsWith(a)));
  }
  const width = Number(process.env.SHEET_W ?? 1600);
  const height = Number(process.env.SHEET_H ?? 1000);

  const vite: ChildProcess = spawn("./node_modules/.bin/vite", ["--port", String(PORT), "--strictPort", "--logLevel", "error"], {
    stdio: ["ignore", "inherit", "inherit"],
  });
  const base = `http://localhost:${PORT}`;
  try {
    await waitFor(`${base}/model-sheet.html`, 30000);
    const browser = await chromium.launch({
      executablePath: findChrome(),
      args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    });
    const page = await browser.newPage({ viewport: { width, height } });
    page.on("console", (m) => {
      if (m.type() === "error" || m.type() === "warning") console.log(`  [${m.type()}] ${m.text()}`);
    });
    page.on("pageerror", (e) => console.log(`  [pageerror] ${e.message}`));
    mkdirSync(OUT, { recursive: true });
    for (const [name, qs] of shots) {
      const t0 = Date.now();
      await page.goto(`${base}/model-sheet.html?${qs}`);
      await page.waitForFunction("window.__ready === true", undefined, { timeout: 120000 });
      const stats = (await page.evaluate("window.__stats")) as { id: string; tris: number; height: number }[] | undefined;
      await page.screenshot({ path: `${OUT}/models-${name}.png` });
      const tri = stats?.map((s) => `${s.id}:${s.tris}`).join(" ") ?? "";
      console.log(`models-${name}.png  ${Date.now() - t0}ms  ${tri}`);
    }
    await browser.close();
  } finally {
    vite.kill();
  }
}

await main();
