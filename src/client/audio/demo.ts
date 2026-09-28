/** Audio bench (audio-demo.html): audition every cue, loop, creature voice,
 * ambience bed and stinger; move the emitter around a top-down listener with
 * occlusion; stress the voice pool; run the offline level check. Also exposes
 * hooks for scripts/audio-check.ts (window.__audio*). */

import { audio, type SoundHandle } from "./index";
import { checkAll, type Level } from "./offline-check";
import { CUES } from "./cues";
import type { Vec3 } from "./util";

type Hooks = {
  __audioReady?: boolean;
  __audioPre?: () => ReturnType<typeof audio.stats>;
  __audioCheck?: () => Promise<Level[]>;
  __audioSmoke?: () => Promise<{ played: number; stats: ReturnType<typeof audio.stats> & { preLoopPlaying: boolean | null } }>;
};
const hooks = window as unknown as Hooks;

const app = document.getElementById("app") as HTMLElement;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const k of kids) e.append(k);
  return e;
}
function button(text: string, onClick: (b: HTMLButtonElement) => void, cls = ""): HTMLButtonElement {
  const b = el("button", cls ? { class: cls } : {}, text);
  b.addEventListener("click", () => onClick(b));
  return b;
}
function section(title: string, wide = false): HTMLElement {
  const s = el("section", wide ? { class: "wide" } : {}, el("h2", {}, title));
  app.querySelector("main")?.append(s);
  return s;
}
function slider(label: string, value: number, min: number, max: number, step: number, onInput: (v: number) => void): HTMLLabelElement {
  const input = el("input", { type: "range", min: String(min), max: String(max), step: String(step), value: String(value) });
  input.addEventListener("input", () => onInput(Number(input.value)));
  return el("label", {}, el("span", {}, label), input);
}

// ── Layout ───────────────────────────────────────────────────────────────────

const status = el("span", { class: "pill" }, "locked — click anywhere");
const stats = el("span", { class: "stats" }, "");
app.append(
  el("header", {}, el("h1", {}, "THE GODWELL · audio bench"), button("Unlock audio", () => void audio.unlock(), "primary"), status, stats),
  el("main"),
);

// ── Space: emitter position + occlusion ──────────────────────────────────────

const space = { positional: true, occlusion: 0, emitter: { x: 3, y: 1.6, z: -4 } as Vec3, orbit: false, angle: 0 };
const LISTENER: Vec3 = { x: 0, y: 1.6, z: 0 };
const SCALE = 20; // metres from centre to edge
const liveLoops = new Map<string, SoundHandle>();

const opts = () => ({ pos: space.positional ? { ...space.emitter } : null, occlusion: space.occlusion });

