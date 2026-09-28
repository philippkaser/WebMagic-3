import type { LoreNote } from "./types";

/** Readable notes. stratum: -1 = Kneel, 0..9 = strata. 40–160 words each.
 * They reveal the truth a little at a time and do not always agree. */
const KNEEL_NOTES: LoreNote[] = [
  // ── Kneel ────────────────────────────────────────────────────────────────
  {
    id: "v_order_primer",
    stratum: -1,
    title: "Primer of the Candle Order, first leaf",
    author: "The Candle Order",
    text: "Our forebears came to the rim with a spade and a candle apiece. God had gone down into the earth, and the hole was still there to prove it. In sorrow and in honour they carved the Giant kneeling, that God might look up one day and know we were sorry. It took them a hundred years. They buried their dead beneath the rim to lie nearer to God. That is the Undercroft. We do not bury any longer. We keep a light instead, one for each who goes down, and we do not ask where they are going. Learn this leaf by heart. The second leaf is for later.",
  },
  {
    id: "v_hall_rules",
    stratum: -1,
    title: "Rules of the Delvers' Hall (nailed by the stove)",
    author: "The Hall",
    text: "1. No questions till morning. This means you. 2. Do not bring anything back that is still moving. 3. Stash chests are not coffins. Stop sleeping in them. 4. Wet boots go by the stove, not on it. 5. If you hear a second heartbeat in the bunks, it is Dunny. Wake him and send him home. 6. Do not answer anything that talks in your sleep, including your bunkmate. 7. Bread and salt are free to the returned. Merrow means the returned from the Well, not from the privy. 8. Kneel low.",
  },
  {
    id: "v_stall_tally",
    stratum: -1,
    title: "Chalk on the back of a market stall",
    author: "J. F.",
    text: "Gran's time: 40 stalls. Mam's time: 36. Mine: 31. Nobody sold the other nine. Nobody moved them. Ask anyone where the Cobbler's pitch went and they'll say 'it was always a bit foggy over that side'. The marker stakes on the south road: I put out twelve last spring. There are eleven. Nobody stole one. There's just less road. The fog isn't weather. It's an edge. It's closing like a hand. Kneel is the eleventh. You can count. Count.",
  },
  {
    id: "v_hush_tract",
    stratum: -1,
    title: "Let It Sleep (a tract, left on the Stump's tables)",
    author: "The Keepers of the Hush",
    text: "It knelt because it was tired. When your mother falls asleep in her chair after forty years of your asking, do you shake her? The peoples below exist only while it dreams them. Wake it, and you bury ten villages at once, properly this time. And consider: a god that wakes stands up. We live beneath its hands. Ask yourself what it is holding, and whether you would like it to let go. Keep your candle low. Go down if you must — a dreamer with something new to dream about sleeps soundly. Come back up. Say nothing to the dark.",
  },
  {
    id: "v_waker_tract",
    stratum: -1,
    title: "A Knock at the Door (a tract, pushed under doors)",
    author: "the Wakers",
    text: "Ten villages went down that Well before us. Not to death: into a dream. They are in there still, doing the same thing forever. The Keepers call that keeping them. We call it a cupboard. The fog comes closer every year. Our cellars break into older cellars with our own floor plans. The children count to eleven and don't know why. We are next, friends, and when we go down, the Keepers will light a candle for us and call it kindness. It knelt to ask us something. It has been waiting a very long time. Somebody should go and let it. Knock twice.",
  },
  {
    id: "v_tibbs_slate",
    stratum: -1,
    title: "A child's slate, left on the rim steps",
    author: "Tibb",
    text: "ONE is a candle and one is a spade. TWO is a letter the water unmade. THREE is a song with no singer inside. FOUR is a hammer that tried and it tried. FIVE is a honeycomb sticky and sweet. SIX is a him (hymn) with the snow on its feet. SEVEN's a garden that grows you a face. EIGHT is a clock that is turning the place. NINE is the dark so hide little one. TEN is back home and the counting is done. OUT GOES YOU. Down today: 11. Up today: 13. (i counted twice)",
  },
  {
    id: "v_waking_bell_invoice",
    stratum: -1,
    title: "Invoice, The Cinder Bench",
    author: "B. Two-Thumbs",
    text: "To: M. Sallow (for the usual friends). Six (6) handbells, cast, bronze. One (1) filing each, bell-metal, from the lip of the tower bell, taken at night, don't ask. Six (6) clappers, wrapped in stilled breath, which is a sentence I never thought I'd write. Salts: supplied by customer. Total: a great deal. Note: the lip's getting thin. Another hundred bells and there won't be a bell. Then what? Then you'll have to wake it with a spoon. Paid in full. Don't tell the Chandler.",
  },
  {
    id: "v_vey_odds",
    stratum: -1,
    title: "A page torn from Mistress Vey's book",
    author: "Mistress Vey",
    text: "Returning from floor 5, first attempt: 3 to 1 against. From floor 10: 5 to 1. Twenty, kitted: 2 to 1, and Hask takes a cut. Delvers with a pocket stone from their mother: shorten by a quarter (sentiment is real; it makes them careful). Delvers who say 'I've got a feeling about this one': lengthen. Reaching the bottom: no odds offered. The house does not bet on things it cannot settle. Eleventh face: for the house. The house does not explain itself either.",
  },
  {
    id: "v_widows_corrections",
    stratum: -1,
    title: "Pinned to the Memorial Wall",
    author: "the Widow Ferrow",
    text: "To whoever keeps chalking names on my wall: it is 'Aldous', not 'Aldus'; 'Merriwether', two Rs; and the Pike girl died on floor 12, not 21, she'd be mortified. Write small and write straight. Leave room. There is always going to be more room needed. I sweep this wall every morning and I will not sweep round spelling. My own name will go up one day and I expect it done properly. FERROW. Two Rs. One W. Thank you.",
  },
  {
    id: "v_chandlery_ledger",
    stratum: -1,
    title: "The Chandlery's oldest ledger, first page",
    author: "unknown hand",
    text: "…and so we lit one for her too. Then one for her brother, who went after her. Then one for the Miller's boy, who went for a bet. The Long Candle we keep on the top shelf and do not name. It was lit before this book. It does not get shorter. We have measured it with string every year, and the string is always the same. We do not know who it is for. We light the others from it. A light for each who goes down. (The page is scorched at the top edge. There was writing above this. There isn't now.)",
  },
  {
    id: "v_stump_slate",
    stratum: -1,
    title: "Slate behind the bar at the Stump",
    author: "Merrow",
    text: "TODAY: Bread (free to the returned). Salt (free to everybody, I'm not a monster). Stew (it's stew). Small beer. Large beer. Dunny's tab: DO NOT. Rules: No questions till morning. No dreams before noon. No sitting in the window chair, and I mean it, Dunstan. If you came up tonight, sit down, eat, and nobody will say a word to you. If you came up with a thing still wriggling in your bag, take it outside first.",
  },
  {
    id: "v_sallow_recipe",
    stratum: -1,
    title: "Recipe card, unlabelled jar",
    author: "O. & M. Sallow",
    text: "WAKING SALTS. Hartshorn, two pinches. Lumen cap, dried, one. Rime crystal, a crumb (it's the cold that does it). A breath of the rim at dawn, caught in the jar and stoppered quick. Shake. Under the nose of anyone who won't wake — the drowsed, the dream-sick, the ones who come up and sit too long by the Well. Do NOT use on the big one. (That line is in Orrin's hand. Under it, in mine: why not?)",
  },
  {
    id: "v_hask_terms",
    stratum: -1,
    title: "Terms of Lending (framed, the Lending House)",
    author: "Old Hask",
    text: "A Kit is light gear: weighed, candled and borrowed. The Well takes you as deep as the Kit, not as deep as you. While kitted you may not sell, stash, drop, trade, pawn, gamble, gift or bury the Kit. Anything you find is yours to lose. When the run ends, the Kit comes home — carried by you or not. A Kit returned by itself is returned folded, damp and on time. Kits have never once been late. Borrowers often have. Sign here.",
  },
];

