import { describe, expect, it } from 'vitest';
import {
  boardsFor, checkAchievements, checkNickname, checkRecord, isDate, isoWeek, kstDate, MAX_INPUTS, resolveBoard,
} from '../../supabase/functions/_shared/rules';

// 2026-10-27 03:00 KST == 2026-10-26 18:00 UTC
const NOW = Date.UTC(2026, 9, 26, 18, 0, 0);

const base = {
  sim: 'v7.1', mode: 'endless', seed: 42, date: '2026-10-27', inputs: [[0.5, 'T'], [0.5, 'D'], [2, 'U']], endTime: 30, clientScore: 120,
};

describe('server rules', () => {
  it('computes KST dates and ISO weeks', () => {
    expect(kstDate(NOW)).toBe('2026-10-27');
    expect(isoWeek('2026-10-27')).toBe('2026-W44');
    expect(isoWeek('2026-01-01')).toBe('2026-W01');
    expect(isoWeek('2027-01-01')).toBe('2026-W53');
    expect(isoWeek('2021-01-03')).toBe('2020-W53');
    expect(isDate('2026-02-29')).toBe(false);
    expect(isDate('2028-02-29')).toBe(true);
  });

  it('maps client boards to storage keys', () => {
    expect(resolveBoard('endless', NOW)).toBe('endless');
    expect(resolveBoard('endless-week', NOW)).toBe('endless-week:2026-W44');
    expect(resolveBoard('daily:2026-10-27', NOW)).toBe('daily:2026-10-27');
    expect(resolveBoard('daily:2026-13-01', NOW)).toBeNull();
    expect(resolveBoard('endless-week:2026-W01', NOW)).toBeNull();
    expect(resolveBoard(null, NOW)).toBeNull();
  });

  it('accepts a valid record and enters it on the right boards', () => {
    const r = checkRecord(base, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(boardsFor(r.value, NOW)).toEqual(['endless', 'endless-week:2026-W44']);
    const daily = checkRecord({ ...base, mode: 'daily', date: '2026-10-26' }, NOW);
    expect(daily.ok && boardsFor(daily.value, NOW)).toEqual(['daily:2026-10-26']);
  });

  it.each([
    [{ sim: '' }, 'bad_sim'],
    [{ mode: 'story' }, 'bad_mode'],
    [{ seed: -1 }, 'bad_seed'],
    [{ seed: 1.5 }, 'bad_seed'],
    [{ date: '2026/10/27' }, 'bad_date'],
    [{ mode: 'daily', date: '2026-10-29' }, 'stale_date'],
    [{ mode: 'daily', date: '2026-10-25' }, 'stale_date'],
    [{ endTime: 0 }, 'bad_end_time'],
    [{ endTime: 3600.5 }, 'bad_end_time'],
    [{ endTime: Number.NaN }, 'bad_end_time'],
    [{ clientScore: -3 }, 'bad_client_score'],
    [{ inputs: [[1, 'X']] }, 'bad_inputs'],
    [{ inputs: [[2, 'T'], [1, 'T']] }, 'bad_inputs'],
    [{ inputs: [[31, 'T']] }, 'bad_inputs'],
    [{ inputs: [[1, 'T', 3]] }, 'bad_inputs'],
    [{ inputs: 'TTT' }, 'bad_inputs'],
    [{ inputs: Array.from({ length: MAX_INPUTS + 1 }, () => [1, 'T']) }, 'bad_inputs'],
  ])('rejects %j with %s', (patch, code) => {
    expect(checkRecord({ ...base, ...patch }, NOW)).toEqual({ ok: false, error: code });
  });

  it('accepts exactly MAX_INPUTS inputs and daily dates ±1 day', () => {
    expect(checkRecord({ ...base, inputs: Array.from({ length: MAX_INPUTS }, () => [1, 'T']) }, NOW).ok).toBe(true);
    expect(checkRecord({ ...base, mode: 'daily', date: '2026-10-28' }, NOW).ok).toBe(true);
    expect(checkRecord(null, NOW).ok).toBe(false);
  });

  it('validates achievement batches against the whitelist', () => {
    expect(checkAchievements({ unlocked: { 'first-clear': NOW, 'zone-10': NOW - 1 } }, NOW)).toEqual({
      ok: true, value: [['first-clear', NOW], ['zone-10', NOW - 1]],
    });
    expect(checkAchievements({ unlocked: { hacked: NOW } }, NOW)).toEqual({ ok: false, error: 'unknown_achievement' });
    expect(checkAchievements({ unlocked: { 'zone-1': NOW + 2 * 86_400_000 } }, NOW)).toEqual({ ok: false, error: 'bad_time' });
    expect(checkAchievements({ unlocked: { 'zone-1': 5 } }, NOW)).toEqual({ ok: false, error: 'bad_time' });
    expect(checkAchievements({ unlocked: [] }, NOW)).toEqual({ ok: false, error: 'bad_body' });
  });

  it('validates nicknames', () => {
    expect(checkNickname('요원_7')).toEqual({ ok: true, value: '요원_7' });
    expect(checkNickname('  Agent01 ')).toEqual({ ok: true, value: 'Agent01' });
    expect(checkNickname('a')).toEqual({ ok: false, error: 'invalid' });
    expect(checkNickname('abcdefghijklm')).toEqual({ ok: false, error: 'invalid' });
    expect(checkNickname('no space')).toEqual({ ok: false, error: 'invalid' });
    expect(checkNickname('ㅋㅋㅋ')).toEqual({ ok: false, error: 'invalid' }); // jamo are not syllables
    expect(checkNickname('F_u_c_k1')).toEqual({ ok: false, error: 'banned' });
    expect(checkNickname('씨1발')).toEqual({ ok: false, error: 'banned' });
    expect(checkNickname(42)).toEqual({ ok: false, error: 'invalid' });
  });
});
