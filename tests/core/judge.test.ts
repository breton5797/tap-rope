import { describe, expect, it } from 'vitest';
import { judgeBeat } from '../../src/core/judge';
import type { Beat, JumpLevel, Obstacle, PlayerState } from '../../src/types';

function beat(obstacles: Obstacle[], requiredLevel: JumpLevel): Beat {
  return { id: 7, time: 3, obstacles, requiredLevel, doubleDutch: false };
}

function air(level: JumpLevel, height: number): PlayerState {
  return { height, vy: 0, grounded: false, level, airTime: 0.2, landTimer: 0, buffer: 0 };
}

const ground: PlayerState = {
  height: 0, vy: 0, grounded: true, level: 0, airTime: 0, landTimer: 1, buffer: 0,
};

describe('judgeBeat — rope/hurdle', () => {
  const rope2 = beat([{ kind: 'rope', level: 2 }], 2);

  it('misses when grounded', () => {
    expect(judgeBeat(rope2, ground)).toEqual({
      beatId: 7, grade: 'miss', hit: true, reason: 'low', collected: [],
    });
  });

  it('misses when too low', () => {
    expect(judgeBeat(rope2, air(2, 11)).reason).toBe('low');
  });

  it('misses when level is insufficient', () => {
    const r = judgeBeat(rope2, air(1, 60));
    expect(r.grade).toBe('miss');
    expect(r.reason).toBe('level');
  });

  it('passes good below PERFECT_H, perfect at/above', () => {
    expect(judgeBeat(rope2, air(2, 12)).grade).toBe('good');
    expect(judgeBeat(rope2, air(3, 40))).toEqual({
      beatId: 7, grade: 'perfect', hit: false, reason: null, collected: [],
    });
  });

  it('uses hurdle level too (combo beat)', () => {
    const combo = beat([{ kind: 'rope', level: 1 }, { kind: 'hurdle', level: 2 }], 2);
    expect(judgeBeat(combo, air(1, 60)).reason).toBe('level');
    expect(judgeBeat(combo, air(2, 60)).grade).toBe('perfect');
  });
});

describe('judgeBeat — bird', () => {
  const bird = beat([{ kind: 'bird', level: 1 }], 0);
  const birdRope = beat([{ kind: 'bird', level: 1 }, { kind: 'rope', level: 1 }], 1);

  it('bird alone: grounded passes perfect', () => {
    expect(judgeBeat(bird, ground).grade).toBe('perfect');
  });

  it('bird alone: level 1 passes perfect', () => {
    expect(judgeBeat(bird, air(1, 20)).grade).toBe('perfect');
  });

  it('bird alone: level 2 is a bird miss', () => {
    expect(judgeBeat(bird, air(2, 100))).toMatchObject({ grade: 'miss', reason: 'bird', hit: true });
  });

  it('bird has priority over low', () => {
    const r = judgeBeat(beat([{ kind: 'bird', level: 1 }, { kind: 'rope', level: 1 }], 1), air(2, 5));
    expect(r.reason).toBe('bird');
  });

  it('bird + 1단: grounded is low, level 1 high passes', () => {
    expect(judgeBeat(birdRope, ground).reason).toBe('low');
    expect(judgeBeat(birdRope, air(1, 50)).grade).toBe('perfect');
  });
});

describe('judgeBeat — pickups', () => {
  it('pickup-only beat grades none and collects when high enough', () => {
    const coin = beat([{ kind: 'coin', level: 2 }], 0);
    expect(judgeBeat(coin, air(2, 100))).toEqual({
      beatId: 7, grade: 'none', hit: false, reason: null, collected: ['coin'],
    });
    expect(judgeBeat(coin, air(1, 50)).collected).toEqual([]);
    expect(judgeBeat(coin, ground)).toMatchObject({ grade: 'none', collected: [] });
  });

  it('collects pickups on a passed hazard beat but not on a hit', () => {
    const b = beat([{ kind: 'rope', level: 1 }, { kind: 'shield', level: 1 }], 1);
    expect(judgeBeat(b, air(1, 50)).collected).toEqual(['shield']);
    expect(judgeBeat(b, ground).collected).toEqual([]);
  });
});
