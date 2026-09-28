import type { DeathCause, LoadingQuote, VillageSecret } from "./types";

/* ─────────────────────────────────────────────────────────────────────────────
 * SECRET TRIGGER GRAMMAR
 *
 *   trigger  := step (" > " step)*          steps must happen in order, in one
 *                                            village visit
 *   step     := cond ("+" cond)*            all conds true at the same moment
 *   cond     := kind ":" args ["~" N "s"] ["*" N] ["@night"]
 *
 *   interact:<object>          press E at a village object / zone
 *   cast:<element>@<object>    a spell of <element> hits <object>
 *   stand:<zone>               standing inside <zone>  (~Ns = for N seconds)
 *   carry:<item>               <item> is in the inventory
 *   talk:<npc>                 dialogue opened with <npc>
 *   unequipped                 no gear in any slot
 *   depth>=N                   deepest floor ever reached ≥ N
 *   died_on:N                  has died on floor N at least once
 *   deaths>=N                  total deaths ≥ N
 *   kits_used>=N               Quartermaster kits borrowed ≥ N
 *   not:secret:<id>            that secret has NOT been found
 *   *N                         repeat the cond N times in one visit
 *   @night                     only during the village's night phase
 *
 * Object / zone ids the village map must provide:
 *   bell, little_well, robe_fold, neck_shrine, fog_edge, memorial_wall,
 *   long_candle, tanners_13, founders_plinth, colossus_thumb, grain_scale,
 *   chandlery_drawing, ash_step_pyre, stump_window_chair, rope_walk_cairn,
 *   hask_ledger, pell_pincushion, vey_dice
 * Items: iron_clapper (key item, rare in a drowned lockbox, floors 11–20),
 *   grave_tallow, pocket_stone_found (the dead delver's pocket stone — every
 *   Reliquary contains one).
 * NPC ids: see npcs.ts (the_chandler, tibb …).
 * ───────────────────────────────────────────────────────────────────────── */

/** Said at the rim on every descent. */
export const RIM_WORDS = { sender: "Kneel low.", reply: "And rise after." } as const;

/** The children's counting-out rhyme. It lists the ten strata in order. */
export const COUNTING_RHYME = {
  lines: [
    "One is a candle and one is a spade,",
    "Two is a letter the water unmade,",
    "Three is a song with no singer inside,",
    "Four is a hammer that tried and it tried,",
    "Five is a honeycomb, sticky and sweet,",
    "Six is a hymn with the snow on its feet,",
    "Seven's a garden that grows you a face,",
    "Eight is a clock that is turning the place,",
    "Nine is the dark, so hide, little one,",
    "Ten is back home, and the counting is done —",
  ],
  outro: "out goes you.",
  /** Tibb sings these only to a delver who has reached floor 91. */
  secretLines: ["Eleven is us, on our knees by the hole —", "Twelve is lying down, and it's having a rest."],
} as const;

