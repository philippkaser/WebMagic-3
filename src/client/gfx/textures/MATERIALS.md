# Material & sprite catalogue

Every surface in the game is a **material id** painted in code at startup
(`painters/*.ts`, registered on import via `import "./painters"`). Reference a
material by id — `layerOf("crypt.brick")`, `MeshBuilder` `mat: "crypt.brick"`,
biome palettes in `shared/content/biomes`. Ids below are stable; new ones may be
added, none will be renamed. Unknown ids render as the magenta `missing` checker.

## Conventions (read once)

- **64×64 texels, nearest-sampled.** `worldSize` = metres covered by one repeat
  (default 2 m; noted below when different). Pass `uvm` to MeshBuilder to
  override per primitive (e.g. a 1 m crate face showing half a plank wall).
- **Orientation.** Painters author with texel row 0 at the *top*; gravity
  details (moss at the bottom, drips and rain streaks running down, icicles,
  tide lines) assume that. `buildMaterialArrays` flips rows on upload so row 0
  lands at v = 1: with box UVs (`v = worldY / worldSize`) a wall shows the
  texture upright, and the normal map's green channel matches. Materials with a
  deliberate vertical gradient (`archive.flooded_stone`) are authored for one
  repeat per wall height with the floor at v = 0.
- **Trims** (`*.trim`, `foundry.trim_brass`, `hive.gilded_trim`) are a full
  moulding profile from top (row 0) to bottom (row 63) that repeats
  horizontally. Map v 0..1 across the trim's own height (uvm = trim height,
  u at the same scale or ~2× it); at the default 2 m worldSize a 30 cm
  baseboard would only show the bottom ~10 rows.
- **Everything tiles** in both directions except the single-object textures
  `eye.glow`, `coin.gold`, `village.window_lit`, `village.door`, `flame`
  (meant for one quad / one face) — they still wrap, but look repeated.
- **Channels.** albedo (sRGB) · height → normal + cavity AO · roughness ·
  metalness · emissive mask. Emitted colour = albedo × mask × `glow`
  (per-material multiplier, default 2). Roughness ≲ 0.15 means SSR mirror
  (wet stone, polish, ice, liquids, mirror). Metal = 1 texels use albedo as
  specular colour, so metal ramps are painted brighter than they "look".
- **Tint.** `aTint` multiplies albedo. Neutral/pale materials tint well:
  `cloth.linen`, `cloth.wool`, `cloth.burlap`, `wax`, `paper`, `stone.smooth`,
  `stone.marble`, `bone`, `village.plaster`, `web`, `ice` (e.g. dyed robes =
  `cloth.wool` + tint).
- **Cutout** materials alpha-test at 0.5 (`web`, `grate`, `metal.chain`,
  `flame`, `foundry.grate`, `village.fence`, `surface.web`).

Legend for the notes column: **r** roughness range · **m** metalness ·
**e** emissive (share of texels, glow multiplier).

## Generic — props, creatures, items (`painters/common.ts`)

