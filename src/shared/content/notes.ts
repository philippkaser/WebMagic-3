/** Lore notes found in the dungeon. The lore module registers its texts
 * here; the server picks one per note interactable. */
export interface LoreNoteDef {
  id: string;
  stratum: number;
  title: string;
  author?: string;
  text: string;
}

const notes: LoreNoteDef[] = [];

export function registerNotes(list: LoreNoteDef[]): void {
  for (const n of list) if (!notes.some((x) => x.id === n.id)) notes.push(n);
}

export function notesFor(stratum: number): LoreNoteDef[] {
  return notes.filter((n) => n.stratum === stratum);
}

export function noteById(id: string): LoreNoteDef | undefined {
  return notes.find((n) => n.id === id);
}
