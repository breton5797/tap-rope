// Office feel pack F5 (v2 spec §4): the superior throws what is coming. A front hazard leaves the boss's
// hand on an arc during the attack telegraph (ATTACK_LEAD) and lands on its normal path at the join time,
// then moves exactly as before, so judge timing and hit boxes are untouched. Things that come from behind
// or fall from above (rear beams, chasers, drops) are never thrown; a guard gets a stomp instead.
// Visibility: a thrown prop is in the boss's hand from ATTACK_LEAD (≥ WARN_LEAD) on — never hidden later.
import type { LaserFrom, ObstacleKind } from '../../types';
import { PLAYER_X } from '../../types';
import { ATTACK_LEAD } from '../core/boss';
import { FLOOR_BACK } from '../../render/layout';
import type { View } from '../../render/view';
import { HAND_FRAC, PERSON_ASPECT, PERSON_FX, personWidth } from './boss-rigs';

export type Launch = 'throw' | 'stomp';

/** how the boss delivers a hazard obstacle, or null when it doesn't come from the boss */
export function launchFor(kind: ObstacleKind, from: LaserFrom | null): Launch | null {
  if (kind === 'beam' || kind === 'high') return from === 'back' ? null : 'throw';
  if (kind === 'floor' || kind === 'ceiling' || kind === 'drone') return 'throw';
  return kind === 'guard' ? 'stomp' : null;
}

/** the prop is held (wind-up, the boss's -attack frame) this long before it flies */
export const WIND_UP = 0.25;
/** it lands this far in front of the hand (logical px), so it never flies backwards */
export const THROW_JOIN_GAP = 24;
const MIN_FLIGHT = 0.35;
const MIN_JOIN = 0.3;
/** arc height over the straight hand → landing line */
const ARC_H = 70;

interface Pt { x: number; y: number }
const P: Pt = { x: 0, y: 0 };

/** a point on the throw parabola (k 0 = hand, 1 = landing); shared result */
export function throwArc(hand: Readonly<Pt>, land: Readonly<Pt>, k: number): Readonly<Pt> {
  P.x = hand.x + (land.x - hand.x) * k;
  P.y = hand.y + (land.y - hand.y) * k - ARC_H * 4 * k * (1 - k);
  return P;
}

/** per-frame state set by the office renderer: is a superior on stage, and where is its hand */
const frame = { active: false, hand: { x: 0, y: 0 } as Pt };

export function setThrowFrame(active: boolean, v: View): void {
  frame.active = active;
  if (!active) return;
  const w = personWidth(v.w);
  const h = w / PERSON_ASPECT;
  frame.hand.x = v.x0 + v.w * PERSON_FX - w / 2 + HAND_FRAC.x * w;
  frame.hand.y = FLOOR_BACK + 2 - h + HAND_FRAC.y * h;
}

export const throwHand = (): Readonly<Pt> => frame.hand;

/** seconds before arrival at which a thrown prop (moving at `speed` px/s on the middle lane) lands on its path */
export function joinTime(speed: number): number {
  const t = (frame.hand.x - THROW_JOIN_GAP - PLAYER_X) / speed;
  return Math.min(ATTACK_LEAD - WIND_UP - MIN_FLIGHT, Math.max(MIN_JOIN, t));
}

/**
 * The throw step of an obstacle `tu` s before arrival: null = draw it on its normal path, −1 = not thrown
 * yet (still with the boss, drawn nowhere), 0..1 = held / flying along the arc toward its join point.
 */
export function throwStep(kind: ObstacleKind, from: LaserFrom | null, tu: number, join: number): number | null {
  if (!frame.active || launchFor(kind, from) !== 'throw' || tu <= join) return null;
  if (tu > ATTACK_LEAD) return -1;
  const flyFrom = ATTACK_LEAD - WIND_UP;
  return tu >= flyFrom ? 0 : (flyFrom - tu) / (flyFrom - join);
}
