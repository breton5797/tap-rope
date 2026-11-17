import { describe, expect, it } from 'vitest';
import { bonusPlacement } from '../../src/office/monetization/placement';
import type { ResultInfo } from '../../src/types';

const base = { mode: 'stage', stageId: 'w1-s1', cleared: true } as unknown as ResultInfo;
const live = (daily: boolean, firstClear: boolean): ResultInfo['live'] => ({
  daily,
  rewards: firstClear ? [{ kind: 'points', amount: 85, why: 'daily' }] : [],
  stamps: [],
  today: 0,
  stampDesign: null,
});

describe('which reward a result card may offer', () => {
  it('a cleared campaign stage offers the stage bonus', () => {
    expect(bonusPlacement(base)).toBe('stage');
  });

  it("today's first daily clear offers the daily bonus; a daily replay offers nothing", () => {
    expect(bonusPlacement({ ...base, stageId: 'daily:2026-11-18:3', live: live(true, true) })).toBe('daily');
    expect(bonusPlacement({ ...base, stageId: 'daily:2026-11-18:3', live: live(true, false) })).toBeNull();
  });

  it('a failed run, a tester run or a bot run offers nothing', () => {
    expect(bonusPlacement({ ...base, cleared: false })).toBeNull();
    expect(bonusPlacement({ ...base, testRun: true })).toBeNull();
    expect(bonusPlacement({ ...base, autoplay: true })).toBeNull();
  });

  it('endless and challenge runs offer nothing', () => {
    expect(bonusPlacement({ ...base, mode: 'endless', stageId: null } as unknown as ResultInfo)).toBeNull();
  });
});
