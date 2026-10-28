import { describe, expect, it } from 'vitest';
import {
  applyJudge,
  comboMult,
  computeStars,
  FEVER_DURATION,
  initialScore,
  tickScore,
} from '../../src/core/scoring';
import type { Grade, JudgeResult, ObstacleKind, ScoreState } from '../../src/types';

function jr(grade: Grade, collected: ObstacleKind[] = []): JudgeResult {
  return { beatId: 0, grade, hit: grade === 'miss', reason: grade === 'miss' ? 'low' : null, collected };
}

function applyMany(s: ScoreState, grades: Grade[]): ScoreState {
  return grades.reduce((acc, g) => applyJudge(acc, jr(g)).score, s);
}

describe('initialScore', () => {
  it('is all zeros', () => {
    expect(initialScore()).toEqual({
      score: 0, combo: 0, maxCombo: 0, perfects: 0, greats: 0, goods: 0, misses: 0,
      feverGauge: 0, feverTime: 0, coins: 0,
    });
  });
});

describe('applyJudge', () => {
  it('v8: great = 75 and counts greats', () => {
    const g = applyJudge(initialScore(), jr('great')).score;
    expect(g.score).toBe(75);
    expect(g.greats).toBe(1);
    expect(g.combo).toBe(1);
    expect(g.feverGauge).toBeCloseTo(0.09);
  });

  it('perfect = 100, good = 50 at base multiplier', () => {
    const a = applyJudge(initialScore(), jr('perfect')).score;
    expect(a.score).toBe(100);
    expect(a.combo).toBe(1);
    expect(a.perfects).toBe(1);
    const b = applyJudge(a, jr('good')).score;
    expect(b.score).toBe(150);
    expect(b.goods).toBe(1);
  });

  it('v8 combo tiers: ×1 → 10 ×1.5 → 25 ×2 → 50 ×3', () => {
    expect([0, 9, 10, 24, 25, 49, 50, 500].map(comboMult)).toEqual([1, 1, 1.5, 1.5, 2, 2, 3, 3]);
    const s9 = applyMany(initialScore(), Array(9).fill('good'));
    const r = applyJudge({ ...s9, feverGauge: 0 }, jr('good'));
    expect(r.score.combo).toBe(10);
    expect(r.score.score - s9.score).toBe(75); // 50 × 1.5
    expect(r.comboMilestone).toBe(10);
    expect(applyJudge({ ...initialScore(), combo: 24 }, jr('perfect'))).toMatchObject({ comboMilestone: 25, score: { score: 200 } });
    expect(applyJudge({ ...initialScore(), combo: 150 }, jr('perfect')).score.score).toBe(300);
    expect(applyJudge({ ...initialScore(), combo: 11 }, jr('perfect')).comboMilestone).toBeNull();
  });

  it('miss resets combo and gauge and keeps maxCombo', () => {
    const s = applyMany(initialScore(), ['perfect', 'perfect', 'perfect']);
    const r = applyJudge(s, jr('miss')).score;
    expect(r.combo).toBe(0);
    expect(r.maxCombo).toBe(3);
    expect(r.feverGauge).toBe(0);
    expect(r.misses).toBe(1);
    expect(r.score).toBe(s.score);
  });

  it('none leaves combo unchanged, no milestone', () => {
    const s = { ...initialScore(), combo: 10 };
    const r = applyJudge(s, jr('none'));
    expect(r.score.combo).toBe(10);
    expect(r.comboMilestone).toBeNull();
    expect(r.feverStarted).toBe(false);
  });

  it('fills fever gauge and starts fever', () => {
    const s = { ...initialScore(), feverGauge: 0.95 };
    const r = applyJudge(s, jr('perfect'));
    expect(r.feverStarted).toBe(true);
    expect(r.score.feverTime).toBe(FEVER_DURATION);
    expect(r.score.feverGauge).toBe(0);
    expect(FEVER_DURATION).toBe(8);
    const g = applyJudge(initialScore(), jr('good')).score;
    expect(g.feverGauge).toBeCloseTo(0.05);
    expect(applyJudge(initialScore(), jr('perfect')).score.feverGauge).toBeCloseTo(0.12);
  });

  it('doubles points during fever and does not fill gauge', () => {
    const s = { ...initialScore(), feverTime: 3 };
    const r = applyJudge(s, jr('perfect')).score;
    expect(r.score).toBe(200);
    expect(r.feverGauge).toBe(0);
  });

  it('counts coins, +1 extra during fever', () => {
    const r = applyJudge(initialScore(), jr('none', ['coin', 'shield', 'coin'])).score;
    expect(r.coins).toBe(2);
    const f = applyJudge({ ...initialScore(), feverTime: 2 }, jr('perfect', ['coin'])).score;
    expect(f.coins).toBe(2);
  });

  it('does not mutate input', () => {
    const s = initialScore();
    applyJudge(s, jr('perfect'));
    expect(s).toEqual(initialScore());
  });
});

describe('tickScore', () => {
  it('counts down fever and clamps at 0', () => {
    const s = { ...initialScore(), feverTime: 1 };
    expect(tickScore(s, 0.25).feverTime).toBeCloseTo(0.75);
    expect(tickScore(s, 5).feverTime).toBe(0);
    const idle = initialScore();
    expect(tickScore(idle, 1)).toBe(idle);
  });
});

describe('computeStars', () => {
  const base = { ...initialScore(), perfects: 7, goods: 3 };
  it('0 when not cleared', () => {
    expect(computeStars(base, 0, false)).toBe(0);
  });
  it('3 when no hits and ≥60% perfect', () => {
    expect(computeStars(base, 0, true)).toBe(3);
  });
  it('2 when perfects are low or one hit', () => {
    expect(computeStars({ ...base, perfects: 5, goods: 5 }, 0, true)).toBe(2);
    expect(computeStars({ ...base, perfects: 5, greats: 5, goods: 0 }, 0, true)).toBe(2); // v8: greats are not perfects
    expect(computeStars(base, 1, true)).toBe(2);
  });
  it('1 when cleared with more hits', () => {
    expect(computeStars(base, 2, true)).toBe(1);
  });
  it('3 for an empty no-hit clear', () => {
    expect(computeStars(initialScore(), 0, true)).toBe(3);
  });
});
