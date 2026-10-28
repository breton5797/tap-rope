import { describe, expect, it } from 'vitest';
import { DEFAULT_PHYSICS } from '../../src/core/physics';
import { idealLead } from '../../src/render/lane-timing';
import { LANE_STOP_LEAD, laneEscape, TutorialRun, tutorialInput, tutorialStops } from '../../src/game/tutorial';
import type { Beat, JumpLevel, LaneId, ObstacleKind } from '../../src/types';

const cfg = DEFAULT_PHYSICS;

function beat(id: number, time: number, kinds: readonly ObstacleKind[], level: JumpLevel = 0, blocked: readonly LaneId[] = []): Beat {
  return {
    id, time, requiredLevel: level, needsSlide: kinds.includes('high') || kinds.includes('ceiling'), pulse: false,
    blockedLanes: blocked, section: 0,
    obstacles: kinds.map((kind) => ({ kind, level: 1, ...(blocked.length && ['guard', 'drop', 'chaser'].includes(kind) ? { lanes: blocked } : {}) })),
  } as Beat;
}

describe('tutorialStops', () => {
  const beats = [
    beat(1, 3, ['coin']),
    beat(2, 4, ['beam'], 2),
    beat(3, 5, ['floor'], 1),
    beat(4, 6, ['floor'], 1),
    beat(5, 7, ['high']),
    beat(6, 8, ['guard'], 0, [1]),
  ];

  it('freezes at the ideal input moment of the first plain beat of each step', () => {
    const stops = tutorialStops(beats, [], cfg);
    expect(stops.map((s) => [s.step, s.beatId])).toEqual([['jump', 3], ['slide', 5], ['lane', 6]]);
    expect(stops[0].at).toBeCloseTo(5 - idealLead(['floor'], 1, cfg), 9);
    expect(stops[1].at).toBeCloseTo(7 - idealLead(['high'], 0, cfg), 9);
    expect(stops[2].at).toBeCloseTo(8 - LANE_STOP_LEAD, 9);
  });

  it('skips steps already taught', () => {
    expect(tutorialStops(beats, ['jump', 'lane'], cfg).map((s) => s.step)).toEqual(['slide']);
    expect(tutorialStops(beats, ['jump', 'slide', 'lane'], cfg)).toEqual([]);
  });

  it('never stops on a mixed beat (jump + lane hazard, jump + slide)', () => {
    const mixed = [beat(1, 3, ['floor', 'guard'], 1, [0]), beat(2, 4, ['floor', 'high'], 1)];
    expect(tutorialStops(mixed, [], cfg)).toEqual([]);
  });
});

describe('laneEscape', () => {
  it('is null when the player lane is free', () => {
    expect(laneEscape([0], 1)).toBeNull();
  });
  it('points to the nearest free lane, toward the middle first', () => {
    expect(laneEscape([1], 1)).toBe(-1);
    expect(laneEscape([0], 0)).toBe(1);
    expect(laneEscape([2], 2)).toBe(-1);
    expect(laneEscape([1, 2], 2)).toBe(-1);
    expect(laneEscape([0, 1], 1)).toBe(1);
  });
});

describe('tutorialInput', () => {
  it('jump passes only on a tap', () => {
    expect(tutorialInput('jump', 'tap', false, null)).toBe('pass');
    expect(tutorialInput('jump', { lane: 1 }, false, null)).toBe('ignore');
    expect(tutorialInput('jump', 'slideKey', false, null)).toBe('ignore');
  });
  it('slide: key passes; a touch tap is held until its ↓ swipe', () => {
    expect(tutorialInput('slide', 'slideKey', false, null)).toBe('pass');
    expect(tutorialInput('slide', 'tap', false, null)).toBe('hold');
    expect(tutorialInput('slide', 'down', true, null)).toBe('pass');
    expect(tutorialInput('slide', 'down', false, null)).toBe('ignore');
    expect(tutorialInput('slide', 'up', true, null)).toBe('ignore');
  });
  it('lane passes only toward the free lane', () => {
    expect(tutorialInput('lane', { lane: -1 }, false, -1)).toBe('pass');
    expect(tutorialInput('lane', { lane: 1 }, false, -1)).toBe('ignore');
    expect(tutorialInput('lane', 'tap', false, -1)).toBe('ignore');
  });
});

describe('TutorialRun', () => {
  const grounded = { grounded: true, sliding: false, lane: 1 } as unknown as import('../../src/types').PlayerState;
  const make = () => {
    const log: string[] = [];
    const run = new TutorialRun({
      show: (s) => log.push(s ? `show:${s.step}:${s.dir}` : 'hide'),
      frozen: () => log.push('frozen'),
      learnt: (step) => log.push(`learnt:${step}`),
    });
    return { run, log };
  };
  const stops = tutorialStops([beat(1, 2, ['floor'], 1), beat(2, 4, ['guard'], 0, [1])], [], cfg);

  it('clamps the step onto the freeze point, freezes, and resumes on the right input only', () => {
    const { run, log } = make();
    run.reset(stops);
    const at = stops[0].at;
    expect(run.clampDt(at - 0.01, 0.016)).toBeCloseTo(0.01, 9);
    expect(run.clampDt(0, 0.016)).toBe(0.016);
    run.afterStep(at, grounded);
    expect(run.frozen).toBe(true);
    expect(log).toEqual(['show:jump:null', 'frozen']);
    expect(run.filter([{ lane: 1 }], 0)).toEqual([]);
    expect(run.frozen).toBe(true);
    expect(run.filter(['tap', 'tap'], 10)).toEqual(['tap', 'tap']);
    expect(run.frozen).toBe(false);
    expect(log.slice(2)).toEqual(['hide', 'learnt:jump']);
  });

  it('a lane stop points to the free lane and skips when the player already moved', () => {
    const { run, log } = make();
    run.reset(stops.slice(1));
    run.afterStep(stops[1].at, { ...grounded, lane: 0 });
    expect(run.frozen).toBe(false);
    expect(log).toEqual([]);
    run.reset(stops.slice(1));
    run.afterStep(stops[1].at, grounded);
    expect(log).toEqual(['show:lane:-1', 'frozen']);
  });

  it('skips a jump stop when the player is already airborne', () => {
    const { run } = make();
    run.reset(stops);
    run.afterStep(stops[0].at, { ...grounded, grounded: false });
    expect(run.frozen).toBe(false);
  });

  it('a touch slide (tap, then ↓) passes as the pair; a lone tap expires', () => {
    const { run } = make();
    run.reset(tutorialStops([beat(1, 2, ['high'])], [], cfg));
    run.afterStep(5, grounded);
    expect(run.filter(['tap'], 0)).toEqual([]);
    expect(run.filter(['down'], 1000)).toEqual([]);
    expect(run.filter(['tap'], 1100)).toEqual([]);
    expect(run.filter(['down'], 1200)).toEqual(['tap', 'down']);
    expect(run.frozen).toBe(false);
  });
});
