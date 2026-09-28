import type { AffixTheme, ConsumableName, StratumNaming } from "./types";

/** Name and flavour material for the item designer. Mechanics are one-line
 * suggestions; amplifier ids (twinned, legion, seeking, ricochet, piercing,
 * splitting, volatile, chaining, orbiting, echoing, *_trail, heavy, magnetic,
 * timed, to_*, vampiric, swift, swollen) refer to items/amplifiers.ts. */

const UNDERCROFT: StratumNaming = {
  stratum: 0,
  gear: [
    { slot: "focus", kind: "staff", name: "Sexton's Spade-Staff", flavor: "Half shovel, half staff. It digs either way." },
    { slot: "focus", kind: "wand", name: "Wick Wand", flavor: "A long taper, never lit. It doesn't need to be." },
    { slot: "focus", kind: "tome", name: "Ledger of the Stair", flavor: "Names, depths, and a blank line at the bottom." },
    { slot: "focus", kind: "orb", name: "Skull of Agnes", flavor: "Named three times, in three hands. Answers to all of them." },
    { slot: "relic", name: "Lychdog Whistle", flavor: "Nothing alive can hear it. Something comes anyway, wagging." },
    { slot: "hood", name: "Chandler's Cowl", flavor: "Smells of tallow and patience." },
    { slot: "hood", name: "Keener's Veil", flavor: "Soaked through with other people's crying. Still damp." },
    { slot: "robe", name: "Ossuary Mantle", flavor: "Stitched with finger-bones in rows. Each row is a family." },
    { slot: "robe", name: "Stair-Watch Coat", flavor: "Every arrowhead in its pockets is pointing up." },
    { slot: "boots", name: "Sunday Boots", flavor: "For digging in. Bowe dug on Sundays." },
    { slot: "amulet", name: "Tallow Amulet", flavor: "A thumb of grave tallow in a wire cage. Warm when you're frightened." },
    { slot: "ring", name: "Grave Ring", flavor: "Found on a finger nineteen feet down. The finger didn't mind." },
    { slot: "ring", name: "Depth Ring", flavor: "Scratched inside the band: MAM 14 FT." },
  ],
  legendaries: [
    {
      id: "tallow_crown",
      name: "Tallow Crown",
      slot: "hood",
      flavor: "Every candle Bowe ever lit was lit on this, once.",
      mechanic: "When you kill something, a candle lights where it fell (30 s); standing within 3 m of your candles regenerates mana.",
    },
    {
      id: "hollis_cranes_trowel",
      name: "Hollis Crane's Trowel",
      slot: "relic",
      flavor: "It laid a wall so good its maker couldn't get through.",
      mechanic: "Relic raises a 4 m mortar wall; your spells pass through it, nothing else does; enemies that strike it are slowed.",
    },
    {
      id: "stair_watch_bow_staff",
      name: "Loose Before It Asks",
      slot: "focus",
      kind: "staff",
      flavor: "Standing orders of the Stair-Watch, carved along the grip.",
      mechanic: "Primary gains piercing 2; +50% damage to anything moving toward you.",
    },
  ],
  prefixes: ["Tallow-bound", "Candlelit", "Ossuary", "Keening", "Sunday", "Bricked", "Counted", "Buried", "Guttering", "Painted"],
  suffixes: ["of the Stair", "of Bowe", "of Nineteen Feet", "of the Sexton", "of the Vigil", "of Aunt Wenna", "of the Lower Step", "of the Stair-Watch"],
  materials: [
    { id: "grave_tallow", name: "Grave Tallow", flavor: "Rendered from Bowe's dead, to see by. It remembers being somebody.", use: "Binds every enchantment: required by all imbues and reforges." },
    { id: "ossuary_bone", name: "Ossuary Bone", flavor: "Washed, counted, labelled, shelved. Bone keeps count.", use: "Item upgrades (+1, +2 …); relic bodies." },
  ],
  consumables: [
    { id: "mercy_candle_stub", name: "Mercy Candle Stub", kind: "charm", flavor: "Left on a bone saucer for whoever comes. That's you.", effect: "Place: heals 2 hp/s within 3 m for 20 s; water puts it out." },
    { id: "tallow_flask", name: "Tallow Flask", kind: "flask", flavor: "Warm grave fat in a stoppered bottle. Throw it at someone you dislike.", effect: "Throw: oil r 2; ignites if it lands near a flame." },
    { id: "bone_dust_pinch", name: "Pinch of Bone Dust", kind: "charm", flavor: "Blown across the floor, it settles on what shouldn't be there.", effect: "Reveals traps within 12 m for 30 s." },
  ],
  kit: { id: "kit_undercroft", name: "The Sunday Set (Undercroft Kit)", flavor: "Good boots, a warm hood, a staff with a spade on the end. Bowe would approve. Bowe would dig." },
};

