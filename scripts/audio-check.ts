/** Headless audio check: serves audio-demo.html with Vite, loads it in
 * Chromium, fails on console errors, renders every cue / voice / bed /
 * stinger through an OfflineAudioContext (peak + RMS; flags silent and
 * clipping renders), runs the full engine chain offline, then plays
 * everything live as a smoke test.
 *
 *   bun scripts/audio-check.ts [--json out.json]
 */

import { chromium } from "playwright-core";
import { createServer } from "vite";

const CHROME = process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

interface Level {
  id: string;
  kind: string;
  peak: number;
  rms: number;
  dur: number;
  status: "ok" | "quiet" | "silent" | "clip" | "error";
  note?: string;
}

const server = await createServer({
  configFile: "vite.config.ts",
  logLevel: "error",
  server: { port: 3170, strictPort: false, host: "127.0.0.1", hmr: false },
  optimizeDeps: { entries: ["audio-demo.html"] },
});
await server.listen();
const base = server.resolvedUrls?.local[0] ?? "http://127.0.0.1:3170/";

const browser = await chromium.launch({ executablePath: CHROME, args: ["--autoplay-policy=no-user-gesture-required"] });
const errors: string[] = [];
let exitCode = 0;
try {
  const page = await browser.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(new URL("audio-demo.html", base).href, { waitUntil: "load" });
  await page.waitForFunction(() => (window as unknown as { __audioReady?: boolean }).__audioReady === true, null, { timeout: 30000 });
  console.log(`demo page loaded (${base}audio-demo.html)`);

  const t0 = performance.now();
  const levels = (await page.evaluate(() => (window as unknown as { __audioCheck: () => Promise<Level[]> }).__audioCheck())) as Level[];
  console.log(`offline renders: ${levels.length} in ${((performance.now() - t0) / 1000).toFixed(1)} s\n`);

  const pad = (s: string, n: number) => (s.length >= n ? s : s + " ".repeat(n - s.length));
  console.log(`${pad("id", 34)} ${pad("kind", 8)} ${pad("peak", 7)} ${pad("rms", 7)} ${pad("dur", 6)} status`);
  for (const l of levels) {
    console.log(`${pad(l.id, 34)} ${pad(l.kind, 8)} ${pad(l.peak.toFixed(3), 7)} ${pad(l.rms.toFixed(4), 7)} ${pad(l.dur.toFixed(2), 6)} ${l.status}${l.note ? ` (${l.note})` : ""}`);
  }
  const bad = levels.filter((l) => l.status === "silent" || l.status === "clip" || l.status === "error");
  const quiet = levels.filter((l) => l.status === "quiet");
  console.log(`\n${levels.length - bad.length - quiet.length} ok · ${quiet.length} quiet (<0.03 peak) · ${bad.length} silent/clipping/errors`);
  if (bad.length) {
    exitCode = 1;
    for (const b of bad) console.log(`  FAIL ${b.id}: ${b.status} peak=${b.peak.toFixed(4)} ${b.note ?? ""}`);
  }

  const jsonAt = process.argv.indexOf("--json");
  if (jsonAt > 0 && process.argv[jsonAt + 1]) await Bun.write(process.argv[jsonAt + 1] as string, JSON.stringify(levels, null, 1));

  // Before any gesture: one-shots no-op, loops are deferred until unlock.
  const pre = (await page.evaluate(() => (window as unknown as { __audioPre: () => { unlocked: boolean; loops: number } }).__audioPre())) as { unlocked: boolean; loops: number };
  console.log(`\nbefore unlock: ${JSON.stringify(pre)}`);
  if (pre.unlocked || pre.loops !== 1) {
    exitCode = 1;
    console.log("  FAIL expected a locked context with one deferred loop");
  }

  // Live smoke test: unlock (the page click is a real gesture), then play everything.
  await page.mouse.click(5, 5);
  const smoke = await page.evaluate(() => (window as unknown as { __audioSmoke: () => Promise<unknown> }).__audioSmoke());
  console.log(`\nlive smoke test: ${JSON.stringify(smoke)}`);
  await page.waitForTimeout(1500);
} catch (err) {
  console.error(err);
  exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}

if (errors.length) {
  exitCode = 1;
  console.log(`\nconsole errors (${errors.length}):`);
  for (const e of errors.slice(0, 30)) console.log(`  ${e}`);
} else console.log("\nno console errors");
process.exit(exitCode);
