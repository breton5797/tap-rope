/**
 * Autoplayer. Drives the title-screen attract mode, `?autoplay=1`, and the
 * "every stage is beatable" simulation test. Each frame it returns at most one
 * touch: a tap, optionally followed by a swipe (the swipe modifies the touch's
 * own jump, exactly like a real finger: tap + ↓ = slide).
 */
import type { Beat, Swipe } from '../types';
import type { Session } from './session';

/** first tap this long before a 1-level jump beat; air taps follow every BOOST_GAP.
 * Multi-level jumps start earlier so the taps keep a human cadence (~10 taps/s). */
const LEAD = 0.2;
const BOOST_GAP = 0.1;
const leadFor = (level: number): number => LEAD + (level - 1) * BOOST_GAP;
/** a slide starts this long before a slide beat (it lasts slideTime, ≈0.55s) */
const SLIDE_LEAD = 0.3;

export interface BotAction {
  readonly swipe: Swipe | null;
}

const isPickupOnly = (b: Beat): boolean =>
  b.requiredLevel === 0 && !b.needsSlide && !b.obstacles.some((o) => o.kind === 'drone');

function needsAction(s: Session, i: number): boolean {
  const b = s.beats[i];
  if (b.requiredLevel > 0 || b.needsSlide) return true;
  if (!isPickupOnly(b)) return false; // drone alone: stay on the ground
  const nextHazard = s.beats.slice(i + 1).find((n) => !isPickupOnly(n));
  return !nextHazard || nextHazard.time - b.time > 1.4;
}

function targetBeat(s: Session): Beat | undefined {
  for (let i = s.cursor; i < s.beats.length; i++) {
    if (needsAction(s, i)) return s.beats[i];
  }
  return undefined;
}

function wantedLevel(b: Beat): number {
  if (b.requiredLevel > 0) return b.requiredLevel;
  const levels = b.obstacles.filter((o) => o.kind !== 'drone').map((o) => o.level);
  return levels.length ? Math.max(...levels) : 1;
}

function slidePlan(s: Session, until: number): BotAction | null {
  const p = s.player;
  if (p.sliding && p.slideTime > until + 0.05) return null; // current slide still covers the beat
  if (until > SLIDE_LEAD || until <= 0) return null;
  if (p.grounded || p.sliding) return { swipe: 'down' }; // tap + ↓ → slide
  // airborne: the tap boosts first, then the ↓ dives into a slide on landing
  return p.pendingSlide ? null : { swipe: 'down' };
}

function jumpPlan(s: Session, b: Beat, until: number): BotAction | null {
  const p = s.player;
  const want = wantedLevel(b);
  const lead = leadFor(want);
  if (p.grounded || p.sliding) return until <= lead && until > 0 ? { swipe: null } : null;
  if (p.level >= want || until <= 0) return null;
  return until <= lead - p.level * BOOST_GAP ? { swipe: null } : null;
}

/** Returns the touch to perform this frame, or null. */
export function botAction(s: Session): BotAction | null {
  if (s.status !== 'playing') return null;
  const b = targetBeat(s);
  if (!b) return null;
  const until = b.time - s.time;
  return b.needsSlide ? slidePlan(s, until) : jumpPlan(s, b, until);
}