const ARCHIVE: StratumNaming = {
  stratum: 1,
  gear: [
    { slot: "focus", kind: "staff", name: "Rolling-Ladder Pole", flavor: "Still has the brass wheel on one end. Still squeaks." },
    { slot: "focus", kind: "wand", name: "Proctor's Rule", flavor: "A long iron rule. It has never measured anything but noise." },
    { slot: "focus", kind: "tome", name: "Portion 40,112", flavor: "Four hundred and sixty-eight syllables of God, in a child's careful hand." },
    { slot: "focus", kind: "tome", name: "Drowned Concordance", flavor: "Every word, cross-referenced to every other word. Mostly to 'water'." },
    { slot: "focus", kind: "orb", name: "Lamp-Jelly Globe", flavor: "Stoop read by it. It still wants something to read to." },
    { slot: "relic", name: "Sluice Key", flavor: "Opens the gates. Doesn't close them. Nobody ever asked it to." },
    { slot: "hood", name: "Copyist's Eyeshade", flavor: "Green glass, cracked. It keeps the glare off the Name." },
    { slot: "robe", name: "Wet Gown of Stoop", flavor: "Heavy, cold, and never, ever dry." },
    { slot: "boots", name: "Silent Slippers", flavor: "Felt soles. Proctor-approved." },
    { slot: "amulet", name: "Blotting Locket", flavor: "Inside, a scrap of blotter with half a word on it, backwards." },
    { slot: "ring", name: "Seal of the Last Line", flavor: "The seal is a stooping figure. The wax has never been broken." },
  ],
  legendaries: [
    {
      id: "rooks_left_boot",
      name: "Rook's Left Boot",
      slot: "boots",
      flavor: "Lost on floor 14 to something under the edge. It's a left.",
      mechanic: "Wading makes no noise; while standing in water you are unheard, and electrified water doesn't shock you.",
    },
    {
      id: "the_last_line",
      name: "The Last Line",
      slot: "focus",
      kind: "tome",
      flavor: "Four thousand four hundred drafts. One word. Struck.",
      mechanic: "Every 5th cast is echoing and to_void; its hits strike out one buff or status from the target.",
    },
    {
      id: "margin_of_kindness",
      name: "The Margin",
      slot: "amulet",
      flavor: "There's a biscuit in the drawer.",
      mechanic: "Reading a lore note restores 25% mana; allies (delvers, helpers) within 8 m regenerate 1% health/s.",
    },
  ],
  prefixes: ["Drowned", "Inked", "Stooping", "Marginal", "Hushed", "Waterlogged", "Annotated", "Struck", "Portioned", "Blotted"],
  suffixes: ["of the Last Line", "of Stoop", "of the Rising", "of Silence", "of the Margin", "of Portion 40,112", "of the Reading Room", "of Closing Time"],
  materials: [
    { id: "drowned_vellum", name: "Drowned Vellum", flavor: "The only paper that doesn't mind being wet. It has been wet for a thousand years.", use: "Reforging: rewriting affixes needs something to write on." },
    { id: "ink_sac", name: "Ink Sac", flavor: "Cuttle ink, still trying to spell something.", use: "Scrolls and consumable crafting; storm and void imbues." },
  ],
  consumables: [
    { id: "ink_map", name: "Drowned Map-Ink", kind: "scroll", flavor: "Spill it on the floor and it runs along every corridor at once.", effect: "Reveals the floor map (action: reveal_map)." },
    { id: "sluice_flask", name: "Sluice Flask", kind: "flask", flavor: "A bottle of the Archive's water. It wants to go somewhere.", effect: "Throw: water r 3 + impulse; puts out fires, makes things wet." },
    { id: "hush_cloth", name: "Hush-Cloth", kind: "charm", flavor: "Keeper grey. Wrap your boots and walk like a rumour.", effect: "Footsteps make no noise for 60 s." },
  ],
  kit: { id: "kit_archive", name: "The Wader's Kit (Archive Kit)", flavor: "Felt slippers, an oilcloth gown and a very quiet staff. Hask checked the seams twice. Hask always checks the seams twice." },
};

const CHOIR: StratumNaming = {
  stratum: 2,
  gear: [
    { slot: "focus", kind: "staff", name: "Cantor's Baton-Staff", flavor: "It keeps time. It will keep yours." },
    { slot: "focus", kind: "wand", name: "Gill-Knife Wand", flavor: "Pale and ribbed. It hums a half-step flat." },
    { slot: "focus", kind: "tome", name: "Great Hymnal (Ninetieth Hymn)", flavor: "Four parts on page one. One line by page ninety." },
    { slot: "focus", kind: "orb", name: "Puffball Orb", flavor: "Don't squeeze it. Don't squeeze it near a candle." },
    { slot: "relic", name: "Tuning Fork", flavor: "Strike it and everything in earshot is briefly, painfully itself." },
    { slot: "hood", name: "Cap of Lean", flavor: "Grows a little in the night. Smells of wet bread." },
    { slot: "robe", name: "Mycelium Cassock", flavor: "Soft as felt, threaded through, faintly warm, faintly alive." },
    { slot: "boots", name: "Soft-Step Shoes", flavor: "Everything down here is soft. Now you are too." },
    { slot: "amulet", name: "Choir Spore Locket", flavor: "Open it and you hear, very faintly, everyone." },
    { slot: "ring", name: "Harmony Band", flavor: "Two thin rings grown into one. You can't tell where." },
  ],
  legendaries: [
    {
      id: "us",
      name: "Us",
      slot: "focus",
      kind: "orb",
      flavor: "It is very happy to see you.",
      mechanic: "Each ally within 10 m (delver, helper, summon) adds +1 projectile to your casts (twinned → legion), up to +3.",
    },
    {
      id: "the_bread_song",
      name: "The Bread Song",
      slot: "amulet",
      flavor: "Not a real song. That's why it works.",
      mechanic: "Immune to feared; grab attacks against you fail 50% of the time; choir harmony doesn't apply near you.",
    },
    {
      id: "half_sung_veil",
      name: "Half-Sung Veil",
      slot: "hood",
      flavor: "Two voices under one veil, arguing.",
      mechanic: "Primary alternates arcane / force each cast; casting both within 1 s releases a small force nova.",
    },
  ],
  prefixes: ["Choral", "Harmonised", "Gilled", "Luminous", "Soft", "Leaning", "Sporing", "Chorded", "Humming", "Mycelial"],
  suffixes: ["of Lean", "of the Chord", "of One Voice", "of the Last Separate Voice", "of the Bread Song", "of the Ninetieth Hymn", "of Us", "of the Hum"],
  materials: [
    { id: "choir_spore", name: "Choir Spore", flavor: "A pinch of the chord. It makes things agree.", use: "Linking: imbue a second element or bind an amplifier without losing an affix." },
    { id: "lumen_cap", name: "Lumen Cap", flavor: "The blue cap Lean ate to see each other in the dark.", use: "Potions, light radius, lantern cosmetics." },
  ],
  consumables: [
    { id: "lumen_tea", name: "Lumen Tea", kind: "potion", flavor: "The hermit's brew. Tastes like a cave smells.", effect: "+2 m light radius and darkvision for the floor." },
    { id: "spore_bomb", name: "Puffball Grenade", kind: "flask", flavor: "A dried puffball on a string. Throw, then look away.", effect: "Throw: spores r 2.5 + poison; fire detonates it." },
    { id: "spore_mask", name: "Spore-Mask", kind: "charm", flavor: "Wet linen and lumen gills. Breathe through your teeth.", effect: "Immune to spore poison for the floor." },
  ],
  kit: { id: "kit_choir", name: "The Hummer's Kit (Choir Kit)", flavor: "Comes with a spore-mask and a slip of paper with the words to the bread song. Hask insists you learn them." },
};

