/** Contextual tutorial: picks which move card to show for upcoming beats. */
import type { Beat, MoveId, StageDef } from '../types';
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

/** Next unseen move (restricted to `allowed`) coming up within the lookahead window, if any. */
export function upcomingHint(s: Session, seen: ReadonlySet<MoveId>, allowed: ReadonlySet<MoveId>): MoveId | null {
  for (let i = s.cursor; i < s.beats.length; i++) {
    const b = s.beats[i];
    if (b.time - s.time > HINT_LOOKAHEAD) break;
    const h = hintForBeat(b);
    if (h !== null && allowed.has(h) && !seen.has(h)) return h;
  }
  return null;
}
