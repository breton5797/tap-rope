import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, evaluateAchievements, updateDailyStreak } from '../../src/core/achievements';
import { STAGES, SKINS } from '../../src/core/content';
import { CUTSCENES } from '../../src/core/cutscenes';
import { defaultSave, recordAchievements } from '../../src/core/storage';
import type { AchievementId, RunSummary, SaveData } from '../../src/types';

const save0 = defaultSave();
const run = (over: Partial<RunSummary> = {}): RunSummary => ({
  mode: 'stage', stageId: 'w1-s3', cleared: true, hitsTaken: 1, perfects: 10, goods: 3, misses: 1,
  maxCombo: 12, fevers: 0, seconds: 40, score: 1000, date: '2026-10-27', ...over,
});
const withStars = (ids: readonly string[], n = 1): SaveData =>
  ({ ...save0, stars: Object.fromEntries(ids.map((id) => [id, n])) });
const ev = (save: SaveData, r: RunSummary | null) => evaluateAchievements(save, r);

describe('ACHIEVEMENTS (GDD v7 §3.1)', () => {
  it('lists the 21 achievements with Korean names and descriptions', () => {
    expect(ACHIEVEMENTS.map((a) => a.id)).toEqual([
      'first-clear', 'zone-1', 'zone-3', 'zone-5', 'zone-7', 'zone-10', 'rescue', 'escape', 'flawless-boss',
      'perfect-stage', 'chain-50', 'chain-100', 'overdrive-3', 'all-stars-zone', 'stars-150', 'endless-60',
      'endless-180', 'daily-1', 'daily-7', 'all-operators', 'archivist',
    ]);
    const name = (id: AchievementId) => ACHIEVEMENTS.find((a) => a.id === id)?.name;
    expect([name('first-clear'), name('rescue'), name('flawless-boss'), name('stars-150'), name('archivist')])
      .toEqual(['첫 임무', '포로 구출', '무결점 제압', '베테랑', '기록 보관']);
    for (const a of ACHIEVEMENTS) {
      expect(a.desc.length).toBeGreaterThan(0);
      expect(/[!?]/.test(a.name + a.desc)).toBe(false);
    }
  });
});

