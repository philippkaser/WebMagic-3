# The Godwell — Bestiary

> Gameplay-facing creature, prop, trap and hazard design for all ten strata.
> Lore reasons live in [LORE.md](LORE.md) §3; this page is what the sim needs.
> Ids are final unless an engineer has a good reason; numbers are suggestions
> at "floor 1 of that stratum" and are expected to be tuned.

## 0. Conventions

**Size / mass classes** (plates trigger by resting mass; a delver is ~75 kg
with gear):

| Class | Mass | Notes |
| --- | --- | --- |
| tiny | < 5 kg | never triggers a plate alone; a pile of them can |
| small | 5–30 kg | triggers only light plates |
| medium | 30–90 kg | delver-sized |
| large | 90–300 kg | triggers every plate; shoves delvers |
| huge | 300–1000 kg | breaks weak floors; knockback-resistant |
| colossal | > 1000 kg | wardens only |

**Telegraphs.** Every attack lists a windup (s) and its *read* — the pose or
sound that tells a player it's coming. Windups under 0.3 s are for tiny
creatures only.

**Intelligence** (0–1) = trap awareness and tactics: < 0.2 walks into
everything; 0.3–0.5 avoids traps it has *seen* trigger; 0.6–0.8 knows its own
stratum's traps and uses cover; > 0.8 lures enemies into traps.

**Senses:** sight range (m) / FOV, hearing range (m), darkvision yes/no.

**Emergence rule of thumb:** every creature should have at least one thing it
*does to the world* (lights, eats, carries, spills, snuffs, repairs, floods)
and at least one thing the world *does to it* beyond damage.

## 1. Factions

Existing ids (see `shared/content/factions.ts`): delvers, dead, vermin,
carrion, archive, deep, choir, fungal_beasts, foundry, slag, hive, frost,
flesh, orrery, unlit, dream, wild, helpers.

**Addition — `parasite`** ("Things That Feed"): ticks, leeches, lampreys.
Hostile to and preys on everything with blood: `delvers, vermin, carrion,
wild, flesh, hive, fungal_beasts`. Ignores `dead, archive (paper), foundry,
slag, orrery, frost (frozen), unlit, dream`. Fears nothing; flees fire.
Used by: `blood_tick` (Red Garden), `pale_leech` (Drowned Archive, optional
extra).

**Suggested relationship tweaks** (small; all optional):
* `dead` fear `fire`-carrying things is behavioural, not a faction rule — use
  `avoid_hazard`.
* `wild.prey += ["hive"]` — raider wasps eat larvae (Gilded Hive).
* `frost.hostile += ["wild"]` — rime crows are pecked at by the waking.
* `choir.hostile += ["wild"]` — dissonants are `wild`, and the chord hates
  them.
* `dream` is hostile to everything that hides: suggest `dream.hostile +=
  ["unlit"]` so the Seeker hunts the Unlit's own creatures.

Creatures marked **(exists)** already have a definition in
`shared/content/creatures/`; the notes here extend them.

---

## 2. Stratum 1 — The Undercroft (floors 1–10)

Signature systems: candles and oil; the dead tidy things; vermin eat
everything; flames lean downward.

### `grave_rat` — Grave Rat (exists)
*Fat on the dead, bold in numbers, cowards alone.*
* **Faction** vermin · **Size** tiny (2 kg) · **Moves** walk, swim
* **Attacks:** *bite* — lunge 1.2 m, windup 0.25 (rears up, single squeak);
  25% bleeding.
* **Senses:** sight 8 / 120°, hearing 16, darkvision.
* **Intelligence** 0.1 — runs across plates (too light to trigger alone),
  through oil, through fire when panicked.
* **Temperament:** aggression 0.3 alone, 0.9 in a pack of 4+; courage 0.6
  alone (flees at 60% hp), 0.1 in a pack. Call radius 10.
* **Interactions:**
  * **Swarms any corpse** (any faction, including other rats) and feeds
    ~6 s; a feeding swarm ignores delvers more than 4 m away.
  * **Turns on the wounded:** targets any non-dead creature under 40% hp
    within 8 m, regardless of faction. Fight near rats and they finish off
    whichever of you is losing.
  * Gnaws **tallow**: attacks candle wights' candles and tallow ghouls when
    starving (no corpse for 60 s).
  * **Fur is flammable:** a burning rat panics and runs a random path for 3 s
    — through oil, past shelves — spreading fire. This is the canonical
    "rat becomes a torch" moment.
  * Swims; shaken off by wet. Flees keeners' wail and any explosion.
  * Eaten by tallow ghouls. Fears `carrion`.
  * Five or more rats piled on a corpse on a pressure plate **do** trigger it.

### `ossuary_shambler` — Ossuary Shambler (exists)
*Bones that remember the shape of a person, badly — forty men's ribs in one
chest.*
* **Faction** dead · **Size** medium (60 kg) · **Moves** walk
* **Attacks:** *swipe* — melee 1.7 m, windup 0.55 (arm cocks back, bones
  clatter); impulse 6. *Fling* — ranged bone shard 4–12 m, windup 0.7 (tears
  a rib out of its own chest).
* **Senses:** sight 14 / 110°, hearing 18, darkvision.
* **Intelligence** 0.2 — avoids spike plates it has seen fire; otherwise
  oblivious.
* **Temperament:** aggression 0.8, courage 0 (never flees).
* **Interactions:**
  * **Eats bone:** walks to `bone_pile` props and skeletal corpses (dead
    vigil archers, other shamblers) and absorbs them over 3 s: +25% max hp,
    +10% scale per meal, up to 3 meals. A well-fed shambler is huge.
  * Throwing its ribs costs it hp (a shambler that flings a lot falls apart).
  * **Force** knocks it apart into a bone pile that reassembles after 8 s
    unless the pile is burned, crushed or another shambler eats it.
  * Dry bone is **flammable**: burning shamblers keep coming and set fire to
    what they touch.
  * Too dim to fear anything; happily stands on a pit edge.

### `candle_wight` — Candle Wight (exists)
*A mourner who never stopped keeping vigil. The candle on its head is its
heart.*
* **Faction** dead · **Size** medium (40 kg) · **Moves** walk (a gliding
  shuffle)
* **Attacks:** *flick* — spell `wight_flame` 3–14 m, windup 0.6 (tilts head,
  flame flares white). *Wax drip* — melee 1.5 m, windup 0.4, fire + 2 s
  slowed (the wax sets).
* **Senses:** sight 16 / 120° (it is the light), hearing 12, no darkvision —
  it sees by its own candle.
* **Intelligence** 0.6 — knows oil burns; will light it deliberately under a
  delver.
* **Temperament:** aggression 0.8, courage 0.3; kites.
* **Interactions:**
  * **Tends lights:** walks to any extinguished candle, candelabrum, lamp or
    brazier within 20 m and relights it (2 s). If an oil puddle is between it
    and the lamp, it walks through and lights the puddle too.
  * **Water is death:** being `wet` snuffs its candle → it goes *blind* for
    6 s (sight 2 m) and flails. Flees water surfaces; won't cross them.
  * Frost or a keener's wail also snuffs the candle (blind 4 s).
  * **Keener feud:** keeners snuff candles; wights relight them. Same
    faction, never fight, but will spend whole minutes undoing each other.
  * Drops a lit candle when it dies — onto oil, that's a fire.
  * Leaves `mercy_candle`s behind on bone saucers (see helpers) roughly once
    per floor.

### `vigil_archer` — Vigil Archer
*Bowe's stair-watch. Shoots anything coming up.*
* **Faction** dead · **Size** medium (35 kg) · **Moves** walk
* **Attacks:** *bone arrow* — ranged 6–24 m, windup 0.6 (draws, audible
  creak, bow flexes). Arrows are physical projectiles: they **hit whatever is
  in the line**, including other creatures. *Kick* — melee 1.2 m, windup 0.4,
  impulse 8 (to make space).
* **Senses:** sight 26 / 90°, hearing 14, darkvision.
* **Intelligence** 0.5 — holds chokepoints and stairs; avoids traps; stands
  on high ledges.
* **Temperament:** aggression 1, courage 0; kites; call radius 16.
* **Interactions:**
  * **Friendly fire causes grudges:** an arrow that hits a tallow ghoul, rat
    swarm or shambler earns a grudge (canon example). Ghouls will climb to
    reach it.
  * **Prefers targets moving toward the arrival point** (coming "up"),
    ignores targets standing still for > 3 s at long range.
  * Shoots at the source of any `alarm` trap (bell_wire).
  * Arrows can cut **rope** — hanging cages, chandelier chains, urn nets —
    dropping them on whoever's below.
  * Dry and **flammable**; brittle to force (knocked back = knocked apart
    into a bone pile).

### `tallow_ghoul` — Tallow Ghoul
*Got into the rendering vats and never got out. Slick, hungry, ready to burn.*
* **Faction** carrion · **Size** large (95 kg) · **Moves** walk, climbs low
  ledges
* **Attacks:** *pounce* — lunge 4 m at 9 m/s, windup 0.5 (crouches, jaw
  unhinges, wet slap). *Gnaw* — grab 1.2 m, windup 0.35, holds 1.5 s,
  bleeding.
* **Senses:** sight 12 / 120°, hearing 20, smell corpses at 30 m (treat as
  hearing of corpses), darkvision.
* **Intelligence** 0.3.
* **Temperament:** aggression 0.9, courage 0.2; retaliates on grudges.
* **Interactions:**
  * **Permanently `oiled`.** Drips an oil trail when below 50% hp.
  * **Fire makes it a torch that does not flee**: it keeps coming, burning,
    igniting every oil puddle and flammable thing on its path. Burning ghouls
    are the stratum's most dangerous emergent event.
  * Eats corpses (6 s, heals 30%) and **hunts grave rats** — rats scatter
    from it.
  * Holds grudges against vigil archers (climbs to reach them).
  * On death: oil splash r 1.5.
  * Afraid of nothing except the sexton, whose shovel it has met.

### `bloat_fly` — Bloat Fly
*A fly the size of a lamb, full of what it ate.*
* **Faction** carrion · **Size** small (6 kg) · **Moves** fly (low, slow,
  bobbing)
* **Attacks:** *retch* — cone 3 m / 40°, windup 0.7 (abdomen pulses, gurgle),
  venom + poisoned.
* **Senses:** sight 10 / 200°, hearing 8.
* **Intelligence** 0.1.
* **Temperament:** aggression 0.4 (prefers corpses), courage 0.
* **Interactions:**
  * **Bursts on death** into *grave mould*: `spores` surface r 2 + poisoned
    cloud. **Every other creature avoids the cloud** (`avoid_hazard`) except
    rats. Fire in the cloud → explosion (fire + spores).
  * **Pop it over enemies.** Arrows and bolts that hit a bloat fly burst it
    mid-air, dropping the cloud on whoever is beneath.
  * Hovers over corpses in pairs; where you see bloat flies, there is a body.
  * Drifts with the Downdraft (hazard) toward the Descent.

### `keener` — Keener
*Bowe hired mourners for every funeral. They're still keening, now for
everyone.*
* **Faction** dead · **Size** small (15 kg, mostly cloth) · **Moves** hover
* **Attacks:** *keen* — nova 7 m, windup 1.0 (rises, veil billows, a rising
  wail you hear first): feared 2 s on vermin and delvers, **snuffs every
  flame in radius**, noise 30 (wakes the dead). *Cold hand* — melee 1.3 m,
  windup 0.45, frost + chilled.