const FOUNDRY: StratumNaming = {
  stratum: 3,
  gear: [
    { slot: "focus", kind: "staff", name: "Crucible Staff", flavor: "A pour-spout on the end and a glow that never quite goes out." },
    { slot: "focus", kind: "wand", name: "Stamp-Rod", flavor: "One end says REJECT. The other end is blank. Nobody ever used the other end." },
    { slot: "focus", kind: "tome", name: "Logbook, Vol. CCXII", flavor: "Attempt 9,044. Close. Too warm." },
    { slot: "focus", kind: "orb", name: "Ember Core Orb", flavor: "Warm as a hand. Nobody in Raise asked whose." },
    { slot: "relic", name: "Inspector's Lens", flavor: "It sees one thing very clearly and nothing else at all." },
    { slot: "relic", name: "Quench Bucket", flavor: "The Foundry's most dangerous weapon. Mind the steam." },
    { slot: "hood", name: "Smith's Leather Cowl", flavor: "Scorched at the brow. Eyebrows sold separately." },
    { slot: "robe", name: "Slag Apron", flavor: "Heavy enough to stop a spark, a splash, or a conversation." },
    { slot: "boots", name: "Anvil-Toe Boots", flavor: "For kicking things that are hotter than you." },
    { slot: "amulet", name: "Thimble Amulet", flavor: "Given to the god. The god was rejected. The thimble came back." },
    { slot: "ring", name: "Wedding Ring (Worn Thin)", flavor: "From Mrs Tull. Worn thin on the inside, where the finger was." },
  ],
  legendaries: [
    {
      id: "attempt_no_1",
      name: "Attempt No. 1",
      slot: "relic",
      flavor: "The size of a thumb. Nobody looked at it for more than a minute.",
      mechanic: "Relic summons a tiny brass Attempt that follows you and stamps enemies (stun 0.5 s); it grows 10% per floor it survives this run.",
    },
    {
      id: "the_cupped_hands",
      name: "The Cupped Hands",
      slot: "focus",
      kind: "orb",
      flavor: "Shaped to hold something small. Empty.",
      mechanic: "Heavy + magnetic built in; hold to 'weigh' the cast for up to 2 s: +100% damage and knockback.",
    },
    {
      id: "idonys_apron",
      name: "Idony's Apron",
      slot: "robe",
      flavor: "One pocket. A felt-lined cradle the size of a thumb. Empty.",
      mechanic: "Immune to burning; standing in fire restores mana instead of harming you (lava still burns after 3 s).",
    },
  ],
  prefixes: ["Forged", "Rejected", "Numbered", "Slag-hardened", "Quenched", "Stamped", "Ember-hearted", "Tempered", "Molten", "Inspected"],
  suffixes: ["of Raise", "of the Last Attempt", "of the Quench", "of Nine Thousand Tries", "of the Stamp", "of the Pour", "of Mrs Tull", "of Tolerances"],
  materials: [
    { id: "slag_iron", name: "Slag Iron", flavor: "Rejected gods, melted. Every ingot has a chip on its shoulder.", use: "Heavy upgrades (+5 and beyond), armour, relic bodies." },
    { id: "ember_core", name: "Ember Core", flavor: "A stone that stays warm for years. Something enormous is asleep nearby.", use: "Fire imbues, relic charges." },
  ],
  consumables: [
    { id: "quench_flask", name: "Quench Flask", kind: "flask", flavor: "Foundry water with rime in it. Hot metal hates it.", effect: "Throw: water + frost r 2; thermal-shocks hot or burning things (armour −50% 6 s)." },
    { id: "ember_grenade", name: "Ember Grenade", kind: "flask", flavor: "A cracked ember core in a clay jacket. Throw it quickly.", effect: "Throw: fire explosion r 3, impulse 20; sets oil alight." },
  ],
  kit: { id: "kit_foundry", name: "The Leather-Apron Kit (Foundry Kit)", flavor: "Scorch-proof, splash-proof and, Hask says, 'mostly delver-proof'. Returned smelling of sulphur every time." },
};