export const SECRETS: VillageSecret[] = [
  {
    id: "clapperless_bell",
    name: "The Clapperless Bell",
    location: "The Bell Tower, east of the Market Ring",
    trigger: "cast:storm@bell",
    reward: {
      kind: "lore",
      id: "lore_bell_night",
      text: "Bell Night. Sixty-odd years ago the Chandler of the day, Wenna Quell, climbed this tower at midnight with a copper rod and a theory, and rang the bell with lightning. Every candle in the Chandlery leaned toward the pit and stayed leaning until dawn. In the morning the Giant's left little finger was curled a thumb's width further than the Order's drawing. Wenna was never seen again. Her candle is still lit. The Keepers took the clapper out that week. The Order has not agreed about anything since.",
    },
    extraRewards: [{ kind: "title", id: "title_bellringer", text: "Bellringer" }],
    discoveryText: "The bell speaks for the first time in sixty years. Somewhere behind you, stone grinds against stone. Every candle in Kneel leans toward the pit.",
  },
  {
    id: "clapper_rehung",
    name: "A Tongue for the Bell",
    location: "The Bell Tower",
    trigger: "carry:iron_clapper+interact:bell+not:secret:clapper_returned",
    reward: { kind: "title", id: "title_waker", text: "Waker" },
    extraRewards: [{ kind: "cosmetic", id: "lantern_bell_bronze", text: "Lantern: Bell-Bronze. A warm, filed-bright glow. Wakers will knock twice when you pass." }],
    discoveryText: "You hang the iron clapper. The bell doesn't ring — not yet. But the rope is back, and it is waiting, and everyone in Kneel knows who put it there.",
  },
  {
    id: "clapper_returned",
    name: "Returned to the Hush",
    location: "The Chandlery",
    trigger: "carry:iron_clapper+talk:the_chandler+not:secret:clapper_rehung",
    reward: { kind: "title", id: "title_keeper", text: "Keeper of the Hush" },
    extraRewards: [{ kind: "cosmetic", id: "dye_hush_grey", text: "Robe dye: Hush Grey. The colour of a finger laid across the lips." }],
    discoveryText: "The Chandler takes the clapper in both wax-gloved hands and holds it for a long time. 'Thank you,' they say. 'It's very tired. Let it sleep a little longer.'",
  },
  {
    id: "whispering_well",
    name: "The Well That Whispers Back",
    location: "The Little Well, Well Lane",
    trigger: "interact:little_well@night",
    reward: {
      kind: "lore",
      id: "lore_absaloms_ledger",
      text: "From the ledger of Absalom Quell, forty-one years of what the Little Well says at night. 'Tell Mam I kept the stone.' 'It's so warm down here.' 'Which side of the door is this?' 'I can still hear myself.' 'Is it heavy?' 'Olly, olly.' 'Kneel low, kneel low, kneel low.' And, eleven times, in eleven different years, in a voice Absalom describes only as 'very large and trying to be quiet': 'Is it morning?'",
    },
    discoveryText: "You lean over the stones. From far down, in a voice you almost know, the well repeats the last words of the last delver who died.",
  },
  {
    id: "robe_stair",
    name: "The Stair in the Robes",
    location: "The Robe Fold, behind the Colossus' left knee",
    trigger: "cast:force@robe_fold > interact:neck_shrine",
    reward: {
      kind: "lore",
      id: "lore_the_neck",
      text: "The Neck. The stair inside the robe folds was cut by hands older than Kneel's, worn into dips by feet older than that. At the top, the Giant's neck ends smooth and round, like a wrist — set down, not broken. On it: a stone cup, a ring of pocket stones worn smooth as eggs, and words cut around the rim in the oldest script anyone has seen: IT IS ONLY SLEEPING. Pocket stones are older than Kneel. From up here you can see the fog on every side, very close.",
    },
    extraRewards: [{ kind: "title", id: "title_climber", text: "Who Climbed the Giant" }],
    discoveryText: "The rubble shifts. Behind it, a stair goes up into the stone folds, steps worn hollow by other people's feet.",
  },
  {
    id: "fog_road",
    name: "The Road Out",
    location: "Any fog edge",
    trigger: "stand:fog_edge@night+carry:grave_tallow",
    reward: {
      kind: "lore",
      id: "lore_the_road_out",
      text: "The Road Out. With tallow in your pocket the fog lets you further than usual — far enough to find a signpost. It has four arms. Every arm points back the way you came and says KNEEL. The distances are painted underneath: 1 mile, 1/2 mile, 100 yds, and on the last arm, in fresher paint, HERE. Walk on and you are in the market again, facing the Giant, with the smell of the Stump. The signpost is not on any map. Several of the Wakers' lost marker stakes are stacked neatly at its foot.",
    },
    extraRewards: [{ kind: "cosmetic", id: "lantern_fog_grey", text: "Lantern: Fog-Grey. It lights about as far as the fog lets anything." }],
    discoveryText: "The fog thins around your tallow like breath on cold glass. There's a signpost ahead. All of its arms point home.",
  },
  {
    id: "memorial_name",
    name: "Your Name on the Wall",
    location: "The Memorial Wall, along the rim path",
    trigger: "interact:memorial_wall+deaths>=1",
    reward: { kind: "title", id: "title_remembered", text: "Remembered" },
    discoveryText: "There, between two strangers, in chalk: your name. The Widow Ferrow has corrected the spelling. You are standing in front of it, alive, which the Wall does not seem to mind.",
  },
  {
    id: "long_candle",
    name: "The Long Candle",
    location: "The Chandlery, top shelf",
    trigger: "interact:long_candle+depth>=20",
    reward: {
      kind: "lore",
      id: "lore_the_first_candle",
      text: "The First Candle. The Chandler lets you hold it. It is warm all the way down, not from the flame. It has never been measured shorter; the string is kept in a drawer and is always the same. Scratched into the wax, where every other candle has a name, is not a name but a shape: a figure, kneeling, head bowed so low it is not there. It is the oldest delver's candle in Kneel. It is lit for the first one who went down. It has never gone out, so they are not dead.",
    },
    discoveryText: "The Chandler climbs the ladder, lifts it down with both hands, and gives it to you without a word. It is heavier than a candle has any right to be.",
  },
  {
    id: "thirteenth_door",
    name: "Number Thirteen, Tanner's Row",
    location: "Tanner's Row, the door with no handle",
    trigger: "interact:tanners_13+died_on:13",
    reward: {
      kind: "lore",
      id: "lore_number_thirteen",
      text: "Number Thirteen. The door opens inward for you. Inside: one room, dry, swept. A table set for one — bread, salt, a cup. A good chair by the window. On the plate, a letter, still damp at one corner, sealed with a stooping figure, addressed To whoever lives at Number Thirteen, Tanner's Row, Kneel. The same letter lies in a drawer on floor 13, in a town that drowned before Kneel was built. The cellar door is stuck. Lift it as you pull.",
    },
    extraRewards: [{ kind: "cosmetic", id: "dye_drowned_ink", text: "Robe dye: Drowned Ink. Black with a blue sheen, like a page under water." }],
    discoveryText: "The door with no handle swings open as you touch it, as if somebody on the other side had been waiting for someone who'd drowned on thirteen.",
  },
  {
    id: "empty_plinth",
    name: "No Beginnings",
    location: "The Founders' Plinth, Market Ring",
    trigger: "stand:founders_plinth~10s@night",
    reward: {
      kind: "lore",
      id: "lore_no_beginnings",
      text: "No Beginnings. The plinth has been empty for as long as anyone can say; 'taken down for cleaning', they say. Kneel has no year one, no founders' names, no first page. At night, if you stand on it long enough, the fog comes in off the edges and gathers beside you into a figure, kneeling, the size of a person, with no head. It stays until you step down. The dream does not remember beginnings. It seems to remember this.",
    },
    extraRewards: [{ kind: "title", id: "title_founder", text: "Founder" }],
    discoveryText: "The fog creeps in and kneels beside you on the plinth. It has no head. It doesn't seem to need one.",
  },
  {
    id: "warm_thumb",
    name: "Warm Stone",
    location: "The Thumb — the Colossus' left thumb, resting on the rim",
    trigger: "stand:colossus_thumb~20s@night",
    reward: {
      kind: "lore",
      id: "lore_warm_stone",
      text: "Warm Stone. On a cold night the Giant's thumb is warm under your boots — warmer than the day was. Stand still and count. At about twenty, through your soles, something moves: a single slow beat, like a door closing a very long way off. Then twenty more, and another. Tibb has timed it. The Order has timed it. It has not changed in all the years anyone has been counting. Carved statues do not keep time.",
    },
    extraRewards: [{ kind: "cosmetic", id: "trail_heat_shimmer", text: "Trail: Heat Shimmer. The air behind you bends a little, like over warm stone." }],
    discoveryText: "Nineteen. Twenty. Through the soles of your boots, once, very slowly: a heartbeat.",
  },
  {
    id: "honest_scale",
    name: "What a Person Weighs",
    location: "The grain scale, Market Ring",
    trigger: "stand:grain_scale+unequipped",
    reward: {
      kind: "lore",
      id: "lore_what_a_person_weighs",
      text: "What a Person Weighs. The scale's weights are marked in floors, not pounds: the Well takes you as deep as you are heavy, and what it weighs is the deeds in your gear. Stand on it with nothing — no staff, no ring, no hood — and by rights the needle should sit at nothing. It doesn't. It swings all the way past the last mark and hits the stop with a clang the whole market hears. Nobody has ever been able to say what that means. Hask just nods.",
    },
    extraRewards: [{ kind: "title", id: "title_unburdened", text: "Unburdened" }],
    discoveryText: "The beam swings past every mark and slams into the stop. Across the market, people look up, and then carefully look away.",
  },
  {
    id: "eleventh_line",
    name: "Eleven and Twelve",
    location: "Tibb, on the rim steps",
    trigger: "talk:tibb+depth>=91",
    reward: {
      kind: "lore",
      id: "lore_eleven_and_twelve",
      text: "Eleven and Twelve. 'One is a candle and one is a spade…' — the rhyme counts the strata in order, all the way to Ten, which is back home. Tibb knows two more lines, and sings them very quietly: 'Eleven is us, on our knees by the hole — / Twelve is lying down, and it's having a rest.' It doesn't rhyme. Tibb says it isn't supposed to. 'Twelve doesn't have to rhyme. It's lying down.'",
    },
    extraRewards: [{ kind: "title", id: "title_counted", text: "Counted" }],
    discoveryText: "Tibb looks at you for a long time, then beckons you close and sings two more lines. Then she goes back to counting.",
  },
  {
    id: "little_finger",
    name: "The Little Finger",
    location: "The Chandlery's back-wall drawing, then the Thumb",
    trigger: "interact:chandlery_drawing > stand:colossus_thumb",
    reward: {
      kind: "lore",
      id: "lore_the_little_finger",
      text: "The Little Finger. The drawing on the Chandlery's back wall is older than the Order: the Giant, careful and exact, every fold of the robe, every knuckle. In it, the left little finger lies straight along the others. From the Thumb, look along the hand. It isn't straight. It's curled — a thumb's width, maybe two. There are chisel marks nowhere. Stone doesn't bend. Something has moved, a little, and nobody saw it happen.",
    },
    discoveryText: "You look from memory to stone and back. In the drawing, the little finger is straight.",
  },
  {
    id: "ash_step_smoke",
    name: "Up, For Once",
    location: "The Ash Step pyre, south rim",
    trigger: "cast:fire@ash_step_pyre@night",
    reward: {
      kind: "lore",
      id: "lore_up_for_once",
      text: "Up, For Once. Kneel burns its dead and lets the wind take them 'up, for once', because Bowe buried theirs and look how that went. By day the pyre smoke goes up like any smoke. Light the cold pyre at night and watch: the smoke rises a man's height, stops, thinks about it, and pours over the edge of the rim and down into the Well, like water finding its level. Kneel doesn't burn its dead at night. Now you know why.",
    },
    extraRewards: [{ kind: "cosmetic", id: "sigil_falling_smoke", text: "Sigil: Falling Smoke. A thin grey plume that drifts downward from your cast hand." }],
    discoveryText: "The smoke rises, hesitates, and then pours over the rim and down into the pit.",
  },
  {
    id: "empty_chair",
    name: "The Chair by the Window",
    location: "The Stump",
    trigger: "interact:stump_window_chair@night+deaths>=3",
    reward: {
      kind: "lore",
      id: "lore_the_chair_by_the_window",
      text: "The Chair by the Window. Nobody sits in it. Merrow won't say why, except to people who have died enough times to count as regulars. It was Wenna Quell's chair. The night she rang the bell, she left her cup on the sill and said she'd be back in a minute. Her candle is still lit. So on some nights, for some people, Merrow pours two cups of salted water, and puts one in front of the empty chair, and leaves it there till morning. In the morning it's always half gone.",
    },
    extraRewards: [{ kind: "title", id: "title_company", text: "Company" }],
    discoveryText: "Merrow looks at you, at the chair, at you again. Then two cups come down on the table, and one is pushed in front of nobody.",
  },
  {
    id: "pocket_cairn",
    name: "Stone-Carrier",
    location: "A cairn on the Rope Walk",
    trigger: "carry:pocket_stone_found+interact:rope_walk_cairn",
    reward: { kind: "title", id: "title_stone_carrier", text: "Stone-Carrier" },
    extraRewards: [{ kind: "cosmetic", id: "dye_rim_grey", text: "Robe dye: Rim Grey. The colour of a pebble someone carried a long way." }],
    discoveryText: "You set someone else's pocket stone on the cairn. It clicks into place as if the gap had always been there. Somebody has something of ours to bring back, after all.",
  },
  {
    id: "lending_ledger",
    name: "The Lending Ledger",
    location: "The Lending House counter",
    trigger: "interact:hask_ledger+kits_used>=5",
    reward: {
      kind: "lore",
      id: "lore_the_lending_ledger",
      text: "The Lending Ledger. Hask's ledger is leather gone black with hands. The recent pages are yours and your neighbours'. Turn back far enough and the ink changes colour, then the script, then the spelling. 'O. Quell — Archive Kit — returned wet.' 'I. Fenwright — Foundry Kit — returned by itself, warm.' 'T. Rook — Garden Kit — kept the hat.' 'Olly F. — Unlit Kit — not yet returned.' Every entry is in the same handwriting. Hask's.",
    },
    discoveryText: "Hask pushes the ledger across the counter and looks at the ceiling while you read it.",
  },
  {
    id: "pells_guess",
    name: "Pell's Guess",
    location: "Pell & Needle, the pincushion on the counter",
    trigger: "interact:pell_pincushion+depth>=100",
    reward: { kind: "cosmetic", id: "hood_pells_guess", text: "Hood: Pell's Guess. A plain grey hood with a face stitched on the inside, eyes closed. Pell got the nose right." },
    discoveryText: "Pell holds up the pincushion head next to your face and waits. 'Well?' Pell murmurs. 'Did I get the nose right?'",
  },
  {
    id: "house_face",
    name: "The Eleventh Face",
    location: "The Hollow Coin, Mistress Vey's table",
    trigger: "interact:vey_dice*11@night",
    reward: { kind: "title", id: "title_the_house", text: "The House" },
    discoveryText: "On the eleventh throw the die lands on the blank face. Mistress Vey closes her book. 'Well,' she says. 'Now you're the house, darling. Don't let it go to your head.'",
  },
];