describe('evaluateAchievements', () => {
  it('returns nothing for a fresh save without a run', () => {
    expect(ev(save0, null)).toEqual([]);
  });

  it('first clear and zone bosses come from the save stars (or the cleared run)', () => {
    expect(ev(withStars(['w1-s3']), run())).toEqual(['first-clear']);
    expect(ev(save0, run())).toEqual(['first-clear']);
    expect(ev(save0, run({ cleared: false }))).toEqual([]);
    expect(ev(withStars(['w1-s10', 'w3-s10', 'w5-s10', 'w7-s10', 'w10-s10']), null))
      .toEqual(['first-clear', 'zone-1', 'zone-3', 'zone-5', 'zone-7', 'zone-10', 'rescue', 'escape']);
    expect(ev(save0, run({ stageId: 'w5-s10', hitsTaken: 2 }))).toEqual(['first-clear', 'zone-5', 'rescue']);
  });

  it('never repeats unlocked ones', () => {
    const s = recordAchievements(withStars(['w1-s10']), ['first-clear', 'zone-1'], 1000);
    expect(ev(s, null)).toEqual([]);
  });

  it('run feats: flawless boss, perfect stage, chains, overdrive', () => {
    const got = (r: RunSummary) => ev(recordAchievements(save0, ['first-clear'], 1), r);
    expect(got(run({ stageId: 'w2-s10', hitsTaken: 0 }))).toEqual(['flawless-boss']);
    expect(got(run({ stageId: 'w2-s9', hitsTaken: 0 }))).toEqual([]);
    expect(got(run({ stageId: 'w2-s10', hitsTaken: 0, cleared: false }))).toEqual([]);
    expect(got(run({ goods: 0, misses: 0, hitsTaken: 0 }))).toEqual(['perfect-stage']);
    expect(got(run({ mode: 'endless', stageId: null, goods: 0, misses: 0, seconds: 20 }))).toEqual([]);
    expect(got(run({ maxCombo: 50 }))).toEqual(['chain-50']);
    expect(got(run({ mode: 'endless', stageId: null, cleared: false, maxCombo: 100 }))).toEqual(['chain-50', 'chain-100']);
    expect(got(run({ fevers: 3, cleared: false }))).toEqual(['overdrive-3']);
    expect(got(run({ fevers: 2 }))).toEqual([]);
  });

  it('stars: a full 3-star zone and 150 stars in total', () => {
    const zone = STAGES.filter((s) => s.chapter === 4).map((s) => s.id);
    expect(ev(withStars(zone, 3), null)).toContain('all-stars-zone');
    expect(ev(withStars(zone.slice(0, 9), 3), null)).not.toContain('all-stars-zone');
    expect(ev(withStars(STAGES.slice(0, 50).map((s) => s.id), 3), null)).toContain('stars-150');
    expect(ev(withStars(STAGES.slice(0, 49).map((s) => s.id), 3), null)).not.toContain('stars-150');
  });

  it('endless survival 60s / 180s', () => {
    const e = (seconds: number) => ev(save0, run({ mode: 'endless', stageId: null, cleared: false, seconds }));
    expect(e(59.9)).toEqual([]);
    expect(e(60)).toEqual(['endless-60']);
    expect(e(180)).toEqual(['endless-60', 'endless-180']);
    expect(ev(save0, run({ mode: 'daily', stageId: null, cleared: false, seconds: 200 }))).toEqual([]);
  });

  it('daily: first clear and a 7-day streak', () => {
    expect(ev(save0, run({ mode: 'daily', stageId: null }))).toEqual(['daily-1']);
    expect(ev(save0, run({ mode: 'daily', stageId: null, cleared: false }))).toEqual([]);
    const streak = { ...save0, dailyStreak: { last: '2026-10-27', count: 7 } };
    expect(ev(streak, null)).toEqual(['daily-1', 'daily-7']);
    expect(ev({ ...save0, dailyStreak: { last: '2026-10-27', count: 6 } }, null)).toEqual(['daily-1']);
  });

  it('all operators and the archivist', () => {
    expect(ev({ ...save0, ownedSkins: SKINS.map((s) => s.id) }, null)).toEqual(['all-operators']);
    expect(ev({ ...save0, ownedSkins: SKINS.slice(0, 5).map((s) => s.id) }, null)).toEqual([]);
    expect(ev({ ...save0, seenCutscenes: CUTSCENES.map((c) => c.id) }, null)).toEqual(['archivist']);
    expect(ev({ ...save0, seenCutscenes: CUTSCENES.slice(1).map((c) => c.id) }, null)).toEqual([]);
  });
});

describe('updateDailyStreak', () => {
  const s = (last: string | null, count: number): SaveData => ({ ...save0, dailyStreak: { last, count } });

  it('starts, continues on the next calendar day, resets after a gap', () => {
    expect(updateDailyStreak(save0, '2026-10-27').dailyStreak).toEqual({ last: '2026-10-27', count: 1 });
    expect(updateDailyStreak(s('2026-10-26', 3), '2026-10-27').dailyStreak).toEqual({ last: '2026-10-27', count: 4 });
    expect(updateDailyStreak(s('2026-10-25', 3), '2026-10-27').dailyStreak).toEqual({ last: '2026-10-27', count: 1 });
  });

  it('crosses month, year and leap-day boundaries', () => {
    expect(updateDailyStreak(s('2026-02-28', 2), '2026-03-01').dailyStreak.count).toBe(3);
    expect(updateDailyStreak(s('2028-02-28', 2), '2028-02-29').dailyStreak.count).toBe(3);
    expect(updateDailyStreak(s('2028-02-28', 2), '2028-03-01').dailyStreak.count).toBe(1);
    expect(updateDailyStreak(s('2026-12-31', 5), '2027-01-01').dailyStreak.count).toBe(6);
  });

  it('is a no-op for the same day, an older date or a malformed date', () => {
    const a = s('2026-10-27', 4);
    expect(updateDailyStreak(a, '2026-10-27')).toBe(a);
    expect(updateDailyStreak(a, '2026-10-20')).toBe(a);
    expect(updateDailyStreak(a, 'nope')).toBe(a);
    expect(updateDailyStreak(a, '2026-13-01')).toBe(a);
  });

  it('a 7-day run of clears reaches 7', () => {
    const days = ['2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27'];
    const end = days.reduce(updateDailyStreak, save0);
    expect(end.dailyStreak).toEqual({ last: '2026-10-27', count: 7 });
  });
});
