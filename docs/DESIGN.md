# WebMagic III — The Godwell · Game Design

> Read this first. It is the *why* and the *what*. [ARCHITECTURE.md](ARCHITECTURE.md)
> is the *how*; [LORE.md](LORE.md) is the world bible;
> [CONTENT_GUIDE.md](CONTENT_GUIDE.md) shows how to add things.

## 1. The pitch

A first-person spellcaster dungeon crawler for the browser. You are a delver
from **Kneel**, a fog-bound village huddled in the shadow of a colossal,
headless stone giant that kneels at the rim of a pit: **the Godwell**. A
hundred floors down, the stories say, God waits.

You go down for glory, fame and riches — and because nobody who reached the
bottom has ever come back to say what is there.

The world is **physical and alive**: creatures shove each other, fight each
other, blunder into traps, flee from fire; barrels burst, oil spreads, water
conducts lightning, ice makes everything slide. The best moments are the ones
nobody scripted.

## 2. Design pillars (settle arguments with these)

1. **The world is real.** Everything has mass, material and a reason to be
   there. If a player asks "can I push/burn/freeze/drop/throw that?", the
   answer leans *yes*. Creatures live under the same rules as the player.
2. **Emergence over scripting.** Systems (physics, elements, surfaces,
   factions, traps, perception) interact; we author *ingredients*, not
   situations.
3. **Greed vs. fear.** Every run is a bet. Run loot is lost on death; you can
   only leave after proving yourself (5 floors). Other delvers may be friends,
   rivals, or both.
4. **Readable chaos.** Gritty pixels and fancy light, but a threat is always
   legible: silhouettes, telegraphs, audio cues.
5. **Minute-to-minute first.** Moving, aiming, casting and reacting must feel
   great with no progression at all.
6. **Zero binary assets.** Every texture, model, particle sprite and sound is
   synthesized at runtime in code. Tiny bundle, infinitely themeable.

## 3. The loop

```
 Kneel (village hub) ──► the Godwell portal ──► thrown in at a depth set by your GEAR LEVEL
      ▲                                              │
      │   bank run loot                              ▼
      └──── exit portal (only after ≥5 floors) ◄── floor → floor → floor … (run)
                                                     │
                                          death: run loot lost
                                          (a Reliquary chest holds it
                                           for whoever finds it)
```

### 3.1 Gear level decides where you land

Every item has an **item level** (ilvl ≈ the floor it came from). Your
**Gear Level** is the average ilvl over your equipment slots (empty slots
count as 0). Stepping into the Godwell throws you to a floor near your gear
level (`game/rules.ts#entryFloor`) — the Well "takes you as deep as you are
heavy". New delvers land on floor 1.

### 3.2 A run

* Each floor has a **Descent** (the portal down), usually far from where you
  arrive.
* Loot, gold and materials picked up in the dungeon are **run loot**
  (marked in the UI). Gear you brought from the village is safe.
* After you have **cleared 5 floors this run**, every Descent you reach also
  offers **Ascend** — return to Kneel and bank everything.
* **Death** ends the run and forfeits all run loot. Your body leaves a
  **Reliquary** — a chest holding everything you lost, lootable by anyone on
  that floor instance.
* Consumable escape: the **Waking Bell** (expensive) lets you ascend from any
  floor, banking loot, without it counting as progress.

### 3.3 Other delvers

Floors are **instances**. When you enter floor *N*, the matchmaker sometimes
(not often — tuned by `ENCOUNTER` in `shared/config.ts`) places you into an
instance of *N* where another delver already is, or lets another delver into
yours. Only people on the **same floor number** are ever matched.

* You are never told outright. You may hear a **second heartbeat** (the
  "presence" cue) and see a distant lantern.
* Friendly fire between delvers is always on. You can **fight** — kill a
  delver and their Reliquary holds their run loot — or **make a pact**: both
  players raise the *Open Palm* sign and become allies for the floor (no
  friendly fire, shared kill credit, descend together). Breaking a pact marks
  you **Oathbroken** for the rest of the run, visible to everyone.
* Allies who step into the Descent together arrive on the same next floor.

### 3.4 Biomes (strata) — every 10 floors the world changes

