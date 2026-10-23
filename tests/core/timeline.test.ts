import { describe, expect, it } from 'vitest';
import { movesForMix } from '../../src/core/moves';
import { laneItems, moveForBeat, visibleObstacles } from '../../src/core/timeline';
import type { Beat, JumpLevel, Obstacle } from '../../src/types';
import { LANE_LEAD, VISIBLE_LEAD } from '../../src/types';

function mk(id: number, time: number, obstacles: Obstacle[], requiredLevel: JumpLevel, extra: Partial<Beat> = {}): Beat {
  const needsSlide = obstacles.some((o) => o.kind === 'high' || o.kind === 'ceiling');
  return { id, time, obstacles, requiredLevel, needsSlide, pulse: false, ...extra };
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
});

describe('movesForMix', () => {
  const none = { beam: 0, slide: 0, high: 0, rear: 0, drone: 0, gate: 0, pulse: 0 };

  it('derives exactly the producible moves', () => {
    expect(movesForMix([1, 0, 0], none)).toEqual(['jump']);
    expect(movesForMix([1, 0, 0], { ...none, beam: 1 })).toEqual(['beam']);
    const all = { beam: 0.5, slide: 0.5, high: 0.5, rear: 0.5, drone: 0.5, gate: 0.5, pulse: 0.5 };
    expect(movesForMix([0.4, 0.3, 0.3], all)).toEqual(['jump', 'beam', 'double', 'slide', 'drone', 'triple', 'high', 'rear', 'gate', 'pulse']);
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
    mk(4, 4.8, [{ kind: 'coin', level: 3 }], 0),
    mk(5, 20, [{ kind: 'floor', level: 1 }], 1),
  ];

  it('lists obstacles within VISIBLE_LEAD with direction, heights and stable ids', () => {
    const v = visibleObstacles(beats, 3);
    expect(v.map((o) => o.id)).toEqual(['0-0', '0-1', '1-0', '2-0', '3-0', '4-0']);
    expect(v[0]).toEqual({ id: '0-0', kind: 'floor', level: 1, from: 'bottom', timeUntil: 0, height: 0 });
    expect(v.map((o) => o.from)).toEqual(['bottom', 'front', 'back', 'front', 'top', null]);
    expect(v[2].timeUntil).toBeCloseTo(0.5);
    expect(v[5].height).toBe(185);
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
      { beatId: 0, timeUntil: expect.closeTo(-0.1, 6), kinds: ['floor'], level: 1, move: 'jump', from: 'bottom' },
      { beatId: 1, timeUntil: expect.closeTo(0.9, 6), kinds: ['high'], level: 0, move: 'high', from: 'back' },
      { beatId: 2, timeUntil: expect.closeTo(1.4, 6), kinds: ['coin'], level: 0, move: 'jump', from: null },
    ]);
    expect(laneItems(beats, 2.3).map((i) => i.beatId)).toEqual([1, 2]);
    expect(laneItems(beats, 10 - LANE_LEAD + 0.01).map((i) => i.beatId)).toEqual([3]);
  });
});
