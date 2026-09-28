import { useEffect, useState } from "react";
import { ITEMS, STATUSES } from "../../shared/content";
import { itemName, RARITY_COLOR } from "../../shared/game/items";
import { actions } from "./actions";
import { ui, useUi } from "./store";
import { Panels } from "./panels";

/** Root of the DOM overlay. Screens (title, death, ascension, notes) and
 * the in-play HUD. Panels (inventory, shops, map) live in ./panels. */
export function App() {
  const screen = useUi((s) => s.screen);
  const died = useUi((s) => s.died);
  const ascended = useUi((s) => s.ascended);
  const note = useUi((s) => s.note);
  const panel = useUi((s) => s.panel);
  return (
    <>
      {screen === "title" && <Title />}
      {screen === "loading" && <Loading />}
      {screen === "play" && <Hud />}
      {panel && <Panels />}
      {died && <Death />}
      {ascended && <Ascended />}
      {note && <Note />}
      <Perf />
      <Build />
    </>
  );
}

function Title() {
  const [name, setName] = useState(() => localStorage.getItem("godwell.name") ?? "");
  const go = () => actions.play(name.trim() || "Nameless");
  return (
    <div className="screen title">
      <div className="card">
        <h1>WebMagic</h1>
        <h2>The Godwell — a hundred floors down, God waits.</h2>
        <input autoFocus placeholder="Your name, delver" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} />
        <button className="big" onClick={go}>
          Wake in Kneel
        </button>
        <div className="hint">
          WASD move · Mouse aim · LMB / RMB cast · Space jump · Shift relic · E interact · Q/1–4 belt · F open palm · Tab inventory · M map · F3 performance
          <br />
          Loot found below is lost if you die. After five floors, any Descent will also let you Ascend and bank it.
        </div>
      </div>
    </div>
  );
}

function Loading() {
  const connecting = useUi((s) => s.connecting);
  return (
    <div className="screen">
      <div className="card">{connecting ? "Finding the way to Kneel…" : "The dream takes shape…"}</div>
    </div>
  );
}

function Hud() {
  const self = useUi((s) => s.self);
  const scene = useUi((s) => s.scene);
  const prompt = useUi((s) => s.prompt);
  const paused = useUi((s) => s.paused);
  const lowHealth = useUi((s) => s.lowHealth);
  const presence = useUi((s) => s.presence);
  return (
    <div className="layer">
      {lowHealth && <div className="vignette-low" />}
      {presence > 0 && <div className="presence-cue" key={presence} />}
      <div className="crosshair" />
      {prompt && (
        <div className="prompt">
          <div>
            <kbd>E</kbd>
            {prompt.text}
          </div>
          {prompt.alt && (
            <div className="alt">
              <kbd>R</kbd>
              {prompt.alt}
            </div>
          )}
        </div>
      )}
      {scene === "floor" && self && <Bars />}
      <Belt />
      <RunInfo />
      <Toasts />
      <Banner />
      {paused && (
        <div className="paused interactive" onClick={() => actions.resume()}>
          Click to return to the dream
        </div>
      )}
    </div>
  );
}

function Bars() {
  const self = useUi((s) => s.self)!;
  const statuses = Object.entries(self.st).filter(([, t]) => t > 0);
  return (
    <div className="bars">
      <div className="statuses">
        {statuses.map(([id, t]) => {
          const def = STATUSES.find(id);
          return (
            <span key={id} className="status" style={{ color: def?.color, borderColor: def?.color }}>
              {def?.name ?? id} {Math.ceil(t)}
            </span>
          );
        })}
      </div>
      <div className="bar hp">
        <i style={{ transform: `scaleX(${Math.max(0, self.hp / self.maxHp)})` }} />
        <span>
          {Math.ceil(self.hp)} / {self.maxHp}
        </span>
      </div>
      <div className="bar mp">
        <i style={{ transform: `scaleX(${Math.max(0, self.mana / self.maxMana)})` }} />
        <span>
          {Math.floor(self.mana)} / {self.maxMana}
        </span>
      </div>
    </div>
  );
}

function Belt() {
  const belt = useUi((s) => s.account?.belt);
  if (!belt) return null;
  return (
    <div className="belt">
      {belt.map((it, i) => {
        const base = it ? ITEMS.find(it.base) : null;
        return (
          <div className="slot" key={i} title={it ? itemName(it) : ""} style={{ color: base?.color }}>
            <span className="key">{i === 0 ? "Q" : i + 1}</span>
            {base?.glyph}
            {it && it.qty > 1 && <span className="qty">{it.qty}</span>}
          </div>
        );
      })}
    </div>
  );
}