| Floors | Stratum | Mood / signature systems | Resources |
| --- | --- | --- | --- |
| 1–10 | **The Undercroft** | candlelit catacombs, ossuaries, vermin & the restless dead; oil lamps, candles, falling urns | Grave Tallow, Ossuary Bone |
| 11–20 | **The Drowned Archive** | flooded libraries, balconies, ink; water conducts storm magic, paper burns | Drowned Vellum, Ink Sac |
| 21–30 | **The Mycelial Choir** | singing fungal caverns; spore clouds are flammable, fungi heal or poison | Choir Spore, Lumen Cap |
| 31–40 | **The Cinder Foundry** | forges, lava channels, conveyors, steam; automata and slag | Slag Iron, Ember Core |
| 41–50 | **The Gilded Hive** | cathedral of wax and amber; honey slows, drones swarm | Royal Wax, Amber |
| 51–60 | **The Frozen Liturgy** | a frozen mass; ice slides, frozen pilgrims thaw | Rime Crystal, Stilled Breath |
| 61–70 | **The Red Garden** | the grown place; flesh walls, acid, parasites | Ichor, Heartseed |
| 71–80 | **The Orrery** | the machine that turns the dream; gears, pendulums, clockwork angels | Orichalcum Gear, Mainspring |
| 81–90 | **The Unlit** | lightless mirror-halls; your light is bait; reflections that act | Umbral Glass, Echo |
| 91–100 | **The Threshold** | inside the dreamer; the village, remembered wrong | Godtear |

Each stratum defines: a generator (layout style), a material palette,
lighting/fog/grade, creature roster with factions, traps, props, hazards,
helpers, resources and a **warden** (boss) on its 10th floor. See
`shared/content/biomes/`.

**Why revisit shallow strata?** High-level crafting needs shallow materials
(grave tallow binds every enchantment; drowned ink writes every scroll). A
high-level delver can't reach floor 4 with floor-60 gear — so they buy a
**Kit** (see §4.5).

## 4. The village — Kneel

Kneel is large, dark and wrong in small ways. Fog walls every edge. The
**Colossus** — a headless kneeling giant, a hundred meters of weathered stone,
hands cupped over the pit — dominates the skyline. The Godwell portal sits in
the centre of the market ring, in the giant's shadow.

### 4.1 Shops

| Shop | Keeper | Sells |
| --- | --- | --- |
| **Apothecary** — *The Sallow Jar* | Mother Sallow | potions, salves, flasks (throwables) |
| **Artificer** — *The Cinder Bench* | Brannoc Two-Thumbs | crafting: upgrade, reforge affixes, imbue, craft consumables from biome materials |
| **Wagers** — *The Hollow Coin* | Mistress Vey | gambling: veiled offerings (pick 1 of 3 shrouded items), dice of the Well |
| **Tailor** — *Pell & Needle* | Pell | cosmetics: robe dyes, hoods, staff finishes, lantern colours, trails |
| **Quartermaster** — *The Lending House* | Old Hask | **Kits**: one-time loaner gear at a fixed gear level |
| **Stash** — your own chest in the Delvers' Hall | — | banked storage |

### 4.2 Kits (the Quartermaster)