const HIVE: StratumNaming = {
  stratum: 4,
  gear: [
    { slot: "focus", kind: "staff", name: "Comb Staff", flavor: "Hexagons all the way up. Drips when it's warm." },
    { slot: "focus", kind: "wand", name: "Stinger Wand", flavor: "Barbed. It goes in easier than it comes out." },
    { slot: "focus", kind: "tome", name: "Book of Petitions", flavor: "Thousands of pages. One question." },
    { slot: "focus", kind: "orb", name: "Amber Orb", flavor: "A dog is asleep inside it. It has been asleep for a very long time." },
    { slot: "relic", name: "Smoke-Pot Censer", flavor: "The Beekeeper's. Makes the whole Hive drowsy and a little sad." },
    { slot: "hood", name: "Beekeeper's Veil", flavor: "Pell made this. Pell won't say for whom." },
    { slot: "robe", name: "Wax-Plate Robe", flavor: "Overlapping scales of pale wax. Soft in the heat; don't sit by a fire." },
    { slot: "boots", name: "Honey-Sure Boots", flavor: "Tacky soles. You'll never slip. You'll never be quiet either." },
    { slot: "amulet", name: "Royal Jelly Locket", flavor: "Meant for the Queen. She never asked for it." },
    { slot: "ring", name: "Hexagon Ring", flavor: "Six sides. Bend thought it was the shape of fairness." },
  ],
  legendaries: [
    {
      id: "mauds_spectacles",
      name: "Maud's Spectacles",
      slot: "hood",
      flavor: "Small and round. She had nothing to read.",
      mechanic: "See each enemy's current target as a faint line; creatures that haven't noticed you glow, and take +25% damage.",
    },
    {
      id: "what_do_you_want",
      name: "What Do You Want",
      slot: "focus",
      kind: "tome",
      flavor: "A petition, bound, never answered.",
      mechanic: "Spells leave honey trails; enemies slowed by honey take +30% damage from you.",
    },
    {
      id: "carry_and_bow",
      name: "Carry and Bow",
      slot: "boots",
      flavor: "Nobody's hungry and nobody's slow.",
      mechanic: "Immune to slowed, honey and web; +5% move speed per ally within 10 m.",
    },
  ],
  prefixes: ["Gilded", "Honeyed", "Waxen", "Amber-set", "Humming", "Royal", "Sealed", "Serving", "Bending", "Sweet"],
  suffixes: ["of Bend", "of the Queen", "of the Petition", "of Service", "of the Comb", "of Open Doors", "of the Nursery", "of Seventy Years"],
  materials: [
    { id: "royal_wax", name: "Royal Wax", flavor: "Sealed by a thousand careful mouths.", use: "Sealing: locks one affix against a reforge; salve disguises you from the Hive." },
    { id: "amber", name: "Amber", flavor: "Sap and honey gone to stone with things inside.", use: "Preservation: reforge without losing upgrades; set a legendary's mechanic." },
  ],
  consumables: [
    { id: "royal_wax_salve", name: "Royal Wax Salve", kind: "salve", flavor: "Smells like the Queen's cell. The Hive will think you're family.", effect: "Hive creatures ignore you for 60 s unless attacked." },
    { id: "smoke_pot", name: "Smoke-Pot", kind: "flask", flavor: "Green wood and a pinch of something the Beekeeper won't name.", effect: "Throw: smoke r 4; hive creatures slowed and non-aggressive 10 s." },
    { id: "honey_jar", name: "Jar of Bend Honey", kind: "flask", flavor: "Sweet enough to stop a charge. Literally.", effect: "Throw: honey r 2 (slowed). Or drink: heal 20% over 10 s." },
  ],
  kit: { id: "kit_hive", name: "The Veiled Kit (Hive Kit)", flavor: "A beekeeper's veil, a smoker and a tin of salve. Hask says wear the veil even if you feel silly. Especially then." },
};

const LITURGY: StratumNaming = {
  stratum: 5,
  gear: [
    { slot: "focus", kind: "staff", name: "Crozier of Fold", flavor: "The crook is frozen shut. It still points the way." },
    { slot: "focus", kind: "wand", name: "Icicle Taper", flavor: "A candle flame of solid glass. Cold to the touch, bright to the eye." },
    { slot: "focus", kind: "tome", name: "Missal of the Hours", flavor: "Every page is the page the congregation is on." },
    { slot: "focus", kind: "orb", name: "Frozen Flame", flavor: "Snapped off an altar candle. Still burning, in a way." },
    { slot: "relic", name: "Hand-Bell of Lauds", flavor: "Ring it once. Everything nearby pauses to listen." },
    { slot: "hood", name: "Frosted Mitre", flavor: "Tall, cold and ridiculous. Deep enough to drown a bishop." },
    { slot: "robe", name: "Cope of the Unending Office", flavor: "Four hundred years of candle-smoke in the embroidery." },
    { slot: "boots", name: "Kneeling Boots", flavor: "The knees are worn through. The soles are like new." },
    { slot: "amulet", name: "Stopped Hourglass", flavor: "The sand hangs halfway. Shaking it does nothing. Everyone shakes it." },
    { slot: "ring", name: "Gil's Glove-Ring", flavor: "Found frozen inside a glove on a pew. Keep my place." },
  ],
  legendaries: [
    {
      id: "chalice_held_aloft",
      name: "The Chalice Held Aloft",
      slot: "relic",
      flavor: "Held up for longer than Kneel has existed.",
      mechanic: "Relic stops time in a 6 m bubble for 2 s: creatures and projectiles inside freeze; yours resume when it ends.",
    },
    {
      id: "back_in_a_minute",
      name: "Back in a Minute",
      slot: "boots",
      flavor: "Keep my place. Don't let Hew have it; he fidgets.",
      mechanic: "Dashing leaves a frozen place-holder; dash again within 5 s to return to it.",
    },
    {
      id: "amen",
      name: "Amen",
      slot: "focus",
      kind: "tome",
      flavor: "Not to be sung.",
      mechanic: "After 3 s without casting, your next spell is swollen and deals +150% (the prayer ends).",
    },
  ],
  prefixes: ["Rimed", "Stilled", "Unending", "Held", "Vowed", "Frostbound", "Liturgical", "Hallowed", "Suspended", "Wintered"],
  suffixes: ["of Fold", "of the Hours", "of the Held Note", "of the Vow", "of Matins", "of the Extra Prayer", "of the Late Pilgrim", "of Not Yet"],
  materials: [
    { id: "rime_crystal", name: "Rime Crystal", flavor: "Frost that formed on the vow itself.", use: "Frost imbues; cast speed." },
    { id: "stilled_breath", name: "Stilled Breath", flavor: "A breath someone started and never finished, corked.", use: "Durations and cooldowns; wrapped around every Waking Bell's clapper." },
  ],
  consumables: [
    { id: "stilled_breath_vial", name: "Uncorked Breath", kind: "potion", flavor: "You breathe in someone else's unfinished breath. Time holds it too.", effect: "Everything within 5 m except you freezes for 1.5 s." },
    { id: "warming_coal", name: "Warming Coal", kind: "charm", flavor: "A coal in a tin, from a side-door brazier.", effect: "Clears chilled/frozen; immune to chilled for 30 s." },
  ],
  kit: { id: "kit_liturgy", name: "The Late Pilgrim's Kit (Liturgy Kit)", flavor: "Fur-lined, spare gloves, a coal tin. Hask says don't light anything in the long rooms, and means it." },
};

