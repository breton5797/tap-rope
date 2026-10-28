import { describe, expect, it } from 'vitest';
import { GREAT_WINDOW, judgeBeat, LANE_EARLY, PERFECT_WINDOW, SLIDE_IDEAL } from '../../src/core/judge';
import { DEFAULT_PHYSICS, initialPlayer } from '../../src/core/physics';
import type { Beat, JumpLevel, LaneId, Obstacle, PlayerState } from '../../src/types';

function beat(obstacles: Obstacle[], requiredLevel: JumpLevel, needsSlide = false): Beat {
  const blockedLanes = [...new Set(obstacles.filter((o) => ['guard', 'drop', 'chaser'].includes(o.kind))
    .flatMap((o) => o.lanes ?? []))].sort();
  return { id: 7, time: 3, obstacles, requiredLevel, needsSlide, pulse: false, blockedLanes, section: 0 };
}

const inLane = (p: PlayerState, lane: LaneId): PlayerState => ({ ...p, lane, laneFrom: lane });

/** airborne at `height`; `offset` s from the apex of the current segment (+ = still rising = tapped late) */
function air(level: JumpLevel, height: number, offset = 0): PlayerState {
  return { ...initialPlayer(), height, vy: offset * DEFAULT_PHYSICS.gravity, grounded: false, level, airTime: 0.2, lastTap: 'jump' };
}

const ground: PlayerState = { ...initialPlayer(), landTimer: 1 };
const slide = (age: number): PlayerState => ({ ...ground, sliding: true, slideTime: 0.55 - age, slideAge: age });

describe('judgeBeat — jump lasers (floor / beam)', () => {
  const floor = beat([{ kind: 'floor', level: 1 }], 1);
  const beam3 = beat([{ kind: 'beam', level: 3, from: 'front' }], 3);

  it('misses when on the floor or too low', () => {
    expect(judgeBeat(floor, ground)).toEqual({ beatId: 7, grade: 'miss', hit: true, reason: 'low', collected: [] });
    expect(judgeBeat(floor, air(1, 11)).reason).toBe('low');
  });

  it('misses when sliding under a jump laser', () => {
    expect(judgeBeat(floor, slide(0.1)).reason).toBe('slide');
  });

  it('misses when the stacked beam is higher than the jump level', () => {
    expect(judgeBeat(beam3, air(2, 120)).reason).toBe('level');
  });

  it('v8: grades by the tap offset from the ideal (apex over the laser): ±50 perfect, ±110 great, else good', () => {
    expect(judgeBeat(beam3, air(3, 40))).toEqual({ beatId: 7, grade: 'perfect', hit: false, reason: null, collected: [], offset: 0 });
    for (const sign of [1, -1]) {
      expect(judgeBeat(floor, air(1, 60, sign * PERFECT_WINDOW)).grade).toBe('perfect');
      expect(judgeBeat(floor, air(1, 60, sign * 0.06)).grade).toBe('great');
      expect(judgeBeat(floor, air(1, 50, sign * GREAT_WINDOW)).grade).toBe('great');
      expect(judgeBeat(floor, air(1, 30, sign * 0.12))).toMatchObject({ grade: 'good', hit: false });
    }
    expect(judgeBeat(floor, air(1, 30, 0.15)).offset).toBeCloseTo(0.15, 9); // + = tapped late (still rising)
    expect(judgeBeat(floor, air(1, 20)).reason).toBe('low'); // pass / fail unchanged
  });

  it('treats rear beams exactly like front beams', () => {
    const rear = beat([{ kind: 'beam', level: 2, from: 'back' }], 2);
    expect(judgeBeat(rear, air(2, 60)).grade).toBe('perfect');
    expect(judgeBeat(rear, air(1, 60)).reason).toBe('level');
  });
});