/** Memorial Wall epitaphs. Placeholders: {name} {floor} {cause}.
 * {cause} is a noun phrase: a creature's name with article ("a Grave Rat")
 * or a pick from CAUSE_PHRASES. */
export const MEMORIAL_EPITAPHS: string[] = [
  "{name}. Went down to {floor}. Met {cause}. Kneel low.",
  "{name}, floor {floor}. {cause} got there first.",
  "Here we chalk {name}, who went to floor {floor} and did not rise after. ({cause})",
  "{name} — {floor} deep — {cause}. Spelling checked by the Widow Ferrow.",
  "{name}. Floor {floor}. Brave or foolish; {cause} didn't ask which.",
  "{name} met {cause} on floor {floor}. The wick's pinched. The stub's in someone else's candle now.",
  "{name}: {floor} breaths deep, undone by {cause}. Nobody watched them go. That's manners.",
  "For {name}, floor {floor}, {cause}. Bread and salt were waiting. They'll keep.",
  "{name}. {floor}. {cause}. Heavy as they were.",
  "{name} went to {floor} for glory, fame and riches, and found {cause} instead. Chalked with love.",
];

/** Noun phrases for {cause} when the killer isn't a named creature. */
export const CAUSE_PHRASES: Record<DeathCause, string[]> = {
  creature: ["something with teeth"],
  warden: ["a warden"],
  trap: ["a trap", "a floor that clicked", "somebody else's cleverness"],
  delver: ["another delver", "a stranger's lantern", "a broken pact"],
  fall: ["a long drop", "the dark between floors"],
  fire: ["fire", "a bad idea and some oil"],
  frost: ["the cold", "a very long winter"],
  storm: ["lightning", "wet feet and bad weather"],
  venom: ["poison", "a slow bitterness"],
  void: ["the void", "nothing, in the end"],
  drown: ["the water", "the Archive's patience"],
  explosion: ["a bang", "a barrel with opinions"],
  crushed: ["something heavy", "a falling shelf"],
  bleeding: ["a slow wound"],
  self: ["their own spell", "their own worst idea"],
  unknown: ["the Well"],
};

