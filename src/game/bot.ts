/**
 * Autoplayer. Drives the title-screen attract mode and the "every stage is
 * beatable" simulation test. Decides each frame whether to tap now.
 */
import type { Beat } from '../types';
import type { Session } from './session';

/** first tap this long before a beat; air taps follow every BOOST_GAP */
const LEAD = 0.2;
const BOOST_GAP = 0.08;

function targetBeat(s: Session): Beat | undefined {
  for (let i = s.cursor; i < s.beats.length; i++) {
    const b = s.beats[i];
    if (b.requiredLevel > 0) return b;
    const pickup = b.obstacles.find((o) => o.kind !== 'bird');
    // grab pickups only when no hazard is close behind
    const nextHazard = s.beats.slice(i + 1).find((n) => n.requiredLevel > 0);
    if (pickup && (!nextHazard || nextHazard.time - b.time > 1.4)) return b;
    if (b.obstacles.some((o) => o.kind === 'bird')) continue;
  }
  return undefined;
}

function wantedLevel(b: Beat): number {
  if (b.requiredLevel > 0) return b.requiredLevel;
  return Math.max(...b.obstacles.filter((o) => o.kind !== 'bird').map((o) => o.level));
}

/** Returns true when the bot should tap on this frame (taps at most once per call). */
export function botShouldTap(s: Session): boolean {
  if (s.status !== 'playing') return false;
  const b = targetBeat(s);
  if (!b) return false;
  const until = b.time - s.time;
  const want = wantedLevel(b);
  const p = s.player;
  if (p.grounded) return until <= LEAD && until > 0;
  if (p.level >= want || until <= 0) return false;
  const tapIndex = p.level; // taps already used
  return until <= LEAD - tapIndex * BOOST_GAP;
}
