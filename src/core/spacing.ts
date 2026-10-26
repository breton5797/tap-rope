/**
 * Minimum time between hazards (GDD v4 §4, v5 §5) — shared by the generator (placement) and the
 * difficulty score (how close a stage runs to these limits).
 * after a jump laser of level L ≥ airtime(L) + 0.18s (also lets the agent land before a slide);
 * after a slide ≥ 0.6s; after a lone drone ≥ 0.5s (airtime(1) + 0.18s if the next needs ≥ 2단).
 * v5: after a lane beat ≥ LANE_GAP (a lane + laser combo takes the larger gap); two lane beats with no
 * safe lane in common ≥ LANE_SWAP_GAP (room for a two-lane move).
 */
import type { Beat, JumpLevel, LaneId, Level, Obstacle, PhysicsConfig } from '../types';
import { LANE_HAZARD_KINDS, LANES } from '../types';
import { airtimeForLevel } from './physics';

export const SAFETY = 0.18;
export const LANE_GAP = 0.45;
export const LANE_SWAP_GAP = 0.6;
const SLIDE_GAP = 0.6;
const DRONE_GAP = 0.5;

export interface GapShape {
  readonly obstacles: readonly Obstacle[];
  readonly required: JumpLevel;
  readonly needsSlide: boolean;
}

export const beatShape = (b: Beat): GapShape => ({ obstacles: b.obstacles, required: b.requiredLevel, needsSlide: b.needsSlide });

/** lanes blocked by lane hazards (sorted union; [] if none) */
export function blockedOf(obstacles: readonly Obstacle[]): LaneId[] {
  const lanes = obstacles.filter((o) => LANE_HAZARD_KINDS.includes(o.kind)).flatMap((o) => o.lanes ?? []);
  return LANES.filter((l) => lanes.includes(l));
}

const isLaneBeat = (s: GapShape) => s.obstacles.some((o) => LANE_HAZARD_KINDS.includes(o.kind));

function laserGap(prev: GapShape, cfg: PhysicsConfig): number {
  if (prev.required > 0) return airtimeForLevel(prev.required as Level, cfg) + SAFETY;
  if (prev.needsSlide) return SLIDE_GAP;
  return prev.obstacles.some((o) => o.kind === 'drone') ? DRONE_GAP : 0;
}

/** seconds the agent needs after `prev` before taking off, sliding or meeting another hazard */
export function gapAfter(prev: GapShape, cfg: PhysicsConfig): number {
  return Math.max(laserGap(prev, cfg), isLaneBeat(prev) ? LANE_GAP : 0);
}

/** true when no lane is safe at both lane beats (the agent has to switch, maybe two lanes) */
function mustSwitch(prev: GapShape, next: GapShape): boolean {
  if (!isLaneBeat(prev) || !isLaneBeat(next)) return false;
  const a = blockedOf(prev.obstacles);
  const b = blockedOf(next.obstacles);
  return LANES.every((l) => a.includes(l) || b.includes(l));
}

export function minGap(prev: GapShape, next: GapShape, cfg: PhysicsConfig): number {
  const droneOnly = prev.required === 0 && !prev.needsSlide && !isLaneBeat(prev) && prev.obstacles.some((o) => o.kind === 'drone');
  const base = droneOnly && next.required >= 2 ? airtimeForLevel(1, cfg) + SAFETY : gapAfter(prev, cfg);
  return mustSwitch(prev, next) ? Math.max(base, LANE_SWAP_GAP) : base;
}
