/**
 * Score, combo, fever gauge and star rating (GDD §1, §4).
 * Points = base (perfect 100 / good 50) × combo multiplier (1 + 0.1·⌊combo/10⌋,
 * cap 2) × 2 during fever. Fever multiplier and coin bonus use the fever state
 * BEFORE the judged beat. Shield/slow/heart effects belong to the integration.
 */
import type { JudgeResult, ScoreState } from '../types';

export const FEVER_DURATION = 8;

const POINTS = { perfect: 100, good: 50 } as const;
const GAUGE_GAIN = { perfect: 0.12, good: 0.05 } as const;
const MAX_MULT = 2;

export function initialScore(): ScoreState {
  return {
    score: 0, combo: 0, maxCombo: 0, perfects: 0, goods: 0, misses: 0,
    feverGauge: 0, feverTime: 0, coins: 0,
  };
}

function comboMult(combo: number): number {
  return Math.min(MAX_MULT, 1 + 0.1 * Math.floor(combo / 10));
}

function coinsFor(r: JudgeResult, fever: boolean): number {
  const n = r.collected.filter((k) => k === 'coin').length;
  return n * (fever ? 2 : 1);
}

interface ApplyResult {
  readonly score: ScoreState;
  readonly feverStarted: boolean;
  readonly comboMilestone: number | null;
}

function applyPass(s: ScoreState, grade: 'perfect' | 'good', fever: boolean): ApplyResult {
  const combo = s.combo + 1;
  const points = Math.round(POINTS[grade] * comboMult(combo) * (fever ? 2 : 1));
  const gauge = fever ? s.feverGauge : s.feverGauge + GAUGE_GAIN[grade];
  const feverStarted = !fever && gauge >= 1 - 1e-9;
  const score: ScoreState = {
    ...s,
    score: s.score + points,
    combo,
    maxCombo: Math.max(s.maxCombo, combo),
    perfects: s.perfects + (grade === 'perfect' ? 1 : 0),
    goods: s.goods + (grade === 'good' ? 1 : 0),
    feverGauge: feverStarted ? 0 : gauge,
    feverTime: feverStarted ? FEVER_DURATION : s.feverTime,
  };
  return { score, feverStarted, comboMilestone: combo % 10 === 0 ? combo : null };
}

export function applyJudge(s: ScoreState, r: JudgeResult): ApplyResult {
  const fever = s.feverTime > 0;
  const withCoins: ScoreState = { ...s, coins: s.coins + coinsFor(r, fever) };
  if (r.grade === 'none') return { score: withCoins, feverStarted: false, comboMilestone: null };
  if (r.grade === 'miss') {
    const score = { ...withCoins, combo: 0, feverGauge: 0, misses: s.misses + 1 };
    return { score, feverStarted: false, comboMilestone: null };
  }
  return applyPass(withCoins, r.grade, fever);
}

export function tickScore(s: ScoreState, dt: number): ScoreState {
  if (s.feverTime <= 0) return s;
  return { ...s, feverTime: Math.max(0, s.feverTime - dt) };
}

export function computeStars(s: ScoreState, hitsTaken: number, cleared: boolean): number {
  if (!cleared) return 0;
  const total = s.perfects + s.goods + s.misses;
  const perfectRatio = total > 0 ? s.perfects / total : 1;
  if (hitsTaken === 0 && perfectRatio >= 0.6) return 3;
  if (hitsTaken <= 1) return 2;
  return 1;
}
