// Balance (office part-2 spec §4): the skill-profiled bots' sanity checks and a coarse guard on the casual curve on a
// small seed set. The 4 characters share each seed's layout, so 30 seeds are only 30 layouts, and part-2 layouts vary a
// lot: on these seeds stage 8 reads 56% where 200 seeds read 74%, below stage 9's 69%. The slack is sized for that (it catches gross
// regressions, not 12 pp steps). The exact targets are checked on 200 seeds by
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
  it('casual: stage 1 ≥ 97%, stage 5 ≈ 93–95%, roughly non-increasing, no collapse, last stage near 58–62%', () => {
    const cells = STAGES.flatMap((_, i) => SKINS.map((skin) => measureCell('casual', i, skin, SEEDS)));
    expect(casualFailures(curve(cells, 'casual').clear, { rise: 15, step: 24, last: 12 })).toEqual([]);
  }, 120_000);
});