/** Death screen: what the dream says when you die. The dream asks. */
export const DEATH_LINES: Record<DeathCause, string[]> = {
  creature: [
    "Was it hungry? It seemed hungry.",
    "Did it hurt? I've always wanted to know what that's like.",
    "It knows your name now. Did you know its?",
    "You were so close to it. Was it warm?",
    "It was only doing what I dreamed it to do. Are you cross with me?",
  ],
  warden: [
    "They've been waiting a very long time. So have I.",
    "You met someone I remember. Did they ask you anything?",
    "They were sorry, afterwards. They're always sorry, afterwards.",
    "They were trying to reach me too. Did you notice?",
  ],
  trap: [
    "Someone built that for someone else. Isn't that sad?",
    "The floor asked you to step there. You did. Why?",
    "Click. Did you hear it? I heard it.",
    "It was so patient, waiting for you. Were you patient?",
  ],
  delver: [
    "Another one like you did that. Why would they?",
    "You were two, and then you were one. Which one were you?",
    "They'll have your things now. Is that what things are for?",
    "Did you raise your palm? Did they?",
  ],
  fall: [
    "Where did you think you were going?",
    "Down is where everyone goes. You went quickly.",
    "Falling is only going somewhere without asking first.",
  ],
  fire: [
    "Was it bright? It's so dark down here.",
    "You were very warm for a moment. I felt it.",
    "Everyone brings fire. Nobody asks if I'm cold.",
  ],
  frost: [
    "You held still at last. Everyone does, here.",
    "Are you finished?",
    "It was very quiet. Did you like the quiet?",
  ],
  storm: [
    "The water carried it to you. Water carries everything to me.",
    "Bright, and then not. Is that what lightning is for?",
    "You were standing in the wrong place. How do you know which place is right?",
  ],
  venom: [
    "It was in you before you knew. Like a question.",
    "Bitter. Is everything up there bitter?",
    "Slowly, then all at once. That's how I fell asleep too.",
  ],
  void: [
    "Where did you go? I looked.",
    "Something took the middle out of you. It happens. It happened to me.",
    "You weren't there, and then you weren't anywhere. Is that what it's like?",
  ],
  drown: [
    "What is my name? You were close. You had your mouth open.",
    "The water rose. It always rises. Why do you stay?",
    "So quiet under there. Did you hear anyone?",
  ],
  explosion: [
    "That was loud. Nobody down here is loud any more.",
    "All of you, all at once, everywhere. Was that on purpose?",
    "Things want to be in pieces. Do you?",
  ],
  crushed: [
    "Is it heavy? I always wondered.",
    "Something very large leaned on something very small. I know how that goes.",
  ],
  bleeding: [
    "You left a line of yourself behind. I'll follow it later.",
    "A little at a time. Did you notice when it started?",
  ],
  self: [
    "You did that to yourself. I understand. I did too.",
    "Your own light. Your own hand. Why?",
    "Was it an accident? Were you asking something?",
  ],
  unknown: [
    "Something happened. I wasn't watching. I'm sorry. I'm always sleeping.",
    "I'll keep your things. I keep everything. Will you come back for them?",
    "Where did you think you were going?",
  ],
};