describe('judgeBeat — slide lasers (high / ceiling)', () => {
  const ceiling = beat([{ kind: 'ceiling', level: 1 }], 0, true);
  const high = beat([{ kind: 'high', level: 1, from: 'back' }], 0, true);

  it('misses when standing or jumping', () => {
    expect(judgeBeat(ceiling, ground)).toMatchObject({ grade: 'miss', reason: 'standing', hit: true });
    expect(judgeBeat(high, air(3, 150)).reason).toBe('standing');
  });

  it(`v8: perfect within ±50 ms of a ${SLIDE_IDEAL}s-old slide, great within ±110 ms, good otherwise`, () => {
    expect(judgeBeat(ceiling, slide(SLIDE_IDEAL)).grade).toBe('perfect');
    expect(judgeBeat(high, slide(0.25)).grade).toBe('perfect');
    expect(judgeBeat(ceiling, slide(0.1)).grade).toBe('great');
    expect(judgeBeat(high, slide(0.3)).grade).toBe('great');
    expect(judgeBeat(ceiling, slide(0.02)).grade).toBe('good');
    expect(judgeBeat(high, slide(0.5))).toMatchObject({ beatId: 7, grade: 'good', hit: false, reason: null, collected: [] });
    expect(judgeBeat(high, slide(0.5)).offset).toBeCloseTo(-0.3, 9); // − = slid early
  });
});

describe('judgeBeat — drones and gates', () => {
  const drone = beat([{ kind: 'drone', level: 1 }], 0);
  const gate = beat([{ kind: 'floor', level: 1 }, { kind: 'drone', level: 1 }], 1);

  it('a lone drone passes perfect on the floor, sliding or with a 1단 hop', () => {
    expect(judgeBeat(drone, ground).grade).toBe('perfect');
    expect(judgeBeat(drone, slide(0.2)).grade).toBe('perfect');
    expect(judgeBeat(drone, air(1, 60)).grade).toBe('perfect');
  });

  it('a drone hits a level ≥ 2 jump, before anything else', () => {
    expect(judgeBeat(drone, air(2, 100))).toMatchObject({ reason: 'drone', hit: true });
    expect(judgeBeat(gate, air(2, 5)).reason).toBe('drone');
  });

  it('a gate needs exactly a 1단 jump', () => {
    expect(judgeBeat(gate, ground).reason).toBe('low');
    expect(judgeBeat(gate, air(1, 50)).grade).toBe('perfect');
    expect(judgeBeat(gate, air(1, 28, -0.2)).grade).toBe('good');
  });
});

describe('judgeBeat — pickups', () => {
  it('pickup-only beat grades none and collects when high enough', () => {
    const coin = beat([{ kind: 'coin', level: 2 }], 0);
    expect(judgeBeat(coin, air(2, 100))).toEqual({ beatId: 7, grade: 'none', hit: false, reason: null, collected: ['coin'] });
    expect(judgeBeat(coin, air(1, 50)).collected).toEqual([]);
    expect(judgeBeat(coin, ground)).toMatchObject({ grade: 'none', collected: [] });
    expect(judgeBeat(coin, slide(0.1)).collected).toEqual([]);
  });

  it('collects on a passed hazard beat but not on a hit', () => {
    const b = beat([{ kind: 'floor', level: 1 }, { kind: 'shield', level: 1 }], 1);
    expect(judgeBeat(b, air(1, 50)).collected).toEqual(['shield']);
    expect(judgeBeat(b, ground).collected).toEqual([]);
  });
});

