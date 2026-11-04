// Office achievements and goals over ten stages (part 2 spec §3): zone-5 "18:00 칼퇴", zone-7 and zone-10
// "18:30 귀가", the stamp collector over all 30 stamps, ★3 on every stage. Runs on the office module graph.
import { beforeEach, describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, STAMPS_ALL, evaluateAchievements } from '../../src/office/core/achievements';
import { achievementProgress, nextGoal } from '../../src/office/core/goals';
import { STAGES } from '../../src/office/core/content';
import { defaultSave } from '../../src/core/storage';
import type { RunSummary, SaveData } from '../../src/types';

const stars = (n: number, value = 1): SaveData['stars'] => Object.fromEntries(STAGES.slice(0, n).map((s) => [s.id, value]));
const save = (over: Partial<SaveData> = {}): SaveData => ({ ...defaultSave(), ...over });
const win = (stageId: string): RunSummary => ({ mode: 'stage', stageId, cleared: true } as unknown as RunSummary);
const meta = (id: string) => ACHIEVEMENTS.find((a) => a.id === id);

beforeEach(() => {
  try {
    globalThis.localStorage?.clear?.();
  } catch {
    // no storage in this environment: loadStamps() reads {}
  }
});

describe('office achievements (10 stages)', () => {
  it('zone-5 stays "18:00 칼퇴"; zone-7 and zone-10 "18:30 귀가" follow it in order', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(ids.indexOf('zone-5')).toBeLessThan(ids.indexOf('zone-7'));
    expect(ids.indexOf('zone-7')).toBeLessThan(ids.indexOf('zone-10'));
    expect(meta('zone-5')?.name).toBe('18:00 칼퇴');
    expect(meta('zone-10')?.name).toBe('18:30 귀가');
    expect(meta('zone-7')?.desc).toContain('7단계');
  });

  it('zone-7 / zone-10 unlock on clearing those stages (saved star or the run just won)', () => {
    expect(evaluateAchievements(save({ stars: stars(6) }), null)).not.toContain('zone-7');
    expect(evaluateAchievements(save({ stars: stars(7) }), null)).toContain('zone-7');
    expect(evaluateAchievements(save({ stars: stars(9) }), null)).not.toContain('zone-10');
    expect(evaluateAchievements(save({ stars: stars(9) }), win('w10-s10'))).toContain('zone-10');
  });

  it('the stamp collector needs all 30 stamps (3 per stage × 10)', () => {
    expect(STAMPS_ALL).toBe(30);
    expect(meta('stamps-15')?.desc).toContain('30');
  });

  it('우수 사원 needs ★3 on all ten stages', () => {
    expect(evaluateAchievements(save({ stars: stars(5, 3) }), null)).not.toContain('all-stars-zone');
    expect(evaluateAchievements(save({ stars: stars(10, 3) }), null)).toContain('all-stars-zone');
  });
});

describe('office goals (10 stages)', () => {
  it('progress counts toward stages 7 and 10, stars over ten stages, stamps over 30', () => {
    expect(achievementProgress('zone-7', save({ stars: stars(6) }))).toEqual({ cur: 6, max: 7 });
    expect(achievementProgress('zone-10', save({ stars: stars(6) }))).toEqual({ cur: 6, max: 10 });
    expect(achievementProgress('all-stars-zone', save({ stars: stars(4, 3) }))).toEqual({ cur: 4, max: 10 });
    expect(achievementProgress('stamps-15', save())).toEqual({ cur: 0, max: 30 });
  });

  it('with everything done, the title goal says home by 18:30 and points back at stamps / achievements', () => {
    const done = save({ stars: stars(10, 3), achievements: Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, 1])) });
    expect(nextGoal(done, '2026-11-05').text).toBe('18:30 귀가 완료! 내일 출근 09:00 — 도장·업적 다시 도전');
  });

  it('after stage 5 the next goal is stage 6; stage 10 is the last (boss) goal', () => {
    expect(nextGoal(save({ stars: stars(5) }), '2026-11-03')).toMatchObject({ kind: 'stage' });
    expect(nextGoal(save({ stars: stars(5) }), '2026-11-03').text).toContain('6단계');
    expect(nextGoal(save({ stars: stars(9) }), '2026-11-03')).toMatchObject({ kind: 'boss' });
    expect(nextGoal(save({ stars: stars(9) }), '2026-11-03').text).toContain('10단계');
  });
});