| id | description | channels | intended use |
| --- | --- | --- | --- |
| `wood.plank` | Mid-brown boards (6 per repeat), long grain lines, knots, butt joints, nail lines at studs | r 0.75–0.85, nails m1 | crates, floors, shelving, generic wooden props |
| `wood.dark` | Dark stained oak boards, tight grain, fairly smooth | r ~0.55 | furniture, lecterns, coffins, doors |
| `wood.old` | Silver-grey weathered boards: eroded grain, splits, rust bleed from nails, lichen in gaps | r ~0.9 | ruined furniture, scaffolds, old fences, wreckage |
| `wood.barrel` | Vertical staves with two riveted iron hoops (at 6 and 38 px) | hoops m1 r0.45 | barrels, kegs, buckets, tubs |
| `wood.beam` | One massive hewn timber: coarse grain, adze scallops, long drying checks, spike heads | r ~0.82 | ceiling beams, posts, supports, gallows |
| `metal.iron` | Riveted iron plates, hammer dents, bright worn edges | m1, r 0.3–0.6 | armour, doors, strongboxes, automata |
| `metal.rust` | Iron plate eaten by rust from seams/rivets, weeping streaks | rust m0 r0.9 / iron m0.8 | old machinery, cages, sunken gear |
| `metal.bronze` | Polished cast bronze sheen, verdigris crusting hollows and streaking | m1 r~0.3 / patina m0 r0.85 | bells, statues, braziers, fittings |
| `metal.gold` | Burnished gold: diagonal reflection bands, faint hammer facets, scratches | m1, r ~0.26 | idols, crowns, reliquaries, gilding |
| `metal.brass` | Brushed brass plates with rivets and tarnish blooms | m1, r 0.15–0.5 | lanterns, instruments, clockwork |
| `metal.chain` | Four hanging chains, alternating face-on/edge-on links (cutout, ws 1) | m1 r0.45 | hanging chains, chain curtains (use `uv:"native"`) |
| `stone.rough` | Quarry-faced stone: tilted chisel facets, pits, cracks | r ~0.9 | rubble, altars, pedestals, boulders |
| `stone.smooth` | Dressed grey stone, fine granular speckle, a hairline crack | r ~0.62 | columns, statues, sarcophagi, steps |
| `stone.marble` | White polished marble, continuous diagonal grey veins | r 0.14–0.26 (SSR) | fonts, statues, fine floors |
| `stone.cobble` | Mixed grey/warm/blue rounded cobbles, soil joints | r ~0.72 | paths, rubble floors |
| `bone` | Ivory long-bone surface: striations, pores, hairline cracks, brown staining | r ~0.58 | skeletons, bone props, handles |
| `cloth.linen` | Fine plain weave, off-white, soft folds and old stains | r 0.92 | bandages, shrouds, sails, tintable robes |
| `cloth.wool` | Grey 2/2 twill with fuzz | r 1 | robes, cloaks, hoods (tint it) |
| `cloth.velvet` | Deep crimson pile with drape folds | r 0.95 | curtains, cushions, noble garb |
| `cloth.burlap` | Coarse open weave with dark holes | r 1 | sacks, bales, cheap tapestries |
| `leather` | Pebbled brown hide, creases, rubbed shiny spots | r 0.45–0.62 | belts, books' covers, straps, saddlebags |
| `ceramic.clay` | Terracotta with throwing rings, grog specks | r ~0.85 | urns, pots, tiles, funerary jars |
| `ceramic.glazed` | Deep teal glaze pooling in runs, fine crackle | r 0.10–0.16 (SSR) | vases, bottles, glazed tiles |
| `wax` | Tallow with rounded drip runs beading at the ends | r ~0.42 | candles, seals, wax sculpture |
| `glass` | Green bottle glass: streaks, bubbles, glints | r 0.05 | bottles, vials, lantern panes |
| `crystal` | Faceted violet arcane crystal, glowing facet edges and core | r0.08, e 32% glow 3 | focus crystals, arcane growths, orbs |
| `gem` | Ruby facets with sparkle, faint inner glow | r0.08, e 24% glow 2 | jewels, rings, amulets, loot |
| `flesh` | Raw wet meat: fibre bundles, fat marbling, dark veins | r 0.28–0.48 | ghouls' wounds, butcher props, gore |
| `flesh.pale` | Grave-pale grey-green skin, lividity, blue veins | r ~0.66 | undead, drowned, corpses |
| `chitin` | Overlapping dark carapace plates with violet/green sheen | r ~0.22 | insects, crawlers, hive drones |
| `fur` | Dense brown strands, clumped, lighter tips | r 0.95 | rats, beasts, pelts, trims |
| `feathers` | Overlapping blue-black feathers with rachis and barbs | r 0.6 | birds, harpies, quills, hood trims |
| `scales` | Green reptile scales with lit rims | r 0.32–0.48 | lizards, serpents, drakes |
| `slime` | Glossy green slime with bubbles | r 0.08 | oozes, slime props |
| `fungus.cap` | Violet mushroom cap with glowing teal warts | e 6% glow 3 | mushrooms, fungal creatures |
| `fungus.stem` | Pale fibrous stem | r ~0.72 | mushroom stalks, fungal trunks |
| `moss` | Deep cushion moss with speckled tips | r 1 | moss clumps, overgrowth |
| `paper` | Parchment with faded handwriting, foxing | r 0.85 | scrolls, notes, maps, book pages |
| `book.spines` | Two shelf rows of varied spines with gilt bands | gilt m1 r0.35 | book stacks, bookshelves (props) |
| `honeycomb` | Hex wax cells: empty, capped or full of glossy honey | honey r0.08 | hives, honey props |
| `amber` | Translucent-looking amber, flow bands, trapped gnats, inner glow | r0.08, e low glow 1.5 | amber resources, idols, lamps |
| `ice` | Clear blue ice, white fractures, bubble strings | r 0.06 (SSR) | ice walls/props, frozen things |
| `lava` | Dark crust plates on glowing melt | e 30% **glow 4** | lava channels, magma props |
| `rune.glow` | Dark stone blocks carved with glowing cyan runes | e 29% glow 3 | runestones, wards, portals, shrine bases |
| `flame` | Rising flame tongues, white-hot roots, cut out above (ws 1) | e 1 **glow 4**, cutout | fire cards, braziers (particles are better for motion) |
| `eye.glow` | One great eye: burning striated iris, slit pupil (ws 0.5) | iris e1 glow 3 | creature eyes, watchers, door eyes |
| `skin.wizard` | Weathered warm skin, pores, knuckle creases, veins | r ~0.55 | the player's hands, NPC skin |
| `coin.gold` | Coin face: rim, bead ring, the Godwell emblem (ws 0.1) | m1 r0.22–0.36 | coins, medals, tokens |
| `rope` | Three-strand hemp lay along u | r 0.95 | ropes, rigging, bindings |
| `web` | Torn web net with dusty clumps (cutout, ws 1.5) | r 0.6 | cobwebs in corners, web sheets |
| `grate` | Iron bars with rivets at crossings (cutout, ws 1) | m1 / rust | cages, windows, drains |
| `dirt` | Packed earth, scattered pebbles, root threads | r 0.95 | earth floors, graves, planters |
| `grass` | Dense blades over dark soil, a few flowers | r 0.95 | turf patches, overgrowth |
| `mud` | Wet mud, boot prints, standing puddles | r 0.08–0.7 | swamp floors, mud patches |
| `gravel` | Small mixed stones | r 0.85 | gravel floors, rubble heaps |