{
  const s = section("Space");
  const canvas = el("canvas", { width: "260", height: "260" });
  const draw = () => {
    const g = canvas.getContext("2d");
    if (!g) return;
    const w = canvas.width;
    g.clearRect(0, 0, w, w);
    g.strokeStyle = "#2a2631";
    for (let r = 5; r <= SCALE; r += 5) {
      g.beginPath();
      g.arc(w / 2, w / 2, (r / SCALE) * (w / 2), 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = "#c9a46a";
    g.beginPath();
    g.moveTo(w / 2, w / 2 - 9);
    g.lineTo(w / 2 - 6, w / 2 + 6);
    g.lineTo(w / 2 + 6, w / 2 + 6);
    g.fill();
    const ex = w / 2 + (space.emitter.x / SCALE) * (w / 2);
    const ey = w / 2 + (space.emitter.z / SCALE) * (w / 2);
    g.fillStyle = space.positional ? `rgba(127,183,126,${1 - space.occlusion * 0.7})` : "#555";
    g.beginPath();
    g.arc(ex, ey, 6, 0, Math.PI * 2);
    g.fill();
  };
  canvas.addEventListener("click", (ev) => {
    const r = canvas.getBoundingClientRect();
    space.emitter.x = ((ev.clientX - r.left) / r.width - 0.5) * 2 * SCALE;
    space.emitter.z = ((ev.clientY - r.top) / r.height - 0.5) * 2 * SCALE;
    for (const h of liveLoops.values()) h.setPos(space.emitter);
    draw();
  });
  const pos = el("input", { type: "checkbox", checked: "" });
  pos.addEventListener("change", () => {
    space.positional = pos.checked;
    draw();
  });
  const orbit = el("input", { type: "checkbox" });
  orbit.addEventListener("change", () => (space.orbit = orbit.checked));
  s.append(
    canvas,
    el("label", {}, pos, "positional (click the pad to move the emitter; you face up)"),
    el("label", {}, orbit, "orbit emitter around listener (hear HRTF on loops)"),
    slider("occlusion", 0, 0, 1, 0.01, (v) => {
      space.occlusion = v;
      for (const h of liveLoops.values()) h.setOcclusion(v);
      draw();
    }),
  );
  draw();
  const frame = () => {
    audio.setListener(LISTENER, { x: 0, y: 0, z: -1 }, { x: 0, y: 1, z: 0 });
    if (space.orbit) {
      space.angle += 0.01;
      const r = Math.max(2, Math.hypot(space.emitter.x, space.emitter.z));
      space.emitter.x = Math.cos(space.angle) * r;
      space.emitter.z = Math.sin(space.angle) * r;
      for (const h of liveLoops.values()) h.setPos(space.emitter);
      draw();
    }
    const st = audio.stats();
    status.textContent = st.unlocked ? "running" : "locked — click anywhere";
    status.className = st.unlocked ? "pill live" : "pill";
    stats.textContent = `voices ${st.voices} · loops ${st.realLoops}/${st.loops} · hrtf ${st.hrtf} · danger ${st.danger.toFixed(2)} · bed ${st.ambience ?? "—"}`;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

// ── Mix ──────────────────────────────────────────────────────────────────────

{
  const s = section("Mix");
  for (const bus of ["master", "sfx", "ambience", "music", "ui", "voice"] as const) s.append(slider(bus, audio.getVolume(bus), 0, 1.5, 0.01, (v) => audio.setVolume(bus, v)));
  const env = el("select");
  for (const id of audio.environments()) env.append(el("option", { value: id }, id));
  env.value = "small_crypt";
  env.addEventListener("change", () => audio.setEnvironment(env.value));
  s.append(el("label", {}, el("span", {}, "reverb"), env));
}

// ── Ambience, danger, stingers ───────────────────────────────────────────────

{
  const s = section("Ambience & music");
  const bedButtons: HTMLButtonElement[] = [];
  const setBed = (id: string | null, b?: HTMLButtonElement) => {
    audio.setAmbience(id);
    if (id) {
      const room = audio.roomFor(id);
      if (room) audio.setEnvironment(room);
    }
    bedButtons.forEach((x) => x.classList.toggle("on", x === b));
  };
  for (const id of audio.ambiences()) {
    const b = button(id, (x) => setBed(id, x));
    bedButtons.push(b);
    s.append(b);
  }
  s.append(button("silence", () => setBed(null)));
  s.append(slider("danger", 0, 0, 1, 0.01, (v) => audio.setDanger(v)));
  const st = el("div");
  for (const id of audio.stingers()) st.append(button(id, () => audio.stinger(id)));
  s.append(el("h2", {}, "stingers"), st, el("p", { class: "note" }, "Picking a bed also sets its suggested reverb room."));
}

// ── Cues by group ────────────────────────────────────────────────────────────

{
  const groups = new Map<string, string[]>();
  for (const [id, cue] of Object.entries(CUES)) {
    const list = groups.get(cue.group) ?? [];
    list.push(id);
    groups.set(cue.group, list);
  }
  for (const [group, ids] of groups) {
    const s = section(group);
    for (const id of ids) {
      if (CUES[id]?.kind === "loop") {
        s.append(button(`⟳ ${id}`, (b) => {
          const h = liveLoops.get(id);
          if (h) {
            h.stop(0.4);
            liveLoops.delete(id);
            b.classList.remove("on");
          } else {
            liveLoops.set(id, audio.loop(id, opts()));
            b.classList.add("on");
          }
        }));
      } else s.append(button(id, () => audio.play(id, opts())));
    }
  }
}

// ── Voices ───────────────────────────────────────────────────────────────────

{
  const s = section("Creature voices", true);
  const grid = el("div", { class: "grid-voices" });
  grid.append(el("span"));
  for (const k of audio.voiceKinds()) grid.append(el("span", { class: "stats" }, k));
  let size = 1;
  for (const v of audio.voices()) {
    grid.append(el("span", {}, v));
    for (const k of audio.voiceKinds()) grid.append(button(k, () => audio.voice(v, k, { ...opts(), pitch: size })));
  }
  s.append(grid, slider("size pitch", 1, 0.6, 1.6, 0.01, (x) => (size = x)));
}

// ── Stress ───────────────────────────────────────────────────────────────────

{
  const s = section("Stress");
  const rnd = (): Vec3 => ({ x: (Math.random() - 0.5) * 30, y: 0, z: (Math.random() - 0.5) * 30 });
  s.append(
    button("50 explosions at once", () => {
      for (let i = 0; i < 50; i++) audio.play(["explosion_small", "explosion_medium", "explosion_large"][i % 3] as string, { pos: rnd() });
    }),
    button("200 footsteps in 2 s", () => {
      for (let i = 0; i < 200; i++) setTimeout(() => audio.play("footstep_stone", { pos: rnd() }), i * 10);
    }),
    button("40 torches (virtual loops)", () => {
      for (let i = 0; i < 40; i++) liveLoops.set(`torch${i}`, audio.loop("torch_loop", { pos: rnd() }));
    }),
    button("stop all", () => {
      audio.stopAll(0.3);
      liveLoops.clear();
      document.querySelectorAll("button.on").forEach((b) => b.classList.remove("on"));
    }),
    el("p", { class: "note" }, "Watch the voice counter: one-shots cap at 32, loops at 12 real (the rest are virtual)."),
  );
}

// ── Offline level check ──────────────────────────────────────────────────────

{
  const s = section("Offline level check", true);
  const table = el("table");
  const wrap = el("div", { class: "scroll" }, table);
  const summary = el("p", { class: "note" });
  s.append(
    button("Render everything offline", async (b) => {
      b.disabled = true;
      table.replaceChildren(el("tr", {}, el("th", {}, "id"), el("th", {}, "kind"), el("th", {}, "peak"), el("th", {}, "rms"), el("th", {}, "dur"), el("th", {}, "status")));
      const res = await checkAll((l) =>
        table.append(
          el("tr", {}, el("td", {}, l.id), el("td", {}, l.kind), el("td", { class: "num" }, l.peak.toFixed(3)), el("td", { class: "num" }, l.rms.toFixed(4)), el("td", { class: "num" }, l.dur.toFixed(2)), el("td", { class: l.status }, l.status + (l.note ? ` — ${l.note}` : ""))),
        ),
      );
      const bad = res.filter((r) => r.status !== "ok" && r.status !== "quiet");
      summary.textContent = `${res.length} renders · ${bad.length} silent/clipping/errors`;
      b.disabled = false;
    }),
    summary,
    wrap,
  );
}

// ── Hooks for the headless check ─────────────────────────────────────────────

hooks.__audioCheck = () => checkAll();
/** Before unlock: one-shots are no-ops, loops are remembered for later. */
let preLoop: SoundHandle | null = null;
hooks.__audioPre = () => {
  audio.play("hit_bone", { pos: { x: 1, y: 1, z: -1 } });
  preLoop = audio.loop("torch_loop", { pos: { x: 1, y: 1, z: -2 } });
  audio.setAmbience("undercroft");
  return audio.stats();
};
hooks.__audioSmoke = async () => {
  await audio.unlock();
  let played = 0;
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  audio.setAmbience("choir", 0.5);
  audio.setDanger(0.8);
  const loops: SoundHandle[] = [];
  for (const id of audio.cues()) {
    if (CUES[id]?.kind === "loop") loops.push(audio.loop(id, { pos: { x: 2, y: 1, z: -3 } }));
    else audio.play(id, { pos: { x: Math.random() * 10 - 5, y: 1, z: -4 }, occlusion: Math.random() });
    played++;
    await wait(15);
  }
  for (const v of audio.voices()) for (const k of audio.voiceKinds()) {
    audio.voice(v, k, { pos: { x: -3, y: 1, z: -2 } });
    played++;
    await wait(10);
  }
  for (const id of audio.stingers()) audio.stinger(id);
  for (const id of audio.ambiences()) {
    audio.setAmbience(id, 0.3);
    await wait(120);
  }
  audio.play("nope_not_a_cue");
  await wait(500);
  const stats = { ...audio.stats(), preLoopPlaying: preLoop?.playing ?? null };
  loops.forEach((h) => h.stop());
  preLoop?.stop();
  audio.setDanger(0);
  return { played, stats };
};
hooks.__audioReady = true;
