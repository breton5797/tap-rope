import { describe, expect, it } from 'vitest';
import { judgeBeat } from '../../src/core/judge';
import { initialPlayer } from '../../src/core/physics';
import type { Beat, JumpLevel, Obstacle, PlayerState } from '../../src/types';

function beat(obstacles: Obstacle[], requiredLevel: JumpLevel): Beat {
  return { id: 7, time: 3, obstacles, requiredLevel, doubleDutch: false };
}

function air(level: JumpLevel, height: number, extra: Partial<PlayerState> = {}): PlayerState {
  return { ...initialPlayer(), height, grounded: false, level, airTime: 0.2, lastTap: 'jump', ...extra };
}

const ground: PlayerState = { ...initialPlayer(), landTimer: 1 };

describe('judgeBeat — rope/hurdle', () => {
  const rope2 = beat([{ kind: 'rope', level: 2 }], 2);

  it('misses when grounded', () => {
    expect(judgeBeat(rope2, ground, 'long')).toEqual({
      beatId: 7, grade: 'miss', hit: true, reason: 'low', collected: [],
    });
  });

  it('misses when too low', () => {
    expect(judgeBeat(rope2, air(2, 11), 'long').reason).toBe('low');
  });

  it('misses when level is insufficient', () => {
    const r = judgeBeat(rope2, air(1, 60), 'long');
    expect(r.grade).toBe('miss');
    expect(r.reason).toBe('level');
  });

  it('passes good below PERFECT_H, perfect at/above', () => {
    expect(judgeBeat(rope2, air(2, 12), 'long').grade).toBe('good');
    expect(judgeBeat(rope2, air(3, 40), 'long')).toEqual({
      beatId: 7, grade: 'perfect', hit: false, reason: null, collected: [],
    });
  });

  it('tumble counts as effective level 2', () => {
    expect(judgeBeat(rope2, air(1, 60, { tumble: true }), 'long').grade).toBe('perfect');
    const rope3 = beat([{ kind: 'rope', level: 3 }], 3);
    expect(judgeBeat(rope3, air(1, 60, { tumble: true }), 'long').reason).toBe('level');
  });

  it('uses hurdle level too (combo beat)', () => {
    const combo = beat([{ kind: 'rope', level: 1 }, { kind: 'hurdle', level: 2 }], 2);
    expect(judgeBeat(combo, air(1, 60), 'long').reason).toBe('level');
    expect(judgeBeat(combo, air(2, 60), 'long').grade).toBe('perfect');
  });
});

describe('judgeBeat — bird', () => {
  const bird = beat([{ kind: 'bird', level: 1 }], 0);
  const birdRope = beat([{ kind: 'bird', level: 1 }, { kind: 'rope', level: 1 }], 1);

  it('bird alone: grounded or level 1 passes perfect', () => {
    expect(judgeBeat(bird, ground, 'long').grade).toBe('perfect');
    expect(judgeBeat(bird, air(1, 20), 'long').grade).toBe('perfect');
  });

  it('bird alone: level 2 or tumbling is a bird miss', () => {
    expect(judgeBeat(bird, air(2, 100), 'long')).toMatchObject({ grade: 'miss', reason: 'bird', hit: true });
    expect(judgeBeat(bird, air(1, 100, { tumble: true }), 'solo').reason).toBe('bird');
  });

  it('bird has priority over everything', () => {
    const all = beat([{ kind: 'bird', level: 1 }, { kind: 'ball', level: 1, lane: 0 }, { kind: 'rope', level: 1 }], 1);
    expect(judgeBeat(all, air(2, 5), 'long').reason).toBe('bird');
  });

  it('bird + 1단: grounded is low, level 1 high passes', () => {
    expect(judgeBeat(birdRope, ground, 'long').reason).toBe('low');
    expect(judgeBeat(birdRope, air(1, 50), 'long').grade).toBe('perfect');
  });
});

