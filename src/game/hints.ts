/** Contextual tutorial: picks which hint card (0..3) to show for upcoming beats. */
import type { Beat } from '../types';
import type { Session } from './session';

export const HINT_LOOKAHEAD = 2.2;
export const HINT_DURATION = 2.6;

/** Hint id for a beat: 1 = first 2단, 2 = first 3단, 3 = first bird, null = none. */
export function hintForBeat(b: Beat): number | null {
  if (b.obstacles.some((o) => o.kind === 'bird')) return 3;
  if (b.requiredLevel === 3) return 2;
  if (b.requiredLevel === 2) return 1;
  return null;
}

/** Next unseen hint coming up within the lookahead window, if any. */
export function upcomingHint(s: Session, seen: ReadonlySet<number>): number | null {
  for (let i = s.cursor; i < s.beats.length; i++) {
    const b = s.beats[i];
    if (b.time - s.time > HINT_LOOKAHEAD) break;
    const h = hintForBeat(b);
    if (h !== null && !seen.has(h)) return h;
  }
  return null;
}