// ── 0 · The Undercroft (Bowe) ────────────────────────────────────────────────
const UNDERCROFT_NOTES: LoreNote[] = [
  {
    id: "u_depth_tally",
    stratum: 0,
    title: "Scratched on a pillar, at child height",
    author: "Hob, of Bowe",
    text: "MAM 14 FT. DA 19 FT. GRAN 22 FT, she paid extra. AUNTY WENNA 23 FT, she did her own. OUR DOG 19 FT (with Da). ME ___. Da says the deeper you lie the nearer you are, and the nearer you are the better He can hear you. I am going to be the deepest. I am going to be 30 FT. I have been digging on Sundays. Mam says don't, you're alive, but Mam is 14 FT so she would say that.",
  },
  {
    id: "u_rendering_card",
    stratum: 0,
    title: "Card nailed to the rim of a rendering vat",
    text: "For Aunt Wenna — to see by. Render slow. Skim twice. Pour into the moulds with her name scratched in, the long way round, so it burns down through her name last. She'll want to see where she's going. She always did. She was the one who said the stair was too dark. Well, it won't be now, will it, Wenna. Light the first one off Gran's. Put it on the step below Gran's. Keep them going down.",
  },
  {
    id: "u_sexton_accounts",
    stratum: 0,
    title: "Account book of the Sexton of Bowe",
    author: "Hollis Crane",
    text: "Yr 1. Bricked the door. Good mortar. They sang the whole time, then they didn't. Lit the stair. Yr 4. Lit the stair. Rats. Yr 9. Lit the stair. Nobody. Yr 12. The dog died. I did him proper, 30 ft, by the door. Yr 20. Lit the stair. Talked to the door. Yr 31. Lit the stair. Knees bad. I am going down. They will let me in. It was my wall. I know which bricks. (Below, pressed so hard the pen tore the page: IT WON'T GIVE.)",
  },
  {
    id: "u_letter_down",
    stratum: 0,
    title: "A letter left on a coffin lid",
    author: "your mother",
    text: "Dear Tam, your father says the deeper the nearer, and I suppose he'd know, he's been digging since before you were born. You went down ahead of us, which isn't the order things are meant to go in, but you were always quick. I've left your good shoes on the ledge with the laces tied so they don't wander. We'll all be coming down on the Sunday. Keep a candle in the window, if there are windows. Wait at the bottom of the stair. Don't go on without us. Love, Mam.",
  },
  {
    id: "u_stair_orders",
    stratum: 0,
    title: "Standing orders of the Stair-Watch (painted on a board)",
    text: "The dead go down. The living may go down. NOTHING comes up. Anything coming up is not one of ours, whatever it says, whatever it looks like, whatever name it calls you by. It will look like your mother. Your mother is 14 ft and does not come up. Loose on sight. Do not wait for it to ask you anything. It will want to ask you something. Loose before it asks. The Watch does not go down until the stair is shut. The Watch goes down last.",
  },
  {
    id: "u_keener_rates",
    stratum: 0,
    title: "Price list, the Keening House of Bowe",
    text: "Wailing, per hour: 2 bits. Wailing, loud, per hour: 3 bits. Rending of garments (garments supplied): 4 bits. Rending (your garments): 1 bit, you've already paid for them. Keening through the night with candles: 10 bits and supper. Children: no charge. We do not charge for children. We keen for them anyway, whether you ask or not, and we keen longest, and you cannot stop us, so do not try.",
  },
  {
    id: "u_waker_chalk",
    stratum: 0,
    title: "Chalk on a crypt wall, fresh",
    author: "J. F. (a Waker)",
    text: "THE PRIMER IS WRONG. These are not our great-grandparents. Look at the latches: Kneel latches, same as my mam's back door. Look at the names on the skulls: Crane, Wenna, Tam. We have Cranes. Their village was called BOWE, it's on the tally-pillars. They stood where we stand, and they went down, and we built on the lid. Bowe. Kneel. What's lower than kneeling? Don't write it. I'll know if you write it. — J.F.",
  },
  {
    id: "u_delver_receipt",
    stratum: 0,
    title: "A receipt, folded very small",
    author: "a delver from Kneel",
    text: "THE SALLOW JAR — 1 healing draught, 1 oil flask (DON'T drink), 3 bits. LENDING HOUSE — Undercroft Kit, borrowed, 1 day. POCKET STONE — free (from Nan). On the back, in pencil: If found, I owe Merrow for two stews and I'm sorry about the chair. The rats go for whoever's bleeding, not whoever's closest. The skull-rows shoot at anything that moves, so throw an urn first. The candle-men hate water. Tell Nan I kept the stone.",
  },
];