## Stratum 1 — the Undercroft (`undercroft.ts`)

| id | description | channels | intended use |
| --- | --- | --- | --- |
| `crypt.brick` | Tuff/limestone running-bond brick, chipped corners, recessed mortar with nitre bloom, soot patches, cellar moss in joints, damp gloss | r 0.45–0.96 | default crypt wall |
| `crypt.slab` | Irregular worn flagstones, one carved tomb slab with rune line, cracks, water pooled in low joints | puddles r 0.1 (SSR) | default crypt floor |
| `crypt.ceiling` | Small rough stones blackened by candle soot, calcite straws | r ~0.9 | vault / ceiling |
| `crypt.trim` | Carved band: fillets, frieze of small skulls, bead moulding, dressed course | r 0.82 | baseboards, cornices, arches, door frames |
| `crypt.ossuary` | **Signature.** Courses of stacked skulls, femurs laid lengthwise, packed femur heads, dust and staining | r 0.7–0.95, AO 1.4 | ossuary walls, bone niches, altar fronts |
| `crypt.dirt_floor` | Packed grave earth, bone chips, boot prints | r 0.7–0.95 | earthen crypt floors, graves |
| `crypt.plaster_old` | Flaking lime plaster over brick, fresco ghosts (border band, gilt halo, robe folds), tide-lines, mould | r 0.8–0.96 | chapels, painted crypt walls |

## Stratum 2 — the Drowned Archive (`archive.ts`)

