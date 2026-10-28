/**
 * Autoplayer. Drives the title-screen attract mode, `?autoplay=1`, and the
 * "every stage is beatable" simulation test. Each frame it returns at most one
 * touch: a tap, optionally followed by a swipe (the swipe modifies the touch's
 * own jump, exactly like a real finger: tap + ↓ = slide), or a left-thumb lane swipe.
 * Lanes (GDD v5 §9): before the next lane-hazard beat it walks, one lane per touch, to the
 * nearest safe lane — preferring one that is also safe for the lane beat right after.
 */
import type { Beat, LaneDir, LaneId, Swipe } from '../types';
import { LANES } from '../types';
import type { Session } from './session';

/** first tap this long before a 1-level jump beat; air taps follow every BOOST_GAP.
 * Multi-level jumps start earlier so the taps keep a human cadence (~10 taps/s).
 * v8: 0.23 s puts the apex of a 1단 (0.22 s) and of the last boost (0.233 s) on the beat — PERFECT. */
const LEAD = 0.23;
const BOOST_GAP = 0.1;
const leadFor = (level: number): number => LEAD + (level - 1) * BOOST_GAP;
/** a slide starts this long before a slide beat (it lasts slideTime, ≈0.55s): judge.SLIDE_IDEAL;
 * from the air the dive starts earlier so the landing (and the slide) comes in time */
const SLIDE_LEAD = 0.2;
const DIVE_LEAD = 0.3;
/** lane moves start this long before a lane beat, one swipe per LANE_SETTLE (a 2-lane move fits) */
const LANE_LOOK = 0.7;
const LANE_SETTLE = 0.1;
/** a following lane beat this close shapes which safe lane is picked */
const LANE_CHAIN = 1.2;

export interface BotAction {
  readonly swipe: Swipe | null;
  /** a left-thumb lane swipe instead of a tap */
  readonly lane?: LaneDir;
}

const isPickupOnly = (b: Beat): boolean =>
  b.requiredLevel === 0 && !b.needsSlide && b.blockedLanes.length === 0 && !b.obstacles.some((o) => o.kind === 'drone');

const safeIn = (b: Beat | undefined, l: LaneId): boolean => !b || !b.blockedLanes.includes(l);

function laneTarget(s: Session): LaneId | null {
  const i = s.beats.findIndex((b, k) => k >= s.cursor && b.blockedLanes.length > 0);
  const b = i >= 0 ? s.beats[i] : undefined;
  if (!b || b.time - s.time > LANE_LOOK || safeIn(b, s.player.lane)) return null;
  const after = s.beats.slice(i + 1).find((n) => n.blockedLanes.length > 0 && n.time - b.time <= LANE_CHAIN);
  const cost = (l: LaneId): number => (safeIn(after, l) ? 0 : 10) + Math.abs(l - s.player.lane);
  const safe = LANES.filter((l) => safeIn(b, l));
  return safe.reduce((best, l) => (cost(l) < cost(best) ? l : best), safe[0]);
}

function lanePlan(s: Session): BotAction | null {
  const target = laneTarget(s);
  if (target === null || s.player.laneAge < LANE_SETTLE) return null;
  return { swipe: null, lane: target < s.player.lane ? -1 : 1 };
}

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
  if (until > (p.grounded || p.sliding ? SLIDE_LEAD : DIVE_LEAD) || until <= 0) return null;
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
  const moveLane = lanePlan(s);
  if (moveLane) return moveLane;
  const b = targetBeat(s);
  if (!b) return null;
  const until = b.time - s.time;
  return b.needsSlide ? slidePlan(s, until) : jumpPlan(s, b, until);
}
