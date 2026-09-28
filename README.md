# WebMagic III — The Godwell

A first-person spellcaster dungeon crawler for the browser. You are a delver
from **Kneel**, a fog-bound village in the shadow of a headless stone giant
that kneels at the rim of a pit. A hundred floors down, the stories say, God
waits.

* **A physical, reactive dungeon** — creatures, props and delvers share one
  authoritative physics simulation. Fire spreads through oil and webs, water
  conducts lightning, frost freezes the wet, pressure plates count *weight*,
  creatures fight each other, blunder into traps, flee into pits.
* **Spells you can break** — foci define two spells; **amplifiers** on your
  gear rewrite how they fly: multishot, homing, ricochet, split, chain,
  orbit, echo, oil/fire/frost trails, heavy, magnetic, fused, element
  conversion…
* **Ten strata, ten peoples** — every ten floors the world changes: its
  layout grammar, creatures, hazards, light, and the resources that deeper
  delvers come back for.
* **Greed vs. fear** — you're thrown in at a depth set by your gear level;
  run loot is lost on death (it waits in a Reliquary for whoever finds it);
  you may only leave after five floors.
* **Other delvers, rarely** — only people on the same floor number are ever
  matched, and not often. Fight them for their loot, or raise the Open Palm
  and make a pact.
* **Zero binary assets** — every texture, model, particle sprite and sound
  is generated in code at startup.

Read [docs/DESIGN.md](docs/DESIGN.md) (the game), [docs/LORE.md](docs/LORE.md)
(the world), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (the code) and
[docs/CONTENT_GUIDE.md](docs/CONTENT_GUIDE.md) (adding things).

## Quickstart

```sh
bun install
bun run dev          # http://localhost:3000 — plays OFFLINE (server in a Web Worker)
bun run dev:full     # + the online game server on :8787 (vite proxies /ws)
bun test             # deterministic tests (world gen, sim, matchmaking, server loop)
bun run typecheck
bun run build        # production client → dist/
bun run start        # production: serves dist/ + WebSocket on $PORT (default 8787)
```

URL flags: `?offline` forces offline play, `?scale=2` sets the pixel size
(screen pixels per rendered pixel, default 3), `?autoplay&name=X` skips the
title screen.

Dev tools: `bun scripts/playtest.ts` (headless playtest → `screenshots/play/`),
`bun scripts/floor-ascii.ts <seed> <floor>` (see a floor as ASCII),
`bun scripts/texture-sheet.ts`, `bun scripts/model-sheet.ts`,
`bun scripts/audio-check.ts`, and `/audio-demo.html` in the dev server.

## Controls

| Input | Action |
| --- | --- |
| WASD / Mouse | move / look |
| LMB / RMB | focus primary / secondary spell (hold to keep casting) |
| Space | jump (extra jumps / glide with the right boots) |
| Shift | relic ability (blink, grasp — hold to lift, release to throw — ward…) |
| E / R | interact / alternative (at a Descent after five floors: R ascends) |
| Q, 1–4 | belt consumables (potions, flasks, the Waking Bell) |
| F | raise the Open Palm (two delvers doing it form a pact) |
| Tab / I | inventory · M map · Esc close · F3 performance |

## Stack

Bun · TypeScript · Vite · three.js (custom deferred WebGL2 pipeline) ·
Rapier (physics, server-authoritative) · React (UI overlay only) · WebAudio.
