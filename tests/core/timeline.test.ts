import { describe, expect, it } from 'vitest';
import { MOVE_ORDER, movesForMix } from '../../src/core/moves';
import { isSudden, laneItems, moveForBeat, visibleDoors, visibleObstacles } from '../../src/core/timeline';
import type { Beat, Door, JumpLevel, Obstacle } from '../../src/types';
import { LANE_LEAD, VISIBLE_LEAD } from '../../src/types';

function mk(id: number, time: number, obstacles: Obstacle[], requiredLevel: JumpLevel, extra: Partial<Beat> = {}): Beat {
  const needsSlide = obstacles.some((o) => o.kind === 'high' || o.kind === 'ceiling');
  const blockedLanes = [...new Set(obstacles.filter((o) => ['guard', 'drop', 'chaser'].includes(o.kind))
    .flatMap((o) => o.lanes ?? []))].sort();
  return { id, time, obstacles, requiredLevel, needsSlide, pulse: false, blockedLanes, section: 0, ...extra };
}

describe('moveForBeat', () => {
  const m = (obstacles: Obstacle[], req: JumpLevel, extra: Partial<Beat> = {}) => moveForBeat(mk(0, 1, obstacles, req, extra));

  it('maps beats to moves by the §8 priority', () => {
    expect(m([{ kind: 'floor', level: 1 }], 1, { pulse: true })).toBe('pulse');
    expect(m([{ kind: 'floor', level: 1 }, { kind: 'drone', level: 1 }], 1)).toBe('gate');
    expect(m([{ kind: 'drone', level: 1 }], 0)).toBe('drone');
    expect(m([{ kind: 'high', level: 1, from: 'back' }], 0)).toBe('high');
    expect(m([{ kind: 'ceiling', level: 1 }], 0)).toBe('slide');
    expect(m([{ kind: 'beam', level: 3, from: 'back' }], 3)).toBe('rear');
    expect(m([{ kind: 'beam', level: 3, from: 'front' }], 3)).toBe('triple');
    expect(m([{ kind: 'beam', level: 2 }], 2)).toBe('double');
    expect(m([{ kind: 'beam', level: 1, from: 'front' }], 1)).toBe('beam');
    expect(m([{ kind: 'floor', level: 1 }], 1)).toBe('jump');
    expect(m([{ kind: 'coin', level: 2 }], 0)).toBe('jump');
  });

  it('puts the v5 lane moves first: lanejump → chaser → drop → lane', () => {
    expect(m([{ kind: 'guard', level: 1, lanes: [1] }], 0)).toBe('lane');
    expect(m([{ kind: 'drop', level: 1, lanes: [0, 1] }], 0)).toBe('drop');
    expect(m([{ kind: 'chaser', level: 1, lanes: [2] }], 0)).toBe('chaser');
    expect(m([{ kind: 'guard', level: 1, lanes: [1] }, { kind: 'floor', level: 1 }], 1)).toBe('lanejump');
    expect(m([{ kind: 'chaser', level: 1, lanes: [1] }, { kind: 'ceiling', level: 1 }], 0)).toBe('lanejump');
    expect(m([{ kind: 'drop', level: 1, lanes: [1] }, { kind: 'beam', level: 1, from: 'back' }], 1)).toBe('lanejump');
    expect(m([{ kind: 'guard', level: 1, lanes: [1] }, { kind: 'coin', level: 1, lanes: [0] }], 0)).toBe('lane');
  });

  it('lists the moves in introduction order (§7)', () => {
    expect(MOVE_ORDER).toEqual([
      'jump', 'lane', 'beam', 'double', 'slide', 'drone', 'drop', 'triple', 'high', 'rear', 'chaser', 'gate', 'pulse', 'lanejump',
    ]);
  });
});

