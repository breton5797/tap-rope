/**
 * Autoplayer. Drives the title-screen attract mode, `?autoplay=1`, and the
 * "every stage is beatable with the intended moves" simulation test.
 * Each frame it returns at most one touch: a tap, optionally followed by a swipe
 * (the swipe modifies the jump that touch starts, exactly like a real finger).
 */
import type { Beat, Lane, Obstacle, PlayerState, Swipe } from '../types';
import type { Session } from './session';

/** first tap this long before a beat; air taps follow every BOOST_GAP */
const LEAD = 0.2;
const BOOST_GAP = 0.08;
/** a second side hop needs one more jump's worth of time */
const HOP_GAP = 0.55;

export interface BotAction {
  readonly swipe: Swipe | null;
}

const ropeOf = (b: Beat): Obstacle | undefined => b.obstacles.find((o) => o.kind === 'rope');
const ballLanes = (b: Beat): Lane[] => b.obstacles.filter((o) => o.kind === 'ball').map((o) => o.lane ?? 0);
const hasKind = (b: Beat, k: Obstacle['kind']): boolean => b.obstacles.some((o) => o.kind === k);

/** nearest free lane for a beat's balls (balls never block all three lanes) */
function safeLane(lane: Lane, blocked: readonly Lane[]): Lane {
  const free = ([-1, 0, 1] as const).filter((l) => !blocked.includes(l));
  return free.reduce((best, l) => (Math.abs(l - lane) < Math.abs(best - lane) ? l : best), free[0]);
}

function needsAction(b: Beat, p: PlayerState, s: Session): boolean {
  if (b.requiredLevel > 0 || hasKind(b, 'ring')) return true;
  if (ballLanes(b).includes(p.lane)) return true;
  const pickup = b.obstacles.find((o) => !['bird', 'ball'].includes(o.kind));
  if (!pickup || (pickup.lane ?? 0) !== p.lane) return false;
  const i = s.beats.indexOf(b);
  const nextHazard = s.beats.slice(i + 1).find((n) => n.requiredLevel > 0 || hasKind(n, 'ring'));
  return !nextHazard || nextHazard.time - b.time > 1.4;
}

function targetBeat(s: Session): Beat | undefined {
  for (let i = s.cursor; i < s.beats.length; i++) {
    if (needsAction(s.beats[i], s.player, s)) return s.beats[i];
  }
  return undefined;
}

function wantedLevel(b: Beat): number {
  if (b.requiredLevel > 0) return b.requiredLevel;
  const levels = b.obstacles.filter((o) => !['bird', 'ball'].includes(o.kind)).map((o) => o.level);
  return levels.length ? Math.max(...levels) : 1;
}

/** the gesture (and how early) for the jump that starts this beat */
function groundPlan(s: Session, b: Beat): { swipe: Swipe | null; lead: number } {
  const p = s.player;
  if (hasKind(b, 'ring')) return { swipe: 'up', lead: LEAD };
  const blocked = ballLanes(b);
  if (blocked.includes(p.lane)) {
    const target = safeLane(p.lane, blocked);
    const hops = Math.abs(target - p.lane);
    return { swipe: target < p.lane ? 'left' : 'right', lead: LEAD + (hops - 1) * HOP_GAP };
  }
  const rope = ropeOf(b);
  if (s.ropeMode === 'solo' && rope && (rope.back ?? false) !== p.backward) return { swipe: 'down', lead: LEAD };
  return { swipe: null, lead: LEAD };
}

function airPlan(s: Session, b: Beat, until: number): BotAction | null {
  const p = s.player;
  if (p.tumble || until <= 0) return null;
  const blocked = ballLanes(b);
  if (blocked.includes(p.lane)) return null; // finish this hop, the next one happens after landing
  if (ropeOf(b)?.cross && !p.cross) return until <= LEAD - BOOST_GAP ? { swipe: 'left' } : null;
  if (p.level >= wantedLevel(b)) return null;
  return until <= LEAD - p.level * BOOST_GAP ? { swipe: null } : null;
}

/** Returns the touch to perform this frame, or null. */
export function botAction(s: Session): BotAction | null {
  if (s.status !== 'playing') return null;
  const b = targetBeat(s);
  if (!b) return null;
  const until = b.time - s.time;
  if (!s.player.grounded) return airPlan(s, b, until);
  const plan = groundPlan(s, b);
  return until <= plan.lead && until > 0 ? { swipe: plan.swipe } : null;
}