A Kit is a full loaner loadout with a fixed gear level (e.g. "Undercroft Kit
— GL 4"). Using one: your own gear stays in the Lending House, the kit is
equipped, and the Well weighs you by the kit. When the run ends — by exit or
by death — the kit **returns to Old Hask** and your gear is given back. Kit
items can't be banked, sold, stashed or dropped. Anything you *find* while
kitted is normal run loot.

### 4.3 Secrets & mysteries

Kneel keeps secrets — small, physical, discoverable ones (see LORE.md §Kneel
for the full list): the stair inside the Colossus' robes, the clapperless
bell, the well that whispers back, the fog that returns you to the market,
the Memorial Wall that lists (real) fallen delvers, the Chandlery with one
candle per delver. Secrets unlock lore pages and cosmetic rewards.

## 5. Combat & the physical world

### 5.1 Controls

| Input | Action |
| --- | --- |
| WASD / Mouse | move / look |
| LMB / RMB | focus primary / secondary spell |
| Space | jump (double-jump / glide with the right boots) |
| Shift | relic (dash, grasp, ward…) |
| E | interact |
| Q | quick-use belt slot 1, 1–4 belt slots |
| F | sign (Open Palm — offer a pact) |
| Tab / I | inventory |
| M | floor map (explored cells only) |
| F3 | performance overlay |

### 5.2 Equipment

`focus` (weapon: staff, wand, tome, orb), `relic` (active ability), `hood`,
`robe`, `boots`, `amulet`, `ring`. Rarity: common → uncommon (1 affix) → rare
(2) → epic (3) → legendary (named, unique mechanic). Items are server-side
instances (`{uid, base, ilvl, rarity, affixes}`); clients only ever *view*
them.

### 5.2.1 Spell amplifiers — the weapon toybox

WebMagic 2's best experiment was gear that *changes how spells behave*, not
just their numbers. WebMagic 3 turns that into a system: **amplifiers** are
affixes that rewrite a spell's delivery. They roll on foci, rings and amulets
and stack across gear (`shared/content/amplifiers.ts`, applied by
`shared/sim/spells/amplify.ts`):

| Amplifier | Effect |
| --- | --- |
| Twinned / Legion | +1 / +2 projectiles in a fan |
| Seeking | projectiles home toward the nearest hostile |
| Ricochet | bounce off walls N times |
| Piercing | pass through N bodies |
| Splitting | on impact, burst into 3 lesser projectiles |
| Volatile | on impact, explode (radius scales with spell) |
| Chaining | on hit, arc to N nearby targets |
| Orbiting | projectiles circle the caster before flying out |
| Echoing | the cast repeats after 0.4 s |
| Trailing (oil/fire/frost/…) | projectiles leave a surface trail |
| Heavy | gravity + triple knockback — bowling-ball spells |
| Magnetic | impact pulls bodies inward (mini singularity) |
| Timed | projectile sticks where it lands, detonates after 1.5 s |
| Converted (element) | the spell's element becomes fire/frost/storm/void/venom |
| Vampiric | a share of damage returns as health |

Because amplifiers rewrite *delivery*, they compose with physics and
surfaces: a Heavy, Ricochet frost bolt bouncing down an oil-slicked corridor
behaves nothing like the plain bolt.

### 5.3 Elements, statuses, surfaces — the emergence engine

* **Elements**: arcane, fire, frost, storm, void, venom, force.
* **Statuses** on anything with a body: burning, wet, chilled, frozen,
  shocked, poisoned, oiled, stunned, slowed (honey/web).
* **Surfaces** on a floor grid (0.5 m cells): water, oil, blood, ice, fire,
  web, acid, spores, honey, ash. Surfaces interact: fire + oil → spreading
  blaze; frost + water → ice; storm + water → electrified pool; fire + web →
  burns away; fire + spores → explosion; fire + ice → water.
* Every creature, prop and player takes part in the same rules — a fleeing
  rat that runs through oil and then a candle becomes a torch that sets the
  bookshelf on fire.

### 5.4 Creatures

Creatures are physical bodies with **senses** (sight cones with line of
sight, hearing of noise events), **memory**, **factions** and **needs**
(hunger, fear, territory). A utility AI picks among behaviours (hunt, flee,
feed, investigate, patrol, guard nest, avoid hazard, retaliate). Consequences:

* **Infighting** — a skeleton archer's arrow that hits a ghoul earns the
  ghoul's grudge.
* **Food chains** — vermin swarm corpses; carrion-eaters hunt vermin.
* **Hazard awareness** — creatures avoid traps they *know about* (low
  intelligence = worse), but not when fleeing, burning, blind or knocked
  back. Pressure plates respond to *weight*, not to "players".
* **Knockback is real** — force spells, explosions and heavy hits shove
  bodies into pits, spikes, lava, each other.

### 5.5 Helpers

Not everything wants you dead: lost lanterns lead to treasure, bound dreamers
(ghosts of dead delvers) can be freed to fight with you for a floor, mercy
candles heal, wandering peddlers trade, shrines grant boons at a price.

## 6. Visual identity — "gritty pixels, fancy light"

* Render at a low internal resolution (default 640×360) and upscale with
  nearest-neighbour — chunky pixels by construction, cheap by construction.
* 64×64 procedural textures with **normal, roughness, metalness and emissive**
  maps, sampled nearest — pixels that catch light.
* **Deferred lighting**: hundreds of point lights (every torch, candle,
  projectile, spell, glowing fungus) with grid-traced wall shadows (no light
  bleeding through walls) and volumetric in-scattering halos in dusty air.
* **Screen-space reflections** on wet stone, water, ice, metal, polished
  floors.
* **Particles** everywhere: embers, smoke, dust motes, spores, sparks, blood,
  splinters, snow, ink.
* Per-stratum colour grading, fog, and an optional ordered-dither palette
  pass for the old-dungeon-game look.
* Models are procedural and *detailed*: articulated creatures built from
  many parts with procedural animation; props with bevels, bands and trims;
  architecture with pillars, arches, beams, alcoves and debris.

## 7. Audio

Fully synthesized (WebAudio): spatialised one-shots, creature voices,
footsteps by surface, layered ambience per stratum, heartbeat presence cue,
and slow tonal drones that react to danger.