// ── 1 · The Drowned Archive (Stoop) ──────────────────────────────────────────
const ARCHIVE_NOTES: LoreNote[] = [
  {
    id: "a_margins",
    stratum: 1,
    title: "Margins of a single page, four hands",
    text: "(First hand:) Portion 40,112, lines 1–30. Your hand is steadier than mine; don't fret over the long S. (Second:) Thank you. Lines 31–60. There is a biscuit in the drawer. (Third:) The biscuit is a fossil now but I appreciated it. Lines 61–90. The water is at the second rung. (Fourth:) Lines 91–120. The water is at the desk. I have moved the desk up onto the Commentaries. Nobody reads them anyway. Whoever comes next — it's a lovely syllable. You'll see.",
  },
  {
    id: "a_reading_rules",
    stratum: 1,
    title: "RULES OF THE READING ROOM (brass plate)",
    text: "1. Silence. 2. No food, except biscuits kept in the drawer for the next copyist. 3. Do not read ahead of your portion; the Name must come to each of us in order. 4. Do not read behind your portion; it is not yours. 5. Mistakes shall be washed, not scratched. 6. Proctors will attend to noise. 7. Silence. (Someone has scratched a long claw-line through the word QUIET on the sign above. Someone else has written underneath it, very small: sorry.)",
  },
  {
    id: "a_tide_log",
    stratum: 1,
    title: "Log of the Lower Stacks",
    author: "Sub-Librarian Anselm Pike",
    text: "The water has risen one inch. We have raised the desks one inch. Year 12: the desks are on stilts. Year 30: the desks are on the Concordances, which were at least useful for something. Year 51: we work from balconies. Year 60: the balconies are wet. Year 71: rafts. Nobody has proposed stopping. To stop is to lose your place, and your place is a piece of Him. The Proctors report that splashing is up. The Proctors are up to their chests and have never once complained.",
  },
  {
    id: "a_portion_warrant",
    stratum: 1,
    title: "Warrant of Portion",
    text: "Be it recorded that LEFFY QUELL, being seven years of age and of good hand, is this day given the desk of her grandmother and the portion of the Name beginning at the 40,112th syllable and ending at the 40,580th, which she shall write faithfully until she dies, and then pass on. She is not to read the whole. No one is to read the whole. When all portions are complete, the Name will be read aloud once, together, and He will answer to it, as anyone does. (Signed, with a small drawing of a cat, which is not permitted.)",
  },
  {
    id: "a_why_the_water",
    stratum: 1,
    title: "On the Cause of the Rising (a disputation)",
    text: "Magister Voss holds that the cisterns burst. Magister Hale holds that we struck the Well's own water, and that it is rising to meet us because we are close. Sister Imre holds that it is Him crying, because we are writing His name and He has never heard it. (In the margin, another hand: SENTIMENTAL. And under that, a third: But He has never heard it, has He? No one has ever called Him by it. Nobody. Not once. You would cry.) The disputation was not concluded. The water reached the table.",
  },
  {
    id: "a_oddny_drafts",
    stratum: 1,
    title: "Drafts of the Last Line",
    author: "Magister Oddny Quell",
    text: "Draft 1: struck. Draft 2: struck. Draft 40: nearly. Struck. Draft 311: I think it ends softer. They are waiting. Draft 1,009: the water is at my knees. Pike says just write anything, but if the last line is wrong then every portion is wrong and every desk in Stoop was wasted. I will not waste them. Draft 4,400: the water is at my collar. It is very quiet. Nobody is splashing any more. I think I have it. I think it's a question. Struck.",
  },
  {
    id: "a_letter_to_kneel",
    stratum: 1,
    title: "A sealed letter, dry, at the bottom of a flooded drawer",
    text: "Addressed: To whoever lives at Number Thirteen, Tanner's Row, Kneel. Inside: Dear neighbour, we have not met. You will be born a long time after us, on the same spot. When you move in, the door will stick; lift it as you pull. The cellar floods in spring. Keep the good chair by the window. We would have liked to meet you. We think you are the ones who will ask. (Unsigned. The seal is a stooping figure. There is no Tanner's Row in Stoop. There has never been a Kneel in Stoop's time.)",
  },
  {
    id: "a_dunny_warning",
    stratum: 1,
    title: "Chalk on a balcony rail",
    author: "D. Rook",
    text: "DON'T WADE. The tall blind ones hear it. Stand still in the water and they walk right past you, close enough to smell. Wade and they come. The glowy jellies make the pools bite, so if you see one drifting into the water get OUT of the water. Paper burns like a bad idea. The fish-things grab from under the edge. I lost my good boot to one. It's somewhere on 14. Bring it up if you find it. It's a left. — D. Rook, going down, feeling lucky",
  },
];

