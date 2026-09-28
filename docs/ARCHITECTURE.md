# Architecture

> How WebMagic III is built. The *why* is in [DESIGN.md](DESIGN.md); how to
> add content is in [CONTENT_GUIDE.md](CONTENT_GUIDE.md).

## 1. The shape of the code

```
src/
  shared/            PURE — no DOM, no three.js. Runs in the browser, the
                     offline worker and the Bun server alike.
    config.ts        rules of the world (tick rate, player feel, run rules,
                     encounter rates, difficulty curve)
    util/            seeded RNG, tileable noise, small vector math
    content/         DATA: every spell, amplifier, item, affix, creature,
                     faction, prop, trap, status, surface, biome, shop table,
                     lore text. Registries keyed by string id.
    world/           floor generation: the 2.5D height grid, per-stratum
                     generators, population, colliders
    sim/             the authoritative simulation (Rapier physics, AI,
                     combat, spells, surfaces, traps, props, players)
    game/            run rules and item math (gear level, entry floor, loot
                     rolls, stats from equipment)
    net/             wire protocol, binary snapshot codec, interpolation
                     buffers, clock sync
  server/
    core/            GameServer (sessions, accounts, shops, matchmaker,
                     floor instances) — transport-agnostic
    bun/             online host: WebSocket + static files + SQLite
    worker/          offline host: the same GameServer in a Web Worker +
                     IndexedDB
  client/
    app/Game.ts      the client orchestrator (connection, scenes, frame loop)
    net/             WebSocket / worker transports behind one interface
    player/          local controller (kinematic character), predicted casts
    world/           replicated entity mirror + per-type entity views,
                     surface layer
    scenes/          dungeon floor, village
    render/          deferred renderer, lights, materials, SSR, environments
    gfx/textures/    procedural material painters → texture arrays
    gfx/models/      procedural model kit, model registry, all models
    gfx/world/       dungeon mesher
    fx/              GPU particles, bolts, event → effect mapping
    audio/           procedural WebAudio engine (cues, voices, ambience)
    ui/              React overlay (HUD, screens, panels) + UI store
```

**Dependency rule:** `shared` imports nothing from `server` or `client`.
`server` imports `shared` only. `client` imports `shared` and never
`server` (except the worker entry file it spawns). Content never imports
engine code; engine code reads content through registries.

## 2. One game server, two hosts

```
            ┌───────────── browser ─────────────┐
 online:    │ client ──WebSocket──► Bun host ──► GameServer ─► FloorInstance ─► FloorSim
            │                                                                   (Rapier)
 offline:   │ client ──postMessage──► Worker ──► GameServer ─► FloorInstance ─► FloorSim
            └───────────────────────────────────┘
```

`client/net/connection.ts#connect()` tries `/ws` for 1.5 s and falls back to
the worker (`?offline` forces it). The game never knows which it got —
single-player *is* the online game with a one-player server, a principle
kept from WebMagic 2.

## 3. Authority

| Thing | Who decides |
| --- | --- |
| The delver's own movement | the client (Rapier kinematic character controller against the same static world), reported at 30 Hz; the server validates speed/position and corrects |
| Falls, the abyss | the server, from reported motion |
| Everything else — creatures, props, projectiles, damage, statuses, surfaces, traps, loot, inventories, gold, shops, runs | the server |

Casting: the client sends `cast {slot, id, origin, dir}`; the server checks
cooldown/mana/origin and runs the spell. The client draws a **predicted**
projectile immediately (`player/Predicted.ts`); the server's copy of that
projectile is tagged `own` for its caster and hidden; the server's `impact`
event (carrying the cast id) retires the prediction.

Items are server-side instances (`{uid, base, ilvl, rarity, affixes, amps}`).
The client sends intentions (`inv move`, `shop buy`, `use belt`) and receives
account views.

## 4. The simulation (`shared/sim`)

`FloorSim` owns a Rapier world built from the floor's grid colliders, the
entities, a 0.5 m **surface grid**, a nav grid and a seeded RNG. One tick
(30 Hz):

```
timers → players (inputs, regen, channels, grasp) → creatures (brains at 10 Hz,
attacks, locomotion) → traps/pickups → physics step → contact-force impacts →
read back bodies (+ kill plane) → projectiles (shape-cast sweeps) → surface
contact (statuses from the floor) → statuses (dps, fire spread) → surfaces
(decay, fire spread) → removals
```

* **Entities** are one flat struct with optional component blocks
  (`creature`, `prop`, `projectile`, `trap`, `pickup`, `interact`, `player`).
  The replicated header (`type, def, pos, vel, yaw, quat, anim, variant,
  flags, hp, statuses`) is all clients ever see.
* **Creatures** are rotation-locked dynamic capsules steered by velocity, so
  knockback, explosions, pits, ice and each other all act on them for real.
  `ai/brain.ts` does perception (sight cones with grid line-of-sight,
  hearing via noise events), utility selection over behaviours, grudges
  (infighting), and grid A* with costs for known traps and visible hazards —
  costs that panicking creatures ignore.
* **Emergence** comes from shared rules: elements react with surfaces
  (`surfaces.ts`), statuses combine (`wet + chilled → frozen`), fire spreads
  through what burns, water conducts storm, pressure plates count *mass*,
  explosions shove *everything*, thrown props hurt what they hit.
* **Spells** are data (`content/spells`); `spells.ts` executes any delivery
  (projectile, beam, cone, nova, self, dash, grasp) and applies
  **amplifiers** (multishot, homing, ricochet, pierce, split, volatile,
  chain, orbit, echo, trails, heavy, magnetic, fused, element conversion,
  vampiric).
