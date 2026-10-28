import { describe, expect, it } from 'vitest';
import { DEFAULT_PHYSICS, initialPlayer, PERFECT_H, slidePlayer, stepPlayer, tapPlayer } from '../../src/core/physics';
import { judgeBeat } from '../../src/core/judge';
import { displayTimes, idealLead, MIN_ICON_GAP } from '../../src/render/lane-timing';
import type { Beat, JumpLevel, LaneItem, ObstacleKind, PlayerState } from '../../src/types';

const cfg = DEFAULT_PHYSICS;

function beat(kinds: readonly ObstacleKind[], level: JumpLevel): Beat {
  return {
    id: 1, time: 0, requiredLevel: level, blockedLanes: [],
    obstacles: kinds.map((kind) => ({ kind, level: kind === 'beam' ? Math.max(1, level) : 1 })),
  } as unknown as Beat;
}

/** taps at the lane's ideal moment (+ boosts at each apex), returns the player at the beat time */
function playJump(level: 1 | 2 | 3): PlayerState {
  let p = initialPlayer();
  let left = idealLead(['beam'], level, cfg);
  p = tapPlayer(p, cfg).player;
  for (let i = 1; i < level; i++) {
    const rise = p.vy / cfg.gravity;
    p = stepPlayer(p, rise, cfg).player;
    left -= rise;
    p = tapPlayer(p, cfg).player;
  }
  return stepPlayer(p, left, cfg).player;
}

describe('idealLead (A1: lane icons reach the ring at the ideal input time)', () => {
  it('a level-1 jump tapped at the ring is at its apex (perfect) when the laser arrives', () => {
    const lead = idealLead(['floor'], 1, cfg);
    expect(lead).toBeGreaterThan(0.18);
    expect(lead).toBeLessThan(0.26);
    const p = playJump(1);
    expect(Math.abs(p.vy)).toBeLessThan(15);
    expect(p.height).toBeGreaterThanOrEqual(PERFECT_H);
    expect(judgeBeat(beat(['floor'], 1), p).grade).toBe('perfect');
  });

  it('multi-level beams lead by the whole first-tap → final-apex rise', () => {
    for (const level of [2, 3] as const) {
      expect(idealLead(['beam'], level, cfg)).toBeGreaterThan(idealLead(['beam'], (level - 1) as 1 | 2, cfg));
      const p = playJump(level);
      expect(p.level).toBe(level);
      expect(judgeBeat(beat(['beam'], level), p).grade).toBe('perfect');
    }
  });

  it('a slide started at the ring is in the middle of its perfect window', () => {
    const lead = idealLead(['high'], 0, cfg);
    const p = stepPlayer(slidePlayer(initialPlayer(), cfg).player, lead, cfg).player;
    expect(p.sliding).toBe(true);
    expect(judgeBeat(beat(['high'], 0), p).grade).toBe('perfect');
    expect(idealLead(['ceiling'], 0, cfg)).toBe(lead);
  });

  it('lane, drone and pickup icons keep their arrival time', () => {
    for (const k of ['guard', 'drop', 'chaser', 'drone', 'coin', 'shield'] as const) expect(idealLead([k], 0, cfg)).toBe(0);
  });

  it('a mixed beat takes the jump lead (the input that matters)', () => {
    expect(idealLead(['coin', 'floor'], 1, cfg)).toBe(idealLead(['floor'], 1, cfg));
  });
});

function item(timeUntil: number, kinds: readonly ObstacleKind[], level: JumpLevel): LaneItem {
  return { beatId: 0, timeUntil, kinds, level, move: 'jump', from: null, blocked: [] } as unknown as LaneItem;
}

describe('displayTimes', () => {
  it('shifts each icon by its lead without allocating', () => {
    const out = new Float64Array(8);
    const n = displayTimes([item(1, ['floor'], 1), item(2, ['drone'], 0)], cfg, out);
    expect(n).toBe(2);
    expect(out[0]).toBeCloseTo(1 - idealLead(['floor'], 1, cfg), 6);
    expect(out[1]).toBe(2);
  });

  it('never lets a later beat overtake an earlier one on the strip', () => {
    const out = new Float64Array(8);
    displayTimes([item(1, ['floor'], 1), item(1.25, ['beam'], 3)], cfg, out);
    expect(out[1]).toBeGreaterThanOrEqual(out[0] + MIN_ICON_GAP - 1e-9);
  });

  it('a lane / drone icon (no lead) never pushes the next jump late', () => {
    const out = new Float64Array(8);
    displayTimes([item(0.3, ['guard'], 0), item(0.5, ['beam'], 3)], cfg, out);
    expect(out[0]).toBeCloseTo(0.3, 9);
    expect(out[1]).toBeCloseTo(0.5 - idealLead(['beam'], 3, cfg), 9);
  });

  it('caps at the buffer length', () => {
    const out = new Float64Array(1);
    expect(displayTimes([item(1, ['floor'], 1), item(2, ['floor'], 1)], cfg, out)).toBe(1);
  });
});