describe('movesForMix', () => {
  const none = { beam: 0, slide: 0, high: 0, rear: 0, drone: 0, gate: 0, pulse: 0, lane: 0, drop: 0, chaser: 0, laneCombo: 0 };

  it('derives exactly the producible moves', () => {
    expect(movesForMix([1, 0, 0], none)).toEqual(['jump']);
    expect(movesForMix([1, 0, 0], { ...none, beam: 1 })).toEqual(['beam']);
    const all = { beam: 0.5, slide: 0.5, high: 0.5, rear: 0.5, drone: 0.5, gate: 0.5, pulse: 0.5, lane: 0.3, drop: 0.3, chaser: 0.3, laneCombo: 0.3 };
    expect(movesForMix([0.4, 0.3, 0.3], all)).toEqual(MOVE_ORDER);
  });

  it('derives the lane moves from mix.lane / drop / chaser / laneCombo', () => {
    expect(movesForMix([1, 0, 0], { ...none, lane: 0.5 })).toEqual(['jump', 'lane']);
    expect(movesForMix([1, 0, 0], { ...none, lane: 0.5, drop: 0.6 })).toEqual(['jump', 'lane', 'drop']);
    expect(movesForMix([1, 0, 0], { ...none, lane: 0.5, chaser: 1 })).toEqual(['jump', 'chaser']);
    expect(movesForMix([1, 0, 0], { ...none, lane: 0.5, drop: 0.5, chaser: 0.5 })).toEqual(['jump', 'drop', 'chaser']);
    expect(movesForMix([1, 0, 0], { ...none, lane: 0.5, laneCombo: 0.6 })).toEqual(['jump', 'lane', 'lanejump']);
    expect(movesForMix([1, 0, 0], { ...none, lane: 0.5, drop: 0.5, laneCombo: 1 })).toEqual(['jump', 'lanejump']);
    expect(movesForMix([1, 0, 0], { ...none, drop: 0.5, chaser: 0.5, laneCombo: 0.5 })).toEqual(['jump']); // no lane beats
  });

  it('accounts for full shares shadowing other moves', () => {
    expect(movesForMix([0.5, 0.5, 0], { ...none, beam: 0.5, rear: 1 })).toEqual(['jump', 'rear']);
    expect(movesForMix([1, 0, 0], { ...none, slide: 0.4, high: 1 })).toEqual(['jump', 'high']);
    expect(movesForMix([1, 0, 0], { ...none, drone: 0.4, gate: 1 })).toEqual(['jump', 'gate']);
    expect(movesForMix([1, 0, 0], { ...none, rear: 0.5 })).toEqual(['jump']); // nothing to fly in from behind
  });
});

describe('visibleObstacles', () => {
  const beats = [
    mk(0, 3, [{ kind: 'floor', level: 1 }, { kind: 'drone', level: 1 }], 1),
    mk(1, 3.5, [{ kind: 'beam', level: 2, from: 'back' }], 2),
    mk(2, 4, [{ kind: 'high', level: 1, from: 'front' }], 0),
    mk(3, 4.5, [{ kind: 'ceiling', level: 1 }], 0),
    mk(4, 4.8, [{ kind: 'coin', level: 3, lanes: [2] }], 0),
    mk(5, 20, [{ kind: 'floor', level: 1 }], 1),
  ];

  it('lists obstacles within VISIBLE_LEAD with direction, heights and stable ids', () => {
    const v = visibleObstacles(beats, 3);
    expect(v.map((o) => o.id)).toEqual(['0-0', '0-1', '1-0', '2-0', '3-0', '4-0']);
    expect(v[0]).toEqual({
      id: '0-0', kind: 'floor', level: 1, from: 'bottom', timeUntil: 0, height: 0, lanes: null, sudden: false,
    });
    expect(v.map((o) => o.from)).toEqual(['bottom', 'front', 'back', 'front', 'top', null]);
    expect(v[2].timeUntil).toBeCloseTo(0.5);
    expect(v[5].height).toBe(185);
    expect(v[5].lanes).toEqual([2]);
  });

  it('v5: lane hazards carry their lanes; drops, chasers and rear lasers are sudden', () => {
    const lane = [
      mk(0, 1, [{ kind: 'guard', level: 1, lanes: [0, 1] }], 0),
      mk(1, 1.5, [{ kind: 'drop', level: 1, lanes: [2] }], 0),
      mk(2, 2, [{ kind: 'chaser', level: 1, lanes: [1] }, { kind: 'high', level: 1, from: 'back' }], 0),
      mk(3, 2.5, [{ kind: 'beam', level: 1, from: 'back' }, { kind: 'high', level: 1, from: 'front' }], 1),
    ];
    const v = visibleObstacles(lane, 0.9);
    expect(v.map((o) => o.lanes)).toEqual([[0, 1], [2], [1], null, null, null]);
    expect(v.map((o) => o.sudden)).toEqual([false, true, true, true, true, false]);
    expect(v.map((o) => o.from)).toEqual(['front', 'top', 'back', 'back', 'back', 'front']);
    expect(v.slice(0, 3).map((o) => o.height)).toEqual([0, 0, 36]);
  });

  it('isSudden flags drops, chasers and rear beams/highs only', () => {
    expect(isSudden({ kind: 'drop', level: 1, lanes: [0] })).toBe(true);
    expect(isSudden({ kind: 'chaser', level: 1, lanes: [2] })).toBe(true);
    expect(isSudden({ kind: 'high', level: 1, from: 'back' })).toBe(true);
    expect(isSudden({ kind: 'beam', level: 2, from: 'back' })).toBe(true);
    expect(isSudden({ kind: 'beam', level: 2, from: 'front' })).toBe(false);
    expect(isSudden({ kind: 'guard', level: 1, lanes: [1] })).toBe(false);
    expect(isSudden({ kind: 'ceiling', level: 1 })).toBe(false);
  });

  it('defaults beam/high direction to front', () => {
    const v = visibleObstacles([mk(0, 1, [{ kind: 'beam', level: 1 }], 1)], 0.5);
    expect(v[0].from).toBe('front');
  });

  it('keeps passed obstacles 0.4s and hides ones beyond VISIBLE_LEAD', () => {
    const ids = (t: number) => visibleObstacles(beats, t).map((o) => o.id);
    expect(ids(3.39)).toContain('0-0');
    expect(ids(3.41)).not.toContain('0-0');
    expect(ids(20 - VISIBLE_LEAD)).toContain('5-0');
    expect(ids(20 - VISIBLE_LEAD - 0.01)).not.toContain('5-0');
  });
});