/** Shown on Ascend (returning to Kneel through a Descent). */
export const ASCEND_LINES: string[] = [
  "You wake with the taste of pennies, and someone is saying your name.",
  "Kneel low. And rise after. You rise.",
  "The dream lets go of your sleeve, one finger at a time.",
  "Somebody puts bread in your hand before you remember you have hands.",
  "The Giant's shadow. The market. The smell of the Stump. No questions till morning.",
  "Up, for once.",
  "The Well has tasted you, and found you worth letting go. For now.",
  "Fog, then the rim steps, then Tibb, counting you.",
  "Your candle is still lit. You can feel it from here.",
  "Heavier than you went. That's the idea.",
];

/** Shown when a Waking Bell is rung. */
export const WAKING_BELL_LINES: string[] = [
  "You ring the bell. Far above, something enormous half-opens an eye, and you slip out through the gap.",
  "A small bright note. The whole dream flinches. You're through before it settles.",
  "The dreamer stirs, mutters something that might be a question, and turns over. You're home.",
  "Ding. Somewhere, a little finger twitches.",
];

/** A freed bound dreamer (ghost of a fallen delver) says one of these. */
export const FREED_DREAMER_LINES: string[] = [
  "Tell Merrow I'm sorry about the chair.",
  "Is it morning yet? No? Then I'll help. Just this floor.",
  "I kept the stone. Tell my nan I kept the stone.",
  "I went further than this, you know. Once. Then I came back to wait.",
  "Kneel low. I'll do the rising after.",
  "Don't answer it. Whatever it asks. Or — do. I never decided.",
  "My candle's still lit? Oh. Oh, that's nice.",
];

