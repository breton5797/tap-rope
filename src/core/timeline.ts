/**
 * Time → render state helpers (GDD v4 §1, §8).
 * - visibleObstacles: every obstacle from VISIBLE_LEAD seconds before its beat (edge warnings
 *   start then) until 0.4s after it passed, with its direction and float height.
 * - laneItems: rhythm-lane preview entries with the move badge and the main laser direction.
 */
import type { Beat, LaneItem, LaserFrom, Obstacle, ObstacleKind, VisibleObstacle } from '../types';
import { HAZARD_KINDS, LANE_LEAD, VISIBLE_LEAD } from '../types';
import { moveForBeat } from './moves';

export { moveForBeat } from './moves';

const KEEP_PASSED = 0.4;
const LANE_PAST = 0.25;
/** px above the floor of each obstacle's bottom (the renderer may stylise around these) */
const HEIGHT: Readonly<Partial<Record<ObstacleKind, number>>> = { floor: 0, beam: 8, high: 58, ceiling: 44, drone: 54 };
const PICKUP_HEIGHT = { 1: 50, 2: 120, 3: 185 } as const;

function fromOf(o: Obstacle): LaserFrom | null {
  switch (o.kind) {
    case 'floor': return 'bottom';
    case 'ceiling': return 'top';
    case 'drone': return 'front';
    case 'beam':
    case 'high': return o.from ?? 'front';
    default: return null;
  }
}

const heightOf = (o: Obstacle): number => HEIGHT[o.kind] ?? PICKUP_HEIGHT[o.level];

export function visibleObstacles(beats: readonly Beat[], t: number): VisibleObstacle[] {
  return beats.flatMap((beat) => {
    const timeUntil = beat.time - t;
    if (timeUntil < -KEEP_PASSED || timeUntil > VISIBLE_LEAD + 1e-9) return [];
    return beat.obstacles.map((o, index): VisibleObstacle => ({
      id: `${beat.id}-${index}`, kind: o.kind, level: o.level, from: fromOf(o), timeUntil, height: heightOf(o),
    }));
  });
}

/** direction of the laser that defines the beat's move (slide lasers, then beams, floor, drone) */
function mainFrom(b: Beat): LaserFrom | null {
  const order: readonly ObstacleKind[] = ['high', 'ceiling', 'beam', 'floor', 'drone'];
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
    }));
}