// ── 2 · The Mycelial Choir (Lean) ────────────────────────────────────────────
const CHOIR_NOTES: LoreNote[] = [
  {
    id: "c_diary",
    stratum: 2,
    title: "A diary, the pages soft as felt",
    text: "I slept next to Mara last night and woke up knowing she'd dreamed about her brother's goat. She woke up knowing mine. We laughed until we couldn't tell whose laugh it was. Tonight the whole row will sleep close. The mould in the bread cellar is doing it, Old Wyn says, the threads grow between sleepers. I'm glad. I've always been afraid He can't hear one voice from so far off. We'll be louder together. We'll be so loud. Tomorrow I'll write about it. We'll write about it. We",
  },
  {
    id: "c_hymnal",
    stratum: 2,
    title: "Preface to the Great Hymnal of Lean",
    text: "This hymnal is set for four parts: high, low, middle and the part for those who cannot sing, who shall hum. Each generation the parts draw closer. By the fortieth hymn, high and middle share a stave. By the ninetieth, there is one line. The last hymn has no words and no notes, only a direction in the margin: together. If you are reading this alone, you are holding it wrong. Find someone. Lean. Lean closer.",
  },
  {
    id: "c_ysolde_list",
    stratum: 2,
    title: "A long list, most names ticked",
    author: "Ysolde Sallow",
    text: "Mara ✓. Old Wyn ✓. The Hollin twins ✓ (together, obviously). Deaf Tobin ✓ — he went in smiling, he said for the first time he could hear it. The baker ✓. The baker's cat (it wandered in; I'm counting it) ✓. Everyone in Low Row ✓. Everyone in High Row ✓. Me — I said I'd go last, to make sure everyone got in safe. They're all in. I can hear them. It's beautiful. It's very loud. I'll go in a moment. I'd just like to hear myself think for one more breath.",
  },
  {
    id: "c_still_hear",
    stratum: 2,
    title: "Scratched into a cave wall, many times",
    text: "I CAN STILL HEAR MYSELF. I CAN STILL HEAR MYSELF. I CAN STILL HEAR MYSELF. (Further along, the letters are neater, in a different hand:) I CAN STILL HEAR MYSELF. (Further still, a third:) i can still hear myself. (The last few are hardly scratches. Then one, at the end, deep and fresh:) I CAN STILL HEAR MYSELF AND I DON'T WANT TO AND I CAN'T GO BACK IN. HELP. (Someone has chalked beside it, in Kneel script: don't read this aloud near the singing ones.)",
  },
  {
    id: "c_hermit",
    stratum: 2,
    title: "Written on a shelf-fungus, one word per line",
    author: "the hermit",
    text: "Do. Not. Answer. The. Song. It. Will. Ask. Your. Name. It. Will. Sing. It. Back. In. Four. Parts. It. Will. Be. The. Most. Beautiful. Thing. You. Have. Ever. Heard. Your. Own. Name. That. Is. How. It. Gets. In. Hum. Something. Stupid. I. Hum. The. Bread. Song. It. Is. Not. A. Real. Song. That. Is. Why. It. Works. Caps. Two. Bits.",
  },
  {
    id: "c_carving",
    stratum: 2,
    title: "Carved over the mouth of a great cavern",
    text: "WHICH OF YOU IS SPEAKING. (Beneath, in a hundred hands that become one hand by the bottom of the wall:) Us. Us. Us. Us. Us. Us. Us. Us. Us. Us. Us. Us. Us. Us. Us. Us. Us. Us. Us. Us. Us. Us. Us. Us. Us. (And then, small, scratched sideways into the corner where the wall meets the floor, easy to miss:) me?",
  },
  {
    id: "c_delver_song",
    stratum: 2,
    title: "Pencil, in the back of a Lending House kit-book",
    author: "a delver from Kneel",
    text: "The Choir sang my name. I don't know how it knew. It was in harmony, four parts, and it was the kindest anyone has ever said it. I stopped walking. I think I stood there for an hour. I think I nearly went in. It isn't evil. That's the worst of it. It just wants you not to be lonely. I hummed the bread song, like the mushroom man said, and walked out backwards. The hermit's wrong about one thing: it wasn't the most beautiful thing I'd ever heard. My nan's voice was. That's what got me out.",
  },
];