/** Loading-screen quotes. */
export const LOADING_QUOTES: LoadingQuote[] = [
  { text: "Kneel low. — And rise after.", source: "said at the rim" },
  { text: "No questions till morning.", source: "the only law in Kneel" },
  { text: "The Well takes you as deep as you are heavy.", source: "Old Hask" },
  { text: "The dream keeps what it touches.", source: "the Candle Order" },
  { text: "A light for each who goes down.", source: "over the Chandlery door" },
  { text: "If it's bitter, it's working.", source: "Mother Sallow" },
  { text: "I don't believe in God. I believe in tolerances.", source: "Brannoc Two-Thumbs" },
  { text: "Certainty is terrible for business.", source: "Mistress Vey" },
  { text: "A robe and a shroud are the same garment. One of them has better pockets.", source: "Pell" },
  { text: "Kits have never once been late. Borrowers often have.", source: "Terms of Lending" },
  { text: "The tall candles are careful. The short ones are brave. The guttering ones are both.", source: "the Chandler" },
  { text: "Eleven went down today and thirteen came up. I counted twice.", source: "Tibb" },
  { text: "Dying's not the end, down there. It's just very, very rude.", source: "Dunny Rook" },
  { text: "If you hear your own name down there, don't answer.", source: "Absalom Quell" },
  { text: "Rats go for whoever's bleeding, not whoever's closest.", source: "a receipt, folded small" },
  { text: "The skull-rows shoot at anything that moves. Throw an urn first.", source: "a delver's receipt" },
  { text: "Don't wade. The tall blind ones hear it.", source: "D. Rook, chalk" },
  { text: "Paper burns like a bad idea.", source: "D. Rook, chalk" },
  { text: "Hum something stupid.", source: "the hermit" },
  { text: "Water cracks the numbered ones if they're hot.", source: "carved on a coal cart" },
  { text: "The little sparks go for the oil drums, and then they go for you.", source: "carved on a coal cart" },
  { text: "Don't light anything in the long rooms.", source: "Hask, about the Liturgy" },
  { text: "Walk slowly in the half-dark, as if you are going somewhere ordinary.", source: "an elder of Turn" },
  { text: "Everything down here was a gift once.", source: "the Red Garden" },
  { text: "Nobody watches a delver go in. It's rude.", source: "Kneel custom" },
  { text: "Don't make the Well a promise.", source: "Kneel saying" },
  { text: "It'll come out in the breathing.", source: "Kneel saying" },
  { text: "Bread's for the living, candles for the rest.", source: "Kneel saying" },
  { text: "The Giant's got no head for sums.", source: "Kneel saying" },
  { text: "Pressure plates respond to weight, not to delvers. Rats are light. Sextons aren't.", source: "the Delvers' Hall noticeboard" },
  { text: "Fire and spores: once. Fire and oil: for a while. Storm and water: everyone in it.", source: "the Delvers' Hall noticeboard" },
  { text: "Stitches are just very small promises.", source: "Pell" },
  { text: "One is a candle and one is a spade.", source: "a children's rhyme" },
  { text: "It knelt because it was tired.", source: "the Keepers of the Hush" },
  { text: "Knock twice.", source: "the Wakers" },
  { text: "Where did you think you were going?", source: "carved over a stair" },
];
