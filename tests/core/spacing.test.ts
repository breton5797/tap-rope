import { describe, expect, it } from 'vitest';
import { airtimeForLevel, DEFAULT_PHYSICS } from '../../src/core/physics';
import { blockedOf, gapAfter, type GapShape, LANE_GAP, LANE_SWAP_GAP, minGap, SAFETY } from '../../src/core/spacing';
import type { JumpLevel, LaneId, Obstacle } from '../../src/types';

const cfg = DEFAULT_PHYSICS;
const shape = (obstacles: Obstacle[], required: JumpLevel = 0, needsSlide = false): GapShape => ({ obstacles, required, needsSlide });
const guard = (...lanes: LaneId[]): Obstacle => ({ kind: 'guard', level: 1, lanes });
const FLOOR: Obstacle = { kind: 'floor', level: 1 };
const CEILING: Obstacle = { kind: 'ceiling', level: 1 };

describe('spacing — v4 rules', () => {
  it('keeps the jump, slide and drone gaps', () => {
    expect(gapAfter(shape([FLOOR], 1), cfg)).toBeCloseTo(airtimeForLevel(1, cfg) + SAFETY, 9);
    expect(gapAfter(shape([CEILING], 0, true), cfg)).toBe(0.6);
    expect(gapAfter(shape([{ kind: 'drone', level: 1 }]), cfg)).toBe(0.5);
    expect(minGap(shape([{ kind: 'drone', level: 1 }]), shape([{ kind: 'beam', level: 2 }], 2), cfg))
      .toBeCloseTo(airtimeForLevel(1, cfg) + SAFETY, 9);
    expect(gapAfter(shape([{ kind: 'coin', level: 1 }]), cfg)).toBe(0);
  });
});

describe('spacing — v5 lane rules (§5)', () => {
  it('exposes the lane gaps', () => {
    expect(LANE_GAP).toBe(0.45);
    expect(LANE_SWAP_GAP).toBe(0.6);
  });

  it('needs LANE_GAP after a lone lane beat', () => {
    expect(gapAfter(shape([guard(1)]), cfg)).toBe(LANE_GAP);
    expect(gapAfter(shape([{ kind: 'chaser', level: 1, lanes: [2] }]), cfg)).toBe(LANE_GAP);
  });

  it('a lane + laser combo takes the larger of both gaps', () => {
    expect(gapAfter(shape([guard(1), FLOOR], 1), cfg)).toBeCloseTo(Math.max(LANE_GAP, airtimeForLevel(1, cfg) + SAFETY), 9);
    expect(gapAfter(shape([guard(0, 1), CEILING], 0, true), cfg)).toBe(0.6);
  });

  it('needs LANE_SWAP_GAP between lane beats whose safe lanes do not overlap', () => {
    expect(minGap(shape([guard(0, 1)]), shape([guard(1, 2)]), cfg)).toBe(LANE_SWAP_GAP); // 2 → 0
    expect(minGap(shape([guard(0)]), shape([guard(1, 2)]), cfg)).toBe(LANE_SWAP_GAP); // {1,2} vs {0}
    expect(minGap(shape([guard(0)]), shape([guard(1)]), cfg)).toBe(LANE_GAP); // lane 2 safe for both
    expect(minGap(shape([guard(0, 1)]), shape([FLOOR], 1), cfg)).toBe(LANE_GAP);
    const combo = shape([guard(0, 1), FLOOR], 1);
    expect(minGap(combo, shape([guard(1, 2)]), cfg)).toBeCloseTo(airtimeForLevel(1, cfg) + SAFETY, 9);
  });

  it('blockedOf is the sorted union of lane-hazard lanes', () => {
    expect(blockedOf([guard(2, 0), { kind: 'coin', level: 1, lanes: [1] }, FLOOR])).toEqual([0, 2]);
    expect(blockedOf([FLOOR])).toEqual([]);
  });
});