* **Senses:** sight 12 / 360°, hearing 24.
* **Intelligence** 0.4.
* **Temperament:** aggression 0.6, courage 0.4 — drifts away from bright
  light, returns in the dark.
* **Interactions:**
  * The keen **wakes sleeping dead** across the room and **scatters rats**.
  * Snuffs candle wights (blinds them) — see feud.
  * The veil is **cloth: very flammable**. A burning keener flies erratically
    for 3 s, lighting what it brushes.
  * Puts out `mercy_candle`s (it can't help it).

### Warden — `sexton` — Hollis Crane, the Sexton of Bowe (exists)
*Sealed the door. Kept the candles thirty-one years. Went down to be let in.*
* **Faction** dead · **Size** huge (400 kg, 3.2 m) · **Moves** walk
* **Phase 1 — The Digger:** *shovel sweep* (melee 2.8 m, windup 0.8 — shovel
  over the shoulder, grunt; impulse 22), *grave slam* (slam 4 m, windup 1.2
  — both hands up, shovel blade-down; ash surface r 3), *bone volley*
  (ranged, windup 0.9). **Buries:** anything standing still > 2 s within 6 m
  gets a slam aimed at it — including his own shamblers.
* **Phase 2 (50%) — The Mason:** drops the shovel for trowel and bricks.
  *Lay wall* (wall, stone, 5 m × 2.5 m, windup 1.5 — kneels, slaps mortar)
  to cut the arena in two, trapping a delver with rats he's released from
  coffins. *Mortar fling* (lobbed; `slime` surface r 1.5 → slowed). *Brick
  throw* (heavy physical projectile, knockback).
* **Interactions:** stops attacking to **repair** walls broken by explosions
  (3 s window); his walls block vigil archers' lines too; he is heavy enough
  to break `collapse_floor` if lured over one (falls, stunned 4 s); rats flee
  him; tallow ghouls won't approach him. Water does nothing to him. He never
  flees.
* **After:** the bricked door opens. Behind it Bowe sits in rows, holding
  hands. The Descent is at the far end.

### Helpers
* `lychdog` — **Lychdog** · helpers · small (25 kg) · walk. Trots 6–10 m
  ahead; **stops and stares** at hidden traps (reveals them after 1 s);
  **paws the floor** above buried loot and near Reliquaries; whines at the
  Descent. Never fights; flees combat, returns after. Rats avoid it. Vanishes
  if struck by a delver.
* `mercy_candle` — **Mercy Candle** · static prop-helper. Heals 2 hp/s within
  3 m while lit. Put out by water, frost, wind, keeners. Relit by any fire
  spell or a candle wight.

### Props
| id | Physical behaviour |
| --- | --- |
| `urn` (exists) | ceramic, hp 4, grabbable; breaks → `ash` r 0.6; 15% a grave rat inside; stacked urns on shelves fall when the shelf is struck. |
| `coffin` (exists) | wood, flammable, 70 kg; interact to open (loot, or a sleeping shambler, or 3–5 rats). Sturdy cover. |
| `candelabrum` (exists) | metal, knockable; falls over → drops 3 lit candles (each a fire seed). Wights relight it. |
| `oil_lamp` (exists) | glass; breaks → `oil` r 1.2 + `fire` if lit. |
| `tallow_vat` | static iron vat of warm tallow. Break the spigot (hp 10) → `oil` r 2.5; any flame within 1 m ignites it. Ghouls feed from it (heal). |
| `ossuary_shelf` | tall bone rack, 120 kg, hp 30. Force/explosion topples it: crush damage along its length, spills 2–3 `bone_pile`s (shambler food) and urns. |

Also used: `bone_pile`, `barrel`, `oil_barrel`, `powder_keg`, `crate`
(all exist).

### Traps
| id | Trigger | Effect |
| --- | --- | --- |
| `spike_plate` (exists) | plate, minMass 25 | spikes; rats don't trigger it, shamblers and delvers do; a rat pile on a corpse does. |
| `bell_wire` | tripwire | rings a hanging bell: noise 40 — wakes all dead in range; vigil archers aim at the wire. Anything can trip it (fleeing rats too). |
| `watching_skulls` | sight (8 m line) | a row of skulls in a wall; the first *moving* body in the line gets a volley of bone darts (`trap_dart`). Rats trigger it constantly; a thrown urn wastes a volley. Rearm 4 s. |
| `tallow_chute` | plate, minMass 40 | a chute dumps warm tallow (`oil` r 2) and then a lit candle 1 s later (`fire`). Hear the chute rattle first. |
| `collapse_floor` (exists) | plate, minMass 60 | boards give way into a spiked pit (or water). Lure the sexton or a fat shambler. |

**Liquids/surfaces:** water (seep pools, cisterns), oil (lamps, vats, ghouls),
blood, ash (urns, slams), spores (bloat-fly grave mould), slime (the sexton's
mortar).

### Hazards
1. **The Downdraft** — every ~90 s the Well breathes in (a long, low sigh on
   the audio bus). For 6 s: all flames lean toward the Descent, unshielded
   candles in corridors have a 30% chance to gutter out, gas and spore clouds
   drift 3 m downhill, and noise carries 2× further in that direction.
2. **Bone walls** — ossuary walls are stacked bone. An explosion or a force
   impulse over threshold collapses a 2 m section: damage to anything
   adjacent, spills bone piles, opens a new route. Shamblers flock to eat the
   rubble.

---

## 3. Stratum 2 — The Drowned Archive (floors 11–20)

Signature systems: water everywhere (storm is king, fire is hard), paper
burns like nothing else, **noise** is the currency — the stratum is hunted by
ear.

Surface notes: `ink` here is cuttle ink thinned with lamp oil, the way Stoop
liked it — flammable (as in `surfaces.ts`). *Suggested:* standing in ink
applies `oiled` for 3 s. Lamp oil **floats on water**: an oil spill on a
flooded floor becomes a drifting slick, and a burning slick drifts too.

### `drowned_scribe` — Drowned Scribe
*Still at work, walking along the bottom with its pen.*
* **Faction** archive · **Size** medium (65 kg, waterlogged) · **Moves**
  walk (never swims — walks on the bottom of deep water, fully submerged)
* **Attacks:** *quill stab* — melee 1.4 m, windup 0.4 (pen raised like a
  dagger, drips). *Inkpot* — lobbed 4–14 m, windup 0.8 (unscrews the lid;
  it's a slow, polite motion): `ink` r 1.2.
* **Senses:** sight 12 / 100°, hearing 16, darkvision.
* **Intelligence** 0.5 — knows the hush plates and avoids them; doesn't know
  new traps.
* **Temperament:** aggression 0.5 (0.9 if its desk or a shelf is damaged),
  courage 0.2.
* **Interactions:**
  * **Permanently `wet`** — immune to burning, takes +50% storm; standing in
    water it is `shocked` by any storm in the pool.
  * **Firefighter:** runs to any burning shelf/paper within 20 m and beats it
    out (2 s per cell), wading through anything to get there. Set a fire in
    a dry gallery and the scribes come to you — and cluster, wet, in one
    place.
  * **Reshelves:** picks up loose books and paper stacks and walks them back
    to shelves. It will pick up a lore note you haven't read yet.
  * Wanders back to its desk; hurting the desk enrages it.
  * Proctors will hit a scribe that makes noise (a dropped inkpot).

### `proctor` — Proctor
*Enforced silence in the reading rooms. Now blind, and very sure of itself.*
* **Faction** archive · **Size** large (130 kg, 2.6 m, long arms) · **Moves**
  walk (silent — no footsteps)
* **Attacks:** *ruler* — slam 2.6 m, windup 0.8 (raises a long iron rule
  overhead; the only sound it ever makes is a sharp inhale): impulse 18,
  stunned 0.5 s. *SHH* — cone 8 m / 60°, windup 1.2 (bends, finger to where
  its lips were): force, knockback, `stunned` 1 s, and **silences** — targets
  can't cast for 1.5 s (use `stunned` if no silence status exists).
* **Senses:** sight 0 (blind), hearing 40, darkvision n/a.
* **Intelligence** 0.7 for known layout (walks the floor's aisles
  perfectly), 0 for traps it can't hear.
* **Temperament:** aggression 1 toward noise sources; ignores silent things
  entirely even at 1 m. Courage 0.
* **Interactions:**
  * **Hunts noise, any faction:** attacks the loudest thing it can hear —
    rustling folio swarms, a dropped inkpot, a crackling lamp jelly, an
    explosion, a delver wading. Wading makes noise; standing still in water
    does not.
  * **Lure it:** throw a book, shoot a bell, pop a jelly. It will walk
    straight over a spike plate to reach the sound.
  * Its SHH knocks folio swarms apart (they reform) and blows out candles.
  * Storm on a wet proctor stuns it 2 s. It hates splashing, and steps round
    deep water where it can.
  * Its footsteps are silent, but its keys aren't: a proctor carrying the
    floor's key (see chest rules) jingles.

### `folio_swarm` — Folio Swarm
*Loose pages that learned to flock.*
* **Faction** archive · **Size** tiny swarm (1 kg total, ~40 sheets) ·
  **Moves** fly
* **Attacks:** *paper cuts* — melee envelope 1.5 m, windup 0.3 (sheets tilt
  edge-on, a sharp rustle): 3 hits of bleeding.
* **Senses:** sight 10 / 360°, hearing 10.
* **Intelligence** 0.
* **Temperament:** aggression 0.7, courage 0.
* **Interactions:**
  * **Extremely flammable:** a burning swarm flies erratically for 4 s,
    igniting shelves, paper stacks, ink and oil slicks as it passes — then
    falls as ash. One stray fire spell can burn a gallery down.
  * **Water kills it:** sodden pages drop and become a mulch (dead). Rain
    from the Tide, a splash, a sluice — all lethal.
  * **Force/explosions scatter it** into 3 small swarms for 5 s.
  * Rustles constantly — proctors hunt it; vellum grubs eat it.

### `ink_cuttle` — Ink Cuttle
*Stoop farmed them in the cisterns for ink. They farmed back.*
* **Faction** deep · **Size** medium (35 kg) · **Moves** swim (deep water
  only; can lunge 3 m out of the water)
* **Attacks:** *beak grab* — grab 3 m from the waterline, windup 0.6 (the
  water bulges, two pale arms surface first): drags the target 2 m into deep
  water, holds 2 s. *Ink jet* — cone 6 m / 30°, windup 0.5 (mantle
  contracts): `ink` surface + blinds (sight 3 m for 3 s — reuse `stunned`
  0.3 s + fx if no blind status).
* **Senses:** sight 14 / 180° (only near/under water), hearing 12 (water
  vibration: anything wading counts as noise 2×), darkvision.
* **Intelligence** 0.4.
* **Temperament:** ambush; aggression 0.8 at the waterline, 0 on land.
* **Interactions:**
  * **Hurt → ink cloud:** below 50% hp it dumps ink across the pool (`ink`
    r 3 on the water surface) and turns *invisible* while inside it.
  * **Storm in its pool is devastating** (+100% while submerged). So is a
    lamp jelly drifting into its pool — cuttles flee jellies.
  * **Preys on archive:** grabs drowned scribes that walk too near and pulls
    them under; eats vellum grubs that fall in.
  * Frost on its pool: an iced pool traps it (frozen, then shatterable).
  * Drop: Ink Sac (high chance).

### `vellum_grub` — Vellum Grub
*Eats paper. Especially the paper you came to read.*
* **Faction** vermin · **Size** small (5 kg) · **Moves** walk, burrow (through
  paper piles and shelves only)
* **Attacks:** *nip* — melee 0.8 m, windup 0.3 (head lifts, mandibles open),
  small physical.
* **Senses:** sight 4, hearing 8, smell paper 20 m.
* **Intelligence** 0.05.
* **Temperament:** aggression 0.2; flees when hit.
* **Interactions:**
  * **Eats notes:** moves to lore notes, paper stacks, and books on the floor
    and eats them (4 s). A note eaten before you read it is gone for this
    floor (it respawns elsewhere later). Players learn to kill grubs near
    notes.
  * Burrows *into* bookshelves — a shelf with 3+ grubs in it weakens
    (hp halved) and may topple.
  * Fat body, full of ink: pops on death into `ink` r 1.
  * Eaten by cuttles and deep things; **flammable** (fat).

### `lamp_jelly` — Lamp Jelly
*Stoop read by them. Now they drift the stacks looking for something to read
to.*
* **Faction** deep · **Size** small (8 kg) · **Moves** hover (drifts 1 m above
  water or floor; enters water freely)
* **Attacks:** *sting* — melee 1.2 m, windup 0.5 (bell brightens,
  crackles): storm + shocked. *Discharge* — when it enters water, the pool
  becomes electrified for 3 s every 8 s.
* **Senses:** sight 8 / 360° (light only — it's drawn to the brightest light
  in 25 m, including your lantern and fires), hearing 0.
* **Intelligence** 0.
* **Temperament:** passive drifter; aggression 0.3; never flees.
* **Interactions:**
  * **Electrifies pools** it drifts into — hitting everything in them,
    cuttles and scribes included. Other creatures avoid pools with a jelly.
  * **Drawn to light:** lure jellies with a lit lamp, a fire, a burning
    swarm — into the scribes' pool.
  * Pops under force/physical: shock nova r 2.5 (and an electrified pool if
    over water).
  * Crackles audibly — proctors attack jellies, and get shocked.
  * A light source (warm blue) — killing jellies darkens rooms.

### Warden — `oddny_quell` — Magister Oddny Quell, Keeper of the Last Line
*Redrafted while the water rose past her collar.*
* **Faction** archive · **Size** large (medium body on a floating lectern-raft,
  220 kg total) · **Moves** swim (the raft drifts; she poles it)
* **Phase 1 — The Draft:** *write* — 3 projectile glyphs that curve (arcane,
  windup 0.7: pen scratches loudly, the letters hang in the air a beat before
  flying). *Strike-through* — a horizontal beam 18 m, windup 1.4 (she draws
  a long line across the page): void, removes `blessed` and shields.
  *Blot* — lobbed ink bombs, `ink` r 2.
* **Phase 2 (50%) — The Tide:** the sluices open; the arena floods over
  20 s to waist depth (everything becomes water; storm hits the whole room).
  She summons folio swarms and throws *correction fluid* — frost cones that
  ice the water around her raft into platforms (and around you).
* **Tell/weakness:** her **page** (a prop on the lectern, hp 60) — damage it
  and she stops attacking for 3 s to correct it. Burning the page stuns her
  5 s but sets the raft on fire (floating burning oil).
* **Interactions:** proctors attend her (noise draws them); lamp jellies in
  the flooded phase make storm doubly lethal for everyone; frost bridges she
  makes can be shattered under her own swarms.

### Helpers
* `margin_ghost` — **Margin Ghost** · helpers · hover. Drifts toward hidden
  notes and traps within 15 m and draws a glowing chalk ring round them.
  Stand still near it for 3 s and it writes a line on the nearest wall (a
  hint: where the Descent is, what's in the next room). Frightened off by
  proctors.
* `ferry_copyist` — **Ferry Copyist** · helpers · swim. A raft of book-covers
  that carries you across deep rooms to the next landing. Costs one Drowned
  Vellum. Stops to reshelve anything it passes (a slow ferry).

### Props
| id | Physical behaviour |
| --- | --- |
| `bookshelf` | tall wood, 150 kg, hp 40, **flammable** (burns 20 s, spreads to neighbours). Topples under force/explosion or 3+ vellum grubs: crush damage in a 3 m strip, spills 2 `paper_stack`s, blocks the aisle. |
| `reading_desk` | wood, 45 kg, pushable; often carries a candle (knock it → fire on paper) and a lore note. Scribes defend their desks. |
| `ink_barrel` | wood, 40 kg, hp 12; breaks → `ink` r 1.5 (flammable). |
| `paper_stack` | hp 1, 3 kg, grabbable; **very flammable** (ignites from any adjacent fire); vellum grubs eat it; throws as a bundle. |
| `floating_lantern` | brass lamp on a cork float, drifts on water; breaks → oil slick on water, **burning** if lit. Jellies swarm it. |
| `rolling_ladder` | on a rail along shelves; push to slide (hits whatever's in the way for impulse 10); climbable to balconies. |

### Traps
| id | Trigger | Effect |
| --- | --- | --- |
| `hush_plate` | plate, minMass 20 | rings the closing bell: noise 50 — every proctor on the floor walks here. A scribe carrying a book won't step on it. |
| `shelf_topple` | tripwire | a rigged bookshelf falls across the aisle: heavy crush, blocks the way. Anything can trip it. |
| `sluice_gate` | timer (every 40–70 s) or lever | opens: a flood wave (water r 6, impulse 14 outward) spreading across the room; puts out fires, kills folio swarms, carries jellies in. |
| `ink_jet` | sight (10 m cone) | a reading lamp shaped like a heron spits ink: `ink` cone + suggested `oiled`. Pair it with a candle. |
| `letter_tube` | proximity (2 m) | brass pneumatic tubes fire weighted letters as darts (`trap_dart`, 3 in a line). Loud (noise 20) — proctors come. |

**Liquids/surfaces:** water (shallow and deep), ink, oil (floats), blood.

### Hazards
1. **The Tide** — floors breathe: over ~2 minutes the water level rises
   0.5–1 m and drains again. At high tide, shallow floors become wading
   (noise, slow), fires in low areas go out, jellies drift further, and
   cuttles can reach new ledges. A distant bell rings once before it turns.
2. **Waterlogged floors** — rotten boards over deep water break under
   anything over 120 kg or any explosion: whatever's on them drops into deep
   water (cuttle country). Proctors avoid them; attempts from the Foundry
   would not.

---

## 4. Stratum 3 — The Mycelial Choir (floors 21–30)

Signature systems: **spores explode** (fire is suicide or genius), groups
buff each other (**harmony**), sound is a weapon, herds stampede.

### `choir_husk` — Choir Husk
*A singer overgrown. Still singing, with everyone else.*
* **Faction** choir · **Size** medium (60 kg) · **Moves** walk (slow sway)
* **Attacks:** *embrace* — grab 1.6 m, windup 0.7 (arms open wide, the song
  swells): holds 2 s, venom + poisoned; while held, other husks get free
  hits. *Spore breath* — cone 4 m / 50°, windup 0.8 (chest inflates, gills
  flare): `spores` surface + poisoned.
* **Senses:** sight 10 / 120°, hearing 22 (they listen for anything *out of
  tune* — player casts, footsteps off the beat), darkvision.
* **Intelligence** 0.2 as individuals, 0.6 in harmony (see below).
* **Temperament:** aggression 0.7, courage 0 (never flee); call radius 20 —
  the song carries.
* **Interactions:**
  * **Harmony:** with 3+ husks within 8 m, each gains 30% damage
    resistance and hits 20% faster. Five in harmony and the room's
    `mouthpiece` starts pulsing. Split them up.
  * Damp: slow to ignite, but their **spore puffs** are what explodes. Fire
    near a husk group that has been breathing spores = chain explosion.
  * **Absorb:** a husk that grabs a corpse (any faction) for 5 s turns it
    into a new, weaker husk. Kill the fungal_beast before the choir reaches
    it.
  * Hostile to `fungal_beasts` (which eat them) and to dissonants.
  * Force knocks spores out of them (spore puff at impact).

### `cantor` — Cantor
*Keeps the Choir in time. Its hand never stops moving.*
* **Faction** choir · **Size** medium (50 kg) · **Moves** walk
* **Attacks:** *note* — projectile, force, 6–20 m, windup 0.6 (hand raised,
  the chord drops in pitch): knockback 12. *Swell* — self/ally buff, windup
  1.5 (both arms rise, the song rises a key): choir within 12 m gain +30%
  speed and harmony for 8 s.
* **Senses:** sight 18 / 140°, hearing 26.
* **Intelligence** 0.6 — keeps husks between itself and delvers.
* **Temperament:** aggression 0.6, courage 0.4 — backs off behind husks.
* **Interactions:**
  * **Kill the cantor → the choir loses time:** every choir creature within
    15 m is `stunned` 2 s and loses harmony for 10 s.
  * Its notes knock *everything* back — including husks off ledges and
    grazers into lurkers.
  * Dissonants make a beeline for cantors.

### `mouthpiece` — Mouthpiece
*A fungal bell the size of a cart. Lean grew them to throw its voice.*
* **Faction** choir · **Size** huge (static, 600 kg) · **Moves** static
* **Attacks:** *resonance* — nova 10 m, windup 2.0 (the bell's lip trembles,
  a deep hum rising until your screen shakes): force, impulse 25, only while
  3+ choir are singing within 12 m; every 6 s.
* **Senses:** hearing 30 (responds to the song, not to delvers).
* **Intelligence** 0 · **Temperament:** n/a · hp high, weak to fire.
* **Interactions:**
  * **Knockback engine:** throws *everything* in radius outward —
    delvers, husks, grazers — into pits, lurkers, spore vents.
  * Silencing the singers (killing or stunning them) silences it.
  * Striking it with force makes it ring once on its own (the same nova,
    no windup reduction) — use it on a crowd.
  * Burns well once lit: 20 s, drops a great spore burst when it collapses.

### `sporeback` — Sporeback
*A rim boar the mould took along. The field on its back is still growing.*
* **Faction** fungal_beasts · **Size** large (160 kg) · **Moves** walk
* **Attacks:** *charge* — lunge 8 m at 11 m/s, windup 0.9 (paws the ground
  twice, head down, snort): impulse 26, knocks anything in the path aside.
  *Gore* — melee 1.5 m, windup 0.5.
* **Senses:** sight 12 / 140°, hearing 16, smell 20.
* **Intelligence** 0.2 — charges straight; can't stop in time at pit edges
  or spike plates.
* **Temperament:** territorial — aggression 0.3 unless within 8 m of its
  lumen patch, then 0.9. Courage 0.3.
* **Interactions:**
  * **Hit on the back → spore puff** (`spores` r 1.5). Fire hitting its back
    = explosion *on the boar* (it survives, burning, and charges randomly).
  * **Eats husks:** preys on choir; roots them up (a sporeback will charge a
    husk group).
  * Eats lumen caps (heals).
  * A charging sporeback through a husk harmony group breaks it.
  * Heavy: triggers every plate; heavy enough for `sinkhole_mat`.

### `lumen_grazer` — Lumen Grazer
*Slow, glowing, gentle, and the size of a haycart.*
* **Faction** fungal_beasts · **Size** huge (320 kg) · **Moves** walk
* **Attacks:** *trample* — only while stampeding: anything in its path takes
  heavy physical + impulse 30. *Head swing* — melee 2 m, windup 1.0 (low
  bellow), if cornered.
* **Senses:** sight 10 / 280°, hearing 20.
* **Intelligence** 0.1.
* **Temperament:** aggression 0 (never starts a fight), courage 0.9 (spooks
  at 90% hp); herds of 3–6.
* **Interactions:**
  * **Stampede:** any loud noise (explosion, mouthpiece, cantor note) or fire
    within 10 m → the whole herd bolts *away from the source* for 5 s,
    trampling whatever is in the way — husks, lurker nets, delvers. Scare a
    herd *into* the choir.
  * Glows (a walking light) — dead grazers darken the cavern.
  * Eats lumen caps, and is food for hyphae lurkers.
  * Drop: Lumen Cap (high chance).

### `hyphae_lurker` — Hyphae Lurker
*The mould's own appetite, a net of threads under the floor.*
* **Faction** fungal_beasts · **Size** large (static mouth, 140 kg; threads
  cover r 5) · **Moves** burrow (repositions slowly between fights)
* **Attacks:** *snare* — proximity 5 m, windup 0.4 (the floor ripples,
  threads lift like hair): `webbed` 3 s + pull 2 m/s toward the mouth. *Bite*
  — melee at the mouth 1.5 m, windup 0.6.
* **Senses:** tremor only — "hearing" 8 m for footsteps; can't sense
  flying or hovering things.
* **Intelligence** 0.
* **Temperament:** ambush; eats anything.
* **Interactions:**
  * Eats grazers, husks, sporebacks, delvers — it's not picky. Stampedes
    feed it.
  * The threads are a `web` surface: **fire burns them away** (and the
    lurker flees underground 10 s).
  * Knockback into its net = snared.
  * Visible as a faint pale net on the floor if a light is close.

### `dissonant` — Dissonant
*Began to hear itself again, couldn't bear it, couldn't get out.*
* **Faction** wild · **Size** medium (40 kg, emaciated) · **Moves** walk,
  fast
* **Attacks:** *shriek* — cone 7 m / 60°, windup 0.5 (throws its head back,
  a thin rising screech): force; **choir** targets are `stunned` 2 s,
  everything else `feared` 1.5 s. *Claws* — melee 1.2 m, windup 0.3.
* **Senses:** sight 16 / 140°, hearing 30 (tracks the song).
* **Intelligence** 0.4.
* **Temperament:** hates the choir first (aggression 1 vs choir), delvers
  second (0.5 — only if you're between it and a husk, or you hit it).
  Courage 0.2.
* **Interactions:**
  * **An accidental ally:** leads straight for cantors and husk groups and
    shreds harmony. Lead a dissonant into the choir.
  * Its shriek also stampedes grazers.
  * Husks try to *embrace* it back in: if one grabs it for 5 s, it becomes a
    husk again.

### Warden — `ysolde_half_sung` — Sister Ysolde Sallow, Half-Sung
*Went in last. Hesitated. The chord took her halfway.*
* **Faction** choir (phase 1) → none/`wild` (phase 2) · **Size** large
  (110 kg; a woman fused to a column of fungus that she drags) · **Moves**
  walk
* **Phase 1 — The Chord:** the Choir defends her (husk waves, a cantor).
  *Two-voice beam* — beam 16 m, windup 1.2 (her two mouths open on
  different notes): arcane + force, sweeping. *Cadence* — nova 6 m, windup
  1.6, spores surface r 6 (the room fills; fire becomes very dangerous for
  everyone). *Harmonise* — all choir within 15 m gain harmony regardless of
  count.
* **Phase 2 (50%) — The Solo:** she tears loose from the column (it falls:
  crush strip). **The Choir turns on her** (and on you): a three-way fight.
  *Scream* — dissonant-style shriek that stuns choir; *reach* — grab 5 m
  pulling a target to her; she's fast and her voice is now one.
* **Interactions:** in phase 2, luring husks into her is valid; the column's
  fall opens a spore reservoir; mouthpieces in the arena fire on whoever is
  loudest.

### Helpers
* `hermit_cap` — **Hermit Cap** · helpers · static peddler. Sells healing
  caps, lumen tea (light radius +2 m for the floor), and a spore-mask (immune
  to spore poison, 1 floor). Choir ignores him entirely.
* `tuning_stone` — **Tuning Stone** · shrine. Interact or hit with force: a
  wrong note — all choir within 15 m `stunned` 4 s and lose harmony 15 s;
  mouthpieces crack (hp −50%). One use per floor.

### Props
| id | Physical behaviour |
| --- | --- |
| `puffball` | hp 2, 10 kg, grabbable; bursts on hit/step → `spores` r 2. Fire → explosion r 2.5. Throwable grenade. |
| `lumen_cluster` | glowing caps on a stalk, static light (blue-green r 5); harvest (interact) for Lumen Cap; grazers eat it; breaks under trample. |
| `bell_cap` | resonant fungus, 80 kg static; any hit rings it (noise 35): wakes husks, spooks grazers, draws dissonants. |
| `rotting_log` | 200 kg, rolls when pushed downhill or hit by force; slow-burning (40 s); crushes on roll. |
| `spore_sac` | hangs from the ceiling on a stalk; shoot the stalk → falls and bursts (`spores` r 3) on whatever's below. |
| `fungal_pew` | rotted pew, 40 kg, flammable (slow), breaks into splinters; often lined with dormant husks. |

### Traps
| id | Trigger | Effect |
| --- | --- | --- |
| `spore_vent` | proximity 2 m | a gout of spores: `spores` r 2.5 + poisoned cloud 5 s. Near fire = explosion. Grazers avoid vents; husks don't care. |
| `snare_root` | plate, minMass 15 | roots whip up: `webbed` 3 s, pull toward the nearest lurker if any. Fire frees. |
| `resonance_stone` | timer (6 s) | force nova r 5, impulse 18 — rhythmical; learn the beat, use it to throw things. |
| `sinkhole_mat` | plate, minMass 120 | only heavy things fall: grazers, sporebacks, the warden's column — into a slime pit. A delver carrying a heavy prop by grasp counts. |

**Liquids/surfaces:** water, slime (fungal slime; slowed), spores, blood,
web (lurker threads).

### Hazards
1. **Spore Bloom** — every few minutes the cavern exhales: visibility halves,
   the air is thick with spores for 20 s. Any fire in that time chains into
   explosions along the haze. Husks sing louder (harmony range 12 m).
2. **The Chord** — while 4+ choir are singing within 25 m, the chord masks
   hearing: all creatures' hearing ranges halve, and the player's audio cues
   for other threats are ducked. Makes husk rooms oddly sneakable — and
   makes you deaf to the lurker under the floor.

---

## 5. Stratum 4 — The Cinder Foundry (floors 31–40)

Signature systems: **heavy things** (every automaton triggers every plate),
**lava** (the `lava` surface in troughs; also terrain), conveyors that move
bodies, **thermal shock** (fire + frost/water on metal cracks it), steam.

**Thermal shock rule (suggested, stratum-wide):** a metal creature that is
`burning` or standing in lava and then takes frost or becomes `wet` takes a
one-off crack: armour −50% for 6 s and a steam puff (sight-blocking fx,
r 1.5). Water on a hot thing is the Foundry's crit.

### `attempt` — Attempt
*A rejected god, numbered, still walking to be judged again.*
* **Faction** foundry · **Size** large (180 kg, 2.2 m) · **Moves** walk
  (heavy, audible — every step a clank)
* **Attacks:** *hammer-arm* — slam 2.2 m, windup 0.8 (arm winds back with a
  ratchet sound, crucible-chest glows brighter): impulse 20. *Carry* — grab
  1.5 m, windup 0.6 (both arms open, stamp-plate on its chest flips up): lifts
  the target and walks it toward the nearest inspection stamp / furnace for up
  to 3 s. Break free with damage or force.
* **Senses:** sight 14 / 100°, hearing 14.
* **Intelligence** 0.1 — steps on everything. Rides conveyors wherever they
  go.
* **Temperament:** aggression 0.6, courage 0; patrols conveyor lines and
  queues at `stamp_press`es.
* **Interactions:**
  * **Weighs 180 kg** — triggers every plate it touches, including the ones
    you avoided. Lure attempts over drop hammers.
  * **Lava melts it:** falls/pushed into lava → it sinks over 2 s and **a
    `slag_crawler` rises** 4 s later. Killing attempts near lava *feeds the
    slag*.
  * Fire-immune; thermal shock applies; storm stuns 1.5 s (and conducts to
    adjacent metal).
  * Clinker mites swarm damaged attempts (< 50% hp) and eat them (dps).
  * Each has a number painted on it (random 1–9,999). No. 4,112 exists
    somewhere (Dunny's attempt).

### `inspector` — Inspector
*Raise's priests. Looked for a long time. Reached for the stamp.*
* **Faction** foundry · **Size** huge (300 kg, 2.8 m, a tall frame with a
  single lens) · **Moves** walk (slow)
* **Attacks:** *REJECT* — slam 2.5 m, windup 1.0 (lens focuses with a
  whine, stamp arm lifts, a red light blinks twice): stunned 1.5 s + a
  "REJECT" decal on the target. *Discard* — grab 2 m, windup 0.9: throws the
  target 10 m **toward the nearest lava or furnace** (impulse 30, arced).
* **Senses:** sight 22 / 70° (the lens — narrow, long), hearing 10.
* **Intelligence** 0.8 — knows every trap, stands behind conveyors, uses
  attempts as shields.
* **Temperament:** aggression 0.7, courage 0 · call radius 14.
* **Interactions:**
  * **Judges its own side:** grabs any attempt below 50% hp and throws it into
    lava — spawning slag crawlers. Sometimes the Foundry's own ecology is your
    worst enemy.
  * Hostile to slag; will stamp crawlers (which stuns them).
  * **Blind outside its cone:** its narrow lens is exploitable — flank it.
    Umbral/ink/steam blocks its sight entirely.
  * Thermal shock applies. Too heavy to be thrown by most force; a Heavy
    amplifier can do it.

### `stoker` — Stoker
*Feeds the forges. Its chest is a bellows.*
* **Faction** foundry · **Size** large (210 kg) · **Moves** walk
* **Attacks:** *bellows breath* — cone 6 m / 45°, windup 1.0 (chest
  inflates, a rising wheeze, orange glow at the grille): fire, burning,
  `fire` surface on oil. *Coal fling* — lobbed 5–16 m, windup 0.7 (shovel
  scoops): fire surface r 1.2, burns 8 s.
* **Senses:** sight 12 / 110°, hearing 14.
* **Intelligence** 0.5.
* **Temperament:** aggression 0.6, courage 0.2; tends first.
* **Interactions:**
  * **Tends fires:** relights braziers, furnaces and flame jets that were put
    out, and shovels coal onto fires to make them bigger (a stoker makes every
    fire in the room worse).
  * **Punctured bellows:** a crit or ≥ 30 force damage to its back (the
    bellows) → it **explodes** (fire, r 3, impulse 20) 1.5 s later, hissing
    and staggering. Knock it toward its friends.
  * Water or frost on the grille chokes the breath for 4 s (steam).
  * Cinderlings orbit stokers.

### `slag_crawler` — Slag Crawler
*What the rejected Attempts became when they were melted. It remembers.*
* **Faction** slag · **Size** medium (90 kg of semi-molten metal) · **Moves**
  walk (slow on stone, fast — 2× — in lava; swims lava)
* **Attacks:** *molten spit* — lobbed 4–12 m, windup 0.8 (its back humps,
  glow travels up to the "mouth"): `lava` r 0.8 for 6 s. *Engulf* — melee
  1.2 m, windup 0.5: fire + burning.
* **Senses:** sight 8 / 180°, hearing 10, heat-sense 16 m (sees anything
  `burning` or hot through walls).
* **Intelligence** 0.2.
* **Temperament:** aggression 0.8, courage 0.
* **Interactions:**
  * **Leaves a `fire` trail** on stone; crossing oil makes an inferno.
  * **Eats metal:** hunts attempts and clinker mites (heals on kill);
    hostile to all foundry.
  * **Water/frost → it cools to stone:** `frozen`-like shell 5 s (can't
    move); a hit while shelled **shatters** it (instant kill, loud).
    Quench troughs and flasks are the answer.
  * Immune to fire; heat-sense means burning delvers are always found.

### `cinderling` — Cinderling
*A spark that remembers being a fire, and wants to be one again.*
* **Faction** slag · **Size** tiny (1 kg) · **Moves** fly (darting)
* **Attacks:** *ember dash* — lunge 6 m at 14 m/s, windup 0.4 (brightens
  and crackles): explodes on contact, fire r 1.2, then dies.
* **Senses:** sight 12 / 360° — sees *flammables* and *light*, not
  creatures: targets the nearest oil, coal, powder keg, burning thing or
  lantern-bearer.
* **Intelligence** 0.
* **Temperament:** aggression 1; swarms of 4–10 orbit stokers.
* **Interactions:**
  * **Kamikaze into flammables:** oil drums, powder kegs, coal carts, oiled
    creatures, and *you* if you're the brightest light in range. A single
    cinderling near an oil drum is a room-clearing event.
  * Any frost/water kills it instantly (hiss).
  * Wind/force scatters them (they may be blown into something worse).

### `clinker_mite` — Clinker Mite
*The rust of the place, and the rust eats gods.*
* **Faction** vermin · **Size** tiny (2 kg) · **Moves** walk, climbs walls
* **Attacks:** *strip* — melee 0.8 m, windup 0.25 (mandibles scissor,
  metallic chitter): small physical; each hit reduces target **armour by 1**
  for 10 s (stacks to 10).
* **Senses:** sight 6, hearing 12, darkvision.
* **Intelligence** 0.1.
* **Temperament:** swarm; aggression 0.4 vs delvers, 1.0 vs damaged metal.
* **Interactions:**
  * **Eat automata:** swarm any attempt, inspector or stoker under 50% hp
    and strip it to the frame. Wound a big automaton and step back.
  * Nest in `scrap_heap`s — disturb one and 10–20 pour out.
  * Heat-hardened: immune to fire; frost kills them in swathes.
  * Prey for slag crawlers; Attempt No. 77 sweeps them.

### Warden — `last_attempt` — The Last Attempt (Idony Fenwright, its heart)
*Made of every ring and spoon Raise had left. Still waiting to be judged.*
* **Faction** foundry · **Size** colossal (1400 kg, 5 m) · **Moves** walk
  (every step shakes dust down and triggers every plate in the arena)
* **Phase 1 — The Rejected:** *double slam* — slam 5 m, windup 1.4 (both
  cupped hands lifted over its head — they are always cupped): impulse 35,
  cracks the floor into lava fissures. *Weigh* — grab 3 m, windup 1.0: lifts
  the target in its cupped hands and holds it to its chest lens for 2 s
  (heat damage), then drops it. *Conveyor reverse* — it slaps the arena
  switch: all conveyors reverse toward the central crucible.
* **Phase 2 (50%) — The Heart:** the chest opens. Idony is visible,
  glowing, curled around nothing. *Heat nova* r 8 every 10 s (windup 2.0,
  the whole body brightens from the chest outward). The floor channels flood
  with lava. **Weakness:** frost/water hitting the open core → `stunned` 3 s
  and thermal shock (armour −50% 8 s). Quench tanks in the arena can be
  broken toward it.
* **Interactions:** it treads on and destroys its own attempts; clinker
  mites swarm it once damaged (help you); inspectors in the arena do not
  judge it — they kneel. It never flees.
* **After:** its hands open, empty. A felt-lined cradle the size of a thumb
  lies in the crucible, empty.

### Helpers
* `attempt_77` — **Attempt No. 77** · helpers · large (170 kg) · walk. The
  janitor. Follows a delver who doesn't set things on fire for 30 s;
  extinguishes `fire` surfaces near you with a wet mop, sweeps `oil` away,
  fights clinker mites and cinderlings with a broom. Heavy — careful, it
  triggers plates too. Attempts ignore it; inspectors stamp it REJECT and it
  doesn't mind.
* `quench_trough` — **Quench Trough** · shrine/prop. Stone trough of water.
  Wading: clears burning, grants `wet`, and your next 3 fire spells also deal
  frost (thermal-shock bait). Slag crawlers won't come within 3 m.

### Props
| id | Physical behaviour |
| --- | --- |
| `oil_drum` | metal, 60 kg, hp 20; holed → `oil` r 2 leak; ignited → explodes (fire r 3, impulse 25). Cinderlings seek them. (Variant of `oil_barrel`.) |
| `coal_cart` | on rails, 250 kg, pushable/force-able; rolls down gradients, crushing (impulse 20); spills coal → `fire` r 2 burning 30 s if lit, else `ash`. |
| `crucible` | on a pivot, 400 kg; tip it (force/lever) → `lava` wave r 3 in the direction tipped. |
| `quench_tank` | wooden tank, hp 25; breaks → water flood r 4 (impulse 10): kills cinderlings, shells slag crawlers, thermal-shocks automata, puts out fires; on lava → steam cloud + temporary stone floor. |
| `steam_pipe` | wall pipe, hp 15; breaks → steam jet cone 4 m for 8 s: fire damage + blocks sight (inspectors are blind in it). |
| `scrap_heap` | 300 kg static pile; hit/walked on → loud clatter (noise 25) and a clinker mite swarm pours out; grasp can pull usable scrap (a thrown chunk hits like a brick). |

### Traps
| id | Trigger | Effect |
| --- | --- | --- |
| `drop_hammer` | plate, minMass 50 | a steam hammer drops from the ceiling after 0.6 s (hiss, then clang): massive damage, stun. Attempts trigger it constantly — watch the rhythm. |
| `flame_jet` | timer (on 2 s / off 3 s) | wall jet, fire cone 4 m. Stokers relight broken ones. (Variant of `flame_vent`.) |
| `conveyor_switch` | plate, minMass 40 | reverses the room's conveyors toward the furnace mouth; anything on a belt is carried at 3 m/s into `lava`. |
| `steam_vent` | proximity 2.5 m | 1.5 s hiss, then a steam blast: fire damage + impulse 15 upward (launches small things; can carry you onto ledges). |
| `crucible_pour` | tripwire | a ceiling crucible tips: `lava` r 2.5 below. Nothing survives standing there; the wire is thin and coppery — visible in firelight. |

**Liquids/surfaces:** lava (troughs, pours), oil, fire, water (quench), ash.

### Hazards
1. **The Pour** — every 60–90 s a warning bell rings three times and molten
   metal is poured down the channels: `lava` floods the troughs and overflows
   onto low floors for 10 s. Attempts don't care. Everything else runs.
2. **Heat** — near forges and lava, `wet` evaporates 3× faster, `ice` surfaces
   melt to water in 2 s, chilled/frozen durations halve, and ember cores in
   the walls **explode** if hit by fire (r 2, a nasty surprise and a useful
   one).

---

## 6. Stratum 5 — The Gilded Hive (floors 41–50)

Signature systems: **honey** (slows, sticks, doesn't burn — it caramelises),
**wax** (burns, melts, seals), the hive's **pheromone** (Royal Wax disguise),
a war between hive and wild.

*Suggested surface reactions:* fire on `honey` → it caramelises (becomes a
hard, non-slowing floor for 30 s, deals fire while hot). Wax props and wax
seals **melt** under fire.

### `drone_servant` — Drone Servant
*Bend, still carrying food to the Queen.*
* hive · medium (45 kg) · fly (low, laden) / walk
* *Tray bash* — melee 1.4 m, windup 0.5 (lifts the tray like a shield, then
  swings); *drop the load* — when hit, drops what it carries (`honey` r 1).
* Senses sight 14 / 180°, hearing 16 · int 0.3 · aggression 0.1 (only when
  wax or a nursery is damaged, or pheromone alarm), courage 0.5.
* **Interactions:** ignores delvers who don't damage wax; carries food along
  set routes — its route passes through traps it knows; drops honey slicks
  wherever it's hit; pheromone alarm (any hive at < 50% hp) turns every drone
  in 20 m aggressive. Wet wings can't fly (walks, slow). Raider wasps hunt
  drones.

### `stinger_guard` — Stinger Guard
*Stands at every door the Queen might need.*
* hive · large (95 kg) · fly/walk
* *Sting lunge* — lunge 5 m, windup 0.6 (abdomen curls under, a buzzing
  pitch-rise): venom + poisoned (strong). *Wing buffet* — cone 3 m, windup
  0.4, impulse 10.
* Senses sight 18 / 160°, hearing 18 · int 0.6 · aggression 0.9, courage 0.1
  · call radius 20.
* **Interactions:** leaves its stinger in the target on a crit and dies 5 s
  later (sacrificial); smoke (Beekeeper pots) makes it drowsy (slowed); fire
  on its wings grounds it; guards fight raider wasps before delvers.

### `honeypot_bearer` — Honeypot Bearer
*A living larder, swollen and patient.*
* hive · large (140 kg, mostly honey) · walk (barely)
* *Belly slam* — slam 2 m, windup 1.2 (rocks back and forth): honey r 2.
* Senses sight 6, hearing 8 · int 0.1 · aggression 0.2.
* **Interactions:** **bursts** on death (or on a big hit to the belly) →
  `honey` r 4, slowing everything nearby — ideal to pin a stinger squad;
  drones feed from it (heal); raider wasps target it first.

### `wax_sealer` — Wax Sealer
*Closes up anything that leaks. Including you.*
* hive · medium (55 kg) · walk
* *Seal* — spell projectile, windup 0.9 (mandibles work, a lump of pale wax
  swells at the mouth): target `slowed` → a second hit within 3 s `frozen`
  (entombed in wax) 2.5 s. *Patch* — repairs broken wax walls (3 s).
* Senses sight 12 / 120°, hearing 14 · int 0.5 · aggression 0.5, courage
  0.4.
* **Interactions:** fire melts a seal instantly (and the wax runs as a
  burning slick); seals holes you blast in wax walls; will seal a raider wasp
  into a wall if it can.

### `larval_cradle` — Larval Cradle
*A wall of cells, each with a sleeping child in it.*
* hive · huge (static) · static
* No attack. Every 20 s while a hive creature is under attack nearby, hatches
  one drone. Breaking it (hp high, wax: flammable) triggers **frenzy**: every
  hive creature on the floor turns aggressive and fast for 30 s.
* **Interactions:** raider wasps home in on cradles; breaking one is loud and
  sad (the lore notes say so).

### `raider_wasp` — Raider Wasp
*Wild, from outside, and here for the larvae.*
* wild · small (12 kg) · fly (fast, erratic)
* *Sting* — lunge 4 m, windup 0.35 (hover-still, then drop): venom.
* Senses sight 20 / 240°, hearing 12 · int 0.4 · aggression 0.8 vs hive,
  0.5 vs delvers · swarms of 4–8.
* **Interactions:** at war with the hive — raid cradles and honeypots; the
  hive fights them first. Lead raiders into a hive room and let them work.
  Burning wings drop them; honey grounds them.

### Warden — `maud_ellery` — Maud, the Queen Who Never Asked
* hive · colossal (2000 kg, wedged in her cell) · static
* No direct attack on delvers. *Weep* — every 15 s honey floods from her
  cell (`honey` r 8), windup 2.0 (her shoulders shake). *Reach* — her
  swollen hands sweep a wall (windup 1.5, the comb creaks), bringing down
  wax comb as falling props on whoever's below.
* **Phases (3 waves):** drones and sealers → stinger guards → a frenzy wave
  with a cradle. After the third wave she points *up*. Then: breaking her
  wax cell (hp high, very flammable) ends the fight — "freed". Killing her
  outright also ends it. Both count as the warden kill.
* **Interactions:** burning the honey floods caramelises them (hard floors
  to fight on); raider wasps will come if the arena's side door is opened.

### Helpers
* `deserter_drone` — hums the right hum: while it follows you, hive
  creatures' notice range is halved. Flees raider wasps.
* `beekeeper` — peddler; sells smoke-pots (thrown: cloud r 4, hive creatures
  `slowed` + non-aggressive 10 s) and Royal Wax salve (disguise 60 s).

### Props · Traps · Surfaces · Hazards
* **Props:** `wax_candle_stand` (wax, melts under fire into a burning slick);
  `honey_jar` (ceramic, breaks → honey r 1.5); `amber_block` (500 kg static
  or 60 kg grabbable chunk; things inside; shatters under heavy force);
  `comb_wall` (wax partition, flammable, sealers patch it); `petition_box`
  (wood, bursts into paper — flammable, drones re-stuff it); `honey_vat`
  (static, spigot → honey r 3).
* **Traps:** `nectar_plate` (plate, minMass 30 → honey flood r 3 from ceiling
  combs); `waggle_alarm` (sight → a dancing drone signals: all hive in 25 m
  alerted); `wax_drop` (tripwire → molten wax rains: fire + slowed);
  `swarm_cell` (proximity → a comb cracks and a raider-wasp swarm or drone
  swarm pours out).
* **Liquids/surfaces:** honey, fire (wax), blood, spores (pollen — reuse
  spores; fire + pollen = explosion).
* **Hazards:** *Heat of the hive* — the hive is warm: honey flows faster (its
  surfaces spread 50% wider), wax props slump over time; *The Pheromone* —
  killing any hive creature marks you for 20 s: every hive creature in 30 m
  knows where you are. Washing (water) removes it; Royal Wax masks it.

---

## 7. Stratum 6 — The Frozen Liturgy (floors 51–60)

Signature systems: **ice** everywhere (sliding, knockback travels far),
**time** (stillness motes, frozen things), **fire wakes things** — heat is
double-edged.

### `frozen_pilgrim` — Frozen Pilgrim
*Stopped mid-kneel. Warmth starts their hour again.*
* frost · medium (70 kg) · static (frozen) → walk
* While frozen: an ice statue, immune, blocks paths. **Thawed** (fire, a
  brazier, a `burning` body within 2 m for 2 s): wakes in 1.5 s (ice cracking,
  a gasp), furious and confused. *Grasp* — grab 1.3 m, windup 0.5, chilled;
  *Prayer-beads* — melee flail 2 m, windup 0.6.
* Senses sight 10 / 120°, hearing 10 · int 0.2 · aggression 0.9, courage 0.
* **Interactions:** **fire wakes rooms** — a fireball in a nave of 20
  pilgrims is a mistake; re-freeze (frost on a thawed pilgrim) puts it back
  to sleep; force on a frozen pilgrim **shatters** it (kill, ice shards
  scatter as small projectiles); rime crows crack them awake.

### `rime_acolyte` — Rime Acolyte
*Swings a censer of cold.*
* frost · medium (50 kg) · walk
* *Censer swing* — melee arc 2.4 m, windup 0.7 (the censer circles once
  overhead, trailing white): frost + chilled. *Incense* — lobbed censer burst,
  windup 1.0: frost cloud r 3, `ice` surface on any water.
* Senses sight 16 / 120°, hearing 14 · int 0.5 · aggression 0.7, courage 0.3.
* **Interactions:** ices water into slides — pushes fights onto ice; a
  burning acolyte's censer bursts (frost + steam cloud, blinding); keeps
  pilgrims frozen (re-freezes any it sees thawing).

### `bell_hauler` — Bell Hauler
*Carried the great bells in procession. Still does.*
* frost · huge (500 kg with bell) · walk (slow)
* *Toll* — nova 8 m, windup 1.8 (swings the bell back on its yoke — you hear
  the yoke creak): force + `stunned` 1.5 s, impulse 20; on ice that impulse
  sends everything sliding. *Bell drop* — slam 2 m, windup 1.2.
* Senses sight 12 / 100°, hearing 20 · int 0.3 · aggression 0.5.
* **Interactions:** tolls wake pilgrims (it's loud, not warm — wakes them
  *chilled*, slower); breaking the yoke (hp 60, back) drops the bell: it rolls
  on slopes, crushing; storm on the bell rings it (involuntary toll).

### `stillness_mote` — Stillness Mote
*A loose piece of the stopped hour, drifting.*
* frost · tiny (hover, massless) · hover
* No attack: aura r 3 → `slowed` (strong) and projectiles in the aura move
  at 25% speed. Drifts toward motion.
* **Interactions:** stalls *everything* — your spells, arrows, falling urns,
  charging penitents; pop it (arcane or void) → a burst that `stunned`
  everything in r 2 for 1 s; creatures avoid motes (they fear stopping).

### `penitent` — Penitent
*Kept the prayer with the whip.*
* frost · medium (60 kg) · walk (fast)
* *Scourge* — cone 3 m / 60°, windup 0.5 (whip drawn back over the shoulder,
  a crack): physical + bleeding. *Self-scourge* — self buff, windup 1.0: loses
  10% hp, gains +40% speed and damage 8 s.
* Senses sight 14 / 120°, hearing 16 · int 0.3 · aggression 1, courage 0.
* **Interactions:** its **blood freezes** — every hit it takes or deals leaves
  `blood` that becomes `ice` in 3 s; it slides on its own ice (and so do you).
  Fire stops the freezing (warm blood stays blood).

### `vigil_icon` — Vigil Icon
*A painted saint on the wall. Its eyes follow.*
* frost · static (wall) · static
* No attack; *sight* 20 / 90°: on seeing a delver for 1.5 s (the eyes widen,
  a choir note), **alerts every frost creature in 30 m** and thaws the nearest
  pilgrims *to* hunt. Destroyable (hp 20); ink/umbral/spores blind it.
* **Interactions:** creatures pause and kneel when passing icons (a window).

### `rime_crow` — Rime Crow
*Came in from the winter. Found the pilgrims' eyes very easy to peck.*
* wild · tiny (1 kg) · fly · flocks of 5–12
* *Peck* — lunge 3 m, windup 0.3 (a hop and a caw).
* **Interactions:** **peck frozen pilgrims**, cracking them: each crow-pecked
  pilgrim wakes in 10–20 s — crows slowly wake the nave; scatter at noise
  (the whole flock lifts — noise 20, which can wake things); eat corpses.

### Warden — `aurel_vane` — Celebrant Aurel Vane, Who Keeps the Hour
* frost · huge (400 kg; frozen robes, arms locked aloft) · hover (glides on
  the ice, never lifts his feet)
* **Phase 1 — The Mass:** *Hour-bell* — every 12 s a bell tolls: `slowed`
  everything in the nave 3 s except him. *Blessing* — frost beam from the
  chalice (windup 1.2, the chalice brightens). *Stillness* — seeds 3
  stillness motes.
* **Phase 2 (50%) — The Hour Ends:** time restarts: every frozen pilgrim in
  the nave wakes at once (the arena becomes a crowd); he moves fast, sliding;
  *chalice slam* on ice sends shockwaves along the floor.
* **Interactions:** fire thaws his arms: at 3 fire hits in 5 s his arms drop
  for 4 s (the chalice lowers — he's staggered and almost grateful); breaking
  the altar candle (it doesn't burn down) ends phase 1 early.

### Helpers
* `late_pilgrim` — arrived late, never frozen; follows, grants `blessed`
  (damage resist), thaws you if frozen, apologises constantly.
* `warming_brazier` — light it (fire) and stand near: clears chilled/frozen,
  heals slowly. **Also thaws nearby pilgrims** — choose your brazier.

### Props · Traps · Surfaces · Hazards
* **Props:** `ice_pew` (frozen pew, 60 kg, slides on ice when shoved — a
  sled that hits for impulse); `frozen_candle` (a flame of glass; breaks
  into shards; cold light); `hanging_censer` (chain; shoot to drop → frost
  cloud r 3); `reliquary_casket` (silver, loot; opening it chimes: noise 20);
  `icicle_cluster` (ceiling; any loud noise or storm drops them: piercing
  damage below); `hymn_board` (wood, the only warm thing — burns).
* **Traps:** `bell_rope` (tripwire → a tower bell tolls: nova slow +
  wakes icons); `ice_slide` (plate, minMass 40 → floor tilts: everything
  slides toward a pit or spikes); `frost_breath` (sight → a carved angel
  breathes a frost cone); `stillwater_font` (proximity → the font releases
  a stillness bubble r 4 for 6 s).
* **Liquids/surfaces:** ice (most floors), water (under thin ice), blood
  (freezes), ash (from the few fires).
* **Hazards:** *Thin ice* — over water, cracks under heavy things (> 150 kg)
  or explosions; drop into freezing water (frozen in 3 s unless you climb
  out); *The Held Note* — the organ note stops every few minutes for 5 s:
  everything frozen shivers — pilgrims thaw 50% faster until it resumes.

---

## 8. Stratum 7 — The Red Garden (floors 61–70)

Signature systems: **acid** and **blood** surfaces, **grafting** (the Garden
heals itself with corpses), **parasites** that jump hosts, walls that grow
back.

### `graft_gardener` — Graft Gardener
*Offer, still tending. Grafts onto anything, including the dead, including
you.*
* flesh · medium (65 kg, four arms, shears and needles) · walk
* *Prune* — melee 2 m, windup 0.6 (shears open with a slow *snik*): bleeding.
  *Graft* — grab 1.5 m, windup 1.0: stitches a piece of a corpse onto the
  target — on creatures heals 40%; on a delver, `slowed` 3 s (a heavy limb
  you have to tear off).
* Senses sight 14 / 120°, hearing 14 · int 0.6 · aggression 0.5, courage 0.3.
* **Interactions:** **heals the Garden with corpses** — walks to any corpse
  and grafts it onto the nearest flesh creature (heal) or plants it (a new
  `mouthvine` 30 s later). Kill gardeners first or the fight never ends;
  fire on its tray of stitched parts ruins its next graft.

### `blood_tick` — Blood Tick
*Came in from outside and never left. Feeds on anything warm.*
* parasite · tiny (3 kg) · walk, jumps
* *Latch* — lunge 4 m, windup 0.3 (it flattens and quivers): attaches;
  drains (bleeding) until knocked off (force, fire, `wet`), swells as it
  feeds.
* Senses heat-sense 10 m (sees warm bodies through walls) · int 0.1 ·
  aggression 1.
* **Interactions:** **jumps host to host** — latches on anything warm: flesh
  brutes, gardeners, delvers, grazers; a tick-bloated brute is slower; a
  swollen tick **bursts** into `blood` r 1 when hit; frozen bodies are
  invisible to it; ticks flee fire.

### `sutured_brute` — Sutured Brute
*An early draft of the Vessel. Big, stitched, unfinished.*
* flesh · huge (450 kg) · walk
* *Haymaker* — melee 2.5 m, windup 1.0 (winds up with the wrong arm, the
  stitches creak): impulse 28. *Tear* — grab 2 m, windup 0.8: pulls a
  piece off a nearby prop/creature and throws it.
* Senses sight 12 / 100°, hearing 12 · int 0.2 · aggression 0.8, courage 0.
* **Interactions:** **seams split** — fire or venom on the seams (crits) makes
  it shed a limb (a crawling hand creature, tiny, 8 s) and lose 15% hp; heavy
  enough for every plate; gardeners keep re-grafting it; ticks love it.

### `acid_gut` — Acid Gut
*The Garden's digestion, walking.*
* flesh · large (120 kg) · walk (a sloshing crawl)
* *Spew* — cone 5 m / 40°, windup 0.9 (bloats, gurgles): `acid` surface +
  venom. Leaves an acid trail.
* Senses smell 18, sight 6 · int 0.1 · aggression 0.6.
* **Interactions:** **dissolves** — acid eats props (wood/bone/flesh hp
  drain) and weak floors; bursts on death (acid r 3); eats corpses (removing
  gardener material); water dilutes acid to nothing.

### `mouthvine` — Mouthvine
*A bed plant with teeth.*
* flesh · large (static, reaches 3 m) · static
* *Snap* — proximity 3 m, windup 0.5 (petals peel back): grab + pull.
* **Interactions:** eats anything that passes — including ticks and small
  flesh; gardeners plant new ones from corpses; fire burns it back (regrows
  in 60 s unless burned to ash); a force spell into its mouth = it chokes
  (stunned 3 s).

### `heartseed_bloom` — Heartseed Bloom
*A red flower that beats.*
* flesh · medium (static) · static
* No attack; **pulses** every 5 s: heals flesh creatures in r 6. Hit with
  fire → it **bursts** (blood + ichor spray r 3, heals *everything* in radius
  once — including you). Drops Heartseed.
* **Interactions:** the Garden fights around blooms; burn them before the
  fight, or use their burst yourself.

### Warden — `the_vessel` — The Vessel, worn by Tamsin Rook
* flesh · colossal (1800 kg, 6 m, beautiful and blank) · walk
* **Phase 1 — The Body:** *lash* (arm sweep 6 m, windup 1.2), *stride* (steps
  crush, heavy), *offering* (it holds out a hand; anything that stands in it
  for 2 s is healed — including you — and then gripped). Gardeners graft
  corpses onto it throughout.
* **Phase 2 (50%) — The Wearer:** Tamsin climbs half out of its chest,
  directing it with her arms; the Vessel mimics her gestures with a lag
  (her motion is the telegraph — watch *her*, not it). Acid weeps from the
  seams.
* **Interactions:** ticks drain it too; heartseed blooms in the arena heal it
  (burn them); killing all gardeners stops its grafting.

### Helpers
* `old_pruner` — cuts a path to the Descent through flesh walls and
  mouthvines, slowly; stop to wait and he mutters about the beds.
* `leech_doctor` — peddler; full heal for blood (−15% max hp this floor) or
  ichor salves for gold; will pull ticks off you for free.

### Props · Traps · Surfaces · Hazards
* **Props:** `organ_fruit` (hanging, bursts → blood or ichor); `bone_trellis`
  (breakable fence, bone); `seed_tray` (loot; flammable); `flesh_wall`
  (regrowing partition — burn, it closes in 30 s); `wheelbarrow` (pushable,
  90 kg with teeth); `acid_cistern` (static, spigot → acid r 3).
* **Traps:** `ripening_pod` (proximity → bursts, acid spray); `vine_snare`
  (plate, minMass 30 → `webbed` + pulls toward a mouthvine); `pulse_vein`
  (timer → blood jets that knock back); `graft_bed` (sight → stitching arms
  drop from the ceiling: grab + bleeding).
* **Liquids/surfaces:** blood, acid, ichor (treat as `blood` that heals flesh
  creatures standing in it), slime, water (rare, precious).
* **Hazards:** *Regrowth* — paths you burn or cut close again over 30–60 s;
  the floor's layout slowly shrinks around you; *The Heartbeat* — every 20 s
  the whole floor pulses: all flesh creatures heal 5% and all acid pools
  surge outward 1 m.

---

## 9. Stratum 8 — The Orrery (floors 71–80)

Signature systems: **moving architecture** (rotating rooms, gear bridges,
pendulums on timers), **oil** and **storm** (everything conducts), machines
that repair each other, a war with the dark (`orrery` vs `unlit`).

### `clockwork_angel` — Clockwork Angel
*Tends the machine. Relights the stars.*
* orrery · medium (70 kg, brass wings) · fly
* *Lance* — beam 14 m, windup 1.0 (wings spread wide, a rising chime): storm
  + shocked; chains through wet/oiled bodies. *Dive* — lunge 8 m, windup 0.7.
* Senses sight 24 / 160°, hearing 14 · int 0.7 · aggression 0.7, courage 0.4.
* **Interactions:** **relights lights** (any darkened lamp or star-lamp,
  like candle wights); hunts `unlit` creatures on sight; oiled wings
  (Oiler, oil flasks) + fire = it falls burning; a wound-down angel (hit by
  a governor, or with a broken mainspring) kneels inert.

### `governor` — Governor
*Nothing may go too fast.*
* orrery · huge (380 kg, a spinning ball-regulator on legs) · walk
* *Brake field* — aura r 6: anything moving faster than walking speed is
  `slowed` (dashes, knockback, projectiles all damped). *Flyball* — slam
  2.5 m, windup 0.9 (the balls fly outward as it spins up).
* Senses sight 12, hearing 16 · int 0.4 · aggression 0.5.
* **Interactions:** damps **everyone's** momentum — its own allies' dives,
  your blink, explosions' impulse; use it to stop a boulder or a rolling
  bell; storm overspeeds it (it spins up and flings its balls wildly for 3 s).

### `escapement_crab` — Escapement Crab
*Repairs. Constantly.*
* orrery · tiny (4 kg) · walk, climbs · packs of 3–6
* *Pinch* — melee 0.8 m, windup 0.3.
* **Interactions:** **repairs** damaged orrery creatures (heal 5%/s while
  clinging) and broken gear bridges/doors (restores your shortcuts' blockers
  too); rust moths terrify them; oil makes them faster; storm pops them in
  chains.

### `mainspring_hound` — Mainspring Hound
*Chases loose parts. You're a loose part.*
* orrery · medium (55 kg) · walk (very fast bursts)
* *Unwind* — lunge 12 m at 18 m/s, windup 0.8 (it crouches and you hear it
  *wind* — a ratchet, click-click-click): heavy impulse 24. Must rewind 3 s
  after each lunge (vulnerable).
* Senses sight 18 / 120°, hearing 22 · int 0.3 · aggression 1.
* **Interactions:** its lunge can't stop: it overshoots into pendulums, gear
  teeth, pits; a governor's field ruins its lunge; hit its key (back) to
  break the spring → it spins out (wild impulse r 2, hits allies).

### `astrolabe_eye` — Astrolabe Eye
*Watches the sky for Turn.*
* orrery · static turret (wall/ceiling) · static
* *Sighting* — sight 30 / 60°: after 1.2 s lock (a ring of lenses aligns
  with a click) fires a storm bolt; prefers `unlit` targets over delvers.
* **Interactions:** can be **turned** — a force hit rotates it 90°, pointing
  it at something else; ink/umbral/steam blinds it.

### `rust_moth` — Rust Moth
*Eats oil. The only thing in the Orrery not on schedule.*
* wild · tiny (0.5 kg) · fly · clouds of 10–30
* No attack on delvers (mild annoyance: they eat oiled status off you).
* **Interactions:** **rusts machines** — a cloud on an orrery creature slows
  it 30% and drains armour; eat `oil` surfaces (cleaning them up); drawn to
  light; fire kills clouds instantly (small fire burst); escapement crabs flee
  them.

### Warden — `ione_castellan` — Horologer Ione Castellan, the Brake
* orrery · huge (medium woman, 60 kg, in a harness riveted to a great brake
  lever; the harness+lever 600 kg) · static (phase 1) → walk (phase 2)
* **Phase 1 — Holding:** she can't leave the brake. The arena turns slowly;
  pendulums sweep on a fixed rhythm; she throws *gear-discs* (ricochet
  projectiles, windup 0.7, she shifts her grip — the one moment she's off
  balance) and *ticks* (timed bombs that stick, 1.5 s).
* **Phase 2 (50%) — Letting Go:** she releases the brake. The arena
  **accelerates** — rotation doubles, pendulums speed up, floors drift. She
  fights with both hands: storm arcs, a governor-like brake field she can
  place and remove.
* **Interactions:** clockwork angels relight the arena lamps; knock her back
  onto the brake (force into the lever) → the arena slows for 6 s.

### Helpers · Props · Traps · Surfaces · Hazards
* **Helpers:** `oiler` (oils stalled lifts and gear-bridges, making
  shortcuts; leaves oil everywhere); `unwound_angel` (interact 3 s to wind;
  fights for you 60 s, then kneels again).
* **Props:** `gear_stack` (metal, rolls when knocked flat, crushing);
  `oil_can` (breaks → oil r 1); `tesla_coil` (static; storm → charges and arcs
  to anything metal within 5 m every 2 s for 10 s); `star_lamp` (a light;
  angels relight it; unlit snuff it); `counterweight` (hanging, 300 kg; cut
  its chain → drops, crushes, and whatever it balanced *rises*); `chalkboard`
  (lore; flammable).
* **Traps:** `pendulum_blade` (timer; huge impulse; knocks bodies off
  bridges); `gear_teeth` (plate, minMass 40 → a floor section becomes meshing
  gears for 3 s: crush); `escapement_gate` (timer → doors open/close on a
  rhythm; being in the door = crush); `spark_gap` (proximity → storm arc
  between two posts, chains through oil and water).
* **Liquids/surfaces:** oil (everywhere), water (coolant), ink (chalk slurry
  — reuse ink), fire.
* **Hazards:** *The Turning* — rooms rotate 90° every 60–120 s (a chime
  warns 5 s before): loose props and bodies slide; bridges realign;
  *Overcharge* — storm damage builds charge in metal floors: after enough
  storm spells in a room, the whole floor arcs once (hits everything on
  metal, including you).

---

## 10. Stratum 9 — The Unlit (floors 81–90)

Signature systems: **light is bait**, **mirrors** (reflections act; light
bounces), **sound** (echo mimics lie), and a blind god-sized searcher.

### `reflection` — Reflection
*Turn, living inside its mirrors where the dark is best.*
* unlit · medium (as heavy as the thing it reflects) · walk (steps *out* of
  mirrors)
* Steps out of a mirror when a light-bearer is reflected in it, as a **dark
  copy of whoever is reflected** — a delver's reflection uses that delver's
  primary spell (weaker); a creature's reflection copies its attacks.
* Senses: only sees what its mirror saw · int 0.5 · aggression 0.9.
* **Interactions:** **light makes them** — no light, no reflections; breaking
  the mirror (glass, hp 5) kills its reflection; reflections of the Seeker
  exist and they're awful; reflections can't cross unlit ground (they fade
  in total dark after 5 s).

### `snuffer` — Snuffer
*Puts lights out. Gently. Permanently.*
* unlit · medium (40 kg, long fingers) · walk (silent)
* *Pinch* — melee 1.2 m, windup 0.5 (fingers wet at the tips, reaching):
  snuffs your light for 6 s (light radius 0) + void damage. Seeks any
  light source and puts it out: lamps, candles, star-lamps, *burning
  creatures* (it pinches the fire off them).
* Senses sight 20 in dark / 2 in light (it's dazzled), hearing 14 · int 0.5
  · aggression 0.7 (1.0 vs lights).
* **Interactions:** flash (storm, fire burst) **dazzles** it (feared 3 s);
  wars with clockwork angels (relight/snuff loops); pinches out burning
  delvers (it *helps* you if you're on fire — and then keeps pinching).

### `hider` — Hider
*Waits. Very quietly. Counting.*
* unlit · medium (50 kg) · walk (fast, low)
* *Found you* — lunge 3 m, windup 0.25 from hiding (a sharp intake of breath
  — the only warning). *Scratch* — melee, windup 0.4.
* Senses sight 12 dark, hearing 18 · int 0.6 · ambush; courage 0.8 (flees
  into the dark when lit).
* **Interactions:** **light hurts** (lit = `slowed` + takes +50% damage),
  so it waits at the edge of your light; the Seeker hunts hiders — they
  freeze when it's near.

### `echo_mimic` — Echo Mimic
*Answers back.*
* unlit · small (20 kg) · walk, climbs walls
* No real attack (a bite, windup 0.4). It **mimics sounds**: your footsteps,
  your spell cast, a delver heartbeat (the presence cue!), a chest opening, a
  child counting.
* **Interactions:** lures delvers and creatures (noise events at its
  position); the Seeker goes to the sounds it makes (so a mimic near you is
  lethal); kill it and the false sounds stop.

### `lightmoth` — Lightmoth
*The only thing in the Unlit that wants light.*
* wild · tiny · fly · clouds of 20–40
* No attack; **swarms the brightest light** in 30 m — your lantern — and
  dims it 50% while on you; their wings glitter (you're visible to
  everything at 2× range).
* **Interactions:** the moth cloud is a lantern for the Seeker; fire kills
  the cloud (a bright flash — dazzles snuffers, draws the Seeker); a lantern
  set down draws them off you.

### `the_seeker` — The Seeker
*It is looking. It has been looking the whole time.*
* dream · colossal (2500 kg, a vast pale shape, all hands, no face) · walk
  (slow, silent, never stops)
* *Take* — grab 4 m, windup 1.5 (it goes still; every hand turns toward
  you): enormous damage — near-certain death. It does not chase fast; it is
  *inevitable*.
* Senses: **light** at 40 m through line of sight; **hiding** — anything
  `invisible` or standing in total dark still for > 5 s at 15 m; hearing 30.
  Blind otherwise.
* **Interactions:** **hunts everything that hides or shines** — hiders,
  reflections, snuffers, you; walk in the *half-light* (small light, moving)
  to be ignored; can't enter the Counter's circle; one per floor, wandering
  the long halls; drives the floor's rhythm. Not killable on normal floors
  (it retreats at 50% hp).

### Warden — `olly_ferrow` — Olly Ferrow, Who Hid Best
* unlit · small (25 kg, a child) · walk (never seen moving)
* **Phase 1 — Hide:** she's `invisible` except in mirrors and in reflected
  light; she moves only when you look away; she *throws your own light back*
  (a reflected beam of whatever element you cast last). Mirrors ring the
  arena; each one broken removes a place she can be seen in (and a place she
  can hide).
* **Phase 2 (50%) — Seek:** the arena's lights go out and **she** counts; you
  must hide (stay dark, still) while her reflections search; each time she
  "finds" you she hits hard and resets. Staying unseen for 10 s staggers her
  (she's confused) — hit her then.
* **Interactions:** the Seeker circles outside the arena throughout; when she
  falls, it stops.

### Helpers · Props · Traps · Surfaces · Hazards
* **Helpers:** `the_counter` (a ghost counting; within r 6 you are *home* —
  the Seeker and reflections won't take you); `blind_guide` (follows your
  footsteps; walk dark behind it and it leads to the Descent).
* **Props:** `mirror` (glass, hp 5 — spawns reflections when light-bearers are
  in it; breaks into `glass` shards (reuse ash) that crunch — noise);
  `turned_mirror` (faces the wall; turning it back is an interact — lore
  sometimes on its back); `snuffed_candle` (can be relit; lights make
  targets); `wardrobe` (hide inside: invisible, but hiders use them too);
  `black_curtain` (cloth, flammable — burning it floods a room with light).
* **Traps:** `mirror_flash` (sight → a mirror array focuses your own light
  back: `stunned` 1 s and a *beacon* that draws the Seeker); `counting_plate`
  (plate, minMass 20 → a voice begins counting to 10; at 10, all hiders in
  the room lunge); `snuff_draught` (proximity → a gust puts out every light in
  r 8); `echo_bell` (tripwire → a bell whose echo keeps ringing from moving
  places — confuses sound for 20 s).
* **Liquids/surfaces:** ink (black water), water, ash, blood.
* **Hazards:** *Total dark* — ambient light is zero; your light radius is
  the game; *The Search* — every few minutes the Seeker's hands sweep a whole
  hall (a slow wave, telegraphed by a cold draft and all mirrors fogging).

---

## 11. Stratum 10 — The Threshold (floors 91–100)

Signature systems: **memory** — the stratum can use any stratum's
creatures, props and surfaces as "remembered" variants; things move **when
unseen**; the village layout, remembered wrong.

### `remembered_villager` — Remembered Villager
*Kneel's people, assembled from each other's parts.*
* dream · medium (70 kg) · walk
* Mostly stand at the rim staring (aggression 0). When a delver breaks a
  custom — watching someone descend, asking a question at the Stump, burying
  something — they all turn. Then: *grasp* (grab, windup 0.8, they say a
  line from an NPC bark) and *shove* (impulse 20, toward the pit).
* **Interactions:** they turn their backs when you go down the stair (the
  send-off); fire doesn't burn them (they're memories) but light makes them
  look at you.

### `kneeler` — Kneeler
*Kneels wherever you're not looking.*
* dream · medium (80 kg, stone) · walk (only when unseen)
* Moves only when no delver's view cone contains it; freezes when seen.
  *Touch* — melee, instant when adjacent and unseen: heavy void damage.
* **Interactions:** co-op delvers can watch for each other; mirrors count as
  looking; darkness (no light) makes them fast.

### `unfinished` — The Unfinished
*A creature the dream hasn't decided on yet.*
* dream · size varies (rolls 1–3 creatures from strata 1–9 and combines:
  body of one, attacks of another, weakness of the third) · movement of the
  body creature.
* **Interactions:** inherits interactions of its parts — a candle-wight-
  headed slag crawler relights lamps *and* leaves fire trails; designers
  should keep the combo table readable (show the parts visibly stitched).

### `godhand` — Godhand
*A stone hand rising from the ground.*
* dream · huge (static, emerges) · burrow
* *Close* — grab r 2.5 from below, windup 1.2 (the ground cracks in a
  five-pointed pattern first): holds 3 s, crushing. Moves between floor spots.
* **Interactions:** grabs *anything* — creatures, props; can be baited with a
  heavy prop; force the fingers open (impulse ≥ 30) to free a victim.

### `wrong_candle` — Wrong Candle
*A candle from the endless shelves, walking.*
* dream · small (10 kg) · walk (hops)
* *Drip* — lobbed wax (fire + slowed, windup 0.5). Names scratched on them:
  real delver names from the Memorial Wall.
* **Interactions:** snuffing one (water/frost) makes it stop and lie down; it
  relights any lights it passes (like a wight); in groups they "vigil" around
  corpses and heal them.

### `dream_delver` — Dream Delver
*A delver the dream remembers. It wears a real fallen player's name.*
* dream · medium (75 kg) · walk
* A player-like foe with a focus and relic built from a random loadout at the
  floor's gear level; uses the Open Palm sign (it offers pacts — it can
  keep them for the floor, it breaks them 30% of the time). Named from the
  Memorial Wall (real fallen players).
* **Interactions:** fights other dream creatures if pacted with you; drops a
  pocket stone.

### Warden (floor 100) — `anneth_of_stand` — Anneth of Stand, the First Asker
* dream · medium body (60 kg) that fights like a colossus · walk
* **Phase 1 — The Watcher:** fights with remembered tricks, one per stratum,
  cycling in order (candle flick → ink blot → spore breath → hammer slam →
  honey weep → hour-bell → acid spew → gear-disc → lights out), each with
  its original telegraph (learned already).
* **Phase 2 (50%) — The Asker:** she speaks questions (each a projectile
  that lingers in the air as text; touching it = `feared` 1 s); kneels to
  pray and stands to strike; the remembered villagers at the rim turn to
  watch. She never flees.
* **After:** the stair down to the Head opens. See LORE.md §5.

### Helpers · Props · Traps · Surfaces · Hazards
* **Helpers:** `your_candle` (carry it: heals while lit; the flame leans
  toward the Descent; dying with it moves your Reliquary one floor up);
  `the_witness` (stand beside it 10 s: it points to the way down).
* **Props:** any remembered prop from strata 1–9, desaturated;
  `pocket_stone` (grabbable; lore; "warm from someone's pocket"); `stash_echo`
  (a chest with your own items, wrong colours — opening it is a trap roll or
  a real loot roll, 50/50); `founders_statue` (it's you).
* **Traps:** remembered traps (any), plus `fog_door` (proximity → a
  doorway full of fog: step in and you exit at a random doorway on the
  floor); `question_plate` (plate → a line of text appears — a question —
  and every remembered villager looks at you until you move).
* **Liquids/surfaces:** any; `ash` and `water` most.
* **Hazards:** *Rewriting* — every few minutes a district of the village is
  "remembered differently": walls and props swap (telegraphed by fog pouring
  in); *The Breath* — the Head's breathing pushes and pulls every loose body
  gently toward/away from the pit (stronger near floor 100).

---

## 12. Everywhere — cross-stratum helpers

* `lost_lantern` — a lantern bobbing at head height with nobody holding it.
  Follow it: it leads to a treasure chest or a Reliquary, and goes out when
  you arrive. Snuffers and keeners hunt it.
* `bound_dreamer` — the ghost of a delver (named from the Memorial Wall),
  chained to a pillar. Break the chains (3 hits) and it fights with you for
  the floor with a delver's spells. It says one line on release (see
  `FREED_DREAMER_LINES` in `lore/village.ts`).
* `mercy_candle` — see Undercroft; appears in every stratum in a local form
  (a lumen cap, an ember in a dish, a jar of warm honey, a frozen flame that
  thaws when you touch it…).
* `wandering_peddler` — a merchant of no stratum, cart and all. Sells
  consumables at 150% and buys run loot at 50%. Nobody attacks the peddler;
  creatures walk round the cart.
* `shrine` — a boon at a price: *the Kneeling Stone* (heal full, lose 10%
  max mana for the floor), *the Open Hand* (drop your gold, gain luck),
  *the Question* (answer a riddle by action — e.g. "put out the light" — for
  a random blessing).
