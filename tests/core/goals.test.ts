import { describe, expect, it } from 'vitest';
import { STAGES } from '../../src/core/content';
import { achievementProgress, nextGoal, stageLabel, starRule, streakStatus } from '../../src/core/goals';
import { defaultSave } from '../../src/core/storage';
import type { SaveData } from '../../src/types';

const TODAY = '2026-10-28';
const clearedThrough = (n: number, stars = 2): SaveData['stars'] =>
  Object.fromEntries(STAGES.slice(0, n).map((s) => [s.id, stars]));

describe('streakStatus', () => {
  it('live count: today or yesterday keeps it, older = broken (0)', () => {
    const at = (last: string | null, count: number) => ({ ...defaultSave(), dailyStreak: { last, count } });
    expect(streakStatus(at('2026-10-28', 4), TODAY)).toEqual({ count: 4, doneToday: true, atRisk: false });
    expect(streakStatus(at('2026-10-27', 4), TODAY)).toEqual({ count: 4, doneToday: false, atRisk: true });
    expect(streakStatus(at('2026-10-20', 4), TODAY)).toEqual({ count: 0, doneToday: false, atRisk: false });
    expect(streakStatus(at(null, 0), TODAY)).toEqual({ count: 0, doneToday: false, atRisk: false });
  });
});

describe('achievementProgress', () => {
  it('counts cumulative achievements', () => {
    const s: SaveData = { ...defaultSave(), stars: clearedThrough(10, 3), ownedSkins: ['kid', 'cat', 'bunny'] };
    expect(achievementProgress('stars-150', s)).toEqual({ cur: 30, max: 150 });
    expect(achievementProgress('all-operators', s)).toEqual({ cur: 3, max: 6 });
    expect(achievementProgress('all-stars-zone', s)).toEqual({ cur: 10, max: 10 });
    expect(achievementProgress('daily-7', { ...s, dailyStreak: { last: TODAY, count: 9 } })).toEqual({ cur: 7, max: 7 });
    expect(achievementProgress('zone-3', s)).toEqual({ cur: 10, max: 30 });
    expect(achievementProgress('chain-50', s)).toBeNull();
  });
});

describe('nextGoal', () => {
  it('fresh save → the first mission and its bonus', () => {
    expect(nextGoal(defaultSave(), TODAY).text).toContain('1-1');
  });

  it('keeps a live streak alive first', () => {
    const s: SaveData = { ...defaultSave(), stars: clearedThrough(3), dailyStreak: { last: '2026-10-27', count: 3 } };
    expect(nextGoal(s, TODAY)).toMatchObject({ kind: 'daily' });
  });

  it('points to an affordable operator, then the next boss / stage', () => {
    const rich: SaveData = { ...defaultSave(), stars: clearedThrough(3), coins: 9999 };
    expect(nextGoal(rich, TODAY)).toMatchObject({ kind: 'shop' });
    const g = nextGoal({ ...rich, coins: 0 }, TODAY);
    expect(g.kind).toBe('stage');
    expect(g.text).toContain('1-4');
    expect(nextGoal({ ...rich, coins: 0, stars: clearedThrough(9) }, TODAY)).toMatchObject({ kind: 'boss' });
  });

  it('after the story: the closest achievement', () => {
    const done: SaveData = { ...defaultSave(), stars: clearedThrough(STAGES.length, 2), dailyStreak: { last: TODAY, count: 1 } };
    expect(nextGoal(done, TODAY).kind).toBe('achievement');
  });
});

describe('starRule / stageLabel', () => {
  it('★3 = no hits and PERFECT ≥ 60%', () => {
    expect(starRule({ perfects: 6, goods: 3, misses: 1 })).toEqual({ pct: 60, met: true });
    expect(starRule({ perfects: 5, goods: 5, misses: 0 })).toEqual({ pct: 50, met: false });
    expect(starRule({ perfects: 0, goods: 0, misses: 0 })).toEqual({ pct: 100, met: true }); // scoring: no judged beats = ratio 1
    expect(stageLabel('w10-s3')).toBe('10-3');
  });
});
