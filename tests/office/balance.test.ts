// Balance (office part-2 spec §4): the skill-profiled bots' sanity checks and the casual target curve on a small
// seed set (noise slack: 30 seeds × 4 characters ≈ ±4.5 pp per stage). The exact targets are checked on 200 seeds by
//   BALANCE_REPORT=1 BALANCE_ASSERT=1 npx vitest run --project office tests/office/balance.report.test.ts
// Normal / expert targets: balance.spread.test.ts. Bot estimates, not human data (docs/balance/).
import { describe, expect, it } from 'vitest';
import { STAGES } from '../../src/core/content';
import { createSkilledBot, PROFILES, type ProfileId } from '../../src/game/bot-profiles';
import { collectCoins, measureCell, playRun, runSeeds, SKINS } from './balance.harness';
import { casualFailures, curve } from './balance.targets';

/** separate from the report's seeds so tuning is not fitted to the test set */
const SEEDS = runSeeds(30, 100_000);

describe('skill-profiled bots', () => {
  const stage = STAGES[0];

  it('replay the same run for the same seed', () => {
    const run = (): ReturnType<typeof playRun> =>
      playRun(stage, 'kid', 7, createSkilledBot(PROFILES.casual, 99, { seekCoin: collectCoins(stage.id) }));
    expect(run()).toEqual(run());
  });

  it('rank expert ≤ normal ≤ casual in hits on the last stage', () => {
    const last = STAGES.length - 1;
    const hits = (p: ProfileId): number => measureCell(p, last, 'kid', SEEDS.slice(0, 15)).hits;
    const [e, n, c] = [hits('expert'), hits('normal'), hits('casual')];
    expect(e).toBeLessThanOrEqual(n);
    expect(n).toBeLessThanOrEqual(c);
    expect(c).toBeGreaterThan(0);
  });
});

describe('balance targets (spec §4, small seed set)', () => {
  it('casual: stage 1 ≥ 95%, non-increasing, no step > 12 pp, last stage 40–50%', () => {
    const cells = STAGES.flatMap((_, i) => SKINS.map((skin) => measureCell('casual', i, skin, SEEDS)));
    expect(casualFailures(curve(cells, 'casual').clear, { rise: 6, step: 8, last: 8 })).toEqual([]);
  }, 120_000);
});