describe('judgeBeat — ball', () => {
  const ball = beat([{ kind: 'ball', level: 1, lane: -1 }, { kind: 'ball', level: 1, lane: 1 }], 0);

  it('hits when the player is in a ball lane, even airborne', () => {
    expect(judgeBeat(ball, air(3, 150, { lane: 1 }), 'long')).toMatchObject({ reason: 'ball', hit: true });
    expect(judgeBeat(ball, { ...ground, lane: -1 }, 'solo').reason).toBe('ball');
  });

  it('ball-only beat passes perfect from a free lane', () => {
    expect(judgeBeat(ball, ground, 'long').grade).toBe('perfect');
  });

  it('defaults ball lane to centre', () => {
    const centre = beat([{ kind: 'ball', level: 1 }], 0);
    expect(judgeBeat(centre, ground, 'long').reason).toBe('ball');
  });

  it('ball comes before ring and rope checks', () => {
    const b = beat([{ kind: 'ball', level: 1, lane: 0 }, { kind: 'rope', level: 1 }], 1);
    expect(judgeBeat(b, ground, 'long').reason).toBe('ball');
    expect(judgeBeat(b, air(1, 15, { lane: 1 }), 'long').grade).toBe('good');
  });
});

describe('judgeBeat — ring', () => {
  const ring = beat([{ kind: 'ring', level: 2 }], 0);

  it('needs a tumble', () => {
    expect(judgeBeat(ring, air(3, 150), 'long')).toMatchObject({ reason: 'tumble', hit: true });
    expect(judgeBeat(ring, ground, 'long').reason).toBe('tumble');
  });

  it('tumble through the ring is perfect regardless of height', () => {
    expect(judgeBeat(ring, air(1, 5, { tumble: true }), 'long').grade).toBe('perfect');
  });
});

describe('judgeBeat — cross / direction', () => {
  const cross = beat([{ kind: 'rope', level: 1, cross: true }], 1);
  const back = beat([{ kind: 'rope', level: 1, back: true }], 1);
  const fwd = beat([{ kind: 'rope', level: 1 }], 1);

  it('cross rope requires the cross flag (after height/level)', () => {
    expect(judgeBeat(cross, air(2, 60), 'solo').reason).toBe('cross');
    expect(judgeBeat(cross, ground, 'solo').reason).toBe('low');
    expect(judgeBeat(cross, air(2, 60, { cross: true }), 'solo').grade).toBe('perfect');
  });

  it('solo rope direction must match player.backward', () => {
    expect(judgeBeat(back, air(1, 60), 'solo').reason).toBe('dir');
    expect(judgeBeat(back, air(1, 60, { backward: true }), 'solo').grade).toBe('perfect');
    expect(judgeBeat(fwd, air(1, 60, { backward: true }), 'solo').reason).toBe('dir');
  });

  it('long mode ignores direction', () => {
    expect(judgeBeat(back, air(1, 60), 'long').grade).toBe('perfect');
    expect(judgeBeat(fwd, air(1, 60, { backward: true }), 'long').grade).toBe('perfect');
  });

  it('cross is checked before direction', () => {
    const both = beat([{ kind: 'rope', level: 1, cross: true, back: true }], 1);
    expect(judgeBeat(both, air(2, 60), 'solo').reason).toBe('cross');
  });
});

describe('judgeBeat — pickups', () => {
  it('pickup-only beat grades none and collects in the right lane', () => {
    const coin = beat([{ kind: 'coin', level: 2, lane: 1 }], 0);
    expect(judgeBeat(coin, air(2, 100, { lane: 1 }), 'long')).toEqual({
      beatId: 7, grade: 'none', hit: false, reason: null, collected: ['coin'],
    });
    expect(judgeBeat(coin, air(2, 100), 'long').collected).toEqual([]);
    expect(judgeBeat(coin, air(1, 50, { lane: 1 }), 'long').collected).toEqual([]);
    expect(judgeBeat(coin, { ...ground, lane: 1 }, 'long')).toMatchObject({ grade: 'none', collected: [] });
    expect(judgeBeat(coin, air(1, 100, { lane: 1, tumble: true }), 'long').collected).toEqual(['coin']);
  });

  it('collects pickups on a passed hazard beat but not on a hit', () => {
    const b = beat([{ kind: 'rope', level: 1 }, { kind: 'shield', level: 1 }], 1);
    expect(judgeBeat(b, air(1, 50), 'long').collected).toEqual(['shield']);
    expect(judgeBeat(b, ground, 'long').collected).toEqual([]);
  });
});