const GARDEN: StratumNaming = {
  stratum: 6,
  gear: [
    { slot: "focus", kind: "staff", name: "Trellis Staff", flavor: "Something was trained up it once. It still leans toward warmth." },
    { slot: "focus", kind: "wand", name: "Secateur Wand", flavor: "Pruning is a kindness. The Garden insists." },
    { slot: "focus", kind: "tome", name: "Seed Catalogue", flavor: "Spring edition. Every packet has a name on it." },
    { slot: "focus", kind: "orb", name: "Heartseed Orb", flavor: "Beats once a minute. You'll start counting. You won't be able to stop." },
    { slot: "relic", name: "Grafting Needle", flavor: "Stitches anything to anything. It does not ask whether it should." },
    { slot: "hood", name: "Sun Hat (No Sun)", flavor: "Wide-brimmed, straw, perfectly useless. Worn anyway. Worn with thanks." },
    { slot: "robe", name: "Gardener's Smock", flavor: "Deep pockets full of labels and twine." },
    { slot: "boots", name: "Bed-Walker Boots", flavor: "For walking between the rows without treading on anybody." },
    { slot: "amulet", name: "Labelled Heart", flavor: "A little brass tag on a chain: HEART — with thanks." },
    { slot: "ring", name: "Mrs Ottery's Ring", flavor: "From the left hand. She gave the whole hand. The ring came with it." },
  ],
  legendaries: [
    {
      id: "with_thanks",
      name: "With Thanks",
      slot: "amulet",
      flavor: "Every gift labelled. None forgotten.",
      mechanic: "Kills plant a heartseed bloom that heals you once when walked over; +1 max health per kill this run (cap 100).",
    },
    {
      id: "the_vessels_face",
      name: "The Vessel's Face",
      slot: "hood",
      flavor: "Blank and lovely, and it doesn't fit.",
      mechanic: "The first attack each enemy makes at you strikes a decoy of you at your last position instead.",
    },
    {
      id: "tamsins_secateurs",
      name: "Tamsin's Secateurs",
      slot: "focus",
      kind: "wand",
      flavor: "Well oiled. Well used. Worn smooth where her thumb went.",
      mechanic: "Vampiric built in; hits on bleeding targets deal +50% and chain bleeding to one nearby enemy.",
    },
  ],
  prefixes: ["Grafted", "Grown", "Offered", "Labelled", "Sutured", "Ichorous", "Blooming", "Pruned", "Warm", "Given"],
  suffixes: ["of Offer", "of the Long Bed", "of the Vessel", "of With Thanks", "of the Heartbeat", "of the Pruner", "of Mrs Ottery", "of Always Warm"],
  materials: [
    { id: "ichor", name: "Ichor", flavor: "The Garden's sap, clear gold with a thread of red.", use: "Life and regeneration affixes; high healing draughts." },
    { id: "heartseed", name: "Heartseed", flavor: "Grown from a sliver of someone's heart. Beats once a minute.", use: "Planted in an item: the item gains item level from kills (capped)." },
  ],
  consumables: [
    { id: "ichor_salve", name: "Ichor Salve", kind: "salve", flavor: "Closes wounds and doesn't ask whose.", effect: "Heal 40% over 8 s; cures bleeding." },
    { id: "tick_jar", name: "Jar of Ticks", kind: "flask", flavor: "From the leech doctor. Don't open it indoors.", effect: "Throw: 5 blood ticks latch onto the nearest warm enemies." },
  ],
  kit: { id: "kit_garden", name: "The Pruner's Kit (Garden Kit)", flavor: "Rubber gloves, a straw hat and good shears. Hask says bring the gloves back. Hask says it twice." },
};