| id | description | channels | intended use |
| --- | --- | --- | --- |
| `archive.wood_panel` | Raised-and-fielded wainscot panels (2×2), dark polished, flood blotches | r 0.25–0.42 | walls, desks, cabinets |
| `archive.parquet` | Herringbone/chevron parquet, waxed, water-lifted patches | r 0.34–0.55 | floors |
| `archive.tile` | Worn marble checker (pale veined / green-black serpentine), chipped corners | r 0.12–0.45 (SSR) | reading rooms, halls |
| `archive.shelves` | Bookcase wall: two shelves of varied spines between uprights, flood-damaged lower row | gilt m1 | bookshelf walls |
| `archive.plaster_mold` | Damp ceiling plaster, tide rings, black mould colonies, cracks | r 0.5–0.94 | ceilings, damp walls |
| `archive.trim` | Carved dark-wood moulding: cove, dentils, bead, rope twist, inlaid brass line | brass m1 | cornices, shelf edges, balconies |
| `archive.flooded_stone` | Big blocks at the waterline: dry above, salt crust + algae band, slick and slimed below | wet r 0.08–0.3 | flooded walls (one repeat per wall height) |

## Stratum 3 — the Mycelial Choir (`choir.ts`)

| id | description | channels | intended use |
| --- | --- | --- | --- |
| `cave.rock` | Natural rock: warped strata, fracture lines, pits, glossy seep streaks | r 0.3–0.93 | cave walls, boulders |
| `cave.mycelium_floor` | Dark humus webbed with pale mycelium, tiny caps, some glowing | e low glow 2.5 | cave floors |
| `cave.fungal_wall` | Rock with thread crusts, glowing spots and tan shelf fungi with luminous gills | e 4% glow 2.5 | fungal walls, "choir" chambers |
| `cave.root` | Tangle of barked roots with cast shadows over earth | r 0.85–0.95 | root walls, ceilings, pillars |
| `cave.ceiling_spore` | Dark rock hung with spore pods (glowing tips), sticky strands | e low glow 2.5 | cave ceilings |

## Stratum 4 — the Cinder Foundry (`foundry.ts`)

| id | description | channels | intended use |
| --- | --- | --- | --- |
| `foundry.brick_soot` | Refractory brick, pale mortar, soot plumes, heat-glazed bricks | glaze r 0.3 | walls, furnaces, chimneys |
| `foundry.iron_plate` | Tread plate (lozenges), corner bolts, oil slicks, rusty seams | m0.9, oil r 0.1 | floors, catwalks |
| `foundry.grate` | Heavy square-mesh floor grate (cutout, ws 1) | m0.9 | floor grates over pits/lava |
| `foundry.ceiling_beams` | Sooty brick vault with two riveted I-beams | beams m0.85 | ceilings |
| `foundry.trim_brass` | Polished brass band with rivets and engraved meander | m1 r 0.2–0.45 | trims, machine edging, rails |
| `foundry.hazard` | Plates with white-hot glowing seams and cracks, heat-tinted | e 32% glow 3.5 | hot floors/walls near furnaces |
| `foundry.slag` | Glassy slag lumps, vesicles, oxide skins, glowing pockets | e 1% glow 3 | slag heaps, spill floors |

## Stratum 5 — the Gilded Hive (`hive.ts`)

| id | description | channels | intended use |
| --- | --- | --- | --- |
| `hive.wax_wall` | Honeycomb cells, many filled with glowing honey, capped cells | honey r0.08, e 19% glow 2.5 | walls |
| `hive.amber_floor` | Polished amber slabs with trapped insects, faint inner light | r 0.07, glow 1.5 | floors |
| `hive.resin` | Sticky resin flows, dark red to orange, bubbles | r 0.08–0.16 | ceilings, secretions, drips |
| `hive.gilded_trim` | Gold band embossed with hex lattice, wax dribbles | m1 r ~0.28 | trims, altars, the Queen's throne |

## Stratum 6 — the Frozen Liturgy (`liturgy.ts`)

