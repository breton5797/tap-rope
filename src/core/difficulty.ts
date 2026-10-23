/**
 * Stage difficulty score (GDD v3 §18), computed from the generated hazard beats only
 * (pickups are ignored). Each term is normalised to 0..1, then weighted (weights sum to 1):
 * - rate   : hazard beats per second over the stage, / 2 (capped at 1)
 * - tight  : 1 / mean(actual gap ÷ minimum allowed gap) over consecutive hazards — the inverse
 *            of the average gap measured in units of its minimum (spacing.ts, with the stage's
 *            gravity, rounded up to the stage's half-beat grid), so 1 = every hazard comes as
 *            early as the rules and the rhythm grid allow, at any tempo
 * - change : share of consecutive hazards whose move (moveForBeat) differs
 * - multi  : share of 2단/3단 beats, a 3단 counting 1.5 and a Double-Dutch beat (two ropes in one
 *            jump window) counting as a 2단, so long and solo stages compare fairly (capped at 1)
 * - combo  : share of beats with two or more hazards at once (rope + hurdle/ball/bird)
 * - length : hazard beats / 60 (endurance; not in the §18 list — added so long boss finales
 *            register as harder than their chapter's normal stages)
 */
import type { Beat, StageDef } from '../types';
import { HAZARD_KINDS } from '../types';
import { moveForBeat } from './moves';
import { physicsForWorld } from './physics';
import { beatShape, minGap } from './spacing';

export const DIFFICULTY_WEIGHTS = { rate: 0.15, tight: 0.35, change: 0.1, multi: 0.15, combo: 0.1, length: 0.15 } as const;

export type DifficultyTerms = Readonly<Record<keyof typeof DIFFICULTY_WEIGHTS, number>>;

const hazardCount = (b: Beat) => b.obstacles.filter((o) => HAZARD_KINDS.includes(o.kind)).length;
const share = (n: number, total: number) => (total > 0 ? n / total : 0);
const multiPoint = (b: Beat) => (b.requiredLevel === 3 ? 1.5 : b.requiredLevel === 2 || b.doubleDutch ? 1 : 0);
const ZERO: DifficultyTerms = { rate: 0, tight: 0, change: 0, multi: 0, combo: 0, length: 0 };
const LENGTH_FULL = 60;

/** The normalised terms behind stageDifficulty (all 0 with fewer than two hazards). */
export function difficultyTerms(stage: StageDef, beats: readonly Beat[]): DifficultyTerms {
  const hz = beats.filter((b) => hazardCount(b) > 0);
  if (hz.length < 2) return ZERO;
  const cfg = physicsForWorld(stage.world);
  const half = 30 / stage.bpm;
  const onGrid = (sec: number) => Math.max(half, Math.ceil(sec / half - 1e-9) * half);
  const pairs = hz.slice(1).map((b, i) => ({ prev: hz[i], next: b }));
  const ratios = pairs.map(({ prev, next }) =>
    (next.time - prev.time) / onGrid(minGap(beatShape(prev), beatShape(next), cfg)));
  const meanRatio = ratios.reduce((a, r) => a + r, 0) / ratios.length;
  const span = hz[hz.length - 1].time - hz[0].time;
  const moves = hz.map(moveForBeat);
  const multiPoints = hz.reduce((a, b) => a + multiPoint(b), 0);
  return {
    rate: Math.min(1, share(hz.length, span) / 2),
    tight: Math.min(1, 1 / meanRatio),
    change: share(moves.slice(1).filter((m, i) => m !== moves[i]).length, hz.length - 1),
    multi: Math.min(1, share(multiPoints, hz.length)),
    combo: share(hz.filter((b) => hazardCount(b) >= 2).length, hz.length),
    length: Math.min(1, hz.length / LENGTH_FULL),
  };
}

export function stageDifficulty(stage: StageDef, beats: readonly Beat[]): number {
  const terms = difficultyTerms(stage, beats);
  return (Object.keys(DIFFICULTY_WEIGHTS) as (keyof typeof DIFFICULTY_WEIGHTS)[])
    .reduce((sum, k) => sum + DIFFICULTY_WEIGHTS[k] * terms[k], 0);
}