const ORRERY: StratumNaming = {
  stratum: 7,
  gear: [
    { slot: "focus", kind: "staff", name: "Astrolabe Staff", flavor: "The rings still turn to find a star. The star is usually painted on." },
    { slot: "focus", kind: "wand", name: "Balance-Wheel Wand", flavor: "Ticks faintly in your hand, a little faster when you're afraid." },
    { slot: "focus", kind: "tome", name: "Minutes of the Committee", flavor: "Item 1 resolved in the negative. Item 2: lunch." },
    { slot: "focus", kind: "orb", name: "Orrery Orb", flavor: "Nine brass planets on wires. One of them is Kneel." },
    { slot: "relic", name: "Winding Key", flavor: "Fits every angel in the Orrery, and several things that aren't." },
    { slot: "hood", name: "Horologer's Loupe-Hood", flavor: "A lens over one eye. The world, very large and very close." },
    { slot: "robe", name: "Oilcloth Robe", flavor: "Slick, dark and fireproof. Mostly. Read the label. There is no label." },
    { slot: "boots", name: "Escapement Boots", flavor: "Click-click-click. They want to go somewhere on the beat." },
    { slot: "amulet", name: "Pocket Star", flavor: "A star lamp the size of a thumbnail. Turn put out the real one." },
    { slot: "ring", name: "Gear-Tooth Ring", flavor: "Twelve teeth. It meshes with nothing. It keeps trying." },
  ],
  legendaries: [
    {
      id: "the_brake",
      name: "The Brake",
      slot: "relic",
      flavor: "Held for longer than anyone should hold anything.",
      mechanic: "Relic: enemies within 15 m slowed 60% for 3 s; while held you can't move but take 50% less damage.",
    },
    {
      id: "three_degrees_north",
      name: "Turn Three Degrees North",
      slot: "focus",
      kind: "orb",
      flavor: "Side effects: none anticipated.",
      mechanic: "Orbiting + ricochet built in; each ricochet rotates the element (fire → frost → storm).",
    },
    {
      id: "sheet_fourteen",
      name: "Sheet 14 of 900",
      slot: "focus",
      kind: "tome",
      flavor: "Elevation of the Sleeper, from Stand's descriptions.",
      mechanic: "Timed built in; each detonation cuts your relic cooldown by 1 s.",
    },
  ],
  prefixes: ["Geared", "Wound", "Calibrated", "Orbital", "Regulated", "Brass", "Corrected", "Escaping", "Oiled", "Periodic"],
  suffixes: ["of Reach", "of the Brake", "of Correction", "of the Great Wheel", "of Three Degrees", "of the Committee", "of Nine Thousand Years", "of Gentler Winters"],
  materials: [
    { id: "orichalcum_gear", name: "Orichalcum Gear", flavor: "Cut to the period of one particular star.", use: "Cast speed and cooldowns; reforging relics." },
    { id: "mainspring", name: "Mainspring", flavor: "A coil of stored turning. It wants to let go.", use: "Extra charges and jumps; relic cooldowns; the heart of Timed amplifiers." },
  ],
  consumables: [
    { id: "winding_key_charge", name: "Wind-Up", kind: "charm", flavor: "Three turns of a borrowed key in your own back. Don't think about it.", effect: "Resets relic cooldown." },
    { id: "oil_can", name: "Oiler's Can", kind: "flask", flavor: "Long spout, good oil. The Oiler won't miss it. The Oiler never misses anything.", effect: "Throw: oil r 2; or oil a stalled lift to start it." },
  ],
  kit: { id: "kit_orrery", name: "The Oiler's Kit (Orrery Kit)", flavor: "Oilcloth, a winding key and a pocket watch that runs backwards. Hask says it's fine. Hask says that about most things." },
};

const UNLIT: StratumNaming = {
  stratum: 8,
  gear: [
    { slot: "focus", kind: "staff", name: "Blind Walker's Staff", flavor: "Worn smooth at the tip from tapping walls in the dark." },
    { slot: "focus", kind: "wand", name: "Snuffer's Finger", flavor: "Long, cold, and damp at the tip." },
    { slot: "focus", kind: "tome", name: "Book of Counting", flavor: "Page after page of numbers, in the dark, by touch. Ready or not." },
    { slot: "focus", kind: "orb", name: "Umbral Glass Orb", flavor: "You look into it and it looks away, politely." },
    { slot: "relic", name: "Turned Mirror", flavor: "Faces the wall. Turn it round only when you mean it." },
    { slot: "hood", name: "Blindfold of Turn", flavor: "So you don't cheat." },
    { slot: "robe", name: "Hider's Cloak", flavor: "The colour of the inside of a cupboard." },
    { slot: "boots", name: "Half-Dark Slippers", flavor: "Walk slowly, as if you're going somewhere ordinary." },
    { slot: "amulet", name: "Painted Spectacles", flavor: "The lenses are black. You can see perfectly well. That's the trouble." },
    { slot: "ring", name: "Echo Ring", flavor: "Tap it and it taps back. Tap it again and it taps back twice." },
  ],
  legendaries: [
    {
      id: "olly_olly",
      name: "Olly Olly",
      slot: "hood",
      flavor: "The best anyone ever hid.",
      mechanic: "Standing still in darkness for 2 s makes you invisible until you act; your first spell from hiding is echoing.",
    },
    {
      id: "the_other_reflection",
      name: "The Other Reflection",
      slot: "relic",
      flavor: "It didn't stop when you stopped.",
      mechanic: "Relic summons your reflection for 8 s; it repeats your casts from its own position.",
    },
    {
      id: "ninety_nine_million",
      name: "Ninety-Nine Million",
      slot: "focus",
      kind: "tome",
      flavor: "Ready or not.",
      mechanic: "Each cast adds a count; at 99 your next spell is legion + volatile. Counts drain while you stand in light.",
    },
  ],
  prefixes: ["Unlit", "Hidden", "Snuffed", "Mirrored", "Counting", "Blind", "Umbral", "Turned", "Echoing", "Quiet"],
  suffixes: ["of Turn", "of the Seeker", "of Hiding", "of the Count", "of Ready-or-Not", "of the Turned Mirror", "of Olly", "of the Half-Dark"],
  materials: [
    { id: "umbral_glass", name: "Umbral Glass", flavor: "Mirror silvered with the dark.", use: "Stealth; void imbues; lenses." },
    { id: "echo", name: "Echo", flavor: "A sound that never finished bouncing, in a stoppered horn.", use: "Repetition: extra projectiles, echoing/twinned; copy one affix to another item." },
  ],
  consumables: [
    { id: "umbral_ink", name: "Umbral Ink", kind: "potion", flavor: "Drink it and the light slides off you.", effect: "Invisible for 5 s (breaks on cast)." },
    { id: "echo_horn", name: "Echo Horn", kind: "charm", flavor: "Uncork it somewhere else. Something will go and look.", effect: "Place: emits your footsteps and a heartbeat for 10 s (lure)." },
  ],
  kit: { id: "kit_unlit", name: "The Half-Dark Kit (Unlit Kit)", flavor: "A shuttered lantern, soft boots and a blindfold Hask swears is 'for emergencies'." },
};

