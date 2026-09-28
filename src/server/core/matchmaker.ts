import { ENCOUNTER } from "../../shared/config";

/** Where a delver lands on floor N. Encounters with other delvers are meant
 * to be rare enough to be memorable, frequent enough to keep everyone on
 * edge (DESIGN.md §3.3). Only instances of the SAME floor number are ever
 * candidates. Pure: the rng is injected so the rules are testable. */

export interface InstanceInfo {
  id: string;
  floor: number;
  members: number;
  createdAt: number;
  /** Closed once the warden fight starts, or when full. */
  open: boolean;
}

export interface MatchRequest {
  floor: number;
  now: number;
  /** Minutes since this delver last shared a floor with anyone. */
  lonelyMinutes: number;
  /** Instance a pact ally just descended into (always joined if open). */
  partyInstance?: string;
}

export function encounterChance(lonelyMinutes: number): number {
  return Math.min(ENCOUNTER.maxJoinChance, ENCOUNTER.joinChance + Math.max(0, lonelyMinutes) * ENCOUNTER.lonelinessBonusPerMin);
}

/** Returns an existing instance id to join, or null to create a fresh one. */
export function chooseInstance(candidates: InstanceInfo[], req: MatchRequest, random: () => number): string | null {
  const eligible = candidates.filter(
    (c) =>
      c.floor === req.floor &&
      c.open &&
      c.members > 0 &&
      c.members < ENCOUNTER.maxPlayersPerInstance &&
      (req.now - c.createdAt) / 1000 < ENCOUNTER.joinWindowSec,
  );
  if (req.partyInstance) {
    const party = candidates.find((c) => c.id === req.partyInstance && c.members < ENCOUNTER.maxPlayersPerInstance);
    if (party) return party.id;
  }
  if (eligible.length === 0) return null;
  if (random() >= encounterChance(req.lonelyMinutes)) return null;
  // Prefer instances with a single delver: a one-on-one meeting is the
  // most tense kind.
  eligible.sort((a, b) => a.members - b.members || a.createdAt - b.createdAt);
  return eligible[0].id;
}