| id | description | channels | intended use |
| --- | --- | --- | --- |
| `frost.ice_wall` | Glacial ice with dark kneeling pilgrims frozen inside | r 0.05 (SSR) | ice walls |
| `frost.snow_floor` | Packed snow, wind ripples, footprints, glitter texels | r 0.05–0.77 | floors |
| `frost.frozen_stone` | Cathedral stone under hoarfrost, ice glaze, icicles under joints | glaze r 0.08 | walls, pillars |
| `frost.stained_glass` | Leaded lancet: robed saint with gold halo and a blank, featureless face | glass e 0.9 glow 2.5, lead m0.6 | windows (one lancet per repeat) |
| `frost.trim` | Frosted stone cornice with icicles along the lower lip | r 0.08–0.85 | trims, ledges |

## Stratum 7 — the Red Garden (`garden.ts`)

| id | description | channels | intended use |
| --- | --- | --- | --- |
| `flesh.wall` | Wet muscle folds, dark veins, pores | r 0.2–0.4 | walls |
| `flesh.floor` | Wrinkled flesh, bone knuckles, pooled fluid | pools r 0.05 | floors |
| `flesh.bone_rib` | Bowed ribs with stretched membrane between | bone r 0.55 | ribcage walls, arches, pillars |
| `flesh.membrane` | Taut rose membrane with branching hot-glowing veins | e 23% glow 2.5, r ~0.2 | ceilings, sacs, doors, backlit panels |

## Stratum 8 — the Orrery (`orrery.ts`)

| id | description | channels | intended use |
| --- | --- | --- | --- |
| `orrery.brass_panel` | Brass plates, one engraved as an astrolabe dial, rivets | m1 r ~0.25 | walls, machine casings |
| `orrery.cog_floor` | Dark iron floor inlaid with meshing brass gears | m0.7–1 | floors |
| `orrery.star_ceiling` | Lapis firmament: stars, gilt constellations, orbit arcs | e (stars 1, field 0.12) glow 2.5 | ceilings, domes |
| `orrery.trim` | Brass rack: toothed edge, rivets, engraved scale | m1 r ~0.25 | trims, rails |

## Stratum 9 — the Unlit (`unlit.ts`)

| id | description | channels | intended use |
| --- | --- | --- | --- |
| `unlit.black_stone` | Polished black basalt blocks, faint veins and glitter | r ~0.28 | walls (they show up in reflections) |
| `unlit.mirror` | Silvered panels in black frames, desilvering, cracks | m1 **r 0.05** | mirror walls/panels |
| `unlit.floor` | Black polished obsidian hexes, dusty seams | r ~0.14 | floors |
| `unlit.trim` | Black stone band with silver inlay lines and lozenge studs | inlay m1 r 0.1 | trims |

## Stratum 10 — the Threshold (`threshold.ts`)

| id | description | channels | intended use |
| --- | --- | --- | --- |
| `threshold.dream_stone` | Pale lilac blocks with wandering joints that faintly glow, contour ripples | joints e 0.35 glow 1.5 | walls, floors |
| `threshold.village_plaster` | Kneel's plaster remembered wrong: too warm, with faint eyes in it | eyes' irises r 0.25 | the dream-village walls |
| `threshold.gold_vein` | Dark stone mended with luminous gold (kintsugi) | veins m1 e ~0.4 glow 2 | floors, pillars, the Head's chamber |
| `threshold.sky` | Pale sourceless sky with wisps; fully emissive (ws 8) | e 1 glow 1.2 | sky domes/planes |

## Kneel, the village (`village.ts`)

