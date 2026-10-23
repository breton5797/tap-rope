import { describe, expect, it } from 'vitest';
import { judgeBeat } from '../../src/core/judge';
import { initialPlayer } from '../../src/core/physics';
import type { Beat, JumpLevel, Obstacle, PlayerState } from '../../src/types';

function beat(obstacles: Obstacle[], requiredLevel: JumpLevel, needsSlide = false): Beat {
  return { id: 7, time: 3, obstacles, requiredLevel, needsSlide, pulse: false };
}

function air(level: JumpLevel, height: number): PlayerState {
  return { ...initialPlayer(), height, grounded: false, level, airTime: 0.2, lastTap: 'jump' };
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

  it('passes good below PERFECT_H and perfect at/above', () => {
    expect(judgeBeat(floor, air(1, 24)).grade).toBe('good');
    expect(judgeBeat(floor, air(1, 20)).reason).toBe('low');
    expect(judgeBeat(beam3, air(3, 40))).toEqual({ beatId: 7, grade: 'perfect', hit: false, reason: null, collected: [] });
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

  it('perfect when the slide is 0.05–0.35s old, good otherwise', () => {
    expect(judgeBeat(ceiling, slide(0.05)).grade).toBe('perfect');
    expect(judgeBeat(high, slide(0.35)).grade).toBe('perfect');
    expect(judgeBeat(ceiling, slide(0.02)).grade).toBe('good');
    expect(judgeBeat(high, slide(0.5))).toEqual({ beatId: 7, grade: 'good', hit: false, reason: null, collected: [] });
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
    expect(judgeBeat(gate, air(1, 28)).grade).toBe('good');
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