describe('judgeBeat — v5 lane hazards (§4)', () => {
  const guard = beat([{ kind: 'guard', level: 1, lanes: [0, 1] }], 0);
  const drop = beat([{ kind: 'drop', level: 1, lanes: [2] }], 0);
  const chaser = beat([{ kind: 'chaser', level: 1, lanes: [1] }], 0);

  it('misses with reason lane when the agent is in a blocked lane, whatever it does', () => {
    expect(judgeBeat(guard, ground)).toEqual({ beatId: 7, grade: 'miss', hit: true, reason: 'lane', collected: [] });
    expect(judgeBeat(guard, inLane(air(3, 150), 0)).reason).toBe('lane');
    expect(judgeBeat(drop, inLane(slide(0.2), 2)).reason).toBe('lane');
    expect(judgeBeat(chaser, air(1, 60)).reason).toBe('lane');
  });

  it('a lane-only beat passed in a safe lane without a dodge is perfect (grounded, airborne or sliding)', () => {
    expect(judgeBeat(guard, inLane(ground, 2))).toEqual({ beatId: 7, grade: 'perfect', hit: false, reason: null, collected: [], offset: 0 });
    expect(judgeBeat(drop, inLane(air(2, 90), 0)).grade).toBe('perfect');
    expect(judgeBeat(chaser, inLane(slide(0.5), 2)).grade).toBe('perfect');
  });

  it(`v8: a dodge out of a blocked lane grades by how early it came (≥ ${LANE_EARLY}s ahead = perfect)`, () => {
    const dodged = (age: number): PlayerState => ({ ...ground, lane: 2, laneFrom: 1, laneAge: age });
    expect(judgeBeat(guard, dodged(0.5)).grade).toBe('perfect');
    expect(judgeBeat(guard, dodged(LANE_EARLY - PERFECT_WINDOW)).grade).toBe('perfect');
    expect(judgeBeat(guard, dodged(0.08)).grade).toBe('great');
    expect(judgeBeat(guard, dodged(0.02))).toMatchObject({ grade: 'good', hit: false });
    // a lane change that was not needed (the previous lane was safe too) never costs a grade
    expect(judgeBeat(drop, { ...ground, lane: 1, laneFrom: 0, laneAge: 0.01 }).grade).toBe('perfect');
  });

  it('checks the lane before drone, slide and jump lasers (lanejump)', () => {
    const laneJump = beat([{ kind: 'guard', level: 1, lanes: [1] }, { kind: 'floor', level: 1 }], 1);
    expect(judgeBeat(laneJump, ground).reason).toBe('lane');
    expect(judgeBeat(laneJump, inLane(ground, 0)).reason).toBe('low');
    expect(judgeBeat(laneJump, inLane(air(1, 50), 2)).grade).toBe('perfect');
    expect(judgeBeat(laneJump, inLane(air(1, 30, 0.2), 2)).grade).toBe('good');
    // the worse of the jump and the dodge decides
    expect(judgeBeat(laneJump, { ...air(1, 60), lane: 2, laneFrom: 1, laneAge: 0.02 }).grade).toBe('good');
    const laneSlide = beat([{ kind: 'drop', level: 1, lanes: [0] }, { kind: 'ceiling', level: 1 }], 0, true);
    expect(judgeBeat(laneSlide, inLane(slide(0.2), 0)).reason).toBe('lane');
    expect(judgeBeat(laneSlide, slide(0.2)).grade).toBe('perfect');
    expect(judgeBeat(laneSlide, ground).reason).toBe('standing');
  });

  it('ignores lane hazards without lanes listed (never blocks)', () => {
    expect(judgeBeat(beat([{ kind: 'guard', level: 1 }], 0), ground).grade).toBe('perfect');
  });
});

describe('judgeBeat — v5 lane pickups', () => {
  it('collects a laned pickup only in its lane', () => {
    const coin = beat([{ kind: 'coin', level: 1, lanes: [2] }], 0);
    expect(judgeBeat(coin, air(1, 50)).collected).toEqual([]);
    expect(judgeBeat(coin, inLane(air(1, 50), 2)).collected).toEqual(['coin']);
    expect(judgeBeat(coin, inLane(ground, 2)).collected).toEqual([]);
  });

  it('collects on a passed lane beat in the pickup lane', () => {
    const b = beat([{ kind: 'guard', level: 1, lanes: [0] }, { kind: 'heart', level: 1, lanes: [1] }], 0);
    expect(judgeBeat(b, air(1, 50))).toMatchObject({ grade: 'perfect', collected: ['heart'] });
    expect(judgeBeat(b, inLane(air(1, 50), 0)).collected).toEqual([]);
  });
});
