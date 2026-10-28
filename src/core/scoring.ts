/**
 * Score, combo, fever gauge and star rating (GDD §1, §4).
 * Points = base (perfect 100 / great 75 / good 50) × combo tier multiplier (v8: ×1, ×1.5 from 10,
 * ×2 from 25, ×3 from 50) × 2 during fever. Fever multiplier and coin bonus use the fever state
 * BEFORE the judged beat. Shield/slow/heart effects belong to the integration.
 * ★3 = no hits and PERFECT ≥ 60% of judged beats.
 */
import type { JudgeResult, ScoreState } from '../types';

export const FEVER_DURATION = 8;

type PassGrade = 'perfect' | 'great' | 'good';

const POINTS: Readonly<Record<PassGrade, number>> = { perfect: 100, great: 75, good: 50 };
const GAUGE_GAIN: Readonly<Record<PassGrade, number>> = { perfect: 0.12, great: 0.09, good: 0.05 };
/** v8 combo tiers, highest first: from `combo` passes in a row the points are multiplied by `mult` */
export const COMBO_TIERS: readonly { readonly combo: number; readonly mult: number }[] = [
  { combo: 50, mult: 3 }, { combo: 25, mult: 2 }, { combo: 10, mult: 1.5 }, { combo: 0, mult: 1 },
];

export function initialScore(): ScoreState {
  return {
    score: 0, combo: 0, maxCombo: 0, perfects: 0, greats: 0, goods: 0, misses: 0,
    feverGauge: 0, feverTime: 0, coins: 0,
  };
}

export function comboMult(combo: number): number {
  return (COMBO_TIERS.find((t) => combo >= t.combo) ?? COMBO_TIERS[COMBO_TIERS.length - 1]).mult;
}

/** a milestone every 10 combo and on reaching each tier (25) */
const isMilestone = (combo: number): boolean => combo % 10 === 0 || COMBO_TIERS.some((t) => t.combo === combo && combo > 0);

function coinsFor(r: JudgeResult, fever: boolean): number {
  const n = r.collected.filter((k) => k === 'coin').length;
  return n * (fever ? 2 : 1);
}

interface ApplyResult {
  readonly score: ScoreState;
  readonly feverStarted: boolean;
  readonly comboMilestone: number | null;
}

function applyPass(s: ScoreState, grade: PassGrade, fever: boolean): ApplyResult {
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
    greats: s.greats + (grade === 'great' ? 1 : 0),
    goods: s.goods + (grade === 'good' ? 1 : 0),
    feverGauge: feverStarted ? 0 : gauge,
    feverTime: feverStarted ? FEVER_DURATION : s.feverTime,
  };
  return { score, feverStarted, comboMilestone: isMilestone(combo) ? combo : null };
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
  const total = s.perfects + s.greats + s.goods + s.misses;
  const perfectRatio = total > 0 ? s.perfects / total : 1;
  if (hitsTaken === 0 && perfectRatio >= 0.6) return 3;
  if (hitsTaken <= 1) return 2;
  return 1;
}