// ── 3 · The Cinder Foundry (Raise) ───────────────────────────────────────────
const FOUNDRY_NOTES: LoreNote[] = [
  {
    id: "f_logbook",
    stratum: 3,
    title: "Foundry Logbook, Volume CCXII",
    text: "Attempt 9,041. Too small. Stamped. Attempt 9,042. Too cold; would not sit in the hand. Stamped. Attempt 9,043. Very fine. Inspector Hale looked at it for most of a day. Stamped. Attempt 9,044. Close. Too warm. Stamped. Attempt 9,045. Cracked in the quench (my fault — the metal was doing its best). Stamped. Attempt 9,046. It looked back at the Inspector. We all saw it. Stamped. Attempt 9,047. Bigger. Committee agrees: bigger. He must be more than we have been allowing for.",
  },
  {
    id: "f_donation",
    stratum: 3,
    title: "Receipt of Offering",
    text: "RAISE FOUNDRY — RECEIVED WITH THANKS, for the making of the god: 1 wedding ring, gold, worn thin on the inside (from Mrs Tull). 1 cradle rail, iron, with teeth-marks. 2 spoons, good. 11 grave-nails (from the Tull plot, with the family's blessing). 1 thimble. 1 small bell, cracked. Each will be melted with care and none will be wasted. What is not the god will be slag, and the slag will be honoured. Please collect your receipt before the next pour.",
  },
  {
    id: "f_inspector_manual",
    stratum: 3,
    title: "Manual of Inspection, section 1",
    text: "A god must be: heavy enough to hold; light enough to carry; warm, but not so warm it burns the palm; still, but not dead; beautiful, but not so beautiful it could be mistaken for a thing we made. It must not look back at the Inspector. It must look back at the Inspector. (The second line has been added in a different ink. Every copy of the manual in the Foundry has it. Nobody remembers adding it.) If in doubt: stamp. There is always more metal.",
  },
  {
    id: "f_idony_note",
    stratum: 3,
    title: "Note pinned inside a cold forge",
    author: "Idony Fenwright",
    text: "The last cores are out. The Last Attempt is finished except it isn't — the chest wants something warm in it and there's nothing warm left in Raise but us. I'll go in. It's my forge; I'll be its fire. Don't wait up. Don't stamp it. Please, just this once, don't stamp it. Keep No. 1 in my apron on the bench — it was the size of a thumb and it was the best one we ever made, and nobody looked at it for more than a minute. Maybe that was the trouble.",
  },
  {
    id: "f_inside_plate",
    stratum: 3,
    title: "Scratched on the inside of an Attempt's faceplate",
    text: "AM I IT. AM I IT. AM I IT. (Beneath, a number stamped at the foundry: 4,112.) (Beneath that, scratched with something like a fingernail but harder:) WHAT IS IT. NOBODY SAID WHAT IT WAS. THEY LOOKED AT ME AND THEY LOOKED AT ME AND NOBODY SAID. IS IT HEAVY. I CAN CARRY IT. TELL ME AND I WILL CARRY IT. (There is a Kneel delver's chalk tick next to this. Someone came here, read it, and stayed long enough to answer. What they said isn't written.)",
  },
  {
    id: "f_dunny_turnback",
    stratum: 3,
    title: "Carved into a coal cart with a knife",
    author: "D. Rook",
    text: "Floor 34. Seven fingers now. Going up. The numbered ones pick you up and walk you to the stamp, and the stamp is next to the fire. The tall one-eyed ones throw their own broken friends into the slag and the slag gets up. Don't kill the numbered ones near the troughs. Water cracks them if they're hot. The little sparks go for the oil drums and then they go for you. I am going up and I am not coming back and I am going to drink until the hammers stop. They go one-two-three. They don't stop.",
  },
  {
    id: "f_warm_rock",
    stratum: 3,
    title: "Survey notes, Lower Seam",
    author: "Surveyor Brannagh Tull",
    text: "The rock under the rim gets warmer the deeper we cut. Not volcanic: no sulphur at the seam, no gas. Steady. The cores we cut out stay warm for years in the hand, like a stone left in the sun, except there is no sun. At the bottom of the Lower Seam, with my ear to the face, I heard something that I will describe in this report as a very slow tide. Recommendation: that we do not dig further. (Stamped by the Committee: NOTED. Below that, in a later hand: we dug further.)",
  },
];

// ── 4 · The Gilded Hive (Bend) ───────────────────────────────────────────────
const HIVE_NOTES: LoreNote[] = [
  {
    id: "h_petition",
    stratum: 4,
    title: "A petition from the box outside the Queen's cell",
    text: "Your Majesty. We have brought the first bread of the year, and the honey from the east comb, which is the sweetest, and the youngest of the Pell children, who wanted to see you. We have mended the south door. We have fed everybody before ourselves. We have not asked you for anything, as is proper, because you have never asked us for anything, which is how we knew. But we would so like to know. Only once. What do you want? (The box is full of these. Thousands. All ending the same way.)",
  },
  {
    id: "h_slate",
    stratum: 4,
    title: "Record kept by the Queen's attendants",
    text: "We gave Her a slate, so She could tell us Her will. For eleven days She did not touch it. On the twelfth She drew on it: a rectangle, taller than wide, with a small circle on one side. The attendants debated it for a season. It is the Comb. It is the Altar. It is the Petition Box. It is a great honour to Her servants that She has chosen to show us the Box. (Beneath, another hand, very small: It is a door. It's a door with a handle. She wants to go home.)",
  },
  {
    id: "h_feeding",
    stratum: 4,
    title: "Tallies pressed into a wax wall",
    text: "Year 1: three meals a day, bread and honey. She ate slowly. Year 9: five meals. She is growing well. Year 20: we have widened the cell. Year 31: we have widened the cell again. She can no longer turn over by Herself; four attendants turn Her at dusk. Year 44: we have built the cell around Her. Year 60: She does not eat unless fed. She never refuses. She never asks. (The tally marks go on for the rest of the wall, and the next wall, and the next.)",
  },
  {
    id: "h_worksong",
    stratum: 4,
    title: "Work-song of the carriers (hummed, written down once)",
    text: "Carry and bow, carry and bow, / nobody's hungry and nobody's slow, / she doesn't ask and we don't ask why, / carry it low and carry it high. / Bend for the bread and bend for the comb, / bend for the queen and bend to go home — / (the last line has been corrected, in another hand: bend for the queen in her golden home. The original is sung more often.)",
  },
  {
    id: "h_walls",
    stratum: 4,
    title: "Minutes of the Council of Bend, on the Wasps",
    text: "The wild wasps came again for the nurseries and took eleven. It is proposed that we build walls. It is objected that Bend has never had walls, only doors that open, because She would not like walls. It is proposed that we ask Her. It is objected that we do not ask Her things. It is resolved that we do not build walls. The Sealers will close the breaches with wax and with themselves. Eleven cradles will be filled again by spring. There is always another child in Bend.",
  },
  {
    id: "h_delver_glasses",
    stratum: 4,
    title: "Charcoal on the back of a Hollow Coin betting slip",
    author: "a delver from Kneel",
    text: "Found a bedroom in the wax. A girl's. Small bed, sheet thrown back like she'd just got up, little round spectacles on a slate with nothing written on it. Everything else here is gold and sticky and humming and this was just a room. I sat on the bed. I don't know why. The bees didn't come in. I think they don't come in here. I put the spectacles in my pocket and then I put them back. I think she'll want them. If she ever gets up. Vey had me at 3 to 1 to come back. Tell her to hold that bet.",
  },
];

