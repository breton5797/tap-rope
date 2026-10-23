/**
 * Minimum time between hazards (GDD §3, v2 §11) — shared by the generator (placement)
 * and the difficulty score (how close a stage runs to these limits).
 * after: level L ≥ airtime(L)+0.18s, ring ≥ airtimeTumble+0.18s, cross ≥ airtime(2)+0.18s,
 *        lone bird ≥ 0.5s (airtime(1)+0.18s if the next hazard needs ≥ 2단), lone ball ≥ airtime(1)+0.18s;
 * before: 2 balls ≥ 2·airtime(1)+0.3s, 1 ball ≥ airtime(1)+0.18s, cross ≥ airtime(2)+0.18s.
 */
import type { Beat, JumpLevel, Level, Obstacle, ObstacleKind, PhysicsConfig } from '../types';
import { airtimeForLevel, airtimeTumble } from './physics';

export const SAFETY = 0.18;
const BIRD_GAP = 0.5;
const TWO_HOP_EXTRA = 0.3;

export interface GapShape {
  readonly obstacles: readonly Obstacle[];
  readonly required: JumpLevel;
}

export const beatShape = (b: Beat): GapShape => ({ obstacles: b.obstacles, required: b.requiredLevel });

const hasKind = (s: GapShape, k: ObstacleKind) => s.obstacles.some((o) => o.kind === k);
const ballCount = (s: GapShape) => s.obstacles.filter((o) => o.kind === 'ball').length;
const isCross = (s: GapShape) => s.obstacles.some((o) => o.kind === 'rope' && o.cross === true);

/** seconds the player needs after `prev` before taking off for anything */
export function gapAfter(prev: GapShape, cfg: PhysicsConfig): number {
  if (hasKind(prev, 'ring')) return airtimeTumble(cfg) + SAFETY;
  if (isCross(prev)) return airtimeForLevel(2, cfg) + SAFETY;
  if (prev.required > 0) return airtimeForLevel(prev.required as Level, cfg) + SAFETY;
  if (hasKind(prev, 'bird')) return BIRD_GAP;
  return airtimeForLevel(1, cfg) + SAFETY; // ball-only: the side hop was a 1단 jump
}

/** seconds of preparation `next` needs (lane hops, tap → air swipe) */
export function gapBefore(next: GapShape, cfg: PhysicsConfig): number {
  const a1 = airtimeForLevel(1, cfg);
  const balls = ballCount(next);
  if (balls >= 2) return 2 * a1 + TWO_HOP_EXTRA;
  if (balls === 1) return a1 + SAFETY;
  if (isCross(next)) return airtimeForLevel(2, cfg) + SAFETY;
  return 0;
}

export function minGap(prev: GapShape, next: GapShape, cfg: PhysicsConfig): number {
  const birdOnly = prev.required === 0 && hasKind(prev, 'bird');
  const after = birdOnly && next.required >= 2 ? airtimeForLevel(1, cfg) + SAFETY : gapAfter(prev, cfg);
  return Math.max(after, gapBefore(next, cfg));
}