function RunInfo() {
  const scene = useUi((s) => s.scene);
  const floor = useUi((s) => s.floor);
  const run = useUi((s) => s.run);
  const acc = useUi((s) => s.account);
  if (scene === "village")
    return (
      <div className="runinfo">
        <div className="floor">Kneel</div>
        <div className="sub">Gear level {acc?.gearLevel ?? 0}{acc?.kitted ? " (Hask's kit)" : ""}</div>
        <div className="gold">{acc?.gold ?? 0} gold</div>
      </div>
    );
  if (!run?.active) return null;
  return (
    <div className="runinfo">
      <div className="floor">Floor {floor}</div>
      <div className="sub">
        {run.floorsCleared} floor{run.floorsCleared === 1 ? "" : "s"} this run
      </div>
      <div className="gold">+{run.runGold} gold (unbanked)</div>
      <div className="ascend">{run.canAscend ? "The Descents here will let you Ascend." : `Ascend unlocks in ${Math.max(0, 4 - run.floorsCleared)} floor(s).`}</div>
    </div>
  );
}

function Toasts() {
  const toasts = useUi((s) => s.toasts);
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

function Banner() {
  const banner = useUi((s) => s.banner);
  if (!banner) return null;
  return (
    <div className="banner" key={banner.at}>
      <div className="t">{banner.title}</div>
      <div className="s">{banner.sub}</div>
    </div>
  );
}

function Death() {
  const d = useUi((s) => s.died)!;
  return (
    <div className="screen dead">
      <div className="card">
        <h1>The dream keeps you</h1>
        <div>
          Floor {d.floor} — {d.killer || d.cause}
        </div>
        {d.lost.length > 0 ? (
          <>
            <div className="hint">A Reliquary holds what you carried, for whoever finds it:</div>
            <div className="lost">
              {d.lost.map((it) => (
                <span key={it.uid} className="it" style={{ color: RARITY_COLOR[it.rarity] }}>
                  {it.base === "gold_coin" ? `${it.qty} gold` : itemName(it)}
                </span>
              ))}
            </div>
          </>
        ) : (
          <div className="hint">You carried nothing the dream wanted.</div>
        )}
        <button className="big" onClick={() => actions.respawn()}>
          Wake in Kneel
        </button>
      </div>
    </div>
  );
}

function Ascended() {
  const a = useUi((s) => s.ascended)!;
  return (
    <div className="screen">
      <div className="card">
        <h1 style={{ fontWeight: "normal", fontVariant: "small-caps", letterSpacing: ".1em", margin: 0 }}>You wake</h1>
        <div className="hint">From floor {a.floor}, the Well lets you breathe out. Banked:</div>
        <div className="lost">
          {a.gold > 0 && <span className="it" style={{ color: "#e8c060" }}>{a.gold} gold</span>}
          {a.banked.map((it) => (
            <span key={it.uid} className="it" style={{ color: RARITY_COLOR[it.rarity] }}>
              {itemName(it)}
            </span>
          ))}
        </div>
        <button className="big" onClick={() => ui.set({ ascended: null })}>
          Return to Kneel
        </button>
      </div>
    </div>
  );
}

function Note() {
  const n = useUi((s) => s.note)!;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape" || e.code === "KeyE") {
        ui.set({ note: null });
        actions.resume();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div className="screen note">
      <div className="card">
        <h2 style={{ margin: 0, fontWeight: "normal", fontVariant: "small-caps", letterSpacing: ".06em" }}>{n.title}</h2>
        {n.author && <div className="author">— {n.author}</div>}
        <div className="body">{n.text}</div>
        <button
          className="big"
          onClick={() => {
            ui.set({ note: null });
            actions.resume();
          }}
        >
          Keep it
        </button>
      </div>
    </div>
  );
}

function Perf() {
  const p = useUi((s) => s.perf);
  if (!p) return null;
  return (
    <div className="perf">
      {p.fps} fps · frame {p.frame} ms · p95 {p.p95} ms
      <br />
      lights {p.lights} · particles {p.particles} · entities {p.entities} · draws {p.drawCalls}
    </div>
  );
}

function Build() {
  const id = useUi((s) => s.buildId);
  const online = useUi((s) => s.online);
  return (
    <div className="build">
      {online ? "◉ online" : "○ offline"} · {id}
    </div>
  );
}
