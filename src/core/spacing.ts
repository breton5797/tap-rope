/**
 * Minimum time between hazards (GDD v4 §4) — shared by the generator (placement) and the
 * difficulty score (how close a stage runs to these limits).
 * after a jump laser of level L ≥ airtime(L) + 0.18s (also lets the agent land before a slide);
 * after a slide ≥ 0.6s; after a lone drone ≥ 0.5s (airtime(1) + 0.18s if the next needs ≥ 2단).
 */
import type { Beat, JumpLevel, Level, Obstacle, PhysicsConfig } from '../types';
import { airtimeForLevel } from './physics';

export const SAFETY = 0.18;
const SLIDE_GAP = 0.6;
const DRONE_GAP = 0.5;

export interface GapShape {
  readonly obstacles: readonly Obstacle[];
  readonly required: JumpLevel;
  readonly needsSlide: boolean;
}

export const beatShape = (b: Beat): GapShape => ({ obstacles: b.obstacles, required: b.requiredLevel, needsSlide: b.needsSlide });

/** seconds the agent needs after `prev` before taking off or sliding again */
export function gapAfter(prev: GapShape, cfg: PhysicsConfig): number {
  if (prev.required > 0) return airtimeForLevel(prev.required as Level, cfg) + SAFETY;
  if (prev.needsSlide) return SLIDE_GAP;
  return prev.obstacles.some((o) => o.kind === 'drone') ? DRONE_GAP : 0;
}

export function minGap(prev: GapShape, next: GapShape, cfg: PhysicsConfig): number {
  const droneOnly = prev.required === 0 && !prev.needsSlide && prev.obstacles.some((o) => o.kind === 'drone');
  return droneOnly && next.required >= 2 ? airtimeForLevel(1, cfg) + SAFETY : gapAfter(prev, cfg);
}
