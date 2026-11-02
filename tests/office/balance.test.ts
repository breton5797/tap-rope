// Balance targets (office part-2 spec §4) measured with the skill-profiled bots on a small seed set, plus the
// bots' own sanity checks. The target curve is skipped until the content tuning lands (the lead enables it).
// Full report: BALANCE_REPORT=1 npx vitest run --project office tests/office/balance.report.test.ts
import { describe, expect, it } from 'vitest';
import { STAGES } from '../../src/core/content';
import { createSkilledBot, PROFILES, type ProfileId } from '../../src/game/bot-profiles';
import { collectCoins, measureCell, playRun, runSeeds, SKINS } from './balance.harness';

/** small, separate from the report's seeds so tuning is not fitted to the test set */
const SEEDS = runSeeds(30, 100_000);

const clearOf = (profile: ProfileId, stageIndex: number): number[] =>
  SKINS.map((skin) => measureCell(profile, stageIndex, skin, SEEDS).clear);
const meanOf = (xs: readonly number[]): number => xs.reduce((a, x) => a + x, 0) / xs.length;

describe('skill-profiled bots', () => {
  const stage = STAGES[0];

  it('replay the same run for the same seed', () => {
    const run = (): ReturnType<typeof playRun> =>
      playRun(stage, 'kid', 7, createSkilledBot(PROFILES.casual, 99, { seekCoin: collectCoins(stage.id) }));
    expect(run()).toEqual(run());
  });

  it('rank expert ≤ normal ≤ casual in hits on stage 1', () => {
    const hits = (p: ProfileId): number => measureCell(p, 0, 'kid', SEEDS.slice(0, 15)).hits;
    const [e, n, c] = [hits('expert'), hits('normal'), hits('casual')];
    expect(e).toBeLessThanOrEqual(n);
    expect(n).toBeLessThanOrEqual(c);
    expect(c).toBeGreaterThan(0);
  });

  it('expert is near perfect and casual still clears stage 1', () => {
    expect(measureCell('expert', 0, 'kid', SEEDS.slice(0, 15)).clear).toBe(1);
    expect(measureCell('casual', 0, 'kid', SEEDS.slice(0, 15)).clear).toBeGreaterThanOrEqual(0.9);
  });
});

// spec §4 targets; enable once the stage / mission tuning lands (small seed count: ±~8 pp noise per cell)
describe.skip('balance targets (spec §4)', () => {
  const casual = STAGES.map((_, i) => clearOf('casual', i));

  it('casual: stage 1 ≥ 95%', () => {
    expect(meanOf(casual[0])).toBeGreaterThanOrEqual(0.95);
  });

  it('casual: no stage more than 12 pp below the one before', () => {
    const drops = casual.slice(1).map((c, i) => meanOf(casual[i]) - meanOf(c));
    expect(drops.every((d) => d <= 0.12)).toBe(true);
  });

  it('casual: last stage 40–50%', () => {
    const last = meanOf(casual[casual.length - 1]);
    expect(last).toBeGreaterThanOrEqual(0.4);
    expect(last).toBeLessThanOrEqual(0.5);
  });

  it('expert: ≥ 90% on every stage', () => {
    STAGES.forEach((_, i) => expect(meanOf(clearOf('expert', i))).toBeGreaterThanOrEqual(0.9));
  });

  it('casual: the four characters within ±5 pp of each other on every stage', () => {
    casual.forEach((c) => expect(Math.max(...c) - Math.min(...c)).toBeLessThanOrEqual(0.1));
  });
});