const THRESHOLD: StratumNaming = {
  stratum: 9,
  gear: [
    { slot: "focus", kind: "staff", name: "Rim-Stone Staff", flavor: "Cut from the rim of a village that stood and watched." },
    { slot: "focus", kind: "wand", name: "Your Own Candle", flavor: "Your name, in your handwriting. You don't remember scratching it." },
    { slot: "focus", kind: "tome", name: "Blank Ledger", flavor: "Year One, and then nothing, for ever." },
    { slot: "focus", kind: "orb", name: "Godtear Orb", flavor: "Heavy, clear and faintly salt. Hold it and you feel very tired, and very loved." },
    { slot: "relic", name: "Kneeling-Stone", flavor: "Worn into two hollows by knees. Yours fit." },
    { slot: "hood", name: "Hood, Remembered Wrong", flavor: "It's your hood. The colour's not quite right. The dream did its best." },
    { slot: "robe", name: "Robe of Stand", flavor: "Plain, grey, older than any cloth. It never learned to kneel." },
    { slot: "boots", name: "Boots of the Rim Steps", flavor: "Every delver who went down wore these, one way or another." },
    { slot: "amulet", name: "Long Candle Stub", flavor: "Impossible. The Long Candle never gets shorter. And yet here's a stub." },
    { slot: "ring", name: "Ring of the Eleventh Face", flavor: "Blank on the bezel. For the house." },
  ],
  legendaries: [
    {
      id: "year_one",
      name: "Year One",
      slot: "focus",
      kind: "tome",
      flavor: "We lit one for It, because It went down first.",
      mechanic: "Your first spell on each floor is swollen + volatile + echoing, and reveals the floor's Descent.",
    },
    {
      id: "first_askers_hands",
      name: "The First Asker's Hands",
      slot: "ring",
      flavor: "Worn smooth on one side, from a cheek.",
      mechanic: "Every 5th hit on the same enemy makes it hesitate (stunned 1 s); wardens every 25th.",
    },
    {
      id: "pocket_stone_of_stand",
      name: "Pocket Stone of Stand",
      slot: "amulet",
      flavor: "Older than Kneel. Warm from someone's pocket.",
      mechanic: "Once per run, a killing blow instead returns you to the floor's arrival with 30% health; the stone goes cold.",
    },
  ],
  prefixes: ["Remembered", "Dreamt", "Witnessed", "First", "Standing", "Wrong", "Tear-bright", "Kneeling", "Eleventh", "Last"],
  suffixes: ["of Stand", "of the Head", "of the First Asker", "of Year One", "of the Rim", "of the Question", "of Home, Almost", "of the Dreamer"],
  materials: [
    { id: "godtear", name: "Godtear", flavor: "A tear the dreamer cried in its sleep. The dream keeps what it touches; this is what it touched.", use: "Legendary work: epic → legendary; reroll a unique; make the dream 'remember' an item so one death can't take it." },
  ],
  consumables: [
    { id: "godtear_drop", name: "A Drop of Godtear", kind: "potion", flavor: "Salt, and then nothing, and then everything at once.", effect: "Full health and mana; cleanses all statuses." },
    { id: "remembered_bread", name: "Remembered Bread", kind: "food", flavor: "Bread and salt from the Stump. It tastes exactly right. That's how you know.", effect: "Heal 50%; for 30 s, remembered villagers won't turn to look at you." },
  ],
  kit: { id: "kit_threshold", name: "Hask's Own Kit", flavor: "Hask's own gear, from before anyone remembers. It's never been lent. Hask says it's been waiting. Hask doesn't say for whom." },
};

/** Per-stratum naming material, index = stratum. */
export const STRATUM_NAMING: StratumNaming[] = [UNDERCROFT, ARCHIVE, CHOIR, FOUNDRY, HIVE, LITURGY, GARDEN, ORRERY, UNLIT, THRESHOLD];