// ── 5 · The Frozen Liturgy (Fold) ────────────────────────────────────────────
const LITURGY_NOTES: LoreNote[] = [
  {
    id: "fr_rubric",
    stratum: 5,
    title: "Rubric of the Unending Office (carved over the altar)",
    text: "WE SHALL NOT LET THE PRAYER FALL. The Office is sung in the Hours. Each Hour hands to the next without a breath between. A singer who must breathe shall breathe while the singer beside them sings. A singer who must sleep shall be carried to bed singing. A singer who must die shall die singing, and the singer beside them shall take up their line before it falls. The prayer has not fallen in four hundred years. It shall not fall. Amen is not to be sung.",
  },
  {
    id: "fr_rota",
    stratum: 5,
    title: "Rota of the Hours, the last winter",
    text: "Matins: Brother Col, Sister Aud, the Vane boy. Lauds: Old Maddy (sick — Brother Col covers), Sister Aud (dead — Brother Col covers), Hew. Prime: Hew, Hew's mother (dead — Hew covers). Terce through Compline: Brother Col, Hew. Brother Col has not slept in nine days. Nobody told the young ones he was covering; he didn't want them to worry. The old always sang the young's Hours when the young were ill. It was never mentioned. It isn't now. (The last line of the rota is only one name: A. Vane.)",
  },
  {
    id: "fr_the_extra_prayer",
    stratum: 5,
    title: "Written in the Celebrant's own hand, inside the missal",
    author: "Aurel Vane",
    text: "There are not enough of us left to keep the Hours. The snow has not stopped since Michaelmas. Tonight, within the Office, I shall pray one prayer that is not in the book: that the hour will not end until the prayer is done. I know the prayer will never be done. That is the point. Let Him keep us here, then, in this hour, until we are finished. We will never be finished. Forgive me. I only meant that it should not fall.",
  },
  {
    id: "fr_back_in_a_minute",
    stratum: 5,
    title: "A note on a pew, weighed down with a pair of gloves",
    author: "Gil",
    text: "Back in a minute — Gil. Keep my place. Don't let Hew have it, he fidgets. (The gloves are frozen to the pew. The hymnal beside them is open to the page the congregation is on. The ink of the note has not faded, because nothing here fades. There is a small drift of snow on the seat that has been falling, one flake, very slowly, for as long as anyone can say, and has not yet landed.)",
  },
  {
    id: "fr_late_pilgrim",
    stratum: 5,
    title: "A letter, never delivered, tucked in a glove",
    author: "Nell, the late one",
    text: "Dear Celebrant, I am so sorry I'm late. The road was bad and my sister had the baby and I had to see it and it's a girl. I came as quick as I could. The doors were open but everyone's gone so still, and when I touch them they're cold as the step. I've been looking for a seat for a very long time. All the seats are taken. I'll stand at the back. I'll be quiet. When you're finished, could you let me know? I don't want to leave in the middle. That would be rude.",
  },
  {
    id: "fr_delver_snowflake",
    stratum: 5,
    title: "Scratched on a frozen candle",
    author: "a delver from Kneel",
    text: "Walked round a snowflake for ten minutes today. You can. It just hangs. You can see all six arms, and one is slightly bent. Nobody warned me that the worst thing here would be how lovely it is. Fire wakes them. Don't use fire in the long rooms. The old man at the front holding the cup up — I think he's awake. I think he's been awake the whole time. When I walked past his eyes followed me and he said, very quietly, 'Is it finished yet?' I said I didn't know. He said, 'No. Neither do I.'",
  },
];

// ── 6 · The Red Garden (Offer) ───────────────────────────────────────────────
const GARDEN_NOTES: LoreNote[] = [
  {
    id: "g_labels",
    stratum: 6,
    title: "Garden labels, tied together with twine",
    text: "LEFT HAND — Mrs Ottery — with thanks. KIDNEY (the good one) — Barnaby Fenn — with thanks. EYES, brown, pair — the Lacey girls, one each — with thanks. VOICE — Old Pim — we are not sure how to plant this one; he insisted — with thanks. HEART (seed) — T. Rook — Head Gardener — with thanks. FAT OF THE THIGH — anonymous — with thanks all the same. Every gift labelled. None forgotten. Water daily. Talk to them. They like to be talked to.",
  },
  {
    id: "g_catalogue",
    stratum: 6,
    title: "Seed Catalogue of Offer, Spring Edition",
    text: "HEARTSEED. Grown from a sliver of the donor's own heart, taken under ichor, painless (mostly). Plant together, in a warm bed, for the great heart. Germination: one beat per minute. Height at maturity: considerable. Flowers: red. Fruit: see below. Not for eating. Each packet bears the donor's name so that the Vessel will know, when He comes to wear it, exactly who gave Him His heart. He will want to thank them. We are sure He will want to thank them.",
  },
  {
    id: "g_tamsin_journal",
    stratum: 6,
    title: "Gardener's journal, back pages",
    author: "Tamsin Rook",
    text: "Warm, as ever. The Vessel is finished. It is the most beautiful thing any of us has ever seen, and it is lying in the long bed with its eyes open and nobody in it. We have waited a year. Nobody has come. The village is thin and pale and short of hands and kidneys and eyes, and they keep coming to the long bed and looking at it and not saying anything. I cannot bear that they gave it all for nothing. I know the way in. I planted the heart myself. I'll just make it walk. Just so they can see it walk.",
  },
  {
    id: "g_rota",
    stratum: 6,
    title: "Chalk on a potting shed, the weather column",
    text: "MON: warm. Pruned the east trellis. Mr Fenn's fingers are doing well. TUE: warm. Acid bed overflowed again. Moved the barrow. WED: warm. Something's eating the young ones — ticks, I think, from outside. Burned the edge. THU: warm. The long bed turned over in the night. FRI: warm. The trellis has grown round Barnaby while he was pruning it. He says he doesn't mind. SAT: warm. SUN: warm. (The weather column goes on down the wall. It is always warm.)",
  },
  {
    id: "g_lullaby",
    stratum: 6,
    title: "Carved along a row of ribs",
    text: "Hush now, grow now, give what you've got, / a hand for the hand and a heart for the pot, / an eye for the eye and a bone for the frame, / and when He comes home He will know you by name. / Hush now, grow now, don't mind the knife, / we're growing a body to hold up His life, / and if nobody comes then we'll wear it instead — / hush now, grow now, and so to bed.",
  },
  {
    id: "g_delver_rook",
    stratum: 6,
    title: "A delver's note, written on a seed packet",
    author: "a delver from Kneel",
    text: "Seed packet reads: HEART — T. ROOK — Head Gardener — with thanks. There's a Rook at the Stump. Dunny. He's never been past 34. His gran was a Rook, he says, and hers. I don't know how a Rook got down here before there was a Kneel for Rooks to be from. I'm keeping the packet. I don't know if I'll show him. The big body in the middle of the floor walks like someone who's never walked before, carefully, like the floor might not be there. Something is inside it making it go. I think she's tired.",
  },
];

