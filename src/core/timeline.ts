/**
 * Time → render state helpers (GDD v4 §1, §8; v5 §3, §6, §8).
 * - visibleObstacles: every obstacle from VISIBLE_LEAD seconds before its beat (edge warnings
 *   start then) until 0.4s after it passed, with its direction, float height, lanes (null = full
 *   width) and whether it is a sudden attack (drop, chaser, rear beam/high: "!" from WARN_LEAD).
 * - laneItems: rhythm-lane preview entries with the move badge, the main hazard direction and the
 *   blocked lanes.
 * - visibleDoors: section doors from 3.0s before the agent reaches them until 1.0s after.
 */
import type { Beat, Door, DoorView, LaneItem, LaserFrom, Obstacle, ObstacleKind, VisibleObstacle } from '../types';
import { HAZARD_KINDS, LANE_LEAD, VISIBLE_LEAD } from '../types';
import { moveForBeat } from './moves';

export { moveForBeat } from './moves';

const KEEP_PASSED = 0.4;
const LANE_PAST = 0.25;
const DOOR_AHEAD = 3.0;
const DOOR_PAST = 1.0;
/**
 * px above the floor of each obstacle's bottom at its beat time (the renderer may stylise around these).
 * guard stands on the floor (0); drop is a crate whose bottom lands on the floor at the beat (0 — it falls
 * from above while timeUntil > 0); chaser is a pursuit drone skimming at waist height (36).
 */
const HEIGHT: Readonly<Partial<Record<ObstacleKind, number>>> = {
  floor: 0, beam: 8, high: 58, ceiling: 44, drone: 54, guard: 0, drop: 0, chaser: 36,
};
const PICKUP_HEIGHT = { 1: 50, 2: 120, 3: 185 } as const;

function fromOf(o: Obstacle): LaserFrom | null {
  switch (o.kind) {
    case 'floor': return 'bottom';
    case 'ceiling':
    case 'drop': return 'top';
    case 'drone':
    case 'guard': return 'front';
    case 'chaser': return 'back';
    case 'beam':
    case 'high': return o.from ?? 'front';
    default: return null;
  }
}

const heightOf = (o: Obstacle): number => HEIGHT[o.kind] ?? PICKUP_HEIGHT[o.level];
/** drop, chaser and rear beam/high: warned with "!" on their lanes from WARN_LEAD (session alerts use it too) */
export const isSudden = (o: Obstacle): boolean =>
  o.kind === 'drop' || o.kind === 'chaser' || ((o.kind === 'beam' || o.kind === 'high') && o.from === 'back');

export function visibleObstacles(beats: readonly Beat[], t: number): VisibleObstacle[] {
  return beats.flatMap((beat) => {
    const timeUntil = beat.time - t;
    if (timeUntil < -KEEP_PASSED || timeUntil > VISIBLE_LEAD + 1e-9) return [];
    return beat.obstacles.map((o, index): VisibleObstacle => ({
      id: `${beat.id}-${index}`, kind: o.kind, level: o.level, from: fromOf(o), timeUntil, height: heightOf(o),
      lanes: o.lanes ?? null, sudden: isSudden(o),
    }));
  });
}

/** direction of the hazard that defines the beat's icon (slide lasers, beams, floor, drone, then lane hazards) */
function mainFrom(b: Beat): LaserFrom | null {
  const order: readonly ObstacleKind[] = ['high', 'ceiling', 'beam', 'floor', 'drone', 'chaser', 'drop', 'guard'];
  const main = order.map((k) => b.obstacles.find((o) => o.kind === k)).find((o) => o !== undefined);
  return main && HAZARD_KINDS.includes(main.kind) ? fromOf(main) : null;
}

export function laneItems(beats: readonly Beat[], t: number): LaneItem[] {
  return beats
    .filter((b) => b.time - t >= -LANE_PAST && b.time - t <= LANE_LEAD)
    .map((b) => ({
      beatId: b.id,
      timeUntil: b.time - t,
      kinds: b.obstacles.map((o) => o.kind),
      level: b.requiredLevel,
      move: moveForBeat(b),
      from: mainFrom(b),
      blocked: b.blockedLanes,
    }));
}

export function visibleDoors(doors: readonly Door[], t: number): DoorView[] {
  return doors
    .filter((d) => d.time - t >= -DOOR_PAST - 1e-9 && d.time - t <= DOOR_AHEAD + 1e-9)
    .map((d) => ({ timeUntil: d.time - t, section: d.section, transition: d.transition, from: d.from, to: d.to }));
}