* The sim talks to its host only through `SimHooks` (loot rolls, pickups,
  deaths, descents, notes) — it knows nothing of accounts.

## 5. Floors (`shared/world`)

A floor is generated **purely from (seed, floor number)**: the server ships
only the seed; every client rebuilds the identical grid, fixtures and decor
locally (dynamic entities arrive via snapshots). A biome picks a generator
(`crypt`, `archive`, `caverns`, …); generators carve a `FloorGrid` (per 1 m
cell: kind, floor and ceiling height in 0.25 m steps, liquid and level,
palette indices, region, tags) and assign room roles; `populate.ts`
dresses it from the biome's tables. Every phase draws from its own RNG fork,
so tuning one phase never reshuffles the others. `generate.ts` retries a
seed until the descent is reachable.

The same grid feeds: the mesher (client geometry), greedy-merged box
colliders (server + client physics), creature A*, grid line-of-sight, and
the renderer's **grid-traced light shadows**.

## 6. Networking (`shared/net`)

* Control messages are JSON (`protocol.ts`); world state is a **binary
  snapshot** per client at 15 Hz (`codec.ts`, ~38 bytes/entity) containing
  only entities whose header changed since that client last heard of them,
  plus removals. Per-viewer flags (pact allies, "you may ascend here") are
  applied during encoding.
* Events (`sim/events.ts`) — impacts, hits, explosions, deaths, surface
  changes, sounds — are batched per snapshot.
* Clients render replicated entities ~110 ms in the past on the server's
  clock (`clock.ts`, lowest-RTT ping samples), sampling hermite curves
  through velocities (`interp.ts`) — both kept from WebMagic 2.

## 7. Matchmaking & runs (`server/core`)

* `matchmaker.ts` (pure, tested): entering floor *N* joins an occupied
  instance of the **same** floor only with the encounter probability
  (`ENCOUNTER` in config, rising with time since the delver last met
  anyone), inside a join window, never full or mid-warden. Pact allies who
  descend within a few seconds follow each other.
* `FloorInstance` wraps a `FloorSim` with its members and implements the
  hooks: pickups become run loot, deaths fill a **Reliquary** and return
  Quartermaster kits, descents move the session on or bank the run.
* `GameServer` handles sessions, accounts (`AccountStore`: SQLite online,
  IndexedDB offline, memory in tests), shops, belt use, inventory rules,
  village presence, chat. A run left open by a crash/disconnect is forfeited
  at next login — closing the tab can't be used to escape death.

## 8. Rendering (`client/render`)

A custom **deferred pipeline** on three.js/WebGL2 at a low internal
resolution (default 640×360, upscaled with nearest filtering — the pixels
are the style *and* the performance budget):

1. **G-buffer** (3 × RGBA16F + depth): albedo+roughness, view normal +
   metalness, emissive + AO. One shader (`materials.ts#surfaceMaterial`)
   renders everything opaque: it samples three **texture arrays** (albedo,
   normal+height, AO/rough/metal/emissive) by a per-vertex `aLayer`, with
   normal mapping from screen-space derivatives (no tangents needed).
   The first-person viewmodel is drawn into the same G-buffer with squashed
   depth so it never clips into walls.
2. **Lighting**: up to 192 point lights looped from a float texture — GGX
   specular + Lambert, **grid-traced shadows** (a DDA through the floor's
   height grid, so light never bleeds through walls), analytic
   **volumetric in-scattering** per light, hemisphere ambient × baked AO,
   exponential height fog, a moon with a shadow map and a star sky in the
   village. `lights.ts` ranks and packs lights each frame; *anything* can
   emit light (projectiles, fungus, eyes, spells).
3. **Forward**: GPU particles (instanced, soft depth fade, fog) and
   lightning/beam ribbons, depth-tested against the world.
4. **Screen effects**: screen-space reflections (`ssr.ts`) on glossy
   texels (water, oil, ice, wet stone, metal).
5. **Bloom** (13-tap downsample / tent upsample), **composite**: filmic
   tonemap, per-environment grade, vignette, grain, optional ordered-dither
   palette quantisation, damage pulse.

## 9. Procedural assets

* **Textures** (`gfx/textures`): painters draw five channels on a 64×64
  `Paint` (colour, alpha, height, roughness, metalness, emissive); the
  library derives normals and cavity AO and packs everything into the
  three arrays at boot. `MATERIALS.md` lists every id.
* **Models** (`gfx/models`): `MeshBuilder` composes primitives (bevelled
  boxes, lathes, tubes with taper, extrusions…) carrying material ids,
  tints and glow into one geometry; `RigBuilder` makes articulated models
  with joints authored in model space; models animate procedurally from the
  replicated `(anim, variant, animTime, speed, flags)`.
* **Audio** (`client/audio`): everything synthesized — cached pre-rendered
  one-shots, 32-voice budget, HRTF for near voices, occlusion, generated
  reverb per environment, generative ambience beds, danger music.

## 10. Testing

`bun test src` runs deterministic tests: generation (determinism,
reachability, colliders), the sim (casting, AI engagement, fire spread,
emergence scenarios), the matchmaker, and the full server loop (village →
floor → death → Reliquary → respawn; five-floor ascend and banking).
`bun scripts/playtest.ts` boots the real game in headless Chromium, enters
the Godwell, looks around and casts, saving screenshots to
`screenshots/play/`. Asset contact sheets: `scripts/texture-sheet.ts`,
`scripts/model-sheet.ts`, `scripts/audio-check.ts`.