// ── 7 · The Orrery (Reach) ───────────────────────────────────────────────────
const ORRERY_NOTES: LoreNote[] = [
  {
    id: "o_blueprint",
    stratum: 7,
    title: "Annotation on a blueprint of the Great Wheel",
    text: "Sheet 14 of 900. Elevation of the Sleeper (from Stand's descriptions — kneeling, head down, hands cupped). Proposed correction for the coming year: turn 3° north. Expected effect: gentler winters, fewer floods in Offer, better light for the Fold harvest. Side effects: none anticipated. (Pencil, later:) Side effects: Turn has put out the north stars in protest. Angels dispatched. (Later still:) The Sleeper turned 3° north. So did we. We did not build ourselves a bearing. We did not think we would need one.",
  },
  {
    id: "o_chalkboard",
    stratum: 7,
    title: "A chalkboard, most of it calculations",
    text: "…therefore the period of the dream is 9,212 years ± 40, the axis is tractable, and with the full Orrery engaged we may steer the Sleeper through any season we choose, and choose kindly, and choose for everyone, and when the dream is exactly as good as it can be made, and not before, then we will ASK it. (The word ASK has been rubbed out with a sleeve. Above it, in a firmer hand: TELL. Below it, in a much older and shakier hand: we never did either.)",
  },
  {
    id: "o_star_chart",
    stratum: 7,
    title: "Margin of a star chart",
    text: "Neighbours, for reference, as seen from the Rim Observatory. STAND: the old village. They watched it happen. They are the ones who told us it only sleeps. They do not do anything; they only look. TURN: across the rim. They have put out their fires and are putting out ours, and now the stars. Idiots. Children. OFFER: the new village, just founded on our cellars. Gardeners. Something is growing in their long bed. We must find out what they are planning to put in it.",
  },
  {
    id: "o_committee",
    stratum: 7,
    title: "Minutes of the Committee of Correction",
    text: "Present: all. Item 1: whether to wake the Sleeper and ask its preference. Discussion: considerable. It was felt that the Sleeper might say no. It was felt that the Sleeper might say something we could not understand. It was felt, by Horologer Castellan, that it was rude to steer a person without asking. The Horologer was thanked for her contribution. Item 1 was resolved in the negative. Item 2: lunch. Item 3: the brake. The Horologer asked that a brake be fitted to the Wheel. Resolved: a small one.",
  },
  {
    id: "o_brake_log",
    stratum: 7,
    title: "Log kept on the brake housing",
    author: "Ione Castellan",
    text: "Day 1. The Wheel is turning us. Not the dream: us. I am on the brake. Day 40. Still on the brake. If I let go it spins free and the dream lurches, and everything in it lurches, and so do we. Day 900. The angels bring me water. Day ???. I have stopped counting days and started counting ticks. If I hold, I am crushed slowly. If I let go, everyone is crushed quickly. I had it written down, where we were going. I have lost the page. I keep holding. It's what I'm for now.",
  },
  {
    id: "o_delver_turned",
    stratum: 7,
    title: "Written on the back of a map, in a hurry",
    author: "a delver from Kneel",
    text: "Slept an hour in a side room. Woke up facing the way I came. The room had turned. Everything here turns — the rooms, the bridges, the stars on the ceilings. The angels relight lamps the way the candle-men did on the first floors, which made me homesick in a very specific way. The dogs wind up before they jump; you can hear it: click click click. Get behind a pillar. The fat spinning ones slow down anything fast, including your blink, including their own dogs. Use that. I think this whole place is someone trying very hard to help.",
  },
];

// ── 8 · The Unlit (Turn) ─────────────────────────────────────────────────────
const UNLIT_NOTES: LoreNote[] = [
  {
    id: "un_rules",
    stratum: 8,
    title: "The Rules of the Game (whispered, then written, once)",
    text: "No lights. None. Not a candle, not a coal, not the moon in a bucket. No calling out. No peeking. Hang the mirrors so that if a light comes you will see it before it sees you. Keep still. Count under your breath, all of you, together, so the counting is one long sound and nobody can tell where it comes from. It will come. It will look. It will find us. And when it does we will have been so good, so quiet, so hidden, that it will know how much we wanted to be found. Soon.",
  },
  {
    id: "un_tally",
    stratum: 8,
    title: "Chalk tally, filling a whole corridor",
    text: "(Five-bar gates, thousands upon thousands, along both walls and the floor and up onto the ceiling, in the dark, done by touch. At the far end, a number, carefully written:) 99,999,998. (And under it, smaller, a later hand:) Ready or not. (And under that, smaller still, as if the writer had reconsidered:) Not.",
  },
  {
    id: "un_mirror_back",
    stratum: 8,
    title: "Scratched on the back of a turned mirror",
    text: "____ . LEENK . EWOB . POOTS . NAEL . ESIAR . DNEB . DLOF . REFFO . HCAER . NRUT . DNATS (Read it in the glass. We wrote it backwards so only the light could read it, if the light ever came. These are the villages. We are Turn. Before us, Stand. After us will come the rest. We know because Stand told us, and Stand knows because Stand watched. The last one is at the top, because it will be the first one the light sees.)",
  },
  {
    id: "un_olly",
    stratum: 8,
    title: "A note pushed under a cupboard door",
    author: "Mam",
    text: "Olly. Olly, love, it's Mam. You've won. You've won ever so. Everybody else has been found or given up and gone to sleep. It's all right to come out. It's all right to be found. I know it's the best you've ever hidden. I know nobody's ever hidden that well. I'm not cross. Come out and have your tea. Olly? Olly, olly, all come free. Please. It's very dark and I can't find the door either.",
  },
  {
    id: "un_elder",
    stratum: 8,
    title: "Carved by touch into a wall, letters very large",
    author: "an elder of Turn",
    text: "SOMETHING IS LOOKING. It came. It is not what we hoped. Or it is exactly what we hoped and we did not know how big. It goes toward light and toward hiding, and we are all hiding, and so it goes toward all of us, and when it finds one of us it is so glad, and it holds on, and it does not know how to hold something so small. Do not light anything. Do not hide too well. Walk. Walk slowly in the half-dark, as if you are going somewhere ordinary. It does not look for ordinary.",
  },
  {
    id: "un_delver_lantern",
    stratum: 8,
    title: "Pencil on a kit-book page",
    author: "a delver from Kneel",
    text: "Put the lantern out. Walked two hundred paces with one hand on the wall. Something enormous went past in the dark, close enough that the air moved. It didn't want me. It wanted the lantern — I'd left it on a ledge, still warm — and it stood over the lantern for a long time, very gently, like you'd stand over a cot. The mirrors are the worst. My reflection in one of them didn't stop when I stopped. I broke that one. Glass doesn't make much noise when there's nothing else making any.",
  },
];

