/** Lore text: notes, NPC barks, strata text, item naming, village secrets.
 * World bible: docs/LORE.md · creatures: docs/BESTIARY.md. */
import { registerNotes } from "../notes";
import { NOTES } from "./notes";

export type * from "./types";
export { NOTES } from "./notes";
export { NPCS } from "./npcs";
export { STRATA_TEXT } from "./strata";
export { STRATUM_NAMING, AFFIX_THEMES, VILLAGE_CONSUMABLES } from "./naming";
export {
  RIM_WORDS,
  COUNTING_RHYME,
  SECRETS,
  MEMORIAL_EPITAPHS,
  CAUSE_PHRASES,
  DEATH_LINES,
  ASCEND_LINES,
  WAKING_BELL_LINES,
  FREED_DREAMER_LINES,
  LOADING_QUOTES,
} from "./village";

// The server/client pick dungeon notes from shared/content/notes.ts.
registerNotes(NOTES.map((n) => ({ id: n.id, stratum: n.stratum, title: n.title, author: n.author, text: n.text })));
