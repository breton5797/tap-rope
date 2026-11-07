/** Contextual tutorial: picks which move card to show for upcoming beats. */
import type { Beat, MoveId, StageDef } from '../types';
import { HAZARD_KINDS } from '../types';
import { moveForBeat } from '../core/timeline';
import { STAGES } from '../core/content';
import type { Session } from './session';

export const HINT_LOOKAHEAD = 2.2;
export const HINT_DURATION = 2.6;

/** Move card for a beat; plain jumps are taught once at the very start, not here. */
export function hintForBeat(b: Beat): MoveId | null {
  const move = moveForBeat(b);
  return move === 'jump' ? null : move;
}

/** Moves this campaign stage is the first to use — only those get a tutorial card there. */
export function introducedMoves(stage: StageDef): MoveId[] {
  return stage.moves.filter((m) => STAGES.find((st) => st.moves.includes(m))?.id === stage.id);
}

/** the index of the next beat with a hazard at or after the cursor, or -1 */
export function nextHazardIndex(s: Session): number {
  for (let i = s.cursor; i < s.beats.length; i++) if (s.beats[i].obstacles.some((o) => HAZARD_KINDS.includes(o.kind))) return i;
  return -1;
}

/**
 * The move card for the NEXT hazard beat, when it is unseen, allowed and within the lookahead (P1-2: a card for
 * a later beat contradicted the hazard arriving first — "줄 바꾸기" under a "점프!" callout).
 */
export function upcomingHint(s: Session, seen: ReadonlySet<MoveId>, allowed: ReadonlySet<MoveId>): MoveId | null {
  const i = nextHazardIndex(s);
  if (i < 0) return null;
  const b = s.beats[i];
  if (b.time - s.time > HINT_LOOKAHEAD) return null;
  const h = hintForBeat(b);
  return h !== null && allowed.has(h) && !seen.has(h) ? h : null;
}