/** Affix words by stat / element theme, for any stratum. */
export const AFFIX_THEMES: AffixTheme[] = [
  { theme: "fire", prefixes: ["Searing", "Cindered", "Kindled", "Scorching", "Forge-hot"], suffixes: ["of Embers", "of the Pour", "of Kindling", "of the Bellows"] },
  { theme: "frost", prefixes: ["Rimed", "Frostbitten", "Hoar", "Wintry", "Glassy"], suffixes: ["of the Held Note", "of Hoarfrost", "of Long Winters", "of the Font"] },
  { theme: "storm", prefixes: ["Crackling", "Galvanic", "Thundering", "Forked", "Sparking"], suffixes: ["of the Lamp-Jelly", "of Bad Weather", "of the Arc", "of the Spark-Gap"] },
  { theme: "void", prefixes: ["Hollow", "Unlit", "Starless", "Absent", "Struck-out"], suffixes: ["of the Missing Word", "of the Dark", "of Nothing Much", "of Emptied Hands"] },
  { theme: "venom", prefixes: ["Bitter", "Festering", "Stinging", "Sallow", "Spored"], suffixes: ["of the Stinger", "of Grave Mould", "of Sallow's Jar", "of the Acid Bed"] },
  { theme: "arcane", prefixes: ["Luminous", "Inscribed", "Chorded", "Wakeful", "Dreaming"], suffixes: ["of the Name", "of the Chord", "of Waking", "of the Dream"] },
  { theme: "force", prefixes: ["Heavy", "Shoving", "Kneeling", "Toppling", "Weighty"], suffixes: ["of the Slam", "of the Shove", "of Knees", "of the Falling Shelf"] },
  { theme: "armor", prefixes: ["Bricked", "Plated", "Mortared", "Riveted"], suffixes: ["of Good Mortar", "of the Anvil", "of Stone Folds"] },
  { theme: "maxHealth", prefixes: ["Hale", "Hearty", "Stout", "Well-fed"], suffixes: ["of Bread and Salt", "of the Long Bed", "of Rising After"] },
  { theme: "maxMana", prefixes: ["Deep", "Brimming", "Wellspring", "Lamp-full"], suffixes: ["of the Well", "of the Deep Breath", "of the Brim"] },
  { theme: "healthRegen", prefixes: ["Mending", "Grafted", "Knitting"], suffixes: ["of the Mercy Candle", "of With Thanks", "of Mending"] },
  { theme: "manaRegen", prefixes: ["Breathing", "Tidal", "Refilling"], suffixes: ["of the Tide", "of the Breath In", "of Candle-Stubs"] },
  { theme: "spellPower", prefixes: ["Potent", "Resounding", "Weighted", "Loud"], suffixes: ["of Consequence", "of the Mouthpiece", "of Great Weight"] },
  { theme: "castSpeed", prefixes: ["Quick", "Ticking", "Hurried", "Escapement"], suffixes: ["of the Hours", "of the Balance Wheel", "of No Time"] },
  { theme: "moveSpeed", prefixes: ["Fleet", "Scurrying", "Hare-footed", "Light"], suffixes: ["of the Rat", "of the Rope Walk", "of Running Away"] },
  { theme: "critChance", prefixes: ["Keen", "Precise", "Inspecting", "Pointed"], suffixes: ["of the Lens", "of the Long S", "of the Stamp"] },
  { theme: "lightRadius", prefixes: ["Candlelit", "Lantern-bright", "Lumen", "Beaming"], suffixes: ["of the Vigil", "of Lumen", "of the Long Candle"] },
  { theme: "stealth", prefixes: ["Hushed", "Quiet", "Felted", "Hiding"], suffixes: ["of the Hush", "of the Cupboard", "of Soft Steps"] },
  { theme: "luck", prefixes: ["Lucky", "Gambler's", "Veiled", "Blessed"], suffixes: ["of the Eleventh Face", "of Good Odds", "of the Hollow Coin"] },
  { theme: "jumpPower", prefixes: ["Springing", "Wound", "Leaping"], suffixes: ["of the Mainspring", "of the Rim Steps", "of Rising After"] },
  { theme: "lifeOnKill", prefixes: ["Feasting", "Tallowed", "Rendering"], suffixes: ["of the Vat", "of the Ghoul", "of Second Helpings"] },
  { theme: "manaOnKill", prefixes: ["Wick-trimming", "Snuffing"], suffixes: ["of Pinched Wicks", "of the Last Breath"] },
  { theme: "projectile", prefixes: ["Volleying", "Twinned", "Scattering", "Flocking"], suffixes: ["of the Folio Swarm", "of Many Hands", "of the Volley"] },
  { theme: "statusChance", prefixes: ["Lingering", "Clinging", "Seeping"], suffixes: ["of Stains", "of the Tick", "of Grave Mould"] },
  { theme: "knockback", prefixes: ["Toppling", "Bowling", "Shouldering"], suffixes: ["of the Mouthpiece", "of the Coal Cart", "of the Toll"] },
  { theme: "thorns", prefixes: ["Barbed", "Thorned", "Stinging"], suffixes: ["of the Trellis", "of the Guard", "of Nettles"] },
  { theme: "resist", prefixes: ["Warded", "Sheltered", "Proofed"], suffixes: ["of the Cupped Hands", "of Keeping", "of the Lee Side"] },
];

/** Consumables sold in Kneel (not tied to a stratum). */
export const VILLAGE_CONSUMABLES: ConsumableName[] = [
  { id: "healing_draught", name: "Sallow's Bitter Draught", kind: "potion", flavor: "If it's bitter, it's working. It's very bitter.", effect: "Heal." },
  { id: "mana_draught", name: "Lamp-Oil Tonic", kind: "potion", flavor: "Not actually lamp oil. Mother Sallow says. Mostly.", effect: "Restore mana." },
  { id: "oil_flask", name: "Oil Flask", kind: "flask", flavor: "Label reads: DON'T DRINK. In Mother Sallow's hand, underlined twice.", effect: "Throw: oil pool." },
  { id: "fire_flask", name: "Fire Flask", kind: "flask", flavor: "An oil flask with opinions.", effect: "Throw: burning oil pool." },
  {
    id: "waking_bell",
    name: "The Waking Bell",
    kind: "bell",
    flavor: "A handbell cast with a filing from the old bell's lip. Ring it and the dreamer stirs, just enough for you to slip out.",
    effect: "Ascend from any floor, banking loot (not counted as progress).",
  },
  { id: "waking_salts", name: "Waking Salts", kind: "charm", flavor: "From the unlabelled jar. Hartshorn, lumen, rime and a breath of the rim at dawn.", effect: "Clears stunned, feared and frozen; brief immunity to them." },
  { id: "pocket_stone", name: "Pocket Stone", kind: "charm", flavor: "A pebble off the rim, given at the send-off. So you've something of ours to bring back.", effect: "No effect. Carried home, it counts." },
];