| id | description | channels | intended use |
| --- | --- | --- | --- |
| `village.cobble` | Street cobbles, soil + moss joints, rain puddles | puddles r 0.08 | streets, market ring |
| `village.dirt_path` | Cart track with water-filled wheel ruts, prints, pebbles | ruts r 0.06 | lanes, outskirts |
| `village.grass` | Damp dark turf, flowers, trodden bare spots | r 0.95 | greens, verges |
| `village.plaster` | Lime plaster: worn whitewash, cracks, rain streaks, green damp | r ~0.92 | house walls (tintable) |
| `village.timber` | Tarred oak framing, deep checks, wooden pegs | r ~0.8 | half-timber frames, beams, posts |
| `village.shingle` | Split-oak shakes in overlapping courses, some grey, moss | r 0.9 | roofs |
| `village.thatch` | Reed thatch courses with ragged butts, greying, moss | r 0.95 | roofs |
| `village.colossus_stone` | Vast weathered grey stone, rain streaks, lichen rosettes, frost cracks (**ws 6**) | r 0.55–0.94 | the Colossus, huge monuments |
| `village.window_lit` | Leaded casement of bullseye quarries glowing with hearth light (ws 1.5) | glass e ~0.9 glow 2.5 | lit windows (one window per repeat) |
| `village.door` | Plank door, strap hinges, clench-nail studs, ring pull | straps m1 | doors, gates, chests' lids |
| `village.fence` | Weathered picket fence on two rails (cutout) | r ~0.9 | fences, railings |
| `village.well_stone` | Rubble well wall, fat mortar, moss, damp | r 0.3–0.96 | the well, low walls, bridges |
| `village.market_cloth` | Faded madder/cream striped awning canvas | r 0.95 | awnings, stalls, banners |

## Floor-surface overlays (`surfaces.ts`, all ws 1)

Liquids are dark and near-mirror: their look comes from SSR reflecting the
room, ripples live in the normal map.

| id | description | channels | intended use |
| --- | --- | --- | --- |
| `surface.water` | Dark shallow water, drop ripples | r 0.01–0.05 | Surface.Water |
| `surface.oil` | Black oil with iridescent thin-film bands | r 0.01–0.05 | Surface.Oil |
| `surface.blood` | Deep red pool with clotting skins | r 0.06–0.45 | Surface.Blood |
| `surface.ice` | Frozen sheet, white fractures | r 0.02–0.3 | Surface.Ice |
| `surface.lava` | Wide-open melt between crust rafts | e 39% **glow 4** | Surface.Fire / lava spill |
| `surface.acid` | Bubbling toxic green, lit from within | e (all) glow 2.5 | Surface.Acid |
| `surface.honey` | Golden folds of spilled honey | r ~0.1 | Surface.Honey |
| `surface.web` | Criss-cross web sheeting (cutout) | r 0.7 | Surface.Web |
| `surface.ash` | Grey ash drift, charcoal flecks, live embers | embers e1 glow 3 | Surface.Ash |
| `surface.spores` | Velvety spore carpet, faint glow, bright specks | e low glow 2 | Surface.Spores |
| `surface.slime` | Glossy green slime with bubbles | r ~0.1 | Surface.Slime |
| `surface.ink` | Blue-black ink with violet sheen | r 0.03–0.07 | Surface.Ink |

## Particle sprites (`sprites.ts`)

16×16 pixel-art sprites in one nearest-sampled RGBA8 atlas
(`buildSpriteAtlas()`, `spriteRect(id)` → `[u0, v0, u1, v1]`, v up). Straight
alpha, sRGB. White/grey sprites are tinted by the particle colour;
**pre-coloured** ones (marked ●) want a white tint. Only `glow` and `smoke*`
have soft gradients.

`glow`, `spark`, `ember` ●, `smoke0` `smoke1` `smoke2`, `dust`,
`flame0`–`flame3` ● (animation frames), `spore`, `droplet`, `snowflake`,
`rune0`–`rune3`, `star`, `shard`, `blood` ●, `splinter` ●, `ink` ●, `bubble`,
`ring`, `ash`, `leaf` ●, `bone_chip` ●, `note` (the Choir's sung note),
`feather`, `pebble`. Register more with `registerSprite(id, painter)` before the
atlas is built.

## Adding a material

Write a painter in the fitting `painters/<family>.ts` using `brushes.ts`
(layouts → relief → tone → `paintTone` through a hand-picked ramp → overlays),
call `registerMaterial(id, painter, opts)`, and check it with
`bun scripts/texture-sheet.ts <id-prefix>` (writes `screenshots/textures*.png`
with 2×2 tiling so seams show, plus a raking-light preview). Painting all 132
materials takes ~0.45 s in Bun / ~0.6 s cold in V8; keep new painters to a few
fields and avoid per-texel allocation. The library caps out at 256 layers.
