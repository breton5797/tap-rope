// Mock beat patterns for the render preview harness (LASER ESCAPE).
import type { LaneId, LaserFrom, Level, MoveId, ObstacleKind, TransitionKind } from '../types';

export interface Item {
  readonly kind: ObstacleKind;
  readonly level: Level;
  readonly from: LaserFrom | null;
  /** lane hazards / pickups: their lanes; absent = full width (pickups default to the middle lane) */
  readonly lanes?: readonly LaneId[];
}

export interface BeatSpec {
  readonly items: readonly Item[];
  readonly level: Level; // jump level needed (1 also for drone-safe hops)
  readonly move: MoveId;
  readonly action: 'jump' | 'slide' | 'dive' | 'none';
  /** v5: lane the bot moves to before this beat (dodging lane hazards) */
  readonly lane?: LaneId;
}

export interface SceneCfg {
  readonly interval: number;
  readonly pattern: readonly BeatSpec[];
  readonly running: boolean;
  readonly fever?: boolean;
  readonly hit?: boolean;
  readonly escort?: boolean;
  readonly pulse?: boolean;
  /** v5: a section door every `doorEvery` seconds with this transition */
  readonly door?: TransitionKind;
}

const it = (kind: ObstacleKind, level: Level = 1, from: LaserFrom | null = null): Item => ({ kind, level, from });
const FLOOR = it('floor', 1, 'bottom');
const CEIL = it('ceiling', 1, 'top');
const beam = (l: Level, from: LaserFrom = 'front'): Item => it('beam', l, from);
const high = (from: LaserFrom = 'front'): Item => it('high', 1, from);
const b = (items: readonly Item[], level: Level, move: MoveId, action: BeatSpec['action'] = 'jump'): BeatSpec => ({ items, level, move, action });
const at = (spec: BeatSpec, lane: LaneId): BeatSpec => ({ ...spec, lane });
const lanes = (kind: ObstacleKind, ls: readonly LaneId[], from: LaserFrom | null = null): Item => ({ kind, level: 1, from, lanes: ls });
const guard = (...ls: LaneId[]): Item => lanes('guard', ls, 'front');
const drop = (...ls: LaneId[]): Item => lanes('drop', ls, 'top');
const chaser = (l: LaneId): Item => lanes('chaser', [l], 'back');
const coinIn = (l: LaneId, level: Level = 1): Item => ({ kind: 'coin', level, from: null, lanes: [l] });
const lane = (l: LaneId): BeatSpec => at(b([coinIn(l)], 1, 'lane', 'none'), l);

const MIXED: readonly BeatSpec[] = [
  b([FLOOR], 1, 'jump'),
  b([beam(2), it('coin', 2)], 2, 'double'),
  b([CEIL], 1, 'slide', 'slide'),
  b([FLOOR, it('drone')], 1, 'gate'),
  b([high('back')], 1, 'rear', 'slide'),
  b([beam(3)], 3, 'triple'),
];

export const SCENES: Readonly<Record<string, SceneCfg>> = {
  idle: { interval: 1.4, pattern: [], running: false },
  run: { interval: 1.4, pattern: [], running: true },
  jump2: { interval: 1.4, pattern: [b([beam(2)], 2, 'double')], running: true },
  jump3: { interval: 1.6, pattern: [b([beam(3)], 3, 'triple')], running: true },
  slide: { interval: 1.2, pattern: [b([CEIL], 1, 'slide', 'slide')], running: true },
  dive: { interval: 1.5, pattern: [b([high()], 1, 'high', 'dive')], running: true },
  floor: { interval: 1.1, pattern: [b([FLOOR], 1, 'jump'), b([FLOOR, it('coin', 1)], 1, 'jump')], running: true },
  beams: { interval: 1.5, pattern: [b([beam(1)], 1, 'beam'), b([beam(2)], 2, 'double'), b([beam(3)], 3, 'triple')], running: true },
  rear: { interval: 1.4, pattern: [b([beam(1, 'back')], 1, 'rear'), b([high('back')], 1, 'rear', 'slide')], running: true },
  ceiling: { interval: 1.2, pattern: [b([CEIL], 1, 'slide', 'slide'), b([CEIL, it('shield', 1)], 1, 'slide', 'slide')], running: true },
  high: { interval: 1.2, pattern: [b([high()], 1, 'high', 'slide')], running: true },
  drone: { interval: 1.3, pattern: [b([it('drone')], 1, 'drone', 'none'), b([FLOOR], 1, 'jump')], running: true },
  gate: { interval: 1.3, pattern: [b([FLOOR, it('drone')], 1, 'gate')], running: true },
  pulse: { interval: 0.6, pattern: [b([FLOOR], 1, 'pulse')], running: true, pulse: true },
  fever: { interval: 1.3, pattern: MIXED, running: true, fever: true },
  hit: { interval: 1.2, pattern: [b([FLOOR], 1, 'jump'), b([beam(1)], 1, 'beam')], running: true, hit: true },
  escort: { interval: 1.3, pattern: MIXED, running: true, escort: true },
  // ---- v5 lanes ----
  lanes: { interval: 1.0, pattern: [lane(0), lane(1), lane(2), lane(1)], running: true },
  guard: {
    interval: 1.3,
    pattern: [at(b([guard(1)], 1, 'lane', 'none'), 0), at(b([guard(0, 1)], 1, 'lane', 'none'), 2), at(b([guard(2)], 1, 'lane', 'none'), 1)],
    running: true,
  },
  drop: {
    interval: 1.4,
    pattern: [at(b([drop(1)], 1, 'drop', 'none'), 2), at(b([drop(1, 2)], 1, 'drop', 'none'), 0), at(b([drop(0)], 1, 'drop', 'none'), 1)],
    running: true,
  },
  chaser: {
    interval: 1.4,
    pattern: [at(b([chaser(1)], 1, 'chaser', 'none'), 0), at(b([chaser(0)], 1, 'chaser', 'none'), 1), at(b([chaser(2)], 1, 'chaser', 'none'), 1)],
    running: true,
  },
  warn: {
    interval: 1.5,
    pattern: [at(b([drop(0, 1)], 1, 'drop', 'none'), 2), at(b([chaser(2)], 1, 'chaser', 'none'), 1), at(b([beam(1, 'back')], 1, 'rear'), 1)],
    running: true,
  },
  lanejump: {
    interval: 1.5,
    pattern: [at(b([guard(0, 1), FLOOR], 1, 'lanejump'), 2), at(b([guard(2), CEIL], 1, 'lanejump', 'slide'), 1), at(b([guard(1, 2), beam(1)], 1, 'lanejump'), 0)],
    running: true,
  },
  sheets: {
    interval: 1.3,
    pattern: [at(b([FLOOR], 1, 'jump'), 0), at(b([beam(2)], 2, 'double'), 2), at(b([CEIL], 1, 'slide', 'slide'), 1), at(b([high()], 1, 'high', 'slide'), 2), at(b([FLOOR, it('drone')], 1, 'gate'), 0)],
    running: true,
  },
  doorTurn: { interval: 1.0, pattern: [lane(1)], running: true, door: 'turn' },
  doorStairs: { interval: 1.0, pattern: [lane(1)], running: true, door: 'stairs' },
  doorElevator: { interval: 1.0, pattern: [lane(1)], running: true, door: 'elevator' },
};
