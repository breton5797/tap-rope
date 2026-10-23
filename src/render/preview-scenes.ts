// Mock beat patterns for the render preview harness (LASER ESCAPE).
import type { LaserFrom, Level, MoveId, ObstacleKind } from '../types';

export interface Item {
  readonly kind: ObstacleKind;
  readonly level: Level;
  readonly from: LaserFrom | null;
}

export interface BeatSpec {
  readonly items: readonly Item[];
  readonly level: Level; // jump level needed (1 also for drone-safe hops)
  readonly move: MoveId;
  readonly action: 'jump' | 'slide' | 'dive' | 'none';
}

export interface SceneCfg {
  readonly interval: number;
  readonly pattern: readonly BeatSpec[];
  readonly running: boolean;
  readonly fever?: boolean;
  readonly hit?: boolean;
  readonly escort?: boolean;
  readonly pulse?: boolean;
}

const it = (kind: ObstacleKind, level: Level = 1, from: LaserFrom | null = null): Item => ({ kind, level, from });
const FLOOR = it('floor', 1, 'bottom');
const CEIL = it('ceiling', 1, 'top');
const beam = (l: Level, from: LaserFrom = 'front'): Item => it('beam', l, from);
const high = (from: LaserFrom = 'front'): Item => it('high', 1, from);
const b = (items: readonly Item[], level: Level, move: MoveId, action: BeatSpec['action'] = 'jump'): BeatSpec => ({ items, level, move, action });

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
};