// ── 9 · The Threshold (Stand) ────────────────────────────────────────────────
const THRESHOLD_NOTES: LoreNote[] = [
  {
    id: "t_stand_stone",
    stratum: 9,
    title: "Cut into a standing stone at the rim",
    text: "IT CAME TO THE EDGE. IT KNELT. IT PUT ITS HEAD DOWN INTO THE EARTH. IT DID NOT GET UP. WE STOOD. WE WATCHED. WE DID NOT KNOW WHAT TO DO WITH OUR HANDS. WHERE DID IT GO. (Under this, much later, in many hands, the same three words, over and over, until the stone is worn smooth beneath them: WHERE DID IT GO WHERE DID IT GO WHERE DID IT GO)",
  },
  {
    id: "t_anneth",
    stratum: 9,
    title: "Scratched on a doorstep, over and over",
    author: "Anneth",
    text: "Come back. Come back. I went down after you, that same night, before any of them. I have been here the longest. I have asked the most. I have asked you every way there is to ask: kneeling, standing, shouting, in the dark, singing, weeping, bargaining, I have asked you with my whole body. Come back. Answer me first. I was first. I watched you go. Come back. Why won't you. What did we do. What did I say wrong. Come back.",
  },
  {
    id: "t_hall_rules_wrong",
    stratum: 9,
    title: "Rules of the Delvers' Hall (nailed by the stove)",
    text: "1. Questions only till morning. Ask everything. 2. Bring everything back that is still moving. 3. Stash chests are coffins. 4. Wet boots on the stove. 5. If you hear a second heartbeat in the bunks, it is yours. 6. Answer everything that talks in your sleep. 7. Bread and salt are free to the unreturned. 8. Kneel lower. (The handwriting is Merrow's. The nail is the same nail. The stove is cold.)",
  },
  {
    id: "t_letter_to_you",
    stratum: 9,
    title: "A letter on your own stash chest, addressed to you",
    text: "Dear you. You left your candle burning. It's all right. It's on the fourth shelf, same as always, only the shelves go up forever here, and there's one for everyone who ever lived at the rim — Stand, Turn, Reach, all of them, and Kneel, and you. They're all still lit. None of them ever got shorter. Somebody has been keeping them. When you get to the bottom, it's going to ask you something. Everyone's been asking it things for so long. It's never had a turn. Be kind. Take your time. It's waited this long.",
  },
  {
    id: "t_ledger_begins",
    stratum: 9,
    title: "The Chandlery ledger, as it is here",
    text: "(The ledger is the same ledger as the one in Kneel, the same scorched leather, the same smell of tallow. But here the first page is not scorched. It begins properly, at the top, in a large careful hand:) Year One. We lit one for It, because It went down first, and somebody should. (And then the rest of the page is blank. Every page after is blank. The dream, it seems, remembers exactly one beginning, and it isn't its own.)",
  },
  {
    id: "t_founders",
    stratum: 9,
    title: "Inscription on the Founders' Plinth",
    text: "FOUNDED BY — (and then a name, freshly cut, the chips of stone still lying at the base. It is your name. The statue standing on the plinth is a delver, in your robe, with your focus, kneeling, and looking down at the pit. The mason's chisel is lying on the step, still warm. Nobody is here. Everybody in the village is at the rim, standing, looking down, with their backs to you, because it is rude to watch someone go in.)",
  },
  {
    id: "t_delver_97",
    stratum: 9,
    title: "Written on the Memorial Wall, in chalk, in the wrong village",
    author: "a delver from Kneel",
    text: "Floor 97. It's Kneel. It isn't. The houses face the pit. Everyone is at the rim, looking down, and none of them turned when I said hello, not even Tibb. Mother Sallow had Old Hask's eye. The Stump had forty stalls' worth of people in it and one empty chair. I sat in it. Nobody told me not to. That's how I knew for sure I wasn't home. I don't know what's at the bottom. I'm going to find out. If I don't come back, put it on the real Wall that I went all the way down. And that I was polite.",
  },
];

/** Every note, all strata and the village. */
export const NOTES: LoreNote[] = [
  ...KNEEL_NOTES,
  ...UNDERCROFT_NOTES,
  ...ARCHIVE_NOTES,
  ...CHOIR_NOTES,
  ...FOUNDRY_NOTES,
  ...HIVE_NOTES,
  ...LITURGY_NOTES,
  ...GARDEN_NOTES,
  ...ORRERY_NOTES,
  ...UNLIT_NOTES,
  ...THRESHOLD_NOTES,
];