describe('laneItems', () => {
  const beats = [
    mk(0, 2, [{ kind: 'floor', level: 1 }], 1),
    mk(1, 3, [{ kind: 'high', level: 1, from: 'back' }], 0),
    mk(2, 3.5, [{ kind: 'coin', level: 1 }], 0),
    mk(3, 10, [{ kind: 'beam', level: 3, from: 'front' }], 3),
  ];

  it('shows upcoming beats with move, level and main direction', () => {
    expect(laneItems(beats, 2.1)).toEqual([
      { beatId: 0, timeUntil: expect.closeTo(-0.1, 6), kinds: ['floor'], level: 1, move: 'jump', from: 'bottom', blocked: [] },
      { beatId: 1, timeUntil: expect.closeTo(0.9, 6), kinds: ['high'], level: 0, move: 'high', from: 'back', blocked: [] },
      { beatId: 2, timeUntil: expect.closeTo(1.4, 6), kinds: ['coin'], level: 0, move: 'jump', from: null, blocked: [] },
    ]);
    expect(laneItems(beats, 2.3).map((i) => i.beatId)).toEqual([1, 2]);
    expect(laneItems(beats, 10 - LANE_LEAD + 0.01).map((i) => i.beatId)).toEqual([3]);
  });
});

describe('laneItems — v5 lanes', () => {
  it('shows blocked lanes, the lane move and the main direction', () => {
    const beats = [
      mk(0, 1, [{ kind: 'guard', level: 1, lanes: [0, 2] }], 0),
      mk(1, 1.5, [{ kind: 'drop', level: 1, lanes: [1] }, { kind: 'floor', level: 1 }], 1),
      mk(2, 2, [{ kind: 'chaser', level: 1, lanes: [2] }], 0),
    ];
    const items = laneItems(beats, 0.5);
    expect(items.map((i) => i.blocked)).toEqual([[0, 2], [1], [2]]);
    expect(items.map((i) => i.move)).toEqual(['lane', 'lanejump', 'chaser']);
    expect(items.map((i) => i.from)).toEqual(['front', 'bottom', 'back']);
  });
});

describe('visibleDoors', () => {
  const scene = { world: 0, variant: 'base' } as const;
  const doors: Door[] = [
    { time: 10, section: 1, transition: 'turn', from: scene, to: { world: 3, variant: 'base' } },
    { time: 30, section: 2, transition: 'stairs', from: { world: 3, variant: 'base' }, to: { world: 3, variant: 'steam' } },
  ];

  it('shows a door from 3.0s before it until 1.0s after', () => {
    expect(visibleDoors(doors, 6.99)).toEqual([]);
    expect(visibleDoors(doors, 7)).toEqual([
      { timeUntil: 3, section: 1, transition: 'turn', from: scene, to: { world: 3, variant: 'base' } },
    ]);
    expect(visibleDoors(doors, 11)[0].timeUntil).toBeCloseTo(-1, 9);
    expect(visibleDoors(doors, 11.01)).toEqual([]);
    expect(visibleDoors(doors, 28).map((d) => d.section)).toEqual([2]);
  });
});
